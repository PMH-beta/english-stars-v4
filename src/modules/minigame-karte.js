// src/modules/minigame-karte.js
// Aufgabe der Kampf-Minispiele (Update 1, Fragmente F.1–F.11): EIN Panel oben —
// Symbolkachel in der Farbe der Kampfart, darunter die Anweisung in Grau, die
// Frage groß, auf Wunsch ein Mittelteil (Wortleiste des Buchstabensturms) und
// unten die Zeitzeile mit Sanduhr, Sekunden und Balken. Jedes Minispiel setzt
// das Panel oben in seinen Host und bewegt Balken und Sekunden selbst — über die
// IDs, die es mitgibt.

import { iconHTML } from './pixel-icons.js';

// Kachel je Kampfart (F.1 Meteoriten, F.6 Richtig/Falsch, F.7 Sturm).
const ART = {
  sturm:   { icon: 'pencil', ton: 'var(--p-pfirsich)' },
  meteore: { icon: 'target', ton: 'var(--p-pfirsich)' },
  richtig: { icon: 'target', ton: 'var(--p-blau)' },
};

// Unregelmäßige und Boss tragen ihre eigene Kachel (F.8, F.9, F.11) — gesetzt vom
// Kampf je Welle, gilt für alle Arten außer Echo (dort ist die Kachel der
// Hör-Knopf, F.5/F.10).
let _knotenKachel = null;
/** @param {{icon:string, ton:string}|null} k */
export function setKnotenKachel(k) { _knotenKachel = k; }

const _esc = (s) => (window.escHtml ? window.escHtml(String(s)) : String(s));

// Pfeil zwischen Verb und Form (F.8–F.10), Pixelgrafik aus dem Fragment.
const PFEIL = '<svg width="18" height="12" viewBox="0 0 6 4" shape-rendering="crispEdges" style="flex:none"><rect x="0" y="1.5" width="4" height="1" fill="#1F1F24"></rect><rect x="3" y="0.5" width="1" height="3" fill="#1F1F24"></rect><rect x="4" y="1" width="1" height="2" fill="#1F1F24"></rect><rect x="5" y="1.5" width="1" height="1" fill="#1F1F24"></rect></svg>';

// Hörbild statt Wort (F.5, F.10): neun Balken im Wechsel Tinte/Flieder, laufen
// im Takt (data-ui „bars").
const BALKEN = '<span class="mg-hoerbild" data-ui="bars" data-a="24">'
  + [[8, 'K'], [16, 'L'], [24, 'K'], [12, 'L'], [20, 'K'], [10, 'L'], [22, 'K'], [14, 'L'], [8, 'K']]
    .map(([h, c]) => `<span style="height:${h}px;background:${c === 'K' ? 'var(--p-ink)' : 'var(--p-lila)'}"></span>`).join('')
  + '</span>';

/** Deutsches Wort mit kleinem „DE" davor (F.1, F.7). */
export const frageDE = (de) => `<span class="mg-de"><span>DE</span>${_esc(de)}</span>`;

/** Verbform-Frage „go → [Simple Past]" (F.8, F.9); which = 'past' | 'pp'. */
export const frageForm = (en, which) =>
  `<span class="mg-wort">${_esc(en)}</span>${PFEIL}<span class="mg-form">${which === 'pp' ? 'Past Participle' : 'Simple Past'}</span>`;

/** Hörfrage: nur das Hörbild (F.5) oder „take → Hörbild" (F.10). */
export const frageHoeren = (en = '') => (en ? `<span class="mg-wort">${_esc(en)}</span>${PFEIL}` : '') + BALKEN;

/**
 * @param {object} o
 * @param {'sturm'|'meteore'|'echo'|'richtig'} o.art
 * @param {string} o.anweisung   graue Zeile über der Frage („Schreibe auf Englisch")
 * @param {string} o.frage       fertiges HTML der Frage (frageDE, frageForm, frageHoeren oder Text)
 * @param {boolean} [o.text]     Frage ist ein Satz („Passt das Paar?") — Knopf-Stufe statt groß
 * @param {string} [o.kachel]    eigenes Markup an der Stelle der Kachel (Echo: Hör-Knopf)
 * @param {string} [o.mitte]     Mittelteil unter der Frage (Wortleiste des Sturms)
 * @param {string} [o.zeitId]    ID der Balkenfüllung — ohne: keine Zeitzeile (Meteoriten)
 * @param {string} [o.sekId]     ID der Sekundenanzeige
 */
export function aufgabeKarte({ art, anweisung, frage, text = false, kachel = '', mitte = '', zeitId = null, sekId = null }) {
  const a = _knotenKachel || ART[art] || ART.sturm;
  const bild = kachel || `<span class="mg-aufgabe-kachel" style="background:${a.ton}">${iconHTML(a.icon, 28)}</span>`;
  return `<div class="mg-aufgabe">
    <div class="mg-aufgabe-zeile">
      ${bild}
      <div class="mg-aufgabe-text">
        <span class="mg-aufgabe-art">${anweisung}</span>
        <span class="mg-aufgabe-frage${text ? ' mg-aufgabe-frage--text' : ''}">${frage}</span>
      </div>
    </div>
    ${mitte ? `<div class="mg-aufgabe-mitte">${mitte}</div>` : ''}
    ${zeitId ? `<div class="mg-zeit">${iconHTML('hourglass', 14)}<span class="mg-zeit-sek" id="${sekId}"></span>`
      + `<div class="mg-zeit-spur"><div class="mg-zeit-fuell" id="${zeitId}"></div></div></div>` : ''}
  </div>`;
}

/** Restzeit wie im Entwurf: „6 s". */
export const sekText = (ms) => Math.max(0, Math.ceil(ms / 1000)) + ' s';

// ── Pixel-Steine (Update 1, F.1–F.11) ──────────────────────────────────────
// Alles Antippbare im Spielfeld ist ein Stein: Tintenrand und Fläche mit
// gestuften Ecken, Licht oben, Schatten unten, zwei Sprenkel. Die Farbe kommt
// aus der Klasse (style.css: lila Runen, orange Meteoriten, Papier, grün = richtig,
// rot = falsch) — so kann ein Stein beim Antworten einfach umfärben.
/**
 * @param {string} inhalt  fertiges HTML (Buchstabe, Wort, Symbol + Text)
 * @param {'lila'|'orange'|'papier'|'gruen'|'rot'} ton
 * @param {string} [cls]   Größe/Lage (mg-stein--rune, --meteor, --paar, --knopf)
 */
export const steinHTML = (inhalt, ton, cls = '') =>
  `<span class="mg-stein mg-stein--${ton}${cls ? ' ' + cls : ''}"><span class="mg-stein-rand">`
  + `<span class="mg-stein-flaeche" data-press="1">${inhalt}</span></span></span>`;

/** Abzeichen oben rechts am Stein (F.2, F.3): Haken = richtig, Kreuz = falsch. */
export const abzeichenHTML = (ok) => `<span class="mg-abzeichen">${iconHTML(ok ? 'check' : 'close', 14)}</span>`;

// Funkenstern um einen Stein (F.2 richtig ×1,1, F.3 falsch ×0,8, F.4 verpasst ×1,5):
// acht Pixel im Kreis, vier weiße innen, einer in der Mitte — flackert im Takt.
const FUNKEN = [
  [-4, -30, 8, 0], [15, -21, 6, 1], [22, -4, 8, 0], [15, 15, 6, 1], [-4, 22, 8, 0], [-21, 15, 6, 1], [-30, -4, 8, 0], [-21, -21, 6, 1],
  [-3, -16, 6, 2], [10, -3, 6, 2], [-3, 10, 6, 2], [-16, -3, 6, 2], [-6, -6, 12, 1],
];
/** @param {'gold'|'rot'} art  @param {number} k  Größe */
export function funkenHTML(art, k) {
  const farben = art === 'rot' ? ['#FF7F86', '#FFBBC1', '#FFFFFF'] : ['#F2A23C', '#FFD66B', '#FFFFFF'];
  return '<span class="mg-funken" data-ui="flicker">' + FUNKEN.map(([x, y, w, c]) =>
    `<span style="left:${x * k}px;top:${y * k}px;width:${w * k}px;height:${w * k}px;background:${farben[c]}"></span>`).join('') + '</span>';
}

// Flamme über einem fallenden Meteor (F.1): Pixelgrafik 16 × 10 in 3×, dazu drei
// Glutfunken; flackert im Takt (data-ui „flicker", je Meteor versetzt).
const FLAMME_SVG = '<svg width="48" height="30" viewBox="0 0 16 10" shape-rendering="crispEdges" style="display:block">'
  + [[7,0,2,'A'],[2,1,1,'A'],[7,1,2,'A'],[13,1,1,'A'],[2,2,2,'A'],[6,2,1,'A'],[7,2,2,'O'],[9,2,1,'A'],[12,2,2,'A'],
    [1,3,1,'A'],[2,3,1,'O'],[3,3,1,'A'],[6,3,1,'A'],[7,3,2,'O'],[9,3,1,'A'],[12,3,1,'A'],[13,3,1,'O'],[14,3,1,'A'],
    [1,4,1,'A'],[2,4,2,'O'],[4,4,1,'A'],[6,4,1,'A'],[7,4,2,'O'],[9,4,1,'A'],[11,4,1,'A'],[12,4,2,'O'],[14,4,1,'A'],
    [1,5,1,'A'],[2,5,2,'O'],[4,5,2,'A'],[6,5,1,'O'],[7,5,2,'W'],[9,5,1,'O'],[10,5,2,'A'],[12,5,2,'O'],[14,5,1,'A'],
    [0,6,1,'A'],[1,6,2,'O'],[3,6,1,'W'],[4,6,1,'O'],[5,6,1,'A'],[6,6,1,'O'],[7,6,2,'W'],[9,6,1,'O'],[10,6,1,'A'],[11,6,1,'O'],[12,6,1,'W'],[13,6,2,'O'],[15,6,1,'A'],
    [0,7,1,'A'],[1,7,1,'O'],[2,7,2,'W'],[4,7,2,'O'],[6,7,4,'W'],[10,7,2,'O'],[12,7,2,'W'],[14,7,1,'O'],[15,7,1,'A'],
    [0,8,1,'A'],[1,8,1,'O'],[2,8,12,'W'],[14,8,1,'O'],[15,8,1,'A'],
    [1,9,1,'A'],[2,9,1,'O'],[3,9,10,'W'],[13,9,1,'O'],[14,9,1,'A']]
    .map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${{ A: '#FFD66B', O: '#F2A23C', W: '#FFF6D6' }[c]}"></rect>`).join('')
  + '</svg>';
export const flammeHTML = (d = 0) => `<span class="mg-flamme" data-ui="flicker" data-d="${d}">${FLAMME_SVG}`
  + '<span style="left:12px;top:-8px;width:4px;height:4px;background:rgba(255,214,107,.7)"></span>'
  + '<span style="left:31px;top:-15px;width:4px;height:4px;background:rgba(255,214,107,.45)"></span>'
  + '<span style="left:22px;top:-24px;width:3px;height:3px;background:rgba(255,214,107,.25)"></span></span>';

/** Mini-Hörbild in der Echo-Blase (F.5): drei Balken. */
export const blasenBalken = '<span class="mg-blase-balken"><span style="height:6px"></span><span style="height:12px"></span><span style="height:8px"></span></span>';
