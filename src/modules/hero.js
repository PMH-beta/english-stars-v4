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
const _buehnen = new Map();

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
  const baue = (hf, pf) => {
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
    setze(_senken(Pt, ps, pf), dx, oy);
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
  return [0, 1, 2, 3].map((f) => schneide(f ? baue(_ATEM[f], _ATEM[(f + 1) % 4]) : c0));
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
  let bilder = _buehnen.get(k);
  if (!bilder) {
    if (_buehnen.size >= 24) _buehnen.delete(_buehnen.keys().next().value);
    bilder = _atemBilder(cfg, gear, gefaehrte).map((img) => toCanvas(img, 1));
    _buehnen.set(k, bilder);
  }
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
  if (!_buehnen.has(k)) {
    if (_buehnen.size >= 24) _buehnen.delete(_buehnen.keys().next().value);
    _buehnen.set(k, bilder().map((img) => toCanvas(img, 1)));
  }
  const { width: w, height: h } = _buehnen.get(k)[0];
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
export function editorPetHTML(petIdx, colorIdx, scale = 3) {
  const kind = petKind(petIdx), farbe = petColorHex(petIdx, colorIdx);
  return _canvasAtem(JSON.stringify(['ep', kind, farbe]), () => {
    const img = petMenuImage(kind, farbe);
    return _atemEinzeln(img, _unterkante(img) - 6);
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
  return k ? (_buehnen.get(decodeURIComponent(k)) || null) : null;
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
export function createPetPlayer(el, kind, color, scale = 2) {
  const s = Math.max(1, Math.round(scale));
  const zeig = (img) => {
    const cv = toCanvas(img, s);
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
