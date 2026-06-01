// src/modules/speech.js
// Text-to-Speech + Spracherkennung (Web Speech API + Vosk Offline).
// Shared state (_ttsVoices, _spokenForQuestion, _voskStatus, _voskModel, …)
// liegt auf window damit Legacy-Code in index.html direkt darauf zugreifen kann.

let _ttsReady = false;
let _ttsWarmupDone = false;
let _ttsWarmingUp = false;
let _afterWarmup = null;

// ── TEMP TTS-DIAGNOSE — sichtbarer On-Screen-Log (nach Analyse wieder entfernen) ──
function _ttsDebug(msg) {
  try {
    console.log('[TTS]', msg);
    let el = document.getElementById('_tts-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = '_tts-debug';
      el.style.cssText = 'position:fixed;left:6px;right:6px;bottom:6px;z-index:99999;background:rgba(0,0,0,.85);color:#3f6;font:11px/1.45 monospace;padding:6px 8px;border-radius:8px;max-height:42vh;overflow:auto;white-space:pre-wrap;pointer-events:none;';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent += (el.textContent ? '\n' : '') + msg;
    el.scrollTop = el.scrollHeight;
  } catch(e) {}
}

// Wärmt die TTS-Engine auf — browser-gesperrt bis zur ersten User-Geste.
// Mehrfache Aufrufe während Warmup läuft: letzter Callback gewinnt.
function _ensureTTSWarm(callback) {
  if (_ttsWarmupDone) { callback(); return; }
  _afterWarmup = callback;
  if (_ttsWarmingUp) return;
  if (!window.speechSynthesis) { _ttsWarmupDone = true; callback(); return; }
  _ttsWarmingUp = true;
  _ttsDebug('warmup START (Geste?) voices=' + (window.speechSynthesis.getVoices()||[]).length);
  try {
    const w = new SpeechSynthesisUtterance(' ');
    w.volume = 0; w.rate = 10;
    const done = (via) => {
      if (_ttsWarmupDone) return;
      _ttsDebug('warmup DONE via ' + (via || '?'));
      _ttsWarmupDone = true; _ttsWarmingUp = false;
      const f = _afterWarmup; _afterWarmup = null; if (f) f();
    };
    w.onend = () => done('onend'); w.onerror = (e) => { _ttsDebug('warmup onerror ' + (e && e.error)); done('onerror'); };
    window.speechSynthesis.speak(w);
    setTimeout(() => done('timeout400'), 400); // Fallback: manche Browser feuern onend bei volume=0 nicht
  } catch(e) {
    _ttsWarmupDone = true; _ttsWarmingUp = false;
    const f = _afterWarmup; _afterWarmup = null; if (f) f();
  }
}

// Öffentlich: Engine nach erster User-Geste aufwärmen (aus startup.js aufgerufen)
export function primeTTS() {
  _ensureTTSWarm(() => {});
}

export function _initTTS() {
  if (!window.speechSynthesis) return;
  window._ttsVoices = window.speechSynthesis.getVoices();
  if (window._ttsVoices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window._ttsVoices = window.speechSynthesis.getVoices();
      _ttsReady = true;
    };
  } else {
    _ttsReady = true;
  }
}

// Stellt sicher, dass Stimmen geladen sind, BEVOR gesprochen wird. Auf Android ist
// getVoices() beim ersten Aufruf leer und füllt sich erst per voiceschanged (das
// manchmal erst nach dem ersten speak() feuert) → sonst spricht der Browser ohne
// gesetzte Stimme = stumm. Desktop: Stimmen sofort da → cb läuft synchron.
// Startup-unabhängig: funktioniert egal wann/ob der Startup gepollt hat.
function _withVoices(cb) {
  const get = () => (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || [];
  if (get().length) { window._ttsVoices = get(); _ttsDebug('_withVoices: ' + get().length + ' Stimmen sofort'); cb(); return; }
  _ttsDebug('_withVoices: 0 Stimmen → warte (voiceschanged/poll)');
  let done = false;
  let poll = null;
  const go = (via) => {
    if (done) return; done = true;
    if (poll) { clearInterval(poll); poll = null; }
    window._ttsVoices = get();
    _ttsDebug('_withVoices: weiter via ' + via + ' → ' + window._ttsVoices.length + ' Stimmen');
    cb();
  };
  try { window.speechSynthesis.addEventListener('voiceschanged', () => go('voiceschanged'), { once: true }); } catch(e) {}
  // Poll-Fallback für Android (voiceschanged feuert unzuverlässig) + harter Timeout:
  // nach ~1.5s notfalls trotzdem sprechen (Default-Stimme), statt stumm zu bleiben.
  let tries = 0;
  poll = setInterval(() => { if (get().length) go('poll'); else if (++tries >= 15) go('TIMEOUT'); }, 100);
}

// Geordnete Stimmen-Kandidaten: gemerkte funktionierende → benannte en-US →
// en-US → en-GB → übrige en-* → null (System-Default, keine voice gesetzt).
// Letzte Rückfalllinie deckt Geräte ohne brauchbare gelistete en-Stimme ab.
function _ttsVoiceChain() {
  const voices = window._ttsVoices || [];
  const chain = [];
  const add = v => { if (v && !chain.includes(v)) chain.push(v); };
  let remembered = null;
  try { remembered = localStorage.getItem('es_tts_voice'); } catch(e) {}
  if (remembered) add(voices.find(v => (v.voiceURI || v.name) === remembered));
  add(voices.find(v => v.lang === 'en-US' && (v.name.includes('Google US') || v.name.includes('Samantha') || v.name.includes('Alex'))));
  voices.filter(v => v.lang === 'en-US').forEach(add);
  voices.filter(v => v.lang === 'en-GB').forEach(add);
  voices.filter(v => /^en/i.test(v.lang)).forEach(add);
  chain.push(null); // System-Default — Qualität zuerst, Default als Garantie
  return chain;
}

// Spricht mit der ersten Stimme der Kette, die nicht mit synthesis-failed o.ä.
// abbricht. Funktionierende Stimme wird gemerkt (localStorage), damit die kaputte
// nicht jedes Mal zuerst probiert wird.
function _speakImmediate(word, onDone) {
  _withVoices(() => {
    const chain = _ttsVoiceChain();
    const RETRY_ERRORS = ['synthesis-failed', 'voice-unavailable', 'synthesis-unavailable', 'language-unavailable'];
    let idx = 0;
    let finished = false;
    const finish = () => { if (finished) return; finished = true; if (onDone) onDone(); };
    const tryNext = () => {
      if (idx >= chain.length) { _ttsDebug('TTS: alle Kandidaten erschöpft'); finish(); return; }
      const voice = chain[idx++];
      const label = voice ? (voice.name + ' (' + voice.lang + ')') : 'SYSTEM-DEFAULT';
      const utt = new SpeechSynthesisUtterance(word);
      utt.lang = 'en-US'; utt.rate = 0.85; utt.pitch = 1.0;
      if (voice) utt.voice = voice;
      let started = false;
      utt.onstart = () => {
        started = true;
        _ttsDebug('onstart ▶ ' + label);
        if (voice) { try { localStorage.setItem('es_tts_voice', voice.voiceURI || voice.name); } catch(e) {} }
      };
      utt.onend = () => { _ttsDebug('onend ✓ ' + label); finish(); };
      utt.onerror = (e) => {
        const err = e && e.error;
        _ttsDebug('onerror ✗ ' + err + ' [' + label + ']');
        if (!started && RETRY_ERRORS.includes(err)) tryNext(); // nächste Stimme probieren
        else finish();
      };
      _ttsDebug('speak() → ' + label);
      window.speechSynthesis.speak(utt);
    };
    tryNext();
  });
}

export function speakWord(word, onDone) {
  if (!window.speechSynthesis || !word) { _ttsDebug('speakWord SKIP synth=' + !!window.speechSynthesis + ' word=' + word); return; }
  _ttsDebug('speakWord("' + word + '") warmupDone=' + _ttsWarmupDone + ' voices=' + (window.speechSynthesis.getVoices()||[]).length);
  if (!_ttsWarmupDone) {
    if (_ttsWarmingUp) {
      _afterWarmup = () => speakWord(word, onDone);
    } else {
      window.speechSynthesis.cancel();
      _ensureTTSWarm(() => speakWord(word, onDone));
    }
    return;
  }
  window.speechSynthesis.cancel();
  _speakImmediate(word, onDone);
}

export function speakWordOnce(word) {
  if (window._spokenForQuestion) return;
  window._spokenForQuestion = true;
  speakWord(word);
}

// TTS beim window.load initialisieren (Warmup für Desktop)
window.addEventListener('load', () => { _initTTS(); });


// ════════════════════════════════════════════════
//  VOSK LOADER (shared state auf window)
// ════════════════════════════════════════════════
window._voskStatus = 'idle';
window._voskReady = false; // true sobald Modell geladen+initialisiert — entkoppelt vom Startup-Gate
window._voskLoad = async function() {
  if (window._voskModel) { window._voskReady = true; return window._voskModel; }
  if (window._voskStatus === 'loading') {
    const start = Date.now();
    while (window._voskStatus === 'loading' && Date.now() - start < 90000) {
      await new Promise(r => setTimeout(r, 200));
    }
    return window._voskModel;
  }
  if (typeof Vosk === 'undefined') {
    console.warn('[Vosk] Library nicht verfügbar');
    window._voskStatus = 'failed';
    return null;
  }
  try {
    window._voskStatus = 'loading';
    // Same-origin gehostet (models/) → vom Service Worker cache-first persistent
    // gecacht, kein Re-Download bei jedem Kaltstart. document.baseURI macht den
    // Pfad unter dem GitHub-Pages-Projektpfad (/english-stars-v4/) korrekt.
    const modelUrl = new URL('models/vosk-model-small-en-us-0.15.tar.gz', document.baseURI).href;
    const model = await Vosk.createModel(modelUrl);
    window._voskModel = model;
    window._voskStatus = 'ready';
    window._voskReady = true;
    try { localStorage.setItem('es_vosk_loaded', '1'); } catch(e) {}
    console.log('[Vosk] Modell geladen');
    return model;
  } catch(e) {
    console.warn('[Vosk] Fehler beim Laden:', e);
    window._voskStatus = 'failed';
    return null;
  }
};

// ════════════════════════════════════════════════
//  AUSSPRACHE-MODUS — private state
// ════════════════════════════════════════════════
let _micStream = null;
let _micActive = false; // true solange Mic-Stream oder Vosk-Stream aktiv
let _micTimeout = null;
let _vizAF = null;
let _vizSrc = null;      // MediaStreamAudioSourceNode — vor AudioContext.close() disconnect()
let _vizStream = null;   // iOS-only: separater getUserMedia-Stream nur für Visualizer
let _analyser = null;
let _audioCtx = null;
let _voskRec = null;
let _voskMediaSource = null;
let _activeSR = null;    // aktive SpeechRecognition-Instanz — für abort() bei Cleanup

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

function _isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function ensureMicStream() {
  if (_isIOS()) return null; // iOS: SpeechRecognition verwaltet eigenes Mic — kein zweites getUserMedia
  if (_micStream && _micStream.active) return _micStream;
  try {
    _micStream = await navigator.mediaDevices.getUserMedia({
      audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false},
      video: false
    });
    _micActive = true;
    return _micStream;
  } catch(e) { return null; }
}

export function releaseMicStream() {
  console.log('[releaseMicStream] called — _micActive:', _micActive, 'SR:', !!_activeSR, 'stream:', !!_micStream);
  if (_activeSR) {
    try { _activeSR.abort(); } catch(e) {}
    _activeSR = null;
  }
  _micActive = false;
  if (_micStream) {
    try { _micStream.getTracks().forEach(t => t.stop()); } catch(e) {}
    _micStream = null;
  }
  _scheduleIosMusicResume();
}

// iOS: Nach Track-Stop ~300ms warten bis Audio-Session zurück auf Playback schaltet,
// dann Musik resumed. Abgebrochen wenn inzwischen ein neues Recording begonnen hat.
function _scheduleIosMusicResume() {
  if (!window._musicOn || !window._musicAudio) return;
  setTimeout(() => {
    if (_micActive) return;
    if (!window._musicOn) return;
    // call play() auch wenn nicht paused — signalisiert iOS Playback-Session zurück
    window._musicAudio.play().catch(() => {});
  }, 600);
}

// ════════════════════════════════════════════════
//  AUDIO-VISUALIZER
// ════════════════════════════════════════════════

// AudioContext synchron anlegen/aufwecken — muss während User-Gesture passieren.
// Danach kann startVisualizer() den bereits laufenden Context nutzen.
function _ensureAudioCtx() {
  if (_audioCtx && _audioCtx.state !== 'closed') {
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
    return;
  }
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    _audioCtx.resume().catch(() => {});
  } catch(e) { _audioCtx = null; }
}

// Grafik und Visualizer-Stream bereinigen — AudioContext und mic-Stream bleiben intakt.
function _clearVisualizerState() {
  if (_vizAF) { cancelAnimationFrame(_vizAF); _vizAF = null; }
  if (_analyser) { try { _analyser.disconnect(); } catch(e) {} _analyser = null; }
  if (_vizSrc) { try { _vizSrc.disconnect(); } catch(e) {} _vizSrc = null; }
  if (_vizStream) {
    try { _vizStream.getTracks().forEach(t => t.stop()); } catch(e) {}
    _vizStream = null;
  }
  const canvas = document.getElementById('viz-canvas');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

export function startVisualizer(stream) {
  _clearVisualizerState();
  if (!stream) return;
  const canvas = document.getElementById('viz-canvas');
  if (!canvas) return;
  try {
    // _audioCtx wurde synchron in startRecording() angelegt und resumed.
    // Fallback: neu erstellen; bei 'suspended' aufwecken (iOS kann Context zwischen
    // der synchronen Anlage und dem async-Callback in suspended setzen).
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state !== 'running') _audioCtx.resume().catch(() => {});
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 256;
    _analyser.smoothingTimeConstant = 0.6;
    _vizSrc = _audioCtx.createMediaStreamSource(stream);
    const gain = _audioCtx.createGain();
    gain.gain.value = 6.0;
    _vizSrc.connect(gain);
    gain.connect(_analyser);
    const buf = new Uint8Array(_analyser.frequencyBinCount);
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let _lastDraw = 0;
    function draw(ts) {
      _vizAF = requestAnimationFrame(draw);
      if (ts - _lastDraw < 33) return;
      _lastDraw = ts;
      _analyser.getByteFrequencyData(buf);
      ctx.clearRect(0, 0, W, H);
      const barW = W / buf.length * 2;
      let x = 0;
      for (let i = 0; i < buf.length; i++) {
        const h = buf[i] / 255 * H;
        const hue = 200 + buf[i] / 2;
        ctx.fillStyle = `hsl(${hue},90%,60%)`;
        ctx.fillRect(x, H - h, barW - 1, h);
        x += barW;
      }
    }
    requestAnimationFrame(draw);
  } catch(e) {}
}

export function stopVisualizer() {
  console.log('[stopVisualizer] called — _vizSrc:', !!_vizSrc, 'ctx:', !!_audioCtx, 'SR:', !!_activeSR);
  _clearVisualizerState();
  if (_audioCtx) { try { _audioCtx.close(); } catch(e) {} _audioCtx = null; }
  releaseMicStream();
}

// ════════════════════════════════════════════════
//  VOSK — Offline-Spracherkennung
// ════════════════════════════════════════════════
export async function voskStart(onResult, onError) {
  try {
    if (!window._voskModel) {
      if (window._voskStatus !== 'loading' && window._voskStatus !== 'ready') {
        window._voskLoad();
      }
      const start = Date.now();
      while (!window._voskModel && Date.now() - start < 90000) {
        if (window._voskStatus === 'failed') throw new Error('Vosk-Lade-Fehler');
        await new Promise(r => setTimeout(r, 200));
      }
      if (!window._voskModel) throw new Error('Vosk timeout');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1, sampleRate:16000}
    });
    _micActive = true;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const rec = new window._voskModel.KaldiRecognizer(ctx.sampleRate);
    rec.setWords(true);
    rec.on('result', m => {
      console.log('[Vosk] result:', m);
      if (m && m.result && m.result.text) onResult(m.result.text, true);
    });
    rec.on('partialresult', m => {
      if (m && m.result && m.result.partial) {
        console.log('[Vosk] partial:', m.result.partial);
        onResult(m.result.partial, false);
      }
    });
    const src = ctx.createMediaStreamSource(stream);
    _voskRec = {rec, ctx, src, stream, vizAF: null};
    try {
      const canvas = document.getElementById('viz-canvas');
      if (canvas) {
        const vizAnalyser = ctx.createAnalyser();
        vizAnalyser.fftSize = 256;
        vizAnalyser.smoothingTimeConstant = 0.6;
        const vizGain = ctx.createGain();
        vizGain.gain.value = 6.0;
        src.connect(vizGain);
        vizGain.connect(vizAnalyser);
        const buf = new Uint8Array(vizAnalyser.frequencyBinCount);
        const cctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        let _lastDraw = 0;
        function drawViz(t) {
          if (!_voskRec) return;
          _voskRec.vizAF = requestAnimationFrame(drawViz);
          if (t - _lastDraw < 33) return;
          _lastDraw = t;
          vizAnalyser.getByteFrequencyData(buf);
          cctx.clearRect(0, 0, W, H);
          const barW = W / buf.length * 2;
          let x = 0;
          for (let i = 0; i < buf.length; i++) {
            const h = buf[i] / 255 * H;
            const hue = 200 + buf[i] / 2;
            cctx.fillStyle = `hsl(${hue},90%,60%)`;
            cctx.fillRect(x, H - h, barW - 1, h);
            x += barW;
          }
        }
        drawViz(0);
      }
    } catch(e) { console.warn('[Vosk] Visualizer-Fehler:', e); }
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = e => {
      try { rec.acceptWaveform(e.inputBuffer); } catch(err) { console.error('[Vosk] acceptWaveform:', err); }
    };
    src.connect(proc);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    proc.connect(sink);
    sink.connect(ctx.destination);
    _voskRec.proc = proc;
    _voskRec.sink = sink;
    console.log('[Vosk] Aufnahme läuft, sampleRate:', ctx.sampleRate);
    return true;
  } catch(e) {
    console.error('[Vosk] start error:', e);
    if (onError) onError(e);
    return false;
  }
}

export function voskStop() {
  if (!_voskRec) return;
  if (_voskRec.vizAF) try { cancelAnimationFrame(_voskRec.vizAF); } catch(e) {}
  try { _voskRec.proc.disconnect(); } catch(e) {}
  try { _voskRec.sink.disconnect(); } catch(e) {}
  try { _voskRec.src.disconnect(); } catch(e) {}
  try { _voskRec.ctx.close(); } catch(e) {}
  try { _voskRec.rec.remove(); } catch(e) {}
  try { if (_voskRec.stream) _voskRec.stream.getTracks().forEach(t => t.stop()); } catch(e) {}
  _voskRec = null;
  _micActive = false;
  _scheduleIosMusicResume();
  const canvas = document.getElementById('viz-canvas');
  if (canvas) { const cctx = canvas.getContext('2d'); cctx.clearRect(0, 0, canvas.width, canvas.height); }
}

// ════════════════════════════════════════════════
//  PLATTFORM-DETECTION + AUFNAHME
// ════════════════════════════════════════════════
export function _shouldUseVosk() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  if (isIOS) return false;
  if (!isMobile) return false;
  if (isAndroid) return true;
  return true;
}

export function startRecording() {
  console.log('[startRecording] call — answered:', window.answered, 'currentQ:', window.currentQ?.answer);
  try { voskStop(); } catch(e) {}
  try { stopVisualizer(); } catch(e) {}
  try { releaseMicStream(); } catch(e) {}
  document.getElementById('self-rate-wrap')?.remove();
  if (window.answered) { console.log('[startRecording] skip: answered'); return; }
  if (!window.currentQ) { console.log('[startRecording] skip: no currentQ'); return; }
  const btn = document.getElementById('mic-btn');
  const result = document.getElementById('pronounce-result');
  if (!result) return;

  // Vosk-Pfad: Readiness NICHT hier prüfen — startVoskRecognition zeigt bei noch
  // ladendem Modell den Warte-Status und startet automatisch, sobald bereit.
  // _shouldUseVosk() trennt sauber: iOS/Desktop → false → Web-Speech-Pfad unten.
  if (_shouldUseVosk() || window._webSpeechFailed) {
    console.log('[Recording] Vosk-Pfad (Status/Warten regelt startVoskRecognition)');
    startVoskRecognition(window.currentQ.answer, result, btn);
    return;
  }

  // AudioContext synchron anlegen während die User-Gesture noch aktiv ist.
  // Nur im Web-Speech-Pfad (Vosk hat eigenes AudioCtx-Management).
  _ensureAudioCtx();

  function resetBtn() {
    if (btn) { btn.className = 'mic-btn'; btn.disabled = false; btn.textContent = '🎙️ Nochmal'; btn.onclick = window.startRecording; }
  }
  function showFinalBtn(ok) {
    if (!btn) return;
    btn.disabled = true;
    btn.onclick = null;
    if (ok) {
      btn.className = 'mic-btn done-correct';
      btn.textContent = '✨ Klasse!';
    } else {
      btn.className = 'mic-btn done-wrong';
      btn.textContent = '💭 Knapp daneben!';
    }
  }
  function clearTG() {
    if (_micTimeout) { clearTimeout(_micTimeout); _micTimeout = null; }
    if (_micHint) { clearTimeout(_micHint); _micHint = null; }
  }
  let _micHint = null;
  function setTG() {
    clearTG();
    _micTimeout = setTimeout(() => {
      if (!window.answered) {
        clearTG(); stopVisualizer();
        if (typeof _bestAlts !== 'undefined' && _bestAlts.length > 0) {
          result.style.display = 'block'; result.className = 'pronounce-result heard';
          result.textContent = '🗣️ Erkannt: "' + _bestAlts[0] + '"';
          resetBtn();
          window.evaluateWithClaude(_bestAlts.join('|'), window.currentQ.answer);
        } else {
          try { releaseMicStream(); } catch(e) {}
          result.style.display = 'block'; result.className = 'pronounce-result heard';
          result.textContent = '⏱️ Nichts erkannt';
          resetBtn();
          window._webSpeechFailed = true;
          console.log('[Recording] Web Speech: kein Resultat → bei nächstem Versuch Vosk');
          window.showSelfRateButtons();
        }
      }
    }, 5000);
  }

  if (!navigator.mediaDevices) {
    result.style.display = 'block'; result.className = 'pronounce-result';
    result.textContent = '❌ Mikrofon nicht verfügbar. Bitte Chrome verwenden.';
    return;
  }

  ensureMicStream().then(async stream => {
    if (!stream && !_isIOS()) {
      result.style.display = 'block'; result.className = 'pronounce-result';
      result.textContent = '❌ Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.';
      return;
    }

    // iOS: SpeechRec verwaltet eigenen Mic-Track; wir brauchen einen zweiten nur für den Visualizer.
    // Awaiten VOR sr.start() damit iOS Permission bereits erteilt ist → kein Doppel-Prompt.
    if (_isIOS() && navigator.mediaDevices) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false},
          video: false
        });
        _vizStream = s;
        stream = s;
      } catch(e) {} // Visualizer ist optional, Erkennung läuft ohne
    }

    startVisualizer(stream);
    btn.className = 'mic-btn recording'; btn.textContent = '⏹️ Stopp';

    if (SpeechRec) {
      const targetWord = window.currentQ.answer;
      const sr = new SpeechRec();
      sr.lang = 'en-US';
      sr.interimResults = true;
      sr.maxAlternatives = 8;
      sr.continuous = false;
      _activeSR = sr;

      btn.onclick = () => { clearTG(); stopVisualizer(); try { sr.stop(); } catch(e) {} };

      let _lastAlts = [];
      let _finished = false;
      sr.onresult = (e) => {
        if (_finished) return;
        const alts = [];
        for (let r = 0; r < e.results.length; r++) {
          for (let a = 0; a < e.results[r].length; a++) {
            const t = e.results[r][a].transcript.toLowerCase().trim().replace(/[.,!?;:"]/g, '');
            if (t && !alts.includes(t)) alts.push(t);
          }
        }
        _lastAlts = alts;
        if (alts.length > 0) {
          result.style.display = 'block'; result.className = 'pronounce-result heard';
          result.textContent = '🗣️ Erkannt: "' + alts[0] + '"';
        }
        const tLow = targetWord.toLowerCase().replace(/^to /, '').trim();
        const match = alts.some(a => a === tLow || a.split(' ').includes(tLow));
        if (match && e.results[e.results.length - 1].isFinal) {
          _finished = true;
          window._webSpeechFailed = false;
          clearTG(); stopVisualizer(); resetBtn();
          document.getElementById('self-rate-wrap')?.remove();
          window.evaluateWithClaude(alts.join('|'), targetWord);
        } else if (e.results[e.results.length - 1].isFinal) {
          _finished = true;
          clearTG(); stopVisualizer(); resetBtn();
          document.getElementById('self-rate-wrap')?.remove();
          window.evaluateWithClaude(alts.join('|'), targetWord);
        }
      };

      sr.onerror = (e) => {
        _activeSR = null; // zuerst nullen, damit releaseMicStream kein abort() mehr macht
        clearTG(); stopVisualizer(); resetBtn();
        if (e.error === 'not-allowed') {
          result.style.display = 'block'; result.className = 'pronounce-result';
          result.textContent = '❌ Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.';
        } else if (e.error === 'network' || e.error === 'service-not-allowed') {
          window._webSpeechFailed = true;
          result.style.display = 'block'; result.className = 'pronounce-result';
          result.innerHTML = '⏳ Lade Offline-Spracherkennung…<br><small style="opacity:.8">(beim ersten Mal ~40 MB Download, danach offline)</small>';
          startVoskRecognition(targetWord, result, btn);
        } else if (e.error === 'no-speech') {
          window._webSpeechFailed = true;
          clearTG(); stopVisualizer(); resetBtn();
          result.style.display = 'block'; result.className = 'pronounce-result heard';
          result.textContent = '🤷 Nichts gehört';
          window.showSelfRateButtons();
        } else {
          window._webSpeechFailed = true;
          clearTG(); stopVisualizer(); resetBtn();
          result.style.display = 'block'; result.className = 'pronounce-result heard';
          result.textContent = '🤷 Nichts erkannt (' + e.error + ')';
          window.showSelfRateButtons();
        }
      };

      sr.onend = () => {
        _activeSR = null;
        clearTG(); stopVisualizer(); // Immer cleanup — iOS hält Audio-Session sonst
        if (!window.answered) {
          if (_lastAlts.length > 0) {
            resetBtn();
            document.getElementById('self-rate-wrap')?.remove();
            window.evaluateWithClaude(_lastAlts.join('|'), targetWord);
          } else {
            resetBtn();
            result.style.display = 'block'; result.className = 'pronounce-result heard';
            result.textContent = '🤷 Nichts erkannt';
            window._webSpeechFailed = true;
            console.log('[Recording] Web Speech onend: kein Resultat → bei nächstem Versuch Vosk');
            window.showSelfRateButtons();
          }
        }
      };

      setTG();
      try { sr.start(); } catch(e) { console.error('[startRecording] sr.start error:', e); resetBtn(); stopVisualizer(); }
    } else {
      result.style.display = 'block'; result.className = 'pronounce-result';
      result.innerHTML = '⏳ Lade Offline-Spracherkennung…<br><small style="opacity:.8">(beim ersten Mal ~40 MB Download, danach offline)</small>';
      startVoskRecognition(window.currentQ.answer, result, btn);
    }
  });
}

export function startVoskRecognition(targetWord, resultEl, btn) {
  if (!targetWord) return;
  // Vosk noch nicht bereit (Hintergrund-Load läuft)? Freundlich warten und automatisch
  // starten, sobald bereit — statt die App zu blockieren oder einfach fehlzuschlagen.
  if (!window._voskModel) {
    if (window._voskStatus !== 'loading' && window._voskStatus !== 'ready') {
      try { window._voskLoad && window._voskLoad(); } catch(e) {}
    }
    if (resultEl) {
      resultEl.style.display = 'block'; resultEl.className = 'pronounce-result';
      resultEl.textContent = '⏳ Spracherkennung lädt – einen Moment, dann sprechen…';
    }
    if (btn) { btn.disabled = true; btn.className = 'mic-btn'; btn.textContent = '⏳ Bereite vor…'; }
    // Generischer Mic-Visualizer SOFORT (modell-unabhängig) → es fühlt sich flüssig an
    // wie früher, statt dass bis zum Vollladen nichts passiert. AudioContext synchron
    // in der User-Geste anlegen; Übergabe an die echte Vosk-Erkennung sobald bereit.
    _ensureAudioCtx();
    let _previewActive = true;
    ensureMicStream().then(stream => { if (_previewActive && stream) { try { startVisualizer(stream); } catch(e) {} } });
    const _stopPreview = () => { _previewActive = false; try { stopVisualizer(); } catch(e) {} };
    const _waitStart = Date.now();
    const _poll = setInterval(() => {
      // Abbrechen, wenn Frage beantwortet oder Spiel-Screen verlassen wurde
      if (window.answered || !document.body.classList.contains('in-game')) { clearInterval(_poll); _stopPreview(); return; }
      if (window._voskModel) {
        clearInterval(_poll);
        _stopPreview(); // Preview-Mic/Visualizer abbauen, bevor _beginVosk eigenen Mic öffnet
        if (btn) btn.disabled = false;
        _beginVosk(targetWord, resultEl, btn);
      } else if (window._voskStatus === 'failed' || Date.now() - _waitStart > 90000) {
        clearInterval(_poll);
        _stopPreview();
        if (btn) { btn.disabled = false; btn.className = 'mic-btn'; btn.textContent = '🎙️ Nochmal'; btn.onclick = window.startRecording; }
        if (resultEl) { resultEl.style.display = 'block'; resultEl.className = 'pronounce-result'; resultEl.textContent = '⚠️ Spracherkennung nicht verfügbar'; }
        try { window.showSelfRateButtons && window.showSelfRateButtons(); } catch(e) {}
      }
    }, 300);
    return;
  }
  _beginVosk(targetWord, resultEl, btn);
}

function _beginVosk(targetWord, resultEl, btn) {
  let _voskAlts = [];
  let _voskTimeout = null;
  window._activeVoskTimeout = null;
  function finishVosk() {
    if (window.answered) return;
    if (_voskTimeout) { clearTimeout(_voskTimeout); _voskTimeout = null; }
    window._activeVoskTimeout = null;
    voskStop();
    if (btn && !btn.disabled) {
      btn.className = 'mic-btn'; btn.textContent = '🎙️ Nochmal'; btn.onclick = window.startRecording;
    }
    if (_voskAlts.length > 0) {
      document.getElementById('self-rate-wrap')?.remove();
      window.evaluateWithClaude(_voskAlts.join('|'), targetWord);
    } else {
      resultEl.style.display = 'block'; resultEl.className = 'pronounce-result heard';
      resultEl.textContent = '🤷 Nichts erkannt';
      window.showSelfRateButtons();
    }
  }
  try { releaseMicStream(); } catch(e) {}
  try { stopVisualizer(); } catch(e) {}
  resultEl.style.display = 'block'; resultEl.className = 'pronounce-result';
  resultEl.textContent = '🎤 Sprich jetzt…';
  if (btn) {
    btn.className = 'mic-btn recording'; btn.textContent = '⏹️ Stopp';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.onclick = () => finishVosk();
  }
  voskStart((text, isFinal) => {
    if (!text || window.answered) return;
    const clean = text.toLowerCase().trim().replace(/[.,!?;:"]/g, '');
    if (!clean) return;
    if (_voskAlts.indexOf(clean) < 0) _voskAlts.push(clean);
    resultEl.style.display = 'block'; resultEl.className = 'pronounce-result heard';
    resultEl.textContent = '🗣️ Erkannt: "' + clean + '"';
    const tLow = targetWord.toLowerCase().replace(/^to /, '').trim();
    if (clean === tLow || clean.split(' ').includes(tLow)) {
      finishVosk();
    } else if (isFinal) {
      finishVosk();
    }
  }, (err) => {
    voskStop();
    if (btn && !btn.disabled) { btn.className = 'mic-btn'; btn.textContent = '🎙️ Nochmal'; btn.onclick = window.startRecording; }
    resultEl.style.display = 'block'; resultEl.className = 'pronounce-result';
    resultEl.textContent = '⚠️ Offline-Erkennung fehlgeschlagen';
    window.showSelfRateButtons();
  });
  _voskTimeout = setTimeout(() => finishVosk(), 6000);
  window._activeVoskTimeout = _voskTimeout;
}
