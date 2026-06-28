// src/modules/avatar.js
// Charakter-Avatar: prozedurales SVG (kein Bild-Asset), modular pro Merkmal.
// 7 Merkmale × je 10 Stufen — Daten liegen in SD.avatar = {skin,hair,eyes,nose,mouth,ears,build}.
// Kopf-Koordinaten sind fix (cx=100), nur Hautfarbe + Statur (Körper) variieren echt.

import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';

// Reihenfolge + Beschriftung der Einstell-Zeilen; anchor = vertikale Position der
// Pfeile (% der Ganzkörper-Höhe) am jeweils veränderten Körperteil.
export const AVATAR_FEATURES = [
  { key: 'hair',  icon: '💇', label: 'Haare',     anchor: 11 },
  { key: 'eyes',  icon: '👀', label: 'Augen',     anchor: 22 },
  { key: 'ears',  icon: '👂', label: 'Ohren',     anchor: 24 },
  { key: 'nose',  icon: '👃', label: 'Nase',      anchor: 25 },
  { key: 'mouth', icon: '👄', label: 'Mund',      anchor: 30 },
  { key: 'skin',  icon: '🖐️', label: 'Hautfarbe', anchor: 46 },
  { key: 'build', icon: '🧍', label: 'Statur',    anchor: 68 },
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
//  SVG-TEILE (Kopf fix: cx=100, cy=86, rx=46, ry=50)
// ────────────────────────────────────────────────
function earsSVG(i, skin) {
  const S = [
    [9,11,88,0],[7,9,88,0],[10,13,88,0],[12,15,89,0],[8,12,86,0],
    [11,16,90,0],[9,13,87,1],[13,17,90,0],[6,8,88,0],[10,14,86,1],
  ][i];
  const [rx, ry, y, pointy] = S;
  let out = '';
  for (const x of [54, 146]) {
    if (pointy) {
      const dir = x < 100 ? -1 : 1;
      out += `<path d="M${x},${y - ry} Q${x + dir * rx},${y} ${x},${y + ry} Q${x - dir * 2},${y} ${x},${y - ry} Z" fill="${skin}" stroke="#0002"/>`;
    } else {
      out += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${skin}" stroke="#0002"/>`;
      out += `<ellipse cx="${x}" cy="${y}" rx="${rx * 0.45}" ry="${ry * 0.5}" fill="#0001"/>`;
    }
  }
  return out;
}

function headSVG(skin) {
  return `<ellipse cx="100" cy="86" rx="46" ry="50" fill="${skin}" stroke="#0002" stroke-width="1.5"/>`;
}

function neckSVG(skin) {
  return `<rect x="91" y="128" width="18" height="34" rx="6" fill="${skin}" stroke="#0001"/>`;
}

// ── Haare ──────────────────────────────────────
// Jede Frisur: { c, back, extra } + immer eine solide Kappe (deckt die Stirn ab → kein Loch).
//  back  = vor dem Kopf-Hintergrund, ABER vor dem Hals gezeichnet (Länge fällt vor die Schultern, Hals bleibt frei)
//  extra = nach dem Gesicht (Dutt etc.), dann zuletzt die Kappe.
function vol(c)        { return `<ellipse cx="100" cy="72" rx="52" ry="50" fill="${c}"/>`; }
function longHair(c, bY) {
  const w = 18;
  return vol(c)
    + `<rect x="42" y="66" width="${w}" height="${bY - 66}" rx="9" fill="${c}"/>`
    + `<rect x="${200 - 42 - w}" y="66" width="${w}" height="${bY - 66}" rx="9" fill="${c}"/>`;
}
function spikes(c) {
  let p = '';
  for (let k = 0; k <= 6; k++) { const x = 60 + k * 13; p += `<path d="M${x - 7},58 L${x},28 L${x + 7},58 Z" fill="${c}"/>`; }
  return p + `<ellipse cx="100" cy="68" rx="50" ry="44" fill="${c}"/>`;
}
function curls(c) {
  let p = '';
  for (const [x, y] of [[60,60],[72,42],[90,34],[110,34],[128,42],[140,60],[146,78],[54,78]]) p += `<circle cx="${x}" cy="${y}" r="15" fill="${c}"/>`;
  return p;
}
function afro(c)     { return `<ellipse cx="100" cy="60" rx="60" ry="56" fill="${c}"/>`; }
function ponytail(c) { return `<path d="M150,72 q30,6 24,48 q-6,20 -20,15 q14,-34 -10,-58 Z" fill="${c}"/>`; }
function bun(c)      { return `<circle cx="100" cy="30" r="15" fill="${c}"/>`; }
// Solide Stirn-Kappe (immer, außer Glatze) — Haaransatz bei ~y60, deckt Stirn voll ab.
function cap(c) {
  return `<path d="M51,90 C47,32 153,32 149,90 C149,66 132,58 100,58 C68,58 51,66 51,90 Z" fill="${c}"/>`;
}

const HAIR = [
  { c: '#6B4423', back: '',                    extra: '' },                  // 0 kurz braun
  { c: '#1C1C1C', back: spikes('#1C1C1C'),     extra: '' },                  // 1 schwarz Stachel
  { c: '#E3C45A', back: longHair('#E3C45A',215), extra: '' },               // 2 blond lang (Schulter)
  { c: '#5B3A1E', back: vol('#5B3A1E'),        extra: bun('#5B3A1E') },      // 3 braun Dutt
  { c: '#222222', back: curls('#222222'),      extra: '' },                  // 4 schwarz lockig
  null,                                                                       // 5 Glatze
  { c: '#C0502A', back: vol('#C0502A'),        extra: '' },                  // 6 rot voll
  { c: '#6B4423', back: ponytail('#6B4423') + vol('#6B4423'), extra: '' },   // 7 Pferdeschwanz
  { c: '#1A1A1A', back: afro('#1A1A1A'),       extra: '' },                  // 8 schwarz Afro
  { c: '#D9B84A', back: longHair('#D9B84A',300), extra: '' },               // 9 blond sehr lang
];

function eyesSVG(i) {
  const specs = [
    { rx: 9, ry: 9, iris: '#5b3a1e', ir: 4 },
    { rx: 11, ry: 11, iris: '#3b82d6', ir: 5 },
    { rx: 7, ry: 7, iris: '#3a8a4a', ir: 3 },
    { rx: 10, ry: 7, iris: '#5b3a1e', ir: 4 },
    { line: true },
    { rx: 11, ry: 9, iris: '#8a6a3a', ir: 5 },
    { rx: 9, ry: 9, iris: '#222', ir: 4 },
    { rx: 9, ry: 8, iris: '#7a8a9a', ir: 4 },
    { rx: 11, ry: 11, iris: '#2aa05a', ir: 5 },
    { rx: 8, ry: 6, iris: '#5b3a1e', ir: 3 },
  ];
  const s = specs[i], y = 82;
  let out = '';
  for (const x of [82, 118]) {
    if (s.line) {
      out += `<path d="M${x - 9},${y} Q${x},${y + 5} ${x + 9},${y}" stroke="#3a2a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      continue;
    }
    out += `<ellipse cx="${x}" cy="${y}" rx="${s.rx}" ry="${s.ry}" fill="#fff" stroke="#0003"/>`
      + `<circle cx="${x}" cy="${y + (s.ry - s.ir) * 0.3}" r="${s.ir}" fill="${s.iris}"/>`
      + `<circle cx="${x}" cy="${y + (s.ry - s.ir) * 0.3}" r="${Math.max(1.6, s.ir * 0.45)}" fill="#111"/>`
      + `<circle cx="${x - 2}" cy="${y - 2}" r="1.5" fill="#fff"/>`;
  }
  return out;
}

function noseSVG(i) {
  const x = 100, y = 92, sh = '#00000022', st = 'stroke="#00000033" stroke-width="2" fill="none" stroke-linecap="round"';
  return [
    `<path d="M${x},${y - 3} Q${x + 5},${y + 5} ${x},${y + 6} Q${x - 5},${y + 5} ${x},${y - 3}" fill="${sh}"/>`,
    `<path d="M${x},${y - 4} L${x},${y + 6}" ${st}/>`,
    `<path d="M${x - 4},${y + 5} Q${x},${y + 8} ${x + 4},${y + 5}" ${st}/>`,
    `<path d="M${x},${y - 4} L${x - 5},${y + 6} L${x + 5},${y + 6} Z" fill="${sh}"/>`,
    `<circle cx="${x}" cy="${y + 3}" r="4.5" fill="${sh}"/>`,
    `<ellipse cx="${x}" cy="${y + 4}" rx="7" ry="4" fill="${sh}"/>`,
    `<path d="M${x},${y - 6} L${x - 2},${y + 7} Q${x},${y + 9} ${x + 2},${y + 7} Z" fill="${sh}"/>`,
    `<path d="M${x},${y + 6} Q${x - 6},${y + 2} ${x - 3},${y - 3}" ${st}/>`,
    `<path d="M${x - 4},${y + 4} Q${x},${y + 9} ${x + 4},${y + 4}" ${st}/><circle cx="${x - 3}" cy="${y + 3}" r="1.4" fill="${sh}"/><circle cx="${x + 3}" cy="${y + 3}" r="1.4" fill="${sh}"/>`,
    `<circle cx="${x - 2}" cy="${y + 4}" r="2" fill="${sh}"/><circle cx="${x + 2}" cy="${y + 4}" r="2" fill="${sh}"/>`,
  ][i];
}

function mouthSVG(i) {
  const x = 100, y = 112, lip = '#C0506A';
  return [
    `<path d="M${x - 12},${y} Q${x},${y + 11} ${x + 12},${y}" stroke="${lip}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<path d="M${x - 15},${y - 2} Q${x},${y + 18} ${x + 15},${y - 2} Q${x},${y + 4} ${x - 15},${y - 2} Z" fill="${lip}"/>`,
    `<path d="M${x - 11},${y + 2} L${x + 11},${y + 2}" stroke="${lip}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="${x}" cy="${y + 3}" rx="9" ry="7" fill="#7a2a3a"/><path d="M${x - 9},${y} Q${x},${y - 3} ${x + 9},${y}" fill="#fff"/>`,
    `<path d="M${x - 6},${y} Q${x},${y + 6} ${x + 6},${y}" stroke="${lip}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<path d="M${x - 13},${y - 1} Q${x},${y + 13} ${x + 13},${y - 1} Z" fill="#7a2a3a"/><rect x="${x - 11}" y="${y - 1}" width="22" height="5" fill="#fff"/>`,
    `<path d="M${x - 12},${y + 6} Q${x},${y - 4} ${x + 12},${y + 6}" stroke="${lip}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<circle cx="${x}" cy="${y + 2}" r="7" fill="#7a2a3a"/>`,
    `<path d="M${x - 11},${y} Q${x},${y + 9} ${x + 11},${y - 4}" stroke="${lip}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<path d="M${x - 16},${y - 2} Q${x},${y + 16} ${x + 16},${y - 2}" stroke="${lip}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  ][i];
}

// Körper / Statur (ohne Hals — Hals wird separat NACH den Haaren gezeichnet, bleibt sichtbar).
function bodySVG(i, skin) {
  const B = [
    [30, 20, 24, 9, 13],[33, 22, 27, 9, 14],[36, 24, 30, 10, 15],[39, 27, 33, 11, 16],
    [42, 30, 36, 12, 17],[45, 33, 39, 12, 18],[48, 36, 42, 13, 19],[51, 39, 45, 14, 20],
    [54, 43, 48, 15, 22],[58, 47, 52, 16, 24],
  ][i];
  const [SH, WA, HI, AR, LG] = B;
  const shirt = '#5B8DEF', pants = '#39405A', shoe = '#4A3422';
  const sx = 100, shoulderY = 156, waistY = 244, hipY = 252;

  let legs = '';
  for (const lx of [sx - HI * 0.5, sx + HI * 0.5]) {
    legs += `<rect x="${lx - LG / 2}" y="250" width="${LG}" height="104" rx="${LG / 2}" fill="${skin}"/>`
      + `<rect x="${lx - LG / 2 - 1}" y="248" width="${LG + 2}" height="60" rx="7" fill="${pants}"/>`
      + `<ellipse cx="${lx}" cy="357" rx="${LG * 0.75}" ry="8" fill="${shoe}"/>`;
  }
  let arms = '';
  for (const ax of [sx - SH, sx + SH]) {
    arms += `<rect x="${ax - AR / 2}" y="158" width="${AR}" height="92" rx="${AR / 2}" fill="${skin}"/>`
      + `<rect x="${ax - AR / 2 - 1}" y="158" width="${AR + 2}" height="26" rx="6" fill="${shirt}"/>`;
  }
  const torso = `<path d="M${sx - SH},${shoulderY} Q${sx},${shoulderY - 10} ${sx + SH},${shoulderY} `
    + `L${sx + WA},${waistY} Q${sx + WA},${hipY + 4} ${sx + HI},${hipY + 6} `
    + `L${sx - HI},${hipY + 6} Q${sx - WA},${hipY + 4} ${sx - WA},${waistY} Z" fill="${shirt}"/>`;
  return legs + arms + torso;
}

// ────────────────────────────────────────────────
//  GESAMT-SVG
//  Reihenfolge (hinten→vorne): Körper · Haar-Hinterteil · Hals · Ohren · Kopf ·
//  Gesicht · Haar-Extra · Stirn-Kappe.
// ────────────────────────────────────────────────
export function avatarSVG(cfg, opts = {}) {
  const headOnly = !!opts.headOnly;
  const skin = SKIN[cfg.skin] || SKIN[0];
  const h = HAIR[cfg.hair];
  const inner =
    (headOnly ? '' : bodySVG(cfg.build, skin)) +
    (h ? h.back : '') +
    neckSVG(skin) +
    earsSVG(cfg.ears, skin) +
    headSVG(skin) +
    eyesSVG(cfg.eyes) +
    noseSVG(cfg.nose) +
    mouthSVG(cfg.mouth) +
    (h ? h.extra + cap(h.c) : '');
  const vb = headOnly ? '32 22 136 136' : '0 0 200 372';
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">${inner}</svg>`;
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
      ? `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;vertical-align:middle;margin-right:6px;background:${SKIN[cfg.skin]}"></span>`
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
