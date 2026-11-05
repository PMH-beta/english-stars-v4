// src/modules/scan-zuschnitt.js
// Zuschnitt nach dem Foto: Bild anzeigen, vier Eck-Griffe ziehen, drehen.
// Liefert das gerade gerechnete, schattenbereinigte Bild für die Texterkennung.
import { zuschneiden, schattenAusgleich } from './scan-bild.js';

// Quellbild höchstens so groß (lange Seite / Pixel gesamt) — iOS-Canvas-Grenze
// liegt bei ~16,7 Mio. Pixeln, die Texterkennung braucht nicht mehr.
const MAX_SEITE = 3200, MAX_PIXEL = 12e6;

let _quelle = null;   // Canvas mit dem (gedrehten) Foto in Arbeitsauflösung
let _ecken = null;    // [ol, or, ur, ul] in Quell-Pixeln
let _skala = 1;       // Anzeige-Pixel je Quell-Pixel

const $ = id => document.getElementById(id);

function _standardEcken(w, h) {
  const rx = w * 0.06, ry = h * 0.06;
  return [{ x: rx, y: ry }, { x: w - rx, y: ry }, { x: w - rx, y: h - ry }, { x: rx, y: h - ry }];
}

function _bildLaden(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}

/** Öffnet den Zuschnitt für die gewählte Bilddatei. */
export async function zuschnittOeffnen(file) {
  const img = await _bildLaden(file);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const s = Math.min(1, MAX_SEITE / Math.max(w0, h0), Math.sqrt(MAX_PIXEL / (w0 * h0)));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  _quelle = c;
  _ecken = _standardEcken(c.width, c.height);
  $('scan-zone').style.display = 'none';
  $('scan-zuschnitt').style.display = '';
  _zeichnen();
}

/** Schließt den Zuschnitt wieder (zurück zur Scan-Fläche). */
export function zuschnittSchliessen() {
  _quelle = null; _ecken = null;
  const z = $('scan-zuschnitt');
  if (z) z.style.display = 'none';
  const zone = $('scan-zone');
  if (zone) zone.style.display = '';
}

/** Dreht das Foto um 90° im Uhrzeigersinn; die Ecken starten neu. */
export function zuschnittDrehen() {
  if (!_quelle) return;
  const c = document.createElement('canvas');
  c.width = _quelle.height; c.height = _quelle.width;
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(_quelle, 0, 0);
  _quelle = c;
  _ecken = _standardEcken(c.width, c.height);
  _zeichnen();
}

/** Ausschnitt gerade gerechnet + Schattenausgleich, als {width,height,data}. */
export function zuschnittBild() {
  if (!_quelle) return null;
  const src = _quelle.getContext('2d').getImageData(0, 0, _quelle.width, _quelle.height);
  return schattenAusgleich(zuschneiden(src, _ecken, 2400));
}

function _farbe(name, ersatz) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || ersatz;
}

function _zeichnen() {
  const flaeche = $('scan-zs-flaeche'), cv = $('scan-zs-bild');
  if (!_quelle || !flaeche || !cv) return;
  const maxB = flaeche.clientWidth || 320;
  const maxH = Math.max(240, window.innerHeight * 0.58);
  _skala = Math.min(maxB / _quelle.width, maxH / _quelle.height);
  const bw = Math.round(_quelle.width * _skala), bh = Math.round(_quelle.height * _skala);
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(bw * dpr); cv.height = Math.round(bh * dpr);
  cv.style.width = bw + 'px'; cv.style.height = bh + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(_quelle, 0, 0, bw, bh);
  // Außerhalb des Vierecks abdunkeln, Viereck mit Rahmen.
  const p = _ecken.map(e => ({ x: e.x * _skala, y: e.y * _skala }));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, bw, bh);
  ctx.moveTo(p[0].x, p[0].y); for (let i = 3; i >= 1; i--) ctx.lineTo(p[i].x, p[i].y); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fill('evenodd');
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y); ctx.closePath();
  ctx.lineWidth = 2; ctx.strokeStyle = _farbe('--p-gold', '#FFD84D');
  ctx.stroke();
  // Griffe positionieren (relativ zur Fläche; Canvas ist darin zentriert).
  const ox = cv.offsetLeft, oy = cv.offsetTop;
  flaeche.querySelectorAll('.scan-zs-griff').forEach((g, i) => {
    g.style.left = (ox + p[i].x) + 'px';
    g.style.top = (oy + p[i].y) + 'px';
  });
}

// Griffe ziehen (Maus, Finger, Stift).
document.addEventListener('pointerdown', ev => {
  const g = ev.target.closest?.('.scan-zs-griff');
  if (!g || !_quelle) return;
  ev.preventDefault();
  const i = +g.dataset.ecke;
  g.setPointerCapture(ev.pointerId);
  const cv = $('scan-zs-bild');
  const bewegen = e => {
    const r = cv.getBoundingClientRect();
    const x = Math.min(_quelle.width, Math.max(0, (e.clientX - r.left) / _skala));
    const y = Math.min(_quelle.height, Math.max(0, (e.clientY - r.top) / _skala));
    _ecken[i] = { x, y };
    _zeichnen();
  };
  const ende = () => {
    g.removeEventListener('pointermove', bewegen);
    g.removeEventListener('pointerup', ende);
    g.removeEventListener('pointercancel', ende);
  };
  g.addEventListener('pointermove', bewegen);
  g.addEventListener('pointerup', ende);
  g.addEventListener('pointercancel', ende);
});

window.addEventListener('resize', () => { if (_quelle) _zeichnen(); });
