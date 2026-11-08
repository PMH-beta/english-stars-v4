// src/modules/scan-bild.js
// Reine Bild- und Layout-Funktionen fürs Vokabel-Scannen — ohne DOM, damit sie
// sich auch in Node messen lassen. Bilder sind {width, height, data} wie
// ImageData (RGBA, Uint8ClampedArray).

function _bild(w, h) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

// Projektive Abbildung Einheitsquadrat → Viereck (Heckbert).
// ecken: [oben-links, oben-rechts, unten-rechts, unten-links] als {x, y}.
function _homographie(e) {
  const [p0, p1, p2, p3] = e;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  return {
    a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x,
    d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y, g, h,
  };
}

/**
 * Schneidet das Viereck `ecken` aus `src` heraus und rechnet es gerade.
 * Die Ausgabe ist höchstens `maxSeite` Pixel lang (lange Seite).
 */
export function zuschneiden(src, ecken, maxSeite = 2400) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let w = Math.max(dist(ecken[0], ecken[1]), dist(ecken[3], ecken[2]));
  let h = Math.max(dist(ecken[0], ecken[3]), dist(ecken[1], ecken[2]));
  const s = Math.min(1, maxSeite / Math.max(w, h));
  w = Math.max(1, Math.round(w * s));
  h = Math.max(1, Math.round(h * s));
  const H = _homographie(ecken);
  const out = _bild(w, h), o = out.data, d = src.data, sw = src.width, sh = src.height;
  let i = 0;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++, i += 4) {
      const u = (x + 0.5) / w;
      const z = H.g * u + H.h * v + 1;
      let sx = (H.a * u + H.b * v + H.c) / z - 0.5;
      let sy = (H.d * u + H.e * v + H.f) / z - 0.5;
      if (sx < 0) sx = 0; else if (sx > sw - 1) sx = sw - 1;
      if (sy < 0) sy = 0; else if (sy > sh - 1) sy = sh - 1;
      const x0 = sx | 0, y0 = sy | 0;
      const x1 = x0 + 1 < sw ? x0 + 1 : x0, y1 = y0 + 1 < sh ? y0 + 1 : y0;
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      for (let k = 0; k < 3; k++) {
        const top = d[i00 + k] + (d[i10 + k] - d[i00 + k]) * fx;
        const bot = d[i01 + k] + (d[i11 + k] - d[i01 + k]) * fx;
        o[i + k] = top + (bot - top) * fy;
      }
      o[i + 3] = 255;
    }
  }
  return out;
}

/** Dreht um `viertel` × 90° im Uhrzeigersinn. */
export function drehen(src, viertel) {
  const n = ((viertel % 4) + 4) % 4;
  if (n === 0) return src;
  const sw = src.width, sh = src.height;
  const w = n === 2 ? sw : sh, h = n === 2 ? sh : sw;
  const out = _bild(w, h), o = out.data, d = src.data;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let nx, ny;
      if (n === 1) { nx = sh - 1 - y; ny = x; }
      else if (n === 2) { nx = sw - 1 - x; ny = sh - 1 - y; }
      else { nx = y; ny = sw - 1 - x; }
      const si = (y * sw + x) * 4, di = (ny * w + nx) * 4;
      o[di] = d[si]; o[di + 1] = d[si + 1]; o[di + 2] = d[si + 2]; o[di + 3] = 255;
    }
  }
  return out;
}

/**
 * Graustufen mit Schattenausgleich: Der Papierhintergrund wird grob geschätzt
 * (Schließen = Maximum, dann Minimum auf einem Blockraster — entfernt die
 * dunkle Schrift, lässt harte Schattenkanten stehen) und herausgeteilt.
 * Ergebnis: Schrift dunkel auf gleichmäßig hellem Grund, auch im Schatten.
 */
export function schattenAusgleich(src) {
  const w = src.width, h = src.height, d = src.data;
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) {
    g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  const B = Math.max(8, Math.round(Math.min(w, h) / 80));
  const gw = Math.ceil(w / B), gh = Math.ceil(h / B);
  let raster = new Float32Array(gw * gh);
  for (let by = 0; by < gh; by++) {
    for (let bx = 0; bx < gw; bx++) {
      let m = 0;
      const ye = Math.min(h, (by + 1) * B), xe = Math.min(w, (bx + 1) * B);
      for (let y = by * B; y < ye; y++) for (let x = bx * B; x < xe; x++) if (g[y * w + x] > m) m = g[y * w + x];
      raster[by * gw + bx] = m;
    }
  }
  const filter = (r, max, rad) => {
    const out = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      let v = max ? 0 : 255;
      for (let yy = Math.max(0, y - rad); yy <= Math.min(gh - 1, y + rad); yy++)
        for (let xx = Math.max(0, x - rad); xx <= Math.min(gw - 1, x + rad); xx++) {
          const q = r[yy * gw + xx];
          if (max ? q > v : q < v) v = q;
        }
      out[y * gw + x] = v;
    }
    return out;
  };
  raster = filter(filter(raster, true, 1), false, 1);
  const out = _bild(w, h), o = out.data;
  for (let y = 0; y < h; y++) {
    const ry = Math.min(gh - 1, Math.max(0, (y + 0.5) / B - 0.5));
    const y0 = ry | 0, y1 = Math.min(gh - 1, y0 + 1), fy = ry - y0;
    for (let x = 0; x < w; x++) {
      const rx = Math.min(gw - 1, Math.max(0, (x + 0.5) / B - 0.5));
      const x0 = rx | 0, x1 = Math.min(gw - 1, x0 + 1), fx = rx - x0;
      const t = raster[y0 * gw + x0] + (raster[y0 * gw + x1] - raster[y0 * gw + x0]) * fx;
      const b = raster[y1 * gw + x0] + (raster[y1 * gw + x1] - raster[y1 * gw + x0]) * fx;
      const bg = Math.max(24, t + (b - t) * fy);
      const v = Math.min(255, (g[y * w + x] / bg) * 255);
      const i = (y * w + x) * 4;
      o[i] = o[i + 1] = o[i + 2] = v; o[i + 3] = 255;
    }
  }
  return out;
}

// ── Layout: Wörter mit Position → Vokabelzeilen ───────────────────────────────

const _LAUTSCHRIFT = /[ːəɪʃʊæɒŋʌθðʒɔɜ]/;
function _istLautschrift(t) {
  if (/^[\[|{]/.test(t)) return true;
  if (t.includes(']')) return true;
  if (_LAUTSCHRIFT.test(t)) return true;
  if (/^\(.*[:\]]/.test(t)) return true;
  return /\w:\w/.test(t);
}

/**
 * Englisches Wort mit unsicheren Zeichen gegen die Wortliste prüfen: Ist es
 * kein Wort, aber eine Mischung mit den zweiten Wahlen schon („girifriend“ →
 * „girlfriend“), die wahrscheinlichste solche Mischung nehmen.
 */
function _wortKorrigieren(w, wb) {
  if (!wb || !w.alt?.length) return w.text;
  const m = /^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/.exec(w.text);
  if (!m || m[2].length < 2 || wb.has(m[2].toLowerCase())) return w.text;
  const a0 = m[1].length, kern = [...m[2]];
  const alt = w.alt.filter(([k, z]) => k >= a0 && k < a0 + kern.length && /^[A-Za-z]$/.test(z))
    .sort((a, b) => b[3] - a[3]).slice(0, 6);
  let best = null, bestP = -Infinity;
  for (let maske = 1; maske < 1 << alt.length; maske++) {
    const k2 = [...kern];
    let p = 0;
    alt.forEach(([k, z, p1, p2], j) => {
      if (maske & (1 << j)) { k2[k - a0] = z; p += Math.log(p2); } else p += Math.log(p1);
    });
    if (p > bestP && wb.has(k2.join('').toLowerCase())) { bestP = p; best = k2.join(''); }
  }
  return best ? m[1] + best + m[3] : w.text;
}

function _median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
}

/**
 * Baut aus den Wörtern der Texterkennung (je {text, bbox:{x0,y0,x1,y1}})
 * Vokabelzeilen „Englisch<TAB>Deutsch“. Zeilen und Spalten werden selbst aus
 * den Wort-Positionen gebildet (Tesseracts eigene Zeilen fassen bei Spalten
 * manchmal mehrere Zeilen zusammen). Lautschrift, Randmarken (Sit 1, Ex 4 …)
 * und weitere Spalten (Beispielsätze) fallen weg; zweizeilige Einträge werden
 * zusammengezogen.
 */
export function vokabelZeilen(woerter, woerterbuch = null) {
  let alle = woerter.filter(w => w.text && w.text.trim());
  if (!alle.length) return '';
  const hMed = _median(alle.map(w => w.bbox.y1 - w.bbox.y0)) || 20;

  // Schräglage: Steigung zwischen nah benachbarten Wörtern derselben Zeile,
  // Median über alle; dann alle Wort-Positionen gerade drehen.
  const mitte = w => ({ x: (w.bbox.x0 + w.bbox.x1) / 2, y: (w.bbox.y0 + w.bbox.y1) / 2 });
  const steigungen = [];
  const nachX = [...alle].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  for (const a of nachX) {
    const ma = mitte(a);
    for (const b of nachX) {
      const gap = b.bbox.x0 - a.bbox.x1;
      if (gap < 0 || gap > 0.9 * hMed) continue;
      const mb = mitte(b);
      if (Math.abs(mb.y - ma.y) < 0.4 * hMed) steigungen.push((mb.y - ma.y) / (mb.x - ma.x));
    }
  }
  const k = steigungen.length >= 5 ? _median(steigungen) : 0;
  if (Math.abs(k) > 0.005) {
    const c = 1 / Math.sqrt(1 + k * k), s = k * c;
    alle = alle.map(w => {
      const m = mitte(w), hw = (w.bbox.x1 - w.bbox.x0) / 2, hh = (w.bbox.y1 - w.bbox.y0) / 2;
      const x = m.x * c + m.y * s, y = -m.x * s + m.y * c;
      return { ...w, bbox: { x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh } };
    });
  }

  // 0) Zeilen: Wörter von links nach rechts an die Zeile hängen, deren letztes
  //    Wort auf gleicher Höhe liegt (folgt leicht schrägen Zeilen).
  const yc = w => (w.bbox.y0 + w.bbox.y1) / 2;
  const zeilen = [];
  for (const w of [...alle].sort((a, b) => a.bbox.x0 - b.bbox.x0)) {
    let best = null, bestD = 0.55 * hMed;
    for (const z of zeilen) {
      const dy = Math.abs(yc(z[z.length - 1]) - yc(w));
      if (dy < bestD && z[z.length - 1].bbox.x1 <= w.bbox.x0 + 0.5 * hMed) { bestD = dy; best = z; }
    }
    if (best) best.push(w); else zeilen.push([w]);
  }

  // 1) Textstücke: Zeilen an großen Lücken auftrennen. Wörter aus derselben
  //    erkannten Textzeile (Feld „zeile“, PaddleOCR) dürfen weiter auseinander stehen.
  const stuecke = [];
  for (const ws of zeilen) {
    let akt = [];
    for (const w of ws) {
      const vor = akt[akt.length - 1];
      // Getrennte Kästen: 1,5 — PaddleOCR teilt Ausdrücke wie „sich | beeilen“ in zwei Kästen.
      const grenze = (vor && w.zeile != null && w.zeile === vor.zeile ? 2 : 1.5) * hMed;
      if (akt.length && w.bbox.x0 - vor.bbox.x1 > grenze) { stuecke.push(akt); akt = []; }
      akt.push(w);
    }
    if (akt.length) stuecke.push(akt);
  }
  const st = stuecke.map(ws => ({
    ws,
    x0: ws[0].bbox.x0,
    y0: Math.min(...ws.map(w => w.bbox.y0)),
    y1: Math.max(...ws.map(w => w.bbox.y1)),
  }));
  if (!st.length) return '';

  // 2) Spalten: linke Kanten nach x sortieren, an Lücken > hMed trennen.
  const xs = st.map(s => s.x0).sort((a, b) => a - b);
  const spalten = [];
  let cur = [xs[0]];
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] > hMed) { spalten.push(cur); cur = []; }
    cur.push(xs[i]);
  }
  spalten.push(cur);
  const sp = spalten.map(c => ({ lo: c[0], hi: c[c.length - 1], n: c.length }));
  const spalteVon = x => sp.findIndex(c => x >= c.lo - 1 && x <= c.hi + 1);
  // Stücke, in denen ein späteres Wort an einer kräftigen Spaltenkante beginnt
  // (Randmarke dicht vor dem Wort, Deutsch dicht hinter Englisch), dort teilen.
  const kraeftig = i => i >= 0 && sp[i].n >= 3;
  for (let k = 0; k < st.length; k++) {
    const s = st[k], start = spalteVon(s.x0);
    const at = s.ws.findIndex((w, i) => i > 0 && kraeftig(spalteVon(w.bbox.x0)) && spalteVon(w.bbox.x0) !== start);
    if (at > 0) {
      const vor = s.ws[at - 1], rest = s.ws.splice(at);
      // kopf: Teil davor, wenn beide aus derselben erkannten Textzeile stammen.
      const kopf = vor.zeile != null && vor.zeile === rest[0].zeile ? s : null;
      st.push({ ws: rest, kopf, x0: rest[0].bbox.x0, y0: Math.min(...rest.map(w => w.bbox.y0)), y1: Math.max(...rest.map(w => w.bbox.y1)) });
      s.y0 = Math.min(...s.ws.map(w => w.bbox.y0)); s.y1 = Math.max(...s.ws.map(w => w.bbox.y1));
    }
  }
  st.forEach(s => { s.sp = spalteVon(s.x0); });

  // 3) Spaltenpaar mit den meisten gemeinsamen Zeilen = Englisch | Deutsch.
  const ueberlapp = (a, b) => Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.4 * Math.min(a.y1 - a.y0, b.y1 - b.y0);
  //    (Nicht nur Nachbarn: einzelne Störstücke bilden eigene Mini-Spalten.)
  let best = -1, deSp = -1, bestN = 0;
  for (let i = 0; i < sp.length; i++) {
    const L = st.filter(s => s.sp === i);
    for (let j = i + 1; j < sp.length; j++) {
      const R = st.filter(s => s.sp === j);
      const n = L.filter(l => R.some(r => ueberlapp(l, r))).length;
      if (n > bestN) { bestN = n; best = i; deSp = j; }
    }
  }
  if (best < 0) return '';
  const enX = sp[best].lo;

  // 4) Englisch: bis zur Lautschrift; Wörter links der Spalte (Randmarken) weg.
  //    Deutsch: Stift-Häkchen und Störzeichen weg, „ii“ ist fast immer ein „ü“.
  const text = (s, en) => {
    const out = [];
    for (const w of s.ws) {
      if (en && w.bbox.x1 < enX - 0.3 * hMed) continue;
      if (en && _istLautschrift(w.text)) { s.laut = true; break; }
      let t = en ? _wortKorrigieren(w, woerterbuch) : w.text;
      if (!en) {
        t = t.replace(/^[‘’'"`´*+!\\|§&]+|[‘’'"`´*+!\\|§&]+$/g, '').replace(/ii/g, 'ü');
        if (!/[a-zA-ZäöüÄÖÜß]/.test(t) && !/^[\/;,-]+$/.test(t)) continue;
      }
      out.push(t);
    }
    return out.join(' ').trim();
  };
  const texte = new Map();
  for (const s of st) if (s.sp === best || s.sp === deSp) texte.set(s, text(s, s.sp === best));
  // Beispielsätze: Läuft eine englische Zeile ohne Lautschrift in einem Stück
  // (eine erkannte Textzeile) bis in die Deutsch-Spalte, ist es ein Satz, keine
  // Vokabel. Nur auf Seiten, deren Vokabeln überwiegend Lautschrift haben.
  const enSt = st.filter(s => s.sp === best && texte.get(s));
  if (enSt.filter(s => s.laut).length >= 0.5 * enSt.length) {
    for (const s of st) if (s.sp === deSp && s.kopf && s.kopf.sp === best && !s.kopf.laut) { texte.delete(s); texte.delete(s.kopf); }
  }
  const reihen = [];
  for (const s of st) {
    const t = texte.get(s);
    if (!t) continue;
    let r = reihen.find(r => ueberlapp(r, s));
    if (!r) { r = { y0: s.y0, y1: s.y1, en: [], de: [] }; reihen.push(r); }
    else { r.y0 = Math.min(r.y0, s.y0); r.y1 = Math.max(r.y1, s.y1); }
    (s.sp === best ? r.en : r.de).push({ x: s.x0, t });
  }
  reihen.sort((a, b) => a.y0 - b.y0);

  // 5) Paare bilden; Folgezeilen anhängen.
  const paare = [];
  let offenEn = null, letzte = null, letzteY = -1e9;
  for (const r of reihen) {
    const en = r.en.sort((a, b) => a.x - b.x).map(o => o.t).join(' ');
    const de = r.de.sort((a, b) => a.x - b.x).map(o => o.t).join(' ');
    const nah = r.y0 - letzteY < 1.8 * hMed;
    if (en && de) {
      letzte = { en, de }; paare.push(letzte); offenEn = null;
    } else if (de) {
      if (offenEn && nah) { letzte = { en: offenEn, de }; paare.push(letzte); offenEn = null; }
      // Nur echte Fortsetzungen anhängen (vorige Zeile endet mit , ; / - oder
      // hat eine offene Klammer) — sonst gehört die Zeile zu einem
      // unlesbaren englischen Wort und wird verworfen.
      else if (letzte && nah && (/[,;\/-]$/.test(letzte.de) || /\([^)]*$/.test(letzte.de))) letzte.de += ' ' + de;
    } else {
      offenEn = en; letzte = null;
    }
    letzteY = r.y1;
  }
  // Ein Strich am Ende ohne Folgezeile ist eine Stiftmarke („Tante -“).
  return paare.map(p => `${p.en}\t${p.de.replace(/\s*-$/, '')}`).join('\n');
}
