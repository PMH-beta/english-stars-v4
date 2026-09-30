// src/modules/avatar.js
// Figur und Gefährte des Spielers: SD.avatar prüfen und einmalig auf die neue
// Figur umrechnen (avatarVersion 2), zeichnen über hero.js (renderAvatarInto,
// stageHTMLFor, petSVG) und der Charakter-Editor (1.9, 1.10, 8.4–8.12).
//
// Datenmodell: SD.avatar = { skin, hair, hairC, eyes, iris, mouth, top, topC,
// pants, pantsC, build, pet, petColor, avatarVersion: 2 }.

import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';
// Paletten der NEUEN Figur — nur für die Migration (nächstliegender Farbton).
import { imgTag, petTag, petURL, gearFor, fitScale, MASSE, ausschnitt, stageHTML, petKind, petColorHex, editorFigurHTML, editorPetHTML, kachelURL, paintStages } from './hero.js';
import { SKIN as NEU_SKIN, HAIR as NEU_HAIR, CLOTH as NEU_CLOTH, IRIS as NEU_IRIS, HAIR_N as NEU_HAIR_N, EYES_N as NEU_EYES_N, MOUTH_N as NEU_MOUTH_N, TOPS_N as NEU_TOPS_N, PANTS_N as NEU_PANTS_N, PETS as NEU_PETS } from './pixel-hero-fine.js';
import { iconHTML } from './pixel-icons.js';

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

// Alte Hauttöne (skin 0–19) — nur noch für die Migration.
const SKIN = [
  '#FFE4CC','#FFD9B8','#F7CEA6','#F0C193','#EEB98A','#E4AC79','#E0A26B','#D69660',
  '#CC8A52','#C07E49','#B27440','#A0683A','#965E31','#7C4A26','#5E3719','#4A2B12',
  '#A8D8A8','#A8C4E8','#C9AEE6','#9AA7B8',
];

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

// Alte Haarfarben (hairColor 0–19) — nur noch für die Migration (Haar- und Augenfarbe).
export const HAIR_COLORS = [
  '#1e1b1a', '#2b2b33', '#33302e', '#4a3423', '#5B3A1E', '#6B4423', '#7a4526', '#8a5a30',
  '#a04a28', '#C0502A', '#d97b29', '#D9B84A', '#E3C45A', '#f0dc82', '#c9ccd6', '#f2f0ea',
  '#e07ba8', '#8a5fc9', '#4a7fd1', '#3f9d4e',
];

// Alte Oberteile und Hosen (0–19) — die Migration nimmt nur noch ihre Farbe (c).
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

// ────────────────────────────────────────────────
//  ZEICHNEN — über hero.js (pixel-hero-fine.js)
// ────────────────────────────────────────────────
// Eigenes Tier als <img> (Fach „Gefährte" im Profil).
export function petSVG(cfg, opts = {}) {
  return petTag(cfg.pet, cfg.petColor, {
    scale: Math.max(1, Math.round(opts.scale ?? 2)),
    locked: !!opts.locked,
  });
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
