// src/modules/audio.js
// Musik je Ort und Lautstärke (SW-5, Wunsch des Nutzers 24.11.2026).
// - Menü und alle Screens außerhalb des Kampfs: ruhige Menümusik.
// - Kampf: ein eigenes Stück je Arena, der Boss ein eigenes. Beim Wechsel blendet
//   die Musik kurz aus und wieder ein (je 250 ms).
// - Drei Regler im Profil (Bereich „Ton“), je Gerät in localStorage:
//   es_ton_gesamt (regelt auch Effekte und Schläge), es_ton_menue, es_ton_kampf.
//   0 heißt aus. Die alten Musik-Knöpfe im Hauptmenü gibt es nicht mehr.
// - Ein Stück wird einmal GANZ geladen (fetch → Blob → Objekt-URL): kein 206 mehr,
//   der Service Worker legt die Datei vollständig ab, offline läuft sie weiter.
// - Lautstärke über Web Audio (GainNode am AudioContext der Effekte): iOS ignoriert
//   audio.volume. Ohne Web Audio regelt audio.volume.
// Herkunft und Lizenzen: music/LIZENZEN.txt.

import { _sfx } from './game.js';

const MUSIC_BASE = 'music/';
// Neues Stück = neue Nummer im Dateinamen: der Musik-Cache des Service Workers
// (STATIC_CACHE) überlebt Deploys und gäbe sonst die alte Datei weiter heraus.
const MUSIK = {
  menue: 'menue-1.mp3',
  wiese: 'wiese-1.mp3', abend: 'abend-1.mp3', kerker: 'kerker-1.mp3',
  kristall: 'kristall-1.mp3', vulkan: 'vulkan-1.mp3', friedhof: 'friedhof-1.mp3',
  boss: 'boss-1.mp3',
};
// Schlag-Töne im Kampf (spielt game.js über Web Audio ab).
export const SCHLAEGE = { schlag: MUSIC_BASE + 'schlag-1.mp3', treffer: MUSIC_BASE + 'treffer-1.mp3' };

window._musicAudio = null;
window._musicOn = false;   // true = Musik soll gerade laufen (nach der ersten Geste, Regler über 0)

// ── Lautstärke ──────────────────────────────────────────────────────────────
const TON_KEYS = { gesamt: 'es_ton_gesamt', menue: 'es_ton_menue', kampf: 'es_ton_kampf' };
let _ton = null;
function _zahl(v) { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null; }
function _ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function _ladeTon() {
  if (_ton) return _ton;
  // Startwerte aus den alten Schaltern, damit sich beim Umstieg nichts ändert:
  // es_music = '0' war „Musik aus“, es_music_vol die Lautstärke (Handys fest 30 %,
  // dort war der Regler ausgeblendet). Die Effekte liefen immer voll.
  const mobil = matchMedia('(pointer:coarse)').matches || innerWidth < 600;
  let alt = mobil ? 0.3 : (_zahl(_ls('es_music_vol')) ?? 0.5);
  if (_ls('es_music') === '0') alt = 0;
  _ton = {
    gesamt: _zahl(_ls(TON_KEYS.gesamt)) ?? 1,
    menue: _zahl(_ls(TON_KEYS.menue)) ?? alt,
    kampf: _zahl(_ls(TON_KEYS.kampf)) ?? alt,
  };
  return _ton;
}

/** Reglerwert 0…1 ('gesamt' | 'menue' | 'kampf'). */
export function tonWert(art) { return _ladeTon()[art] ?? 1; }

export function setTon(art, v) {
  if (!(art in TON_KEYS)) return;
  const n = _zahl(v);
  if (n === null) return;
  _ladeTon()[art] = n;
  try { localStorage.setItem(TON_KEYS[art], String(n)); } catch (e) {}
  _tonUiZeigen();
  _anwenden();
}

// ── Element und Laden ───────────────────────────────────────────────────────
function _element() {
  if (window._musicAudio) return window._musicAudio;
  const a = new Audio();
  a.loop = true;
  a.preload = 'auto';
  a.setAttribute('playsinline', '');
  // Lockscreen-Medienanzeige nach jedem play() unterdrücken — der Browser setzt
  // MediaSession bei Wiedergabe neu, daher hier wiederholt zurücksetzen.
  a.addEventListener('playing', _suppressMediaSession);
  // Jeder Start (auch der von speech.js nach dem Mikrofon) weckt den AudioContext,
  // sonst liefe die Musik über die Gain-Kette stumm.
  a.addEventListener('play', _ctxWecken);
  _suppressMediaSession();
  window._musicAudio = a;
  return a;
}

// Gain-Kette: Element → Gain → Lautsprecher. Nur einmal je Element möglich, in der
// ersten Geste (startMusicSync), wenn der AudioContext frei ist.
let _gain = null, _vol = 0;
function _verbinden(a) {
  if (_gain) return;
  try {
    const ctx = _sfx();
    if (!ctx) return;
    const g = ctx.createGain();
    g.gain.value = _vol;
    ctx.createMediaElementSource(a).connect(g);
    g.connect(ctx.destination);
    _gain = g;
    a.volume = 1;
  } catch (e) { console.warn('[Musik] Web Audio:', e?.message); }
}
function _ctxWecken() {
  if (!_gain) return;
  try { const ctx = _sfx(); if (ctx && ctx.state !== 'running') ctx.resume(); } catch (e) {}
}
function _setVol(a, v) {
  _vol = v;
  if (_gain) _gain.gain.value = v;
  else try { a.volume = v; } catch (e) {}
}

function _suppressMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'].forEach((x) => {
      try { navigator.mediaSession.setActionHandler(x, null); } catch (e) {}
    });
  } catch (e) {}
}

// datei → Promise<Objekt-URL | null>; _fertig hält die schon geladenen (synchron
// abrufbar für den Start in der Geste). Höchstens 3 Stücke im Speicher, das
// Menüstück bleibt immer.
const _laden = new Map();
const _fertig = new Map();
function _blobUrl(datei) {
  if (_laden.has(datei)) return _laden.get(datei);
  const p = fetch(MUSIC_BASE + datei)
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
    .then((b) => {
      const url = URL.createObjectURL(b);
      _fertig.set(datei, url);
      _aufraeumen(datei);
      return url;
    })
    .catch((e) => { console.warn('[Musik]', datei, e?.message); _laden.delete(datei); return null; });
  _laden.set(datei, p);
  return p;
}
function _aufraeumen(neu) {
  for (const [k, url] of _fertig) {
    if (_fertig.size <= 3) break;
    if (k === MUSIK.menue || k === neu || k === _datei) continue;
    URL.revokeObjectURL(url);
    _fertig.delete(k);
    _laden.delete(k);
  }
}

/** Menümusik schon beim Laden der App holen (startup.js, vor dem Start-Knopf). */
export function musikVorladen() {
  if (tonWert('menue') > 0 && tonWert('gesamt') > 0) _blobUrl(MUSIK.menue);
}

// ── Ort und Wechsel ─────────────────────────────────────────────────────────
let _ort = 'menue';
let _datei = null;          // Stück, das im Element liegt
let _gestartet = false;     // erste Geste war da (Browser-Regel)
let _nr = 0;                // jeder Wechsel bekommt eine Nummer; ältere brechen ab
let _ortTimer = null;
let _menuePos = 0;          // zurück aus dem Kampf: Menümusik läuft dort weiter

function _zielVol() {
  const t = _ladeTon();
  return t.gesamt * (_ort === 'menue' ? t.menue : t.kampf);
}

/**
 * Wo spielt die Musik? 'menue', eine Arena (wiese, abend, kerker, kristall, vulkan,
 * friedhof) oder 'boss'. Mehrere Aufrufe kurz hintereinander zählen als einer
 * (Kampf zu und gleich der nächste auf).
 */
export function musikOrt(ort) {
  _ort = MUSIK[ort] ? ort : 'menue';
  clearTimeout(_ortTimer);
  _ortTimer = setTimeout(_anwenden, 30);
}

// Blende: setzt die Lautstärke in kleinen Schritten. Eine neue Blende beendet die
// laufende (deren Promise löst dann sofort auf).
let _blendeTimer = null, _blendeFertig = null;
function _blende(a, ziel, ms = 250) {
  clearInterval(_blendeTimer);
  if (_blendeFertig) _blendeFertig();
  return new Promise((fertig) => {
    _blendeFertig = fertig;
    const von = _vol, t0 = performance.now();
    if (Math.abs(von - ziel) < 0.01 || a.paused) { _setVol(a, ziel); _blendeFertig = null; fertig(); return; }
    _blendeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      _setVol(a, von + (ziel - von) * k);
      if (k >= 1) { clearInterval(_blendeTimer); _blendeFertig = null; fertig(); }
    }, 25);
  });
}

function _spielen(a) {
  try {
    const p = a.play();
    if (p) p.catch((err) => console.warn('[Musik] play:', err?.message));
  } catch (e) {}
}

async function _anwenden() {
  if (!_gestartet) return;
  const nr = ++_nr;
  const a = _element();
  const ziel = _zielVol();
  const datei = MUSIK[_ort];
  if (ziel <= 0) {
    window._musicOn = false;
    await _blende(a, 0);
    if (nr === _nr) a.pause();
    return;
  }
  window._musicOn = true;
  if (datei === _datei) {
    if (a.paused && !document.hidden) { _setVol(a, 0); _spielen(a); }
    _blende(a, ziel);
    return;
  }
  // Anderes Stück: laden (parallel zum Ausblenden), wechseln, einblenden.
  const urlP = _blobUrl(datei);
  await _blende(a, 0);
  if (nr !== _nr) return;
  const url = await urlP;
  if (nr !== _nr) return;
  if (_datei === MUSIK.menue) _menuePos = a.currentTime || 0;
  if (!url) { a.pause(); return; }   // offline und noch nie geladen: Stille statt Fehler
  _datei = datei;
  a.src = url;
  if (datei === MUSIK.menue && _menuePos > 0) {
    const pos = _menuePos;
    a.addEventListener('loadedmetadata', () => { try { a.currentTime = pos; } catch (e) {} }, { once: true });
  }
  _setVol(a, 0);
  if (!document.hidden) _spielen(a);
  _blende(a, ziel);
}

/**
 * In der ersten Geste (Start-Knopf, startup.js) aufrufen: Browser erlauben Ton erst
 * danach, iOS nur für ein Element, das in der Geste play() bekam.
 */
export function startMusicSync() {
  if (_gestartet) return;
  _gestartet = true;
  const a = _element();
  _verbinden(a);
  const ziel = _zielVol();
  const datei = MUSIK[_ort];
  if (ziel > 0 && !_datei) {
    // Liegt das Stück schon ganz vor: Blob. Sonst sofort gestreamt starten (die
    // Datei wird parallel ganz geladen und vom SW abgelegt — beim nächsten Start Blob).
    _datei = datei;
    a.src = _fertig.get(datei) || (MUSIC_BASE + datei);
    if (!_fertig.has(datei)) _blobUrl(datei);
    _setVol(a, ziel);
    window._musicOn = true;
    _spielen(a);
    return;
  }
  _anwenden();
}

// Hintergrund → pausieren, zurück → weiter, wenn die Musik laufen soll.
document.addEventListener('visibilitychange', () => {
  const a = window._musicAudio;
  if (!a) return;
  if (document.hidden) a.pause();
  else if (window._musicOn) _spielen(a);
});

// ── Profil, Bereich „Ton“ ───────────────────────────────────────────────────
function _tonUiZeigen() {
  document.querySelectorAll('input[data-ton]').forEach((inp) => {
    const v = Math.round(tonWert(inp.dataset.ton) * 100);
    if (document.activeElement !== inp) inp.value = String(v);
    const zeile = inp.closest('.pf-ton-zeile');
    const fuell = zeile?.querySelector('.pf-ton-fuell');
    if (fuell) fuell.style.width = v + '%';
    const wert = zeile?.querySelector('.pf-ton-wert');
    if (wert) wert.textContent = v === 0 ? 'Aus' : v + ' %';
    inp.setAttribute('aria-valuetext', v === 0 ? 'Aus' : v + ' Prozent');
  });
}
document.addEventListener('input', (e) => {
  const inp = e.target.closest?.('input[data-ton]');
  if (inp) setTon(inp.dataset.ton, inp.value / 100);
});

// Alte Musikdateien (bis v4.0.582, zusammen 33 MB) aus dem Musik-Cache räumen,
// falls ein Gerät sie dort abgelegt hat. Nur Dateien unter music/, die nicht mehr
// zur App gehören.
function _alteMusikRaeumen() {
  if (!('caches' in window)) return;
  const jetzt = new Set([...Object.values(MUSIK), ...Object.values(SCHLAEGE).map((p) => p.slice(MUSIC_BASE.length))]);
  caches.open('english-stars-static-v1').then((c) => c.keys().then((keys) => {
    keys.forEach((req) => {
      const m = new URL(req.url).pathname.match(/\/music\/([^/]+)$/);
      if (m && !jetzt.has(decodeURIComponent(m[1]))) c.delete(req);
    });
  })).catch(() => {});
}

function _init() { _tonUiZeigen(); setTimeout(_alteMusikRaeumen, 5000); }
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', _init);
else _init();
