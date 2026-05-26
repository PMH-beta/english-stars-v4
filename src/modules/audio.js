// src/modules/audio.js
// Hintergrundmusik (MP3-Playlist, läuft endlos) + Volume-Popup
// Wiedergabe über Web Audio API (AudioBufferSourceNode) statt <audio>-Element —
// der Browser erzeugt für AudioContext-Output KEINE Lockscreen-/Media-Notification.
// Shared state liegt auf window damit Legacy-Code in index.html direkt darauf zugreifen kann.

window._musicTracks = [];
// window._musicAudio: Kompatibilitäts-Shim für speech.js (_scheduleIosMusicResume),
// wird in _initAudio() belegt.
window._musicAudio = null;
window._musicIdx = 0;
window._musicOn = false;
window._musicVolume = 0.50;
window._musicErrorRetries = 0;

let _pausedByVisibility = false;
let _musicCtx = null;      // AudioContext
let _musicGain = null;     // GainNode für Lautstärke
let _musicSource = null;   // laufender AudioBufferSourceNode
let _musicBuffer = null;   // dekodierter AudioBuffer des aktuellen Tracks
let _musicStartTime = 0;   // ctx.currentTime beim letzten start()
let _musicPauseOffset = 0; // Wiedergabe-Offset beim Pausieren
let _musicPlaying = false;

const MUSIC_BASE = 'music/';

export function _trackUrl(name) { return MUSIC_BASE + encodeURIComponent(name); }

export async function _discoverTracks() {
  if (window._musicTracks.length > 0) return window._musicTracks;

  function decodeHtmlEntities(s) {
    return s
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  // Versuch 1: GitHub API für github.io-Hosting
  try {
    const host = location.hostname;
    if (host.endsWith('.github.io')) {
      const user = host.split('.')[0];
      const pathParts = location.pathname.split('/').filter(Boolean);
      const repo = pathParts[0] || 'english-stars';
      const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/music`;
      const r = await fetch(apiUrl);
      if (r.ok) {
        const files = await r.json();
        const mp3s = files.filter(f => f.type === 'file' && /\.mp3$/i.test(f.name)).map(f => f.name);
        if (mp3s.length > 0) {
          window._musicTracks = mp3s;
          console.log('[Music] GitHub API: ' + mp3s.length + ' Tracks:', mp3s);
          return window._musicTracks;
        }
      }
    }
  } catch(e) { console.warn('[Music] GitHub-API:', e.message); }

  // Versuch 2: Directory-Listing (lokale Python-Server)
  try {
    const r = await fetch('./' + MUSIC_BASE, { method: 'GET', cache: 'no-store' });
    if (r.ok) {
      const txt = await r.text();
      const matches = [...txt.matchAll(/href="([^"]+\.mp3)"/gi)];
      const found = matches.map(m => {
        let n = m[1];
        try { n = decodeURIComponent(n); } catch(e) {}
        return decodeHtmlEntities(n);
      }).filter(n => n && !n.includes('/') && !n.startsWith('?'));
      if (found.length > 0) {
        window._musicTracks = Array.from(new Set(found));
        console.log('[Music] Listing: ' + window._musicTracks.length + ' Tracks:', window._musicTracks);
        return window._musicTracks;
      }
    }
  } catch(e) { console.warn('[Music] Listing:', e.message); }

  // Versuch 3: tracks.json (optional vom User gepflegt)
  try {
    const r = await fetch('./tracks.json', { cache: 'no-store' });
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list) && list.length > 0) {
        window._musicTracks = list;
        console.log('[Music] tracks.json: ' + list.length + ' Tracks:', list);
        return window._musicTracks;
      }
    }
  } catch(e) {}

  console.warn('[Music] Keine MP3-Dateien gefunden. Lege MP3s in das Repository und sie werden automatisch erkannt.');
  return window._musicTracks;
}

function _ensureMusicCtx() {
  if (_musicCtx && _musicCtx.state !== 'closed') {
    if (_musicCtx.state === 'suspended') _musicCtx.resume().catch(() => {});
    return _musicCtx;
  }
  _musicCtx = new (window.AudioContext || window.webkitAudioContext)();
  _musicGain = _musicCtx.createGain();
  _musicGain.gain.value = window._musicVolume;
  _musicGain.connect(_musicCtx.destination);
  _musicCtx.resume().catch(() => {});
  return _musicCtx;
}

function _stopCurrentSource() {
  if (_musicSource) {
    try { _musicSource.onended = null; _musicSource.stop(); } catch(e) {}
    try { _musicSource.disconnect(); } catch(e) {}
    _musicSource = null;
  }
  _musicPlaying = false;
}

function _playBuffer(buffer, offset) {
  if (!_musicCtx || _musicCtx.state === 'closed') return;
  if (_musicCtx.state === 'suspended') _musicCtx.resume().catch(() => {});
  _stopCurrentSource();
  const src = _musicCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(_musicGain);
  const startOffset = Math.max(0, offset || 0);
  src.onended = () => {
    if (src !== _musicSource) return;
    _musicSource = null;
    _musicPlaying = false;
    _musicPauseOffset = 0;
    window._musicErrorRetries = 0;
    _playNext();
  };
  src.start(0, startOffset);
  _musicSource = src;
  _musicStartTime = _musicCtx.currentTime - startOffset;
  _musicPlaying = true;
}

async function _loadAndPlay(url) {
  try {
    const ctx = _ensureMusicCtx();
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const arrayBuffer = await response.arrayBuffer();
    if (!window._musicOn) return;
    // Callback-Variante für maximale Browser-Kompatibilität (älteres iOS Safari)
    const audioBuffer = await new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
    if (!window._musicOn) return;
    _musicBuffer = audioBuffer;
    _playBuffer(audioBuffer, 0);
  } catch(e) {
    console.warn('[Music] Ladefehler:', e);
    if (!window._musicOn) return;
    window._musicErrorRetries++;
    if (window._musicErrorRetries >= Math.max(1, window._musicTracks.length)) {
      console.warn('[Music] Alle MP3-Dateien fehlerhaft.');
      return;
    }
    setTimeout(() => {
      if (!window._musicOn) return;
      window._musicIdx = (window._musicIdx + 1) % window._musicTracks.length;
      _loadAndPlay(_trackUrl(window._musicTracks[window._musicIdx]));
    }, 300);
  }
}

export function _playNext() {
  if (!window._musicOn || window._musicTracks.length === 0) return;
  window._musicIdx = (window._musicIdx + 1) % window._musicTracks.length;
  _loadAndPlay(_trackUrl(window._musicTracks[window._musicIdx]));
}

export function _initAudio() {
  try { const v = localStorage.getItem('es_music_vol'); if (v) window._musicVolume = parseFloat(v); } catch(e) {}
  // Shim für speech.js: _scheduleIosMusicResume() ruft window._musicAudio.play() auf
  // um nach Mikrofon-Freigabe die iOS-AudioSession zurück auf Playback zu schalten.
  if (!window._musicAudio) {
    window._musicAudio = {
      play: () => { resumeMusic(); return Promise.resolve(); },
      pause: () => {}
    };
  }
  return window._musicAudio;
}

// Setzt Wiedergabe fort (nach Mikrofon-Freigabe oder Visibility-Resume).
// Wird auch indirekt via window._musicAudio.play() aus speech.js aufgerufen.
export function resumeMusic() {
  if (!window._musicOn) return Promise.resolve();
  try {
    const ctx = _ensureMusicCtx();
    const doPlay = () => {
      if (!_musicPlaying) {
        if (_musicBuffer) _playBuffer(_musicBuffer, _musicPauseOffset);
        else if (window._musicTracks.length > 0) _loadAndPlay(_trackUrl(window._musicTracks[window._musicIdx]));
      }
    };
    if (ctx.state === 'suspended') return ctx.resume().then(doPlay).catch(() => {});
    doPlay();
    return Promise.resolve();
  } catch(e) {
    return Promise.resolve();
  }
}

export async function startMusic() {
  if (window._musicTracks.length === 0) {
    await _discoverTracks();
  }
  if (window._musicTracks.length === 0) {
    console.warn('[Music] Keine MP3-Dateien gefunden');
    return false;
  }
  window._musicOn = true;
  window._musicErrorRetries = 0;
  _initAudio();
  _ensureMusicCtx(); // synchron während User-Gesture — iOS AudioContext Unlock
  _loadAndPlay(_trackUrl(window._musicTracks[window._musicIdx]));
  return true;
}

export function startMusicSync() {
  window._musicOn = true;
  window._musicErrorRetries = 0;
  _initAudio();
  _ensureMusicCtx(); // synchron während User-Gesture — iOS AudioContext Unlock
  if (window._musicTracks.length > 0) {
    _loadAndPlay(_trackUrl(window._musicTracks[window._musicIdx % window._musicTracks.length]));
  } else {
    _discoverTracks().then(() => {
      if (!window._musicOn) return;
      if (window._musicTracks.length === 0) {
        console.warn('[Music] Keine Tracks gefunden');
        window._musicOn = false; _setMusicBtns(false);
        return;
      }
      _loadAndPlay(_trackUrl(window._musicTracks[0]));
    }).catch(e => console.warn('[Music] discover failed:', e));
  }
}

export function stopMusic() {
  _pausedByVisibility = false;
  window._musicOn = false;
  _musicPauseOffset = 0;
  _stopCurrentSource();
}

export function setMusicVolume(v) {
  window._musicVolume = Math.max(0, Math.min(1, parseFloat(v)));
  if (_musicGain) _musicGain.gain.value = window._musicVolume;
  try { localStorage.setItem('es_music_vol', String(window._musicVolume)); } catch(e) {}
  const lbl = document.getElementById('music-vol-lbl');
  if (lbl) lbl.textContent = Math.round(window._musicVolume * 100) + '%';
}

export function _setMusicBtns(on) {
  [document.getElementById('music-btn'), document.getElementById('music-btn-global')].forEach(btn => {
    if (!btn) return;
    if (on) { btn.classList.add('on'); btn.textContent = '🎶'; btn.title = 'Musik ausschalten'; }
    else    { btn.classList.remove('on'); btn.textContent = '🎵'; btn.title = 'Musik einschalten'; }
  });
}

export function toggleMusic() {
  if (window._musicOn) {
    stopMusic(); _setMusicBtns(false);
    try { localStorage.setItem('es_music', '0'); } catch(e) {}
  } else {
    startMusicSync();
    _setMusicBtns(true);
    try { localStorage.setItem('es_music', '1'); } catch(e) {}
  }
}

let _volPopupTimer = null;
export function toggleVolPopup() {
  const w = document.getElementById('music-vol-wrap');
  const b = document.getElementById('music-vol-btn');
  if (!w) return;
  const isOpen = w.classList.toggle('open');
  if (b) b.classList.toggle('active', isOpen);
  if (_volPopupTimer) { clearTimeout(_volPopupTimer); _volPopupTimer = null; }
  if (isOpen) {
    _volPopupTimer = setTimeout(() => {
      w.classList.remove('open');
      if (b) b.classList.remove('active');
    }, 4000);
    const sl = document.getElementById('music-vol-slider');
    if (sl) {
      sl.oninput = function() {
        setMusicVolume(this.value / 100);
        if (_volPopupTimer) clearTimeout(_volPopupTimer);
        _volPopupTimer = setTimeout(() => {
          w.classList.remove('open');
          if (b) b.classList.remove('active');
        }, 4000);
      };
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (window._musicOn && _musicPlaying && _musicCtx) {
      _musicPauseOffset = Math.max(0, _musicCtx.currentTime - _musicStartTime);
      if (_musicBuffer) _musicPauseOffset = Math.min(_musicPauseOffset, _musicBuffer.duration - 0.01);
      _stopCurrentSource();
      _pausedByVisibility = true;
    }
  } else {
    if (_pausedByVisibility && window._musicOn) {
      _pausedByVisibility = false;
      if (_musicCtx && _musicCtx.state === 'suspended') {
        _musicCtx.resume().then(() => {
          if (window._musicOn && !_musicPlaying) {
            if (_musicBuffer) _playBuffer(_musicBuffer, _musicPauseOffset);
            else if (window._musicTracks.length > 0) _loadAndPlay(_trackUrl(window._musicTracks[window._musicIdx]));
          }
        }).catch(() => {});
      } else if (window._musicOn && !_musicPlaying) {
        if (_musicBuffer) _playBuffer(_musicBuffer, _musicPauseOffset);
        else if (window._musicTracks.length > 0) _loadAndPlay(_trackUrl(window._musicTracks[window._musicIdx]));
      }
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const isMobile = matchMedia('(pointer:coarse)').matches || innerWidth < 600;
  try {
    if (isMobile) {
      window._musicVolume = 0.30;
    } else {
      const v = localStorage.getItem('es_music_vol');
      if (v) window._musicVolume = parseFloat(v);
    }
    const sl = document.getElementById('music-vol-slider');
    const lbl = document.getElementById('music-vol-lbl');
    if (sl) sl.value = Math.round(window._musicVolume * 100);
    if (lbl) lbl.textContent = Math.round(window._musicVolume * 100) + '%';
  } catch(e) {}
  let pref = '1';
  try { const v = localStorage.getItem('es_music'); if (v !== null) pref = v; } catch(e) {}
  if (pref !== '1') { _setMusicBtns(false); return; }
  _setMusicBtns(true);
  _discoverTracks().catch(() => {});
});
