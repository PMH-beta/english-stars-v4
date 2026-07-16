// src/modules/avatar.js
// Charakter-Avatar in LO-FI PIXEL ART (moderner Indie-Stil à la Celeste /
// Hyper Light Drifter): 64×96-Sprite-Raster, shape-rendering:crispEdges,
// ganzzahlige Pixel, KEIN Anti-Aliasing.
//
// Stilregeln (Art-Direction):
// - minimalistisch: Augen als 2–4px-Punkte, Mund/Nase nur angedeutet
// - großer Kopf (~1/3 der Höhe), einfache Gliedmaßen, weiche Silhouetten
// - Flat Shading: max. 3 Helligkeitsstufen pro Fläche, Schatten per Dithering
// - 1px-Outline im DUNKLEREN TON der Füllfarbe (keine schwarzen Outlines)
// - Kleidung in ECHTEN Farben (Oberteil/Hose sind wählbare Merkmale)
//
// Datenmodell: SD.avatar = {skin,hair,eyes,nose,mouth,ears,build,top,pants}
// (je 0..19) + Gefährte {pet,petEars,petTail,petEyes,petPattern,petColor}
// (je 0..9). API avatarSVG/renderAvatarInto kompatibel — kein Sync-Umbau.

import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';

// Reihenfolge + Beschriftung der Einstell-Zeilen; anchor = vertikale Position der
// Pfeile (% der Sprite-Höhe, 96 Rasterzeilen) am jeweils veränderten Körperteil.
export const AVATAR_FEATURES = [
  { key: 'hair',      icon: '💇', label: 'Haare',     anchor: 8 },
  { key: 'hairColor', icon: '🎨', label: 'Haarfarbe', anchor: 8 },
  { key: 'eyes',  icon: '👀', label: 'Augen',     anchor: 25 },
  { key: 'ears',  icon: '👂', label: 'Ohren',     anchor: 28 },
  { key: 'nose',  icon: '👃', label: 'Nase',      anchor: 31 },
  { key: 'mouth', icon: '👄', label: 'Mund',      anchor: 36 },
  { key: 'skin',  icon: '🖐️', label: 'Hautfarbe', anchor: 50 },
  { key: 'top',   icon: '👕', label: 'Oberteil',  anchor: 58 },
  { key: 'pants', icon: '👖', label: 'Hose',      anchor: 80 },
  { key: 'build', icon: '🧍', label: 'Statur',    anchor: 70 },
];

// Gefährten-Merkmale (eigene Leiste, wenn der Gefährte angewählt ist).
export const PET_FEATURES = [
  { key: 'pet',        icon: '🐾', label: 'Tier' },
  { key: 'petEars',    icon: '👂', label: 'Ohren' },
  { key: 'petTail',    icon: '➰', label: 'Schwanz' },
  { key: 'petEyes',    icon: '👀', label: 'Augen' },
  { key: 'petPattern', icon: '🎨', label: 'Muster' },
  { key: 'petColor',   icon: '🌈', label: 'Farbe' },
];

// Varianten pro Merkmal: Charakter je 20, Gefährten-Teile je 10.
const COUNTS = {
  skin: 20, hair: 20, hairColor: 20, eyes: 20, ears: 20, nose: 20, mouth: 20,
  build: 20, top: 20, pants: 20,
  pet: 10, petEars: 10, petTail: 10, petEyes: 10, petPattern: 10, petColor: 10,
};

// 16 natürliche Hauttöne + 4 Fantasie-Töne (Kinder-App: darf Spaß machen).
const SKIN = [
  '#FFE4CC','#FFD9B8','#F7CEA6','#F0C193','#EEB98A','#E4AC79','#E0A26B','#D69660',
  '#CC8A52','#C07E49','#B27440','#A0683A','#965E31','#7C4A26','#5E3719','#4A2B12',
  '#A8D8A8','#A8C4E8','#C9AEE6','#9AA7B8',
];
// Graustufen für neutrale Details (Griffe, Ketten, gesperrte Vorschau).
const G = ['#e8e8e8','#c4c4c4','#9a9a9a','#6e6e6e','#4a4a4a','#2c2c2c'];
const GOLD = '#e3b341';
const INK = '#2c2c34';   // Augen/Mund-Tinte (dunkles Blaugrau statt Schwarz)

export function defaultAvatar() {
  return {
    skin: 0, build: 4, hair: 0, hairColor: 5, eyes: 0, nose: 0, mouth: 0, ears: 2,
    top: 0, pants: 0,
    pet: 0, petEars: 0, petTail: 0, petEyes: 0, petPattern: 0, petColor: 0,
  };
}

// Stellt sicher, dass sd.avatar existiert und alle Keys gültig sind.
export function ensureAvatar(sd) {
  const d = defaultAvatar();
  const a = (sd && typeof sd.avatar === 'object' && sd.avatar) ? sd.avatar : {};
  const out = {};
  for (const k of Object.keys(d)) {
    const v = Number(a[k]);
    out[k] = (Number.isInteger(v) && v >= 0 && v < COUNTS[k]) ? v : d[k];
  }
  if (sd) sd.avatar = out;
  return out;
}

const wrapK = (key, n) => ((n % COUNTS[key]) + COUNTS[key]) % COUNTS[key];

// ────────────────────────────────────────────────
//  PIXEL-HELFER
// ────────────────────────────────────────────────
const px = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
// Dunklerer/hellerer Ton einer Füllfarbe (für Outlines/Shading — NIE schwarz).
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
// Weiche Silhouette: Rechteck mit 1px eingerückten Ecken (oben/unten).
function soft(x, y, w, h, c) {
  if (w < 3 || h < 3) return px(x, y, w, h, c);
  return px(x + 1, y, w - 2, 1, c) + px(x, y + 1, w, h - 2, c) + px(x + 1, y + h - 1, w - 2, 1, c);
}
function softO(x, y, w, h, c) {
  return soft(x - 1, y - 1, w + 2, h + 2, shade(c, 0.62)) + soft(x, y, w, h, c);
}
// Rundere Silhouette (2px-Eckstufen) für große Flächen auf dem 64er-Raster.
function round(x, y, w, h, c) {
  if (w < 6 || h < 6) return soft(x, y, w, h, c);
  return px(x + 2, y, w - 4, 1, c) + px(x + 1, y + 1, w - 2, 1, c)
    + px(x, y + 2, w, h - 4, c)
    + px(x + 1, y + h - 2, w - 2, 1, c) + px(x + 2, y + h - 1, w - 4, 1, c);
}
function roundO(x, y, w, h, c) {
  return round(x - 1, y - 1, w + 2, h + 2, shade(c, 0.62)) + round(x, y, w, h, c);
}
// Dithering (Schachbrett) — die dritte Helligkeitsstufe einer Fläche.
function dith(x, y, w, h, c) {
  let s = '';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((x + i + y + j) % 2 === 0) s += px(x + i, y + j, 1, 1, c);
  return s;
}
// Hohles Rechteck (Brillengestelle).
function frame(x, y, w, h, c) {
  return px(x, y, w, 1, c) + px(x, y + h - 1, w, 1, c) + px(x, y + 1, 1, h - 2, c) + px(x + w - 1, y + 1, 1, h - 2, c);
}
// Mini-Pixelziffern (3×5) für Trikots.
const DIGITS = {
  '0': ['111','101','101','101','111'],
  '1': ['010','110','010','010','111'],
  '7': ['111','001','010','010','010'],
};
function glyph(x, y, str, c) {
  let s = '';
  [...str].forEach((ch, gi) => {
    const m = DIGITS[ch]; if (!m) return;
    m.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') s += px(x + gi * 4 + i, y + j, 1, 1, c); }));
  });
  return s;
}

// ── Kopf (~1/3 der Höhe): x20..43 / y14..41, runde Ecken, Licht von oben links ──
function headSVG(skin) {
  return roundO(20, 14, 24, 28, skin)
    + px(24, 16, 12, 1, shade(skin, 1.1))         // Stirn-Highlight
    + dith(38, 30, 4, 8, shade(skin, 0.88))       // rechte Wangen-Schattierung
    + px(25, 40, 14, 1, shade(skin, 0.92));       // Kinn-Schatten
}
function neckSVG(skin) {
  return px(28, 42, 8, 3, skin) + px(28, 45, 8, 1, shade(skin, 0.8));
}

// ── Ohren: seitliche Noppen [w, h, y, Ohrring?, spitz?]; null = keine ──
const EARS = [
  [2, 4, 26], [2, 6, 24], [4, 4, 26], [4, 6, 24], [2, 4, 28],
  [4, 4, 26, 1], null, [4, 8, 24], [2, 4, 24], [2, 6, 26, 1],
  [3, 5, 25], [3, 8, 23], [5, 5, 25], [3, 4, 26, 1], [4, 6, 24, 0, 1],
  [2, 4, 26, 0, 1], [4, 4, 28], [3, 6, 24, 1], [5, 7, 23], [2, 3, 27],
];
function earsSVG(i, skin) {
  const e = EARS[i];
  if (!e) return '';
  const [w, h, y, ring, point] = e;
  const d = shade(skin, 0.62);
  let s = '';
  s += px(20 - w, y, w, h, skin) + px(19 - w, y, 1, h, d);      // links + Außen-Outline
  s += px(44, y, w, h, skin) + px(44 + w, y, 1, h, d);          // rechts
  if (w >= 2 && h >= 3) {                                        // Ohrmuschel-Schatten
    s += px(20 - w, y + 1, 1, h - 2, shade(skin, 0.85)) + px(43 + w, y + 1, 1, h - 2, shade(skin, 0.85));
  }
  if (point) s += px(20 - w, y - 2, 1, 2, skin) + px(43 + w, y - 2, 1, 2, skin);   // Elfen-Spitze
  if (ring) s += px(20 - w, y + h, 1, 2, GOLD) + px(43 + w, y + h, 1, 2, GOLD);
  return s;
}

// ── Augen: kleine dunkle Punkte mit Glanz (Herzstück des Stils), y22..28 ──
function eyesSVG(i) {
  const d = INK, w = '#ffffff', f = '#4a4a52';
  const two = (lx, rx, y, ww, h) => px(lx, y, ww, h, d) + px(rx, y, ww, h, d);
  const happy = (x) => px(x, 26, 1, 1, d) + px(x + 1, 25, 2, 1, d) + px(x + 3, 26, 1, 1, d);
  switch (i) {
    case 0:  return two(26, 36, 24, 2, 4);                                    // Standard
    case 1:  return two(27, 37, 26, 2, 2);                                    // Punkte
    case 2:  return two(23, 38, 24, 2, 4);                                    // weit
    case 3:  return two(28, 34, 24, 2, 4);                                    // eng
    case 4:  return px(26, 24, 2, 4, d) + px(36, 26, 4, 2, d);                // Zwinkern
    case 5:  return happy(24) + happy(35);                                    // fröhlich zu
    case 6:  return two(24, 36, 24, 4, 1) + two(25, 37, 25, 2, 2);            // müde (Lid+Punkt)
    case 7:  return two(24, 36, 24, 4, 4) + px(24, 24, 1, 1, w) + px(36, 24, 1, 1, w);   // groß
    case 8:  return frame(22, 22, 8, 7, f) + frame(34, 22, 8, 7, f)           // Brille eckig
      + px(30, 25, 4, 1, f) + px(19, 25, 3, 1, f) + px(42, 25, 3, 1, f)
      + two(25, 37, 25, 2, 2);
    case 9:  return two(26, 36, 27, 2, 2);                                    // tief/verträumt
    case 10: return two(24, 36, 23, 4, 5) + px(25, 24, 1, 2, w) + px(37, 24, 1, 2, w);   // Kulleraugen
    case 11: return two(26, 36, 24, 2, 4)                                     // Wimpern
      + px(25, 22, 1, 1, d) + px(28, 22, 1, 1, d) + px(35, 22, 1, 1, d) + px(38, 22, 1, 1, d);
    case 12: return px(26, 24, 1, 3, GOLD) + px(25, 25, 3, 1, GOLD)           // Sternchen
      + px(37, 24, 1, 3, GOLD) + px(36, 25, 3, 1, GOLD);
    case 13: return px(22, 23, 9, 5, INK) + px(33, 23, 9, 5, INK)             // Sonnenbrille
      + px(31, 24, 2, 1, INK) + px(19, 24, 3, 1, INK) + px(42, 24, 3, 1, INK)
      + px(23, 24, 2, 1, '#6e6e78') + px(34, 24, 2, 1, '#6e6e78');
    case 14: return px(26, 24, 2, 4, d)                                       // Piraten-Klappe
      + px(35, 23, 5, 5, '#2e2e36') + px(23, 22, 12, 1, '#2e2e36') + px(40, 22, 4, 1, '#2e2e36');
    case 15: return px(24, 21, 3, 1, d) + px(27, 22, 2, 1, d)                 // wütend (Brauen)
      + px(37, 21, 3, 1, d) + px(35, 22, 2, 1, d) + two(26, 36, 24, 2, 3);
    case 16: return px(35, 20, 4, 1, d) + two(26, 36, 24, 2, 4);              // skeptische Braue
    case 17: return two(24, 36, 26, 4, 1);                                    // schlafend
    case 18: return frame(23, 22, 7, 7, f) + frame(34, 22, 7, 7, f)           // Brille rund
      + px(30, 25, 4, 1, f) + two(25, 37, 25, 2, 2);
    case 19: return two(26, 36, 24, 2, 4) + px(26, 24, 1, 1, w) + px(36, 24, 1, 1, w);   // funkelnd
  }
  return '';
}

// ── Nase: nur angedeutet (Hautton dunkler), viele Stufen fast unsichtbar ──
function noseSVG(i, skin) {
  const n = shade(skin, 0.82);
  switch (i) {
    case 0:  return '';                                       // keine (Stil-Standard)
    case 1:  return px(31, 30, 2, 2, n);
    case 2:  return px(30, 30, 4, 2, n);
    case 3:  return px(32, 28, 2, 4, n);
    case 4:  return px(30, 32, 4, 2, n);
    case 5:  return px(28, 30, 2, 2, n) + px(34, 30, 2, 2, n);
    case 6:  return px(31, 28, 2, 6, n);
    case 7:  return px(31, 28, 2, 2, n);
    case 8:  return px(30, 30, 4, 4, shade(skin, 0.9));
    case 9:  return px(32, 30, 2, 2, n);
    case 10: return px(31, 29, 2, 3, n) + px(30, 31, 1, 1, n);
    case 11: return px(30, 31, 4, 1, n);
    case 12: return px(31, 30, 2, 1, n) + px(30, 31, 4, 1, n);
    case 13: return px(31, 31, 2, 2, shade(skin, 1.12));      // heller Knopf
    case 14: return px(31, 27, 2, 5, shade(skin, 0.88));      // Nasenrücken
    case 15: return px(30, 30, 4, 2, shade(skin, 0.9)) + px(29, 31, 1, 1, n) + px(34, 31, 1, 1, n);
    case 16: return px(31, 31, 1, 1, n);
    case 17: return px(32, 29, 1, 3, n);
    case 18: return px(31, 32, 2, 1, n);                      // Stups
    case 19: return px(31, 30, 2, 2, n)                       // + Sommersprossen
      + px(27, 30, 1, 1, shade(skin, 0.75)) + px(29, 32, 1, 1, shade(skin, 0.75))
      + px(35, 30, 1, 1, shade(skin, 0.75)) + px(37, 32, 1, 1, shade(skin, 0.75));
  }
  return '';
}

// ── Mund: meist weggelassen bzw. minimal, y34..38 ──
function mouthSVG(i) {
  const d = INK, w = '#ffffff';
  const smile = () => px(28, 34, 1, 2, d) + px(35, 34, 1, 2, d) + px(29, 36, 6, 1, d);
  switch (i) {
    case 0:  return '';                                                       // keiner (Stil-Standard)
    case 1:  return px(30, 35, 4, 2, d);
    case 2:  return px(30, 35, 2, 2, d);
    case 3:  return smile();                                                  // Lächeln
    case 4:  return px(30, 34, 4, 4, d) + px(31, 36, 2, 1, '#c0505a');        // offen
    case 5:  return px(28, 35, 8, 2, d);                                      // breit
    case 6:  return px(28, 37, 2, 1, d) + px(34, 37, 2, 1, d) + px(30, 35, 4, 2, d);   // schmollend
    case 7:  return px(30, 37, 4, 2, d);                                      // tief
    case 8:  return px(32, 35, 4, 2, d);                                      // Smirk
    case 9:  return px(30, 35, 4, 2, d) + px(30, 37, 4, 1, '#c0687a');        // Lippe (2 Stufen)
    case 10: return px(28, 34, 8, 3, d) + px(29, 35, 6, 1, w);                // Lachen mit Zähnen
    case 11: return px(29, 34, 6, 2, d) + px(31, 36, 3, 2, '#e08bb0');        // Zunge raus
    case 12: return px(30, 34, 3, 3, d) + px(31, 35, 1, 1, '#c0505a');        // „Ooo"
    case 13: return px(28, 34, 8, 2, d) + px(29, 35, 2, 1, w) + px(33, 35, 2, 1, w);   // Zahnlücke
    case 14: return px(29, 35, 3, 1, d) + px(32, 36, 3, 1, d);                // schief
    case 15: return px(31, 35, 2, 2, d);                                      // pfeifen
    case 16: return px(27, 34, 1, 2, d) + px(36, 34, 1, 2, d) + px(28, 36, 8, 1, d);   // Grinsen breit
    case 17: return px(29, 36, 6, 1, d);                                      // ernst
    case 18: return px(31, 34, 2, 3, d);                                      // überrascht
    case 19: return smile() + px(24, 32, 3, 2, '#f2a9a9') + px(37, 32, 3, 2, '#f2a9a9');   // Lächeln + Blush
  }
  return '';
}

// ── Frisuren: Strähnen-Textur statt flacher Flächen, gezackter Pony,
//    auslaufende Spitzen. Die FARBE ist ein eigenes Merkmal (hairColor). ──
export const HAIR_COLORS = [
  '#1e1b1a', '#2b2b33', '#33302e', '#4a3423', '#5B3A1E', '#6B4423', '#7a4526', '#8a5a30',
  '#a04a28', '#C0502A', '#d97b29', '#D9B84A', '#E3C45A', '#f0dc82', '#c9ccd6', '#f2f0ea',
  '#e07ba8', '#8a5fc9', '#4a7fd1', '#3f9d4e',
];
// Additiver Aufheller — wirkt auch auf fast-schwarzen Farben (multiplikativ
// bliebe Schwarz schwarz und die Strähnen-Textur wäre unsichtbar).
function lift(hex, add) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.min(255, v + add);
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
// Strähnen: DICHTE Struktur — fast jede Spalte bekommt eine eigene Strähne in
// einem von drei Tönen, mit variierendem Start und variierender Länge. Keine
// flachen Farbflächen mehr, die Grundfläche blitzt nur noch dazwischen durch.
function strands(x, y, w, h, c) {
  if (w < 3 || h < 2) return '';
  let s = '';
  const dk = shade(c, 0.8), dk2 = shade(c, 0.68), lt = lift(c, 26);
  for (let i = 1; i < w; i += 2) {
    const v = (i * 7) % 3;                                    // 0..2 Variation je Spalte
    const o = v === 2 ? 2 : v;                                // Start-Versatz
    s += px(x + i, y + o, 1, Math.max(1, h - o - ((i * 5) % 3)), v === 1 ? dk2 : dk);
  }
  for (let i = 2; i < w; i += 5) s += px(x + i, y + ((i * 3) % 2), 1, Math.max(2, h - 3), lt);
  return s;
}
// Locken: dunkles Dither + dichte, versetzte helle Punkt-Reflexe (Kringel).
function curls(x, y, w, h, c) {
  let s = dith(x, y, w, h, shade(c, 0.8));
  const lt = lift(c, 28);
  for (let j = 0; j < h; j += 2) for (let i = 1 + ((j >> 1) % 2) * 2; i < w; i += 4) s += px(x + i, y + j, 1, 1, lt);
  return s;
}
function _capBase(c) {
  const d = shade(c, 0.62);
  return roundO(18, 6, 28, 12, c) + px(22, 7, 8, 1, shade(c, 1.22))
    + px(18, 17, 2, 7, c) + px(44, 17, 2, 7, c)          // Schläfenhaar bis zu den Ohren
    + px(19, 18, 1, 5, shade(c, 0.78)) + px(44, 18, 1, 5, shade(c, 0.78))   // Schläfen-Strähne
    + px(18, 24, 1, 2, c) + px(45, 24, 1, 2, c)          // Koteletten-Spitzen
    + px(17, 17, 1, 6, d) + px(46, 17, 1, 6, d);         // Outline außen
}
function _cap(c) { return _capBase(c) + strands(20, 8, 24, 8, c); }
// Gezackter Pony: abwechselnd 2/3px tiefe Zacken, jede Zacke mit eigener
// Schattenkante + einzelne Strähnchen-Spitzen.
function _fringe(c) {
  let s = '';
  const dk = shade(c, 0.78);
  for (let x = 20; x < 44; x += 3) {
    const h = (((x - 20) / 3) % 2 === 0) ? 3 : 2;
    s += px(x, 18, 3, h, c) + px(x + 2, 18, 1, h - 1, dk);
  }
  return s + px(22, 21, 1, 1, c) + px(31, 21, 1, 1, c) + px(40, 21, 1, 1, c);
}
// Herabfallende Haarpartie: gestufte Spalten mit unregelmäßig spitzem Auslauf,
// Outline NUR an der Außenkante — ersetzt die alten softO-„Kapseln", die mit
// Rundum-Outline wie Kopfhörer-Muscheln aussahen. outerLeft: Außenseite links.
function _fall(x, y, w, len, c, outerLeft) {
  let s = '';
  const d = shade(c, 0.62);
  const CUT = [5, 2, 0, 1, 3, 2, 4];                  // Spalten-Kürzung: außen kürzer
  for (let i = 0; i < w; i++) {
    const t = outerLeft ? i : w - 1 - i;              // 0 = Außenspalte
    s += px(x + i, y, 1, Math.max(3, len - CUT[t % 7]), c);
  }
  s += px(outerLeft ? x - 1 : x + w, y + 1, 1, Math.max(3, len - 8), d);
  return s + strands(x, y + 2, w, Math.max(2, len - 8), c);
}
// Seitliche Haarpartien beidseitig (fallen nahtlos aus der Kappe).
function _sides(c, len) {
  return _fall(15, 14, 5, len, c, true) + _fall(44, 14, 5, len, c, false);
}
function _braid(x, c, tie) {
  // Jedes Flecht-Segment mit eigenem Licht-/Schattenpixel (plastische Wülste).
  const seg = (yy, cc) => softO(x, yy, 4, 5, cc)
    + px(x + 1, yy + 1, 1, 2, shade(cc, 1.18)) + px(x + 2, yy + 2, 1, 2, shade(cc, 0.72));
  return seg(18, c) + seg(24, shade(c, 0.88)) + seg(30, c)
    + px(x + 1, 21, 2, 1, shade(c, 0.7)) + px(x + 1, 27, 2, 1, shade(c, 0.7))   // Flecht-Rillen
    + px(x + 1, 35, 2, 2, tie);
}
// Mittelscheitel: dunkle Scheitellinie + nach außen gelegter Pony (mit Strähnen).
function _part(c) {
  return px(31, 6, 2, 5, shade(c, 0.68))
    + px(20, 18, 10, 2, c) + px(20, 20, 5, 1, c) + strands(20, 18, 10, 2, c)
    + px(34, 18, 10, 2, c) + px(39, 20, 5, 1, c) + strands(34, 18, 10, 2, c);
}
const HAIR = [
  (c) => _cap(c) + _fringe(c),                                                             // 0 kurz
  (c) => [[20, 3, 3], [25, 2, 4], [30, 1, 5], [35, 2, 4], [40, 3, 3]].map(([sx, sy, sh]) =>
    px(sx, sy, 2, sh, c) + px(sx + 1, sy + 1, 1, sh - 1, shade(c, 0.75))
    + px(sx, sy, 1, 1, shade(c, 1.2))).join('') + _cap(c),                                 // 1 stachelig
  (c) => _cap(c) + _fringe(c) + _sides(c, 38),                                             // 2 lang
  (c) => _cap(c) + _fringe(c) + roundO(26, 0, 12, 6, c) + strands(27, 1, 10, 4, c)
    + px(26, 5, 12, 1, GOLD),                                                              // 3 Dutt
  (c) => _capBase(c) + px(19, 4, 4, 2, c) + px(25, 3, 4, 2, c) + px(31, 3, 4, 2, c)
    + px(37, 4, 4, 2, c) + px(20, 4, 1, 1, shade(c, 1.2)) + px(32, 3, 1, 1, shade(c, 1.2))
    + px(16, 14, 2, 8, c) + px(17, 15, 1, 6, shade(c, 0.75))
    + px(46, 14, 2, 8, c) + px(46, 15, 1, 6, shade(c, 0.75)) + curls(20, 8, 24, 9, c),     // 4 Locken
  null,                                                                                    // 5 Glatze
  (c) => roundO(17, 5, 30, 16, c) + px(21, 6, 8, 1, shade(c, 1.22)) + strands(19, 8, 26, 12, c)
    + _fall(15, 16, 4, 16, c, true) + _fall(45, 16, 4, 16, c, false),                      // 6 voll/wuschelig
  (c) => _cap(c) + _fringe(c) + _fall(46, 12, 5, 30, c, false)
    + px(46, 17, 5, 2, GOLD),                                                              // 7 Pferdeschwanz
  (c) => roundO(14, 0, 36, 20, c) + curls(16, 2, 32, 16, c)
    + _fall(14, 16, 4, 12, c, true) + curls(14, 17, 4, 9, c)
    + _fall(46, 16, 4, 12, c, false) + curls(46, 17, 4, 9, c),                             // 8 Afro
  (c) => _cap(c) + _fringe(c) + _sides(c, 56),                                             // 9 sehr lang
  (c) => _cap(c) + _fringe(c) + _braid(14, c, '#d94f4f') + _braid(46, c, '#d94f4f'),       // 10 Zöpfe
  (c) => soft(19, 9, 26, 4, '#55504a') + dith(20, 10, 24, 2, shade('#55504a', 1.2))
    + roundO(28, 0, 8, 16, c) + strands(28, 1, 8, 14, c),                                  // 11 Irokese
  (c) => roundO(16, 5, 32, 14, c) + px(21, 6, 10, 1, shade(c, 1.22)) + strands(18, 7, 28, 10, c)
    + _fall(15, 14, 5, 15, c, true) + _fall(44, 14, 5, 15, c, false)
    + px(20, 16, 24, 3, c) + strands(20, 16, 24, 3, c),                                    // 12 Bob
  (c) => _capBase(c) + curls(20, 8, 24, 8, c) + _fall(14, 14, 7, 27, c, true) + _fall(43, 14, 7, 27, c, false)
    + curls(15, 15, 5, 23, c) + curls(44, 15, 5, 23, c),                                   // 13 Locken lang
  (c) => soft(19, 10, 26, 5, '#5a5148') + dith(20, 11, 24, 3, shade('#5a5148', 1.22))
    + roundO(20, 3, 26, 9, c) + strands(21, 4, 24, 7, c)
    + px(44, 6, 3, 3, c) + px(45, 7, 1, 2, shade(c, 0.75)) + px(23, 4, 10, 1, shade(c, 1.2)),   // 14 Undercut
  (c) => _cap(c) + _part(c),                                                               // 15 Mittelscheitel kurz
  (c) => _cap(c) + _part(c) + _sides(c, 52),                                               // 16 Mittelscheitel lang
  (c) => roundO(16, 3, 32, 16, c) + curls(18, 5, 28, 12, c)
    + px(15, 8, 1, 4, c) + px(48, 8, 1, 4, c) + px(19, 2, 3, 1, c) + px(30, 1, 4, 1, c)
    + px(42, 2, 3, 1, c),                                                                  // 17 Wuschelkopf
  (c) => _cap(c) + _fringe(c)
    + px(18, 13, 28, 1, shade('#d94f4f', 0.7)) + px(18, 14, 28, 2, '#d94f4f'),             // 18 Stirnband
  (c) => _cap(c) + _fringe(c)
    + softO(43, 16, 4, 6, c) + px(44, 17, 1, 2, shade(c, 1.18)) + px(45, 19, 1, 2, shade(c, 0.72))
    + softO(42, 23, 4, 6, shade(c, 0.88)) + px(43, 24, 1, 2, shade(c, 1.1)) + px(44, 26, 1, 2, shade(c, 0.68))
    + softO(41, 30, 4, 6, c) + px(42, 31, 1, 2, shade(c, 1.18)) + px(43, 33, 1, 2, shade(c, 0.72))
    + px(42, 36, 2, 3, '#4a7fd1'),                                                         // 19 Seitenzopf
];
function hairSVG(i, colIdx) {
  const draw = HAIR[i];
  if (!draw) return '';
  return draw(HAIR_COLORS[colIdx] || HAIR_COLORS[5]);
}

// ── Rückenhaar: eigene Ebene HINTER Hals/Körper (wird als erste Schicht
//    gezeichnet) — schließt bei langen Frisuren die Lücke am Nacken.
//    Leicht abgedunkelt (liegt im Schatten), Zack-Saum unten, Strähnen/Locken
//    im sichtbaren Bereich unterhalb des Kopfes. ──
function _back(c, bottom, curly) {
  const b = shade(c, 0.9), d = shade(c, 0.62);
  let s = px(17, 14, 30, bottom - 14, b)
    + px(16, 16, 1, bottom - 18, d) + px(47, 16, 1, bottom - 18, d)
    // seitlich sichtbare Ränder (neben dem Kopf) mit Strähnen statt Fläche
    + strands(17, 17, 3, bottom - 20, b) + strands(44, 17, 3, bottom - 20, b);
  for (let x = 17; x < 47; x += 3) s += px(x, bottom, 3, (((x - 17) / 3) % 2 === 0) ? 2 : 1, b);
  const texH = bottom - 43;
  if (texH >= 3) s += curly ? curls(18, 42, 28, texH, b) : strands(18, 42, 28, texH, b);
  return s;
}
const HAIR_BACK = {
  2:  (c) => _back(c, 54),         // lang
  9:  (c) => _back(c, 72),         // sehr lang
  13: (c) => _back(c, 50, true),   // Locken lang
  16: (c) => _back(c, 68),         // Mittelscheitel lang
};
function hairBackSVG(i, colIdx) {
  const f = HAIR_BACK[i];
  return f ? f(HAIR_COLORS[colIdx] || HAIR_COLORS[5]) : '';
}

// ── Körper / Statur ──
// SH = halbe Schulterbreite, HIP = halbe Hüfte, LW = Beinbreite (20 Stufen).
const BUILD = {
  SH:  [9, 10, 10, 11, 11, 12, 13, 13, 14, 14, 15, 15, 16, 17, 17, 18, 18, 19, 19, 20],
  HIP: [7,  8,  8,  9,  9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16, 17],
  LW:  [5,  5,  6,  6,  6,  7,  7,  7,  8,  8,  8,  9,  9,  9, 10, 10, 10, 11, 11, 12],
};

// ── Oberteile: echte Farben, style steuert Details/Ärmellänge ──
// style: tee|long|hoodie|stripes|pull|print|trikot|zip|hemd|rainbow|camo|strick
const TOPS = [
  { c: '#d94f4f', style: 'tee' },                                   // 0 T-Shirt rot
  { c: '#4a7fd1', style: 'long' },                                  // 1 Longsleeve blau
  { c: '#3f9d4e', style: 'hoodie' },                                // 2 Hoodie grün
  { c: '#e3c14f', c2: '#ffffff', style: 'stripes' },                // 3 Streifen gelb-weiß
  { c: '#8a5fc9', style: 'pull' },                                  // 4 Rollkragen lila
  { c: '#e08a3a', c2: '#ffffff', style: 'print', print: 'star' },   // 5 T-Shirt Stern
  { c: '#3ab5b0', c2: '#ffffff', style: 'trikot', nr: '7' },        // 6 Trikot 7
  { c: '#e08bb0', c2: '#ffffff', style: 'print', print: 'heart' },  // 7 T-Shirt Herz
  { c: '#8a8f9a', style: 'zip' },                                   // 8 Zip-Jacke grau
  { c: '#f2f0ea', style: 'hemd' },                                  // 9 Hemd weiß
  { c: '#33456e', style: 'hoodie' },                                // 10 Hoodie dunkelblau
  { c: '#d94f4f', c2: '#ffffff', style: 'stripes' },                // 11 Streifen rot-weiß
  { c: '#7bd0b5', style: 'long' },                                  // 12 Longsleeve mint
  { c: '#2e2e36', c2: '#ffffff', style: 'print', print: 'star' },   // 13 Band-Shirt
  { c: '#9a6b3f', style: 'strick' },                                // 14 Strickpulli
  { c: '#e8d44f', style: 'zip' },                                   // 15 Regenjacke gelb
  { c: '#d94f4f', style: 'rainbow' },                               // 16 Regenbogen
  { c: '#5e7a4a', style: 'camo' },                                  // 17 Camo
  { c: '#e3b341', c2: '#ffffff', style: 'trikot', nr: '10' },       // 18 Trikot 10
  { c: '#c9aee6', style: 'hoodie' },                                // 19 Hoodie lavendel
];
const SHORT_SLEEVE = new Set(['tee', 'stripes', 'print', 'trikot', 'rainbow', 'camo']);

// ── Hosen: style lang|shorts|rock, plus Detail-Extras; Schuhfarbe je Hose ──
const PANTS = [
  { c: '#4a6a9d', style: 'lang',   shoe: '#2c2c34' },                    // 0 Jeans
  { c: '#d94f4f', style: 'shorts', shoe: '#f2f0ea' },                    // 1 Shorts rot + Sneaker
  { c: '#8a8f9a', style: 'lang',   shoe: '#2c2c34', side: '#ffffff' },   // 2 Jogger Streifen
  { c: '#2e2e36', style: 'lang',   shoe: '#2c2c34' },                    // 3 schwarz
  { c: '#3f9d4e', style: 'shorts', shoe: '#8a5a30' },                    // 4 Shorts grün
  { c: '#e08bb0', style: 'rock',   shoe: '#2c2c34' },                    // 5 Rock rosa
  { c: '#6b4a8a', style: 'lang',   shoe: '#2c2c34', dots: 1 },           // 6 lila Punkte
  { c: '#8a5a30', style: 'lang',   shoe: '#2c2c34', patch: '#e3c14f' },  // 7 braun Flicken
  { c: '#3ab5b0', style: 'lang',   shoe: '#f2f0ea', side: '#ffffff' },   // 8 Sporthose
  { c: '#33456e', style: 'shorts', shoe: '#2c2c34' },                    // 9 Jeans-Shorts
  { c: '#e3c14f', style: 'shorts', shoe: '#f2f0ea' },                    // 10 Shorts gelb
  { c: '#4a7fd1', style: 'rock',   shoe: '#2c2c34' },                    // 11 Rock blau
  { c: '#9aa0ab', style: 'lang',   shoe: '#2c2c34', cargo: 1 },          // 12 Cargo
  { c: '#d97b29', style: 'lang',   shoe: '#2c2c34' },                    // 13 orange
  { c: '#2e6e4e', style: 'lang',   shoe: '#8a5a30' },                    // 14 tannengrün
  { c: '#f2f0ea', style: 'lang',   shoe: '#d94f4f' },                    // 15 weiß + rote Schuhe
  { c: '#c9aee6', style: 'shorts', shoe: '#f2f0ea' },                    // 16 Shorts lavendel
  { c: '#5e5e66', style: 'lang',   shoe: '#2c2c34', side: '#2c2c34' },   // 17 grau Nadelstreifen
  { c: '#a04a28', style: 'lang',   shoe: '#2c2c34' },                    // 18 rostrot
  { c: '#e8d44f', style: 'shorts', shoe: '#2c2c34', dots: 1 },           // 19 Shorts gelb Punkte
];

// Arme: Ärmel (lang bis y61, kurz bis y53) + Haut + Hände; Outline außen.
function armsSVG(SH, skin, top) {
  const alx = 32 - SH - 4, arx = 32 + SH;
  const c = top.c, short = SHORT_SLEEVE.has(top.style);
  const sleeveH = short ? 8 : 16;
  const skinD = shade(skin, 0.7), cD = shade(c, 0.62);
  let s = '';
  for (const [x, ox] of [[alx, alx - 1], [arx, arx + 4]]) {
    s += px(x, 46, 4, sleeveH, c) + px(ox, 46, 1, sleeveH, cD)
      + px(x, 45 + sleeveH, 4, 1, shade(c, 0.75));                     // Ärmelsaum
    if (short) s += px(x, 54, 4, 8, skin) + px(ox, 54, 1, 8, skinD);   // Unterarm Haut
    s += px(x, 62, 4, 4, skin) + px(ox, 62, 1, 4, skinD)               // Hand
      + px(x, 65, 4, 1, shade(skin, 0.85));
  }
  return s;
}

// Oberteil-Details über dem Torso-Grundkörper.
function topDetails(top, SH) {
  const c = top.c, c2 = top.c2 || '#ffffff';
  const L = 32 - SH, W = SH * 2;
  let s = '';
  switch (top.style) {
    case 'stripes':
      s += px(L + 1, 50, W - 2, 2, c2) + px(L + 1, 55, W - 2, 2, c2) + px(L + 1, 60, W - 2, 2, c2);
      break;
    case 'hoodie':
      s += px(26, 44, 12, 3, shade(c, 0.8))                            // Kapuze hinterm Hals
        + px(29, 48, 1, 4, c2) + px(34, 48, 1, 4, c2)                  // Kordeln
        + px(L + 3, 60, W - 6, 6, shade(c, 0.9))                       // Bauchtasche
        + px(L + 3, 60, W - 6, 1, shade(c, 0.7));
      break;
    case 'pull':
      s += px(27, 44, 10, 3, c) + px(27, 44, 10, 1, shade(c, 0.75));   // Rollkragen
      break;
    case 'print':
      if (top.print === 'star') {
        s += px(31, 51, 2, 1, c2) + px(30, 52, 4, 2, c2) + px(29, 54, 6, 1, c2) + px(30, 55, 4, 1, c2)
          + px(29, 56, 2, 1, c2) + px(33, 56, 2, 1, c2);
      } else {
        s += px(29, 51, 2, 2, c2) + px(33, 51, 2, 2, c2) + px(29, 52, 6, 2, c2)
          + px(30, 54, 4, 1, c2) + px(31, 55, 2, 1, c2);
      }
      break;
    case 'trikot':
      s += glyph(top.nr.length > 1 ? 28 : 30, 51, top.nr, c2)
        + px(L + 1, 47, 2, 4, c2) + px(L + W - 3, 47, 2, 4, c2);       // Schulterstreifen
      break;
    case 'zip':
      s += px(31, 46, 2, 20, shade(c, 0.7)) + px(31, 50, 2, 1, '#e3e3e3')   // Reißverschluss
        + px(L + 2, 58, 3, 3, shade(c, 0.8)) + px(L + W - 5, 58, 3, 3, shade(c, 0.8));   // Taschen
      break;
    case 'hemd':
      s += px(31, 49, 1, 2, '#4a4a52') + px(31, 54, 1, 2, '#4a4a52') + px(31, 59, 1, 2, '#4a4a52')   // Knöpfe
        + px(28, 46, 3, 2, shade(c, 0.85)) + px(33, 46, 3, 2, shade(c, 0.85));                        // Kragen
      break;
    case 'rainbow': {
      const R = ['#e08a3a', '#e3c14f', '#3f9d4e', '#4a7fd1'];
      R.forEach((rc, k) => { s += px(L + 1, 50 + k * 4, W - 2, 4, rc); });
      break;
    }
    case 'camo':
      s += dith(L + 2, 48, 5, 4, shade(c, 0.7)) + dith(30, 55, 6, 5, shade(c, 0.7))
        + dith(L + W - 7, 49, 4, 4, shade(c, 1.25));
      break;
    case 'strick':
      s += dith(L + 1, 48, W - 2, 18, shade(c, 0.88));
      break;
  }
  return s;
}

// Beine + Schuhe je Hosen-Stil.
function legsSVG(HIP, LW, skin, p) {
  const lx1 = 32 - HIP, lx2 = 32 + HIP - LW;
  const pc = p.c, pcD = shade(pc, 0.7), skinD = shade(skin, 0.7);
  let s = '';
  if (p.style === 'rock') {
    // A-Linien-Rock: gerade Stufen statt runder Wölbungen.
    s += px(32 - HIP, 70, HIP * 2, 3, pc)
      + px(32 - HIP - 1, 73, HIP * 2 + 2, 3, pc)
      + px(32 - HIP - 2, 76, HIP * 2 + 4, 2, pc)
      + px(32 - HIP - 1, 70, 1, 3, pcD) + px(32 + HIP, 70, 1, 3, pcD)
      + px(32 - HIP - 2, 73, 1, 3, pcD) + px(32 + HIP + 1, 73, 1, 3, pcD)
      + px(32 - HIP - 3, 76, 1, 2, pcD) + px(32 + HIP + 2, 76, 1, 2, pcD)
      + px(32 - HIP, 70, HIP * 2, 1, shade(pc, 0.8))                   // Bund
      + px(32 - HIP - 2, 78, HIP * 2 + 4, 1, shade(pc, 0.85))          // Saum
      + px(lx1, 79, LW, 11, skin) + px(lx1 - 1, 79, 1, 11, skinD)
      + px(lx2, 79, LW, 11, skin) + px(lx2 + LW, 79, 1, 11, skinD);
  } else {
    // Hüfte: gerade Kanten (keine runden Wölbungen), Bund als dunkle Linie.
    s += px(32 - HIP, 70, HIP * 2, 6, pc)
      + px(32 - HIP - 1, 70, 1, 6, pcD) + px(32 + HIP, 70, 1, 6, pcD)
      + px(32 - HIP, 70, HIP * 2, 1, shade(pc, 0.8));
    const legH = p.style === 'shorts' ? 6 : 14;
    s += px(lx1, 76, LW, legH, pc) + px(lx1 - 1, 76, 1, legH, pcD);
    s += px(lx2, 76, LW, legH, pc) + px(lx2 + LW, 76, 1, legH, pcD);
    if (p.style === 'shorts') {
      s += px(lx1, 81, LW, 1, shade(pc, 0.8)) + px(lx2, 81, LW, 1, shade(pc, 0.8))   // Saum
        + px(lx1, 82, LW, 8, skin) + px(lx1 - 1, 82, 1, 8, skinD)
        + px(lx2, 82, LW, 8, skin) + px(lx2 + LW, 82, 1, 8, skinD);
    } else {
      if (p.side) s += px(lx1 - 1, 76, 1, 14, p.side) + px(lx2 + LW, 76, 1, 14, p.side);
      if (p.dots) s += px(lx1 + 1, 78, 1, 1, shade(pc, 1.3)) + px(lx2 + 1, 81, 1, 1, shade(pc, 1.3))
        + px(lx1 + 2, 84, 1, 1, shade(pc, 1.3)) + px(lx2 + 2, 87, 1, 1, shade(pc, 1.3));
      if (p.patch) s += px(lx2 + 1, 82, 2, 2, p.patch);
      if (p.cargo) s += px(lx1, 79, 3, 3, shade(pc, 0.8)) + px(lx2 + LW - 3, 79, 3, 3, shade(pc, 0.8));
    }
  }
  // Schuhe (Zehen 1px nach außen), Sohle dunkler; Sneaker bekommen Schnürsenkel-Pixel.
  const sh = p.shoe, shD = shade(sh, 0.6);
  s += px(lx1 - 2, 90, LW + 2, 3, sh) + px(lx1 - 2, 93, LW + 2, 1, shD);
  s += px(lx2, 90, LW + 2, 3, sh) + px(lx2, 93, LW + 2, 1, shD);
  if (sh === '#f2f0ea') s += px(lx1, 90, 1, 1, '#9a9a9a') + px(lx2 + 2, 90, 1, 1, '#9a9a9a');
  return s;
}

function bodySVG(cfg, skin) {
  const SH = BUILD.SH[cfg.build], HIP = BUILD.HIP[cfg.build], LW = BUILD.LW[cfg.build];
  const top = TOPS[cfg.top] || TOPS[0], p = PANTS[cfg.pants] || PANTS[0];
  const c = top.c;
  let s = '';
  s += armsSVG(SH, skin, top);
  s += roundO(32 - SH, 46, SH * 2, 23, c)                             // Rumpf
    + px(28, 46, 8, 2, shade(c, 0.78))                                // Halsausschnitt
    + dith(32 + SH - 6, 60, 5, 6, shade(c, 0.85));                    // Schatten rechts unten
  s += topDetails(top, SH);
  s += legsSVG(HIP, LW, skin, p);
  return s;
}

// ────────────────────────────────────────────────
//  AUSRÜSTUNG AM SPRITE (Paperdoll-Layer)
//  gear = { weapon?, head?, body?, arms?, legs?, talisman?, ring?, companion? }
//  mit je {type, tier, which}; Farbe = MATERIAL (which: past → Stahlblau,
//  pp → Gold). Der weiße Funkel-Pixel hängt an der Stufe (tier).
// ────────────────────────────────────────────────
const MAT_C = { past: '#8fa2b8', pp: '#e3b341' };
const TIER_G = { stahl: MAT_C.past, gold: MAT_C.pp, verzaubert: G[0] };   // Fallback ohne which
const matColor = (which, tier) => MAT_C[which] || TIER_G[tier] || G[3];
export const PET_COLOR = MAT_C;   // Alt-Export (Materialfarben), extern ungenutzt

function gearSVG(cfg, gear) {
  if (!gear) return '';
  const SH = BUILD.SH[cfg.build], HIP = BUILD.HIP[cfg.build], LW = BUILD.LW[cfg.build];
  const alx = 32 - SH - 4, arx = 32 + SH;
  const lx1 = 32 - HIP, lx2 = 32 + HIP - LW;
  let s = '';
  const col = (it) => matColor(it.which, it.tier);
  const spark = (it, x, y) => it.tier === 'verzaubert' ? px(x, y, 1, 1, '#ffffff') : '';

  if (gear.body) {
    const c = col(gear.body);
    s += px(32 - SH, 46, SH * 2, 12, c) + px(32 - SH, 58, SH * 2, 2, shade(c, 0.62))
      + px(28, 46, 8, 2, shade(c, 0.75))                            // Halsausschnitt
      + dith(32 + SH - 8, 52, 6, 6, shade(c, 0.8))
      + px(32 - SH + 2, 50, 1, 1, shade(c, 1.3)) + px(32 + SH - 3, 50, 1, 1, shade(c, 1.3))   // Nieten
      + spark(gear.body, 32 - SH + 2, 48);
  }
  if (gear.arms) {
    const c = col(gear.arms);
    s += px(alx, 60, 4, 6, c) + px(arx, 60, 4, 6, c)
      + px(alx, 60, 4, 1, shade(c, 0.62)) + px(arx, 60, 4, 1, shade(c, 0.62))
      + spark(gear.arms, alx + 1, 62);
  }
  if (gear.legs) {
    const c = col(gear.legs);
    s += px(lx1 - 2, 86, LW + 2, 8, c) + px(lx2, 86, LW + 2, 8, c)
      + px(lx1 - 2, 86, LW + 2, 1, shade(c, 0.62)) + px(lx2, 86, LW + 2, 1, shade(c, 0.62))
      + spark(gear.legs, lx2 + LW - 1, 88);
  }
  if (gear.talisman) {
    const c = col(gear.talisman);
    s += px(28, 44, 2, 2, G[4]) + px(34, 44, 2, 2, G[4]) + px(30, 46, 4, 4, c)
      + px(31, 47, 1, 1, '#ffffff') + spark(gear.talisman, 32, 46);
  }
  if (gear.ring) {
    s += px(alx + 1, 62, 2, 2, col(gear.ring)) + spark(gear.ring, alx + 1, 61);
  }
  if (gear.head) {
    const c = col(gear.head);
    s += soft(18, 6, 28, 12, c) + px(18, 17, 28, 2, shade(c, 0.62)) + dith(22, 8, 20, 4, shade(c, 0.82))
      + px(20, 8, 1, 1, shade(c, 1.3)) + spark(gear.head, 40, 8);
  }
  if (gear.weapon && gear.weapon.type) {
    // Waffe IN der Hand: Griff läuft durch die Faust, die Hand wird danach
    // wieder darübergezeichnet (Handschuh-Farbe, falls Panzerhandschuhe an).
    s += weaponSVG(gear.weapon, arx + 1);
    const handC = gear.arms ? col(gear.arms) : (SKIN[cfg.skin] || SKIN[0]);
    s += px(arx, 62, 4, 4, handC) + px(arx, 65, 4, 1, shade(handC, 0.85));
  }
  if (gear.companion) {
    // Gefährte zu Füßen des Charakters — eigenes Aussehen (Teile/Farbe),
    // Material zeigt sich am Halsband/Funkeln.
    s += `<g transform="translate(40,72)">${petPixels(cfg, gear.companion.which, false)}</g>`;
  }
  return s;
}

// Waffe in der rechten Hand (senkrecht, Klinge nach oben), wx = Griff-Spalte
// MITTEN in der Hand (Hand: y62..65 — Griff/Schaft laufen durch die Faust).
function weaponSVG(w, wx) {
  wx = Math.min(wx, 58);
  const c = matColor(w.which, w.tier);
  const d = shade(c, 0.62), hl = shade(c, 1.25);
  const grip = px(wx, 58, 2, 10, G[4]);                 // kurzer Griff: über + unter der Faust sichtbar
  const shaft = px(wx, 28, 2, 42, G[4]);                // langer Schaft: bis neben das Bein
  let s = '';
  switch (w.type) {
    case 'schwert': s = grip + px(wx - 2, 56, 6, 2, d) + px(wx, 32, 2, 24, c) + px(wx, 32, 1, 24, hl) + px(wx, 30, 2, 2, '#ffffff'); break;
    case 'dolch':   s = grip + px(wx - 2, 56, 6, 2, d) + px(wx, 44, 2, 12, c) + px(wx, 44, 1, 12, hl); break;
    case 'speer':   s = px(wx, 24, 2, 46, G[4]) + px(wx - 2, 22, 6, 2, c) + px(wx, 18, 2, 4, c) + px(wx, 24, 2, 2, c); break;
    case 'axt':     s = shaft + px(wx - 6, 28, 6, 8, c) + px(wx - 8, 30, 2, 4, c) + px(wx - 8, 30, 1, 4, hl); break;
    case 'hammer':  s = shaft + px(wx - 4, 26, 8, 8, c) + px(wx - 4, 29, 8, 1, d); break;
    case 'stab':    s = px(wx, 26, 2, 44, G[4]) + px(wx - 2, 20, 6, 6, c) + px(wx - 1, 21, 2, 2, '#ffffff'); break;
    case 'bogen':   s = px(wx, 44, 2, 36, c) + px(wx - 2, 44, 4, 2, c) + px(wx - 2, 78, 4, 2, c)
      + px(wx - 2, 46, 1, 32, d) + px(wx, 60, 2, 6, G[4]); break;   // Bogen MITTIG in der Faust, Sehne links, Griffwicklung
    case 'streitkolben': s = shaft + px(wx - 4, 20, 8, 8, c) + px(wx - 6, 22, 2, 4, c) + px(wx + 4, 22, 2, 4, c) + px(wx - 2, 18, 4, 2, c); break;
    default: return '';
  }
  if (w.tier === 'verzaubert') s += px(wx + 3, 26, 1, 1, '#ffffff') + px(wx - 3, 40, 1, 1, '#ffffff');
  return s;
}

// 16×16-Pixel-Icon eines geschmiedeten Objekts (fürs Inventar) — gleiche
// Stilregeln: weiche Silhouetten, Outline im dunkleren Ton, Stufen-Grau.
export function itemSpriteSVG(type, tier, which) {
  const c = matColor(which, tier);
  const d = shade(c, 0.62);
  let s = '';
  switch (type) {
    case 'schwert':    s = px(7, 1, 2, 9, c) + px(7, 0, 2, 1, '#ffffff') + px(5, 10, 6, 1, d) + px(7, 11, 2, 4, G[4]); break;
    case 'dolch':      s = px(7, 3, 2, 6, c) + px(5, 9, 6, 1, d) + px(7, 10, 2, 4, G[4]); break;
    case 'speer':      s = px(7, 4, 2, 11, G[4]) + px(6, 2, 4, 2, c) + px(7, 0, 2, 2, c); break;
    case 'axt':        s = px(8, 2, 2, 12, G[4]) + px(3, 2, 5, 5, c) + px(2, 3, 1, 3, c); break;
    case 'hammer':     s = px(7, 4, 2, 10, G[4]) + px(4, 1, 8, 4, c); break;
    case 'stab':       s = px(7, 4, 2, 11, G[4]) + px(6, 1, 4, 4, c) + px(7, 2, 2, 2, '#ffffff'); break;
    case 'bogen':      s = px(5, 1, 2, 2, c) + px(4, 3, 2, 10, c) + px(5, 13, 2, 2, c) + px(9, 2, 1, 12, d) + px(5, 7, 5, 2, G[4]) + px(10, 6, 2, 4, c); break;
    case 'streitkolben': s = px(7, 7, 2, 8, G[4]) + px(5, 2, 6, 5, c) + px(7, 0, 2, 2, c) + px(3, 3, 2, 3, c) + px(11, 3, 2, 3, c); break;
    case 'helm':       s = soft(3, 4, 10, 6, c) + px(3, 10, 10, 1, d) + px(5, 7, 6, 1, shade(c, 0.8)); break;
    case 'ruestung':   s = soft(3, 3, 10, 9, c) + px(6, 3, 4, 1, d) + px(3, 11, 10, 1, d) + dith(9, 8, 3, 3, shade(c, 0.8)); break;
    case 'handschuhe': s = px(2, 5, 4, 6, c) + px(2, 5, 4, 1, d) + px(10, 5, 4, 6, c) + px(10, 5, 4, 1, d); break;
    case 'stiefel':    s = px(3, 4, 3, 7, c) + px(2, 10, 5, 2, d) + px(10, 4, 3, 7, c) + px(9, 10, 5, 2, d); break;
    case 'talisman':   s = px(5, 2, 1, 3, G[4]) + px(10, 2, 1, 3, G[4]) + px(6, 1, 4, 1, G[4]) + soft(5, 6, 6, 6, c); break;
    case 'ring':       s = soft(4, 6, 8, 8, d) + px(6, 8, 4, 4, '#f4f1fc') + px(6, 2, 4, 4, c); break;
    case 'gefaehrte':  s = soft(4, 7, 8, 6, c) + px(5, 5, 1, 2, c) + px(9, 4, 1, 3, c) + px(7, 9, 1, 1, G[5]); break;
    default: s = px(5, 5, 6, 6, c);
  }
  if (tier === 'verzaubert') s += px(13, 1, 1, 1, '#ffffff') + px(2, 13, 1, 1, '#ffffff');
  return `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;">${s}</svg>`;
}

// ────────────────────────────────────────────────
//  GEFÄHRTE (24×20-Raster)
//  Eigenes Aussehen: Tierform + Ohren/Schwanz/Augen/Muster/Farbe (cfg.pet*).
//  Das MATERIAL (Stahl/Gold) zeigt sich am Halsband: Stahl = stahlblaues Band,
//  Gold = goldenes Band + Funkel-Pixeln (shiny) — nicht mehr an der Fellfarbe.
// ────────────────────────────────────────────────
export const PET_NAMES = ['Hund', 'Katze', 'Hase', 'Fuchs', 'Eule', 'Drache', 'Schildkröte', 'Vogel', 'Frosch', 'Geist'];
export const PET_COLORS = ['#8a6242', '#3b3b46', '#e8e4da', '#d97b29', '#9aa0ab', '#e3c14f', '#7bb069', '#5f8dd3', '#e08bb0', '#9a7fd1'];
const PET_PART_NAMES = {
  petEars:    ['Spitz', 'Rund', 'Schlapp', 'Lang', 'Büschel', 'Hörner', 'Feder', 'Breit', 'Mini', 'Keine'],
  petTail:    ['Kurz', 'Geschwungen', 'Buschig', 'Gerollt', 'Zacken', 'Herz', 'Fächer', 'Stummel', 'Peitsche', 'Keiner'],
  petEyes:    ['Punkte', 'Groß', 'Fröhlich', 'Zwinkern', 'Glubsch', 'Müde', 'Sterne', 'Herzen', 'Grimmig', 'Schlafend'],
  petPattern: ['Ohne', 'Flecken', 'Streifen', 'Heller Bauch', 'Dunkler Rücken', 'Punkte', 'Maske', 'Söckchen', 'Herzfleck', 'Schimmer'],
  petColor:   ['Braun', 'Schwarz', 'Weiß', 'Orange', 'Grau', 'Gelb', 'Grün', 'Blau', 'Rosa', 'Lila'],
};

// Tierformen: draw(c) zeichnet Körper/Kopf/Beine OHNE Ohren/Schwanz/Augen.
// Anker: earL/earR = Ohr-Fußpunkt, tail = Schwanzansatz, eyes = Augen-Positionen;
// head/body/feet = Flächen fürs Muster.
const ANIMALS = [
  { // 0 Hund
    draw: (c) => soft(4, 10, 13, 7, c) + px(5, 16, 2, 4, c) + px(9, 16, 2, 4, shade(c, 0.8)) + px(13, 16, 2, 4, c)
      + soft(13, 3, 9, 8, c) + px(19, 7, 3, 3, shade(c, 1.15)) + px(21, 8, 1, 1, INK)
      + px(3, 10, 1, 7, shade(c, 0.62)) + dith(13, 13, 3, 3, shade(c, 0.85)),
    earL: [14, 3], earR: [19, 3], tail: [3, 11], eyes: [[16, 6], [19, 6]],
    collar: [13, 10, 6], head: [13, 3, 9, 8], body: [4, 10, 13, 7], feet: [[5, 18, 2, 2], [9, 18, 2, 2], [13, 18, 2, 2]] },
  { // 1 Katze
    draw: (c) => soft(5, 11, 12, 6, c) + px(6, 16, 2, 4, c) + px(10, 16, 2, 4, shade(c, 0.8)) + px(14, 16, 2, 4, c)
      + soft(13, 4, 9, 7, c) + px(20, 8, 2, 2, shade(c, 1.15)) + px(21, 9, 1, 1, INK)
      + px(11, 8, 2, 1, shade(c, 0.62)) + px(22, 8, 2, 1, shade(c, 0.62)) + dith(13, 13, 3, 2, shade(c, 0.85)),
    earL: [14, 4], earR: [19, 4], tail: [5, 11], eyes: [[16, 7], [19, 7]],
    collar: [13, 11, 6], head: [13, 4, 9, 7], body: [5, 11, 12, 6], feet: [[6, 18, 2, 2], [10, 18, 2, 2], [14, 18, 2, 2]] },
  { // 2 Hase (sitzend)
    draw: (c) => soft(5, 9, 11, 9, c) + soft(8, 3, 9, 7, c)
      + px(9, 16, 2, 2, shade(c, 0.8)) + px(13, 16, 2, 2, shade(c, 0.8))
      + px(15, 6, 2, 2, shade(c, 1.15)) + px(16, 7, 1, 1, INK) + dith(6, 14, 4, 3, shade(c, 0.85)),
    earL: [9, 3], earR: [14, 3], tail: [4, 13], eyes: [[11, 6], [14, 6]],
    collar: [9, 9, 7], head: [8, 3, 9, 7], body: [5, 9, 11, 9], feet: [[9, 16, 2, 2], [13, 16, 2, 2]] },
  { // 3 Fuchs
    draw: (c) => soft(4, 10, 13, 7, c) + px(5, 16, 2, 4, shade(c, 0.6)) + px(9, 16, 2, 4, shade(c, 0.7)) + px(13, 16, 2, 4, shade(c, 0.6))
      + soft(13, 3, 9, 8, c) + px(20, 7, 3, 2, shade(c, 1.25)) + px(22, 8, 1, 1, INK)
      + dith(5, 11, 3, 4, shade(c, 1.3)) + px(3, 10, 1, 7, shade(c, 0.62)),
    earL: [14, 3], earR: [19, 3], tail: [3, 11], eyes: [[16, 6], [19, 6]],
    collar: [13, 10, 6], head: [13, 3, 9, 8], body: [4, 10, 13, 7], feet: [[5, 18, 2, 2], [9, 18, 2, 2], [13, 18, 2, 2]] },
  { // 4 Eule
    draw: (c) => soft(6, 7, 12, 11, c) + soft(5, 2, 14, 7, c)
      + dith(9, 10, 6, 6, shade(c, 1.25)) + px(11, 6, 2, 2, GOLD)
      + px(5, 9, 2, 6, shade(c, 0.62)) + px(17, 9, 2, 6, shade(c, 0.62))
      + px(8, 18, 3, 2, GOLD) + px(13, 18, 3, 2, GOLD),
    earL: [7, 2], earR: [16, 2], tail: [5, 15], eyes: [[9, 5], [14, 5]],
    collar: [8, 8, 8], head: [5, 2, 14, 7], body: [6, 7, 12, 11], feet: [[8, 18, 3, 2], [13, 18, 3, 2]] },
  { // 5 Drache
    draw: (c) => soft(4, 10, 14, 7, c) + px(6, 16, 2, 4, c) + px(10, 16, 2, 4, shade(c, 0.8)) + px(14, 16, 2, 4, c)
      + soft(14, 4, 9, 7, c) + px(21, 8, 2, 2, shade(c, 1.15)) + px(22, 9, 1, 1, INK)
      + px(8, 4, 1, 2, shade(c, 0.62)) + px(9, 5, 2, 3, shade(c, 0.62)) + px(11, 7, 3, 3, shade(c, 0.62))   // Flügel
      + px(6, 9, 1, 1, shade(c, 0.62)) + px(9, 9, 1, 1, shade(c, 0.62)) + px(12, 9, 1, 1, shade(c, 0.62)),  // Rückenzacken
    earL: [15, 4], earR: [20, 4], tail: [3, 11], eyes: [[17, 7], [20, 7]],
    collar: [14, 11, 6], head: [14, 4, 9, 7], body: [4, 10, 14, 7], feet: [[6, 18, 2, 2], [10, 18, 2, 2], [14, 18, 2, 2]] },
  { // 6 Schildkröte
    draw: (c) => roundO(5, 6, 13, 9, shade(c, 0.78)) + px(7, 8, 4, 1, shade(c, 0.6)) + px(12, 10, 4, 1, shade(c, 0.6))
      + px(8, 12, 4, 1, shade(c, 0.6)) + soft(17, 8, 5, 5, c)
      + px(6, 15, 3, 3, c) + px(13, 15, 3, 3, c) + dith(7, 7, 5, 3, shade(c, 0.95)),
    earL: [18, 7], earR: [21, 7], tail: [4, 13], eyes: [[18, 10], [20, 10]],
    collar: [17, 12, 4], head: [17, 8, 5, 5], body: [6, 7, 11, 7], feet: [[6, 16, 3, 2], [13, 16, 3, 2]] },
  { // 7 Vogel
    draw: (c) => soft(6, 9, 11, 8, c) + soft(10, 3, 8, 7, c) + px(17, 6, 3, 2, GOLD)
      + dith(8, 11, 5, 4, shade(c, 0.8))
      + px(9, 17, 1, 2, GOLD) + px(13, 17, 1, 2, GOLD) + px(8, 19, 3, 1, GOLD) + px(12, 19, 3, 1, GOLD),
    earL: [11, 3], earR: [16, 3], tail: [5, 10], eyes: [[13, 6], [16, 6]],
    collar: [10, 9, 6], head: [10, 3, 8, 7], body: [6, 9, 11, 8], feet: [[8, 17, 3, 3], [12, 17, 3, 3]] },
  { // 8 Frosch
    draw: (c) => soft(5, 5, 13, 7, c) + soft(4, 10, 15, 7, c)
      + soft(6, 3, 4, 4, c) + soft(13, 3, 4, 4, c)                    // Augenhöcker
      + px(8, 10, 8, 1, shade(c, 0.62))                               // Mund
      + soft(4, 13, 5, 4, shade(c, 0.9)) + soft(14, 13, 5, 4, shade(c, 0.9))   // Schenkel
      + px(4, 17, 4, 2, c) + px(15, 17, 4, 2, c) + dith(8, 13, 7, 3, shade(c, 1.3)),
    earL: [6, 3], earR: [16, 3], tail: [3, 13], eyes: [[7, 4], [14, 4]],
    collar: [10, 12, 4], head: [5, 5, 13, 6], body: [4, 10, 15, 7], feet: [[4, 17, 4, 2], [15, 17, 4, 2]] },
  { // 9 Geist
    draw: (c) => round(6, 3, 12, 13, c) + px(6, 15, 2, 2, c) + px(10, 15, 2, 2, c) + px(14, 15, 2, 2, c)   // welliger Saum
      + px(4, 8, 2, 2, c) + px(18, 8, 2, 2, c)                        // Schweber-Ärmchen
      + dith(14, 6, 3, 8, shade(c, 0.88)) + px(8, 5, 4, 1, shade(c, 1.2)),
    earL: [8, 3], earR: [15, 3], tail: [4, 12], eyes: [[9, 8], [14, 8]],
    collar: [10, 11, 4], head: [7, 4, 10, 6], body: [7, 4, 10, 10], feet: [] },
];

// Ohr-Varianten am Ankerpunkt (x,y) — s = Seite (-1 links, +1 rechts).
function petEar(v, x, y, c, s) {
  const inner = shade(c, 1.2);
  switch (v) {
    case 0: return px(x, y - 2, 2, 2, c) + px(s > 0 ? x + 1 : x, y - 3, 1, 1, c);            // spitz
    case 1: return px(x, y - 2, 2, 2, c) + px(s > 0 ? x : x + 1, y - 1, 1, 1, inner);        // rund
    case 2: return px(s > 0 ? x + 1 : x - 1, y - 2, 2, 5, c);                                // schlapp
    case 3: return px(x, y - 6, 2, 6, c) + px(s > 0 ? x : x + 1, y - 4, 1, 3, '#e8b4c4');    // lang (Hase)
    case 4: return px(x - 1, y - 2, 1, 2, c) + px(x, y - 3, 1, 3, c) + px(x + 1, y - 2, 1, 2, c);   // Büschel
    case 5: return px(x, y - 2, 1, 2, '#e8e0c8') + px(x + s, y - 3, 1, 2, '#e8e0c8');        // Hörner
    case 6: return px(x, y - 3, 1, 3, c) + px(x, y - 4, 1, 1, GOLD);                         // Feder
    case 7: return px(x - 1, y - 3, 3, 3, c);                                                // breit
    case 8: return px(x, y - 1, 1, 1, c);                                                   // mini
    default: return '';                                                                      // keine
  }
}

// Schwanz-Varianten am Ansatz (x,y) — zeigt nach links/oben.
function petTail(v, x, y, c) {
  const d = shade(c, 0.62), l = shade(c, 1.2);
  switch (v) {
    case 0: return px(x, y - 1, 2, 2, c);                                                    // kurz
    case 1: return px(x, y, 2, 1, c) + px(x - 1, y - 1, 1, 2, c) + px(x - 2, y - 3, 1, 3, c);   // geschwungen
    case 2: return px(x - 2, y - 2, 3, 4, c) + px(x - 2, y - 3, 2, 1, l) + px(x - 2, y + 1, 3, 1, d);   // buschig
    case 3: return px(x - 2, y - 2, 3, 1, c) + px(x - 3, y - 1, 1, 2, c) + px(x, y - 1, 1, 2, c) + px(x - 2, y + 1, 3, 1, c);   // gerollt
    case 4: return px(x - 1, y, 2, 1, c) + px(x - 2, y - 1, 1, 1, c) + px(x - 3, y - 2, 1, 1, d);   // Zacken
    case 5: return px(x - 3, y - 2, 1, 1, c) + px(x - 1, y - 2, 1, 1, c) + px(x - 3, y - 1, 3, 1, c) + px(x - 2, y, 1, 1, c);   // Herz
    case 6: return px(x, y - 4, 1, 4, c) + px(x - 2, y - 3, 1, 3, d) + px(x - 4, y - 2, 1, 2, l);   // Fächer
    case 7: return px(x, y, 1, 1, c);                                                        // Stummel
    case 8: return px(x, y - 4, 1, 4, c) + px(x - 1, y - 5, 2, 1, c);                        // Peitsche hoch
    default: return '';                                                                      // keiner
  }
}

// Augen-Varianten an den Positionen des Tiers.
function petEyes(v, pos) {
  const e = INK, w = '#ffffff';
  let s = '';
  pos.forEach(([x, y], idx) => {
    switch (v) {
      case 0: s += px(x, y, 1, 1, e); break;                                                 // Punkte
      case 1: s += px(x, y - 1, 2, 2, e) + px(x, y - 1, 1, 1, w); break;                     // groß
      case 2: s += px(x - 1, y, 1, 1, e) + px(x, y - 1, 1, 1, e) + px(x + 1, y, 1, 1, e); break;   // fröhlich
      case 3: s += idx === 0 ? px(x, y, 1, 1, e) : px(x - 1, y, 3, 1, e); break;             // Zwinkern
      case 4: s += px(x, y - 1, 2, 2, w) + px(x + 1, y, 1, 1, e); break;                     // Glubsch
      case 5: s += px(x - 1, y - 1, 2, 1, e) + px(x, y, 1, 1, e); break;                     // müde
      case 6: s += px(x, y - 1, 1, 3, GOLD) + px(x - 1, y, 3, 1, GOLD); break;               // Sterne
      case 7: s += px(x - 1, y - 1, 1, 1, '#e0607a') + px(x + 1, y - 1, 1, 1, '#e0607a')
        + px(x - 1, y, 3, 1, '#e0607a') + px(x, y + 1, 1, 1, '#e0607a'); break;              // Herzen
      case 8: s += px(x - 1, y - 2, 2, 1, e) + px(x, y, 1, 1, e); break;                     // grimmig
      default: s += px(x - 1, y, 3, 1, e); break;                                            // schlafend
    }
  });
  return s;
}

// Muster über den Flächen des Tiers.
function petPattern(v, A, c) {
  const dk = shade(c, 0.72), lt = shade(c, 1.28);
  const [bx, by, bw, bh] = A.body, [hx, hy, hw, hh] = A.head;
  let s = '';
  switch (v) {
    case 1:   // Flecken
      s += px(bx + 2, by + 1, 2, 2, dk) + px(bx + bw - 4, by + 2, 2, 2, dk) + px(bx + 5, by + 4, 2, 1, dk);
      break;
    case 2:   // Streifen
      for (let x = bx + 2; x < bx + bw - 1; x += 3) s += px(x, by + 1, 1, bh - 2, dk);
      break;
    case 3: s += dith(bx + 1, by + bh - 3, bw - 2, 3, lt); break;      // heller Bauch
    case 4: s += dith(bx + 1, by, bw - 2, 2, dk); break;               // dunkler Rücken
    case 5:   // Punkte
      s += px(bx + 1, by + 1, 1, 1, dk) + px(bx + 4, by + 3, 1, 1, dk)
        + px(bx + 7, by + 1, 1, 1, dk) + px(bx + bw - 3, by + 3, 1, 1, dk);
      break;
    case 6: s += dith(hx + 1, hy + 2, hw - 2, 2, dk); break;           // Maske
    case 7: for (const [fx, fy, fw, fh] of A.feet) s += px(fx, fy, fw, fh, '#f2f0ea'); break;   // Söckchen
    case 8:   // Herzfleck
      s += px(bx + 2, by + 2, 1, 1, dk) + px(bx + 4, by + 2, 1, 1, dk)
        + px(bx + 2, by + 3, 3, 1, dk) + px(bx + 3, by + 4, 1, 1, dk);
      break;
    case 9: s += dith(bx + 1, by + 1, bw - 2, bh - 2, lt); break;      // Schimmer
  }
  return s;
}

// Halsband nach Material: Stahl = stahlblau, Gold = golden + Funkeln (shiny).
function petCollar(A, c, which) {
  if (!which) return '';
  const [x, y, w] = A.collar;
  const [hx, hy] = A.head;
  if (which === 'pp') {
    return px(x, y, w, 2, GOLD) + px(x, y, w, 1, '#f0cf6e') + px(x + (w >> 1), y + 2, 1, 1, '#ffe9a8')
      + px(2, 1, 1, 1, '#ffffff') + px(22, 3, 1, 1, '#ffffff') + px(20, 17, 1, 1, '#ffffff') + px(1, 15, 1, 1, '#ffffff')
      + dith(hx + 1, hy + 1, 3, 2, shade(c, 1.35));
  }
  return px(x, y, w, 2, '#8fa2b8') + px(x, y, w, 1, '#a8b8ca') + px(x + (w >> 1), y + 2, 1, 1, '#c9ccd6');
}

// Gefährten-Pixel: Form + Teile + Farbe; which = Material (Halsband/Funkeln),
// locked = noch nicht freigespielt (graue Vorschau ohne Halsband).
function petPixels(cfg, which, locked) {
  const A = ANIMALS[cfg.pet] || ANIMALS[0];
  const c = locked ? G[1] : (PET_COLORS[cfg.petColor] || PET_COLORS[0]);
  // 4 Zeilen Luft über dem Kopf, damit hohe Ohren (Hase!) nicht abgeschnitten werden.
  return `<g transform="translate(0,4)">` + A.draw(c)
    + petPattern(cfg.petPattern, A, c)
    + petEar(cfg.petEars, A.earL[0], A.earL[1], c, -1)
    + petEar(cfg.petEars, A.earR[0], A.earR[1], c, 1)
    + petTail(cfg.petTail, A.tail[0], A.tail[1], c)
    + petEyes(cfg.petEyes, A.eyes)
    + (locked ? '' : petCollar(A, c, which)) + `</g>`;
}
// Eigenständiges Tier-SVG (Editor-Bühne + Varianten-Kacheln).
export function petSVG(cfg, opts = {}) {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;">${petPixels(cfg, opts.which || null, !!opts.locked)}</svg>`;
}

// ────────────────────────────────────────────────
//  GESAMT-SVG (64×96)
//  Reihenfolge (hinten→vorne): Rückenhaar · Körper · Hals · Kopf · Ohren ·
//  Gesicht · Haare · Ausrüstung (opts.gear — Helm über Haar, Waffe in der Hand …).
// ────────────────────────────────────────────────
export function avatarSVG(cfg, opts = {}) {
  const headOnly = !!opts.headOnly;
  const skin = SKIN[cfg.skin] || SKIN[0];
  const inner =
    hairBackSVG(cfg.hair, cfg.hairColor) +
    (headOnly ? '' : bodySVG(cfg, skin)) +
    neckSVG(skin) +
    headSVG(skin) +
    earsSVG(cfg.ears, skin) +
    eyesSVG(cfg.eyes) +
    noseSVG(cfg.nose, skin) +
    mouthSVG(cfg.mouth) +
    hairSVG(cfg.hair, cfg.hairColor) +
    (headOnly ? '' : gearSVG(cfg, opts.gear));
  const vb = headOnly ? '10 0 44 44' : '0 0 64 96';
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;">${inner}</svg>`;
}

export function renderAvatarInto(elId, sd, opts = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = avatarSVG(ensureAvatar(sd), opts);
}

// ────────────────────────────────────────────────
//  CHARAKTER-SCREEN (Anpassung)
//  UX: Merkmal-Slider oben, darunter ein KACHEL-GRID mit Live-Vorschau
//  jeder Variante (antippen = anziehen). Gefährte hat eine eigene
//  Merkmal-Leiste (Tier/Ohren/Schwanz/Augen/Muster/Farbe).
// ────────────────────────────────────────────────
let _activeFeature = 'hair';
let _activePetFeature = 'pet';

// Bearbeitungs-Ziel der Bühne: Charakter oder Gefährte. Ob ein Gefährte
// freigespielt ist (und welches Material er trägt), sagt ui.js über
// setCharacterCompanion — avatar.js importiert die Schmiede bewusst nicht.
let _editTarget = 'char';
let _petInfo = { available: false, which: null };
export function setCharacterCompanion(info) {
  _petInfo = info || { available: false, which: null };
  if (!_petInfo.available) _editTarget = 'char';
}
export function charEditTarget(t) {
  if (t === 'pet' && !_petInfo.available) return;   // ausgegraut = nicht anwählbar
  _editTarget = t === 'pet' ? 'pet' : 'char';
  renderCharacter();
}

export function renderCharacter() {
  const sd = window.SD;
  if (!sd) return;
  const cfg = ensureAvatar(sd);
  renderAvatarInto('character-canvas', sd, { headOnly: false });

  // Gefährten-Figur neben dem Charakter: eigenes Aussehen, Halsband = Material;
  // ohne freigespielten Gefährten grau + gesperrt; Markierung unter der Figur.
  const petBtn = document.getElementById('char-pick-pet');
  const charBtn = document.getElementById('char-pick-char');
  if (petBtn && charBtn) {
    const petCv = document.getElementById('character-pet-canvas');
    if (petCv) petCv.innerHTML = petSVG(cfg, { which: _petInfo.which, locked: !_petInfo.available });
    petBtn.classList.toggle('locked', !_petInfo.available);
    petBtn.classList.toggle('sel', _editTarget === 'pet');
    charBtn.classList.toggle('sel', _editTarget === 'char');
    petBtn.title = _petInfo.available ? 'Gefährte anpassen' : 'Noch kein Gefährte — spiele ihn in der ⚒️ Schmiede frei';
  }

  if (_editTarget === 'pet') return _renderPetEditor(cfg);

  // Name: Eingabefeld befüllen (nur wenn nicht gerade darin getippt wird)
  const nameIn = document.getElementById('char-name-input');
  if (nameIn && document.activeElement !== nameIn) nameIn.value = sd.playerName || '';
  _wireNameInput();

  _renderFeatureBar(AVATAR_FEATURES, _activeFeature);

  // Varianten-Grid: jede Stufe als Mini-Vorschau, aktuelle markiert.
  const grid = document.getElementById('character-variants');
  if (grid) {
    const key = _activeFeature;
    const headKeys = ['hair', 'hairColor', 'eyes', 'ears', 'nose', 'mouth', 'skin'];
    grid.innerHTML = Array.from({ length: COUNTS[key] }, (_, v) => {
      const preview = avatarSVG({ ...cfg, [key]: v }, { headOnly: headKeys.includes(key) });
      const on = cfg[key] === v;
      return `<button class="cg-tile${on ? ' sel' : ''}" onclick="avatarSet('${key}',${v})" aria-label="${key} ${v + 1}">${preview}</button>`;
    }).join('');
  }
}

// Merkmal-Slider: ‹ Merkmal › + Punkte — so ist garantiert jedes Merkmal
// erreichbar (Chips liefen rechts aus dem Bild).
function _renderFeatureBar(features, activeKey) {
  const bar = document.getElementById('character-feature-chips');
  if (!bar) return;
  const idx = features.findIndex(f => f.key === activeKey);
  const feat = features[idx] || features[0];
  bar.innerHTML = `
    <div class="cg-featbar">
      <button class="cg-featarrow" onclick="avatarPickStep(-1)" aria-label="voriges Merkmal">‹</button>
      <div class="cg-featlbl">${feat.icon} ${feat.label}</div>
      <button class="cg-featarrow" onclick="avatarPickStep(1)" aria-label="nächstes Merkmal">›</button>
    </div>
    <div class="cg-featdots">${features.map((f, i) =>
      `<button class="cg-dot${i === idx ? ' active' : ''}" onclick="avatarPick('${f.key}')" title="${f.label}" aria-label="${f.label}"></button>`).join('')}
    </div>`;
}

// Namensfeld: speichert beim Tippen (debounced via change/blur), Menü-Banner
// aktualisiert sich beim nächsten showMenu; Cloud-Commit beim Verlassen
// (commitAvatar) — kein Prompt-Popup mehr.
let _nameWired = false;
function _wireNameInput() {
  if (_nameWired) return;
  const inp = document.getElementById('char-name-input');
  if (!inp) return;
  _nameWired = true;
  const save = () => {
    const v = (inp.value || '').trim().slice(0, 20);
    if (!v || v === window.SD.playerName) return;
    window.SD.playerName = v;
    persist(window.SD);
    if (window.currentUser) markDirty('profile');
  };
  inp.addEventListener('change', save);
  inp.addEventListener('blur', save);
}

// Gefährten-Editor: eigene Merkmal-Leiste, das Grid zeigt je Merkmal die
// 10 Varianten als Live-Vorschau des Tiers (Halsband = Material).
function _renderPetEditor(cfg) {
  _renderFeatureBar(PET_FEATURES, _activePetFeature);
  const grid = document.getElementById('character-variants');
  if (grid) {
    const key = _activePetFeature;
    const names = key === 'pet' ? PET_NAMES : PET_PART_NAMES[key];
    grid.innerHTML = Array.from({ length: COUNTS[key] }, (_, v) => {
      const preview = petSVG({ ...cfg, [key]: v }, { which: _petInfo.which });
      const name = names ? names[v] : `${v + 1}`;
      return `<button class="cg-tile cg-pet${cfg[key] === v ? ' sel' : ''}" onclick="avatarSet('${key}',${v})" title="${name}" aria-label="${name}">${preview}</button>`;
    }).join('');
  }
}

// Tier wählen — Alt-API, nutzt jetzt avatarSet.
export function petSet(v) { avatarSet('pet', v); }

// Merkmal auswählen (Punkt) → Varianten-Grid wechselt.
export function avatarPick(key) {
  if (AVATAR_FEATURES.some(f => f.key === key)) _activeFeature = key;
  else if (PET_FEATURES.some(f => f.key === key)) _activePetFeature = key;
  renderCharacter();
}

// Merkmal-Slider: ‹/› blättert durch die Merkmale (mit Umlauf), je nach Ziel.
export function avatarPickStep(dir) {
  const feats = _editTarget === 'pet' ? PET_FEATURES : AVATAR_FEATURES;
  const active = _editTarget === 'pet' ? _activePetFeature : _activeFeature;
  const idx = feats.findIndex(f => f.key === active);
  const n = feats.length;
  const next = feats[(((idx + dir) % n) + n) % n].key;
  if (_editTarget === 'pet') _activePetFeature = next; else _activeFeature = next;
  renderCharacter();
}

// Variante direkt setzen (Kachel im Grid) — Charakter- UND Gefährten-Merkmale.
export function avatarSet(key, v) {
  const sd = window.SD;
  const cfg = ensureAvatar(sd);
  if (!(key in COUNTS) || !Number.isInteger(v)) return;
  cfg[key] = wrapK(key, v);
  persist(sd);
  if (window.currentUser) markDirty('profile');   // Pending-Flag überlebt auch Hardware-Zurück
  renderCharacter();
  renderAvatarInto('menu-avatar', sd, { headOnly: true });
  renderAvatarInto('prof-avatar', sd, { headOnly: true });
}

// Alt-API (Pfeile ‹/›) — bleibt für Kompatibilität, nutzt jetzt avatarSet.
export function avatarArrow(dir) {
  const cfg = ensureAvatar(window.SD);
  const key = _editTarget === 'pet' ? _activePetFeature : _activeFeature;
  avatarSet(key, wrapK(key, cfg[key] + dir));
}

// Beim Öffnen Standard-Merkmal setzen (und wieder den Charakter anwählen).
export function resetCharacterFeature() { _activeFeature = 'hair'; _activePetFeature = 'pet'; _editTarget = 'char'; }

// Beim Verlassen des Screens Cloud-Sync anstoßen (gesammelt, nicht pro Klick).
export function commitAvatar() {
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}
