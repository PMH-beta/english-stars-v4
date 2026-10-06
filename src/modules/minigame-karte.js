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
