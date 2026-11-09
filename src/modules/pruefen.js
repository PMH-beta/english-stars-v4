// Wort- und Namensprüfung vom Haupt-Thread aus (Worker: wortpruefung-worker.js).
// Lassen sich die Wortlisten nicht laden (offline beim ersten Start, alter Browser),
// wird NICHT gesperrt: pruefePaar → null, pruefeNamen → { ok: true }.

let _w = null, _n = 0, _ruhe = 0;
const _offen = new Map();
const RUHE_MS = 90000;           // so lange ohne Anfrage → Worker beenden, Speicher frei
const WARTEN_MS = 30000;         // Laden + Prüfen dauert länger → durchlassen

function _beenden() {
  if (_w) { _w.terminate(); _w = null; }
  for (const [, o] of _offen) o.fertig({ fehler: 'beendet' });
  _offen.clear();
}
function _worker() {
  if (_w) return _w;
  try {
    _w = new Worker(new URL('./wortpruefung-worker.js', import.meta.url), { type: 'module' });
  } catch (e) { console.warn('[pruefen] kein Worker:', e?.message); return null; }
  _w.onmessage = ({ data }) => { const o = _offen.get(data.id); if (o) { _offen.delete(data.id); o.fertig(data); } };
  _w.onerror = e => { console.warn('[pruefen] Worker-Fehler:', e?.message); _beenden(); };
  return _w;
}
function _frage(nachricht) {
  return new Promise(res => {
    const w = _worker();
    if (!w) { res({ fehler: 'kein Worker' }); return; }
    const id = ++_n;
    const t = setTimeout(() => { if (_offen.delete(id)) res({ fehler: 'zu langsam' }); }, WARTEN_MS);
    _offen.set(id, { fertig: d => { clearTimeout(t); res(d); } });
    w.postMessage({ id, ...nachricht });
    clearTimeout(_ruhe);
    _ruhe = setTimeout(() => { if (!_offen.size) _beenden(); }, RUHE_MS);
  });
}

// Schon beim Öffnen eines Anlege-Screens aufrufen, damit die erste Prüfung schnell ist.
export function vorwaermen() { _frage({ art: 'laden' }); }

// → { en: Ergebnis, de: Ergebnis } (siehe wortpruefung.js pruefeSeite) oder null = nicht prüfbar
export async function pruefePaar(de, en) {
  const r = await _frage({ art: 'paar', de: de || '', en: en || '' });
  if (r.fehler) { console.warn('[pruefen] Wortprüfung übersprungen:', r.fehler); return null; }
  return { en: r.en, de: r.de };
}

// Live beim Tippen: Seite `seite` ('de'|'en') hat jetzt `text`, die andere Seite `gegen`.
// → null (nicht prüfbar) oder { passt: 'exakt'|'unterwegs'|false, neu, fehler }
//   neu = Übersetzung für die andere Seite (nur wenn sie nicht passt),
//   fehler = Wortfehler dieser Seite (leer, solange sie „unterwegs“ zu einer Übersetzung ist).
export async function liveUebersetzen(seite, text, gegen) {
  const r = await _frage({ art: 'live', seite, text: text || '', gegen: gegen || '' });
  if (r.fehler) { console.warn('[pruefen] Live-Übersetzung übersprungen:', r.fehler); return null; }
  // Steht die Eingabe im Wörterbuch (passt oder ist übersetzbar), ist sie ein Wort.
  const fehler = r.passt || r.neu ? [] : r.pruef.fehler.filter(f => f.grund !== 'leer');
  return { passt: r.passt, neu: r.neu, fehler };
}

// Sichtbare Namen (Spielername, Deck-Namen). → { ok, treffer }
export async function pruefeNamen(name) {
  const r = await _frage({ art: 'name', name: name || '' });
  if (r.fehler) { console.warn('[pruefen] Namensprüfung übersprungen:', r.fehler); return { ok: true, treffer: [] }; }
  return { ok: r.ok, treffer: r.treffer };
}

// ── Gemeinsame Texte und Abläufe für die Anlege-Screens ─────────────────────

const _SPRACHE = { de: 'deutsches', en: 'englisches' };
// Ein Satz zu einem gesperrten Wort (fehler aus pruefeSeite).
export function fehlerSatz(seite, f) {
  if (f.grund === 'zahl') return 'Zahlen gehören nicht in eine Vokabel.';
  if (f.grund === 'leer') return 'Bitte ein Wort eingeben.';
  return `„${f.wort}“ ist kein ${_SPRACHE[seite]} Wort.`;
}

// Prüft ein Vokabelpaar und übernimmt eindeutige Tippfehler-Korrekturen.
// → null (nicht prüfbar → durchlassen) oder
//   { ok, de, en, seiten: { de: {fehler, hinweise, korr, vorher}, en: … } }
export async function pruefeEintrag(de, en) {
  const r = await pruefePaar(de, en);
  if (!r) return null;
  const aus = { ok: true, de, en, seiten: {} };
  for (const s of ['de', 'en']) {
    const x = r[s], wert = s === 'de' ? de : en;
    const korr = x.korrekturen.filter(k => k.tippfehler);
    aus.seiten[s] = { fehler: x.fehler, hinweise: x.hinweise, korr, vorher: wert };
    if (!x.ok) aus.ok = false;
    else aus[s] = x.text;
  }
  return aus;
}

// Text für eine Fehlermeldung im Dialog (Bearbeiten, Hinzufügen).
export function eintragFehlerText(e) {
  const zeilen = [];
  for (const s of ['en', 'de']) for (const f of e.seiten[s].fehler) zeilen.push(fehlerSatz(s, f));
  return zeilen.join('\n');
}

// Prompt für einen Namen, den andere sehen (Spielername, Sammlung). Fragt erneut,
// solange ein Schimpfwort drinsteckt. → getrimmter Name oder null (abgebrochen/leer).
export async function namenPrompt(opts) {
  let wert = opts.value;
  for (;;) {
    const roh = await window.esPrompt({ ...opts, value: wert });
    const name = (roh || '').trim();
    if (!name) return null;
    if (await nameErlaubt(name)) return name;
    wert = name;
  }
}

export async function nameErlaubt(name) {
  const r = await pruefeNamen(name);
  if (r.ok) return true;
  await window.esAlert({ icon: '⚠️', title: 'Anderer Name, bitte',
    body: 'Dieser Name enthält ein Wort, das hier nicht erlaubt ist. Andere können ihn sehen – bitte wähle einen anderen.' });
  return false;
}
