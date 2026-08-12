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

  // ── Geste ZUERST, Ladevorgang danach ──
  // Vorher lief die halbe Startsequenz vor dem Button und der TEURE Rest (Auth,
  // Cloud-Load, Aufbau aller Elemente) danach — hinter einem Screen, der 100 %
  // anzeigte und sich nicht mehr rührte. Das war die gefühlte Hängezeit.
  // Jetzt: Button sofort, und alles Weitere läuft nach dem Tippen mit einem Ring,
  // der echte Schritte zeigt. Nebeneffekt: Audio-Freigabe, audioSession und
  // TTS-Warmup liegen damit garantiert INNERHALB einer echten Nutzergeste — auf
  // iOS zuverlässiger als vorher, wo das Warmup teils außerhalb landete.
  const startBtn = document.getElementById('loading-start-btn');

  // Passwort-Reset über Mail-Link: kein Ton nötig, hier wäre ein Button nur im Weg.
  if (_pendingRecovery || !startBtn) { await bootWork(setProgress, hint); return; }

  setProgress(0, 'Bereit, wenn du es bist!');
  if (hint) hint.textContent = '';
  startBtn.style.display = '';
  startBtn.disabled = false;
  startBtn.onclick = async () => {
    startBtn.disabled = true;
    startBtn.style.display = 'none';
    // ── alles hier ist synchron in der Geste ──
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
    // TTS-Warmup in der Geste anstoßen, aber nicht abwarten: es kostet bis zu 3,5 s
    // (bis 1,5 s Stimmen-Poll + bis 2 s Warmup) und liefe sonst VOR dem Cloud-Load,
    // statt parallel dazu. Bis im Spiel das erste Wort fällt, ist es längst fertig —
    // speakWord geht ohnehin über _withVoices, das notfalls selbst wartet.
    try { _initTTS(); } catch(e) {}
    try { warmTTS().catch(() => {}); } catch(e) {}
    await bootWork(setProgress, hint);
  };
}

// Die eigentliche Ladearbeit — läuft erst nach dem Tippen und meldet echte Schritte.
async function bootWork(setProgress, hint) {
  setProgress(12, 'Sounds werden geladen…');
  try { _sfx(); } catch(e) {}

  setProgress(25, 'Musik wird vorbereitet…');
  // Nicht abwarten: _discoverTracks() fragt (auf github.io) api.github.com an.
  _discoverTracks().then(() => {
    if (window._musicTracks.length > 0) {
      const a = _initAudio();
      // preload 'metadata' statt 'auto': 'auto' zieht den KOMPLETTEN Track — beim
      // ersten sind das 10,9 MB und damit der größte Einzelposten des Kaltstarts.
      // Beim Abspielen streamt er ohnehin ab dem ersten Puffer.
      if (!a.src) { a.src = _trackUrl(window._musicTracks[0]); a.preload = 'metadata'; }
    }
  }).catch(e => console.warn('[Startup] Musik:', e));

  setProgress(38, 'Mikrofon wird vorbereitet…');
  try {
    if (navigator.mediaDevices && navigator.permissions) {
      await navigator.permissions.query({ name: 'microphone' }).catch(() => {});
    }
  } catch(e) {}

  setProgress(55, 'Anmeldung wird geprüft…');
  await resolveSession();

  setProgress(75, 'Dein Fortschritt wird geladen…');
  if (hint) hint.textContent = '';
  await finishStartup();
  setProgress(100, 'Bereit!');
}

// Auth-Session aus Cache laden (funktioniert auch offline wenn vorher eingeloggt).
// Gedeckelt: bei abgelaufenem Token versucht getSession() einen Token-Refresh übers
// Netz. Über ein totes oder zähes Netz (Hotel-WLAN, kein Empfang) kann das hängen —
// und der Boot stünde still. Nach dem Timeout lesen wir die gespeicherte Session
// direkt aus dem localStorage, damit ein offline gestartetes Kind NICHT auf dem
// Login-Screen landet, obwohl es angemeldet ist.
async function resolveSession() {
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
}

export async function finishStartup() {
  _startupComplete = true;
  console.log('[Startup] App-Ready:', performance.now().toFixed(0) + 'ms');

  // Vosk wird NICHT hier angestoßen — finishStartup läuft direkt beim Tippen des
  // "Los geht's"-Buttons, also genau dann, wenn der Cloud-Load und der Aufbau aller
  // Elemente laufen. Der Anstoß sitzt am Ende von _finishLoginUI (ui.js), wenn die
  // Oberfläche steht.

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
