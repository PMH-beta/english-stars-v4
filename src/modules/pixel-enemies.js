// src/modules/pixel-enemies.js
// Gegner-Sprites in Lo-Fi Pixel Art (Art-Direction): gezackte, organisch-
// flammenartige Silhouetten, asymmetrisch, EIN mandelförmiges Auge als
// markantestes Detail. Bewusster Kontrast zum Spieler: KEINE harten Outlines,
// keine klaren Körpergrenzen — der Fuß läuft per Dithering in den Grund aus
// („aus dem Hintergrund gewachsen").
//
// Gezeichnet wird auf einem feinen Raster (40–64 px) mit ABSTANDS-SCHATTIERUNG:
// Für jeden Pixel zählt der Abstand zum Rand der Silhouette — außen dunkel,
// weiter innen Basis, dann Innenglut, im unteren Kern die heiße Stufe. Dadurch
// bekommen die Gestalten Tiefe und wirken durchglüht statt flach. Die Silhouette
// selbst steckt in einer Spalten-Tabelle (tops[]), die pro Typ mehrere Varianten
// hat — zwei Begegnungen sehen sich dadurch nie ganz gleich.

const px = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
function dith(x, y, w, h, c, phase = 0) {
  let s = '';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((x + i + y + j + phase) % 2 === 0) s += px(x + i, y + j, 1, 1, c);
  return s;
}

// Farbwelten je Gegnertyp: [außen/dunkel, Basis, Innenglut, heiß, Auge hell, Auge dunkel].
const PAL = {
  fight: [
    ['#a33c0a', '#e8590c', '#ff922b', '#ffd8a8', '#fff6e0', '#5c1a00'],   // Glut-Orange
    ['#8a1f2e', '#d13b47', '#ff8787', '#ffd0d0', '#fff0f0', '#4a0f16'],   // Rubinrot
    ['#1f5f4a', '#2f9e75', '#63e6be', '#c3fae8', '#e6fff8', '#0b3b2c'],   // Sumpfgrün
  ],
  irregular: [
    ['#0b4d57', '#1098ad', '#3bc9db', '#99e9f2', '#e3fbfd', '#062f36'],   // Frostcyan
    ['#3d1f8c', '#7048e8', '#9775fa', '#d0bfff', '#f3edff', '#241361'],   // Violettschimmer
  ],
  boss: [
    ['#7f2704', '#e8590c', '#ff922b', '#ffd43b', '#fff3b0', '#3d1200'],   // Feuerkönig
    ['#241361', '#5f3dc4', '#845ef7', '#d0bfff', '#f3edff', '#150a3a'],   // Schattenfürst
    ['#0b3b3b', '#0c8599', '#22b8cf', '#66d9e8', '#e3fbfd', '#052626'],   // Tiefenschrecken
  ],
};
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

// ── Körper mit Abstands-Schattierung ────────────────────────────────────────
// tops[i] = oberste Zeile der Spalte x0+i (−1 = Spalte leer). Der Abstand zum
// Rand entscheidet die Helligkeitsstufe; nach unten hin wird es heißer (Glutkern).
function body(tops, x0, bottom, P) {
  const n = tops.length;
  const inside = (i, y) => i >= 0 && i < n && tops[i] >= 0 && y >= tops[i] && y < bottom;
  let s = '';
  for (let i = 0; i < n; i++) {
    if (tops[i] < 0) continue;
    let runC = null, runY = 0, runH = 0;
    for (let y = tops[i]; y < bottom; y++) {
      // Abstand nach links/rechts/oben (unten läuft der Körper aus → doppelt gewichtet)
      let dl = 0; while (inside(i - dl - 1, y) && dl < 9) dl++;
      let dr = 0; while (inside(i + dr + 1, y) && dr < 9) dr++;
      const dt = y - tops[i];
      const db = (bottom - 1 - y) * 2;
      const d = Math.min(dl, dr, dt, db);
      // Glut steigt nach unten: der heiße Kern beginnt erst im unteren Drittel.
      const heat = (y - tops[i]) / Math.max(1, bottom - tops[i]);
      let c = P[0];
      if (d >= 2) c = P[1];
      if (d >= 4 && heat > 0.3) c = P[2];
      if (d >= 7 && heat > 0.58) c = P[3];
      if (c === runC) runH++;
      else { if (runC) s += px(x0 + i, runY, 1, runH, runC); runC = c; runY = y; runH = 1; }
    }
    if (runC) s += px(x0 + i, runY, 1, runH, runC);
  }
  return s;
}

// Mandelförmiges Auge: Lid oben, helle Sklera, senkrechter Schlitz, 1px Glanz.
function eye(cx, cy, w, P) {
  const h = Math.max(1, Math.round(w / 3));
  let s = '';
  for (let j = 0; j < h; j++) {
    const inset = Math.round((Math.abs(j - (h - 1) / 2) / Math.max(0.5, (h - 1) / 2)) * (w / 3));
    s += px(cx - Math.floor(w / 2) + inset, cy + j, w - inset * 2, 1, P[4]);
  }
  s += px(cx - Math.floor(w / 2), cy - 1, w, 1, P[5]);                     // Lid
  s += px(cx - 1, cy, 2, h, P[5]);                                        // Schlitz
  s += px(cx - Math.floor(w / 2) + 1, cy + (h > 2 ? 1 : 0), 1, 1, '#ffffff');   // Glanz
  return s;
}

// Lose Funken über der Gestalt (schweben mit, siehe .cf-enemy svg-Animation).
function sparks(list, P) {
  return list.map(([x, y, h]) => px(x, y, 1, h, P[2]) + px(x, y - 1, 1, 1, P[3])).join('');
}

const _svg = (w, h, inner) =>
  `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"
    style="width:100%;height:100%;display:block;image-rendering:pixelated;">${inner}</svg>`;

// ── Silhouetten (Spalten-Tabellen) ──────────────────────────────────────────
// Je Typ mehrere Varianten; die Zahlen sind die oberste Zeile jeder Spalte.
const SIL = {
  // ⚔️ Wortgeist (40×40): gedrungene Flamme mit zwei bis drei Zungen, unten breit.
  fight: [
    [30, 27, 24, 21, 19, 17, 14, 11, 9, 7, 6, 8, 11, 13, 12, 10, 7, 5, 4, 6, 9, 12, 14, 13, 11, 14, 17, 20, 23, 26, 29],
    [31, 28, 25, 23, 20, 17, 15, 12, 10, 8, 5, 4, 6, 9, 11, 10, 8, 6, 7, 9, 12, 10, 13, 16, 14, 17, 19, 22, 25, 28, 30],
    [29, 26, 24, 20, 18, 15, 12, 10, 8, 9, 7, 5, 3, 5, 8, 10, 12, 9, 6, 8, 11, 13, 12, 15, 18, 16, 19, 22, 24, 27, 30],
  ],
  // 🌀 Gestaltwandler (44×48): schlanker, höher, spitzere Zungen.
  irregular: [
    [36, 33, 30, 27, 24, 21, 18, 15, 12, 10, 8, 6, 4, 6, 9, 11, 10, 8, 6, 4, 3, 5, 8, 11, 13, 12, 15, 18, 21, 24, 28, 32, 35],
    [35, 32, 29, 26, 23, 20, 17, 14, 11, 9, 7, 5, 3, 5, 8, 10, 9, 7, 5, 3, 4, 7, 10, 12, 11, 14, 17, 20, 23, 26, 29, 32, 34],
  ],
  // 👑 Boss (64×60): massige Wand aus Flammen, breite Schultern, hohe Zungen.
  boss: [
    [46, 43, 40, 37, 34, 31, 28, 25, 22, 19, 16, 13, 11, 9, 7, 5, 4, 6, 9, 11, 10, 8, 6, 4, 3, 2, 4, 6, 8, 7, 5, 3,
      5, 8, 10, 12, 11, 9, 12, 15, 17, 20, 23, 26, 29, 32, 35, 38, 41, 43, 45, 47, 49],
    [48, 45, 42, 39, 36, 33, 30, 27, 24, 21, 18, 15, 12, 10, 8, 6, 4, 3, 5, 8, 10, 9, 7, 5, 3, 2, 3, 5, 7, 9, 8, 6,
      4, 6, 9, 11, 13, 12, 14, 17, 19, 22, 25, 28, 31, 34, 37, 40, 43, 45, 47, 49, 51],
  ],
};

// Silhouette auf Zielbreite dehnen (jede Spalte mehrfach) — feineres Raster ohne
// dass ich jede Spalte einzeln pflegen muss; +/-1 Zufall macht die Kante rauer.
function widen(tops, factor) {
  const out = [];
  for (let i = 0; i < tops.length; i++) {
    for (let k = 0; k < factor; k++) {
      const t = tops[i] + (k === 0 ? 0 : rnd(2) - (k % 2));
      out.push(Math.max(0, t));
    }
  }
  return out;
}

// ⚔️ Wortgeist — 40×40
function _wortgeist() {
  const P = pick(PAL.fight);
  const tops = widen(pick(SIL.fight), 1);
  const W = 40, H = 40, x0 = Math.floor((W - tops.length) / 2), bottom = 34;
  let s = body(tops, x0, bottom, P);
  s += dith(x0, bottom - 3, tops.length, 6, P[1], 1);            // Fuß löst sich auf
  s += dith(x0 + 4, 14, 5, 7, P[0]);                             // Textur/Risse links
  s += px(x0 + 20, 22, 4, 1, P[0]) + px(x0 + 19, 24, 5, 1, P[0]);
  s += eye(x0 + 14, 20, 11, P);
  s += sparks([[x0 + 6, 4, 2], [x0 + 24, 2, 3], [x0 + 30, 9, 2]], P);
  return _svg(W, H, s);
}

// 🌀 Gestaltwandler — 44×48, mit zwei Hörnern
function _gestaltwandler() {
  const P = pick(PAL.irregular);
  const tops = widen(pick(SIL.irregular), 1);
  const W = 44, H = 48, x0 = Math.floor((W - tops.length) / 2), bottom = 42;
  let s = body(tops, x0, bottom, P);
  // Hörner: schmale Zacken, die aus den Schultern wachsen (rechts größer = asymmetrisch)
  s += px(x0 + 7, 6, 2, 8, P[0]) + px(x0 + 8, 4, 1, 4, P[1]) + px(x0 + 8, 3, 1, 1, P[3]);
  s += px(x0 + 26, 2, 2, 11, P[0]) + px(x0 + 27, 1, 1, 5, P[1]) + px(x0 + 27, 0, 1, 1, P[3]);
  s += dith(x0 + 20, 20, 6, 9, P[0]);                            // Risse
  s += px(x0 + 8, 30, 6, 1, P[0]) + px(x0 + 7, 32, 5, 1, P[0]);
  s += eye(x0 + 19, 22, 13, P);
  s += sparks([[x0 + 4, 12, 2], [x0 + 33, 8, 3], [x0 + 16, 3, 2]], P);
  s += dith(x0, bottom - 3, tops.length, 7, P[1], 1);
  return _svg(W, H, s);
}

// 👑 Boss — 64×60, Krone aus schwebenden Zacken, großes Auge, Glutrisse
function _boss() {
  const P = pick(PAL.boss);
  const tops = widen(pick(SIL.boss), 1);
  const W = 64, H = 60, x0 = Math.floor((W - tops.length) / 2), bottom = 52;
  let s = body(tops, x0, bottom, P);
  // Kronenzacken schweben frei über dem Kopf (keine klare Körpergrenze)
  const crown = [[12, 2, 5], [20, 0, 6], [28, 1, 4], [36, 0, 7], [44, 3, 4]];
  s += crown.map(([x, y, h]) => px(x0 + x, y, 2, h, P[0]) + px(x0 + x, y, 2, 1, P[3])).join('');
  s += eye(x0 + 26, 24, 16, P);
  s += dith(x0 + 8, 18, 8, 12, P[0]);                            // Textur links
  s += px(x0 + 38, 34, 9, 1, P[3]) + px(x0 + 40, 37, 7, 1, P[2]) + px(x0 + 12, 38, 6, 1, P[3]);   // Glutrisse
  s += sparks([[x0 + 3, 22, 3], [x0 + 50, 16, 3], [x0 + 46, 30, 2], [x0 + 7, 34, 2]], P);
  s += dith(x0, bottom - 4, tops.length, 8, P[1], 1);
  return _svg(W, H, s);
}

// Gegner-Sprite je Knotentyp ('fight' | 'irregular' | 'boss').
export function enemySpriteSVG(kind) {
  if (kind === 'boss') return _boss();
  if (kind === 'irregular') return _gestaltwandler();
  return _wortgeist();
}
