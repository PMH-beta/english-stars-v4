// src/modules/world.js
// Anbindung von pixel-world-fine.js: Gegenstände, Schmiede-Werkstücke,
// Kampfplätze und Lagerfeuer. Das Handoff-Modul bleibt unangetastet (Regel 5) —
// hier stehen nur Maßstab, Zwischenspeicher und die Zuordnung zu unseren Daten.
//
// Zwei Regeln aus dem Handoff, die hier tragen:
//   · Werkstücke NIE mit opacity oder grayscale abdunkeln. Der graue Zustand
//     steckt schon in den Teil-Zuständen ('g'), und das gerade entstehende Teil
//     glüht in vier Bildern mit 4 fps. Beides kommt fertig aus dem Modul; hier
//     wird das glühende Teil nur noch kräftiger gemacht (werkstueckBild).
//   · Pixel nur ganzzahlig skalieren. Gegenstände und Werkstücke bekommen
//     deshalb feste Vielfache, keine width:100%-Streckung.

import {
  itemSprite, spriteToCanvas, decodeSprite,
  itemPartsCanvasTrimmed, itemPartsImage, itemBounds, cropImage, partMap, composeParts,
  partStates, PART_ANIM, PART_NAMES, FORGE_PANEL,
  ARENAS, CAMPFIRE, CAMPFIRE_FRAMES, CAMPFIRE_FPS,
} from './pixel-world-fine.js';
import { holoHTML, holoBild } from './hero.js';
import { goldSchmuck } from './schmuck-gold.js';

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
// spriteToCanvas() malt in Originalgröße und setzt den Maßstab nur als CSS-Größe;
// itemPartsCanvasTrimmed() vergrößert die Leinwand selbst. Die Anzeigegröße ist
// deshalb die CSS-Größe, wenn gesetzt — sonst ging der Maßstab verloren (Feuer
// und Gegenstände standen in 1× statt 2×).
const _tag = (cv) => {
  if (!cv) return '';
  const w = parseInt(cv.style.width, 10) || cv.width;
  const h = parseInt(cv.style.height, 10) || cv.height;
  return `<img src="${cv.toDataURL('image/png')}" width="${w}" height="${h}" alt="" style="image-rendering:pixelated;display:block;flex:none">`;
};

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
    const gs = _gold(type, mat);
    if (gs) return _tag(_leinwand(gs.img, s));
    const sp = itemSprite(type, mat);
    if (sp && _schillert(type, mat)) return _tag(_leinwand(holoBild(_perlmutt(decodeSprite(sp)), 0, HOLO_DING), s));
    return sp ? _tag(spriteToCanvas(sp, s)) : null;
  });
}

/** Gegenstand mit Holo-Glanz als animiertes Canvas (Schillernder Gefährte, F-97). */
export function itemHoloHTML(type, which, scale = 2) {
  const mat = material(which), sp = itemSprite(type, mat);
  return sp && _schillert(type, mat) ? holoHTML(['item', type, mat], _perlmutt(decodeSprite(sp)), scale, HOLO_DING) : itemTag(type, which, scale);
}

// ── Schillernder Gefährte als Gegenstand (F-97, 14.10.2026) ─────────────────
// Statt Gold Perlmutt mit demselben Holo wie das Tier (Wunsch des Nutzers: „soll
// auch in diesem Holo-Style sein“): helle, kühle Fläche nach der Helligkeit des
// Golds, die Kontur kühl statt goldbraun, darüber Regenbogen-Hauch, Glanz und
// schillernder Rand — etwas kräftiger als beim Tier, weil die Fläche keine eigene
// Farbe hat. Gilt überall, wo der goldene Gefährte als Gegenstand steht.
const _schillert = (type, mat) => type === 'gefaehrte' && mat === 'pp';
const HOLO_DING = { ton: 0.16, band: 0.28, bandTon: 0.55, rand: 0.45, randTon: 0.6, funkeln: false };   // Funkeln nur beim Tier
const _rgb = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const _hell = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const _misch = (a, b, t) => '#' + a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('');
const PERL = [_rgb('#8F86B0'), _rgb('#FBFAFF')], PERL_KONTUR = [_rgb('#2A2440'), _rgb('#5A5078')];
function _perlmutt(img, nur = null) {
  const col = img.col.slice();
  for (let i = 0; i < col.length; i++) {
    const c = col[i];
    if (!c || c.length !== 7 || (nur && !nur(i))) continue;
    const L = _hell(_rgb(c));
    col[i] = L < 0.3 ? _misch(...PERL_KONTUR, L / 0.3) : _misch(...PERL, Math.min(1, (L - 0.3) / 0.55));
  }
  return { w: img.w, h: img.h, col };
}
// Sonnen-Talisman und Kronenring (F-99): eigene, stärkere Gold-Bilder aus
// schmuck-gold.js statt der Gold-Sprites des Moduls — samt Teile-Karte für die
// fünf Schmiede-Schritte. Silber bleibt das Modul-Bild.
const _gold = (type, mat) => (mat === 'pp' ? goldSchmuck(type) : null);
// Rahmen zum Zuschneiden wie itemBounds im Modul: Vereinigung über alle
// Bauzustände und Glüh-Bilder, damit das Werkstück nie springt.
const _goldRahmen = new Map();
function _goldGrenzen(type, gs) {
  if (_goldRahmen.has(type)) return _goldRahmen.get(type);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const zu of ['ggggg', 'ngggg', 'bnggg', 'bbngg', 'bbbng', 'bbbbn', 'bbbbb']) for (let f = 0; f < PART_ANIM.frames; f++) {
    const im = composeParts(gs.img, gs.pm, zu, f);
    im.col.forEach((c, i) => { if (!c) return; const x = i % im.w, y = (i / im.w) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; });
  }
  const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  _goldRahmen.set(type, box);
  return box;
}
// Bild {w, h, col} ganzzahlig vergrößert auf eine Leinwand.
function _leinwand(img, s) {
  const c = document.createElement('canvas');
  c.width = img.w * s; c.height = img.h * s;
  const x = c.getContext('2d');
  img.col.forEach((v, i) => { if (v) { x.fillStyle = v; x.fillRect((i % img.w) * s, Math.floor(i / img.w) * s, s, s); } });
  return c;
}

// ── Schmiede: 5 Teile ───────────────────────────────────────────────────────
// Anzeige-Maßstab je Objektart (FORGE_PANEL). Das Modul gibt dem Gefährten 3×
// (petScale) — er ist aber nur 28 × 31 groß wie Ring und Talisman und wirkte daneben
// winzig (Nutzer 14.10.2026), darum bekommen alle Werkstücke 4× (112 × 124 passt in
// die 176 hohe Fläche).
export const forgeScale = () => FORGE_PANEL.weaponScale;

/**
 * Werkstück mit Teile-Zuständen. `fertig` = Zahl der fertigen Teile (0–5);
 * das Teil danach glüht, der Rest bleibt grau. `bild` läuft 0–3 im 4-fps-Takt.
 */
export function forgeTag(type, which, fertig, bild = 0, scale = null) {
  const mat = material(which);
  const s = Math.max(1, Math.round(scale ?? forgeScale(type)));
  const zu = partStates(fertig);
  // Ein unbegonnenes Werkstück steht still — der Glühzustand und der schillernde
  // Gefährte haben mehrere Bilder. Ein fertiges glänzt alle 4 s einmal auf (Bilder
  // 0–3 von 16 des Schmiede-Takts, sonst still; nicht bei „Bewegung reduzieren“).
  const f = zu.includes('n') || _schillert(type, mat) ? (bild % PART_ANIM.frames) : 0;
  const g = zu === 'bbbbb' && !_schillert(type, mat) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? bild % (PART_ANIM.frames * 4) : -1;
  const glanz = g >= 0 && g < PART_ANIM.frames ? g : -1;
  return _hole(`fp:${type}:${mat}:${zu}:${f}:${glanz}:${s}`, () => {
    const b = werkstueckBild(type, mat, zu, f, true, glanz);
    return b ? _tag(_leinwand(b, s)) : null;
  });
}

// ── Das Teil in Arbeit deutlich hervorheben (Wunsch des Nutzers 14.10.2026) ──
// Das Modul mischt das glühende Teil nur zu 30–64 % Richtung Orange und setzt
// drei Funken-Pixel in freie Stellen — bei goldenen Teilen und Teilen mitten im
// Werkstück sah man davon kaum etwas. Darüber jetzt je Bild: rot → orange →
// weißglühend → orange (helle Stellen glühen heller), ein glühender Rand in den
// freien Pixeln ums Teil und kleine Funken-Kreuze ringsum, die je Bild springen
// (lieber in freie Pixel, sonst vor das Werkstück, nie auf das glühende Teil).
// Zusammengesetzt wird weiter mit dem Modul (itemPartsImage + itemBounds +
// cropImage, genau wie itemPartsCanvasTrimmed); kein opacity, kein grayscale.
const GLUT = [_rgb('#B8321A'), _rgb('#FF7A2A'), _rgb('#FFE9A8')];   // rot, orange, weißglühend
const GLUT_STAERKE = [0.3, 0.55, 0.78, 0.55];
const GLUT_RAND = [null, '#FF9A3A', '#FFD86A', '#FF9A3A'];
const FUNKEN = [[], [0, 1, 6], [2, 3, 4, 5], [6, 7, 0]];   // welche Orte je Bild
const _mischRgb = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const _alsHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
// Fertiges Werkstück (Wunsch des Nutzers 14.10.2026: „sichtbar, dass es fertig
// ist, nicht übertrieben“): ein heller Glanz läuft in vier Bildern schräg über die
// Fläche wie über poliertes Metall; die Kontur bleibt.
const GLANZ_LICHT = _rgb('#FFF8E6');
function _glanzBand(col, w, box, g) {
  const von = box.x + box.y - 3, bis = box.x + box.w + box.y + box.h + 3;
  const mitte = von + (bis - von) * (g + 0.5) / PART_ANIM.frames;
  for (let i = 0; i < col.length; i++) {
    const c = col[i];
    if (!c || c.length !== 7) continue;
    const x = i % w, y = (i / w) | 0, u = Math.abs(x + y - mitte) / 3.5;
    if (u >= 1) continue;
    const rgb = _rgb(c);
    if (_hell(rgb) < 0.3) continue;                                       // Kontur bleibt
    col[i] = _alsHex(_mischRgb(rgb, GLANZ_LICHT, 0.62 * (0.5 + 0.5 * Math.cos(Math.PI * u))));
  }
  // dazu ein kleiner Funke rechts oben: Bild 1 und 3 ein Pixel, Bild 2 ein Kreuz
  const gr = [0, 1, 2, 1][g];
  if (!gr) return;
  let x1 = -1, y0 = 1e9;
  for (let i = 0; i < col.length; i++) if (col[i]) { const x = i % w, y = (i / w) | 0; if (x > x1) x1 = x; if (y < y0) y0 = y; }
  const frei = (x, y) => x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h && !col[y * w + x];
  let ort = null, bd = 1e9;
  for (let y = box.y + 1; y < box.y + box.h - 1; y++) for (let x = box.x + 1; x < box.x + box.w - 1; x++) {
    let ok = true, nah = false;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!frei(x + dx, y + dy)) { ok = false; break; }
    if (!ok) continue;
    for (let dy = -2; dy <= 2 && !nah; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && col[Y * w + X]) { nah = true; break; } }
    const d = (x - x1 - 1) ** 2 + (y - y0 - 1) ** 2;
    if (nah && d < bd) { bd = d; ort = [x, y]; }
  }
  if (!ort) return;
  const [fx, fy] = ort;
  col[fy * w + fx] = gr === 2 ? '#ffffff' : '#ffe9a8';
  if (gr === 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) col[(fy + dy) * w + fx + dx] = '#ffd86a';
}
/** Werkstück als {w, h, col}: Teile-Zustände aus dem Modul, glühendes Teil kräftig. zuschneiden = wie itemPartsCanvasTrimmed; glanz 0–3 = Glanz über das fertige Stück. */
export function werkstueckBild(type, mat, zu, f, zuschneiden = true, glanz = -1) {
  const gs = _gold(type, mat);
  const roh = gs ? composeParts(gs.img, gs.pm, zu, f) : itemPartsImage(type, mat, zu, f);
  if (!roh) return null;
  const { w, h } = roh, pm = gs ? gs.pm : partMap(type);
  const box = gs ? _goldGrenzen(type, gs) : (itemBounds(type, mat) || { x: 0, y: 0, w, h });
  let col = roh.col.slice();
  const istN = (i) => pm[i] >= 0 && zu[pm[i]] === 'n';
  if (_schillert(type, mat)) {
    const istB = (i) => pm[i] >= 0 && zu[pm[i]] === 'b';
    // Fertig funkelt er wie das Tier (Wunsch des Nutzers 14.10.2026, Reiter „Formen“) —
    // nur im Zuschnitt-Rahmen; beim Schmieden nicht, da sprühen die Schmiede-Funken.
    const fertig = zu === 'bbbbb';
    const holo = holoBild(_perlmutt({ w, h, col }, istB), f, fertig ? { ...HOLO_DING, funkeln: true, rahmen: box } : HOLO_DING).col;
    col = col.map((v, i) => (istB(i) || (fertig && !v && holo[i]) ? holo[i] : v));
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) {
    if (!istN(i) || !col[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    const c = _rgb(col[i]), L = _hell(c);
    const ziel = f === 0 ? GLUT[0] : _mischRgb(GLUT[1], GLUT[2], f === 2 ? Math.min(1, 0.4 + L) : L * 0.5);
    col[i] = _alsHex(_mischRgb(c, ziel, GLUT_STAERKE[f]));
  }
  if (x1 >= 0) {
    const imBild = (x, y) => x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h;
    const leer = (x, y) => imBild(x, y) && !col[y * w + x];
    if (GLUT_RAND[f]) {
      const rand = [];
      for (let i = 0; i < w * h; i++) {
        if (!istN(i) || !roh.col[i]) continue;
        const x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (leer(x + dx, y + dy)) rand.push((y + dy) * w + x + dx);
      }
      rand.forEach((j) => { col[j] = GLUT_RAND[f]; });
    }
    const frei = (x, y) => imBild(x, y) && !istN(y * w + x);
    const kl = (v, a, b) => Math.max(a, Math.min(b, v));
    const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
    const orte = [[x0 - 3, y0 - 2], [x1 + 3, y1 + 2], [x1 + 3, y0 - 2], [x0 - 3, y1 + 2], [cx, y0 - 4], [cx, y1 + 4], [x0 - 4, cy], [x1 + 4, cy]]
      .map(([x, y]) => [kl(x, box.x + 1, box.x + box.w - 2), kl(y, box.y + 1, box.y + box.h - 2)]);
    for (const k of FUNKEN[f]) {
      const [x, y] = orte[k];
      if (!frei(x, y)) continue;
      col[y * w + x] = '#FFF6C8';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (frei(x + dx, y + dy)) col[(y + dy) * w + x + dx] = '#FFC23A';
    }
  }
  if (glanz >= 0) _glanzBand(col, w, box, glanz);
  const bild = { w, h, col };
  return zuschneiden ? cropImage(bild, box) : bild;
}

/**
 * Unbegonnenes Werkstück (5.1 „Noch nicht begonnen", Referenz-Sprite PGt_…):
 * alle fünf Teile im Zustand „offen" (grau) — kein Graufilter, sondern die
 * Teile-Zustände von itemPartsCanvasTrimmed (Schmiede-Regel).
 */
export function forgeGrauTag(type, scale = 2) {
  const s = Math.max(1, Math.round(scale));
  return _hole(`fg:${type}:${s}`, () => _tag(itemPartsCanvasTrimmed(type, 'past', 'ggggg', 0, s)));
}

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
 * Kampfplatz als fertiges Bild (Update 1, `arena/A_*.png`, 2560 × 720) — nie
 * skaliert: fest im Maßstab 2, unten mittig (CSS `.cf-kulisse`). Ein breiteres
 * oder höheres Fenster zeigt einfach mehr Landschaft; am Handy (402 × 874) ist es
 * genau der bisherige Ausschnitt aus ARENAS (mittlere 201 × 437 unten).
 */
export function arenaTag(key) {
  const k = ARENAS[key] ? key : ARENA_KEYS[0];
  return `<img class="cf-kulisse" src="arena/A_${k}.png" width="5120" height="1440" alt="" draggable="false">`;
}

// ── Lagerfeuer ──────────────────────────────────────────────────────────────
/** Lagerfeuer, statisch (Bild 0) oder ein bestimmtes Bild der 8-fps-Folge. */
export function campfireTag(bild = null, scale = 2) {
  const s = Math.max(1, Math.round(scale));
  const i = bild == null ? -1 : ((bild % CAMPFIRE_FRAMES.length) + CAMPFIRE_FRAMES.length) % CAMPFIRE_FRAMES.length;
  return _hole(`cf:${i}:${s}`, () => _tag(spriteToCanvas(i < 0 ? CAMPFIRE : CAMPFIRE_FRAMES[i], s)));
}
