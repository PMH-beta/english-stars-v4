// src/modules/pixel-items.js
// Pixel-Art der Schmiede-Gegenstände (Lo-Fi Pixel Art, Art-Direction).
//
// Raster 32×48 — viermal so fein wie die frühere 16×24-Fassung, damit die Objekte
// echte Form und Schattierung bekommen. Jedes Objekt besteht aus GENAU 5 Teilen in
// Schmiede-Reihenfolge (Teil 1 zuerst); ein Teil ist eine Liste von Blöcken, ein
// Block eine Pixel-Zeichnung aus Zeichen-Zeilen ab (x,y). Später gezeichnete Teile
// liegen über früheren (z. B. Axtkopf über dem Schaft).
//
// Zeichen (Farbrollen, max. 3 Helligkeitsstufen + Outline je Material):
//   .  leer          o  Outline (dunkelster Materialton)
//   d  Schatten      b  Basis          h  Glanz
//   w  Leder/Holz dunkel   W  Leder/Holz Basis   E  Leder/Holz hell
//   g  Stein dunkel        G  Stein Basis        S  Stein Glanz
//
// Material kommt aus der Form: past = 🔩 Stahl, pp = 🥇 Gold. Der Stein setzt
// bewusst einen Gegenakzent (Stahl → Rubin, Gold → Saphir), damit beide Waffen
// eines Auftrags auf den ersten Blick unterscheidbar bleiben.

export const ART_W = 32;
export const ART_H = 48;

const MAT = {
  past: { o: '#283347', d: '#5a708f', b: '#8fa8c6', h: '#dceaf8' },   // 🔩 Stahl
  pp:   { o: '#5a3c0b', d: '#a8781a', b: '#e2b53c', h: '#fff0b0' },   // 🥇 Gold
};

const WOOD = { w: '#43291a', W: '#7d5232', E: '#ab7c4c' };
const GEM = {
  past: { g: '#7d1b28', G: '#e05263', S: '#ffd0d6' },
  pp:   { g: '#26377d', G: '#5c7ce0', S: '#d2dcff' },
};

const P = (x, y, ...rows) => ({ x, y, rows });
const rep = (row, n) => Array(n).fill(row);

// ── Die Objekte ─────────────────────────────────────────────────────────────
// Teil-Namen stehen als Kommentar über jedem Objekt (Reihenfolge = Bauabfolge).
export const ITEM_ART = {
  // Knauf · Griff · Parierstange · Klinge · Spitze
  schwert: [
    [P(11, 41,
      '...oooo...',
      '..obhhbo..',
      '.obbhhbbo.',
      '.obbbbbbo.',
      '..obddbo..',
      '...oooo...')],
    [P(13, 34, 'wWEEWw', 'wwwwww', 'wWEEWw', 'wwwwww', 'wWEEWw', 'wwwwww', 'wWEEWw')],
    [P(6, 30,
      '...oooooooooooooo...',
      '.oohbbbbbbbbbbbbhoo.',
      '.oodbbbbbbbbbbbbdoo.',
      '...oooooooooooooo...')],
    [P(12, 9, ...rep('ohbbbddo', 21))],
    [P(12, 2,
      '...oo...',
      '..ohdo..',
      '..ohdo..',
      '.ohbddo.',
      '.ohbddo.',
      'ohbbbddo',
      'ohbbbddo')],
  ],

  // Knauf mit Stein · Griff · Parierstange · Klinge · Spitze
  dolch: [
    [P(12, 40,
      '..oooo..',
      '.obhhbo.',
      'obGSGgbo',
      'obgGGgbo',
      '.obddbo.',
      '..oooo..')],
    [P(13, 33, 'wWEEWw', 'wwwwww', 'wWEEWw', 'wwwwww', 'wWEEWw', 'wwwwww', 'wWEEWw')],
    [P(8, 29,
      '..oooooooooooo..',
      '.ohbbbbbbbbbbho.',
      '.odbbbbbbbbbbdo.',
      '..oooooooooooo..')],
    [P(13, 13, ...rep('ohbbdo', 16))],
    [P(13, 6,
      '..oo..',
      '.ohdo.',
      '.ohdo.',
      'ohbbdo',
      'ohbbdo',
      'ohbbdo',
      'ohbbdo')],
  ],

  // Schaft unten · Schaft Mitte · Schaft oben · Tülle · Blattspitze
  speer: [
    [P(14, 36, 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww')],
    [P(14, 24, 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww')],
    [P(14, 13, 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw')],
    [P(13, 9, '.oooo.', 'ohbbdo', 'ohbbdo', '.oooo.')],
    [P(12, 1,
      '...oo...',
      '..ohdo..',
      '.ohbbdo.',
      'ohbbbddo',
      'ohbbbddo',
      '.ohbbdo.',
      '..ohdo..',
      '..ohdo..')],
  ],

  // Schaft unten · Schaft Mitte · Schaft oben · Axtkopf · Schneide
  axt: [
    [P(14, 36, 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww')],
    [P(14, 24, 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww')],
    [P(14, 10, 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw')],
    [P(6, 9,
      '......oooooo',
      '....oohbbbbo',
      '..oohhbbbbbo',
      '.ohhbbbbbbbo',
      '.ohbbbbbbbbo',
      '.ohbbbbbbbbo',
      '.ohbbbbbbbbo',
      '.ohbbbbbbbbo',
      '.oddbbbbbbbo',
      '..oddbbbbbbo',
      '....oodbbbbo',
      '......oooooo')],
    [P(1, 8,
      '.....o',
      '...ooh',
      '..ohhb',
      '.ohbbb',
      'ohbbbb',
      'ohbbbb',
      'ohbbbb',
      'ohbbbb',
      'ohbbbb',
      '.obbbb',
      '.oddbb',
      '..oodd',
      '....oo',
      '.....o')],
  ],

  // Schaft unten · Schaft Mitte · Schaft oben · Hammerkopf · Dorn und Nieten
  hammer: [
    [P(14, 36, 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww')],
    [P(14, 24, 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww')],
    [P(14, 12, 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww')],
    [P(6, 9,
      '..oooooooooooooooo..',
      '.ohhbbbbbbbbbbbbhho.',
      '.ohbbbbbbbbbbbbbbho.',
      '.obbbbbbbbbbbbbbbbo.',
      '.obbbbbbbbbbbbbbbbo.',
      '.obbbbbbbbbbbbbbbbo.',
      '.odbbbbbbbbbbbbbbdo.',
      '.oddbbbbbbbbbbbbddo.',
      '.oddddddddddddddddo.',
      '..oooooooooooooooo..')],
    [
      P(14, 4, '.oo.', 'ohdo', 'ohdo', 'ohdo', 'ohdo'),
      P(9, 11, 'h', 'h', 'h', 'h', 'h', 'h'),
      P(22, 11, 'd', 'd', 'd', 'd', 'd', 'd'),
    ],
  ],

  // Schaft unten · Schaft Mitte · Schaft oben · Fassung · Kristall
  stab: [
    [P(14, 36, 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww')],
    [P(14, 26, 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw')],
    [P(14, 17, 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw', 'wWEw', 'wWEw', 'wwww', 'wWEw')],
    [P(11, 11,
      '.o......o.',
      '.oh....ho.',
      '.ohd..dho.',
      '.ohbddbho.',
      '.ohbbbbho.',
      '..oooooo..')],
    [P(12, 1,
      '...GG...',
      '..GSSG..',
      '.GSSGGG.',
      'GSSGGGGg',
      'GSGGGGgg',
      'GSGGGGgg',
      '.GGGGgg.',
      '.GGGGgg.',
      '..GGgg..',
      '..GGgg..',
      '...gg...')],
  ],

  // unterer Wurfarm · Griff · oberer Wurfarm · Sehne · Pfeil
  bogen: [
    [P(6, 30,
      '.wWEw....',
      '.wWEw....',
      '.wWEw....',
      '..wWEw...',
      '..wWEw...',
      '..wWEw...',
      '...wWEw..',
      '...wWEw..',
      '...wWEw..',
      '....wWEw.',
      '....wWEw.',
      '.....wWEw',
      '.....wWEw',
      '......wWE',
      '.......wW')],
    [P(6, 23, 'wWEWw', 'wwwww', 'wWEWw', 'wwwww', 'wWEWw', 'wwwww', 'wWEWw')],
    [P(6, 8,
      '.......wW',
      '......wWE',
      '.....wWEw',
      '.....wWEw',
      '....wWEw.',
      '....wWEw.',
      '...wWEw..',
      '...wWEw..',
      '...wWEw..',
      '..wWEw...',
      '..wWEw...',
      '..wWEw...',
      '.wWEw....',
      '.wWEw....',
      '.wWEw....')],
    [P(15, 9, ...rep('h', 36))],
    [
      P(10, 24, 'WWWWWWWWWWWWWWW', 'wwwwwwwwwwwwwww'),
      P(25, 22, '.o...', 'ohbo.', 'ohbbo', 'ohbo.', '.o...'),
      P(7, 22, '.EE..', 'EEE..', 'EEEE.', 'EEE..', '.EE..'),
    ],
  ],

  // Knauf · Griff · Schaft · Kopf · Stacheln
  streitkolben: [
    [P(13, 42, '.oooo.', 'ohbbdo', 'ohbbdo', '.oddo.', '..oo..')],
    [P(13, 33, 'wWEEWw', 'wwwwww', 'wWEEWw', 'wwwwww', 'wWEEWw', 'wwwwww', 'wWEEWw', 'wwwwww', 'wWEEWw')],
    [P(13, 20, ...rep('ohbbdo', 13))],
    [P(9, 7,
      '....oooooo....',
      '..oohhbbbboo..',
      '.ohhbbbbbbbdo.',
      'ohhbbbbbbbbbdo',
      'ohbbbbbbbbbbdo',
      'obbbbbbbbbbbdo',
      'obbbbbbbbbbddo',
      'obbbbbbbbbdddo',
      '.obbbbbbbdddo.',
      '.obbbbbdddddo.',
      '..oobbddddoo..',
      '....oooooo....')],
    [
      P(14, 2, '.oo.', 'ohdo', 'ohdo', 'ohdo', 'ohdo'),
      P(2, 11, '.....oo', '..oohhb', 'oohbbbb', '..ooddb', '.....oo'),
      P(23, 11, 'oo.....', 'bhhoo..', 'bbbbhoo', 'bddoo..', 'oo.....'),
      P(6, 6, '.oo.', 'ohbo', '.oo.'),
      P(22, 6, '.oo.', 'obdo', '.oo.'),
    ],
  ],

  // Rand · linke Schale · rechte Schale · Kuppel · Kamm
  helm: [
    [P(5, 33,
      '..oooooooooooooooooo..',
      '.ohbbbbbbbbbbbbbbbbho.',
      '.obbbbbbbbbbbbbbbbbbo.',
      '.oddbbbbbbbbbbbbbbddo.',
      '.oddddddddddddddddddo.',
      '..oooooooooooooooooo..')],
    [P(6, 18,
      '....ooooo',
      '..oohhbbb',
      '.ohhbbbbb',
      '.ohbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ooooooooo',
      'ooooooooo',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohdbbbbbb',
      'ohdbbbbbb',
      'oddbbbbbb',
      'oddbbbbbb')],
    [P(17, 18,
      'ooooo....',
      'bbbddoo..',
      'bbbbbddo.',
      'bbbbbbddo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'ooooooooo',
      'ooooooooo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbddo',
      'bbbbbbddo',
      'bbbbbdddo',
      'bbbbbdddo')],
    [
      P(6, 10,
        '.......oooooo.......',
        '.....oohhhhbboo.....',
        '...oohhhbbbbbbdoo...',
        '..ohhbbbbbbbbbbddo..',
        '.ohhbbbbbbbbbbbbddo.',
        '.ohbbbbbbbbbbbbbbdo.',
        'ohbbbbbbbbbbbbbbbbdo',
        'ohbbbbbbbbbbbbbbbbdo'),
      P(15, 18, ...rep('hd', 13)),
    ],
    [P(13, 3,
      '..oo..',
      '.ohdo.',
      '.ohdo.',
      '.ohdo.',
      '.ohdo.',
      'ohbbdo',
      'ohbbdo',
      'ohbbdo',
      '.oddo.')],
  ],

  // Bauch · Brust links · Brust rechts · Schultern · Emblem
  ruestung: [
    [P(8, 26,
      '.oooooooooooooo.',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'oooooooooooooooo',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'oooooooooooooooo',
      '.ohbbbbbbbbbbdo.',
      '.ohbbbbbbbbbbdo.',
      '..oooooooooooo..',
      '..obbbbbbbbbbo..',
      '..oddddddddddo..',
      '...oooooooooo...')],
    [P(7, 13,
      '...oooooo',
      '.oohhbbbb',
      'ohhbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb',
      'ohbbbbbbb')],
    [P(16, 13,
      'oooooo...',
      'bbbbddoo.',
      'bbbbbbddo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo',
      'bbbbbbbdo')],
    [
      P(2, 11,
        '...ooooo',
        '.oohhbbb',
        'ohhbbbbb',
        'ohbbbbbb',
        'ohbbbbbb',
        'ohbbbbbb',
        '.obbbbbb',
        '.oddbbbb',
        '..ooddbb',
        '....oooo'),
      P(22, 11,
        'ooooo...',
        'bbbddoo.',
        'bbbbbddo',
        'bbbbbbdo',
        'bbbbbbdo',
        'bbbbbbdo',
        'bbbbbbo.',
        'bbbbddo.',
        'bbddoo..',
        'oooo....'),
    ],
    [
      P(13, 16, '..gg..', '.gGGg.', 'gGSSGg', 'gGSSGg', '.gGGg.', '..gg..'),
      P(12, 23, 'oooooooo'),
    ],
  ],

  // linke Stulpe · linke Hand · rechte Stulpe · rechte Hand · Knöchel
  handschuhe: [
    [P(3, 30,
      '.oooooooooo.',
      'ohhbbbbbbbdo',
      'ohbbbbbbbbdo',
      'oooooooooooo',
      'ohbbbbbbbbdo',
      'ohbbbbbbbbdo',
      '.obbbbbbbbo.',
      '.oddddddddo.',
      '..oooooooo..')],
    [
      P(4, 18,
        '..oooooo..',
        '.ohhbbbdo.',
        'ohhbbbbbdo',
        'ohbbbbbbdo',
        'ohbbbbbbdo',
        'ohbbbbbbdo',
        'ohbbbbbbdo',
        'ohbbbbbbdo',
        'ohbbbbbbdo',
        'ohbbbbbbdo',
        '.obbbbbbo.',
        '.oddddddo.',
        '..oooooo..'),
      P(1, 22, '.oo', 'ohb', 'ohb', '.oo'),
    ],
    [P(17, 30,
      '.oooooooooo.',
      'odbbbbbbbhho',
      'odbbbbbbbbho',
      'oooooooooooo',
      'odbbbbbbbbho',
      'odbbbbbbbbho',
      '.obbbbbbbbo.',
      '.oddddddddo.',
      '..oooooooo..')],
    [
      P(18, 18,
        '..oooooo..',
        '.odbbbhho.',
        'odbbbbbhho',
        'odbbbbbbho',
        'odbbbbbbho',
        'odbbbbbbho',
        'odbbbbbbho',
        'odbbbbbbho',
        'odbbbbbbho',
        'odbbbbbbho',
        '.obbbbbbo.',
        '.oddddddo.',
        '..oooooo..'),
      P(28, 22, 'oo.', 'bho', 'bho', 'oo.'),
    ],
    [
      P(5, 21, 'GG.GG.GG', 'gg.gg.gg'),
      P(19, 21, 'GG.GG.GG', 'gg.gg.gg'),
    ],
  ],

  // linke Sohle · linker Schaft · rechte Sohle · rechter Schaft · Borten
  stiefel: [
    [P(2, 38,
      '.ooooooooooo.',
      'ohbbbbbbbbbdo',
      'ohbbbbbbbbbdo',
      'ooooooooooooo',
      'wWWWWWWWWWWWw',
      'wWWWWWWWWWWWw',
      'wwwwwwwwwwwww')],
    [P(4, 22,
      '.ooooooo.',
      'ohhbbbbdo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      'ooooooooo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      'ooooooooo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      'ohbbbbbdo',
      '.ooooooo.')],
    [P(17, 38,
      '.ooooooooooo.',
      'odbbbbbbbbbho',
      'odbbbbbbbbbho',
      'ooooooooooooo',
      'wWWWWWWWWWWWw',
      'wWWWWWWWWWWWw',
      'wwwwwwwwwwwww')],
    [P(19, 22,
      '.ooooooo.',
      'odbbbbhho',
      'odbbbbbho',
      'odbbbbbho',
      'ooooooooo',
      'odbbbbbho',
      'odbbbbbho',
      'odbbbbbho',
      'odbbbbbho',
      'odbbbbbho',
      'odbbbbbho',
      'ooooooooo',
      'odbbbbbho',
      'odbbbbbho',
      'odbbbbbho',
      'odbbbbbho',
      '.ooooooo.')],
    [
      P(3, 18, '..ooooo..', '.ohhbbdo.', 'ohhbbbbdo', '.obbbbdo.', '..ooooo..'),
      P(18, 18, '..ooooo..', '.odbbhho.', 'odbbbbhho', '.odbbbbo.', '..ooooo..'),
    ],
  ],

  // Kordel links · Kordel rechts · Fassung · Medaillon · Kernstein
  talisman: [
    [P(6, 5,
      'WW........',
      'WW........',
      '.WW.......',
      '.WW.......',
      '..WW......',
      '..WW......',
      '...WW.....',
      '...WW.....',
      '....WW....',
      '....WW....',
      '.....WW...',
      '.....WW...',
      '......WW..',
      '.......WW.')],
    [P(16, 5,
      '........WW',
      '........WW',
      '.......WW.',
      '.......WW.',
      '......WW..',
      '......WW..',
      '.....WW...',
      '.....WW...',
      '....WW....',
      '....WW....',
      '...WW.....',
      '...WW.....',
      '..WW......',
      '.WW.......')],
    [P(13, 18, '.oooo.', 'ohbbdo', 'ohbbdo', '.oddo.', '..oo..')],
    [P(8, 22,
      '.....oooooo.....',
      '...oohhhhbboo...',
      '..ohhbbbbbbbdo..',
      '.ohbbbbbbbbbbdo.',
      '.ohbbbbbbbbbbdo.',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      '.obbbbbbbbbbbbo.',
      '.oddbbbbbbbbddo.',
      '..oddbbbbbbddo..',
      '...ooddddddoo...',
      '.....oooooo.....')],
    [P(12, 25,
      '..gGGg..',
      '.gGSSGg.',
      'gGSSSSGg',
      'gGSSSSGg',
      'gGGGGGGg',
      '.gGGGGg.',
      '..gGGg..')],
  ],

  // Bandbogen · Band links · Band rechts · Fassung · Edelstein
  ring: [
    [P(8, 36,
      'obd..........dbo',
      'obd..........dbo',
      '.obd........dbo.',
      '..obd......dbo..',
      '...obdd..ddbo...',
      '....obbddbbo....',
      '.....obbbbo.....',
      '......oooo......')],
    [P(8, 24, ...rep('obd', 13))],
    [P(21, 24, ...rep('dbo', 13))],
    [P(7, 18,
      '...oooooooooooo...',
      '.oohhbbbbbbbbhhoo.',
      '.ohbbbbbbbbbbbbho.',
      '.obbbbbbbbbbbbbbo.',
      '.oddbbbbbbbbbbddo.',
      '..oddddddddddddo..',
      '...oooooooooooo...')],
    [P(11, 8,
      '....GG....',
      '..GGSSGG..',
      '.GSSSSSSG.',
      'GSSSSSSSSG',
      'GSSSSSSSSG',
      'GgSSSSSSgG',
      '.gGSSSSGg.',
      '.ggGGGGgg.',
      '..ggGGgg..',
      '...gggg...',
      '....gg....')],
  ],

  // Körper · Kopf · Ohren · Schwanz · Augen
  gefaehrte: [
    [P(8, 28,
      '.....oooooo.....',
      '...oohhbbbboo...',
      '..ohhbbbbbbbdo..',
      '.ohbbbbbbbbbbdo.',
      '.ohbbbbbbbbbbdo.',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      'ohbbbbbbbbbbbbdo',
      '.obbbbbbbbbbbdo.',
      '.obbbbbbbbbbbbo.',
      '.odbbbbbbbbbbdo.',
      '..oddddddddddo..',
      '...oooooooooo...')],
    [
      P(9, 14,
        '.....oooo.....',
        '...oohhhhoo...',
        '..ohhbbbbbdo..',
        '.ohhbbbbbbbdo.',
        '.ohbbbbbbbbdo.',
        'ohbbbbbbbbbbdo',
        'ohbbbbbbbbbbdo',
        'ohbbbbbbbbbbdo',
        'ohbbbbbbbbbbdo',
        'ohbbbbbbbbbbdo',
        '.obbbbbbbbbbo.',
        '.oddbbbbbbddo.',
        '..oddddddddo..',
        '...oooooooo...'),
      P(15, 22, 'oo', 'oo'),
    ],
    [
      P(10, 8, '..oo', '.ohd', '.ohd', 'ohbd', 'ohbd', 'ohbd', 'ohbd'),
      P(18, 8, 'oo..', 'dho.', 'dho.', 'dbho', 'dbho', 'dbho', 'dbho'),
    ],
    [P(22, 30,
      '.....ooo.',
      '....ohhbo',
      '...ohbbbo',
      '..ohbbbdo',
      '..ohbbbdo',
      '..ohbbbdo',
      '..ohbbbdo',
      '..ohbbdo.',
      '.ohbbbdo.',
      '.obbbddo.',
      '.oddddo..',
      '..oooo...')],
    [
      P(12, 19, 'SG', 'GG'),
      P(18, 19, 'SG', 'GG'),
    ],
  ],
};
ITEM_ART._default = ITEM_ART.schwert;

// ── Zeichnen ────────────────────────────────────────────────────────────────
function _color(ch, which) {
  const m = MAT[which] || MAT.past;
  if (ch === 'o' || ch === 'd' || ch === 'b' || ch === 'h') return m[ch];
  if (ch === 'w' || ch === 'W' || ch === 'E') return WOOD[ch];
  const gem = GEM[which] || GEM.past;
  if (ch === 'g' || ch === 'G' || ch === 'S') return gem[ch];
  return null;
}

// Zeichen-Zeilen → Rechtecke. Erst waagerecht (gleiche Farbe nebeneinander), dann
// senkrecht (gleiche Farbe/Breite untereinander) zusammenfassen — aus ~600 Pixeln
// je Objekt werden so ein paar Dutzend <rect>.
function _rects(blocks) {
  const runs = [];   // {x,y,w,ch}
  for (const b of blocks) {
    b.rows.forEach((row, ry) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        let w = 1;
        while (x + w < row.length && row[x + w] === ch) w++;
        if (ch !== '.') runs.push({ x: b.x + x, y: b.y + ry, w, ch });
        x += w;
      }
    });
  }
  const out = [];
  const open = new Map();   // key = x|w|ch → offener Rechteck-Eintrag
  const byRow = new Map();
  for (const r of runs) {
    if (!byRow.has(r.y)) byRow.set(r.y, []);
    byRow.get(r.y).push(r);
  }
  const ys = [...byRow.keys()].sort((a, b) => a - b);
  for (const y of ys) {
    const seen = new Set();
    for (const r of byRow.get(y)) {
      const key = r.x + '|' + r.w + '|' + r.ch;
      seen.add(key);
      const cur = open.get(key);
      if (cur && cur.y + cur.h === y) cur.h++;
      else { const rect = { x: r.x, y, w: r.w, h: 1, ch: r.ch }; open.set(key, rect); out.push(rect); }
    }
    for (const [key, rect] of open) if (!seen.has(key) && rect.y + rect.h <= y) open.delete(key);
  }
  return out;
}

// Materialpalette nach außen (Avatar zeichnet seine Rüstungsteile in denselben
// Tönen wie die Schmiede — sonst hätte dasselbe Objekt zwei Farbwelten).
export function matPalette(which) { return { ...(MAT[which] || MAT.past) }; }
export function gemPalette(which) { return { ...(GEM[which] || GEM.past) }; }

// Griff-Anker je Waffe: der Punkt im 32×48-Raster, der IN der Faust liegt.
const GRIP = {
  schwert: [16, 37], dolch: [16, 36], speer: [16, 30], axt: [16, 30],
  hammer: [16, 30], stab: [16, 30], bogen: [8, 26], streitkolben: [16, 37],
};
// Objekte, deren Kopf im Icon nach links zeigt — in der Hand gespiegelt (nach vorn).
const FLIP = new Set(['axt']);

// Bounding-Box eines Objekts (einmal berechnet) — damit eine eingebettete Waffe
// nicht über den Rand des Ziel-Rasters hinausrutscht und abgeschnitten wird.
const _bbox = {};
function bbox(type) {
  if (_bbox[type]) return _bbox[type];
  let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
  for (const blocks of (ITEM_ART[type] || ITEM_ART._default)) {
    for (const r of _rects(blocks)) {
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    }
  }
  return (_bbox[type] = { x0, y0, x1, y1 });
}

// Fertiges Objekt als <g> IN einem anderen Sprite (z. B. die Waffe in der Faust
// des 64×96-Avatars — beide Raster haben dieselbe Pixelgröße, also 1:1). atX/atY
// ist die Faust; die Gruppe wird so verschoben, dass der Griff dort liegt, aber
// nie über den Rand des Ziel-Rasters (w×h) hinaus.
export function itemGroupSVG(type, which, atX, atY, w = 64, h = 96, cls = '') {
  const parts = ITEM_ART[type] || ITEM_ART._default;
  const grip = GRIP[type] || [16, 37];
  const bb = bbox(type);
  // Einseitige Objekte zeigen im Icon nach links (Axtblatt), in der Hand sollen sie
  // nach VORNE zeigen — also gespiegelt an der Faust. Der Bogen zielt schon nach vorn.
  const flip = FLIP.has(type);
  const x0 = flip ? 2 * grip[0] - bb.x1 : bb.x0;
  const x1 = flip ? 2 * grip[0] - bb.x0 : bb.x1;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dx = clamp(Math.round(atX - grip[0]), -x0, w - x1);
  const dy = clamp(Math.round(atY - grip[1]), -bb.y0, h - bb.y1);
  const rects = parts.map((blocks) => _rects(blocks)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${_color(r.ch, which)}"/>`)
    .join('')).join('');
  const inner = flip ? `<g transform="translate(${2 * grip[0]},0) scale(-1,1)">${rects}</g>` : rects;
  // transform-origin = Faust: der Schwung im Kampf dreht um den Griff, nicht um die Ecke.
  return `<g class="${cls}" transform="translate(${dx},${dy})" style="transform-origin:${grip[0]}px ${grip[1]}px;">${inner}</g>`;
}

// Fertiges Objekt als eigenes Icon (Ausrüstungs-Felder, Tasche, Vorschau).
export function itemIconSVG(type, which, cls = 'it-icon') {
  return itemPartsSVG(type, ['built', 'built', 'built', 'built', 'built'], which, cls);
}

// Ein Objekt als SVG. states[i] = 'built' | 'next' | 'ghost' für Teil i.
// built/next bekommen ihre echten Farben (das nächste Teil pulsiert per CSS über
// die Deckkraft — man sieht also, WAS man gerade freispielt); ghost bleibt eine
// farblose Andeutung, die CSS einfärbt.
export function itemPartsSVG(type, states, which, cls = 'fw-weapon') {
  const parts = ITEM_ART[type] || ITEM_ART._default;
  const gs = parts.map((blocks, i) => {
    const st = states[i] || 'ghost';
    const rects = _rects(blocks).map((r) => {
      const fill = st === 'ghost' ? '' : ` fill="${_color(r.ch, which)}"`;
      return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"${fill}/>`;
    }).join('');
    return `<g class="wp ${st}">${rects}</g>`;
  }).join('');
  return `<svg class="${cls}" viewBox="0 0 ${ART_W} ${ART_H}" preserveAspectRatio="xMidYMid meet"
    shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:100%;display:block;image-rendering:pixelated;" aria-hidden="true">${gs}</svg>`;
}
