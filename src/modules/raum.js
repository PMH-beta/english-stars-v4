// src/modules/raum.js
// Schlichter Pixel-Raum hinter der Figur in Profil und Charakter-Editor (Wunsch des
// Nutzers 15.10.2026: „neutraler Hintergrund … ganz schlicht, mit ein bisschen
// Schatten, Texturen, leichter Farbe … dass es einen Raum bekommt“ — die Wiese vom
// Kampfplatz nahm dem Kampf die Freude). Rückwand mit leiser Steinstruktur und
// hellem Schein hinter der Figur, zwei Seitenwände im Schatten, Boden mit Dielen,
// dunkle Kante, wo Wand und Boden sich treffen. Gezeichnet im Maßstab der Figur
// (ganzzahlig, pixelated) und als <img> eingesetzt — ein Bild übersteht auch, dass
// Handys im Hintergrund Canvas-Inhalte verwerfen.

const F = {
  wand: [226, 219, 246], wandFuge: [217, 209, 242], wandHell: [233, 228, 250], wandHellFuge: [224, 217, 246],
  seite: [208, 199, 238], seiteFuge: [198, 188, 233],
  kante: [184, 170, 223], leiste: [192, 180, 228], leisteLicht: [238, 234, 251],
  boden: [202, 191, 234], bodenFuge: [189, 177, 227], bodenHell: [212, 202, 239],
};
const _hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Raum als Pixelbild (w × h logische Pixel), fuss = Abstand der Füße vom unteren Rand.
function _zeichnen(w, h, fuss) {
  const px = new Uint8ClampedArray(w * h * 4);
  const setze = (x, y, c) => { const i = (y * w + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  const hy = Math.max(6, h - fuss - 14);          // Kante Wand/Boden, 14 hinter den Füßen
  const a = Math.max(4, Math.round(w * 0.13)), b = w - 1 - a;   // Ecken der Rückwand
  const schraeg = 0.8;                            // Bodenkante der Seitenwände
  const mx = w / 2, my = hy * 0.55;               // heller Schein hinter der Figur
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const linksBoden = hy + (a - x) * schraeg, rechtsBoden = hy + (x - b) * schraeg;
      const seiteL = x < a && y < linksBoden, seiteR = x > b && y < rechtsBoden;
      if (seiteL || seiteR) {
        // Seitenwand: Steinreihen wie die Rückwand, im Schatten; Ecke als Kante.
        const ecke = x === a - 1 || x === b + 1;
        const fuge = y % 6 === 5 || (Math.floor(y / 6) % 2 ? x % 9 === 0 : x % 9 === 4);
        setze(x, y, ecke ? F.kante : fuge ? F.seiteFuge : F.seite);
      } else if (y < hy) {
        // Rückwand: Steine 12 × 6 im Verband, leise Fugen, ein paar dunkle Sprenkel,
        // in der Mitte ein heller Schein als ruhige Fläche (keine Verläufe, kein Raster).
        const reihe = Math.floor(y / 6);
        const fuge = y % 6 === 5 || ((x + (reihe % 2) * 6) % 12 === 0);
        const d = Math.hypot((x - mx) / (w * 0.42), (y - my) / (hy * 0.75));
        const hell = d < 0.7;
        let c = fuge ? (hell ? F.wandHellFuge : F.wandFuge) : hell ? F.wandHell : F.wand;
        if (!fuge && _hash(x, y) < 0.025) c = F.wandFuge;
        if (y >= hy - 3) c = y === hy - 3 ? F.leisteLicht : F.leiste;   // Fußleiste
        setze(x, y, c);
      } else {
        // Boden: Dielen, die zum Betrachter hin breiter werden, Stöße versetzt.
        const t = y - hy;
        const diele = Math.floor(Math.sqrt(t * 3.2));
        const fugeQ = Math.floor(Math.sqrt((t + 1) * 3.2)) !== diele;
        const laenge = 14 + diele * 3;
        const fugeL = (x + diele * 7) % laenge === 0;
        let c = (fugeQ || fugeL) ? F.bodenFuge : (_hash(x, diele) < 0.02 ? F.bodenHell : F.boden);
        if (t === 0) c = F.kante;                                   // dunkle Kante
        else if (t === 1 && (x + y) % 2 === 0) c = F.bodenFuge;     // weicher Übergang
        setze(x, y, c);
      }
    }
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0);
  return cv.toDataURL('image/png');
}

const _bilder = new Map();
const _beobachtet = new WeakSet();

/**
 * Raum in eine Bühne setzen (als erstes Kind, hinter allem). el = Bühnen-Element
 * (position:relative, overflow:hidden), fuss = Abstand der Füße vom unteren Rand in
 * CSS-Pixeln, s = Maßstab der Figur. Passt sich an, wenn sich die Bühne in der
 * Größe ändert.
 */
export function raumMalen(el, { fuss = 0, s = 3 } = {}) {
  if (!el) return;
  const malen = () => {
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const w = Math.ceil(W / s), h = Math.ceil(H / s), f = Math.round(fuss / s);
    const k = `${w}x${h}:${f}`;
    if (!_bilder.has(k)) _bilder.set(k, _zeichnen(w, h, f));
    let img = el.querySelector(':scope > .p-raum');
    if (!img) { img = document.createElement('img'); img.className = 'p-raum'; img.alt = ''; img.draggable = false; el.prepend(img); }
    if (img.dataset.k !== k) { img.dataset.k = k; img.src = _bilder.get(k); }
    img.style.width = w * s + 'px';
    img.style.height = h * s + 'px';
  };
  malen();
  if (!_beobachtet.has(el) && window.ResizeObserver) {
    _beobachtet.add(el);
    new ResizeObserver(malen).observe(el);
  }
}
