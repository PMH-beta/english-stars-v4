// src/modules/avatar.js
// Charakter-Avatar im WINDOWS-95-PIXEL-STIL: prozedurales SVG auf einem festen
// 24×36-Pixelraster (shape-rendering:crispEdges), harte Flächenfarben, dunkle
// 1px-Outlines wie bei klassischen Sprite-Icons. Kein Bild-Asset, modular pro
// Merkmal: 7 Merkmale × je 10 Stufen — Daten liegen unverändert in
// SD.avatar = {skin,hair,eyes,nose,mouth,ears,build} (0..9), Sync kompatibel.
//
// Raster-Anatomie: Kopf x8..15 / y3..11 (Outline-Block 1px drumherum),
// Hals y12..13, Rumpf ab y14, Beine ab y25, Schuhe bis y35.

import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';

// Reihenfolge + Beschriftung der Einstell-Zeilen; anchor = vertikale Position der
// Pfeile (% der Ganzkörper-Höhe, 36 Rasterzeilen) am jeweils veränderten Körperteil.
export const AVATAR_FEATURES = [
  { key: 'hair',  icon: '💇', label: 'Haare',     anchor: 7 },
  { key: 'eyes',  icon: '👀', label: 'Augen',     anchor: 18 },
  { key: 'ears',  icon: '👂', label: 'Ohren',     anchor: 21 },
  { key: 'nose',  icon: '👃', label: 'Nase',      anchor: 24 },
  { key: 'mouth', icon: '👄', label: 'Mund',      anchor: 29 },
  { key: 'skin',  icon: '🖐️', label: 'Hautfarbe', anchor: 44 },
  { key: 'build', icon: '🧍', label: 'Statur',    anchor: 64 },
];

const COUNT = 10; // je Merkmal 10 Stufen

const SKIN = ['#FFE0C4','#F7CEA6','#EEB98A','#E0A26B','#CC8A52','#B27440','#965E31','#7C4A26','#5E3719','#FFD2B0'];

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
const OUT = '#1a1a2e';                 // Outline-Dunkel (fast schwarz, leicht blau)
const px = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
// Block mit 1px-Outline drumherum (Outline zuerst, Füllung darüber).
const bo = (x, y, w, h, c) => px(x - 1, y - 1, w + 2, h + 2, OUT) + px(x, y, w, h, c);

// ── Kopf & Hals ────────────────────────────────
function headSVG(skin) {
  return px(7, 2, 10, 11, OUT)         // Outline-Block (Rand + Kinnzeile y12)
    + px(8, 3, 8, 9, skin);            // Gesicht x8..15 / y3..11
}
function neckSVG(skin) {
  return px(10, 12, 4, 2, skin);       // Hals durchbricht die Kinn-Outline
}

// ── Ohren: [Breite, Höhe, y, Ohrring?] ─────────
const EARS = [
  [1, 2, 7, 0], [1, 3, 6, 0], [2, 2, 7, 0], [2, 3, 6, 0], [1, 2, 8, 0],
  [2, 3, 7, 1], [1, 1, 7, 0], [3, 3, 6, 0], [1, 2, 6, 0], [2, 2, 7, 1],
];
function earsSVG(i, skin) {
  const [w, h, y, ring] = EARS[i];
  let s = '';
  s += px(7 - w, y - 1, w + 1, h + 2, OUT) + px(8 - w, y, w, h, skin);   // links
  s += px(16, y - 1, w + 1, h + 2, OUT) + px(16, y, w, h, skin);         // rechts
  if (ring) s += px(8 - w, y + h + 1, 1, 1, '#ffd43b') + px(15 + w, y + h + 1, 1, 1, '#ffd43b');
  return s;
}

// ── Augen (linkes Auge x9, rechtes x13, y6) ────
function _eyeOpen(x, iris) {
  return px(x, 6, 2, 2, '#ffffff') + px(x + 1, 7, 1, 1, iris);
}
function _lensFrame(x) {                 // hohler 4×4-Brillenrahmen
  return px(x, 5, 4, 1, OUT) + px(x, 8, 4, 1, OUT) + px(x, 5, 1, 4, OUT) + px(x + 3, 5, 1, 4, OUT);
}
function eyesSVG(i) {
  switch (i) {
    case 0: return _eyeOpen(9, '#5b3a1e') + _eyeOpen(13, '#5b3a1e');
    case 1: return px(9, 5, 2, 3, '#ffffff') + px(10, 7, 1, 1, '#3b82d6')
      + px(13, 5, 2, 3, '#ffffff') + px(13, 7, 1, 1, '#3b82d6');
    case 2: return px(10, 7, 1, 1, OUT) + px(13, 7, 1, 1, OUT);                     // Punkte
    case 3: return px(9, 7, 2, 1, OUT) + px(13, 7, 2, 1, OUT);                      // fröhlich zu
    case 4: return _eyeOpen(9, '#5b3a1e') + px(13, 7, 2, 1, OUT);                   // Zwinkern
    case 5: return _lensFrame(8) + _lensFrame(12) + px(7, 6, 1, 1, OUT) + px(16, 6, 1, 1, OUT)
      + px(9, 6, 2, 2, '#ffffff') + px(10, 7, 1, 1, '#3a3a3a')
      + px(13, 6, 2, 2, '#ffffff') + px(13, 7, 1, 1, '#3a3a3a');                    // Brille
    case 6: return px(8, 6, 3, 2, OUT) + px(13, 6, 3, 2, OUT) + px(11, 6, 2, 1, OUT)
      + px(9, 6, 1, 1, '#6a7a9a') + px(14, 6, 1, 1, '#6a7a9a');                     // Sonnenbrille
    case 7: return _eyeOpen(9, '#2aa05a') + _eyeOpen(13, '#2aa05a');
    case 8: return px(9, 5, 2, 1, OUT) + px(13, 5, 2, 1, OUT)                       // Brauen
      + _eyeOpen(9, '#222222') + _eyeOpen(13, '#222222');
    case 9: return px(9, 6, 2, 1, '#ffffff') + px(9, 7, 2, 1, OUT)
      + px(13, 6, 2, 1, '#ffffff') + px(13, 7, 2, 1, OUT);                          // müde
  }
  return '';
}

// ── Nasen (Mitte x11..12, y8) ──────────────────
const NOSE_SH = '#00000038';
function noseSVG(i) {
  switch (i) {
    case 0: return px(11, 8, 1, 2, NOSE_SH);
    case 1: return px(11, 9, 2, 1, NOSE_SH);
    case 2: return px(12, 8, 1, 2, NOSE_SH) + px(11, 9, 1, 1, NOSE_SH);   // Haken
    case 3: return px(11, 8, 2, 2, NOSE_SH);                              // groß
    case 4: return '';                                                    // keine
    case 5: return px(10, 9, 1, 1, NOSE_SH) + px(13, 9, 1, 1, NOSE_SH);   // Nüstern
    case 6: return px(11, 8, 2, 2, '#d46a6a');                            // rot
    case 7: return px(11, 7, 1, 3, NOSE_SH);                              // lang
    case 8: return px(11, 9, 2, 1, OUT);                                  // markant
    case 9: return px(12, 9, 1, 1, NOSE_SH);                              // winzig
  }
  return '';
}

// ── Münder (y10, Kinn y11) ─────────────────────
function mouthSVG(i) {
  const lip = '#b23a5f';
  switch (i) {
    case 0: return px(9, 9, 1, 1, OUT) + px(14, 9, 1, 1, OUT) + px(10, 10, 4, 1, OUT);      // Lächeln
    case 1: return px(10, 10, 4, 2, OUT) + px(11, 11, 2, 1, '#e0607e');                     // lachend offen
    case 2: return px(10, 10, 4, 1, OUT);                                                   // neutral
    case 3: return px(11, 10, 2, 2, OUT);                                                   // „oh"
    case 4: return px(9, 10, 6, 1, OUT) + px(10, 11, 4, 1, '#ffffff');                      // Grinsen (Zähne)
    case 5: return px(9, 9, 1, 1, OUT) + px(14, 9, 1, 1, OUT) + px(10, 10, 4, 1, OUT)
      + px(11, 11, 2, 1, '#f08a9b');                                                        // Zunge raus
    case 6: return px(9, 11, 1, 1, OUT) + px(14, 11, 1, 1, OUT) + px(10, 10, 4, 1, OUT);    // schmollend
    case 7: return px(10, 10, 4, 1, '#d4547a') + px(11, 11, 2, 1, lip);                     // Lippen
    case 8: return px(11, 10, 3, 1, OUT) + px(14, 9, 1, 1, OUT);                            // Smirk
    case 9: return px(9, 9, 6, 1, '#5b3a1e') + px(10, 11, 4, 1, OUT);                       // Schnurrbart
  }
  return '';
}

// ── Frisuren ───────────────────────────────────
// Jede Frisur = Pixelblöcke mit bo()-Outline; Pony-Fransen als 1px-Dither.
function _cap(c) { return bo(8, 2, 8, 2, c); }
function _fringe(c) { return px(8, 4, 1, 1, c) + px(10, 4, 1, 1, c) + px(12, 4, 1, 1, c) + px(14, 4, 1, 1, c); }
const HAIR = [
  { c: '#6B4423', draw: (c) => _cap(c) + _fringe(c) },                                     // 0 kurz braun
  { c: '#1C1C1C', draw: (c) => px(8, 1, 1, 1, c) + px(10, 1, 1, 1, c) + px(12, 1, 1, 1, c)
      + px(14, 1, 1, 1, c) + _cap(c) },                                                    // 1 schwarz Stachel
  { c: '#E3C45A', draw: (c) => _cap(c) + _fringe(c) + bo(6, 4, 2, 12, c) + bo(16, 4, 2, 12, c) }, // 2 blond lang
  { c: '#5B3A1E', draw: (c) => _cap(c) + bo(10, 0, 4, 2, c) },                             // 3 braun Dutt
  { c: '#222222', draw: (c) => _cap(c) + px(8, 1, 2, 1, c) + px(11, 1, 2, 1, c)
      + px(14, 1, 2, 1, c) + px(7, 4, 1, 2, c) + px(16, 4, 1, 2, c) },                     // 4 schwarz lockig
  null,                                                                                    // 5 Glatze
  { c: '#C0502A', draw: (c) => bo(8, 2, 8, 3, c) + bo(7, 4, 1, 5, c) + bo(16, 4, 1, 5, c) }, // 6 rot voll
  { c: '#6B4423', draw: (c) => _cap(c) + _fringe(c) + bo(17, 4, 2, 8, c) + px(17, 4, 2, 1, '#d4a017') }, // 7 Pferdeschwanz
  { c: '#1A1A1A', draw: (c) => bo(7, 0, 10, 5, c) + bo(6, 2, 1, 6, c) + bo(17, 2, 1, 6, c) },  // 8 schwarz Afro
  { c: '#D9B84A', draw: (c) => _cap(c) + _fringe(c) + bo(6, 4, 2, 19, c) + bo(16, 4, 2, 19, c) }, // 9 blond sehr lang
];
function hairSVG(i) {
  const h = HAIR[i];
  if (!h) return px(10, 3, 1, 1, '#ffffff59');   // Glatze: kleiner Glanzpunkt
  return h.draw(h.c);
}

// ── Körper / Statur ────────────────────────────
// SH = halbe Schulterbreite, HIP = halbe Hüfte, LW = Beinbreite (Rasterpixel).
const BUILD = {
  SH:  [3, 3, 4, 4, 5, 5, 6, 6, 7, 7],
  HIP: [2, 3, 3, 3, 4, 4, 5, 5, 6, 6],
  LW:  [2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
};
function bodySVG(i, skin) {
  const SH = BUILD.SH[i], HIP = BUILD.HIP[i], LW = BUILD.LW[i];
  const SHIRT = '#2f6df6', SHIRT_D = '#1f4fc0', PANTS = '#3a4160', SHOE = '#4a3422';
  let s = '';
  // Arme (Outline-Säulen, kurzärmlig: 3 Zeilen Shirt, dann Haut)
  s += px(12 - SH - 3, 13, 3, 10, OUT) + px(12 - SH - 2, 14, 2, 3, SHIRT) + px(12 - SH - 2, 17, 2, 5, skin);
  s += px(12 + SH, 13, 3, 10, OUT) + px(12 + SH + 1, 14, 2, 3, SHIRT) + px(12 + SH + 1, 17, 2, 5, skin);
  // Rumpf (Shirt) mit rechter Schattenkante — klassisches Icon-Shading
  s += px(12 - SH - 1, 13, SH * 2 + 2, 9, OUT);
  s += px(12 - SH, 14, SH * 2, 7, SHIRT);
  s += px(12 + SH - 2, 14, 2, 7, SHIRT_D);
  // Hüfte/Hose
  s += px(12 - HIP - 1, 21, HIP * 2 + 2, 4, OUT) + px(12 - HIP, 22, HIP * 2, 3, PANTS);
  // Beine + Schuhe
  for (const lx of [12 - HIP, 12 + HIP - LW]) {
    s += px(lx - 1, 24, LW + 2, 9, OUT) + px(lx, 25, LW, 8, PANTS);
    s += px(lx - 2, 32, LW + 4, 4, OUT) + px(lx - 1, 33, LW + 2, 2, SHOE);
  }
  return s;
}

// ────────────────────────────────────────────────
//  GESAMT-SVG
//  Reihenfolge (hinten→vorne): Körper · Hals · Kopf · Ohren · Gesicht · Haare.
//  Haare zuletzt → lange Frisuren fallen VOR die Schultern (Pixel-Look erlaubt das).
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
    noseSVG(cfg.nose) +
    mouthSVG(cfg.mouth) +
    hairSVG(cfg.hair);
  const vb = headOnly ? '3 0 18 16' : '0 0 24 36';
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;">${inner}</svg>`;
}

export function renderAvatarInto(elId, sd, opts = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = avatarSVG(ensureAvatar(sd), opts);
}

// ────────────────────────────────────────────────
//  CHARAKTER-SCREEN (Anpassung)
//  Großer Charakter + Pfeile links/rechts auf Höhe des veränderten Körperteils.
// ────────────────────────────────────────────────
let _activeFeature = 'hair';

export function renderCharacter() {
  const sd = window.SD;
  if (!sd) return;
  const cfg = ensureAvatar(sd);
  renderAvatarInto('character-canvas', sd, { headOnly: false });

  const nameEl = document.getElementById('char-player-name');
  if (nameEl) nameEl.textContent = sd.playerName || 'Spieler';

  const feat = AVATAR_FEATURES.find(f => f.key === _activeFeature) || AVATAR_FEATURES[0];

  // Pfeile auf Höhe des Körperteils positionieren
  const aL = document.getElementById('char-arrow-left');
  const aR = document.getElementById('char-arrow-right');
  if (aL && aR) { aL.style.top = feat.anchor + '%'; aR.style.top = feat.anchor + '%'; }

  // Merkmal-Chips
  const chips = document.getElementById('character-feature-chips');
  if (chips) chips.innerHTML = AVATAR_FEATURES.map(f => {
    const on = f.key === _activeFeature;
    return `<button onclick="avatarPick('${f.key}')" style="flex:0 0 auto;font-family:'Fredoka One',cursive;font-size:.8rem;padding:7px 12px;border:none;border-radius:50px;cursor:pointer;white-space:nowrap;${on ? 'background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;box-shadow:0 3px 0 #7a4ba8;' : 'background:#f0e6ff;color:var(--purple);'}">${f.icon} ${f.label}</button>`;
  }).join('');

  // Beschriftung + Stand
  const lbl = document.getElementById('character-feature-label');
  if (lbl) {
    const swatch = feat.key === 'skin'
      ? `<span style="display:inline-block;width:18px;height:18px;border-radius:4px;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;vertical-align:middle;margin-right:6px;background:${SKIN[cfg.skin]}"></span>`
      : '';
    lbl.innerHTML = `${feat.icon} <b>${feat.label}</b> &nbsp; ${swatch}<span style="color:var(--purple);font-weight:800;">${cfg[feat.key] + 1} / ${COUNT}</span>`;
  }
}

// Merkmal auswählen (Chip) → Pfeile springen ans Körperteil.
export function avatarPick(key) {
  if (AVATAR_FEATURES.some(f => f.key === key)) _activeFeature = key;
  renderCharacter();
}

// Pfeil ‹/› ändert das aktuell gewählte Merkmal.
export function avatarArrow(dir) {
  const sd = window.SD;
  const cfg = ensureAvatar(sd);
  cfg[_activeFeature] = wrap(cfg[_activeFeature] + dir);
  persist(sd);
  if (window.currentUser) markDirty('profile');   // Pending-Flag überlebt auch Hardware-Zurück
  renderCharacter();
  renderAvatarInto('menu-avatar', sd, { headOnly: true });
  renderAvatarInto('prof-avatar', sd, { headOnly: true });
}

// Beim Öffnen Standard-Merkmal setzen.
export function resetCharacterFeature() { _activeFeature = 'hair'; }

// Beim Verlassen des Screens Cloud-Sync anstoßen (gesammelt, nicht pro Klick).
export function commitAvatar() {
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}
