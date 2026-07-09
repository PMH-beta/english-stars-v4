// src/modules/pixel-enemies.js
// Gegner-Sprites in Lo-Fi Pixel Art (Art-Direction): gezackte, organisch-
// flammenartige Silhouetten, asymmetrisch, EIN mandelförmiges Auge als
// markantestes Detail. Bewusster Kontrast zum Spieler: KEINE Outlines,
// keine klaren Körpergrenzen — der Fuß läuft per Dithering in den Hintergrund
// aus („aus dem Boden gewachsen"). Graustufen-Platzhalter (max. 6 Stufen),
// Farben folgen mit der Palette.

const G = ['#e8e8e8', '#c4c4c4', '#9a9a9a', '#6e6e6e', '#4a4a4a', '#2c2c2c'];
const px = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
function dith(x, y, w, h, c) {
  let s = '';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((x + i + y + j) % 2 === 0) s += px(x + i, y + j, 1, 1, c);
  return s;
}

// Flammen-Silhouette aus Spalten: tops[i] = oberste Zeile der Spalte x0+i.
// Innenkörper = gleiche Spalten, etwas eingerückt & tiefer, hellere Stufe.
function flame(tops, x0, bottom, cBase, cInner) {
  let s = '';
  tops.forEach((t, i) => { if (t < bottom) s += px(x0 + i, t, 1, bottom - t, cBase); });
  tops.forEach((t, i) => {
    if (i < 2 || i > tops.length - 3) return;
    const it = t + 3;
    if (it < bottom - 2) s += px(x0 + i, it, 1, bottom - 2 - it, cInner);
  });
  return s;
}

// Mandelförmiges Auge (Breite ~7) mit dunklem Schlitz — leicht versetzt = asymmetrisch.
function almondEye(cx, cy, cLight, cDark) {
  return px(cx - 2, cy - 1, 5, 1, cLight)
    + px(cx - 3, cy, 7, 1, cLight)
    + px(cx - 3, cy + 1, 7, 1, cLight)
    + px(cx - 2, cy + 2, 5, 1, cLight)
    + px(cx, cy, 1, 2, cDark);
}

const _svg = (vb, inner) =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;">${inner}</svg>`;

// ⚔️ Wortgeist (Standard, 32×32): kleine zuckende Flamme, Auge links versetzt.
function _wortgeist() {
  const tops = [20, 16, 18, 13, 15, 10, 13, 8, 11, 6, 9, 5, 8, 4, 7, 6, 9, 7, 11, 9, 13, 12, 16, 15];
  let s = flame(tops, 4, 28, G[4], G[3]);
  s += px(9, 2, 1, 3, G[4]) + px(17, 1, 1, 4, G[4]) + px(23, 6, 1, 3, G[4]);   // lose Funken-Zacken
  s += almondEye(13, 16, G[0], G[5]);
  s += dith(4, 27, 24, 4, G[4]);                                               // Fuß verläuft in den Grund
  s += dith(6, 12, 3, 6, G[5]);                                                // dunkle Textur
  return _svg('0 0 32 32', s);
}

// 🌀 Gestaltwandler (Elite, 32×36): verdrehter, zwei Hörner-Flammen, Auge rechts.
function _gestaltwandler() {
  const tops = [22, 18, 20, 14, 17, 10, 6, 9, 13, 8, 11, 7, 10, 5, 8, 4, 7, 3, 6, 9, 5, 12, 10, 15, 13, 18, 17, 21];
  let s = flame(tops, 2, 32, G[4], G[3]);
  s += px(6, 2, 1, 5, G[4]) + px(7, 1, 1, 3, G[4]);                            // linkes Horn
  s += px(24, 0, 1, 6, G[4]) + px(25, 2, 1, 5, G[4]) + px(23, 3, 1, 4, G[4]);  // rechtes Horn (größer)
  s += almondEye(19, 18, G[0], G[5]);
  s += px(8, 20, 3, 1, G[5]) + px(7, 22, 4, 1, G[5]);                          // Risse im Körper
  s += dith(2, 31, 28, 4, G[4]);
  s += dith(20, 8, 4, 6, G[5]);
  return _svg('0 0 32 36', s);
}

// 👑 Boss (48×48): massige Wand aus Flammen, großes Auge, gezackte Krone.
function _boss() {
  const tops = [30, 26, 28, 22, 25, 18, 21, 15, 18, 12, 15, 9, 12, 7, 10, 5, 8, 4, 7, 3, 6, 4, 8, 5,
                9, 4, 7, 5, 9, 6, 10, 8, 12, 9, 14, 12, 17, 14, 20, 17, 23, 20, 26, 24];
  let s = flame(tops, 2, 42, G[5], G[4]);
  // Kronen-Zacken (frei schwebend, asymmetrisch)
  s += px(10, 0, 1, 4, G[5]) + px(18, 0, 2, 3, G[5]) + px(27, 1, 1, 4, G[5]) + px(35, 0, 1, 5, G[5]);
  // großes Mandelauge (doppelt so breit)
  s += px(18, 22, 10, 1, G[0]) + px(16, 23, 14, 2, G[0]) + px(18, 25, 10, 1, G[0])
    + px(22, 23, 2, 2, G[5]);
  // Innenglut + Risse
  s += dith(12, 14, 6, 10, G[4]) + px(30, 30, 5, 1, G[5]) + px(32, 33, 6, 1, G[5]) + px(10, 32, 4, 1, G[5]);
  s += dith(2, 41, 44, 5, G[5]);
  return _svg('0 0 48 48', s);
}

// Gegner-Sprite je Knotentyp ('fight' | 'irregular' | 'boss').
export function enemySpriteSVG(kind) {
  if (kind === 'boss') return _boss();
  if (kind === 'irregular') return _gestaltwandler();
  return _wortgeist();
}
