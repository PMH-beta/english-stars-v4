// src/modules/pixel-icons.js
// UI-Ikonografie des Pastell-Designs: Pixel-Art auf 14×14-Canvas.
//
// Übernommen aus dem Prototyp (design_handoff_english_stars_pastell/
// "English Stars UI Pastell.dc.html", Logik-Klasse am Dateiende) und von der
// Design-Component-Runtime auf ein ESM-Modul umgestellt. Die Masken sind
// unverändert, 1:1 aus der Spezifikation.
//
// Prinzip: jedes Icon ist eine Zeichenmaske — ein Zeichen = ein Pixel, jeder
// Buchstabe ein Palettenschlüssel, '.' = transparent. Die 1-px-Tintenkontur wird
// BERECHNET, damit sie in jeder Größe exakt gleich stark bleibt. Icons mit feiner
// Binnenzeichnung (Stern, Haken, X, Chevrons, Statusleiste, Griff) tragen ihre
// Kontur in der Maske selbst und setzen dafür noOutline.
//
// NICHT übernommen: weapon(), enemy(), arena() und hero() aus dem Prototyp. Die
// Sprites der App bleiben, wie sie sind — avatar.js (Charakter, Gefährte),
// pixel-items.js (Schmiede-Waffen), pixel-enemies.js (Gegner). Dieses Modul
// liefert ausschließlich UI-Symbole.
//
// SKALIERUNG — der häufigste Fehler beim Nachbau: der Backing-Store ist 14×14,
// angezeigt werden darf nur in ganzzahligen Vielfachen von 14 (14/28/42/56).
// Jede andere Größe rechnet das Raster um, die Pixelspalten werden abwechselnd
// 1 und 2 px breit und die Kontur wirkt ungleich stark. iconHTML() rastet darum
// auf das nächste Vielfache ein und meldet es in der Konsole. Drehungen nur in
// 90°-Schritten — image-rendering:pixelated rettet keinen Zwischenwinkel.
// Zwei Icons haben eine abweichende Box (ICON_BOX): grip ist schmal und hoch,
// bossCrest zu groß für 14×14. Der Vergrößerungsfaktor bleibt derselbe.
//
// Einsatz im Markup (die App rendert per innerHTML):
//   `<div class="zeile">${iconHTML('coin', 28)}<span>12</span></div>`
// Gemalt wird automatisch: startIconAutoPaint() haengt einen MutationObserver auf
// <body> und fuellt jedes neu aufgetauchte Icon-Canvas.

export const ICON_GRID = 14;   // Backing-Store-Kantenlänge, siehe Skalierungsregel

export const ICON_PAL = {
  K:'#1F1F24', W:'#F8F6EC', A:'#FFD66B', Y:'#FFE9A8', O:'#E0A82E', L:'#C9B8FF', V:'#8B6FE8',
  M:'#B7E3C2', R:'#FFBBC1', S:'#BCE3FF', P:'#FFD6A5', F:'#FF8A3D',
  G:'#C3CDD9', D:'#8A97A3', N:'#A9703F', B:'#6B4423',
  E:'#D64545'   // neu im Stand vom 28.09.2026
};

export const ICONS = {
  close:{ noOutline:true, rows:[
    'KK......KK','KKK....KKK','.KKK..KKK.','..KKKKKK..','...KKKK...',
    '...KKKK...','..KKKKKK..','.KKK..KKK.','KKK....KKK','KK......KK'] },
  dots:{ noOutline:true, rows:['KK..KK..KK','KK..KK..KK'] },
  chevron:{ noOutline:true, rows:['KKKKKKKKK','.KKKKKKK.','..KKKKK..','...KKK...','....K....'] },
  chevronUp:{ noOutline:true, rows:['....K....','...KKK...','..KKKKK..','.KKKKKKK.','KKKKKKKKK'] },
  chevronUpLight:{ noOutline:true, rows:['....W....','...WWW...','..WWWWW..','.WWWWWWW.','WWWWWWWWW'] },
  signal:{ noOutline:true, rows:[
    '......KK','......KK','...KK.KK','...KK.KK','KK.KK.KK'] },
  battery:{ noOutline:true, rows:[
    'KKKKKK..','KKKKKK..','KKKKKKKK','KKKKKKKK','KKKKKK..','KKKKKK..'] },
  back:{ noOutline:true, rows:[
    '....K......','...KK......','..KKK......','.KKKKKKKKKK','KKKKKKKKKKK',
    'KKKKKKKKKKK','.KKKKKKKKKK','..KKK......','...KK......','....K......'] },
  starInk:{ noOutline:true, rows:[
    '......K......','.....KKK.....','.....KKK.....','....KKKKK....','KKKKKKKKKKKKK','.KKKKKKKKKKK.','..KKKKKKKKK..',
    '...KKKKKKK...','...KKKKKKK...','..KKKKKKKKK..','..KKKK.KKKK..','.KKKK...KKKK.','.KKK.....KKK.'] },
  star:{ noOutline:true, rows:[
    '......K......','.....KAK.....','.....KYK.....','....KYAAK....','KKKKYYAAAKKKK','.KYYAAAAAAOK.','..KAAAAAAOK..',
    '...KAAAAOK...','...KAAAAOK...','..KAAAKAOOK..','..KAAK.KAOK..','.KAAK...KOOK.','.KKK.....KKK.'] },
  crown:{ noOutline:true, rows:[
    '.K....K....K.','KYK..KYK..KYK','KAK..KAK..KAK','KAAK.KAK.KAAK','KAAAKAAAKAAAK','KAAAAAAAAAAAK','KARAAALAAARAK',
    'KAAAAAAAAAAAK','KOOOOOOOOOOOK','KKKKKKKKKKKKK'] },
  lock:{ rows:[
    '..GGGG..','.GG..GG.','GG....GG','AAAAAAAA','AAAKKAAA','AAAKKAAA','AAAAAAAA','AAAAAAAA'] },
  mail:{ rows:[
    'WWWWWWWWWWWW','KKWWWWWWWWKK','WKKWWWWWWKKW','WWKKWWWWKKWW','WWWKKWWKKWWW',
    'WWWWKKKKWWWW','WWWWWWWWWWWW','WWWWWWWWWWWW'] },
  check:{ noOutline:true, rows:[
    '............KK','...........KKK','..........KKK.','.........KKK..',
    '........KKK...','.......KKK....','......KKK.....','KK...KKK......',
    'KKK.KKK.......','.KKKKK........','..KKK.........','...KK.........'] },
  music:{ rows:[
    '....LLLLLLL.','....LLLVVVV.','....LLVVVV..','....LLVVV...','....LL......',
    '....LL......','....LL......','....LL......','LLLLLL......','LWWLLL......','LLLLLL......','.LLLL.......'] },
  speaker:{ rows:[
    '...SS..S..','..SSS.S.S.','SSSSS..S.S','SSSSS..S.S','..SSS.S.S.','...SS..S..'] },
  scan:{ noOutline:true, rows:[
    'KKKK...KKKK','K.........K','K.........K','...........','KKKKKKKKKKK',
    '...........','K.........K','K.........K','KKKK...KKKK'] },
  grip:{ noOutline:true, rows:[
    'KK.KK','.....','KK.KK','.....','KK.KK','.....','KK.KK'] },
  bossCrest:{ rows:[
    '..A.........A..','..AA.......AA..','..AAA.....AAA..','..AAAA...AAAA..',
    '..AAAAA.AAAAA..','..AAAAAAAAAAA..','..AAAAAAAAAAA..','..AKAAAKAAAKA..',
    '..AAAAAAAAAAA..','...AAAAAAAAA...','....AAAAAAA....','...RRRRRRRRR...',
    '..RRRRRRRRRRR..','..RRKRRKRRKRR..','..RRRRRRRRRRR..','...RRRRRRRRR...'] },
  crownBig:{ noOutline:true, rows:[
    '.K....K....K.','KYK..KYK..KYK','KAK..KAK..KAK','KAAK.KAK.KAAK','KAAAKAAAKAAAK','KAAAAAAAAAAAK','KARAAALAAARAK',
    'KAAAAAAAAAAAK','KOOOOOOOOOOOK','KKKKKKKKKKKKK'] },
  key:{ rows:[
    '.GGGG.......','GG..GG......','GG..GGGGGGGG','GG..GG.G...G','.GGGG..G...G'] },
  coin:{ rows:[
    '...AAAA...','.AAAAAAAA.','AAYAAAOOAA','AAYAAOOAAA','AAAAOOAAAA','AAAOOAAAAA','AAOOAAAAAA','AAOAAAAAAA','.AAAAAAAA.','...AAAA...'] },
  coinOff:{ rows:[
    '...GGGG...','.GGGGGGGG.','GGWGGGDDGG','GGWGGDDGGG','GGGGDDGGGG','GGGDDGGGGG','GGDDGGGGGG','GGDGGGGGGG','.GGGGGGGG.','...GGGG...'] },
  flame:{ rows:[
    '....F....','...FFF...','...FFF...','..FFFFF..','..FFYFF..',
    '.FFFYFFF.','.FFYYYFF.','.FFFFFFF.','..FFFFF..'] },
  campfire:{ rows:[
    '....F....','...FFF...','..FFYFF..','..FFYFF..','...FFF...','.........',
    'NNNNNNNNN','.NNNNNNN.'] },
  potion:{ rows:[
    '...BB...','...BB...','..WWWW..','..WWWW..','.WWWWWW.','WWWWWWWW',
    'WLLLLLLW','WLLLLLLW','WLLLLLLW','.WLLLLW.','..WWWW..'] },
  map:{ rows:[
    '.PPPPPPPP.','PPPPPPPPPP','PPKPPPPPPP','PPPKPPPPPP','PPPPKPPPPP',
    'PPPPPKKPPP','PPPPPPPKPP','PPPPPPPPKP','PPPPPPPPPP','.PPPPPPPP.'] },
  book:{ rows:[
    '.WWWWKWWWW.','WWWWWKWWWWW','WSSSWKWSSSW','WWWWWKWWWWW','WSSSWKWSSSW',
    'WWWWWKWWWWW','.WWWWKWWWW.'] },
  bulb:{ rows:[
    '..YYYY..','.YYYYYY.','YYYYYYYY','YYYYYYYY','YYYYYYYY','.YYYYYY.','..DDDD..','..DDDD..','...DD...'] },
  hammer:{ rows:[
    'GG......','GGGGGGGG','GGGGGGGG','GGGGGGGG','...NN...','...NN...','...NN...','...NN...','...NN...'] },
  test:{ rows:[
    '..NNNN..','WWWWWWWW','WWWWWWWW','WKKKKKWW','WWWWWWWW','WKKKKKWW','WWWWWWWW','WKKKKKWW','WWWWWWWW'] },
  target:{ rows:[
    '...RR...','.RRRRRR.','RRRWWRRR','RRWKKWRR','RRWKKWRR','RRRWWRRR','.RRRRRR.','...RR...'] },
  trophy:{ rows:[
    'AA.AAAA.AA','AA.AAAA.AA','AAAAAAAAAA','.AAAAAAAA.','..AAAAAA..',
    '...AAAA...','....AA....','...AAAA...','..AAAAAA..'] },
  pencil:{ rows:[
    '.....PPP','....PPPP','...PPPP.','..PPPP..','.PPPP...','PPPP....','KPP.....','KK......'] },
  helm:{ rows:[
    '..GGGG..','.GGGGGG.','GGGGGGGG','GGGGGGGG','GKKGGKKG','GGGGGGGG','GKKKKKKG','GGGGGGGG','.GGGGGG.'] },
  shield:{ rows:[
    'SSSSSSSS','SSSSSSSS','SSSKKSSS','SKKKKKKS','SSSKKSSS','SSSKKSSS','.SSSSSS.','..SSSS..','...SS...'] },
  glove:{ rows:[
    '..RRRRR.','.RKRKRKR','.RRRRRRR','RRRRRRRR','RRRRRRR.','.RRRRRR.','.WWWWWW.','.WWWWWW.'] },
  boots:{ rows:[
    'NNNN....','NNNN....','NNNN....','NNNN....','NNNNNNN.','NNNNNNNN','KKKKKKKK'] },
  sword:{ rows:[
    '....GG....','...GGGD...','...GGGD...','...GGGD...','...GGGD...','...GGGD...','.AAAAAAAA.','.AOOOOOOA.',
    '....NN....','....BB....','...OOOO...','....OO....'] },
  orb:{ rows:[
    '..LLLL..','.LWLLLL.','LWLLLLLL','LLLLLLLL','LLLLLLLL','.LLLLLL.','..LLLL..'] },
  ring:{ rows:[
    '...SS....','..SSSS...','...SS....','.AAAAAAA.','AAWWWWWAA','AAWWWWWAA','.AAAAAAA.'] },
  paw:{ noOutline:true, rows:[
    '..KK....KK..','.KKKK..KKKK.','.KKKK..KKKK.','..KK....KK..','KK........KK','KKK.KKKK.KKK','KK.KKKKKK.KK',
    '...KKKKKK...','..KKKKKKKK..','..KKKKKKKK..','...KKKKKK...'] },
  trash:{ rows:[
    '...KKKKKK...','...KKKKKK...','KKKKKKKKKKKK','KKKKKKKKKKKK','.RRRRRRRRRR.',
    '.RKRRKRRKRR.','.RKRRKRRKRR.','.RKRRKRRKRR.','.RKRRKRRKRR.','.RKRRKRRKRR.',
    '.RRRRRRRRRR.','..RRRRRRRR..'] },
  gem:{ rows:['.SSSSSS.','SSSSSSSS','SWWWWWWS','SSSSSSSS','.SSSSSS.','..SSSS..','...SS...'] },
  portal:{ rows:[
    '...LLLLL...','..LLLLLLL..','.LLKKKKKLL.','LLKLLLLLKLL','LLKLLKKLKLL','LLKLKLLLKLL','LLKLLKKKKLL','LLKLLLLLLLL','.LLKKKKKKL.','..LLLLLLL..','...LLLLL...'] },


  // ── Nachtrag aus dem Handoff-Stand vom 28.09.2026 ─────────────────────────
  // Diese Symbole brauchen die Screen-Fragmente; unsere Fassung kannte sie noch
  // nicht. Unveraendert aus ICONS in "English Stars UI Pastell.dc.html".
  checkLight:{ noOutline:true, rows:[
    '............WW','...........WWW','..........WWW.','.........WWW..','........WWW...','.......WWW....',
    '......WWW.....','WW...WWW......','WWW.WWW.......','.WWWWW........','..WWW.........','...WW.........'] },
  mic:{ rows:[
    '...GGG...','..GDGDG..','..GGGGG..','..GDGDG..','..GGGGG..','..GDGDG..','..GGGGG..','...GGG...','....G....',
    '....G....','.GGGGGGG.'] },
  lupe:{ rows:[
    '...GGGGG...','..GG...GG..','.GG.....GG.','.G.......G.','.G.......G.','.G.......G.','.GG.....GG.','..GG...GG..',
    '...GGGGG...','.......DDD.','........DDD'] },
  friends:{ rows:[
    '.LL......LL.','LLLL....LLLL','LLLL....LLLL','.LL......LL.','...LLLLLL...','..LLLLLLLL..','.LLLLLLLLLL.',
    'LLLLLLLLLLLL'] },
  cloud:{ rows:[
    '....SSSS....','..SSSSSSSS..','.SSSSSSSSSS.','SSSSSSSSSSSS','SSSSSSSSSSSS','.SSSSSSSSSS.'] },
  calendar:{ rows:[
    '.KK.....KK.','.KK.....KK.','SSSSSSSSSSS','SSSSSSSSSSS','WWWWWWWWWWW','WKWKWKWKWKW','WWWWWWWWWWW','WKWKWKWKWKW',
    'WWWWWWWWWWW'] },
  box:{ rows:[
    'NNNNNNNNNN','NNNNNNNNNN','BBBBBBBBBB','BBBBNNBBBB','BBBBNNBBBB','BBBBNNBBBB','BBBBNNBBBB','BBBBBBBBBB'] },
  chart:{ rows:[
    '......SSSS','......SSSS','...MMMSSSS','...MMMSSSS','AAAMMMSSSS','AAAMMMSSSS','AAAMMMSSSS','KKKKKKKKKK'] },
  refresh:{ noOutline:true, rows:[
    '....KKKKKK....','..KKKKKKKKKK..','.KKK......KKK.','.KK.....KKKKKK','KK.......KKKK.','KK........KK..',
    'KK............','KK............','KK.........KK.','.KK.......KK..','.KKK.....KKK..','..KKKKKKKKK...',
    '....KKKKKK....'] },
  hourglass:{ rows:[
    'KKKKKKKKK','.YYYYYYY.','..YYYYY..','...YYY...','....Y....','...AYA...','..AAAAA..','.AAAAAAA.','KKKKKKKKK'] },
  heart:{ rows:[
    '.RR.....RR.','RRWRRRRRRRR','RRWRRRRRRRR','RRRRRRRRRRR','.RRRRRRRRR.','..RRRRRRR..','...RRRRR...','....RRR....',
    '.....R.....'] },
  skull:{ rows:[
    '..WWWWW..','.WWWWWWW.','WWWWWWWWW','WKKWWWKKW','WKKWWWKKW','WWWWWWWWW','.WWWWWWW.','.WKWKWKW.','.WWWWWWW.'] },
  flag:{ rows:[
    'KAAAAAAA.','KAAAAAA..','KMMMMM...','KMMMM....','KRRR.....','K........','K........','K........'] },
  install:{ rows:[
    '.GGGGGGG.','.GDDDDDG.','.GDDADDG.','.GDDADDG.','.GAAAAAG.','.GDAAADG.','.GDDADDG.','.GDDDDDG.','.GGGGGGG.'] },
  toolbox:{ rows:[
    '....KKKKK....','...KKKKKKK...','NNNNNNNNNNNNN','NNNNNNNNNNNNN','BBBBBBBBBBBBB','BBBBBKKKBBBBB','BBBBBBBBBBBBB',
    'BBBBBBBBBBBBB','BBBBBBBBBBBBB'] },
  order:{ rows:[
    'MMMMM...SSSSS','MMMMM...SSSSS','MMMMM...SSSSS','MMMMM...SSSSS','.............','.............','.............',
    'PPPPP...AAAAA','PPPPP...AAAAA','PPPPP...AAAAA','PPPPP...AAAAA'] },
  wand:{ rows:[
    '........AAA','.......AAA.','......AAA..','.....KKK...','....KKK....','...KKK.....','..KKK......','.KKK.......',
    'KKK........'] },
  catHair:{ rows:[
    '..NNNNNN..','.NNNNNNNNN','NNNNNNNNNN','NNPPPNNNNN','NPPPPPPPPN','NPKPPPPKPN','NPPPPPPPPN','.PPPRRPPP.',
    '..PPPPPP..'] },
  catSkin:{ rows:[
    '..WWWWWW..','.WWPWWNWW.','WWPPWNNWWW','WWWWWWWBBW','WWW..WWBBW','WWW..WWWWW','.WWWWWWWW.','..WWWWWW..'] },
  catEye:{ noOutline:true, rows:[
    '...KKKKK...','.KKWWWWWKK.','KWWWSSSWWWK','KWWSSKSSWWK','KWWWSSSWWWK','.KKWWWWWKK.','...KKKKK...'] },
  catMouth:{ noOutline:true, rows:[
    'K.........K','KK.......KK','.KKKKKKKKK.','.KRRRRRRRK.','..KRRRRRK..','...KKKKK...'] },
  catTop:{ rows:[
    '.SSS..SSS.','SSSSSSSSSS','SSSSSSSSSS','SSSSSSSSSS','..SSSSSS..','..SSSSSS..','..SSSSSS..','..SSSSSS..'] },
  catPants:{ rows:[
    'BBBBABBB','VVVVVVVV','VVVVVVVV','VVV..VVV','VVV..VVV','VVV..VVV','VVV..VVV','VVV..VVV'] },
  catBuild:{ rows:[
    '...PPP...','..PPPPP..','..PPPPP..','...PPP...','.LLLLLLL.','LLLLLLLLL','LLLLLLLLL','.LLLLLLL.','.LL...LL.',
    '.LL...LL.'] },
  flameR:{ rows:[
    '.....F...','....FF...','...FFF...','..FFFFF..','..FFFYF..','.FFFYYFF.','.FFYYYFF.','.FFFFFFF.','..FFFFF..'] },
  flameL:{ rows:[
    '...F.....','...FF....','...FFF...','..FFFFF..','..FYFFF..','.FFYYFFF.','.FFYYYFF.','.FFFFFFF.','..FFFFF..'] },
  campfireR:{ rows:[
    '.....F...','....FF...','..FFFYF..','..FFYFF..','...FFF...','.........','NNNNNNNNN','.NNNNNNN.'] },
  campfireL:{ rows:[
    '...F.....','...FF....','..FYFFF..','..FFYFF..','...FFF...','.........','NNNNNNNNN','.NNNNNNN.'] },
};

export const ICON_NAMES = Object.keys(ICONS);

// Icons, deren Maske nicht in ein quadratisches 14er-Raster passt, bekommen einen
// eigenen Backing-Store. Angezeigt wird trotzdem mit demselben Faktor size/14 —
// nur das Seitenverhältnis weicht ab.
export const ICON_BOX = {
  grip: [9, 14],        // 5×7-Maske, schmal und hoch; der Prototyp zeigt sie 18×28
  bossCrest: [14, 18],  // 15×16-Maske plus Kontur — in 14×14 fiele oben und unten je eine Zeile weg
};
const boxOf = (name) => ICON_BOX[name] || [ICON_GRID, ICON_GRID];

// ── Zeichnen ────────────────────────────────────────────────────────────────

function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); }

// Malt die Maske zentriert in W×H. Ohne noOutline kommt eine berechnete
// 1-px-Tintenkontur um die Füllfläche — sie wächst in JEDE Richtung, Binnenlücken
// unter 3 px Breite werden dadurch zugeschüttet (Fallstrick der Spezifikation).
export function drawIcon(ctx, name, W = ICON_GRID, H = ICON_GRID) {
  const def = ICONS[name];
  if (!def) return false;
  const rows = def.rows, key = (x, y) => x + ',' + y;
  let minX = 1e3, maxX = -1, minY = 1e3, maxY = -1;
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } });
  if (maxX < 0) return false;
  const ox = Math.floor((W - (maxX - minX + 1)) / 2) - minX;
  const oy = Math.floor((H - (maxY - minY + 1)) / 2) - minY;
  const fill = new Map();
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = r[x]; if (c === '.') continue;
    fill.set(key(x + ox, y + oy), ICON_PAL[c] || ICON_PAL.K); } });
  if (!def.noOutline) {
    const edge = new Set();
    fill.forEach((_, k) => { const [x, y] = k.split(',').map(Number);
      [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dx, dy]) => {
        const nk = key(x + dx, y + dy); if (!fill.has(nk)) edge.add(nk); }); });
    edge.forEach(k => { const [x, y] = k.split(',').map(Number); px(ctx, x, y, ICON_PAL.K); });
  }
  fill.forEach((c, k) => { const [x, y] = k.split(',').map(Number); px(ctx, x, y, c); });
  return true;
}

// ── Markup + Bemalen ────────────────────────────────────────────────────────

// Rastet auf ein Vielfaches von ICON_GRID ein (mind. 14) und meldet Abweichungen.
export function snapIconSize(size) {
  const n = Math.max(1, Math.round(Number(size) / ICON_GRID));
  const snapped = n * ICON_GRID;
  if (Number(size) !== snapped) {
    console.warn('[pixel-icons] ' + size + 'px ist kein Vielfaches von ' + ICON_GRID + ' — auf ' + snapped + 'px gerastet.');
  }
  return snapped;
}

// Canvas-Markup für einen innerHTML-Template-String. `size` ist die Anzeigegröße
// des 14er-Rasters; der Faktor size/14 gilt auch für abweichende Boxen, damit ein
// Icon neben dem anderen gleich fein aussieht. cls/style werden angehängt.
export function iconHTML(name, size = ICON_GRID, { cls = '', style = '' } = {}) {
  if (!ICONS[name]) { console.warn('[pixel-icons] unbekanntes Icon "' + name + '"'); return ''; }
  const k = snapIconSize(size) / ICON_GRID;
  const [bw, bh] = boxOf(name);
  return '<canvas data-icon="' + name + '" width="' + bw + '" height="' + bh + '"'
    + (cls ? ' class="' + cls + '"' : '')
    + ' style="width:' + bw * k + 'px;height:' + bh * k + 'px;image-rendering:pixelated;flex:none;' + style + '"></canvas>';
}

// Einzelnes Canvas füllen. Bereits bemalte werden übersprungen.
export function paintIconCanvas(c) {
  if (!c || c.dataset.iconPainted === '1') return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (drawIcon(ctx, c.dataset.icon, c.width, c.height)) c.dataset.iconPainted = '1';
}

// Alle noch leeren Icon-Canvas unterhalb von root füllen.
export function paintIcons(root = document) {
  const list = root.querySelectorAll('canvas[data-icon]:not([data-icon-painted])');
  list.forEach(paintIconCanvas);
  return list.length;
}

// Die App rendert überall per innerHTML — statt an jeder Stelle ans Nachmalen zu
// denken, beobachtet ein MutationObserver den Baum und füllt, was neu dazukommt.
// Gebündelt per requestAnimationFrame, damit ein Render mit 30 Icons ein Durchlauf
// bleibt. Attribute werden NICHT beobachtet, sonst löste data-icon-painted sich
// selbst wieder aus.
let _observer = null;
export function startIconAutoPaint() {
  if (_observer) return;
  paintIcons(document);
  let pending = false;
  _observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; paintIcons(document); });
  });
  _observer.observe(document.body, { childList: true, subtree: true });
}

export function stopIconAutoPaint() {
  if (_observer) { _observer.disconnect(); _observer = null; }
}

// ── Prüfhilfe ───────────────────────────────────────────────────────────────
// Die Spezifikation verlangt, nach jeder Maskenänderung die ALPHAMASKE zu prüfen
// und nicht den Screenshot: die berechnete Kontur schüttet schmale Binnenlücken
// zu, was bei 14 px mit dem Auge nicht auffällt. Liefert das Raster als Zeilen.
export function iconAlphaMask(name, W = 0, H = 0) {
  if (!W || !H) { const b = boxOf(name); W = b[0]; H = b[1]; }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!drawIcon(ctx, name, W, H)) return [];
  const d = ctx.getImageData(0, 0, W, H).data;
  const out = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) r += d[(y * W + x) * 4 + 3] > 40 ? '#' : '.';
    out.push(r);
  }
  return out;
}
