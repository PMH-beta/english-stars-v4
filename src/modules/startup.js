// src/modules/startup.js
import { _initTTS, primeTTS } from './speech.js';
import { _sfx } from './game.js';
import { _discoverTracks, _initAudio, _trackUrl, startMusicSync, _setMusicBtns } from './audio.js';
import { showScreen, showMenu, handleLogin, handleLogout, showNewPasswordScreen } from './ui.js';
import { supabase } from './supabase.js';
import { onAuthChange } from './auth.js';

// Guard: onAuthChange-Listener ignoriert Feuern während des Startvorgangs
let _startupComplete = false;
// Gesetzt wenn URL-Hash type=recovery enthält ODER Supabase PASSWORD_RECOVERY event feuert
let _pendingRecovery = (window.location.hash || '').includes('type=recovery');

export async function startupSequence() {
  console.log('[Startup] Boot-Start:', performance.now().toFixed(0) + 'ms');

  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch(e) { console.warn('[Cache] Löschen fehlgeschlagen:', e); }

  const KEEP_KEYS = ['english_stars_v3', 'english_stars_v2', 'es_apikey', 'es_vosk_loaded'];
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // sb-* Keys: Supabase Auth-Token — niemals löschen
      if (k && !KEEP_KEYS.includes(k) && !k.startsWith('sb-')) toRemove.push(k);
    }
    toRemove.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
  } catch(e) {}

  // Auth-Session aus Cache laden (funktioniert auch offline wenn vorher eingeloggt)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    window.currentUser = session?.user ?? null;
    console.log('[Startup] Auth-Resolved:', performance.now().toFixed(0) + 'ms —', window.currentUser ? 'eingeloggt als ' + window.currentUser.email : 'nicht eingeloggt');
  } catch(e) {
    window.currentUser = null;
    console.warn('[startup] getSession fehlgeschlagen:', e.message);
  }

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

  const alreadyLoaded = (() => { try { return localStorage.getItem('es_vosk_loaded') === '1'; } catch(e) { return false; } })();
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
  await new Promise(r => setTimeout(r, 200));

  setProgress(20, 'Stimmen werden geladen…');
  try { _initTTS(); } catch(e) {}
  let ttsTries = 0;
  while (window._ttsVoices.length === 0 && ttsTries < 10) {
    await new Promise(r => setTimeout(r, 200));
    try { window._ttsVoices = window.speechSynthesis.getVoices(); } catch(e) {}
    ttsTries++;
  }

  setProgress(30, 'Sounds werden geladen…');
  try { _sfx(); } catch(e) {}
  await new Promise(r => setTimeout(r, 150));

  setProgress(45, 'Musik wird geladen…');
  try {
    await _discoverTracks();
    if (window._musicTracks.length > 0) {
      const a = _initAudio();
      a.src = _trackUrl(window._musicTracks[0]);
      a.preload = 'auto';
      await new Promise(resolve => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        a.addEventListener('loadedmetadata', finish, { once: true });
        a.addEventListener('canplay', finish, { once: true });
        setTimeout(finish, 3000);
      });
      console.log('[Startup] Musik bereit:', window._musicTracks[0]);
    }
  } catch(e) { console.warn('[Startup] Musik:', e); }

  if (!alreadyLoaded) {
    setProgress(60, 'Spracherkennung wird geladen…');
    if (hint) hint.textContent = 'Nur beim ersten Start — kann 1–3 Min. dauern.';
    try {
      if (window._voskLoad) await window._voskLoad();
      if (window._voskStatus === 'ready') {
        try { localStorage.setItem('es_vosk_loaded', '1'); } catch(e) {}
      }
    } catch(e) { console.warn('Vosk Load fehler beim Start:', e); }
  } else {
    setProgress(75, 'Spracherkennung wird gestartet…');
    if (window._voskLoad) {
      try { await window._voskLoad(); } catch(e) {}
    }
  }

  setProgress(88, 'Mikrofon wird vorbereitet…');
  try {
    if (navigator.mediaDevices && navigator.permissions) {
      await navigator.permissions.query({ name: 'microphone' }).catch(() => {});
    }
  } catch(e) {}
  await new Promise(r => setTimeout(r, 150));

  setProgress(96, 'Fast fertig…');
  await new Promise(r => setTimeout(r, 200));
  setProgress(100, 'Bereit!');
  if (hint) hint.textContent = '';
  // Voices finaler Check — wurden bereits bei Schritt 20% gepollt
  if (window.speechSynthesis && (!window._ttsVoices || window._ttsVoices.length === 0)) {
    window._ttsVoices = window.speechSynthesis.getVoices();
  }

  if (!window.currentUser) {
    // Kein Login — Button zeigen; Klick ist die Browser-Geste für Audio-Unlock
    const startBtn = document.getElementById('loading-start-btn');
    if (startBtn) {
      startBtn.style.display = '';
      startBtn.onclick = () => {
        startBtn.disabled = true;
        try { primeTTS(); } catch(e) {}
        try {
          let musicPref = '1';
          try { const v = localStorage.getItem('es_music'); if (v !== null) musicPref = v; } catch(e) {}
          if (musicPref === '1' && !window._musicOn) { startMusicSync(); _setMusicBtns(true); }
        } catch(e) { console.warn('[startup] Music unlock failed:', e); }
        finishStartup();
      };
    } else {
      await new Promise(r => setTimeout(r, 600));
      finishStartup();
    }
  } else {
    // Session vorhanden (Return-User oder OAuth-Redirect) — kein Button, direkt weiter
    // Audio-Unlock per erstem Tap in der App (Autoplay-Policy)
    document.addEventListener('pointerdown', function _audioUnlock() {
      try { primeTTS(); } catch(e) {}
      try {
        let musicPref = '1';
        try { const v = localStorage.getItem('es_music'); if (v !== null) musicPref = v; } catch(e) {}
        if (musicPref === '1' && !window._musicOn) { startMusicSync(); _setMusicBtns(true); }
      } catch(e) {}
    }, { capture: true, once: true });
    await new Promise(r => setTimeout(r, 400));
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
