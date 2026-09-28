// src/modules/world.js
// Anbindung von pixel-world-fine.js: Gegenstände, Schmiede-Werkstücke,
// Kampfplätze und Lagerfeuer. Das Handoff-Modul bleibt unangetastet (Regel 5) —
// hier stehen nur Maßstab, Zwischenspeicher und die Zuordnung zu unseren Daten.
//
// Zwei Regeln aus dem Handoff, die hier tragen:
//   · Werkstücke NIE mit opacity oder grayscale abdunkeln. Der graue Zustand
//     steckt schon in den Teil-Zuständen ('g'), und das gerade entstehende Teil
//     glüht in vier Bildern mit 4 fps. Beides kommt fertig aus dem Modul.
//   · Pixel nur ganzzahlig skalieren. Gegenstände und Werkstücke bekommen
//     deshalb feste Vielfache, keine width:100%-Streckung.

import {
  itemSprite, spriteToCanvas, spriteSVG,
  itemPartsCanvasTrimmed, partStates, PART_ANIM, PART_NAMES, FORGE_PANEL,
  ARENAS, CAMPFIRE, CAMPFIRE_FRAMES, CAMPFIRE_FPS,
} from './pixel-world-fine.js';

export { PART_NAMES, PART_ANIM, FORGE_PANEL, CAMPFIRE_FRAMES, CAMPFIRE_FPS, partStates };

const _cache = new Map();
const CACHE_MAX = 240;
function _hole(k, bauen) {
  const t = _cache.get(k);
  if (t) return t;
  const v = bauen();
  if (v == null) return '';
  if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value);
  _cache.set(k, v);
  return v;
}
const _tag = (cv) => cv
  ? `<img src="${cv.toDataURL('image/png')}" width="${cv.width}" height="${cv.height}" alt="" style="image-rendering:pixelated;display:block;flex:none">`
  : '';

// ── Material ────────────────────────────────────────────────────────────────
// 'past' = Stahl (Simple Past), 'pp' = Gold (Past Participle). Die Stufe
// „verzaubert" hat keine eigene Grafik — sie hatte auch bisher keine
// (itemSpriteSVG hat `tier` schon immer ignoriert).
export const material = (which) => (which === 'pp' ? 'pp' : 'past');

// ── Fertiger Gegenstand ─────────────────────────────────────────────────────
/** Gegenstand als <img>. type = Waffen- oder Ausrüstungsart, which = 'past'|'pp'. */
export function itemTag(type, which, scale = 2) {
  const mat = material(which), s = Math.max(1, Math.round(scale));
  return _hole(`it:${type}:${mat}:${s}`, () => {
    const sp = itemSprite(type, mat);
    return sp ? _tag(spriteToCanvas(sp, s)) : null;
  });
}

// ── Schmiede: 5 Teile ───────────────────────────────────────────────────────
// Anzeige-Maßstab je Objektart (FORGE_PANEL). Der Gefährte ist breiter gebaut
// und bekommt deshalb 3× statt 4×.
export const forgeScale = (type) => (type === 'gefaehrte' ? FORGE_PANEL.petScale : FORGE_PANEL.weaponScale);

/**
 * Werkstück mit Teile-Zuständen. `fertig` = Zahl der fertigen Teile (0–5);
 * das Teil danach glüht, der Rest bleibt grau. `bild` läuft 0–3 im 4-fps-Takt.
 */
export function forgeTag(type, which, fertig, bild = 0, scale = null) {
  const mat = material(which);
  const s = Math.max(1, Math.round(scale ?? forgeScale(type)));
  const zu = partStates(fertig);
  // Ein fertiges oder unbegonnenes Werkstück steht still — nur der Glühzustand
  // hat mehrere Bilder.
  const f = zu.includes('n') ? (bild % PART_ANIM.frames) : 0;
  return _hole(`fp:${type}:${mat}:${zu}:${f}:${s}`, () => _tag(itemPartsCanvasTrimmed(type, mat, zu, f, s)));
}

/** Namen der fünf Teile eines Objekts, in Bauabfolge. */
export const partNames = (type) => PART_NAMES[type] || [];

// ── Kampfplätze ─────────────────────────────────────────────────────────────
export const ARENA_KEYS = Object.keys(ARENAS);

/**
 * Kampfplatz einer Runde. Bewusst an die RUNDE gebunden und nicht an den
 * einzelnen Kampf: so wird die Kampagne mit jedem Durchlauf sichtbar „tiefer"
 * (Wiese → Abend → Kerker → Kristall → Vulkan → Friedhof), ohne dass die
 * Kulisse innerhalb eines Laufs unruhig springt.
 */
export function arenaForRound(round = 0) {
  const n = ARENA_KEYS.length;
  return ARENA_KEYS[((round | 0) % n + n) % n];
}

/**
 * Kampfplatz als SVG-Hintergrund. Füllt die Fläche und schneidet unten nichts
 * ab (`xMidYMax slice`) — bei 402 × 874 (Entwurfsgröße) ist das exakt 2×.
 */
export function arenaSVG(key) {
  const sp = ARENAS[key] || ARENAS[ARENA_KEYS[0]];
  return spriteSVG(sp).replace('<svg ', '<svg preserveAspectRatio="xMidYMax slice" ');
}

// ── Lagerfeuer ──────────────────────────────────────────────────────────────
/** Lagerfeuer, statisch (Bild 0) oder ein bestimmtes Bild der 8-fps-Folge. */
export function campfireTag(bild = null, scale = 2) {
  const s = Math.max(1, Math.round(scale));
  const i = bild == null ? -1 : ((bild % CAMPFIRE_FRAMES.length) + CAMPFIRE_FRAMES.length) % CAMPFIRE_FRAMES.length;
  return _hole(`cf:${i}:${s}`, () => _tag(spriteToCanvas(i < 0 ? CAMPFIRE : CAMPFIRE_FRAMES[i], s)));
}
