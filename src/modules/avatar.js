// src/modules/avatar.js
// Charakter-Avatar in LO-FI PIXEL ART (moderner Indie-Stil à la Celeste /
// Hyper Light Drifter): 32×48-Sprite-Raster, shape-rendering:crispEdges,
// ganzzahlige Pixel, KEIN Anti-Aliasing.
//
// Stilregeln (Art-Direction):
// - minimalistisch: Augen als 1–2px-Punkte, Mund/Nase nur angedeutet
// - großer Kopf (~1/3 der Höhe), einfache Gliedmaßen, weiche Silhouetten
// - Flat Shading: max. 3 Helligkeitsstufen pro Fläche, Schatten per Dithering
// - 1px-Outline im DUNKLEREN TON der Füllfarbe (keine schwarzen Outlines)
// - Kleidung: Graustufen-Platzhalter (max. 6 Stufen) bis die Palette steht;
//   Haut-/Haarfarbe bleiben echte Farben (wählbare Merkmale, keine Palette)
//
// Datenmodell unverändert: SD.avatar = {skin,hair,eyes,nose,mouth,ears,build}
// (je 0..9), API avatarSVG/renderAvatarInto kompatibel — kein Sync-Umbau.

import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';

// Reihenfolge + Beschriftung der Einstell-Zeilen; anchor = vertikale Position der
// Pfeile (% der Sprite-Höhe, 48 Rasterzeilen) am jeweils veränderten Körperteil.
export const AVATAR_FEATURES = [
  { key: 'hair',  icon: '💇', label: 'Haare',     anchor: 8 },
  { key: 'eyes',  icon: '👀', label: 'Augen',     anchor: 25 },
  { key: 'ears',  icon: '👂', label: 'Ohren',     anchor: 28 },
  { key: 'nose',  icon: '👃', label: 'Nase',      anchor: 31 },
  { key: 'mouth', icon: '👄', label: 'Mund',      anchor: 36 },
  { key: 'skin',  icon: '🖐️', label: 'Hautfarbe', anchor: 50 },
  { key: 'build', icon: '🧍', label: 'Statur',    anchor: 70 },
];

const COUNT = 10; // je Merkmal 10 Stufen

const SKIN = ['#FFE0C4','#F7CEA6','#EEB98A','#E0A26B','#CC8A52','#B27440','#965E31','#7C4A26','#5E3719','#FFD2B0'];
// Graustufen-Platzhalter für Kleidung/Akzente (max. 6 Stufen laut Art-Direction).
const G = ['#e8e8e8','#c4c4c4','#9a9a9a','#6e6e6e','#4a4a4a','#2c2c2c'];

export function defaultAvatar() {
  return { skin: 0, build: 4, hair: 0, eyes: 0, nose: 0, mouth: 0, ears: 2 };
}

// Stellt sicher, dass sd.avatar existiert und alle Keys gültig (0..9) sind.
export function ensureAvatar(sd) {
  const d = defaultAvatar();
  const a = (sd && typeof sd.avatar === 'object' && sd.avatar) ? sd.avatar : {};
  const out = {};
  for (const k of Object.keys(d)) {
    const v = Number(a[k]);
    out[k] = (Number.isInteger(v) && v >= 0 && v < COUNT) ? v : d[k];
  }
  if (sd) sd.avatar = out;
  return out;
}

const wrap = (n) => ((n % COUNT) + COUNT) % COUNT;

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
// Zu schmale/flache Formen (< 3px) bleiben schlichte Rechtecke.
function soft(x, y, w, h, c) {
  if (w < 3 || h < 3) return px(x, y, w, h, c);
  return px(x + 1, y, w - 2, 1, c) + px(x, y + 1, w, h - 2, c) + px(x + 1, y + h - 1, w - 2, 1, c);
}
// Weiche Form mit 1px-Outline im dunkleren Füllton.
function softO(x, y, w, h, c) {
  return soft(x - 1, y - 1, w + 2, h + 2, shade(c, 0.62)) + soft(x, y, w, h, c);
}
// Dithering (Schachbrett) — die dritte Helligkeitsstufe einer Fläche.
function dith(x, y, w, h, c) {
  let s = '';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((x + i + y + j) % 2 === 0) s += px(x + i, y + j, 1, 1, c);
  return s;
}

// ── Kopf (~1/3 der Höhe): x10..21 / y7..20, weiche Ecken ──
function headSVG(skin) {
  return softO(10, 7, 12, 14, skin)
    + dith(19, 16, 2, 4, shade(skin, 0.88));   // rechte Wangen-Schattierung
}
function neckSVG(skin) {
  return px(14, 21, 4, 2, skin) + px(14, 22, 4, 1, shade(skin, 0.8));
}

// ── Ohren: kleine seitliche Noppen [w, h, y, Ohrring?]; 6 = keine ──
const EARS = [
  [1, 2, 13, 0], [1, 3, 12, 0], [2, 2, 13, 0], [2, 3, 12, 0], [1, 2, 14, 0],
  [2, 2, 13, 1], null, [2, 4, 12, 0], [1, 2, 12, 0], [1, 3, 13, 1],
];
function earsSVG(i, skin) {
  const e = EARS[i];
  if (!e) return '';
  const [w, h, y, ring] = e;
  const d = shade(skin, 0.62);
  let s = '';
  s += px(10 - w, y, w, h, skin) + px(9 - w, y, 1, h, d);      // links + Außen-Outline
  s += px(22, y, w, h, skin) + px(22 + w, y, 1, h, d);         // rechts
  if (ring) s += px(10 - w, y + h, 1, 1, G[0]) + px(21 + w, y + h, 1, 1, G[0]);
  return s;
}

// ── Augen: 1–2px-Punkte (Herzstück des Stils), y12..13 ──
function eyesSVG(i) {
  const d = G[5];
  const two = (lx, rx, y, w, h) => px(lx, y, w, h, d) + px(rx, y, w, h, d);
  switch (i) {
    case 0: return two(13, 18, 12, 1, 2);                                     // Standard
    case 1: return two(13, 18, 13, 1, 1);                                     // Punkte
    case 2: return two(12, 19, 12, 1, 2);                                     // weit
    case 3: return two(14, 17, 12, 1, 2);                                     // eng
    case 4: return px(13, 12, 1, 2, d) + px(18, 13, 2, 1, d);                 // Zwinkern
    case 5: return two(12, 18, 13, 2, 1);                                     // fröhlich zu
    case 6: return two(12, 18, 12, 2, 1) + two(13, 18, 13, 1, 1);             // müde (Lid+Punkt)
    case 7: return two(12, 18, 12, 2, 2);                                     // groß
    case 8: return two(13, 18, 12, 1, 2)                                      // Brille
      + px(11, 11, 4, 1, G[3]) + px(17, 11, 4, 1, G[3])
      + px(11, 14, 4, 1, G[3]) + px(17, 14, 4, 1, G[3])
      + px(11, 12, 1, 2, G[3]) + px(14, 12, 1, 2, G[3])
      + px(17, 12, 1, 2, G[3]) + px(20, 12, 1, 2, G[3])
      + px(15, 12, 2, 1, G[3]);
    case 9: return two(13, 18, 14, 1, 1);                                     // tief/verträumt
  }
  return '';
}

// ── Nase: nur angedeutet (Hautton dunkler), viele Stufen fast unsichtbar ──
function noseSVG(i, skin) {
  const n = shade(skin, 0.82);
  switch (i) {
    case 0: return '';                                    // keine (Stil-Standard)
    case 1: return px(15, 15, 1, 1, n);
    case 2: return px(15, 15, 2, 1, n);
    case 3: return px(16, 14, 1, 2, n);
    case 4: return px(15, 16, 2, 1, n);
    case 5: return px(14, 15, 1, 1, n) + px(17, 15, 1, 1, n);
    case 6: return px(15, 14, 1, 3, n);
    case 7: return px(15, 14, 1, 1, n);
    case 8: return px(15, 15, 2, 2, shade(skin, 0.9));
    case 9: return px(16, 15, 1, 1, n);
  }
  return '';
}

// ── Mund: meist weggelassen bzw. minimal, y17..18 ──
function mouthSVG(i) {
  const d = G[5];
  switch (i) {
    case 0: return '';                                                        // keiner (Stil-Standard)
    case 1: return px(15, 17, 2, 1, d);
    case 2: return px(15, 17, 1, 1, d);
    case 3: return px(14, 17, 1, 1, d) + px(17, 17, 1, 1, d) + px(15, 18, 2, 1, d);   // Lächeln
    case 4: return px(15, 17, 2, 2, d);                                       // offen
    case 5: return px(14, 17, 4, 1, d);                                       // breit
    case 6: return px(14, 18, 1, 1, d) + px(17, 18, 1, 1, d) + px(15, 17, 2, 1, d);   // schmollend
    case 7: return px(15, 18, 2, 1, d);                                       // tief
    case 8: return px(16, 17, 2, 1, d);                                       // Smirk
    case 9: return px(15, 17, 2, 1, d) + px(15, 18, 2, 1, G[2]);              // Lippe (2 Stufen)
  }
  return '';
}

// ── Frisuren: Kappe + Varianten, Outline im dunkleren Haarton, Dither-Pony ──
function _cap(c) { return softO(9, 3, 14, 6, c); }
function _fringe(c) { return dith(10, 9, 12, 1, c); }
const HAIR = [
  { c: '#6B4423', draw: (c) => _cap(c) + _fringe(c) },                                     // 0 kurz braun
  { c: '#2b2b33', draw: (c) => px(10, 2, 1, 1, c) + px(13, 2, 1, 1, c) + px(16, 2, 1, 1, c)
      + px(19, 2, 1, 1, c) + _cap(c) },                                                    // 1 dunkel Stachel
  { c: '#E3C45A', draw: (c) => _cap(c) + _fringe(c) + softO(8, 8, 3, 18, c) + softO(21, 8, 3, 18, c) }, // 2 blond lang
  { c: '#5B3A1E', draw: (c) => _cap(c) + softO(13, 0, 6, 3, c) },                          // 3 braun Dutt
  { c: '#33302e', draw: (c) => _cap(c) + px(10, 2, 3, 1, c) + px(15, 2, 3, 1, c)
      + px(20, 2, 2, 1, c) + px(8, 8, 1, 3, c) + px(23, 8, 1, 3, c) },                     // 4 dunkel lockig
  null,                                                                                    // 5 Glatze
  { c: '#C0502A', draw: (c) => softO(9, 3, 14, 8, c) + softO(8, 9, 2, 6, c) + softO(22, 9, 2, 6, c) }, // 6 rot voll
  { c: '#6B4423', draw: (c) => _cap(c) + _fringe(c) + softO(23, 7, 3, 14, c) + px(23, 9, 3, 1, G[1]) }, // 7 Pferdeschwanz
  { c: '#2b2b33', draw: (c) => softO(7, 0, 18, 10, c) + softO(7, 9, 2, 5, c) + softO(23, 9, 2, 5, c) }, // 8 Afro
  { c: '#D9B84A', draw: (c) => _cap(c) + _fringe(c) + softO(8, 8, 3, 28, c) + softO(21, 8, 3, 28, c) }, // 9 blond sehr lang
];
function hairSVG(i) {
  const h = HAIR[i];
  if (!h) return '';
  return h.draw(h.c) + dith(10, 4, 12, 2, shade(h.c, 0.8));   // Dither-Schattierung in der Kappe
}

// ── Körper / Statur: Kleidung in Graustufen-Platzhaltern ──
// SH = halbe Schulterbreite, HIP = halbe Hüfte, LW = Beinbreite.
const BUILD = {
  SH:  [5, 5, 6, 6, 7, 7, 8, 8, 9, 9],
  HIP: [4, 4, 5, 5, 6, 6, 7, 7, 8, 8],
  LW:  [3, 3, 3, 3, 4, 4, 4, 4, 5, 5],
};
function bodySVG(i, skin) {
  const SH = BUILD.SH[i], HIP = BUILD.HIP[i], LW = BUILD.LW[i];
  const SHIRT = G[2], PANTS = G[4], SHOE = G[5];
  const armD = shade(SHIRT, 0.62);
  let s = '';
  // Arme (lange Ärmel, Hände in Hautfarbe) — Außenkante als dunkle Outline-Spalte
  const alx = 16 - SH - 2, arx = 16 + SH;
  s += px(alx, 23, 2, 8, SHIRT) + px(alx - 1, 23, 1, 9, armD) + px(alx, 31, 2, 2, skin);
  s += px(arx, 23, 2, 8, SHIRT) + px(arx + 2, 23, 1, 9, armD) + px(arx, 31, 2, 2, skin);
  // Rumpf (weiche Silhouette, Outline im dunkleren Ton, Dither-Schatten rechts unten)
  s += softO(16 - SH, 23, SH * 2, 11, SHIRT);
  s += dith(16 + SH - 4, 29, 4, 4, shade(SHIRT, 0.8));
  // Hüfte/Hose
  s += softO(16 - HIP, 35, HIP * 2, 3, PANTS);
  // Beine + Schuhe (Zehen 1px nach außen)
  const lx1 = 16 - HIP, lx2 = 16 + HIP - LW;
  s += px(lx1, 38, LW, 7, PANTS) + px(lx1 - 1, 38, 1, 7, shade(PANTS, 0.7));
  s += px(lx2, 38, LW, 7, PANTS) + px(lx2 + LW, 38, 1, 7, shade(PANTS, 0.7));
  s += px(lx1 - 1, 45, LW + 1, 2, SHOE);
  s += px(lx2, 45, LW + 1, 2, SHOE);
  return s;
}

// ────────────────────────────────────────────────
//  AUSRÜSTUNG AM SPRITE (Paperdoll-Layer)
//  gear = { weapon?, head?, body?, arms?, legs?, talisman?, ring?, companion? }
//  mit je {type, tier}; Stufen-Grau: Stahl dunkel, Gold hell, Verzaubert hellst
//  + weißer Funkel-Pixel. Alles Graustufen-Platzhalter bis die Palette steht.
// ────────────────────────────────────────────────
const TIER_G = { stahl: G[3], gold: G[1], verzaubert: G[0] };

function gearSVG(cfg, gear) {
  if (!gear) return '';
  const SH = BUILD.SH[cfg.build], HIP = BUILD.HIP[cfg.build], LW = BUILD.LW[cfg.build];
  const alx = 16 - SH - 2, arx = 16 + SH;
  const lx1 = 16 - HIP, lx2 = 16 + HIP - LW;
  let s = '';
  const col = (it) => TIER_G[it.tier] || G[3];
  const spark = (it, x, y) => it.tier === 'verzaubert' ? px(x, y, 1, 1, '#ffffff') : '';

  if (gear.body) {
    const c = col(gear.body);
    s += px(16 - SH, 23, SH * 2, 6, c) + px(16 - SH, 29, SH * 2, 1, shade(c, 0.62))
      + px(14, 23, 4, 1, shade(c, 0.75))                       // Halsausschnitt
      + dith(16 + SH - 4, 26, 3, 3, shade(c, 0.8))
      + spark(gear.body, 16 - SH + 1, 24);
  }
  if (gear.arms) {
    const c = col(gear.arms);
    s += px(alx, 30, 2, 3, c) + px(arx, 30, 2, 3, c)
      + px(alx, 30, 2, 1, shade(c, 0.62)) + px(arx, 30, 2, 1, shade(c, 0.62))
      + spark(gear.arms, alx, 31);
  }
  if (gear.legs) {
    const c = col(gear.legs);
    s += px(lx1 - 1, 43, LW + 1, 4, c) + px(lx2, 43, LW + 1, 4, c)
      + px(lx1 - 1, 43, LW + 1, 1, shade(c, 0.62)) + px(lx2, 43, LW + 1, 1, shade(c, 0.62))
      + spark(gear.legs, lx2 + LW - 1, 44);
  }
  if (gear.talisman) {
    const c = col(gear.talisman);
    s += px(14, 22, 1, 1, G[4]) + px(17, 22, 1, 1, G[4]) + px(15, 23, 2, 2, c)
      + spark(gear.talisman, 16, 23);
  }
  if (gear.ring) {
    s += px(alx, 31, 1, 1, col(gear.ring)) + spark(gear.ring, alx, 30);
  }
  if (gear.head) {
    const c = col(gear.head);
    s += soft(9, 3, 14, 6, c) + px(9, 8, 14, 1, shade(c, 0.62)) + dith(11, 4, 10, 2, shade(c, 0.82))
      + spark(gear.head, 20, 4);
  }
  if (gear.weapon && gear.weapon.type) {
    s += weaponSVG(gear.weapon, arx + 3);
  }
  if (gear.companion) {
    const c = col(gear.companion);
    s += soft(26, 42, 5, 4, c)                                  // Körper
      + px(27, 41, 1, 1, c) + px(29, 40, 1, 2, c)               // Ohren (asymmetrisch)
      + px(31, 43, 1, 2, shade(c, 0.75))                        // Schwanz
      + px(28, 43, 1, 1, G[5])                                  // Auge
      + spark(gear.companion, 26, 41);
  }
  return s;
}

// Waffe in der rechten Hand (senkrecht, Klinge nach oben), wx = Waffen-Spalte.
function weaponSVG(w, wx) {
  wx = Math.min(wx, 29);
  const c = TIER_G[w.tier] || G[3];
  const d = shade(c, 0.62);
  const grip = px(wx, 30, 1, 3, G[4]);
  let s = '';
  switch (w.type) {
    case 'schwert': s = grip + px(wx - 1, 29, 3, 1, d) + px(wx, 17, 1, 12, c) + px(wx, 16, 1, 1, '#ffffff'); break;
    case 'dolch':   s = grip + px(wx - 1, 29, 3, 1, d) + px(wx, 23, 1, 6, c); break;
    case 'speer':   s = px(wx, 14, 1, 19, G[4]) + px(wx - 1, 12, 3, 1, c) + px(wx, 11, 1, 1, c) + px(wx, 13, 1, 1, c); break;
    case 'axt':     s = px(wx, 16, 1, 17, G[4]) + px(wx - 3, 16, 3, 4, c) + px(wx - 4, 17, 1, 2, c); break;
    case 'hammer':  s = px(wx, 16, 1, 17, G[4]) + px(wx - 2, 15, 4, 4, c); break;
    case 'stab':    s = px(wx, 15, 1, 18, G[4]) + px(wx - 1, 12, 3, 3, c) + px(wx, 13, 1, 1, '#ffffff'); break;
    default: return '';
  }
  if (w.tier === 'verzaubert') s += px(wx + 1, 14, 1, 1, '#ffffff');
  return s;
}

// 16×16-Pixel-Icon eines geschmiedeten Objekts (fürs Inventar) — gleiche
// Stilregeln: weiche Silhouetten, Outline im dunkleren Ton, Stufen-Grau.
export function itemSpriteSVG(type, tier) {
  const c = TIER_G[tier] || G[3];
  const d = shade(c, 0.62);
  let s = '';
  switch (type) {
    case 'schwert':    s = px(7, 1, 2, 9, c) + px(7, 0, 2, 1, '#ffffff') + px(5, 10, 6, 1, d) + px(7, 11, 2, 4, G[4]); break;
    case 'dolch':      s = px(7, 3, 2, 6, c) + px(5, 9, 6, 1, d) + px(7, 10, 2, 4, G[4]); break;
    case 'speer':      s = px(7, 4, 2, 11, G[4]) + px(6, 2, 4, 2, c) + px(7, 0, 2, 2, c); break;
    case 'axt':        s = px(8, 2, 2, 12, G[4]) + px(3, 2, 5, 5, c) + px(2, 3, 1, 3, c); break;
    case 'hammer':     s = px(7, 4, 2, 10, G[4]) + px(4, 1, 8, 4, c); break;
    case 'stab':       s = px(7, 4, 2, 11, G[4]) + px(6, 1, 4, 4, c) + px(7, 2, 2, 2, '#ffffff'); break;
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
//  GESAMT-SVG (32×48)
//  Reihenfolge (hinten→vorne): Körper · Hals · Kopf · Ohren · Gesicht · Haare ·
//  Ausrüstung (opts.gear — Paperdoll: Helm über Haar, Waffe in der Hand …).
// ────────────────────────────────────────────────
export function avatarSVG(cfg, opts = {}) {
  const headOnly = !!opts.headOnly;
  const skin = SKIN[cfg.skin] || SKIN[0];
  const inner =
    (headOnly ? '' : bodySVG(cfg.build, skin)) +
    neckSVG(skin) +
    headSVG(skin) +
    earsSVG(cfg.ears, skin) +
    eyesSVG(cfg.eyes) +
    noseSVG(cfg.nose, skin) +
    mouthSVG(cfg.mouth) +
    hairSVG(cfg.hair) +
    (headOnly ? '' : gearSVG(cfg, opts.gear));
  const vb = headOnly ? '5 0 22 22' : '0 0 32 48';
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;">${inner}</svg>`;
}

export function renderAvatarInto(elId, sd, opts = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = avatarSVG(ensureAvatar(sd), opts);
}

// ────────────────────────────────────────────────
//  CHARAKTER-SCREEN (Anpassung)
//  UX: Merkmal-Chips oben, darunter ein 10er-KACHEL-GRID mit Live-Vorschau
//  jeder Variante (antippen = anziehen). Name als normales Eingabefeld,
//  das beim Tippen speichert — kein Popup mehr.
// ────────────────────────────────────────────────
let _activeFeature = 'hair';

export function renderCharacter() {
  const sd = window.SD;
  if (!sd) return;
  const cfg = ensureAvatar(sd);
  renderAvatarInto('character-canvas', sd, { headOnly: false });

  // Name: Eingabefeld befüllen (nur wenn nicht gerade darin getippt wird)
  const nameIn = document.getElementById('char-name-input');
  if (nameIn && document.activeElement !== nameIn) nameIn.value = sd.playerName || '';
  _wireNameInput();

  // Merkmal-Chips
  const chips = document.getElementById('character-feature-chips');
  if (chips) chips.innerHTML = AVATAR_FEATURES.map(f => {
    const on = f.key === _activeFeature;
    return `<button onclick="avatarPick('${f.key}')" style="flex:0 0 auto;font-family:'Fredoka One',cursive;font-size:.8rem;padding:7px 12px;border:none;border-radius:50px;cursor:pointer;white-space:nowrap;${on ? 'background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;box-shadow:0 3px 0 #7a4ba8;' : 'background:#f0e6ff;color:var(--purple);'}">${f.icon} ${f.label}</button>`;
  }).join('');

  // Varianten-Grid: jede Stufe als Mini-Vorschau, aktuelle markiert.
  const grid = document.getElementById('character-variants');
  if (grid) {
    const key = _activeFeature;
    const headKeys = ['hair', 'eyes', 'ears', 'nose', 'mouth', 'skin'];
    grid.innerHTML = Array.from({ length: COUNT }, (_, v) => {
      const preview = avatarSVG({ ...cfg, [key]: v }, { headOnly: headKeys.includes(key) });
      const on = cfg[key] === v;
      return `<button class="cg-tile${on ? ' sel' : ''}" onclick="avatarSet('${key}',${v})" aria-label="${key} ${v + 1}">${preview}</button>`;
    }).join('');
  }
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

// Merkmal auswählen (Chip) → Varianten-Grid wechselt.
export function avatarPick(key) {
  if (AVATAR_FEATURES.some(f => f.key === key)) _activeFeature = key;
  renderCharacter();
}

// Variante direkt setzen (Kachel im Grid).
export function avatarSet(key, v) {
  const sd = window.SD;
  const cfg = ensureAvatar(sd);
  if (!AVATAR_FEATURES.some(f => f.key === key) || !Number.isInteger(v)) return;
  cfg[key] = wrap(v);
  persist(sd);
  if (window.currentUser) markDirty('profile');   // Pending-Flag überlebt auch Hardware-Zurück
  renderCharacter();
  renderAvatarInto('menu-avatar', sd, { headOnly: true });
  renderAvatarInto('prof-avatar', sd, { headOnly: true });
}

// Alt-API (Pfeile ‹/›) — bleibt für Kompatibilität, nutzt jetzt avatarSet.
export function avatarArrow(dir) {
  const cfg = ensureAvatar(window.SD);
  avatarSet(_activeFeature, wrap(cfg[_activeFeature] + dir));
}

// Beim Öffnen Standard-Merkmal setzen.
export function resetCharacterFeature() { _activeFeature = 'hair'; }

// Beim Verlassen des Screens Cloud-Sync anstoßen (gesammelt, nicht pro Klick).
export function commitAvatar() {
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}
