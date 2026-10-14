// src/modules/schmuck-gold.js
// Stärkere Gold-Versionen von Talisman und Ring (Wunsch des Nutzers 14.10.2026,
// F-99): „Sonnen-Talisman“ — Sonnen-Medaillon mit sieben Strahlen, kleiner Krone
// mit Rubinen und großem Amethyst an dicker Gliederkette — und „Kronenring“ —
// dickes Band mit zwei Seitensteinen, Kronen-Fassung, großer geschliffener Rubin.
// Eigene Pixeldaten neben pixel-world-fine.js (das Modul bleibt unverändert, Regel 5),
// Farben aus dessen Paletten, 32 × 32 wie die übrigen Gegenstände.
//
// rows: je Pixel ein Buchstabe der Palette pal (A = pal[0] …), '.' = leer.
// teile: Schmiede-Teil 0–4 je Pixel in der Reihenfolge von PART_NAMES — Talisman:
// Kordel links, Kordel rechts, Fassung, Medaillon, Kernstein; Ring: Bandbogen,
// Band links, Band rechts, Fassung, Edelstein. Damit läuft die Schmiede mit den
// fünf Schritten wie bei allen anderen Werkstücken (composeParts aus dem Modul).

const DATEN = {
  talisman: {
    pal: ['#5a3c0b', '#b8871f', '#f7d466', '#ff5a5a', '#e2b53c', '#fff0b0', '#8a5f12', '#2a0a5a', '#f6eeff', '#ffffff', '#d4b8ff', '#a878ff', '#6a4fc8'],
    rows: [
      '....A......................A....',
      '...AA......................AA...',
      '...ABA....................ABA...',
      '...ABA....................ABA...',
      '...ACA....................ACA...',
      '....ACA..................ACA....',
      '....ABA..................ABA....',
      '.....ACA................ACA.....',
      '.....ABBA.A....AA....A.ABBA.....',
      '......ACCADA..ADDA..ADACCA......',
      '.......AABCA..ACEA..ABBAA.......',
      '.........ACEAACCEEAAEBA.........',
      '..........AEEECDDCEEBA..........',
      '..........AAAEEEEEAAAA..........',
      '........AA...AFFCA...AA.........',
      '........ACAAAFFFCCAAAEA.........',
      '.........AFFFGGGGGCEEA..........',
      '.........AFFGHHHHHHEEA..........',
      '.........AFGHIJKKKKHEA..........',
      '........AFGHKJIKKKLLHBA.........',
      '......AAFFGHKIKKKLLLHBBAA.......',
      '.....ACCFFGHKKKLLLLMHBBBBA......',
      '......AACCGHKKLLLLMMHGGAA.......',
      '........ACGHLLLLLMMMHGA.........',
      '.........ACGHLLMMMMHGA..........',
      '.........AEEGHHHHHHGGA..........',
      '.........AEEEGGGGGGGGA..........',
      '........AEAAABBBGGAAABA.........',
      '........AA...ABBGA...AA.........',
      '..............ABA...............',
      '..............ABA...............',
      '...............A................',
    ],
    teile: [
      '....0......................1....',
      '...00......................11...',
      '...000....................111...',
      '...000....................111...',
      '...000....................111...',
      '....000..................111....',
      '....000..................111....',
      '.....000................111.....',
      '.....0000.2....22....2.1111.....',
      '......000022..2222..221111......',
      '.......00022..2222..22111.......',
      '.........02222222222221.........',
      '..........222222222222..........',
      '..........222222222222..........',
      '........33...33333...33.........',
      '........333333333333333.........',
      '.........3333333333333..........',
      '.........3333444444333..........',
      '.........3334444444433..........',
      '........333444444444433.........',
      '......3333344444444443333.......',
      '.....333333444444444433333......',
      '......3333344444444443333.......',
      '........333444444444433.........',
      '.........3334444444433..........',
      '.........3333444444333..........',
      '.........3333333333333..........',
      '........333333333333333.........',
      '........33...33333...33.........',
      '..............333...............',
      '..............333...............',
      '...............3................',
    ],
  },
  ring: {
    pal: ['#4a0a14', '#ffe0d0', '#ffffff', '#ff9a8a', '#ff5a5a', '#5a3c0b', '#c8303c', '#e2b53c', '#b8871f', '#f7d466', '#fff0b0', '#8a5f12'],
    rows: [
      '................................',
      '.............AAAAAA.............',
      '............ABCDDDDA............',
      '...........ABCBDDDEEA...........',
      '.........FADBDDDEEEEEAF.........',
      '.........FFDDDDEEEEGGFF.........',
      '.........FHEDDEEEEEGGIF.........',
      '.........FHEEEEEEEGGGIF.........',
      '.........FHAEEGGGGGGAIF.........',
      '.........FHHAGGGGGGAIIF.........',
      '.........FHHHAAAAAAIIIF.........',
      '..........FHHHHHHHIIIF..........',
      '..........FJHHHHHHIIF...........',
      '......AAAFKKKKKKJJJJHFFAAA......',
      '.....ABDEAKKKKJJJJJJJHABDEA.....',
      '.....ADEEAKKJJFFFHHHHHADEEA.....',
      '.....AEEGAKJFF...FFHHHAEEGA.....',
      '......AAAKJF.......FIHHAAA......',
      '......FKKJF.........FIIIF.......',
      '.....FJKKJF.........FIIIIF......',
      '.....FJKJJF.........FLIIIF......',
      '.....FJKJJF.........FLIILF......',
      '.....FJJJJF.........FLIILF......',
      '......FJJHF.........FLIIF.......',
      '......FJJHHF.......FLLILF.......',
      '......FHJJHIFF...FFLLLLLF.......',
      '.......FHHHHIIFFFLLLLLLF........',
      '........FHHHIIILLLLILLF.........',
      '........FFIHHHIIIIILLFF.........',
      '..........FFIIIIILLFF...........',
      '............FFFFFFF.............',
      '................................',
    ],
    teile: [
      '................................',
      '.............444444.............',
      '............44444444............',
      '...........4444444444...........',
      '.........34444444444443.........',
      '.........33444444444433.........',
      '.........33444444444433.........',
      '.........33444444444433.........',
      '.........33444444444433.........',
      '.........33344444444333.........',
      '.........33334444443333.........',
      '..........333333333333..........',
      '..........13333333333...........',
      '......11111111122222222222......',
      '.....1111111111222222222222.....',
      '.....1111111111222222222222.....',
      '.....111111111...2222222222.....',
      '......111111.......2222222......',
      '......11111.........22222.......',
      '.....111111.........222222......',
      '.....111111.........222222......',
      '.....111111.........222222......',
      '.....111111.........222222......',
      '......11111.........22222.......',
      '......000000.......000000.......',
      '......00000000...00000000.......',
      '.......00000000000000000........',
      '........000000000000000.........',
      '........000000000000000.........',
      '..........00000000000...........',
      '............0000000.............',
      '................................',
    ],
  },
};

const _fertig = {};
/** Gold-Schmuck als { img: { w, h, col }, pm } — nur für talisman und ring, sonst null. */
export function goldSchmuck(type) {
  const d = DATEN[type];
  if (!d) return null;
  if (!_fertig[type]) {
    const col = [], pm = [];
    d.rows.forEach((zeile, y) => [...zeile].forEach((ch, x) => {
      col.push(ch === '.' ? null : d.pal[ch.charCodeAt(0) - 65]);
      const t = d.teile[y][x];
      pm.push(t === '.' ? -1 : +t);
    }));
    _fertig[type] = { img: { w: d.rows[0].length, h: d.rows.length, col }, pm };
  }
  return _fertig[type];
}
