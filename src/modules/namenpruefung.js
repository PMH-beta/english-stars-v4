// Schimpfwort-Prüfung für Namen, die andere sehen (Spielername, Deck-Namen). Ohne DOM — läuft im Worker.
//
// namenFilter(boese{en,de}, woerterbuch{en,de}, {erlaubt, haeufig, teilsicher}) → Filter
// pruefeName(name, filter) → { ok, treffer }
//
// Gegen das „Scunthorpe-Problem“ (Klasse, Cocktail, Butter …):
//  1. Jedes Wort einzeln: böses Wort ganz oder mit Endung (fucking, Wichsers, Arschlöcher) → gesperrt.
//  2. Steht das Wort im Wörterbuch → frei; außer es beginnt mit einem bösen Wort und der Rest ist ein
//     Wort (Arsch|bombe) — häufige Wörter (Cocktail, Assassin) und App-Vokabeln bleiben trotzdem frei.
//  3. Steht es nicht im Wörterbuch (MegaArschloch, xXfuckXx): in Wörterbuch-Teile zerlegen;
//     geht das sauber → frei, enthält ein Teil ein böses Wort → gesperrt, geht es gar nicht →
//     böse Wörter ab 4 Buchstaben als Teilstück suchen.
//  Wiederholte Buchstaben (Fiiiick, Buuutt) zählen wie einfache, aber „but“ ist nicht „butt“.
//
// Wörterbücher: alles mit has(), z. B. WortListe aus wortpruefung.js mit normName()-Einträgen (≥ 3 Buchstaben).

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '€': 'e' };
const ENDUNG = ['s', 'es', 'e', 'en', 'n', 'er', 'ern', 'in', 'innen', 'ing', 'ings', 'ed', 'y', 'ie', 'i', 'o', 'z'];

export function normName(s) {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}
const _knapp = s => s.replace(/(.)\1+/g, '$1');                 // Fiiiick → fick (nur zum Nachschlagen)
const _ohneUmlaut = s => s.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');

// w passt zu b, wenn w aus b durch Wiederholen von Buchstaben entsteht.
function _passt(b, w) {
  let i = 0, j = 0;
  while (i < b.length) {
    const c = b[i]; let nb = 0, nw = 0;
    while (b[i] === c) { i++; nb++; }
    while (w[j] === c) { j++; nw++; }
    if (nw < nb) return false;
  }
  return j === w.length;
}

function _woerter(name) {
  return name.split(/[\s_\-.,;:|/\\+*#'’"()[\]{}<>~^°&]+/).filter(Boolean).map(t => {
    if (/\p{L}/u.test(t)) t = t.replace(/[0134578@$!€]/g, c => LEET[c]);
    return normName(t);
  }).filter(Boolean);
}

export function namenFilter(boese, woerterbuch, { erlaubt = [], haeufig = null, teilsicher = null } = {}) {
  const boes = new Map(), phrasen = [], sprache = new Map();     // knapp → [norm]
  for (const [sp, liste] of Object.entries(boese)) for (const b of liste) {
    if (/\s/.test(b.trim())) { phrasen.push(b.trim().split(/\s+/).map(normName)); continue; }
    const n = normName(b);
    if (n.length < 3) continue;
    const k = _knapp(n);
    if (!sprache.has(n)) (boes.get(k) || boes.set(k, []).get(k)).push(n);
    sprache.set(n, sprache.has(n) && sprache.get(n) !== sp ? 'beide' : sp);
  }
  const wbL = woerterbuch;
  const wb = { has: w => Object.values(wbL).some(l => l.has(w)) };
  const f = { boes, phrasen, sprache, erl: new Set(erlaubt.map(normName)), hfg: haeufig || new Set(), wb, wbL,
    lang: [...boes.values()].flat().filter(n => n.length >= 4) };
  if (teilsicher) { f.teilsicher = new Set(teilsicher); return f; }
  // „teilstück-sicher“: steckt in keinem sauberen Wort mitten drin oder am Ende (Kanal → anal nicht sicher).
  // Dauert einige Sekunden — die App bekommt die Liste vorab berechnet (scripts/wortlisten-bauen.mjs).
  const unsicher = new Set();
  for (const liste of Object.values(wbL)) for (const w of liste) {
    if (w.length < 5 || _ganz(f, w)) continue;
    for (const b of f.lang) if (!unsicher.has(b) && w.indexOf(b, 1) > 0) unsicher.add(b);
  }
  f.teilsicher = new Set(f.lang.filter(b => !unsicher.has(b)));
  return f;
}

function _ganz(f, w) {                           // böses Wort ganz oder mit Endung
  for (const v of new Set([w, _ohneUmlaut(w)])) {
    for (const e of ['', ...ENDUNG]) {
      if (e && !v.endsWith(e)) continue;
      const s = v.slice(0, v.length - e.length);
      if (s.length < 3) continue;
      const kand = f.boes.get(_knapp(s));
      if (kand) for (const b of kand) if (_passt(b, s) && !_fremdHarmlos(f, w, b)) return b;
    }
  }
  return null;
}
// „dick“, „Asse“, „Rosette“: in der ANDEREN Sprache ein normales Wort → harmlos.
// Nur diese wenigen; die Listen überschneiden sich sonst mit Lehnwörtern (Shit, Bullshit … stehen im Duden-Bestand).
const HARMLOS_FREMD = new Set(['dick', 'ass', 'butt', 'rosette', 'mufti']);
function _fremdHarmlos(f, w, b) {
  const sp = f.sprache.get(b);
  if (sp === 'beide' || !HARMLOS_FREMD.has(b)) return false;
  const andere = f.wbL[sp === 'en' ? 'de' : 'en'];
  return !!andere && (andere.has(w) || andere.has(_ohneUmlaut(w)));
}

// Zerlegung in Wörterbuch-Teile (≥ 3 Buchstaben, Fugen s/n/en/es/e/er), längster Kopf zuerst.
// → null | [[von, bis], …]
function _zerlege(f, w, ab = 0, tiefe = 0) {
  if (f.wb.has(w.slice(ab))) return [[ab, w.length]];
  if (tiefe > 3) return null;
  for (let i = w.length - 3; i >= ab + 3; i--) {
    const kopf = w.slice(ab, i);
    if (!f.wb.has(kopf) && !_ganz(f, kopf)) continue;
    for (const fuge of ['', 's', 'n', 'en', 'es', 'e', 'er']) {
      if (fuge && !w.startsWith(fuge, i)) continue;
      const r = _zerlege(f, w, i + fuge.length, tiefe + 1);
      if (r) return [[ab, i], ...r];
    }
  }
  return null;
}
const _sauber = (f, t) => f.erl.has(t) || ((f.hfg.has(t) || f.wb.has(t)) && !_ganz(f, t));
const _zerlegbar = (f, t) => t.length <= 2 || f.wb.has(t) || f.erl.has(t) || !!_zerlege(f, t) || ENDUNG.includes(t);

// Kommt b in w vor, ohne ganz in einem sauberen Teil zu liegen (Kanal|arbeiter, Butter|brot)?
function _teilstueck(f, w) {
  const z = _zerlege(f, w);
  for (const b of f.lang) {
    for (let i = w.indexOf(b); i >= 0; i = w.indexOf(b, i + 1)) {
      if (z && z.some(([v, bis]) => v <= i && i + b.length <= bis && _sauber(f, w.slice(v, bis)))) continue;  // Butter|brot
      const vor = w.slice(0, i), nach = w.slice(i + b.length);
      const alsTeil = _zerlegbar(f, vor) && (_zerlegbar(f, nach) || ['s', 'n', 'en', 'es', 'e', 'er'].some(x => nach.startsWith(x) && _zerlegbar(f, nach.slice(x.length))));
      if (alsTeil || f.teilsicher.has(b)) return b;     // Super|shit|Max, xXfuckXx
    }
  }
  return null;
}

function _wortTreffer(f, w) {
  if (f.erl.has(w) || f.erl.has(_ohneUmlaut(w))) return null;
  const g = _ganz(f, w); if (g) return g;
  if (f.wb.has(w)) {
    if (f.hfg.has(w)) return null;
    // Arsch|bombe, Fuck|head – außer es gibt einen längeren sauberen Anfang (Analogie|gesetze)
    for (const b of f.lang) {
      if (!w.startsWith(b) || w.length - b.length < 4) continue;
      const sp = f.sprache.get(b);
      if (sp !== 'beide' && !f.wbL[sp]?.has(w)) continue;      // Dick|kopf ist deutsch, „dick“ englisch
      const rest = w.slice(b.length);
      if (!f.wb.has(rest) && !_zerlege(f, rest)) continue;
      let laenger = false;
      for (let i = b.length + 1; i <= w.length - 3 && !laenger; i++) {
        const k = w.slice(0, i);
        if (_sauber(f, k) && (f.wb.has(w.slice(i)) || _zerlege(f, w.slice(i)))) laenger = true;
      }
      if (!laenger) return b;
    }
    return null;
  }
  const t = _teilstueck(f, w); if (t) return t;
  const k = _knapp(w);                       // Shiiiit, Aaaarsch in Zusammensetzungen
  if (k !== w) for (const b of f.teilsicher) { const kb = _knapp(b); if (kb.length >= 4 && k.includes(kb)) return b; }
  return null;
}

export function pruefeName(name, f) {
  const ws = _woerter(name);
  const treffer = new Set();
  for (const w of ws) { const t = _wortTreffer(f, w); if (t) treffer.add(t); }
  // auseinandergeschrieben: „f u c k“, „A.r.s.c.h“, „Ars ch“
  if (ws.length > 1 && ws.some(w => w.length <= 2)) {
    const z = ws.join('');
    const t = _wortTreffer(f, z);
    if (t) treffer.add(t);
  }
  for (const p of f.phrasen)
    for (let i = 0; i + p.length <= ws.length; i++) if (p.every((x, j) => _passt(x, ws[i + j]))) treffer.add(p.join(' '));
  return { ok: treffer.size === 0, treffer: [...treffer] };
}
