// Hintergrund-Thread für Wort- und Namensprüfung. Die Wortlisten (≈ 25 MB im Speicher)
// liegen nur hier; pruefen.js startet den Worker bei Bedarf und beendet ihn, wenn Ruhe ist.
import { pruefeSeite, OPT_EN, OPT_DE } from './wortpruefung.js';
import { pruefeName } from './namenpruefung.js';
import { WOERTER_ORDNER, lexikonEN, lexikonDE, namenAus } from './wortpruefung-daten.js';

const basis = new URL('../../' + WOERTER_ORDNER, import.meta.url);
const holen = async (datei, json) => {
  const r = await fetch(new URL(datei, basis));
  if (!r.ok) throw new Error(datei + ': ' + r.status);
  return json ? r.json() : r.text();
};

let _lex = null, _namen = null;
function lexika() {
  if (!_lex) _lex = (async () => {
    const [en, de, vorlagen] = await Promise.all([holen('en.txt'), holen('de.txt'), holen('vorlagen.json', true)]);
    return { en: lexikonEN(en, vorlagen), de: lexikonDE(de, vorlagen), vorlagen };
  })().catch(e => { _lex = null; throw e; });
  return _lex;
}
function namen() {
  if (!_namen) _namen = (async () => {
    const [l, liste] = await Promise.all([lexika(), holen('namen.json', true)]);
    return namenAus(l.en, l.de, liste, l.vorlagen);
  })().catch(e => { _namen = null; throw e; });
  return _namen;
}

self.onmessage = async ({ data: { id, art, de, en, name } }) => {
  try {
    if (art === 'laden') { await lexika(); self.postMessage({ id, ok: true }); return; }
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
