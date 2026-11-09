// src/modules/scan-zuschnitt.js
// Zuschnitt nach dem Foto, für 1 bis 5 Bilder: das aktive Bild anzeigen, vier
// Eck-Griffe ziehen, drehen. Liefert je Bild das gerade gerechnete,
// schattenbereinigte Bild für die Texterkennung.
//
// Speicher: Je Bild bleiben nur die Datei und eine Anzeige-Fassung (lange Seite
// höchstens 1400 px) im Speicher. Die volle Auflösung wird erst beim Erkennen
// aus der Datei gelesen — fünf Fotos in voller Größe sprengen sonst das Handy.
import { zuschneiden, schattenAusgleich } from './scan-bild.js';

export const MAX_BILDER = 5;

// Quellbild höchstens so groß (lange Seite / Pixel gesamt) — iOS-Canvas-Grenze
// liegt bei ~16,7 Mio. Pixeln, die Texterkennung braucht nicht mehr.
const MAX_SEITE = 3200, MAX_PIXEL = 12e6;
const ANZEIGE_SEITE = 1400, VORSCHAU = 112;

// Ein Bild: { id, file, drehung (Viertel im Uhrzeigersinn), anzeige (Canvas),
//   ecken ([ol, or, ur, ul], Anteile 0..1 der gedrehten Fläche), vorschau (Data-URL),
//   stand ('neu' | 'laeuft' | 'ok' | 'fehler'), anzahl (Wörter), geaendert }
let _bilder = [];
let _aktiv = -1;
let _naechsteId = 1;
let _skala = 1;       // Anzeige-Pixel je Pixel der Anzeige-Fassung
let _beiAenderung = () => {};

const $ = id => document.getElementById(id);

/** Alle Bilder (Reihenfolge = Bildnummer − 1). */
export function bilder() { return _bilder; }
export function aktiverIndex() { return _aktiv; }
/** Wird nach Ecken ziehen und Drehen gerufen (Knopf-Text, Leiste). */
export function beiAenderung(fn) { _beiAenderung = fn || (() => {}); }

function _standardEcken() {
  return [{ x: .06, y: .06 }, { x: .94, y: .06 }, { x: .94, y: .94 }, { x: .06, y: .94 }];
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

// Zeichnet img (bzw. Canvas) mit Faktor s und `drehung` Vierteldrehungen.
function _gedreht(img, w0, h0, s, drehung) {
  const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
  const quer = drehung % 2 === 1;
  const c = document.createElement('canvas');
  c.width = quer ? h : w; c.height = quer ? w : h;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(drehung * Math.PI / 2);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c;
}

function _vorschau(b) {
  const a = b.anzeige, c = document.createElement('canvas');
  c.width = c.height = VORSCHAU;
  const s = Math.max(VORSCHAU / a.width, VORSCHAU / a.height);
  const w = a.width * s, h = a.height * s;
  c.getContext('2d').drawImage(a, (VORSCHAU - w) / 2, (VORSCHAU - h) / 2, w, h);
  b.vorschau = c.toDataURL('image/jpeg', 0.75);
}

/**
 * Hängt Bilddateien an (höchstens bis MAX_BILDER) und macht das erste neue
 * Bild aktiv. Liefert { neu, zuviel, fehler }.
 */
export async function bilderHinzufuegen(files) {
  const frei = MAX_BILDER - _bilder.length;
  const liste = Array.from(files || []);
  const nehmen = liste.slice(0, Math.max(0, frei));
  let neu = 0, fehler = 0, erstes = -1;
  for (const file of nehmen) {
    try {
      const img = await _bildLaden(file);
      const w0 = img.naturalWidth, h0 = img.naturalHeight;
      const s = Math.min(1, ANZEIGE_SEITE / Math.max(w0, h0));
      const b = { id: _naechsteId++, file, drehung: 0, anzeige: _gedreht(img, w0, h0, s, 0),
        ecken: _standardEcken(), vorschau: '', stand: 'neu', anzahl: 0, geaendert: false };
      _vorschau(b);
      _bilder.push(b);
      if (erstes < 0) erstes = _bilder.length - 1;
      neu++;
    } catch (e) {
      console.warn('[scan] Bild nicht lesbar:', e?.message);
      fehler++;
    }
  }
  if (erstes >= 0) _aktiv = erstes;
  return { neu, zuviel: liste.length - nehmen.length, fehler };
}

/** Zeigt Startfläche (kein Bild) oder Zuschnitt des aktiven Bildes. */
export function zuschnittAnzeigen() {
  const zone = $('scan-zone'), zs = $('scan-zuschnitt');
  const da = _bilder.length > 0;
  if (zone) zone.style.display = da ? 'none' : '';
  if (zs) zs.style.display = da ? '' : 'none';
  if (da) _zeichnen();
}

/** Macht Bild i aktiv. */
export function bildWaehlen(i) {
  if (!_bilder[i]) return;
  _aktiv = i;
  zuschnittAnzeigen();
}

/** Nimmt Bild i heraus und liefert es zurück. */
export function bildEntfernen(i) {
  const [b] = _bilder.splice(i, 1);
  if (!_bilder.length) _aktiv = -1;
  else if (_aktiv >= _bilder.length) _aktiv = _bilder.length - 1;
  else if (i < _aktiv) _aktiv--;
  zuschnittAnzeigen();
  return b || null;
}

/** Alle Bilder verwerfen (nach dem Hinzufügen, „Neu scannen“, neuem Öffnen). */
export function bilderVerwerfen() {
  _bilder = []; _aktiv = -1;
  zuschnittAnzeigen();
}

/** Dreht das aktive Foto um 90° im Uhrzeigersinn; die Ecken starten neu. */
export function zuschnittDrehen() {
  const b = _bilder[_aktiv];
  if (!b) return;
  b.anzeige = _gedreht(b.anzeige, b.anzeige.width, b.anzeige.height, 1, 1);
  b.drehung = (b.drehung + 1) % 4;
  b.ecken = _standardEcken();
  b.geaendert = true;
  _vorschau(b);
  _zeichnen();
  _beiAenderung();
}

/**
 * Ausschnitt von Bild b in voller Auflösung, gerade gerechnet + Schattenausgleich,
 * als {width,height,data}.
 */
export async function zuschnittBild(b) {
  const img = await _bildLaden(b.file);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const s = Math.min(1, MAX_SEITE / Math.max(w0, h0), Math.sqrt(MAX_PIXEL / (w0 * h0)));
  const c = _gedreht(img, w0, h0, s, b.drehung);
  const src = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  c.width = c.height = 0;
  const ecken = b.ecken.map(e => ({ x: e.x * src.width, y: e.y * src.height }));
  return schattenAusgleich(zuschneiden(src, ecken, 2400));
}

function _farbe(name, ersatz) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || ersatz;
}

function _zeichnen() {
  const b = _bilder[_aktiv];
  const flaeche = $('scan-zs-flaeche'), cv = $('scan-zs-bild');
  if (!b || !flaeche || !cv) return;
  const q = b.anzeige;
  const maxB = flaeche.clientWidth || 320;
  const maxH = Math.max(220, window.innerHeight * 0.48);
  _skala = Math.min(maxB / q.width, maxH / q.height);
  const bw = Math.round(q.width * _skala), bh = Math.round(q.height * _skala);
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(bw * dpr); cv.height = Math.round(bh * dpr);
  cv.style.width = bw + 'px'; cv.style.height = bh + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(q, 0, 0, bw, bh);
  // Außerhalb des Vierecks abdunkeln, Viereck mit Rahmen.
  const p = b.ecken.map(e => ({ x: e.x * bw, y: e.y * bh }));
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

// Griffe ziehen (Maus, Finger, Stift). Nur die Griffe sperren das Wischen —
// auf dem Bild selbst scrollt die Seite.
document.addEventListener('pointerdown', ev => {
  const g = ev.target.closest?.('.scan-zs-griff');
  const b = _bilder[_aktiv];
  if (!g || !b) return;
  ev.preventDefault();
  const i = +g.dataset.ecke;
  g.setPointerCapture(ev.pointerId);
  g.classList.add('is-gezogen');
  const cv = $('scan-zs-bild');
  const bewegen = e => {
    const r = cv.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    b.ecken[i] = { x, y };
    b.geaendert = true;
    _zeichnen();
  };
  const ende = () => {
    g.classList.remove('is-gezogen');
    g.removeEventListener('pointermove', bewegen);
    g.removeEventListener('pointerup', ende);
    g.removeEventListener('pointercancel', ende);
    _beiAenderung();
  };
  g.addEventListener('pointermove', bewegen);
  g.addEventListener('pointerup', ende);
  g.addEventListener('pointercancel', ende);
});

window.addEventListener('resize', () => { if (_bilder[_aktiv]) _zeichnen(); });
