// src/modules/startup.js
import { _initTTS, warmTTS } from './speech.js';
import { _sfx, primeSfx } from './game.js';
import { _discoverTracks, _initAudio, _trackUrl, startMusicSync, _setMusicBtns } from './audio.js';
import { showScreen, showMenu, handleLogin, handleLogout, showNewPasswordScreen } from './ui.js';
import { supabase, cachedSessionUser } from './supabase.js';
import { onAuthChange } from './auth.js';

// Guard: onAuthChange-Listener ignoriert Feuern während des Startvorgangs
let _startupComplete = false;
// Gesetzt wenn URL-Hash type=recovery enthält ODER Supabase PASSWORD_RECOVERY event feuert
let _pendingRecovery = (window.location.hash || '').includes('type=recovery');

export async function startupSequence() {
  console.log('[Startup] Boot-Start:', performance.now().toFixed(0) + 'ms');

  // Hinweis: Früher wurde hier bei JEDEM Boot der komplette Cache + localStorage
  // gelöscht ("immer neueste App-Version"). Das untergrub den Service Worker und
  // machte jeden Kaltstart teuer (Vosk-Re-Download, Verlust von pending_sync).
  // Cache-Invalidierung übernimmt jetzt der Service Worker: network-first für
  // App-Code (frische Updates online), cache-first für Modell/Statik (persistent).

  // Auth-Session aus Cache laden (funktioniert auch offline wenn vorher eingeloggt).
  // Gedeckelt: bei abgelaufenem Token versucht getSession() einen Token-Refresh übers
  // Netz. Über ein totes oder zähes Netz (Hotel-WLAN, kein Empfang) kann das hängen —
  // und der Boot steht hier ganz am Anfang still. Nach dem Timeout lesen wir die
  // gespeicherte Session direkt aus dem localStorage, damit ein offline gestartetes
  // Kind NICHT auf dem Login-Screen landet, obwohl es angemeldet ist.
  if (navigator.onLine === false) {
    // Offline gar nicht erst fragen — das kostet 0 ms statt in den Timeout unten zu
    // laufen. Gemessen hat genau das den Offline-Start um 5 s verzögert.
    window.currentUser = cachedSessionUser();
    console.log('[Startup] Offline — Session aus dem lokalen Speicher:', !!window.currentUser);
  } else {
    try {
      // Timeout für den fiesen Zwischenfall: Verbindung "da", aber tot (Hotel-WLAN,
      // ein Balken, Captive Portal) — da meldet navigator.onLine weiterhin true.
      const TIMEOUT = Symbol('timeout');
      const res = await Promise.race([
        supabase.auth.getSession().then(r => r?.data?.session ?? null),
        // 2,5 s wie der Netz-Deckel im Service Worker. Greift der Timeout, gilt die
        // lokal gespeicherte Session — das Kind bleibt angemeldet und kommt ins Menü;
        // den echten Cloud-Stand holt handleLogin() danach mit eigenem Retry nach.
        new Promise(r => setTimeout(() => r(TIMEOUT), 2500)),
      ]);
      if (res === TIMEOUT) {
        window.currentUser = cachedSessionUser();
        console.warn('[Startup] getSession Timeout — Session aus dem lokalen Speicher:', !!window.currentUser);
      } else {
        window.currentUser = res?.user ?? null;
      }
    } catch(e) {
      window.currentUser = cachedSessionUser();
      console.warn('[startup] getSession fehlgeschlagen:', e && e.message);
    }
  }
  console.log('[Startup] Auth-Resolved:', performance.now().toFixed(0) + 'ms —', window.currentUser ? 'eingeloggt als ' + window.currentUser.email : 'nicht eingeloggt');

  // Runtime-Listener: Session-Ablauf, Logout aus anderem Tab, Email-Bestätigung, Passwort-Reset
  onAuthChange((event, user) => {
    if (event === 'PASSWORD_RECOVERY') {
      _pendingRecovery = true;
      window.currentUser = user;
      if (_startupComplete) showNewPasswordScreen();
      return;
    }
    if (!_startupComplete) return; // Startup-Fire ignorieren
    const prev = window.currentUser;
    window.currentUser = user;
    if (prev && !user) handleLogout();           // Session abgelaufen oder Logout in anderem Tab
    if (!prev && user) handleLogin(user);         // Email-Bestätigung redirect in anderem Tab
  });

  const ring = document.getElementById('progress-ring');
  const pctEl = document.getElementById('loading-pct');
  const status = document.getElementById('loading-status');
  const hint = document.getElementById('loading-hint');
  const _circ = 2 * Math.PI * 54;
  function setProgress(pct, msg) {
    if (ring) ring.style.strokeDashoffset = _circ * (1 - pct / 100);
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
    if (status) status.textContent = msg;
  }

  const overlay = document.getElementById('init-overlay');
  if (overlay) overlay.style.display = 'none';
  console.log('[Startup] Loading-Screen:', performance.now().toFixed(0) + 'ms');
  showScreen('loading-screen');

  setProgress(8, 'Vokabeln werden geladen…');

  setProgress(20, 'Stimmen werden geladen…');
  try { _initTTS(); } catch(e) {}
  // Kein Polling mehr auf getVoices(). Auf Android ist die Liste anfangs leer und
  // füllte hier bis zu 2 s lang gar nichts — der Start wartete also jedes Mal
  // umsonst. speech.js:_withVoices() wartet ohnehin startup-unabhängig auf
  // 'voiceschanged', BEVOR gesprochen wird, inklusive eigenem Poll-Fallback.

  setProgress(30, 'Sounds werden geladen…');
  try { _sfx(); } catch(e) {}

  setProgress(45, 'Musik wird vorbereitet…');
  // Musik NICHT mehr abwarten: _discoverTracks() fragt (auf github.io) api.github.com
  // an und danach wurde bis zu 3 s auf 'canplay' gewartet — beides am Ladebildschirm,
  // bei jedem Start. Die Trackliste wird im Hintergrund geholt; startMusicSync() im
  // Start-Button holt sie ohnehin selbst nach, falls sie noch nicht da ist.
  _discoverTracks().then(() => {
    if (window._musicTracks.length > 0) {
      const a = _initAudio();
      if (!a.src) { a.src = _trackUrl(window._musicTracks[0]); a.preload = 'auto'; }
    }
  }).catch(e => console.warn('[Startup] Musik:', e));

  // Vosk ENTKOPPELT im Hintergrund laden — blockiert NICHT den Bereit-Zustand.
  // Das Modell (~40 MB) braucht beim ersten Mal lange; die App ist trotzdem sofort
  // bedienbar. Ist Vosk bei der ersten Aussprache-Übung noch nicht fertig, wartet
  // startVoskRecognition dort freundlich mit sichtbarem Status (siehe speech.js).
  try { if (window._voskLoad) window._voskLoad(); } catch(e) {}

  setProgress(80, 'Mikrofon wird vorbereitet…');
  try {
    if (navigator.mediaDevices && navigator.permissions) {
      await navigator.permissions.query({ name: 'microphone' }).catch(() => {});
    }
  } catch(e) {}

  setProgress(100, 'Bereit!');
  if (hint) hint.textContent = '';
  // Voices-Check ohne Warten — _withVoices() in speech.js sichert das vor jedem
  // Sprechen ohnehin ab.
  if (window.speechSynthesis && (!window._ttsVoices || window._ttsVoices.length === 0)) {
    window._ttsVoices = window.speechSynthesis.getVoices();
  }

  // Button bei JEDEM Kaltstart zeigen — iOS braucht User-Geste um Audio freizugeben.
  // Gilt für eingeloggte und nicht eingeloggte Nutzer gleichermaßen.
  const startBtn = document.getElementById('loading-start-btn');
  if (startBtn) {
    startBtn.style.display = '';
    startBtn.onclick = async () => {
      startBtn.disabled = true;
      // iOS: Audio-Session EINMAL auf 'play-and-record' (Web Audio Session API, Safari
      // 16.4+). Erlaubt Aufnahme dauerhaft (Vosk bleibt funktionsfähig) UND spielt Ton
      // über den Stumm-Schalter → Sounds/TTS auch lautlos in JEDEM Modus, OHNE Mic-Prompt
      // am Start (der kommt erst im Aussprache-Modus via warmIosMic in _launchGame).
      // NIE auf 'playback' umschalten — das verbot vorher das Mic → Erkennung tot. iOS-only.
      try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch(e) {}
      // SFX sofort in der Geste entsperren (sonst Sounds erst nach 1-2 Runden).
      try { primeSfx(); } catch(e) {}
      try {
        let musicPref = '1';
        try { const v = localStorage.getItem('es_music'); if (v !== null) musicPref = v; } catch(e) {}
        if (musicPref === '1' && !window._musicOn) { startMusicSync(); _setMusicBtns(true); }
      } catch(e) { console.warn('[startup] Music unlock failed:', e); }
      // Echtes TTS-Warmup HIER abwarten → die ~2 s Engine-/Stimm-Ladezeit liegen
      // hinter dem Ladebildschirm, nicht beim ersten gesprochenen Wort im Spiel.
      if (status) status.textContent = 'Sprachausgabe wird vorbereitet…';
      try { await warmTTS(); } catch(e) {}
      finishStartup();
    };
  } else {
    await new Promise(r => setTimeout(r, 600));
    finishStartup();
  }
}

export async function finishStartup() {
  _startupComplete = true;
  console.log('[Startup] App-Ready:', performance.now().toFixed(0) + 'ms');

  if (_pendingRecovery) {
    showNewPasswordScreen();
    return;
  }
  if (!window.currentUser) {
    showScreen('auth-screen');
    return;
  }
  await handleLogin(window.currentUser);
}

window.addEventListener('load', () => startupSequence());
