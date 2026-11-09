// Live-Übersetzung Deutsch ↔ Englisch aus dem Offline-Wörterbuch (models/woerterbuch-v1/,
// WikDict, CC BY-SA 4.0). Ohne DOM/fetch — der Worker lädt die Texte, Tests lesen Dateien.
//
// Ablauf beim Tippen auf einer Seite („quelle“), die andere Seite ist „ziel“:
//  · passt die Quelle schon zum Ziel (eine der Übersetzungen) → nichts ändern ('exakt');
//  · ist die Quelle der Anfang einer Übersetzung des Ziels („geht in die Richtung“)
//    → nichts ändern, auch nicht rot markieren ('unterwegs');
//  · sonst → Ziel durch die beste Übersetzung der Quelle ersetzen (falls es eine gibt).

export const WOERTERBUCH_ORDNER = 'models/woerterbuch-v1/';

// Datei „schlüssel TAB a|b|c“ → Map(schlüssel → 'a|b|c')
export function karteAus(text) {
  const m = new Map();
  const n = text.length;
  let i = 0;
  while (i < n) {
    let e = text.indexOf('\n', i); if (e < 0) e = n;
    const ende = e > i && text.charCodeAt(e - 1) === 13 ? e - 1 : e;   // CRLF (Windows-Checkout)
    const t = text.indexOf('\t', i);
    if (t > i && t < ende) m.set(text.slice(i, t), text.slice(t + 1, ende));
    i = e + 1;
  }
  return m;
}

const _VOR = {
  en: ['to ', 'the ', 'a ', 'an '],
  de: ['der ', 'die ', 'das ', 'den ', 'dem ', 'des ', 'ein ', 'eine ', 'einen ', 'sich '],
};
const _FUELL = new Set(['sb', 'sth', 'sb.', 'sth.', 'so.', 'etw', 'etw.', 'jdn', 'jdn.', 'jdm', 'jdm.', 'jds', 'jds.']);
const _anders = s => (s === 'de' ? 'en' : 'de');

// Vergleichsform: klein, ohne Klammern, Ziffern, Artikel/„to“ und sb/sth/etw.
export function kern(seite, text) {
  let x = (text || '').toLowerCase().replace(/’/g, "'")
    .replace(/\([^)]*\)?/g, ' ').replace(/[^\p{L}' .\-]+/gu, ' ').replace(/\s+/g, ' ').trim();
  for (const v of _VOR[seite]) if (x.startsWith(v)) { x = x.slice(v.length); break; }
  return x.split(' ').filter(w => w && !_FUELL.has(w)).join(' ').replace(/[.\-]+$/, '').trim();
}

// Inhalte vollständiger Klammern: „on (Monday)“ → ['Monday']
function _klammern(text) { return [...(text || '').matchAll(/\(([^)]*)\)/g)].map(m => m[1].trim()).filter(Boolean); }

// Formen, unter denen eine Seite nachgeschlagen wird: ganz, Kern, Klammerinhalte.
function _teile(seite, text) {
  const a = new Set();
  const voll = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (voll) a.add(voll);
  const k = kern(seite, text);
  if (k) a.add(k);
  for (const kl of _klammern(text)) { const kk = kern(seite, kl); if (kk) a.add(kk); }
  return [...a];
}

function _nachschlagen(karte, schluessel) {
  const z = karte.get(schluessel);
  return z ? z.split('|') : [];
}

// Alle Übersetzungen einer Seite (beste zuerst), z. B. für „Haus“ → house, home, …
export function uebersetzungen(karten, seite, text) {
  const k = kern(seite, text);
  return k ? _nachschlagen(karten[seite], k) : [];
}

// Passt `text` (Seite `seite`) zu `gegen` (andere Seite)? → 'exakt' | 'unterwegs' | false
export function passt(karten, seite, text, gegen) {
  const ziel = _anders(seite);
  const zTeile = _teile(ziel, gegen);
  if (!zTeile.length) return false;
  const qTeile = _teile(seite, text);
  for (const q of qTeile) for (const v of _nachschlagen(karten[seite], q)) if (zTeile.includes(kern(ziel, v))) return 'exakt';
  for (const z of zTeile) for (const v of _nachschlagen(karten[ziel], z)) if (qTeile.includes(kern(seite, v))) return 'exakt';
  // Unterwegs: Buchstabe für Buchstabe der Anfang einer Übersetzung (auch mit „to “/Artikel).
  const roh = (text || '').toLowerCase().replace(/’/g, "'").replace(/^[^\p{L}(]+/u, '').replace(/\s+/g, ' ');
  if (!roh.trim()) return false;
  if (/\([^)]*$/.test(roh)) return 'unterwegs';           // Klammer noch offen: erst fertig tippen
  for (const z of zTeile) for (const v of _nachschlagen(karten[ziel], z)) {
    const w = v.toLowerCase();
    if (w.startsWith(roh)) return 'unterwegs';
    for (const p of _VOR[seite]) if ((p + w).startsWith(roh)) return 'unterwegs';
  }
  return false;
}

// Beste Übersetzung von `text` auf die andere Seite. Klammern (Zusätze wie „(feste)“)
// werden nicht mitübersetzt — dabei kam zu oft Unsinn heraus („fortress“).
// → Text oder null (nichts gefunden / zu kurz).
export function uebersetze(karten, seite, text) {
  const k = kern(seite, text);
  return (k.length >= 2 && _nachschlagen(karten[seite], k)[0]) || null;
}

// Eine Live-Anfrage: Quelle wurde geändert. → { passt, neu }
//   neu = Vorschlag für die andere Seite (nur wenn sie nicht passt), sonst null.
export function live(karten, seite, text, gegen) {
  const p = passt(karten, seite, text, gegen);
  if (p) return { passt: p, neu: null };
  const neu = uebersetze(karten, seite, text);
  return { passt: false, neu: neu && neu !== (gegen || '').trim() ? neu : null };
}
