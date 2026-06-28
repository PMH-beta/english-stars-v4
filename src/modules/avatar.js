// src/modules/avatar.js
// Charakter-Avatar: prozedurales SVG (kein Bild-Asset), modular pro Merkmal.
// 7 Merkmale × je 10 Stufen — Daten liegen in SD.avatar = {skin,hair,eyes,nose,mouth,ears,build}.
// Kopf-Koordinaten sind fix (cx=100), nur Hautfarbe + Statur (Körper) variieren echt.

import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';

// Reihenfolge + Beschriftung der Einstell-Zeilen
export const AVATAR_FEATURES = [
  { key: 'skin',  icon: '🖐️', label: 'Hautfarbe' },
  { key: 'build', icon: '🧍', label: 'Statur' },
  { key: 'hair',  icon: '💇', label: 'Haare' },
  { key: 'eyes',  icon: '👀', label: 'Augen' },
  { key: 'nose',  icon: '👃', label: 'Nase' },
  { key: 'mouth', icon: '👄', label: 'Mund' },
  { key: 'ears',  icon: '👂', label: 'Ohren' },
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
  // [breite, höhe, y, pointy]
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

// Haare: {back} hinter Kopf, {front} davor — c = Farbe
function hairParts(i) {
  const styles = [
    // 0 kurz braun
    { c: '#6B4423', back: e(100, 64, 50, 52), front: bangs('#6B4423') },
    // 1 schwarz Stachel
    { c: '#1c1c1c', back: spikes('#1c1c1c'), front: '' },
    // 2 blond lang
    { c: '#E3C45A', back: e(100, 92, 58, 64), front: bangs('#E3C45A') },
    // 3 braun Dutt
    { c: '#5b3a1e', back: e(100, 70, 49, 46) + `<circle cx="100" cy="34" r="13" fill="#5b3a1e"/>`, front: bangs('#5b3a1e') },
    // 4 schwarz lockig
    { c: '#222', back: curls('#222'), front: '' },
    // 5 Glatze
    { c: '#000', back: '', front: '' },
    // 6 rot Seitenscheitel
    { c: '#C0502A', back: e(100, 70, 50, 47), front: `<path d="M55,62 Q92,30 145,60 Q150,76 100,66 Q70,72 55,76 Z" fill="#C0502A"/>` },
    // 7 braun Pferdeschwanz
    { c: '#6B4423', back: e(100, 70, 49, 46) + `<path d="M146,72 q26,6 20,40 q-4,18 -16,16 q10,-30 -8,-52 Z" fill="#6B4423"/>`, front: bangs('#6B4423') },
    // 8 schwarz Afro
    { c: '#1a1a1a', back: e(100, 62, 58, 54), front: '' },
    // 9 blond Bob
    { c: '#D9B84A', back: e(100, 84, 54, 56), front: `<path d="M54,64 Q100,48 146,64 Q142,76 100,70 Q58,76 54,64 Z" fill="#D9B84A"/>` },
  ];
  return styles[i];
}
function e(cx, cy, rx, ry) { return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="HAIRCOL"/>`; }
function bangs(c) { return `<path d="M56,64 Q100,40 144,64 Q140,76 100,70 Q60,76 56,64 Z" fill="${c}"/>`; }
function spikes(c) {
  let p = '';
  for (let k = 0; k <= 6; k++) {
    const x = 60 + k * 13;
    p += `<path d="M${x - 7},58 L${x},30 L${x + 7},58 Z" fill="${c}"/>`;
  }
  return p + e(100, 70, 49, 44);
}
function curls(c) {
  let p = '';
  const pts = [[64,52],[80,40],[100,36],[120,40],[136,52],[140,70],[60,70]];
  for (const [x, y] of pts) p += `<circle cx="${x}" cy="${y}" r="14" fill="${c}"/>`;
  return p;
}

function hairSVG(i, which) {
  const h = hairParts(i);
  let s = which === 'back' ? h.back : h.front;
  return s.split('HAIRCOL').join(h.c);
}

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

// Körper / Statur — braucht Hautfarbe. Kopf endet bei y≈136, Hals/Schultern darunter.
function bodySVG(i, skin) {
  // [Schulter-Halbbreite, Taille, Hüfte, Arm-Dicke, Bein-Dicke]
  const B = [
    [30, 20, 24, 9, 13],[33, 22, 27, 9, 14],[36, 24, 30, 10, 15],[39, 27, 33, 11, 16],
    [42, 30, 36, 12, 17],[45, 33, 39, 12, 18],[48, 36, 42, 13, 19],[51, 39, 45, 14, 20],
    [54, 43, 48, 15, 22],[58, 47, 52, 16, 24],
  ][i];
  const [SH, WA, HI, AR, LG] = B;
  const shirt = '#5B8DEF', pants = '#39405A', shoe = '#4A3422';
  const sx = 100;
  const shoulderY = 156, waistY = 244, hipY = 252;

  // Beine (Haut) + Hose + Schuhe
  const legXs = [sx - HI * 0.5, sx + HI * 0.5];
  let legs = '';
  for (const lx of legXs) {
    legs += `<rect x="${lx - LG / 2}" y="250" width="${LG}" height="104" rx="${LG / 2}" fill="${skin}"/>`
      + `<rect x="${lx - LG / 2 - 1}" y="248" width="${LG + 2}" height="60" rx="7" fill="${pants}"/>`
      + `<ellipse cx="${lx}" cy="357" rx="${LG * 0.75}" ry="8" fill="${shoe}"/>`;
  }
  // Arme (Haut) + kurze Ärmel
  let arms = '';
  for (const ax of [sx - SH, sx + SH]) {
    arms += `<rect x="${ax - AR / 2}" y="158" width="${AR}" height="92" rx="${AR / 2}" fill="${skin}"/>`
      + `<rect x="${ax - AR / 2 - 1}" y="158" width="${AR + 2}" height="26" rx="6" fill="${shirt}"/>`;
  }
  // Hals
  const neck = `<rect x="${sx - 9}" y="128" width="18" height="32" rx="6" fill="${skin}"/>`;
  // Rumpf (Shirt)
  const torso = `<path d="M${sx - SH},${shoulderY} Q${sx},${shoulderY - 10} ${sx + SH},${shoulderY} `
    + `L${sx + WA},${waistY} Q${sx + WA},${hipY + 4} ${sx + HI},${hipY + 6} `
    + `L${sx - HI},${hipY + 6} Q${sx - WA},${hipY + 4} ${sx - WA},${waistY} Z" fill="${shirt}"/>`;

  // Reihenfolge: Beine → Arme → Hals → Rumpf
  return legs + arms + neck + torso;
}

// ────────────────────────────────────────────────
//  GESAMT-SVG
// ────────────────────────────────────────────────
export function avatarSVG(cfg, opts = {}) {
  const headOnly = !!opts.headOnly;
  const skin = SKIN[cfg.skin] || SKIN[0];
  const body = headOnly ? '' : bodySVG(cfg.build, skin);
  const inner =
    body +
    hairSVG(cfg.hair, 'back') +
    earsSVG(cfg.ears, skin) +
    headSVG(skin) +
    eyesSVG(cfg.eyes) +
    noseSVG(cfg.nose) +
    mouthSVG(cfg.mouth) +
    hairSVG(cfg.hair, 'front');
  const vb = headOnly ? '26 14 148 150' : '0 0 200 372';
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">${inner}</svg>`;
}

// Rendert den Avatar in ein Element (Kopf oder ganz).
export function renderAvatarInto(elId, sd, opts = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = avatarSVG(ensureAvatar(sd), opts);
}

// ────────────────────────────────────────────────
//  CHARAKTER-SCREEN (Anpassung)
// ────────────────────────────────────────────────
export function renderCharacter() {
  const sd = window.SD;
  if (!sd) return;
  renderAvatarInto('character-canvas', sd, { headOnly: false });
  const cfg = ensureAvatar(sd);
  const host = document.getElementById('character-controls');
  if (!host) return;
  host.innerHTML = AVATAR_FEATURES.map(f => {
    const extra = f.key === 'skin'
      ? `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;vertical-align:middle;margin-right:8px;background:${SKIN[cfg.skin]}"></span>`
      : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #f0f0f0;">
      <div style="font-family:'Fredoka One',cursive;font-size:.92rem;color:var(--text);">${f.icon} ${f.label}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button onclick="avatarStep('${f.key}',-1)" style="font-family:'Fredoka One',cursive;font-size:1.1rem;width:34px;height:34px;border:none;border-radius:50%;cursor:pointer;background:#f0e6ff;color:var(--purple);">‹</button>
        <div style="min-width:64px;text-align:center;font-weight:800;font-size:.85rem;color:#666;">${extra}${cfg[f.key] + 1} / ${COUNT}</div>
        <button onclick="avatarStep('${f.key}',1)" style="font-family:'Fredoka One',cursive;font-size:1.1rem;width:34px;height:34px;border:none;border-radius:50%;cursor:pointer;background:#f0e6ff;color:var(--purple);">›</button>
      </div>
    </div>`;
  }).join('');
}

export function avatarStep(feature, dir) {
  const sd = window.SD;
  const cfg = ensureAvatar(sd);
  if (!(feature in cfg)) return;
  cfg[feature] = wrap(cfg[feature] + dir);
  persist(sd);
  if (window.currentUser) markDirty('profile');   // Pending-Flag überlebt auch Hardware-Zurück
  renderCharacter();
  // Köpfe in Menü/Profil sofort mitziehen
  renderAvatarInto('menu-avatar', sd, { headOnly: true });
  renderAvatarInto('prof-avatar', sd, { headOnly: true });
}

// Beim Verlassen des Screens Cloud-Sync anstoßen (gesammelt, nicht pro Klick).
export function commitAvatar() {
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}
