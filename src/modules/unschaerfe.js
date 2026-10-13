// src/modules/unschaerfe.js
// Bewegungsunschärfe für Bedien-Animationen (Wunsch des Nutzers 13.10.2026:
// „dynamischer, nicht so plastisch“). Was gleitet, verwischt in seiner Richtung —
// je schneller, desto stärker; steht es, ist es wieder scharf (auch Pixel-Art).
// Waagerecht: Stahl ↔ Gold in der Schmiede (auch beim Wischen mit dem Finger),
// der Reiter-Schieber im Menü, das Umblättern der Verbliste. Senkrecht: was beim
// Auf- und Zuklappen nachrutscht (klapp-anim.js ruft verfolge selbst).
// Die Unschärfe ist ein SVG-Filter je Richtung und Stufe (feGaussianBlur nur in
// einer Achse); CSS-blur() kann nur rundum. Bei „Bewegung reduzieren“ nichts.
//
// Leistung (13.10.2026, Nutzer: auf einem älteren iPhone ruckelte alles — „lieber
// weniger Unschärfe und mehr Leistung“): Safari rechnet SVG-Filter auf HTML ohne
// Grafikchip, jedes Bild neu — auf iPhone/iPad gibt es deshalb keine Unschärfe.
// Anderswo schaltet sie sich ab, sobald zwei Animationen spürbar ruckeln (je
// mindestens 3 Bilder über 34 ms), und bleibt auf diesem Gerät aus (es_leicht).

import { isIOS } from './config.js';

const STUFEN = 5;           // stärkste Stufe = stdDeviation in px
const BELICHTUNG = 7;       // ms „Verschlusszeit“: Weg in dieser Zeit = Länge des Wischers
const SPRUNG = 120;         // px je Bild: mehr ist ein Neuaufbau ohne Übergang, keine Bewegung
const X_SEL = '.cst-track, .p-tabs-schieber, .uv-fill-slide';
const LANGSAM_MS = 34;       // ein Bild darüber: unter 30 Bilder/s
const ruhig = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let _gedrosselt = (() => { try { return localStorage.getItem('es_leicht') === '1'; } catch (e) { return false; } })();
let _langsameLaeufe = 0;
const _aus = () => _gedrosselt || ruhig() || isIOS();
function _drosseln() {
  _gedrosselt = true;
  try { localStorage.setItem('es_leicht', '1'); } catch (e) {}
  for (const el of _laeufe.keys()) loescheUnschaerfe(el);
}

let _defs = false;
function _filterAnlegen() {
  if (_defs) return;
  _defs = true;
  let f = '';
  for (let n = 1; n <= STUFEN; n++) {
    f += `<filter id="p-mb-x${n}" x="-15%" width="130%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${n} 0"/></filter>`
      + `<filter id="p-mb-y${n}" y="-15%" height="130%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 ${n}"/></filter>`;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  svg.innerHTML = `<defs>${f}</defs>`;
  document.body.appendChild(svg);
}

// Geschwindigkeit (px/ms) → Stufe 0…STUFEN; Gauß-Breite ≈ Wischerlänge / 2,5.
const _stufe = (v, max = STUFEN) => Math.min(max, Math.round((v * BELICHTUNG) / 2.5));

/** Unschärfe direkt aus einer bekannten Geschwindigkeit setzen (px/ms). */
export function setzeUnschaerfe(el, achse, v, max) {
  if (!el || _aus()) return;
  _filterAnlegen();
  const s = _stufe(Math.abs(v), max);
  const soll = s ? `url(#p-mb-${achse}${s})` : '';
  if (el.style.filter !== soll) el.style.filter = soll;
}
export function loescheUnschaerfe(el) { if (el && el.style.filter.startsWith('url(#p-mb-')) el.style.filter = ''; }

// Ein Element verfolgen, solange es sich bewegt: Lage je Bild messen, die
// Geschwindigkeit über die letzten FENSTER ms — von Bild zu Bild flackerte es
// beim Wischen (Fingerbewegungen und Bilder fallen nicht immer zusammen) und
// unregelmäßige Bilder gaben Spitzen. Läuft mindestens ms lang (ein Übergang
// beginnt langsam).
const FENSTER = 40;
const _laeufe = new Map();
const _lage = (el, achse) => { const r = el.getBoundingClientRect(); return achse === 'x' ? r.left : r.top; };
export function verfolge(el, achse, ms, max) {
  if (!el || _aus()) return;
  const jetzt = performance.now();
  const alt = _laeufe.get(el);
  if (alt) { alt.bis = Math.max(alt.bis, jetzt + ms); return; }
  const l = { spur: [[jetzt, _lage(el, achse)]], bis: jetzt + ms, raf: 0, bilder: 0, langsam: 0, zuletzt: jetzt };
  _laeufe.set(el, l);
  const ende = () => {
    cancelAnimationFrame(l.raf); loescheUnschaerfe(el); _laeufe.delete(el);
    if (l.langsam >= 3 && ++_langsameLaeufe >= 2) _drosseln();
  };
  const bild = (t) => {
    if (!el.isConnected || _gedrosselt) return ende();
    // Ruckelt es? Die ersten zwei Bilder zählen nicht (da läuft noch der Umbau).
    if (++l.bilder > 2 && t - l.zuletzt > LANGSAM_MS) l.langsam++;
    l.zuletzt = t;
    const p = _lage(el, achse);
    if (Math.abs(p - l.spur[l.spur.length - 1][1]) >= SPRUNG) l.spur = [];   // Sprung: neu anfangen
    l.spur.push([t, p]);
    while (l.spur.length > 2 && t - l.spur[1][0] >= FENSTER) l.spur.shift();
    const [t0, p0] = l.spur[0];
    const v = t - t0 >= 8 ? Math.abs(p - p0) / (t - t0) : 0;
    setzeUnschaerfe(el, achse, v, max);
    if (t < l.bis || _stufe(v, max)) l.raf = requestAnimationFrame(bild); else ende();
  };
  l.raf = requestAnimationFrame(bild);
}

const _dauer = (el) => Math.max(0, ...getComputedStyle(el).transitionDuration.split(',').map((s) => parseFloat(s) * 1000 || 0));

// Einmal beim Start: Übergänge der Schieber und das Wischen in der Schmiede.
export function startUnschaerfe() {
  document.addEventListener('transitionrun', (e) => {
    if (e.propertyName !== 'transform' && e.propertyName !== 'translate') return;
    const el = e.target;
    if (el.matches?.(X_SEL)) verfolge(el, 'x', _dauer(el) + 60);
  }, true);
  // Finger/Maus zieht den Schmiede-Schieber (ohne Übergang, Lage je Bewegung).
  document.addEventListener('pointermove', (e) => {
    if (!e.buttons) return;
    const track = e.target.closest?.('.cst-track');
    if (track) verfolge(track, 'x', 150);
  }, true);
}
