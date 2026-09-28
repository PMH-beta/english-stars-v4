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

import { hero, crop, toCanvas, renderHeroWithPet, renderPet, renderPetSilhouette, petBattleFrames, petBattleSequence, PET_BATTLE, PETS } from './pixel-hero-fine.js';

// Maße der Rohgrafik: ganze Figur und Kopf-Ausschnitt (34 × 34 ab (10, 0)).
export const HERO_W = 54, HERO_H = 87;
export const HEAD_W = 34, HEAD_H = 34;

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

function _key(cfg, gear, headOnly, scale) {
  return JSON.stringify([cfg, gear || 0, headOnly ? 1 : 0, scale]);
}

function _merken(k, url) {
  if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value);
  _cache.set(k, url);
  return url;
}

/** Leert den Zwischenspeicher — nach einer Änderung an der Figur. */
export function clearHeroCache() { _cache.clear(); }

// ── Zeichnen ────────────────────────────────────────────────────────────────

/** Figur (oder nur der Kopf) als Data-URL, ganzzahlig skaliert. */
export function heroURL(cfg, { gear, headOnly = false, scale = 2 } = {}) {
  const s = Math.max(1, Math.round(scale));
  const k = _key(cfg, gear, headOnly, s);
  const da = _cache.get(k);
  if (da) return da;
  const voll = hero(gear ? { ...cfg, gear } : cfg).render();
  const img = headOnly ? crop(voll, 10, 0, HEAD_W, HEAD_H) : voll;
  return _merken(k, toCanvas(img, s).toDataURL('image/png'));
}

/** Dasselbe als fertiges <img>-Tag für Aufrufstellen, die einen String einsetzen. */
export function imgTag(cfg, opts = {}) {
  const s = Math.max(1, Math.round(opts.scale ?? 2));
  const b = opts.headOnly ? [HEAD_W, HEAD_H] : [HERO_W, HERO_H];
  return `<img src="${heroURL(cfg, { ...opts, scale: s })}" width="${b[0] * s}" height="${b[1] * s}"`
    + ` alt="" style="image-rendering:pixelated;display:block;flex:none">`;
}

/** Figur mit Gefährtem als EIN Bild mit gemeinsamem Schatten (Screens 8.1–8.3). */
export function heroWithPetTag(cfg, kind, color, scale = 2) {
  const s = Math.max(1, Math.round(scale));
  const cv = renderHeroWithPet(cfg, kind, color, s);
  return `<img src="${cv.toDataURL('image/png')}" width="${cv.width}" height="${cv.height}"`
    + ` alt="" style="image-rendering:pixelated;display:block;flex:none">`;
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
export function petTag(petIdx, colorIdx, { scale = 2, locked = false } = {}) {
  const s = Math.max(1, Math.round(scale));
  const kind = petKind(petIdx);
  const k = 'pet:' + kind + ':' + (locked ? 'x' : petColorHex(petIdx, colorIdx)) + ':' + s;
  let url = _cache.get(k);
  if (!url) url = _merken(k, (locked ? renderPetSilhouette(kind, s) : renderPet(kind, petColorHex(petIdx, colorIdx), s)).toDataURL('image/png'));
  return `<img src="${url}" alt="" style="image-rendering:pixelated;display:block;flex:none">`;
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
