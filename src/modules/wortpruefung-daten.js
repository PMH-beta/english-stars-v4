// Packt die Wortlisten aus models/woerter-v1/ aus und baut Lexika + Namensfilter.
// Ohne DOM/fetch — der Worker lädt die Texte, Tests lesen sie aus Dateien.
import { lexikon, WortListe, EN_KURZ, EN_ABK, DE_KURZ, DE_ABK } from './wortpruefung.js';
import { namenFilter, normName } from './namenpruefung.js';

export const WOERTER_ORDNER = 'models/woerter-v1/';

// Zeile: Zeichen(48 + gemeinsamer Anfang) [+ Rang-Ziffer] + Rest
export function entpacken(text, mitRang = false) {
  const woerter = [], rang = mitRang ? new Map() : null;
  let vor = '', i = 0;
  const n = text.length;
  while (i < n) {
    let e = text.indexOf('\n', i); if (e < 0) e = n;
    const ende = e > i && text.charCodeAt(e - 1) === 13 ? e - 1 : e;   // CRLF (Windows-Checkout)
    if (ende > i) {
      const p = text.charCodeAt(i) - 48;
      let a = i + 1, r = 0;
      if (mitRang) { r = text.charCodeAt(a) - 48; a++; }
      const w = vor.slice(0, p) + text.slice(a, ende);
      woerter.push(w);
      if (mitRang) { const k = w.toLowerCase(), alt = rang.get(k); if (alt === undefined || r < alt) rang.set(k, r); }
      vor = w;
    }
    i = e + 1;
  }
  return { woerter, rang };
}

export function lexikonEN(enTxt, vorlagen) {
  const { woerter, rang } = entpacken(enTxt, true);
  return lexikon(woerter, { rang, kurz: EN_KURZ, abk: EN_ABK, namenStrafe: true, bevorzugt: vorlagen?.en || [] });
}
export function lexikonDE(deTxt, vorlagen) {
  return lexikon(entpacken(deTxt).woerter, { kurz: DE_KURZ, abk: DE_ABK, bevorzugt: vorlagen?.de || [] });
}

// Namensfilter aus den beiden Lexika (Schlüssel normalisiert: ä → ae …).
export function namenAus(en, de, namen, vorlagen) {
  const norm = lex => { const a = []; for (const k of lex.liste) { const n = normName(k); if (n.length >= 3) a.push(n); } return WortListe.aus(a); };
  const haeufig = [];
  for (let i = 0; i < en.liste.n; i++) if (en.rangA[i] <= 1) haeufig.push(normName(en.liste.wort(i)));
  return namenFilter({ en: namen.en, de: namen.de }, { en: norm(en), de: norm(de) },
    { erlaubt: [...(vorlagen?.en || []), ...(vorlagen?.de || [])], haeufig: new Set(haeufig), teilsicher: namen.teilsicher });
}
