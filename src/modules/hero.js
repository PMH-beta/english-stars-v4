// src/modules/hero.js
// Anbindung der neuen Figur (pixel-hero-fine.js) an die App. Das Handoff-Modul
// selbst bleibt unangetastet (Regel 5); hier stehen nur Umrechnung, Maßstab und
// Zwischenspeicher.
//
// Zwei Dinge, die das Modul anders macht als avatar.js:
//   1. Es liefert <canvas>, nicht SVG-Text. Für die vorhandenen Aufrufstellen,
//      die einen String in ein Template setzen, gibt es imgTag() — ein <img> mit
//      Data-URL, das sich genauso einsetzen lässt.
//   2. Pixel dürfen nur GANZZAHLIG skaliert werden (Regel 6). Deshalb wird der
//      Maßstab am Container gemessen (fitScale) statt die Grafik per width:100%
//      in eine beliebige Fläche zu ziehen.
//
// Gezeichnet wird nicht bei jedem Aufruf: eine Figur kostet rund 20 ms, und das
// Menü zeichnet sie bei jedem Render neu. Der Zwischenspeicher hat als Schlüssel
// Avatar + Ausrüstung + Maßstab, genau wie im Handoff verlangt.

import { hero, pet, crop, shadowed, toCanvas, renderPet, renderPetSilhouette, petBattleFrames, petBattleSequence, petMenuImage, PET_BATTLE, PETS } from './pixel-hero-fine.js';

// Maße der Rohgrafik: ganze Figur und Kopf-Ausschnitt (34 × 34 ab (10, 0)).
// hero().render() ist immer 54 × 81 — mit jeder Statur und Ausrüstung. Mit
// Pixel-Schatten darunter (shadowed, Sprite „H…_s" der Referenz) 54 × 87.
export const HERO_W = 54, HERO_H = 81, HERO_SCHATTEN_H = 87;
export const HEAD_W = 34, HEAD_H = 34;
// Brustbild (Kopf + Schultern) für Spielerbanner und Freundesliste: 32 × 32 ab
// (11, 6). Pixelgleich mit den Büsten-Sprites Hb0–Hb9 der Referenz; ab y = 6,
// weil die Figur ohne Helm erst in Zeile 6 beginnt.
export const BUST_W = 32, BUST_H = 32;
const BUST_X = 11, BUST_Y = 6;

// ── Ausrüstung: Item-Objekte der App → Form, die hero() versteht ─────────────
// campaign-equipment.equippedGearMap() liefert ganze Items mit { slot, which,
// tier, … }. hero() will je Körperteil nur 'past' (Stahl) oder 'pp' (Gold), und
// bei der Waffe { type, which }.
// Talisman und Ring kennt die neue Figur nicht (F-07 A): ihre Wirkung im Kampf
// und ihr Fach im Profil bleiben, die Figur trägt sie nur nicht mehr sichtbar.
// Der Gefährte ist kein Verlust — er steht als eigene Figur daneben (heroWithPet).
const _mat = (it) => (it && it.which === 'pp' ? 'pp' : 'past');

export function gearFor(map) {
  if (!map) return undefined;
  const g = {};
  for (const teil of ['head', 'body', 'arms', 'legs']) if (map[teil]) g[teil] = _mat(map[teil]);
  if (map.weapon && map.weapon.type) g.weapon = { type: map.weapon.type, which: _mat(map.weapon) };
  return Object.keys(g).length ? g : undefined;
}

// ── Zwischenspeicher ────────────────────────────────────────────────────────
const _cache = new Map();
const CACHE_MAX = 160;

function _key(cfg, gear, art, scale) {
  return JSON.stringify([cfg, gear || 0, art, scale]);
}

function _merken(k, url) {
  if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value);
  _cache.set(k, url);
  return url;
}

// ── Zeichnen ────────────────────────────────────────────────────────────────

/** Ausschnitt einer Figur: ganze Figur (mit oder ohne Schatten), Brustbild oder nur der Kopf. */
export function ausschnitt(opts) {
  return opts.bust ? 'bust' : opts.headOnly ? 'head' : opts.shadow ? 'schatten' : 'voll';
}
export const MASSE = {
  voll: [HERO_W, HERO_H], schatten: [HERO_W, HERO_SCHATTEN_H],
  bust: [BUST_W, BUST_H], head: [HEAD_W, HEAD_H],
};

/** Figur (ganz, mit Schatten, Brustbild oder Kopf) als Data-URL, ganzzahlig skaliert. */
export function heroURL(cfg, { gear, headOnly = false, bust = false, shadow = false, scale = 2 } = {}) {
  const s = Math.max(1, Math.round(scale));
  const art = ausschnitt({ bust, headOnly, shadow });
  const k = _key(cfg, gear, art, s);
  const da = _cache.get(k);
  if (da) return da;
  const voll = hero(gear ? { ...cfg, gear } : cfg).render();
  const img = art === 'bust' ? crop(voll, BUST_X, BUST_Y, BUST_W, BUST_H)
    : art === 'head' ? crop(voll, 10, 0, HEAD_W, HEAD_H)
    : art === 'schatten' ? shadowed(voll) : voll;
  return _merken(k, toCanvas(img, s).toDataURL('image/png'));
}

/** Dasselbe als fertiges <img>-Tag für Aufrufstellen, die einen String einsetzen. */
export function imgTag(cfg, opts = {}) {
  const s = Math.max(1, Math.round(opts.scale ?? 2));
  const b = MASSE[ausschnitt(opts)];
  return `<img src="${heroURL(cfg, { ...opts, scale: s })}" width="${b[0] * s}" height="${b[1] * s}"`
    + ` alt="" style="image-rendering:pixelated;display:block;flex:none">`;
}

// ── Menü-Bühne (8.1–8.3) ────────────────────────────────────────────────────
// Figur und Gefährte als EIN Bild (START-HERE „Menü-Bühne“: dx 26, dy 3, ein
// gemeinsamer Schatten), ohne Gefährten shadowed(hero). Die Figur atmet
// (data-ui="idle", 4 Bilder, 4 fps): Zeilen oberhalb der Taille (Figur Zeile 50,
// Gefährte Fußzeile − 6) rutschen 1 px nach unten, Schatten und Beine bleiben
// stehen, der Gefährte atmet einen Takt versetzt. Nachgebaut nach der Methode
// uiIdle der Referenzdatei — alle vier Bilder mit dem Zuschnitt von Bild 0,
// damit nichts springt.
const _ATEM = [0, 1, 1, 0];
const _buehnen = new Map();   // Schlüssel → 4 Canvas-Bilder (der Takt malt daraus)
// Schlüssel → die 4 Pixelbilder dazu. Handys verwerfen im Hintergrund manchmal den
// Inhalt von Canvas-Bildern (13.10.2026: Figur weg bis zum Neustart) — dann baut
// _bilderZu die Canvas-Bilder hieraus neu (buehnenVerwerfen).
const _buehnenQuelle = new Map();

function _merkeBuehne(k, quelle) {
  if (_buehnenQuelle.size >= 24) {
    const alt = _buehnenQuelle.keys().next().value;
    _buehnenQuelle.delete(alt);
    _buehnen.delete(alt);
  }
  _buehnenQuelle.set(k, quelle);
  return _bilderZu(k);
}
function _bilderZu(k) {
  let b = _buehnen.get(k);
  if (!b) {
    const q = _buehnenQuelle.get(k);
    if (!q) return null;
    b = q.map((img) => toCanvas(img, 1));
    _buehnen.set(k, b);
  }
  return b;
}

/** Sind gemerkte Bühnen-Bilder leer geworden? Prüft je Bühne ein deckendes Pixel von Bild 0. */
export function buehnenVerloren() {
  for (const [k, b] of _buehnen) {
    const img = _buehnenQuelle.get(k)?.[0];
    const i = img ? img.col.findIndex(Boolean) : -1;
    if (i < 0) continue;
    const a = b[0].getContext('2d').getImageData(i % img.w, Math.floor(i / img.w), 1, 1).data[3];
    if (a === 0) return true;
  }
  return false;
}
/** Canvas-Bilder aller Bühnen verwerfen; sie entstehen beim nächsten Zugriff neu aus den Pixelbildern. */
export function buehnenVerwerfen() { _buehnen.clear(); }

function _unterkante(img) {
  for (let y = img.h - 1; y >= 0; y--) for (let x = 0; x < img.w; x++) {
    const c = img.col[y * img.w + x];
    if (c && c.length < 9) return y;   // Schattenton (#RRGGBBAA) zählt nicht
  }
  return img.h - 1;
}
function _senken(img, s, f) {
  if (!f) return img;
  const col = new Array(img.w * img.h).fill(null);
  for (let y = 0; y < img.h; y++) {
    const sy = y < s + f ? y - f : y;
    if (sy < 0) continue;
    for (let x = 0; x < img.w; x++) col[y * img.w + x] = img.col[sy * img.w + x];
  }
  return { w: img.w, h: img.h, col };
}
function _fuss({ w, h, col }) {
  let b = -1;
  for (let y = h - 1; y >= 0 && b < 0; y--) for (let x = 0; x < w; x++) if (col[y * w + x]) { b = y; break; }
  let mn = w, mx = 0;
  for (let y = Math.max(0, b - 3); y <= b; y++) for (let x = 0; x < w; x++) if (col[y * w + x]) { mn = Math.min(mn, x); mx = Math.max(mx, x); }
  return { yb: b, mn, mx, fl: b < h - 8 };
}

// ── Holo-Fell des Schillernden Gefährten (F-97, neu gefasst 14.10.2026) ─────
// Nur der goldene Gefährte schillert, und nur, wenn er angelegt ist. Wie eine
// Überblendung (Wunsch des Nutzers: „nicht das ganze Fell“, „außen Glänzen“):
// das Fell behält Farbe und Schattierung, darüber liegt nur ein Hauch Regenbogen;
// ein weicher Regenbogen-Glanz wandert schräg über den Körper, und der Fellrand
// direkt an der äußeren Kontur schillert. Die Kontur selbst nimmt etwas Farbe an.
// Vier Schritte im Takt des Atmens. Kontur = die dunklen Farben am Außenrand des
// Tiers (je Tier und Fellfarbe andere), deshalb bleibt auch dunkles Fell Fell.
// Die Pixeldaten des Moduls bleiben unverändert — eingefärbt wird nur das Bild.
const HOLO = { ton: 0.06, satt: 0.9, hell: 0.6, zyklus: 1.6, band: 0.25, bandTon: 0.5, bandBreite: 9, rand: 0.55, randTon: 0.6, kontur: 0.2, funkeln: true };
const _hx = (c) => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
const _lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const _hex2 = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
const _hexOf = (a) => '#' + a.map(_hex2).join('');
const _screen = (a, b, t) => 1 - (1 - a) * (1 - b * t);
function _hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}
// Je Pixel: 1 Fell, 2 Kontur oder sehr dunkel (Augen), 3 Lichtpunkt der Augen.
// silh = Kontur am Außenrand, randFell = Fell direkt an dieser Kontur.
function _holoMasken({ w, h, col }) {
  const n = w * h, opak = (i) => !!col[i] && col[i].length === 7;
  const aussen = new Uint8Array(n), stapel = [];
  for (let x = 0; x < w; x++) stapel.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stapel.push(y * w, y * w + w - 1);
  while (stapel.length) {
    const i = stapel.pop();
    if (aussen[i] || opak(i)) continue;
    aussen[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stapel.push(i - 1); if (x < w - 1) stapel.push(i + 1);
    if (y > 0) stapel.push(i - w); if (y < h - 1) stapel.push(i + w);
  }
  const amRand = (i) => { const x = i % w, y = (i / w) | 0;
    return x === 0 || y === 0 || x === w - 1 || y === h - 1 || aussen[i - 1] || aussen[i + 1] || aussen[i - w] || aussen[i + w]; };
  const kontur = new Set();
  for (let i = 0; i < n; i++) if (opak(i) && amRand(i) && _lum(_hx(col[i])) < 0.36) kontur.add(col[i]);
  const art = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (opak(i)) art[i] = kontur.has(col[i]) || _lum(_hx(col[i])) < 0.13 ? 2 : col[i] === '#fffaf0' ? 3 : 1;
  const silh = new Uint8Array(n), randFell = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (art[i] && amRand(i)) silh[i] = 1;
  for (let i = 0; i < n; i++) {
    if (art[i] !== 1) continue;
    const x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1 && !randFell[i]; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h && silh[Y * w + X] && art[Y * w + X] === 2) { randFell[i] = 1; break; }
    }
  }
  return { art, silh, randFell, aussen };
}
/** Bild (w, h, col) im Holo-Schritt p (0–3); opt ändert die Stärken (Perlmutt-Gegenstand). */
export function holoBild(img, p, opt) {
  const P = opt ? { ...HOLO, ...opt } : HOLO;
  const { w, h } = img, col = img.col.slice(), { art, silh, randFell, aussen } = _holoMasken(img);
  const diag = w + h, bandPos = ((p % 4) + 0.5) / 4 * diag * 1.2 - diag * 0.1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = art[i];
    if (a !== 1 && !(a === 2 && silh[i])) continue;
    // Regenbogen quer zum Glanzstreifen, rückt je Schritt weiter
    const H = _hsl(360 * ((x - y + h) / diag * P.zyklus) + p * 90 + 200, P.satt, P.hell);
    const base = _hx(img.col[i]);
    if (a === 2) { col[i] = _hexOf(base.map((v, k) => v + (H[k] * 0.55 - v) * P.kontur)); continue; }
    const gH = _lum(H), C = H.map((v) => v - gH), L = _lum(base);
    let o = base.map((v, k) => v + C[k] * P.ton * (0.35 + 0.65 * L));
    const u = Math.abs((x + y) - bandPos) / P.bandBreite;
    const band = u < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * u) : 0;
    if (band > 0) o = o.map((v, k) => _screen(v + C[k] * P.bandTon * band, 1, P.band * band));
    if (randFell[i]) o = o.map((v, k) => _screen(v + C[k] * P.randTon * L, 1 + (H[k] - 1) * 0.5, P.rand * (1 - L)));
    col[i] = _hexOf(o.map((v) => Math.max(0, Math.min(1, v))));
  }
  if (P.funkeln) _funkenOrte(img, aussen, art, P.rahmen).forEach(([x, y], k) => {
    const g = _FUNKEN[p % 4][k];
    if (!g) return;
    const hell = _hexOf(_hsl(360 * ((x - y + h) / diag * P.zyklus) + p * 90 + 200, 0.95, 0.7));   // kräftig genug für den hellen Grund
    col[y * w + x] = g === 2 ? '#ffffff' : hell;
    if (g === 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) col[(y + dy) * w + x + dx] = hell;
  });
  return { w, h, col };
}
// Leichtes Funkeln ums Tier (Wunsch des Nutzers 14.10.2026, „ganz leichtes Glänzen
// drumherum“): zwei Funken knapp außerhalb der Kontur — rechts oben und rechts
// weiter unten, weg von der Figur, die auf der Bühne und im Kampf links steht —
// wechseln sich ab: 2 = Kreuz (weiß, Arme im Regenbogen), 1 = ein Pixel, 0 = aus.
// Nur in freie Pixel mit freiem Rand, nie aufs Tier oder den Schatten. rahmen =
// erlaubte Fläche {x, y, w, h}, wenn das Bild danach zugeschnitten wird (Schmiede).
const _FUNKEN = [[2, 0], [1, 1], [0, 2], [1, 1]];
function _funkenOrte({ w, h, col }, aussen, art, rahmen) {
  let y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) if (art[i]) { const x = i % w, y = (i / w) | 0; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return [];
  const R = rahmen || { x: 0, y: 0, w, h };
  const frei = (x, y) => x >= R.x && y >= R.y && x < R.x + R.w && y < R.y + R.h && x < w && y < h && aussen[y * w + x] && !col[y * w + x];
  const tier = (x, y) => x >= 0 && y >= 0 && x < w && y < h && art[y * w + x];
  return [[x1 + 1, y0 + 2], [x1 + 1, y0 + Math.round((y1 - y0) * 0.62)]].map(([tx, ty]) => {
    let best = null, bd = 1e9;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let ok = true, nah = false;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!frei(x + dx, y + dy)) { ok = false; break; }
      if (!ok) continue;
      for (let dy = -2; dy <= 2 && !nah; dy++) for (let dx = -2; dx <= 2; dx++) if (tier(x + dx, y + dy)) { nah = true; break; }
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (nah && d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }).filter(Boolean);
}
/** Schillerndes Bild als <canvas data-ui="idle"> (4 Holo-Schritte) im Maßstab scale. */
export function holoHTML(key, img, scale, opt) {
  return _canvasAtem(JSON.stringify(['holo', key]), () => [0, 1, 2, 3].map((p) => holoBild(img, p, opt)), Math.max(1, Math.round(scale)), 0);
}
/** Eigenes Tier klein mit Holo-Fell (Fach „Gefährte" im Profil). */
export function petHoloHTML(petIdx, colorIdx, scale = 1) {
  const kind = petKind(petIdx), farbe = petColorHex(petIdx, colorIdx);
  return holoHTML(['pet', kind, farbe], pet(kind, farbe).render(), scale);
}

function _atemBilder(cfg, gear, gefaehrte) {
  const H = hero(gear ? { ...cfg, gear } : cfg).render();
  if (!gefaehrte) {
    const img = shadowed(H);
    return _ATEM.map((f) => _senken(img, 50, f));
  }
  const Pt = pet(gefaehrte.kind, gefaehrte.color).render();
  const dx = 26, dy = 3, ps = _unterkante(Pt) - 6;
  const fh = _fuss(H), fp = _fuss(Pt), gH = fh.yb + 1, gP = gH + dy, oy = fp.fl ? gP - Pt.h : gP - (fp.yb + 1);
  const E = [
    { cx: (fh.mn + fh.mx + 1) / 2, cy: gH + 0.5, rx: Math.max(4, (fh.mx - fh.mn + 1) * 0.58), ry: 2.6 },
    { cx: dx + (fp.mn + fp.mx + 1) / 2, cy: gP + 0.5, rx: Math.max(4, (fp.mx - fp.mn + 1) * (fp.fl ? 0.36 : 0.58)), ry: fp.fl ? 1.8 : 2.6 },
  ];
  const X0 = Math.floor(Math.min(0, dx, ...E.map((e) => e.cx - e.rx)));
  const X1 = Math.ceil(Math.max(H.w, dx + Pt.w, ...E.map((e) => e.cx + e.rx)));
  const Y0 = Math.min(0, oy);
  const Y1 = Math.ceil(Math.max(H.h, oy + Pt.h, ...E.map((e) => e.cy + e.ry)));
  const W = X1 - X0, HH = Y1 - Y0;
  // ph = Holo-Schritt (nur beim Schillernden Gefährten, gefaehrte.holo).
  const baue = (hf, pf, ph = 0) => {
    const col = new Array(W * HH).fill(null);
    for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) {
      const px = x + X0 + 0.5, py = y + Y0 + 0.5;
      if (E.some((e) => ((px - e.cx) / e.rx) ** 2 + ((py - e.cy) / e.ry) ** 2 <= 1)) col[y * W + x] = '#1F1F2461';
    }
    const setze = (img, ox, o2) => {
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
        const v = img.col[y * img.w + x];
        if (v) col[(y + o2 - Y0) * W + x + ox - X0] = v;
      }
    };
    setze(_senken(H, 50, hf), 0, 0);
    setze(gefaehrte.holo ? holoBild(_senken(Pt, ps, pf), ph) : _senken(Pt, ps, pf), dx, oy);
    return col;
  };
  const c0 = baue(0, 0);
  let x0 = W, x1 = -1, y0 = HH, y1 = -1;
  for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) if (c0[y * W + x]) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const w2 = x1 - x0 + 1, h2 = y1 - y0 + 1;
  const schneide = (col) => {
    const o = new Array(w2 * h2);
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) o[y * w2 + x] = col[(y + y0) * W + x + x0];
    return { w: w2, h: h2, col: o };
  };
  return [0, 1, 2, 3].map((f) => schneide(f ? baue(_ATEM[f], _ATEM[(f + 1) % 4], f) : c0));
}

/**
 * Bühnen-Figur als <canvas data-ui="idle">. `gefaehrte` = { kind, color } oder
 * null. Das Canvas trägt die Rohgröße, gezeigt wird es ganzzahlig vergrößert.
 * Nach dem Einsetzen paintStages() aufrufen, damit Bild 0 auch ohne Bewegung
 * (prefers-reduced-motion) steht.
 */
export function stageHTML(cfg, { gear, gefaehrte = null, scale = 2 } = {}) {
  const s = Math.max(1, Math.round(scale));
  const k = JSON.stringify([cfg, gear || 0, gefaehrte || 0]);
  const bilder = _bilderZu(k) || _merkeBuehne(k, _atemBilder(cfg, gear, gefaehrte));
  const { width: w, height: h } = bilder[0];
  return `<canvas data-ui="idle" data-idle="${encodeURIComponent(k)}" width="${w}" height="${h}"`
    + ` style="width:${w * s}px;height:${h * s}px;image-rendering:pixelated;display:block;flex:none"></canvas>`;
}

// ── Charakter-Editor (1.9, 1.10, 8.4–8.12) ──────────────────────────────────
// Bühne: Figur mit Pixel-Schatten und Gefährte (Menü-Ansicht mit Schatten), je
// 3×, beide atmend — die Figur ab Zeile 50, der Gefährte ab Fußzeile − 6
// (wie uiIdle der Referenz für E_st…/E_pet…).
function _atemEinzeln(img, split) { return _ATEM.map((f) => _senken(img, split, f)); }
function _canvasAtem(k, bilder, scale, d) {
  const { width: w, height: h } = (_bilderZu(k) || _merkeBuehne(k, bilder()))[0];
  return `<canvas data-ui="idle"${d ? ` data-d="${d}"` : ''} data-idle="${encodeURIComponent(k)}" width="${w}" height="${h}"`
    + ` style="width:${w * scale}px;height:${h * scale}px;image-rendering:pixelated;display:block;flex:none"></canvas>`;
}
/**
 * Vier Bilder im Takt des Stehens (4 fps über data-ui="idle"), z. B. Vondu und
 * das glühende Werkstück in der App-Tour. bilder() liefert vier {w,h,col}.
 */
export function atemBilderHTML(k, bilder, scale = 2) {
  return _canvasAtem(JSON.stringify(['ab', k]), bilder, scale, 0);
}
export function editorFigurHTML(cfg, scale = 3) {
  return _canvasAtem(JSON.stringify(['ef', cfg]), () => _atemEinzeln(shadowed(hero(cfg).render()), 50), scale, 0);
}
export function editorPetHTML(petIdx, colorIdx, scale = 3, holo = false) {
  const kind = petKind(petIdx), farbe = petColorHex(petIdx, colorIdx);
  return _canvasAtem(JSON.stringify(['ep', kind, farbe, holo ? 1 : 0]), () => {
    const img = petMenuImage(kind, farbe);
    const bilder = _atemEinzeln(img, _unterkante(img) - 6);
    return holo ? bilder.map((b, f) => holoBild(b, f)) : bilder;   // Schillernder Gefährte
  }, scale, 2);
}

// Kacheln: Ausschnitte der Figur mit allen aktuellen Einstellungen (START-HERE):
// Kopf 34 × 34 ab (10, 0), Gesicht 26 × 24 ab (14, 9), Oberkörper 38 × 36 ab
// (8, 31), Beine 34 × 31 ab (10, 50), ganze Figur 54 × 81.
export const KACHEL_AUSSCHNITT = {
  kopf: [10, 0, 34, 34], gesicht: [14, 9, 26, 24], oberkoerper: [8, 31, 38, 36], beine: [10, 50, 34, 31], voll: [0, 0, 54, 81],
};
export function kachelURL(cfg, art, scale) {
  const s = Math.max(1, Math.round(scale));
  const k = JSON.stringify(['k', cfg, art, s]);
  const da = _cache.get(k);
  if (da) return da;
  const [x, y, w, h] = KACHEL_AUSSCHNITT[art];
  return _merken(k, toCanvas(crop(hero(cfg).render(), x, y, w, h), s).toDataURL('image/png'));
}

/** Atem-Bilder zu einem Bühnen-Canvas (für den UI-Takt, ui-anim „idle“). */
export function stageFrames(el) {
  const k = el && el.dataset && el.dataset.idle;
  return k ? _bilderZu(decodeURIComponent(k)) : null;
}

/** Bild 0 in alle Bühnen-Canvases unter root malen. */
export function paintStages(root) {
  (root || document).querySelectorAll('canvas[data-idle]').forEach((el) => {
    const b = stageFrames(el);
    if (!b) return;
    const x = el.getContext('2d');
    x.clearRect(0, 0, el.width, el.height);
    x.drawImage(b[0], 0, 0);
  });
}

/** Farbwert eines Gefährten aus PETS (kind-Index, Farb-Index). */
export function petColorHex(petIdx, colorIdx) {
  const p = PETS[((petIdx | 0) % PETS.length + PETS.length) % PETS.length];
  const f = p[2];
  return f[((colorIdx | 0) % f.length + f.length) % f.length];
}

/** Schlüssel (Tier-Name) eines Gefährten-Index. */
export function petKind(petIdx) {
  return PETS[((petIdx | 0) % PETS.length + PETS.length) % PETS.length][0];
}

/** Anzeigename eines Gefährten-Index, z. B. „Wolf". */
export function petLabel(petIdx) {
  return PETS[((petIdx | 0) % PETS.length + PETS.length) % PETS.length][1];
}

/**
 * Gefährte als <img>-Tag. `locked` zeigt die graue Silhouette für
 * „noch nicht freigespielt" (Screen 8.10).
 */
export function petURL(petIdx, colorIdx, { scale = 2, locked = false } = {}) {
  const s = Math.max(1, Math.round(scale));
  const kind = petKind(petIdx);
  const k = 'pet:' + kind + ':' + (locked ? 'x' : petColorHex(petIdx, colorIdx)) + ':' + s;
  return _cache.get(k) || _merken(k, (locked ? renderPetSilhouette(kind, s) : renderPet(kind, petColorHex(petIdx, colorIdx), s)).toDataURL('image/png'));
}
export function petTag(petIdx, colorIdx, opts = {}) {
  return `<img src="${petURL(petIdx, colorIdx, opts)}" alt="" style="image-rendering:pixelated;display:block;flex:none">`;
}

// ── Gefährte im Kampf ───────────────────────────────────────────────────────
/**
 * Spielt die Bildfolgen eines Gefährten in einem Element ab, synchron zum
 * Helden. `petBattleSequence(kind, farbe, 'attack@4')` liefert den gemeinsamen
 * 16er-Takt: die ersten vier Schritte steht der Gefährte noch, ab Schritt 4
 * springt er mit — also genau dann, wenn der Angriff des Helden trifft.
 * Stehen läuft mit 4 fps, alles andere mit 8 fps (Handoff-Regel 6).
 */
export function createPetPlayer(el, kind, color, scale = 2, holo = false) {
  const s = Math.max(1, Math.round(scale));
  // Schillernder Gefährte: jedes gezeigte Bild einen Holo-Schritt weiter.
  let schritt = 0;
  const zeig = (img) => {
    const cv = toCanvas(holo ? holoBild(img, (schritt = (schritt + 1) % 4)) : img, s);
    Object.assign(cv.style, { imageRendering: 'pixelated', display: 'block' });
    el.replaceChildren(cv);
  };
  let timer = null, idle = petBattleFrames(kind, color, 'idle');
  const ruhe = () => {
    clearInterval(timer);
    let i = 0;
    zeig(idle[0]);
    timer = setInterval(() => { i = (i + 1) % idle.length; zeig(idle[i]); }, 1000 / PET_BATTLE.idleFps);
  };
  ruhe();
  return {
    /** name: 'attack' | 'hurt' | 'win' | 'die' | 'ko'. Danach zurück ins Stehen. */
    play(name) {
      clearInterval(timer);
      if (name === 'win' || name === 'ko') {
        const f = petBattleFrames(kind, color, name);
        let i = 0;
        zeig(f[0]);
        timer = setInterval(() => { i = (i + 1) % f.length; zeig(f[i]); },
          1000 / (name === 'ko' ? PET_BATTLE.idleFps : PET_BATTLE.actionFps));
        return;
      }
      if (name === 'die') {
        const f = petBattleFrames(kind, color, 'die');
        let i = 0;
        zeig(f[0]);
        timer = setInterval(() => {
          i++;
          if (i >= f.length) { clearInterval(timer); this.play('ko'); return; }
          zeig(f[i]);
        }, 1000 / PET_BATTLE.actionFps);
        return;
      }
      // Angriff und Treffer laufen im gemeinsamen Takt mit dem Helden.
      const folge = petBattleSequence(kind, color, name + '@4').slice(0, 8);
      let i = 0;
      zeig(folge[0]);
      timer = setInterval(() => {
        i++;
        if (i >= folge.length) { clearInterval(timer); ruhe(); return; }
        zeig(folge[i]);
      }, 1000 / PET_BATTLE.actionFps);
    },
    destroy() { clearInterval(timer); },
  };
}

/**
 * Größter GANZZAHLIGER Maßstab, mit dem die Grafik noch in den Container passt.
 * Ist der Container noch nicht vermessen (display:none), greift `fallback`.
 */
export function fitScale(el, w, h, fallback = 2) {
  if (!el) return fallback;
  const b = el.getBoundingClientRect();
  if (!b.width || !b.height) return fallback;
  const s = Math.floor(Math.min(b.width / w, b.height / h));
  return Math.max(1, s);
}
