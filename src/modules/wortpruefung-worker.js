// Hintergrund-Thread für Wort- und Namensprüfung. Die Wortlisten (≈ 25 MB im Speicher)
// liegen nur hier; pruefen.js startet den Worker bei Bedarf und beendet ihn, wenn Ruhe ist.
import { pruefeSeite, OPT_EN, OPT_DE } from './wortpruefung.js';
import { pruefeName } from './namenpruefung.js';
import { WOERTER_ORDNER, lexikonEN, lexikonDE, namenAus } from './wortpruefung-daten.js';
import { WOERTERBUCH_ORDNER, karteAus, live } from './uebersetzung.js';

const basis = new URL('../../' + WOERTER_ORDNER, import.meta.url);
const holen = async (datei, json, ordner = basis) => {
  const r = await fetch(new URL(datei, ordner));
  if (!r.ok) throw new Error(datei + ': ' + r.status);
  return json ? r.json() : r.text();
};

let _lex = null, _namen = null, _wb = null;
function lexika() {
  if (!_lex) _lex = (async () => {
    const [en, de, vorlagen] = await Promise.all([holen('en.txt'), holen('de.txt'), holen('vorlagen.json', true)]);
    return { en: lexikonEN(en, vorlagen), de: lexikonDE(de, vorlagen), vorlagen };
  })().catch(e => { _lex = null; throw e; });
  return _lex;
}
// Wörterbuch für die Live-Übersetzung (≈ 8 MB Text, zwei Richtungen).
const wbBasis = new URL('../../' + WOERTERBUCH_ORDNER, import.meta.url);
function woerterbuch() {
  if (!_wb) _wb = (async () => {
    const [de, en] = await Promise.all([holen('de-en.txt', false, wbBasis), holen('en-de.txt', false, wbBasis)]);
    return { de: karteAus(de), en: karteAus(en) };
  })().catch(e => { _wb = null; throw e; });
  return _wb;
}
function namen() {
  if (!_namen) _namen = (async () => {
    const [l, liste] = await Promise.all([lexika(), holen('namen.json', true)]);
    return namenAus(l.en, l.de, liste, l.vorlagen);
  })().catch(e => { _namen = null; throw e; });
  return _namen;
}

self.onmessage = async ({ data: { id, art, de, en, name, seite, text, gegen } }) => {
  try {
    if (art === 'laden') { await Promise.all([lexika(), woerterbuch().catch(() => {})]); self.postMessage({ id, ok: true }); return; }
    // Live: Seite `seite` wurde geändert. Wortprüfung dieser Seite + Übersetzung.
    // Fehlt das Wörterbuch, kommt nur die Prüfung zurück (passt: false, neu: null).
    if (art === 'live') {
      const l = await lexika();
      const pruef = pruefeSeite(text, seite === 'de' ? l.de : l.en, seite === 'de' ? OPT_DE : OPT_EN);
      let wb = null;
      try { wb = await woerterbuch(); } catch (e) { /* ohne Übersetzung weiter */ }
      const r = wb ? live(wb, seite, text, gegen) : { passt: false, neu: null };
      self.postMessage({ id, pruef, ...r });
      return;
    }
    if (art === 'paar') {
      const l = await lexika();
      self.postMessage({ id, en: pruefeSeite(en, l.en, OPT_EN), de: pruefeSeite(de, l.de, OPT_DE) });
      return;
    }
    if (art === 'name') { self.postMessage({ id, ...pruefeName(name, await namen()) }); return; }
    throw new Error('unbekannt: ' + art);
  } catch (e) {
    self.postMessage({ id, fehler: String(e?.message || e) });
  }
};
