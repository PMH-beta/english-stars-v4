// src/modules/screen-shell.js
// Grundton eines Screens setzen — Pastell-Redesign.
//
// Die Spezifikation erlaubt pro Screen genau EINEN Grundton. Er steckt in der
// Klasse .p-ton-<name>, die --p-ton setzt; Screen-Hintergrund, aktiver Tab und
// Akzent-Button lesen daraus (siehe style.css, Abschnitt Bausteine).
//
// Drei Dinge müssen dabei zusammen passieren, darum diese Funktion statt einem
// classList-Wechsel an jeder Stelle:
//   1. <body> bekommt den Ton, damit die Farbe den ganzen Bildschirm füllt —
//      der Body-Hintergrund färbt die Canvas-Fläche und damit auch die Bereiche
//      hinter Notch und Home-Leiste.
//   2. Der Screen selbst bekommt ihn, damit Tabs und Akzent-Buttons darin
//      denselben Ton erben.
//   3. <meta name="theme-color"> wird nachgezogen. Das ist der Hebel, mit dem
//      Android die Statusleiste und iOS ab 15 den Bereich um Uhrzeit und Akku
//      einfärbt — sonst bliebe oben ein fremdfarbener Streifen stehen.
//
// Seit 09.10.2026 (Wunsch des Nutzers) folgt die Statusleiste dem, was oben
// wirklich zu sehen ist: dem berechneten Hintergrund — mitten in der 0,25-s-
// Blende also dem Zwischenwert, die Leiste blendet mit — und darüber festen
// Ebenen wie dem abgedunkelten Grund eines Dialogs oder dem Kampf. Nach jeder
// Änderung im DOM wird ein paar Bilder lang nachgeführt (_nachfuehren).

export const GRUNDTOENE = ['lila', 'mint', 'amber', 'rosa', 'blau', 'pfirsich'];

const _rgba = (s) => {
  const m = (String(s).match(/[\d.]+/g) || []).map(Number);
  return [m[0] || 0, m[1] || 0, m[2] || 0, m.length > 3 ? m[3] : (m.length ? 1 : 0)];
};
function _deckkraft(el) {
  let o = 1;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity) || 0;
  return o;
}
// Der Kampfplatz ist ein Bild ohne Zeiger (pointer-events:none) — elementsFromPoint
// liefert ihn nicht. Seine Farbe am oberen Rand wird direkt gelesen: Mittel eines
// Streifens von 32 × 8 Bildpunkten (ein einzelner Punkt träfe leicht eine Fuge),
// je Stelle gemerkt — das Bild ändert sich nicht.
const _bildPunkte = new Map();
let _leinwand = null;
function _bildFarbe(img, x, y) {
  const r = img.getBoundingClientRect();
  if (!img.complete || !img.naturalWidth || x < r.left || x >= r.right || y < r.top || y >= r.bottom) return null;
  const W = 32, H = 8;
  const sx = Math.max(0, Math.min(img.naturalWidth - W, Math.floor((x - r.left) / r.width * img.naturalWidth) - W / 2));
  const sy = Math.max(0, Math.min(img.naturalHeight - H, Math.floor((y - r.top) / r.height * img.naturalHeight)));
  const k = img.src + '|' + sx + '|' + sy;
  if (!_bildPunkte.has(k)) {
    try {
      _leinwand = _leinwand || Object.assign(document.createElement('canvas'), { width: W, height: H });
      const ctx = _leinwand.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, sx, sy, W, H, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      const s = [0, 0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { s[0] += d[i] * d[i + 3]; s[1] += d[i + 1] * d[i + 3]; s[2] += d[i + 2] * d[i + 3]; s[3] += d[i + 3]; }
      _bildPunkte.set(k, s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3], s[3] / (255 * W * H)] : null);
    } catch (e) { _bildPunkte.set(k, null); }
  }
  return _bildPunkte.get(k);
}
// Farbe am oberen Rand: Grundton des Body, darüber jede feste Ebene, die oben in
// der Mitte liegt, mit ihrer Deckkraft gemischt (von unten nach oben) — beim Kampf
// samt Kampfplatz.
function _obenFarbe() {
  const x = window.innerWidth / 2;
  let [r, g, b] = _rgba(getComputedStyle(document.body).backgroundColor);
  const misch = ([er, eg, eb], a) => { r += (er - r) * a; g += (eg - g) * a; b += (eb - b) * a; };
  const ebenen = document.elementsFromPoint(x, 1)
    .filter((e) => getComputedStyle(e).position === 'fixed').reverse();
  for (const e of ebenen) {
    const f = _rgba(getComputedStyle(e).backgroundColor);
    const a = f[3] * _deckkraft(e);
    if (a > 0) misch(f, a);
    const kulisse = e.querySelector('.cf-kulisse');
    const p = kulisse && _bildFarbe(kulisse, x, 1);
    if (p) misch(p, p[3]);
  }
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
let _lauf = 0, _bis = 0, _farbe = '', _beob = null;
function _nachfuehren() {
  _bis = performance.now() + 450;   // Blende 0,25 s + Luft
  if (_lauf) return;
  const bild = () => {
    if (document.body.classList.contains('p-app')) {
      const f = _obenFarbe();
      if (f !== _farbe) { _farbe = f; setThemeColor(f); }
    }
    _lauf = performance.now() < _bis ? requestAnimationFrame(bild) : 0;
  };
  _lauf = requestAnimationFrame(bild);
}
function _beobachten() {
  if (_beob) return;
  _beob = new MutationObserver(_nachfuehren);
  _beob.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

function setThemeColor(hex) {
  if (!hex) return;
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
  m.setAttribute('content', hex);
}

// ton: einer aus GRUNDTOENE. el: das .p-screen-Element des Screens (optional).
export function setGrundton(ton, el) {
  if (!GRUNDTOENE.includes(ton)) { console.warn('[screen-shell] unbekannter Grundton "' + ton + '"'); return; }
  for (const ziel of [document.body, el]) {
    if (!ziel) continue;
    GRUNDTOENE.forEach(t => ziel.classList.remove('p-ton-' + t));
    ziel.classList.add('p-ton-' + ton);
  }
  document.body.classList.add('p-app');
  _beobachten();
  _nachfuehren();
}

// Zurück auf das alte Layout — für Screens, die noch nicht umgestellt sind.
export function clearGrundton() {
  GRUNDTOENE.forEach(t => document.body.classList.remove('p-ton-' + t));
  document.body.classList.remove('p-app');
  _farbe = '';
  setThemeColor('#a86cdb');   // Theme-Color der Alt-Oberfläche
}
