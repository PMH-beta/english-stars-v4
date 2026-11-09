// Wortprüfung für neue Vokabeln: Ist das ein echtes englisches bzw. deutsches Wort?
// Tippfehler werden vorsichtig korrigiert, sonst gibt es Vorschläge zum Antippen.
// Ohne DOM — läuft im Worker (wortpruefung-worker.js) und in Node (Tests).
//
// pruefeSeite(text, lex, opt) → { ok, text, korrekturen:[{von, zu, tippfehler}],
//                                 hinweise:[{wort, vorschlaege}], fehler:[{wort, vorschlaege, grund}] }

// Kurze Wörter (1–2 Buchstaben) zählen nur, wenn sie hier stehen; sie werden nie „erraten“.
export const EN_KURZ = 'sh a i am an as at be by do go he hi if in is it me my no of oh ok on or so to up us we ox ah ha tv mr ms dr pc uk'.split(' ');
export const EN_ABK = ['etc.', 'e.g.', 'i.e.', 'sb', 'sth', 'sb.', 'sth.', 'mr.', 'mrs.', 'ms.', 'dr.', 'st.', 'a.m.', 'p.m.'];
export const DE_KURZ = 'ab am an da du ei er es im in ja je ob oh so um wo zu na ah äh hm nö öl aß uhr'.split(' ');
export const DE_ABK = ['z.b.', 'usw.', 'etw.', 'jdn.', 'jdm.', 'jds.', 'bzw.', 'd.h.', 'ca.', 'nr.', 'etw', 'jdn', 'jdm', 'jds', 'usw', 'bzw'];
// Einstellungen wie im Test (lauf4): vorsichtig korrigieren, DE-Komposita zerlegen.
export const OPT_EN = { autoMax: 1 };
export const OPT_DE = { autoMax: 1, zerlegen: true };

// Abkürzungen in Großbuchstaben (AAA, LOL, ABTA) sind keine Vokabeln – bis auf diese:
const GROSS_OK = new Set(['USA', 'UK', 'TV', 'OK', 'CD', 'DVD', 'ABC', 'UFO', 'DJ', 'PC', 'SMS', 'WC', 'LKW', 'PKW', 'EU', 'ICE']);

// Kompakte, sortierte Wortliste: alle Einträge in einem langen String, Suche per Halbierung.
// 700 000 deutsche Wörter brauchen so ~15 MB statt ~230 MB als Map/Set.
export class WortListe {
  // sortiert: eindeutige Strings in Standard-Sortierung (wie Array.prototype.sort())
  constructor(sortiert) {
    this.n = sortiert.length;
    this.start = new Int32Array(this.n + 1);
    let p = 0;
    for (let i = 0; i < this.n; i++) { this.start[i] = p; p += sortiert[i].length + 1; }
    this.start[this.n] = p;
    this.text = sortiert.join('\n') + '\n';
  }
  static aus(woerter) { return new WortListe([...new Set(woerter)].sort()); }
  wort(i) { return this.text.slice(this.start[i], this.start[i + 1] - 1); }
  index(w) {
    let lo = 0, hi = this.n - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1, x = this.wort(m);
      if (x === w) return m;
      if (x < w) lo = m + 1; else hi = m - 1;
    }
    return -1;
  }
  has(w) { return this.index(w) >= 0; }
  *[Symbol.iterator]() { for (let i = 0; i < this.n; i++) yield this.wort(i); }
}

// woerter: Schreibweisen aus der Liste (Hund, hund, TV …), am besten schon nach
// toLowerCase() sortiert (die mitgelieferten Dateien sind es). rang: Map klein → 0..3.
export function lexikon(woerter, { rang = null, kurz = [], abk = [], grenzen = null, rangStrafe = [0, 0.2, 0.4, 0.5], namenStrafe = false, bevorzugt = [] } = {}) {
  let liste = woerter.filter(w => w && !(w.length >= 2 && w === w.toUpperCase() && w !== w.toLowerCase() && !GROSS_OK.has(w)));
  for (let i = 1; i < liste.length; i++) {
    if (liste[i].toLowerCase() < liste[i - 1].toLowerCase()) {
      liste = liste.map(w => [w.toLowerCase(), w]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(x => x[1]);
      break;
    }
  }
  // art je Wort: 1 = klein in der Liste, 2 = mit großem Anfangsbuchstaben; alles andere in „extra“.
  const keys = [], art = [], extra = new Map();
  let prev = null;
  for (const w of liste) {
    const k = w.toLowerCase();
    if (k !== prev) { keys.push(k); art.push(0); prev = k; }
    const i = keys.length - 1;
    if (w === k) art[i] |= 1;
    else if (w.slice(1) === k.slice(1) && w[0] === k[0].toUpperCase()) art[i] |= 2;
    else (extra.get(k) || extra.set(k, []).get(k)).push(w);
  }
  const lw = new WortListe(keys);
  const topf = new Map();            // Länge + erster Buchstabe → Indizes
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], t = k.length + k[0];
    (topf.get(t) || topf.set(t, []).get(t)).push(i);
  }
  for (const [t, a] of topf) topf.set(t, Int32Array.from(a));
  let rangA = null;
  if (rang) { rangA = new Uint8Array(keys.length); for (let i = 0; i < keys.length; i++) rangA[i] = rang.get(keys[i]) ?? 3; }
  return { liste: lw, art: Uint8Array.from(art), extra, topf, rangA, rangStrafe, namenStrafe,
    bevorzugt: new Set(bevorzugt.map(x => x.toLowerCase())), kurz: new Set(kurz.map(x => x.toLowerCase())), abk: new Set(abk.map(a => a.toLowerCase())),
    grenzen: grenzen || [0, 0, 0, 0.5, 1.25, 1.25, 1.5, 2, 2, 2.5] };
}

const _hat = (lex, k) => lex.liste.has(k);
function _formen(lex, k) {
  const i = lex.liste.index(k);
  if (i < 0) return null;
  const f = [];
  if (lex.art[i] & 1) f.push(k);
  if (lex.art[i] & 2) f.push(k[0].toUpperCase() + k.slice(1));
  return lex.extra.has(k) ? f.concat(lex.extra.get(k)) : f;
}

// Ist w (bis auf Groß-/Kleinschreibung) ein Wort? → richtige Schreibweise oder null.
function _schreibweise(lex, w) {
  const k = w.toLowerCase();
  if (k.length <= 2 && !lex.kurz.has(k)) return null;   // „aa“, „bb“, „xu“ … nicht
  const f = _formen(lex, k);
  if (!f) return null;
  if (f.includes(w)) return w;
  if (f.includes(k)) return w[0] !== k[0] && w.slice(1) === k.slice(1) ? w : k;  // „Dog“ (Satzanfang) ok
  return f.find(x => x[0] === x[0].toUpperCase()) || f[0];   // london → London, hund → Hund, tv → TV
}

// ── Gewichteter Abstand ──
const NACHBAR = (() => {
  const n = new Set();
  for (const r of ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm', 'qwertyuiop', 'zxcvbnm'])
    for (let i = 0; i + 1 < r.length; i++) { n.add(r[i] + r[i + 1]); n.add(r[i + 1] + r[i]); }
  return n;
})();
const AEHNLICH = new Set(['sß', 'ck', 'cs', 'sz', 'vw', 'vf', 'iy', 'ie', 'ae', 'aä', 'oö', 'uü', 'ou', 'dt', 'bp', 'gk', 'jy', 'mn', 'ao', 'ei', 'au', 'eä']
  .flatMap(p => [p, p[1] + p[0]]));
export function ersetzKosten(a, b) {
  if (a === b) return 0;
  if (AEHNLICH.has(a + b)) return 0.5;
  if (NACHBAR.has(a + b)) return 0.75;
  return 1.25;                        // beliebiger anderer Buchstabe: seltener als vergessen/vertauscht
}

// Buchstaben, die Kinder oft vergessen oder zu viel schreiben: Doppelbuchstabe, h (Dehnungs-h, sch, wh, th),
// e in „ie“, c in „sch“/„ck“.
function _billig(s, i) {
  const c = s[i];
  if (i > 0 && s[i - 1] === c) return true;
  if (c === 'h') return true;
  if (c === 'e' && s[i - 1] === 'i') return true;
  if (c === 'c' && (s[i + 1] === 'h' || s[i + 1] === 'k')) return true;
  return false;
}

export function abstand(a, b, grenze = Infinity) {
  const n = a.length, m = b.length;
  let p2 = null, p1 = Array.from({ length: m + 1 }, (_, j) => j), vorMin = 0;
  for (let j = 1; j <= m; j++) p1[j] = p1[j - 1] + (_billig(b, j - 1) ? 0.5 : 1);
  for (let i = 1; i <= n; i++) {
    const c = new Array(m + 1);
    c[0] = p1[0] + (_billig(a, i - 1) ? 0.5 : 1);
    let min = c[0];
    for (let j = 1; j <= m; j++) {
      const ca = a[i - 1], cb = b[j - 1];
      const weg = _billig(a, i - 1) ? 0.5 : 1;     // Buchstabe zu viel (happpy, Fahhrad, Schuhle)
      const dazu = _billig(b, j - 1) ? 0.5 : 1;    // Buchstabe vergessen (hapy, scool, Fahrad, Shule, Spil)
      let d = Math.min(p1[j] + weg, c[j - 1] + dazu, p1[j - 1] + ersetzKosten(ca, cb));
      if (p2 && j > 1 && ca === b[j - 2] && a[i - 2] === cb && ca !== cb) d = Math.min(d, p2[j - 2] + 0.5); // vertauscht
      c[j] = d;
      if (d < min) min = d;
    }
    // Abbruch erst, wenn auch die Zeile davor drüber liegt (Vertauschen greift zwei Zeilen zurück).
    if (min > grenze && vorMin > grenze) return Infinity;
    vorMin = min;
    p2 = p1; p1 = c;
  }
  return p1[m];
}

function _idx(c) {                    // Zeichencode → Fach 0..30
  if (c >= 97 && c <= 122) return c - 97;
  return c === 228 ? 26 : c === 246 ? 27 : c === 252 ? 28 : c === 223 ? 29 : 30;
}

export function grenze(lex, len) { return lex.grenzen[Math.min(len, lex.grenzen.length - 1)]; }

// Kandidaten in der Nähe. Erster Buchstabe: gleich, ähnlich (c/k, v/w …) oder mit dem zweiten vertauscht/verrutscht.
export function _nahe(lex, k) {
  const g = grenze(lex, k.length);
  if (!g) return [];
  const erste = new Set([k[0], k[1]]);
  for (const p of AEHNLICH) if (p[0] === k[0]) erste.add(p[1]);
  const kand = [];
  // Schnellfilter: Buchstaben-Unterschied (jede Änderung kostet mind. 0,5 → höchstens 2·g Buchstaben anders).
  const zahl = new Int16Array(32);
  for (let i = 0; i < k.length; i++) zahl[_idx(k.charCodeAt(i))]++;
  const bagMax = 2 * g;
  const { text, start } = lex.liste;
  for (let L = k.length - 2; L <= k.length + 2; L++) {
    if (L < 1) continue;
    for (const e of erste) {
      const fach = lex.topf.get(L + e);
      if (!fach) continue;
      for (const i of fach) {
        const a = start[i];
        if (L <= 2 && !lex.kurz.has(text.slice(a, a + L))) continue;
        let zuviel = 0;
        for (let j = 0; j < L; j++) if (--zahl[_idx(text.charCodeAt(a + j))] < 0) zuviel++;
        for (let j = 0; j < L; j++) zahl[_idx(text.charCodeAt(a + j))]++;
        const zuwenig = k.length - (L - zuviel);
        if (Math.max(zuviel, zuwenig) > bagMax) continue;
        const w = text.slice(a, a + L);
        let d = abstand(k, w, g);
        const anders = w[0] !== k[0] && ersetzKosten(w[0], k[0]) > 0.5;
        if (anders) d += 0.25;                            // Anfang meist richtig
        if (d > g) continue;
        const r = lex.rangA ? lex.rangA[i] : 0;
        let s = d + (lex.bevorzugt.has(w) ? -0.25 : lex.rangStrafe[r]);
        if (lex.namenStrafe && r >= 2 && !(lex.art[i] & 1)) s += 0.5;   // nur als Name/Abkürzung in der Liste
        kand.push({ w, d, s, anders });
      }
    }
  }
  kand.sort((a, b) => a.s - b.s || a.d - b.d);
  return kand;
}

// Umschreibungen (ae → ä, ss → ß, Akzente) zuerst exakt versuchen.
function _umschreibungen(k) {
  const v = new Set();
  const r = k.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü');
  v.add(r); v.add(r.replace(/ss/g, 'ß')); v.add(k.replace(/ss/g, 'ß'));
  // Akzente (Teléfon, café) – Umlaute bleiben
  const ohne = k.replace(/[^äöüß]/g, c => c.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  if (ohne !== k) v.add(ohne);
  v.delete(k);
  return [...v];
}

// Zusammengesetzt aus echten Teilen (je ≥ 3 Buchstaben), Fugen -s-, -n-, -en-, -es-, -e-, -er- erlaubt.
function _zerlege(lex, k, tiefe = 0) {
  if (tiefe > 3 || k.length < 6) return null;
  for (let i = k.length - 3; i >= 3; i--) {
    const kopf = k.slice(0, i), rest = k.slice(i);
    if (!(_hat(lex, rest) || _zerlege(lex, rest, tiefe + 1))) continue;
    if (_hat(lex, kopf)) return [kopf, rest];
    for (const f of ['s', 'n', 'en', 'es', 'e', 'er'])
      if (kopf.endsWith(f) && kopf.length - f.length >= 3 && _hat(lex, kopf.slice(0, -f.length))) return [kopf, rest];
  }
  return null;
}

function _anpassen(eingabe, wort) {
  if (wort !== wort.toLowerCase()) return wort;
  const g = eingabe[0];
  return g === g.toUpperCase() && g !== g.toLowerCase() ? wort[0].toUpperCase() + wort.slice(1) : wort;
}

// Ein Wort ohne Satzzeichen. → { ok, zu, korrigiert, hinweis? } | { ok:false, vorschlaege, grund }
export function pruefeWort(w, lex, opt = {}) {
  if (/\d/.test(w)) return { ok: false, vorschlaege: [], grund: 'zahl' };
  const k = w.toLowerCase();
  if (lex.abk.has(k)) return { ok: true, zu: w };
  const s = _schreibweise(lex, w);
  if (s) return { ok: true, zu: s, korrigiert: false };
  for (const u of _umschreibungen(k)) { const s2 = _schreibweise(lex, u); if (s2) return { ok: true, zu: _anpassen(w, s2), korrigiert: true }; }
  if (w.includes('-') && w.length > 3 && _schreibweise(lex, w.replace(/-/g, ''))) return { ok: true, zu: w, korrigiert: false };
  if (w.includes('-')) {
    // einzelner Buchstabe vorn ist ok: T-shirt, U-Bahn, X-ray, e-mail
    const teile = w.split('-').filter(Boolean).map((t, i) => i === 0 && /^\p{L}$/u.test(t) ? { ok: true, zu: t } : pruefeWort(t, lex, opt));
    if (teile.length > 1 && teile.every(t => t.ok)) {
      const zu = teile.map(t => t.zu).join('-');
      return { ok: true, zu, korrigiert: teile.some(t => t.korrigiert) };
    }
  }
  const ap = /^(.+?)(?:'s|s'|')$/.exec(w.replace(/[’`´]/g, "'"));
  if (ap) { const t = pruefeWort(ap[1], lex, opt); if (t.ok && !t.korrigiert) return { ok: true, zu: w, korrigiert: false }; }
  const nah = _nahe(lex, k);
  if (opt.zerlegen && _zerlege(lex, k)) {
    // Fahrad = „fah|rad“ zerlegbar, aber Fahrrad liegt nur einen vergessenen Doppelbuchstaben weg → korrigieren.
    const a = nah[0], b = nah[1];
    if (a && !a.anders && a.d <= 0.5 && (!b || b.s - a.s >= 0.5)) return { ok: true, zu: _anpassen(w, _schreibweise(lex, a.w) || a.w), korrigiert: true };
    // mehrere nahe Wörter: durchlassen, aber leise fragen („Meintest du Fahrrad?“)
    const hinweis = nah.filter(x => !x.anders && x.d <= (k.length >= 8 ? 1 : 0.5)).slice(0, 3).map(x => _anpassen(w, _schreibweise(lex, x.w) || x.w));
    return hinweis.length ? { ok: true, zu: w, korrigiert: false, hinweis } : { ok: true, zu: w, korrigiert: false };
  }
  if (!nah.length) return { ok: false, vorschlaege: [], grund: 'unbekannt' };
  const fall = x => _anpassen(w, _schreibweise(lex, x) || x);
  const [a, b] = nah;
  // Automatisch nur, wenn klar vorn, der Fehler klein und der Anfang stimmt; sonst antippen lassen.
  if (!a.anders && a.d <= (opt.autoMax ?? Infinity) && (!b || b.s - a.s >= (opt.abstandEindeutig ?? 0.5))) return { ok: true, zu: fall(a.w), korrigiert: true };
  const vs = [...new Set(nah.filter(x => x.s - a.s < 0.75).map(x => fall(x.w)))].slice(0, 3);
  return { ok: false, vorschlaege: vs, grund: 'mehrdeutig' };
}

// Ganze Seite, z. B. „to hurry up“, „Freundin (feste)“, „etw. aufheben“.
export function pruefeSeite(text, lex, opt = {}) {
  const roh = (text || '').trim();
  const korrekturen = [], hinweise = [], fehler = [];
  let n = 0;
  const teile = roh.split(/([^\p{L}'’\-.]+)/u);
  const aus = teile.map((t, i) => {
    if (i % 2 || !t) return t;
    const [, vor, kern0, nach] = /^([\-'’.]*)(.*?)([\-'’.]*)$/u.exec(t);
    if (!kern0) return t;
    n++;
    if (lex.abk.has((kern0 + nach).toLowerCase()) || lex.abk.has(kern0.toLowerCase() + '.')) return t;
    if (kern0.includes('.')) { fehler.push({ wort: kern0, vorschlaege: [], grund: 'unbekannt' }); return t; }
    const r = pruefeWort(kern0, lex, opt);
    if (r.ok) {
      if (r.zu !== kern0) korrekturen.push({ von: kern0, zu: r.zu, tippfehler: !!r.korrigiert });
      if (r.hinweis) hinweise.push({ wort: kern0, vorschlaege: r.hinweis });
      return vor + r.zu + nach;
    }
    fehler.push({ wort: kern0, vorschlaege: r.vorschlaege || [], grund: r.grund });
    return t;
  });
  if (/\d/.test(roh) && !fehler.some(f => f.grund === 'zahl')) fehler.push({ wort: roh.match(/\d+/)[0], vorschlaege: [], grund: 'zahl' });
  if (!n && !fehler.length) fehler.push({ wort: roh, vorschlaege: [], grund: 'leer' });
  return { ok: !fehler.length, text: aus.join(''), korrekturen, hinweise, fehler };
}
