// src/modules/minigame-karte.js
// Aufgabenkarte der Kampf-Minispiele (Fragmente 7.4–7.13): Symbolkachel, Name
// des Minispiels, die Frage, rechts die Restzeit, an der Unterkante der
// Zeitbalken. Jedes Minispiel setzt sie oben in seinen Host und bewegt Balken
// und Sekunden selbst — über die IDs, die es mitgibt.

import { iconHTML, meteorHTML } from './pixel-icons.js';

const ART = {
  sturm:   { name: 'Buchstabensturm',      icon: 'pencil',  ton: 'var(--p-pfirsich)' },
  meteore: { name: 'Wort-Meteoriten',      icon: 'meteor',  ton: 'var(--p-lila)' },
  echo:    { name: 'Echo-Fang',            icon: 'speaker', ton: 'var(--p-rosa)' },
  richtig: { name: 'Richtig oder falsch?', icon: 'check',   ton: 'var(--p-blau)' },
};

const _esc = (s) => (window.escHtml ? window.escHtml(String(s)) : String(s));

/** Deutsches Wort mit kleinem „DE" davor (7.4, 7.7). */
export const frageDE = (de) => `<span class="mg-de"><span>DE</span>${_esc(de)}</span>`;

/** Verbform-Frage „go → [Simple Past]?" (7.10, 7.11); which = 'past' | 'pp'. */
export const frageForm = (en, which) =>
  `${_esc(en)} → <span class="mg-form mg-form--${which === 'pp' ? 'pp' : 'past'}">${which === 'pp' ? 'Past Participle' : 'Simple Past'}</span>?`;

/**
 * @param {object} o
 * @param {'sturm'|'meteore'|'echo'|'richtig'} o.art
 * @param {string} o.frage   fertiges HTML der Frage (frageDE, frageForm oder Text)
 * @param {string} [o.zeitId] ID der Balkenfüllung — ohne: kein Balken (Meteoriten)
 * @param {string} [o.sekId]  ID der Sekundenanzeige — ohne: keine
 * @param {string} [o.rechts] Markup rechts neben der Frage (Echo: Nochmal-Hören)
 * @param {boolean} [o.pochen] Symbol schlägt im Takt (Echo 7.8: data-ui="beat")
 */
export function aufgabeKarte({ art, frage, zeitId = null, sekId = null, rechts = '', pochen = false }) {
  const a = ART[art] || ART.sturm;
  let bild = a.icon === 'meteor' ? meteorHTML(28) : iconHTML(a.icon, 28);
  if (pochen) bild = bild.replace('<canvas ', '<canvas data-ui="beat" data-c="8" data-a="2" ');
  return `<div class="mg-aufgabe">
    <div class="mg-aufgabe-zeile">
      <div class="mg-aufgabe-kachel" style="background:${a.ton}">${bild}</div>
      <div class="p-wachs"><div class="mg-aufgabe-art">${a.name}</div><div class="mg-aufgabe-frage">${frage}</div></div>
      ${rechts}${sekId ? `<div class="mg-aufgabe-sek" id="${sekId}"></div>` : ''}
    </div>
    ${zeitId ? `<div class="mg-aufgabe-spur"><div class="mg-aufgabe-fuell" id="${zeitId}"></div></div>` : ''}
  </div>`;
}

/** Restzeit wie im Entwurf: „6 s". */
export const sekText = (ms) => Math.max(0, Math.ceil(ms / 1000)) + ' s';
