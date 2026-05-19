// src/modules/startup.js
import { _initTTS } from './speech.js';
import { _sfx } from './game.js';
import { _discoverTracks, _initAudio, _trackUrl, startMusicSync, _setMusicBtns } from './audio.js';
import { showScreen, showMenu, handleLogin, handleLogout } from './ui.js';
import { supabase } from './supabase.js';
import { onAuthChange } from './auth.js';

// Guard: onAuthChange-Listener ignoriert Feuern während des Startvorgangs
let _startupComplete = false;

export async function startupSequence() {
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
      if (k && !KEEP_KEYS.includes(k)) toRemove.push(k);
    }
    toRemove.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
  } catch(e) {}

  // Auth-Session aus Cache laden (funktioniert auch offline wenn vorher eingeloggt)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    window.currentUser = session?.user ?? null;
    console.log('[startup] Auth:', window.currentUser ? 'eingeloggt als ' + window.currentUser.email : 'nicht eingeloggt');
  } catch(e) {
    window.currentUser = null;
    console.warn('[startup] getSession fehlgeschlagen:', e.message);
  }

  // Runtime-Listener: Session-Ablauf, Logout aus anderem Tab, Email-Bestätigung
  onAuthChange(user => {
    if (!_startupComplete) return; // Startup-Fire ignorieren
    const prev = window.currentUser;
    window.currentUser = user;
    if (prev && !user) handleLogout();           // Session abgelaufen oder Logout in anderem Tab
    if (!prev && user) handleLogin(user);         // Email-Bestätigung redirect in anderem Tab
  });

  const alreadyLoaded = (() => { try { return localStorage.getItem('es_vosk_loaded') === '1'; } catch(e) { return false; } })();
  const bar = document.getElementById('loading-bar');
  const status = document.getElementById('loading-status');
  const hint = document.getElementById('loading-hint');
  function setProgress(pct, msg) {
    if (bar) bar.style.width = pct + '%';
    if (status) status.textContent = msg;
  }
  showScreen('loading-screen');

  setProgress(8, 'Vokabeln werden geladen…');
  await new Promise(r => setTimeout(r, 200));

  setProgress(20, 'Sprachausgabe wird vorbereitet…');
  try { _initTTS(); } catch(e) {}
  let ttsTries = 0;
  while (window._ttsVoices.length === 0 && ttsTries < 10) {
    await new Promise(r => setTimeout(r, 200));
    try { window._ttsVoices = window.speechSynthesis.getVoices(); } catch(e) {}
    ttsTries++;
  }

  setProgress(30, 'Sound-Effekte werden vorbereitet…');
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
    setProgress(60, 'Lade Offline-Spracherkennung (~40 MB)…');
    if (hint) hint.textContent = 'Nur beim ersten Start nötig. Bitte WLAN nutzen wenn möglich. Das kann 1–3 Minuten dauern.';
    try {
      if (window._voskLoad) await window._voskLoad();
      if (window._voskStatus === 'ready') {
        try { localStorage.setItem('es_vosk_loaded', '1'); } catch(e) {}
      }
    } catch(e) { console.warn('Vosk Load fehler beim Start:', e); }
  } else {
    setProgress(75, 'Initialisiere Spracherkennung…');
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

  const startBtn = document.getElementById('loading-start-btn');
  const hintEl = document.getElementById('loading-hint');
  if (hintEl) hintEl.textContent = 'Alles bereit! Tippe auf Loslegen';
  if (startBtn) startBtn.style.display = 'inline-block';
}

export async function finishStartup() {
  try {
    await new Promise(r => {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.onend = r; u.onerror = r;
      speechSynthesis.speak(u);
      setTimeout(r, 800);
    });
  } catch(e) {}
  try {
    let musicPref = '1';
    try { const v = localStorage.getItem('es_music'); if (v !== null) musicPref = v; } catch(e) {}
    if (musicPref === '1' && !window._musicOn) {
      startMusicSync();
      _setMusicBtns(true);
    }
  } catch(e) { console.warn('Music start failed:', e); }

  _startupComplete = true;

  if (!window.currentUser) {
    showScreen('auth-screen');
    return;
  }
  if (!window.SD.playerName) showScreen('name-screen');
  else showMenu();
}

window.addEventListener('load', () => startupSequence());
