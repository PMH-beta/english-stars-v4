// src/modules/scan-paddle.js
// Texterkennung mit PaddleOCR (PP-OCRv5: Textsuche „mobile“, Lesemodell „latin mobile“)
// über onnxruntime-web. Vor- und Nachverarbeitung nach RapidOCR 3.x nachgebaut
// (Bildgröße, DB-Kästen mit Mindest-Rechteck + Aufweiten, CTC-Lesen, Wortpositionen).
// Ohne DOM: läuft im Browser und zum Messen auch in Node.

const MAX_SEITE = 2000;                               // RapidOCR Global.max_side_len
const DET = { minSeite: 736, schwelle: 0.3, kastenSchwelle: 0.5, aufweiten: 1.6, maxKaesten: 1000 };
const REC = { h: 48, w: 320, stapel: 6, minWert: 0.5 };

let _ort = null, _det = null, _rec = null, _zeichen = null;

/** Lädt die beiden Modelle. dateien = { det, rec } als ArrayBuffer/Uint8Array, zeichen = Liste aus dem Modell. */
export async function paddleLaden(ort, dateien, zeichen) {
  if (_det && _rec) return;
  _ort = ort;
  const opt = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  _det = await ort.InferenceSession.create(dateien.det, opt);
  _rec = await ort.InferenceSession.create(dateien.rec, opt);
  _zeichen = ['', ...zeichen, ' '];                    // 0 = Leerstelle (CTC), am Ende das Leerzeichen
}

export function paddleBereit() { return !!(_det && _rec); }

// ── Bildhilfen (einkanalig grau, Uint8) ─────────────────────────────────────
function _grau(px) {
  const n = px.width * px.height, g = new Uint8Array(n), d = px.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114 + 500) / 1000;
  return g;
}

// Bilinear wie cv2.INTER_LINEAR (Pixelmitten), Rand wird wiederholt.
function _skalieren(g, w, h, nw, nh) {
  const o = new Uint8Array(nw * nh), sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    let fy = (y + 0.5) * sy - 0.5; if (fy < 0) fy = 0;
    const y0 = Math.min(h - 1, fy | 0), y1 = Math.min(h - 1, y0 + 1), ay = fy - y0;
    for (let x = 0; x < nw; x++) {
      let fx = (x + 0.5) * sx - 0.5; if (fx < 0) fx = 0;
      const x0 = Math.min(w - 1, fx | 0), x1 = Math.min(w - 1, x0 + 1), ax = fx - x0;
      const a = g[y0 * w + x0] + (g[y0 * w + x1] - g[y0 * w + x0]) * ax;
      const b = g[y1 * w + x0] + (g[y1 * w + x1] - g[y1 * w + x0]) * ax;
      o[y * nw + x] = a + (b - a) * ay + 0.5;
    }
  }
  return o;
}

function _probe(g, w, h, x, y) {
  if (x < 0) x = 0; else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0; else if (y > h - 1) y = h - 1;
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), ax = x - x0, ay = y - y0;
  const a = g[y0 * w + x0] + (g[y0 * w + x1] - g[y0 * w + x0]) * ax;
  const b = g[y1 * w + x0] + (g[y1 * w + x1] - g[y1 * w + x0]) * ax;
  return a + (b - a) * ay;
}

// ── Mindest-Rechteck (konvexe Hülle + Drehschieber) ─────────────────────────
function _huelle(p) {
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const kreuz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const u = [], l = [];
  for (const q of p) { while (l.length >= 2 && kreuz(l[l.length - 2], l[l.length - 1], q) <= 0) l.pop(); l.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (u.length >= 2 && kreuz(u[u.length - 2], u[u.length - 1], q) <= 0) u.pop(); u.push(q); }
  u.pop(); l.pop();
  return l.concat(u);
}

function _minRechteck(punkte) {
  const h = _huelle(punkte);
  let best = null;
  const n = h.length;
  const kanten = n < 2 ? [[1, 0]] : h.map((a, i) => { const b = h[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; });
  for (const [ux, uy] of kanten) {
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of h) {
      const u = x * ux + y * uy, v = -x * uy + y * ux;
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const f = (u1 - u0) * (v1 - v0);
    if (!best || f < best.f) best = { f, ux, uy, u0, u1, v0, v1 };
  }
  let { ux, uy, u0, u1, v0, v1 } = best;
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  const cx = um * ux - vm * uy, cy = um * uy + vm * ux;
  let w = u1 - u0, hh = v1 - v0;
  // Achse u möglichst waagerecht und nach rechts, v nach unten.
  if (Math.abs(ux) < Math.abs(uy)) { [ux, uy] = [-uy, ux]; [w, hh] = [hh, w]; }
  if (ux < 0) { ux = -ux; uy = -uy; }
  return { cx, cy, w, h: hh, ux, uy, vx: -uy, vy: ux };
}

function _ecken(r, w, h) {
  const ax = r.ux * w / 2, ay = r.uy * w / 2, bx = r.vx * h / 2, by = r.vy * h / 2;
  return [[r.cx - ax - bx, r.cy - ay - by], [r.cx + ax - bx, r.cy + ay - by], [r.cx + ax + bx, r.cy + ay + by], [r.cx - ax + bx, r.cy - ay + by]];
}

// ── Textsuche (DB) ──────────────────────────────────────────────────────────
async function _kaesten(g, w, h) {
  let r = 1; const mn = Math.min(w, h);
  if (mn < DET.minSeite) r = DET.minSeite / mn;
  const rh = Math.max(32, Math.round(Math.floor(h * r) / 32) * 32), rw = Math.max(32, Math.round(Math.floor(w * r) / 32) * 32);
  const s = _skalieren(g, w, h, rw, rh), n = rw * rh;
  const t = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) { const v = s[i] / 127.5 - 1; t[i] = v; t[n + i] = v; t[2 * n + i] = v; }
  const aus = await _det.run({ [_det.inputNames[0]]: new _ort.Tensor('float32', t, [1, 3, rh, rw]) });
  const p = aus[_det.outputNames[0]].data;

  // Schwelle + Weiten 2×2 (Pixel und linke/obere Nachbarn).
  const bit = new Uint8Array(n);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = y * rw + x;
    bit[i] = (p[i] > DET.schwelle || (x > 0 && p[i - 1] > DET.schwelle) || (y > 0 && p[i - rw] > DET.schwelle) || (x > 0 && y > 0 && p[i - rw - 1] > DET.schwelle)) ? 1 : 0;
  }
  // Zusammenhängende Flächen (8er-Nachbarschaft), je Fläche die Randpixel.
  const marke = new Int32Array(n), stapel = [];
  const ergebnis = [];
  let nr = 0;
  for (let i0 = 0; i0 < n && nr < DET.maxKaesten; i0++) {
    if (!bit[i0] || marke[i0]) continue;
    nr++; marke[i0] = nr; stapel.push(i0);
    const rand = [];
    while (stapel.length) {
      const i = stapel.pop(), x = i % rw, y = (i - x) / rw;
      if (x === 0 || y === 0 || x === rw - 1 || y === rh - 1 || !bit[i - 1] || !bit[i + 1] || !bit[i - rw] || !bit[i + rw]) rand.push([x, y]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= rw || yy >= rh) continue;
        const j = yy * rw + xx;
        if (bit[j] && !marke[j]) { marke[j] = nr; stapel.push(j); }
      }
    }
    const k = _minRechteck(rand);
    if (Math.min(k.w, k.h) < 3) continue;
    // Mittlere Wahrscheinlichkeit im Rechteck.
    const e = _ecken(k, k.w, k.h);
    const xs = e.map(q => q[0]), ys = e.map(q => q[1]);
    const xa = Math.max(0, Math.floor(Math.min(...xs))), xb = Math.min(rw - 1, Math.ceil(Math.max(...xs)));
    const ya = Math.max(0, Math.floor(Math.min(...ys))), yb = Math.min(rh - 1, Math.ceil(Math.max(...ys)));
    let sum = 0, cnt = 0;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const du = (x - k.cx) * k.ux + (y - k.cy) * k.uy, dv = (x - k.cx) * k.vx + (y - k.cy) * k.vy;
      if (Math.abs(du) <= k.w / 2 + 0.5 && Math.abs(dv) <= k.h / 2 + 0.5) { sum += p[y * rw + x]; cnt++; }
    }
    if (!cnt || sum / cnt < DET.kastenSchwelle) continue;
    // Aufweiten um Fläche·1,6/Umfang.
    const d = k.w * k.h * DET.aufweiten / (2 * (k.w + k.h));
    const W = k.w + 2 * d, H = k.h + 2 * d;
    if (Math.min(W, H) < 5) continue;
    const fx = w / rw, fy = h / rh;
    const ins = q => [Math.min(w, Math.max(0, Math.round(q[0] * fx))), Math.min(h, Math.max(0, Math.round(q[1] * fy)))];
    const pk = _ecken(k, W, H).map(ins);
    if (Math.hypot(pk[0][0] - pk[1][0], pk[0][1] - pk[1][1]) <= 3 || Math.hypot(pk[0][0] - pk[3][0], pk[0][1] - pk[3][1]) <= 3) continue;
    ergebnis.push({ p: pk, kernH: k.h * fy });
  }
  return ergebnis;
}

// ── Lesen (CTC) ─────────────────────────────────────────────────────────────
function _ausschnitt(g, w, h, p) {
  const cw = Math.max(1, Math.floor(Math.max(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), Math.hypot(p[2][0] - p[3][0], p[2][1] - p[3][1]))));
  const ch = Math.max(1, Math.floor(Math.max(Math.hypot(p[3][0] - p[0][0], p[3][1] - p[0][1]), Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]))));
  const o = new Uint8Array(cw * ch);
  for (let j = 0; j < ch; j++) {
    const b = j / ch;
    for (let i = 0; i < cw; i++) {
      const a = i / cw;
      const x = (1 - a) * (1 - b) * p[0][0] + a * (1 - b) * p[1][0] + a * b * p[2][0] + (1 - a) * b * p[3][0];
      const y = (1 - a) * (1 - b) * p[0][1] + a * (1 - b) * p[1][1] + a * b * p[2][1] + (1 - a) * b * p[3][1];
      o[j * cw + i] = _probe(g, w, h, x, y) + 0.5;
    }
  }
  return { g: o, w: cw, h: ch };
}

function _lesen(ausgabe, i, T, C) {
  const zeichen = [], spalten = [], werte = [];
  let vor = -1;
  for (let t = 0; t < T; t++) {
    const o = (i * T + t) * C;
    let bi = 0, bv = ausgabe[o];
    for (let c = 1; c < C; c++) if (ausgabe[o + c] > bv) { bv = ausgabe[o + c]; bi = c; }
    if (bi !== 0 && bi !== vor) { zeichen.push(_zeichen[bi] ?? ''); spalten.push(t); werte.push(bv); }
    vor = bi;
  }
  const wert = werte.length ? werte.reduce((a, b) => a + b, 0) / werte.length : 0;
  return { zeichen, spalten, wert };
}

/**
 * Erkennt Text im Bild px = { width, height, data (RGBA) }.
 * Liefert { woerter: [{ text, confidence, bbox:{x0,y0,x1,y1} }], text }.
 * fortschritt(anteil 0…1) wird zwischendurch aufgerufen.
 */
export async function paddleErkennen(px, fortschritt = () => {}) {
  let g = _grau(px), w = px.width, h = px.height;
  const r = Math.min(1, MAX_SEITE / Math.max(w, h));
  if (r < 1) { const nw = Math.round(w * r), nh = Math.round(h * r); g = _skalieren(g, w, h, nw, nh); w = nw; h = nh; }
  await fortschritt(0.05);
  const kaesten = await _kaesten(g, w, h);
  await fortschritt(0.3);

  const teile = kaesten.map(k => ({ k, a: _ausschnitt(g, w, h, k.p) }));
  teile.forEach(t => { t.v = t.a.w / t.a.h; });
  const ordnung = teile.map((_, i) => i).sort((a, b) => teile[a].v - teile[b].v);
  const zeilen = [];
  for (let s = 0; s < ordnung.length; s += REC.stapel) {
    const grp = ordnung.slice(s, s + REC.stapel).map(i => teile[i]);
    const maxV = Math.max(REC.w / REC.h, ...grp.map(t => t.v));
    const bw = Math.floor(REC.h * maxV), n = grp.length, f = REC.h * bw;
    const tensor = new Float32Array(n * 3 * f);
    grp.forEach((t, b) => {
      const rw = Math.min(bw, Math.ceil(REC.h * t.v));
      t.rw = rw; t.bw = bw;
      const s2 = _skalieren(t.a.g, t.a.w, t.a.h, rw, REC.h), o = b * 3 * f;
      for (let y = 0; y < REC.h; y++) for (let x = 0; x < rw; x++) {
        const v = s2[y * rw + x] / 127.5 - 1, q = y * bw + x;
        tensor[o + q] = v; tensor[o + f + q] = v; tensor[o + 2 * f + q] = v;
      }
    });
    const aus = await _rec.run({ [_rec.inputNames[0]]: new _ort.Tensor('float32', tensor, [n, 3, REC.h, bw]) });
    const y = aus[_rec.outputNames[0]], [, T, C] = y.dims;
    grp.forEach((t, b) => { t.les = _lesen(y.data, b, T, C); t.T = T; zeilen.push(t); });
    await fortschritt(0.3 + 0.7 * Math.min(1, (s + REC.stapel) / ordnung.length));
  }

  // Wörter: an Leerzeichen trennen, Lage aus den CTC-Spalten zurückrechnen.
  const woerter = [], text = [];
  const zurueck = 1 / r;
  zeilen.forEach((t, zi) => {
    const { zeichen, spalten, wert } = t.les;
    if (wert < REC.minWert || !zeichen.length) return;
    text.push({ y: t.k.p[0][1], s: zeichen.join('').trim() });
    const p = t.k.p, spB = t.bw / t.T, skal = t.a.w / t.rw;
    const kopf = (a) => [p[0][0] + (p[1][0] - p[0][0]) * a, p[0][1] + (p[1][1] - p[0][1]) * a];
    const fuss = (a) => [p[3][0] + (p[2][0] - p[3][0]) * a, p[3][1] + (p[2][1] - p[3][1]) * a];
    let wort = [];
    const abschliessen = () => {
      if (!wort.length) return;
      const a0 = Math.max(0, Math.min(1, spalten[wort[0]] * spB * skal / t.a.w));
      const a1 = Math.max(0, Math.min(1, (spalten[wort[wort.length - 1]] + 1) * spB * skal / t.a.w));
      // Höhe = Kern des Textkastens (vor dem Aufweiten), um die Mittellinie.
      const pts = [];
      for (const a of [a0, a1]) {
        const k = kopf(a), u = fuss(a), mx = (k[0] + u[0]) / 2, my = (k[1] + u[1]) / 2;
        const l = Math.hypot(u[0] - k[0], u[1] - k[1]) || 1, hk = t.k.kernH / 2;
        pts.push([mx - (u[0] - k[0]) / l * hk, my - (u[1] - k[1]) / l * hk], [mx + (u[0] - k[0]) / l * hk, my + (u[1] - k[1]) / l * hk]);
      }
      const xs = pts.map(q => q[0] * zurueck), ys = pts.map(q => q[1] * zurueck);
      woerter.push({ text: wort.map(i => zeichen[i]).join(''), confidence: wert * 100, zeile: zi,
        bbox: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } });
      wort = [];
    };
    zeichen.forEach((z, i) => { if (/\s/.test(z)) abschliessen(); else wort.push(i); });
    abschliessen();
  });
  text.sort((a, b) => a.y - b.y);
  return { woerter, text: text.map(z => z.s).join('\n') };
}
