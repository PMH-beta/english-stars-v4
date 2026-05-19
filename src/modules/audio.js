// src/modules/audio.js
// Hintergrundmusik (MP3-Playlist, läuft endlos) + Volume-Popup
// Shared state liegt auf window damit Legacy-Code in index.html direkt darauf zugreifen kann.

window._musicTracks = [];
window._musicAudio = null;
window._musicIdx = 0;
window._musicOn = false;
window._musicVolume = 0.50;
window._musicErrorRetries = 0;

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
      const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/public/music`;
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

export function _playNext() {
  if (!window._musicOn || window._musicTracks.length === 0) return;
  window._musicIdx = (window._musicIdx + 1) % window._musicTracks.length;
  window._musicAudio.src = _trackUrl(window._musicTracks[window._musicIdx]);
  window._musicAudio.play().catch(() => {});
}

export function _initAudio() {
  if (window._musicAudio) return window._musicAudio;
  try { const v = localStorage.getItem('es_music_vol'); if (v) window._musicVolume = parseFloat(v); } catch(e) {}
  window._musicAudio = new Audio();
  window._musicAudio.crossOrigin = 'anonymous';
  window._musicAudio.preload = 'auto';
  window._musicAudio.setAttribute('playsinline', '');
  window._musicAudio.volume = window._musicVolume;
  window._musicAudio.addEventListener('ended', () => {
    window._musicErrorRetries = 0;
    _playNext();
  });
  window._musicAudio.addEventListener('error', () => {
    if (!window._musicOn) return;
    window._musicErrorRetries++;
    if (window._musicErrorRetries >= window._musicTracks.length) {
      console.warn('Alle MP3-Dateien fehlerhaft.');
      return;
    }
    setTimeout(() => _playNext(), 300);
  });
  window._musicAudio.addEventListener('playing', () => { window._musicErrorRetries = 0; });
  return window._musicAudio;
}

export async function startMusic() {
  if (window._musicTracks.length === 0) {
    await _discoverTracks();
  }
  if (window._musicTracks.length === 0) {
    console.warn('Keine MP3-Dateien gefunden');
    return false;
  }
  window._musicOn = true;
  window._musicErrorRetries = 0;
  const a = _initAudio();
  if (!a.src) a.src = _trackUrl(window._musicTracks[window._musicIdx]);
  try {
    const p = a.play();
    if (p) p.catch(() => { window._musicOn = false; });
  } catch(e) { window._musicOn = false; }
  return true;
}

export function startMusicSync() {
  window._musicOn = true;
  window._musicErrorRetries = 0;
  const a = _initAudio();
  if (window._musicTracks.length > 0) {
    if (!a.src || a.error) {
      a.src = _trackUrl(window._musicTracks[window._musicIdx % window._musicTracks.length]);
    }
    try {
      const p = a.play();
      if (p) p.catch(err => { console.warn('[Music] play failed:', err); });
    } catch(e) { console.warn('[Music] play exception:', e); }
  } else {
    _discoverTracks().then(() => {
      if (!window._musicOn) return;
      if (window._musicTracks.length === 0) {
        console.warn('[Music] Keine Tracks gefunden');
        window._musicOn = false; _setMusicBtns(false);
        return;
      }
      a.src = _trackUrl(window._musicTracks[0]);
      const p = a.play();
      if (p) p.catch(err => console.warn('[Music] late play failed:', err));
    }).catch(e => console.warn('[Music] discover failed:', e));
  }
}

export function stopMusic() {
  window._musicOn = false;
  if (window._musicAudio) window._musicAudio.pause();
}

export function setMusicVolume(v) {
  window._musicVolume = Math.max(0, Math.min(1, parseFloat(v)));
  if (window._musicAudio) window._musicAudio.volume = window._musicVolume;
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
