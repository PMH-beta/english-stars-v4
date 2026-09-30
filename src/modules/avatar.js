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
import { itemGroupSVG, itemIconSVG, matPalette, gemPalette } from './pixel-items.js';
// Paletten der NEUEN Figur — nur für die Migration (nächstliegender Farbton).
import { imgTag, petTag, petURL, gearFor, fitScale, MASSE, ausschnitt, petLabel, stageHTML, petKind, petColorHex, editorFigurHTML, editorPetHTML, kachelURL, paintStages } from './hero.js';
import { SKIN as NEU_SKIN, HAIR as NEU_HAIR, CLOTH as NEU_CLOTH, IRIS as NEU_IRIS, HAIR_N as NEU_HAIR_N, EYES_N as NEU_EYES_N, MOUTH_N as NEU_MOUTH_N, TOPS_N as NEU_TOPS_N, PANTS_N as NEU_PANTS_N, PETS as NEU_PETS } from './pixel-hero-fine.js';
import { iconHTML } from './pixel-icons.js';

// Reihenfolge + Beschriftung der Einstell-Zeilen; anchor = vertikale Position der
// Pfeile (% der Sprite-Höhe, 96 Rasterzeilen) am jeweils veränderten Körperteil.
export const AVATAR_FEATURES = [
  { key: 'hair',   icon: '💇', label: 'Frisur',     anchor: 8 },
  { key: 'hairC',  icon: '🎨', label: 'Haarfarbe',  anchor: 8 },
  { key: 'skin',   icon: '🖐️', label: 'Hautfarbe', anchor: 50 },
  { key: 'eyes',   icon: '👀', label: 'Augen',      anchor: 25 },
  { key: 'iris',   icon: '🌈', label: 'Augenfarbe', anchor: 25 },
  { key: 'mouth',  icon: '👄', label: 'Mund',       anchor: 36 },
  { key: 'top',    icon: '👕', label: 'Oberteil',   anchor: 58 },
  { key: 'topC',   icon: '🎨', label: 'Oberteil-Farbe', anchor: 58 },
  { key: 'pants',  icon: '👖', label: 'Hose',       anchor: 80 },
  { key: 'pantsC', icon: '🎨', label: 'Hosen-Farbe', anchor: 80 },
  { key: 'build',  icon: '🧍', label: 'Statur',     anchor: 70 },
];

// Gefährten-Merkmale (eigene Leiste, wenn der Gefährte angewählt ist).
// Die neue Figur kennt nur Tier und Farbe — Ohren, Schwanz, Augen und Muster
// sind mit der Migration weggefallen (F-03).
export const PET_FEATURES = [
  { key: 'pet',      icon: '🐾', label: 'Tier' },
  { key: 'petColor', icon: '🌈', label: 'Farbe' },
];

// Varianten pro Merkmal: Charakter je 20, Gefährten-Teile je 10.
const COUNTS = {
  skin: 20, hair: 20, hairColor: 20, eyes: 20, ears: 20, nose: 20, mouth: 20,
  build: 20, top: 20, pants: 20,
  pet: 10, petEars: 10, petTail: 10, petEyes: 10, petPattern: 10, petColor: 10,
};

// ── Migration auf die neue Figur (avatarVersion 2) ───────────────────────────
// Entschieden am 29.09.2026: F-03 A (sechs Merkmale fallen ersatzlos weg),
// F-04 A (Gefährten-Zahlen 0–9 direkt übernehmen), F-05 A (umrechnen statt
// zurücksetzen). Siehe HANDOFF-ENTSCHEIDUNGEN.md.
//
// Formen per Modulo, Farben über den nächstliegenden Ton der neuen Palette.
// Die Kleidungsfarbe kommt aus der ALTEN Kleidung: dort steckte die Farbe noch
// im Schnitt (TOPS[7] = „T-Shirt Herz, rosa"), in der neuen Figur sind Schnitt
// und Farbe getrennt. So behält das Kind wenigstens seine Farbe.
export const AVATAR_VERSION = 2;

export const NEUE_COUNTS = {
  skin: 16, hair: 20, hairC: 12, eyes: 12, iris: 8, mouth: 12,
  top: 16, topC: 12, pants: 16, pantsC: 12, build: 3,
  pet: 20, petColor: 6,
};

// Abstand im RGB-Würfel — reicht für „welcher Ton kommt dem alten am nächsten".
function _naechsterTon(hex, palette) {
  const z = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [r, g, b] = z(hex);
  let best = 0, bestD = Infinity;
  palette.forEach((p, i) => {
    const [pr, pg, pb] = z(p);
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/**
 * Alter Avatar → neuer Avatar. Reine Funktion, schreibt nichts.
 * @param {object} a - Avatar im alten Format
 * @returns {object} Avatar im neuen Format (ohne avatarVersion)
 */
export function migrateAvatar(a) {
  const alt = (k) => { const v = Number(a && a[k]); return Number.isInteger(v) && v >= 0 && v < COUNTS[k] ? v : 0; };
  const iTop = alt('top'), iPants = alt('pants');
  return {
    skin:     _naechsterTon(SKIN[alt('skin')], NEU_SKIN),
    hair:     alt('hair') % NEUE_COUNTS.hair,
    hairC:    _naechsterTon(HAIR_COLORS[alt('hairColor')], NEU_HAIR),
    eyes:     alt('eyes') % NEUE_COUNTS.eyes,
    // Augenfarbe gab es vorher nicht. Statt alle Kinder mit derselben Farbe
    // loszuschicken, wird sie aus der alten HAARFARBE abgeleitet (Entscheidung
    // 29.09.2026): dunkles Haar → dunkle Augen, braunes → braun, und so fort.
    iris:     _naechsterTon(HAIR_COLORS[alt('hairColor')], NEU_IRIS),
    mouth:    alt('mouth') % NEUE_COUNTS.mouth,
    top:      iTop % NEUE_COUNTS.top,
    topC:     _naechsterTon(TOPS[iTop].c, NEU_CLOTH),
    pants:    iPants % NEUE_COUNTS.pants,
    pantsC:   _naechsterTon(PANTS[iPants].c, NEU_CLOTH),
    build:    alt('build') % NEUE_COUNTS.build,
    pet:      alt('pet'),                               // F-04 A: 0–9 unverändert
    petColor: alt('petColor') % NEUE_COUNTS.petColor,
  };
}

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
    skin: 1, hair: 0, hairC: 1, eyes: 0, iris: 0, mouth: 0,
    top: 1, topC: 0, pants: 0, pantsC: 6, build: 1,
    pet: 0, petColor: 0,
    avatarVersion: AVATAR_VERSION,
  };
}

/**
 * Stellt sicher, dass sd.avatar existiert und alle Werte im gültigen Bereich
 * liegen. Ein Spielstand im alten Format wird dabei EINMALIG umgerechnet
 * (migrateAvatar) und trägt danach avatarVersion 2 — der Weg wird nie wieder
 * betreten. Geschrieben wird erst, wenn der Spielstand ohnehin gespeichert wird.
 */
export function ensureAvatar(sd) {
  const d = defaultAvatar();
  let a = (sd && typeof sd.avatar === 'object' && sd.avatar) ? sd.avatar : {};
  if (a.avatarVersion !== AVATAR_VERSION && Object.keys(a).length) a = migrateAvatar(a);
  const out = { avatarVersion: AVATAR_VERSION };
  for (const k of Object.keys(NEUE_COUNTS)) {
    const v = Number(a[k]);
    out[k] = (Number.isInteger(v) && v >= 0 && v < NEUE_COUNTS[k]) ? v : d[k];
  }
  if (sd) sd.avatar = out;
  return out;
}

const wrapK = (key, n) => ((n % NEUE_COUNTS[key]) + NEUE_COUNTS[key]) % NEUE_COUNTS[key];

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
  const skinD = shade(skin, 0.7), skinH = shade(skin, 1.1), cD = shade(c, 0.62);
  let s = '';
  // Licht von oben links: linker Arm mit Glanzkante, rechter mit Schattenkante —
  // dadurch wirkt die Figur rund statt wie ausgeschnittenes Papier.
  for (const [x, ox, lit] of [[alx, alx - 1, true], [arx, arx + 4, false]]) {
    s += px(x, 46, 4, sleeveH, c) + px(ox, 46, 1, sleeveH, cD)
      + px(lit ? x : x + 3, 47, 1, sleeveH - 2, shade(c, lit ? 1.18 : 0.82))
      + px(x, 45 + sleeveH, 4, 1, shade(c, 0.75));                     // Ärmelsaum
    if (short) {
      s += px(x, 54, 4, 8, skin) + px(ox, 54, 1, 8, skinD)             // Unterarm Haut
        + px(lit ? x : x + 3, 55, 1, 6, lit ? skinH : skinD);
    }
    s += px(x, 62, 4, 4, skin) + px(ox, 62, 1, 4, skinD)               // Hand
      + px(x, 62, 4, 1, skinH) + px(x, 65, 4, 1, shade(skin, 0.85));
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
  const sh = p.shoe, shD = shade(sh, 0.6), shH = shade(sh, 1.2);
  s += px(lx1 - 2, 90, LW + 2, 3, sh) + px(lx1 - 2, 93, LW + 2, 1, shD) + px(lx1 - 2, 90, LW, 1, shH);
  s += px(lx2, 90, LW + 2, 3, sh) + px(lx2, 93, LW + 2, 1, shD) + px(lx2 + 2, 90, LW, 1, shH);
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
    + px(32 - SH + 1, 49, 2, 16, shade(c, 1.12))                      // Lichtkante links
    + px(32 + SH - 3, 49, 2, 16, shade(c, 0.88))                      // Schattenkante rechts
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
// Materialfarben kommen aus pixel-items.js — Schmiede, Ausrüstungs-Icons und
// die Teile am Charakter zeigen damit garantiert denselben Ton.

// Haltung der Waffe in der Faust, je Typ: dx/dy = Versatz gegenüber der Faust,
// rot = Neigung um den Griff (Grad, + = Spitze nach außen), scale = Größe.
// Senkrecht und in Originalgröße lag die Waffe quer über Arm und Brust und
// verdeckte beides — schräg nach vorn und etwas kleiner liegt sie NEBEN der Figur.
export const WEAPON_POSE = {
  _default:     { dx: 1, dy: -1, rot: 18, scale: 0.8 },
  schwert:      { dx: 1, dy: -1, rot: 22, scale: 0.8 },
  dolch:        { dx: 1, dy: -1, rot: 20, scale: 0.85 },
  speer:        { dx: 1, dy: -1, rot: 12, scale: 0.85 },
  axt:          { dx: 1, dy: -1, rot: 14, scale: 0.8 },
  hammer:       { dx: 1, dy: -1, rot: 14, scale: 0.8 },
  stab:         { dx: 1, dy: -1, rot: 12, scale: 0.85 },
  bogen:        { dx: 3, dy: -1, rot: 0,  scale: 0.85 },
  streitkolben: { dx: 1, dy: -1, rot: 20, scale: 0.8 },
};

// Material eines Teils als Palette (o/d/b/h) — identisch mit der Schmiede.
const gearPal = (it) => matPalette(it && it.which === 'pp' ? 'pp' : 'past');
const gearGem = (it) => gemPalette(it && it.which === 'pp' ? 'pp' : 'past');

function gearSVG(cfg, gear) {
  if (!gear) return '';
  const SH = BUILD.SH[cfg.build], HIP = BUILD.HIP[cfg.build], LW = BUILD.LW[cfg.build];
  const alx = 32 - SH - 4, arx = 32 + SH;
  const lx1 = 32 - HIP, lx2 = 32 + HIP - LW;
  let s = '';

  // 🛡️ Rüstung: Brustplatte mit Mittelgrat, Bauchband, Gürtel und Schulterstücken.
  // Licht kommt wie beim ganzen Sprite von oben links → Glanzkante links, Schatten rechts.
  if (gear.body) {
    const P = gearPal(gear.body), L = 32 - SH, W = SH * 2;
    s += round(L - 1, 45, W + 2, 24, P.o) + round(L, 46, W, 22, P.b)
      + px(L + 1, 49, 2, 16, P.h)                                   // Glanzkante links
      + px(L + W - 3, 49, 2, 16, P.d)                               // Schattenkante rechts
      + px(31, 48, 2, 18, P.h) + px(33, 48, 1, 18, P.d)             // Mittelgrat
      + px(28, 44, 8, 3, P.d) + px(28, 44, 8, 1, P.o)               // Halsausschnitt
      + px(L + 1, 57, W - 2, 1, P.o) + px(L + 1, 58, W - 2, 1, P.d) // Bauchband
      + px(L + 1, 63, W - 2, 3, P.d) + px(L + 1, 62, W - 2, 1, P.o) // Gürtel
      + px(30, 62, 4, 4, P.h) + px(31, 63, 2, 2, P.o)               // Schnalle
      + round(alx - 1, 43, 7, 9, P.o) + round(alx, 44, 5, 7, P.b) + px(alx, 45, 5, 1, P.h)
      + round(arx - 2, 43, 7, 9, P.o) + round(arx - 1, 44, 5, 7, P.b) + px(arx - 1, 45, 5, 1, P.h)
      + px(arx + 2, 46, 1, 4, P.d);                                 // Schatten rechte Schulter
  }
  // 🪖 Helm: Kuppel über dem Haar, Krempe, Wangenplatten und Nasensteg — das
  // Gesicht bleibt frei (Augen/Mund sind das Herzstück des Charakters).
  if (gear.head) {
    const P = gearPal(gear.head);
    s += round(17, 7, 30, 16, P.o) + round(18, 8, 28, 14, P.b)
      + px(21, 9, 20, 2, P.h)                                       // Lichtkante oben
      + dith(36, 12, 9, 8, P.d)                                     // Schattierung rechts
      + px(17, 20, 30, 2, P.d) + px(17, 22, 30, 1, P.o)             // Krempe
      + px(18, 23, 4, 11, P.b) + px(18, 23, 1, 11, P.h) + px(21, 23, 1, 11, P.o)   // Wangenplatte links
      + px(42, 23, 4, 11, P.b) + px(45, 23, 1, 11, P.o) + px(42, 23, 1, 11, P.d)   // rechts
      + px(18, 33, 4, 1, P.o) + px(42, 33, 4, 1, P.o)
      + px(31, 21, 2, 10, P.b) + px(30, 21, 1, 10, P.o) + px(33, 21, 1, 10, P.o)   // Nasensteg
      + px(29, 3, 6, 1, P.o) + px(30, 4, 4, 5, P.b) + px(30, 4, 1, 5, P.h) + px(33, 4, 1, 5, P.d);  // Kamm
  }
  // 🥾 Stiefel: Schaft über dem Bein, Sohle etwas breiter als der Fuß.
  if (gear.legs) {
    const P = gearPal(gear.legs);
    for (const x of [lx1 - 2, lx2]) {
      s += px(x, 82, LW + 2, 9, P.b) + px(x, 82, LW + 2, 1, P.o)
        + px(x, 83, 1, 8, P.h) + px(x + LW + 1, 83, 1, 8, P.d)
        + px(x, 86, LW + 2, 1, P.o)                                 // Schnalle/Naht
        + px(x - 1, 91, LW + 4, 2, P.d) + px(x - 1, 93, LW + 4, 1, P.o);   // Sohle
    }
  }
  // 🧿 Talisman: Kette am Hals, Medaillon mit Stein auf der Brust.
  if (gear.talisman) {
    const P = gearPal(gear.talisman), Gm = gearGem(gear.talisman);
    s += px(27, 42, 1, 3, P.d) + px(28, 44, 1, 2, P.d)
      + px(36, 42, 1, 3, P.d) + px(35, 44, 1, 2, P.d)
      + soft(29, 46, 6, 7, P.o) + soft(30, 47, 4, 5, P.b)
      + px(31, 48, 2, 3, Gm.G) + px(31, 48, 1, 1, Gm.S);
  }
  // 🧤 Handschuhe: Stulpe am Unterarm + Faust (die Faust kommt weiter unten
  // NOCH EINMAL über die Waffe, damit der Griff wirklich in der Hand liegt).
  if (gear.arms) {
    const P = gearPal(gear.arms);
    for (const [x, lit] of [[alx, true], [arx, false]]) {
      s += px(x - 1, 56, 6, 6, P.b) + px(x - 1, 56, 6, 1, P.o) + px(x - 1, 61, 6, 1, P.o)
        + px(x - 1, 57, 1, 4, lit ? P.h : P.d) + px(x + 4, 57, 1, 4, lit ? P.d : P.o);
    }
  }
  // Waffe: das echte Schmiede-Objekt (pixel-items.js) in der rechten Faust, in
  // eigener Gruppe — der Kampf lässt sie darüber schwingen (.av-weapon).
  if (gear.weapon && gear.weapon.type) {
    const P = WEAPON_POSE[gear.weapon.type] || WEAPON_POSE._default;
    s += itemGroupSVG(gear.weapon.type, gear.weapon.which === 'pp' ? 'pp' : 'past',
      arx + 2 + P.dx, 63 + P.dy, 64, 96, 'av-weapon', P);
  }
  // Faust über dem Griff — mit Panzerhandschuh in Materialfarbe, sonst Haut.
  if (gear.arms || (gear.weapon && gear.weapon.type)) {
    const P = gear.arms ? gearPal(gear.arms) : null;
    const skin = SKIN[cfg.skin] || SKIN[0];
    const b = P ? P.b : skin, o = P ? P.o : shade(skin, 0.7), h = P ? P.h : shade(skin, 1.08);
    s += px(arx, 62, 4, 5, b) + px(arx, 62, 4, 1, h) + px(arx, 66, 4, 1, o) + px(arx + 3, 63, 1, 3, o);
    if (gear.arms) s += px(arx + 1, 63, 1, 1, gearGem(gear.arms).G);   // Knöchel-Stein
  }
  // 💍 Ring an der freien (linken) Hand.
  if (gear.ring) {
    const Gm = gearGem(gear.ring), P = gearPal(gear.ring);
    s += px(alx, 63, 4, 1, P.b) + px(alx + 1, 62, 2, 1, Gm.G) + px(alx + 1, 62, 1, 1, Gm.S);
  }
  if (gear.companion) {
    // Gefährte zu Füßen des Charakters — eigenes Aussehen (Teile/Farbe),
    // Material zeigt sich am Halsband/Funkeln.
    s += `<g transform="translate(40,72)">${petPixels(cfg, gear.companion.which, false)}</g>`;
  }
  return s;
}

// Icon eines geschmiedeten Objekts (Ausrüstungs-Felder, Tasche, Vorschau) — dieselbe
// Pixel-Art wie in der Schmiede, nur mit allen fünf Teilen fertig. tier steckt schon
// im fertigen Objekt (nur komplette Teile werden zu Ausrüstung), spielt hier keine Rolle.
export function itemSpriteSVG(type, tier, which) {
  return itemIconSVG(type, which === 'pp' ? 'pp' : 'past');
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
  const P = matPalette(which === 'pp' ? 'pp' : 'past');
  const s = px(x, y, w, 2, P.b) + px(x, y, w, 1, P.h) + px(x + (w >> 1), y + 2, 1, 1, P.d);
  if (which !== 'pp') return s;
  return s + px(2, 1, 1, 1, '#ffffff') + px(22, 3, 1, 1, '#ffffff') + px(20, 17, 1, 1, '#ffffff') + px(1, 15, 1, 1, '#ffffff')
    + dith(hx + 1, hy + 1, 3, 2, shade(c, 1.35));
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
  return petTag(cfg.pet, cfg.petColor, {
    scale: Math.max(1, Math.round(opts.scale ?? 2)),
    locked: !!opts.locked,
  });
}

// ────────────────────────────────────────────────
//  GESAMT-SVG (64×96)
//  Reihenfolge (hinten→vorne): Rückenhaar · Körper · Hals · Kopf · Ohren ·
//  Gesicht · Haare · Ausrüstung (opts.gear — Helm über Haar, Waffe in der Hand …).
// ────────────────────────────────────────────────
// Unterkante der Helmkrempe (siehe gearSVG/gear.head): ab hier darf Haar wieder
// sichtbar sein. Alles darüber steckt unter dem Helm.
const HELM_BRIM = 23;
let _clipN = 0;

export function avatarSVG(cfg, opts = {}) {
  return imgTag(cfg, { ...opts, gear: gearFor(opts.gear), scale: Math.max(1, Math.round(opts.scale ?? 2)) });
}

/**
 * Figur in ein Element zeichnen. Der Maßstab wird am Container GEMESSEN, damit
 * die Pixel ganzzahlig skaliert bleiben (Handoff-Regel 6) — die Grafik wird
 * also nie per width:100% in eine beliebige Fläche gezogen.
 */
export function renderAvatarInto(elId, sd, opts = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  const cfg = ensureAvatar(sd);
  const [bw, bh] = MASSE[ausschnitt(opts)];
  // Ein ausdruecklich gesetzter Massstab gilt, auch wenn die Grafik dann ueber den
  // Rahmen hinausragt: das Brustbild im Spielerbanner ist 64 px breit und wird vom
  // Rahmen (innen 60 px) bewusst beschnitten (Fragment 2.3). Ohne Angabe wird gemessen.
  const s = opts.scale ? Math.max(1, Math.round(opts.scale)) : fitScale(el, bw, bh, 2);
  el.innerHTML = imgTag(cfg, { ...opts, gear: gearFor(opts.gear), scale: s });
}

/**
 * Menü-Bühne (Profil 8.1, Fortschritt 8.2/8.3): die ganze Figur mit der
 * angelegten Ausrüstung; ist ein Gefährte angelegt, steht er als Teil desselben
 * Bildes daneben. Atmet über den UI-Takt (data-ui="idle").
 */
export function stageHTMLFor(sd, gearMap, scale = 2) {
  const cfg = ensureAvatar(sd);
  const gefaehrte = gearMap && gearMap.companion
    ? { kind: petKind(cfg.pet), color: petColorHex(cfg.pet, cfg.petColor) } : null;
  return stageHTML(cfg, { gear: gearFor(gearMap), gefaehrte, scale });
}

// ────────────────────────────────────────────────
//  CHARAKTER-EDITOR (1.9, 1.10, 8.4–8.12)
//  Oben die Bühne (Figur und Gefährte 3×, atmend), darunter Reiter und Tafel:
//  Name der Option, Zähler, ‹ ›, falls vorhanden die Farbreihe, dann das
//  Kachel-Raster (jede Kachel zeigt die Figur mit allen aktuellen Einstellungen,
//  nur die Option der Kachel ist getauscht).
//  Profil (F-16): bearbeitet wird ein ENTWURF — „Speichern" übernimmt, Zurück
//  verwirft (bei Änderungen vorher die Rückfrage 8.12). Erster Start (F-15):
//  7 Reiter ohne Gefährte, „Los geht's!" übernimmt.
// ────────────────────────────────────────────────
const _FARBEN_HAAR = ['Schwarz', 'Dunkelbraun', 'Braun', 'Kupfer', 'Blond', 'Hellblond', 'Rot', 'Pink', 'Blau', 'Mint', 'Grau', 'Weiß'];
const _FARBEN_AUGE = ['Blau', 'Grün', 'Braun', 'Lila', 'Dunkel', 'Rot', 'Gold', 'Grau'];
const _FARBEN_STOFF = ['Lila', 'Blau', 'Grün', 'Rot', 'Gelb', 'Orange', 'Anthrazit', 'Creme', 'Pink', 'Petrol', 'Braun', 'Marine'];
const _HAUT = ['Hell', 'Rosé', 'Beige', 'Mittel', 'Karamell', 'Braun', 'Dunkelbraun', 'Tiefbraun', 'Mint', 'Moosgrün', 'Himmelblau', 'Nachtblau', 'Flieder', 'Rosa', 'Stein', 'Gold'];
const _STATUR = ['Schmal', 'Mittel', 'Kräftig'];

// Reiter: key des Merkmals, Namen, Farbe (optional), Ausschnitt + Maßstab der Kachel.
const _REITER = [
  { id: 'frisur', label: 'Frisur', icon: 'catHair', key: 'hair', namen: () => NEU_HAIR_N, art: 'kopf', s: 2,
    farbe: { key: 'hairC', label: 'Haarfarbe', namen: _FARBEN_HAAR, pal: () => NEU_HAIR } },
  { id: 'haut', label: 'Haut', icon: 'catSkin', key: 'skin', namen: () => _HAUT, art: 'kopf', s: 2,
    gruppen: [['Natürlich', 0, 8], ['Fantasie', 8, 16]] },
  { id: 'augen', label: 'Augen', icon: 'catEye', key: 'eyes', namen: () => NEU_EYES_N, art: 'gesicht', s: 3,
    farbe: { key: 'iris', label: '', namen: _FARBEN_AUGE, pal: () => NEU_IRIS, proZeile: 8 } },
  { id: 'mund', label: 'Mund', icon: 'catMouth', key: 'mouth', namen: () => NEU_MOUTH_N, art: 'gesicht', s: 3 },
  { id: 'oberteil', label: 'Oberteil', icon: 'catTop', key: 'top', namen: () => NEU_TOPS_N, art: 'oberkoerper', s: 2,
    farbe: { key: 'topC', label: 'Farbe', namen: _FARBEN_STOFF, pal: () => NEU_CLOTH } },
  { id: 'hose', label: 'Hose', icon: 'catPants', key: 'pants', namen: () => NEU_PANTS_N, art: 'beine', s: 2,
    farbe: { key: 'pantsC', label: 'Farbe', namen: _FARBEN_STOFF, pal: () => NEU_CLOTH } },
  { id: 'statur', label: 'Statur', icon: 'catBuild', key: 'build', namen: () => _STATUR, art: 'voll', s: 1, hoch: true },
  { id: 'gefaehrte', label: 'Gefährte', icon: 'paw', key: 'pet', namen: () => NEU_PETS.map((p) => p[1]), pet: true,
    farbe: { key: 'petColor', label: 'Farbe', namen: [1, 2, 3, 4, 5, 6].map((n) => 'Variante ' + n), pal: (cfg) => NEU_PETS[cfg.pet][2] } },
];

let _modus = 'profil';          // 'start' (1.9/1.10) | 'profil' (8.4–8.10)
let _reiter = 'frisur';
let _entwurf = null;             // bearbeitete Kopie von SD.avatar
let _vorher = '';                // Stand beim Öffnen (Vergleich für 8.12)

// Ob ein Gefährte freigespielt ist, sagt ui.js (avatar.js kennt die Schmiede nicht).
let _petInfo = { available: false, which: null };
export function setCharacterCompanion(info) {
  _petInfo = info || { available: false, which: null };
}

/** Editor öffnen: modus 'start' (erster Start) oder 'profil'. */
export function charEditorOeffnen(modus) {
  _modus = modus === 'start' ? 'start' : 'profil';
  _reiter = 'frisur';
  const cfg = ensureAvatar(window.SD);
  _entwurf = { ...cfg };
  _vorher = JSON.stringify(cfg);
}
/** Hat der Entwurf Änderungen gegenüber dem Stand beim Öffnen? */
export function charEditorGeaendert() {
  return !!_entwurf && JSON.stringify(_entwurf) !== _vorher;
}
/** Entwurf übernehmen: in den Spielstand schreiben und synchronisieren. */
export function charEditorUebernehmen() {
  const sd = window.SD;
  if (!sd || !_entwurf) return;
  sd.avatar = { ..._entwurf };
  _vorher = JSON.stringify(sd.avatar);
  persist(sd);
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
  renderAvatarInto('menu-avatar', sd, { bust: true, scale: 2 });
  renderAvatarInto('prof-avatar', sd, { bust: true, scale: 2 });
}

// Rückfrage 8.12. Liefert 'speichern' | 'ohne' | null (Zurück-Taste schließt).
export function charAenderungenFragen() {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'p-dlg-grund p-ce-grund';
    ov.innerHTML = `<div class="p-dlg-karte p-ce-karte" role="dialog" aria-label="Änderungen speichern?">
      <div class="p-ce-emblem">${iconHTML('pencil', 42)}</div>
      <div class="p-ce-titel">Änderungen speichern?</div>
      <div class="p-ce-text">Du hast deinen Charakter verändert. Ohne Speichern bleibt er so, wie er vorher war.</div>
      <div class="p-ce-knoepfe"><button class="p-ce-btn p-ce-btn--ohne">Ohne Speichern</button><button class="p-ce-btn p-ce-btn--ja">Speichern</button></div>
    </div>`;
    ov.querySelector('.p-ce-btn--ohne').onclick = () => { ov.remove(); resolve('ohne'); };
    ov.querySelector('.p-ce-btn--ja').onclick = () => { ov.remove(); resolve('speichern'); };
    document.body.appendChild(ov);
  });
}

const _aktiverReiter = () => _REITER.find((r) => r.id === _reiter) || _REITER[0];
const _sichtbareReiter = () => (_modus === 'start' ? _REITER.filter((r) => !r.pet) : _REITER);

export function renderCharacter() {
  const sd = window.SD;
  if (!sd) return;
  if (!_entwurf) charEditorOeffnen(_modus);
  const scr = document.getElementById('character-screen');
  if (scr) { scr.classList.toggle('ist-start', _modus === 'start'); scr.classList.toggle('ist-profil', _modus !== 'start'); }
  const nm = document.getElementById('char-name-text');
  if (nm) nm.textContent = sd.playerName || 'Spieler';
  _renderBuehne();
  _renderReiter();
  _renderTafel();
}

function _renderBuehne() {
  const fig = document.getElementById('character-canvas');
  if (fig) { fig.innerHTML = editorFigurHTML(_entwurf, 3); paintStages(fig); }
  const pet = document.getElementById('character-pet-canvas');
  if (!pet) return;
  if (_modus === 'start') { pet.innerHTML = ''; pet.style.display = 'none'; return; }
  pet.style.display = '';
  if (_petInfo.available) { pet.innerHTML = editorPetHTML(_entwurf.pet, _entwurf.petColor, 3); paintStages(pet); }
  else pet.innerHTML = '<div class="ce-kein-pet"><span class="ce-kein-pet-chip">Noch kein Gefährte</span><span class="ce-kein-pet-platz"></span></div>';
}

function _renderReiter() {
  const el = document.getElementById('ce-reiter');
  if (!el) return;
  el.innerHTML = _sichtbareReiter().map((r) => `<button class="ce-reiter-tab${r.id === _reiter ? ' is-aktiv' : ''}" role="tab"`
    + ` aria-selected="${r.id === _reiter}" aria-label="${r.label}" onclick="charReiter('${r.id}')">${iconHTML(r.icon, 28)}</button>`).join('');
}

function _renderTafel() {
  const el = document.getElementById('ce-tafel');
  if (!el) return;
  const r = _aktiverReiter();
  const namen = r.namen();
  const n = NEUE_COUNTS[r.key];
  const gesperrt = r.pet && !_petInfo.available;
  const v = _entwurf[r.key];
  let html = `<div class="ce-tafel-kopf">
      <div class="ce-tafel-text"><div class="ce-tafel-kat">${r.label}</div>
        <div class="ce-tafel-name">${gesperrt ? 'Noch keiner freigespielt' : namen[v]}</div></div>
      <span class="ce-zaehler${gesperrt ? ' is-aus' : ''}">${gesperrt ? 0 : v + 1} / ${n}</span>
      <button class="ce-pfeil${gesperrt ? ' is-aus' : ''}" aria-label="Vorherige" onclick="charSchritt(-1)"${gesperrt ? ' disabled' : ''}>‹</button>
      <button class="ce-pfeil${gesperrt ? ' is-aus' : ''}" aria-label="Nächste" onclick="charSchritt(1)"${gesperrt ? ' disabled' : ''}>›</button>
    </div>`;
  if (gesperrt) {
    // 8.10: Hinweis mit „Zur Schmiede" (F-60), darunter alle Gefährten als Silhouette.
    html += `<div class="ce-pet-hinweis"><img src="vondu-logo.svg" alt="Vondu" width="48" height="46" data-ui="bob" data-a="1">
        <div class="ce-pet-hinweis-text"><div class="ce-pet-hinweis-titel">Noch kein Gefährte</div>
          <div class="ce-pet-hinweis-sub">Deinen Gefährten schmiedest du selbst: Füll in der Schmiede die Station „Gefährte“ mit Wörtern und schmiede sie fertig.</div>
          <button class="ce-zur-schmiede" onclick="charZurSchmiede()">${iconHTML('hammer', 14)}Zur Schmiede</button></div></div>
      <div class="ce-gruppe is-weiter"><span>Diese Gefährten warten auf dich</span><span>${n}</span></div>
      <div class="ce-kacheln">${namen.map((name, i) => `<div class="ce-kachel" aria-label="${name} · noch nicht freigespielt">
        <img src="${petURL(i, 0, { scale: 2, locked: true })}" alt="" style="image-rendering:pixelated;display:block"></div>`).join('')}</div>`;
    el.innerHTML = html;
    return;
  }
  if (r.farbe) {
    const f = r.farbe, pal = f.pal(_entwurf), fw = _entwurf[f.key];
    if (f.label) html += `<div class="ce-gruppe"><span>${f.label}</span><span>${f.namen[fw] || ''}</span></div>`;
    html += `<div class="ce-farben${f.label ? '' : ' ohne-titel'}" style="grid-template-columns:repeat(${f.proZeile || 6},minmax(0,1fr))">`
      + pal.map((hex, i) => `<button class="ce-farbe${i === fw ? ' is-aktiv' : ''}" aria-label="${f.namen[i] || ''}" onclick="charFarbe('${f.key}',${i})"><span style="background:${hex}"></span></button>`).join('')
      + '</div>';
  }
  const kachel = (i) => `<button class="ce-kachel${r.hoch ? ' is-hoch' : ''}${i === v ? ' is-aktiv' : ''}" aria-label="${namen[i]}" data-i="${i}" onclick="charOption(${i})">`
    + `<img class="ce-kachel-bild" alt="" style="image-rendering:pixelated;display:block">`
    + `<span class="ce-haken">${iconHTML('check', 14)}</span></button>`;
  if (r.gruppen) {
    html += r.gruppen.map(([titel, a, b], gi) => `<div class="ce-gruppe${gi ? ' is-weiter' : ''}"><span>${titel}</span><span>${b - a}</span></div>`
      + `<div class="ce-kacheln">${Array.from({ length: b - a }, (_, k) => kachel(a + k)).join('')}</div>`).join('');
  } else {
    html += `<div class="ce-kacheln">${Array.from({ length: n }, (_, i) => kachel(i)).join('')}</div>`;
  }
  el.innerHTML = html;
  _fuelleKacheln(el, r);
}

// Kachel-Bilder in kleinen Portionen zeichnen (eine Figur kostet einige ms) —
// ein neuerer Aufruf bricht ältere ab.
let _fuellLauf = 0;
function _fuelleKacheln(el, r) {
  const lauf = ++_fuellLauf;
  const imgs = [...el.querySelectorAll('.ce-kachel[data-i] .ce-kachel-bild')];
  const cfg = { ..._entwurf };
  let i = 0;
  const schritt = () => {
    if (lauf !== _fuellLauf) return;
    for (let n = 0; n < 4 && i < imgs.length; n++, i++) {
      const v = +imgs[i].parentElement.dataset.i;
      imgs[i].src = r.pet ? petURL(v, cfg.petColor, { scale: 2 }) : kachelURL({ ...cfg, [r.key]: v }, r.art, r.s);
    }
    if (i < imgs.length) requestAnimationFrame(schritt);
  };
  schritt();
}

// Auswahl ohne neue Bilder: Markierung, Zähler und Name nachziehen.
function _markiere() {
  const r = _aktiverReiter(), v = _entwurf[r.key];
  document.querySelectorAll('#ce-tafel .ce-kachel[data-i]').forEach((k) => k.classList.toggle('is-aktiv', +k.dataset.i === v));
  const z = document.querySelector('#ce-tafel .ce-zaehler');
  if (z) z.textContent = `${v + 1} / ${NEUE_COUNTS[r.key]}`;
  const nm = document.querySelector('#ce-tafel .ce-tafel-name');
  if (nm) nm.textContent = r.namen()[v];
}

export function charReiter(id) {
  if (!_REITER.some((r) => r.id === id)) return;
  _reiter = id;
  _renderReiter();
  _renderTafel();
}
export function charOption(v) {
  const r = _aktiverReiter();
  _entwurf[r.key] = wrapK(r.key, v);
  // Beim Gefährten hängt die Farbreihe am Tier — dann die Tafel neu.
  if (r.pet) _renderTafel(); else _markiere();
  _renderBuehne();
}
export function charSchritt(dir) {
  const r = _aktiverReiter();
  charOption(_entwurf[r.key] + dir);
}
export function charFarbe(key, i) {
  if (!(key in NEUE_COUNTS)) return;
  _entwurf[key] = wrapK(key, i);
  _renderTafel();   // alle Kacheln zeigen die neue Farbe
  _renderBuehne();
}

// Beim Öffnen: erster Reiter (Merkmal) wieder anwählen.
export function resetCharacterFeature() { _reiter = 'frisur'; }
