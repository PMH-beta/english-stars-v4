// src/modules/speech.js
// Text-to-Speech + Spracherkennung (Web Speech API + Vosk Offline).
// Shared state (_ttsVoices, _spokenForQuestion, _voskStatus, _voskModel, …)
// liegt auf window damit Legacy-Code in index.html direkt darauf zugreifen kann.

let _ttsReady = false;
let _ttsWarmupDone = false;
let _ttsWarmingUp = false;
let _afterWarmup = null;

// Wärmt die TTS-Engine auf — browser-gesperrt bis zur ersten User-Geste.
// Mehrfache Aufrufe während Warmup läuft: letzter Callback gewinnt.
function _ensureTTSWarm(callback) {
  if (_ttsWarmupDone) { callback(); return; }
  _afterWarmup = callback;
  if (_ttsWarmingUp) return;
  if (!window.speechSynthesis) { _ttsWarmupDone = true; callback(); return; }
  _ttsWarmingUp = true;
  try {
    const w = new SpeechSynthesisUtterance(' ');
    w.volume = 0; w.rate = 10;
    const done = () => {
      if (_ttsWarmupDone) return;
      _ttsWarmupDone = true; _ttsWarmingUp = false;
      const f = _afterWarmup; _afterWarmup = null; if (f) f();
    };
    w.onend = done; w.onerror = done;
    window.speechSynthesis.speak(w);
    setTimeout(done, 400); // Fallback: manche Browser feuern onend bei volume=0 nicht
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

function _speakImmediate(word, onDone) {
  if (!window._ttsVoices || window._ttsVoices.length === 0) {
    window._ttsVoices = window.speechSynthesis.getVoices();
  }
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = 'en-US'; utt.rate = 0.85; utt.pitch = 1.0;
  const preferred = window._ttsVoices.find(v => v.lang === 'en-US' && (v.name.includes('Google US') || v.name.includes('Samantha') || v.name.includes('Alex')))
    || window._ttsVoices.find(v => v.lang === 'en-US')
    || window._ttsVoices.find(v => v.lang.startsWith('en'));
  if (preferred) utt.voice = preferred;
  if (onDone) utt.onend = onDone;
  window.speechSynthesis.speak(utt);
}

export function speakWord(word, onDone) {
  if (!window.speechSynthesis || !word) return;
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
window._voskLoad = async function() {
  if (window._voskModel) return window._voskModel;
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
    const modelUrl = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
    const model = await Vosk.createModel(modelUrl);
    window._voskModel = model;
    window._voskStatus = 'ready';
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

// Nur grafischen Zustand bereinigen — mic-Stream bleibt intakt.
// (stopVisualizer ruft zusätzlich releaseMicStream auf.)
function _clearVisualizerState() {
  if (_vizAF) { cancelAnimationFrame(_vizAF); _vizAF = null; }
  if (_analyser) { try { _analyser.disconnect(); } catch(e) {} _analyser = null; }
  if (_vizSrc) { try { _vizSrc.disconnect(); } catch(e) {} _vizSrc = null; }
  if (_audioCtx) { try { _audioCtx.close(); } catch(e) {} _audioCtx = null; }
  if (_vizStream) {
    try { _vizStream.getTracks().forEach(t => t.stop()); } catch(e) {}
    _vizStream = null;
  }
  const canvas = document.getElementById('viz-canvas');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

export function startVisualizer(stream) {
  _clearVisualizerState(); // nur Grafik — _micStream bleibt am Leben
  if (!stream) return;
  const canvas = document.getElementById('viz-canvas');
  if (!canvas) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    function draw(t) {
      _vizAF = requestAnimationFrame(draw);
      if (t - _lastDraw < 33) return;
      _lastDraw = t;
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
    draw();
  } catch(e) {}
}

export function stopVisualizer() {
  console.log('[stopVisualizer] called — _vizSrc:', !!_vizSrc, 'ctx:', !!_audioCtx, 'SR:', !!_activeSR);
  _clearVisualizerState();
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

  if ((_shouldUseVosk() || window._webSpeechFailed) && (window._voskModel || window._voskStatus === 'ready')) {
    console.log('[Recording] Android/Rest → Vosk');
    result.style.display = 'block';
    result.className = 'pronounce-result';
    result.textContent = '🎤 Sprich jetzt…';
    startVoskRecognition(window.currentQ.answer, result, btn);
    return;
  }

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

  ensureMicStream().then(stream => {
    if (!stream && !_isIOS()) {
      result.style.display = 'block'; result.className = 'pronounce-result';
      result.textContent = '❌ Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.';
      return;
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
  let _voskAlts = [];
  let _voskTimeout = null;
  window._activeVoskTimeout = null;
  if (!targetWord) return;
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
