// Baut die Wortlisten für die Wortprüfung nach models/woerter-v1/.
// Die Quelllisten liegen NICHT im Repo; Pfade als Argumente:
//
//   node scripts/wortlisten-bauen.mjs <scowl-ordner> <enz-words> <ldnoobw-ordner> <scowl-Copyright> [<enz-COPYING>]
//
//   scowl-ordner: w35.txt, w50.txt, w60.txt (SCOWL-Größen 35/50/60, en_US + en_GB)
//   enz-words:    https://github.com/enz/german-wordlist (words, CC0)
//   ldnoobw:      en, de, LICENSE aus https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words (CC BY 4.0)
//
// Ausgabe (Inhalt ändert sich → neuen Ordnernamen nehmen, der Service Worker cacht models/ dauerhaft):
//   en.txt, de.txt   nach toLowerCase() sortiert, je Zeile: Zeichen(48 + gemeinsamer Anfang mit der Zeile davor) [+ Rang 0–2 bei en] + Rest
//   vorlagen.json    Wörter aus den Vorlagen-Sammlungen (bevorzugte Korrektur, bei Namen immer erlaubt)
//   namen.json       Schimpfwörter en/de + vorab berechnete „teilsicher“-Liste
//   LIZENZEN.txt
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WortListe } from '../src/modules/wortpruefung.js';
import { namenFilter, normName } from '../src/modules/namenpruefung.js';

const [scowl, enzWords, ldn, scowlCopy, enzCopy] = process.argv.slice(2);
if (!scowl || !enzWords || !ldn || !scowlCopy) { console.error('Aufruf: node scripts/wortlisten-bauen.mjs <scowl-ordner> <enz-words> <ldnoobw-ordner> <scowl-Copyright> [<enz-COPYING>]'); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUS = path.join(ROOT, 'models', 'woerter-v1');
fs.mkdirSync(AUS, { recursive: true });
const zeilen = p => fs.readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const nachKlein = (a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0; };

function packen(woerter, rangVon) {
  const sortiert = [...new Set(woerter)].sort(nachKlein);
  let vor = '', aus = '';
  for (const w of sortiert) {
    let p = 0;
    while (p < 75 && p < w.length && w[p] === vor[p]) p++;
    aus += String.fromCharCode(48 + p) + (rangVon ? rangVon(w) : '') + w.slice(p) + '\n';
    vor = w;
  }
  return { aus, n: sortiert.length };
}

// ── Englisch: SCOWL 60, Rang 0 = Größe 35, 1 = 50, 2 = 60 ──
const rang = new Map();
for (const [n, r] of [[60, 2], [50, 1], [35, 0]]) for (const w of zeilen(path.join(scowl, `w${n}.txt`))) rang.set(w, r);
const en = packen([...rang.keys()], w => rang.get(w));
fs.writeFileSync(path.join(AUS, 'en.txt'), en.aus);

// ── Deutsch: enz + Lautwörter, die fehlen ──
const deListe = [...zeilen(enzWords), 'psst', 'pst', 'Psst'];
const de = packen(deListe);
fs.writeFileSync(path.join(AUS, 'de.txt'), de.aus);

// ── Vorlagen-Wörter ──
const sql = fs.readFileSync(path.join(ROOT, 'backend', 'preset-categories-60.sql'), 'utf8');
const vorl = { en: new Set(), de: new Set() };
for (const m of sql.matchAll(/\{"de":"([^"]*)","en":"([^"]*)"\}/g))
  for (const [sp, t] of [['de', m[1]], ['en', m[2]]])
    for (const w of t.replace(/\([^)]*\)/g, ' ').split(/[^\p{L}'’]+/u)) if (w && !/['’]/.test(w)) vorl[sp].add(w);
fs.writeFileSync(path.join(AUS, 'vorlagen.json'), JSON.stringify({ en: [...vorl.en].sort(), de: [...vorl.de].sort() }));

// ── Namen: Schimpfwörter + teilsicher (dauert einige Sekunden) ──
const boese = { en: zeilen(path.join(ldn, 'en')), de: zeilen(path.join(ldn, 'de')) };
const norm = liste => WortListe.aus(liste.map(normName).filter(n => n.length >= 3));
const t0 = Date.now();
const f = namenFilter(boese, { en: norm([...rang.keys()]), de: norm(deListe) }, { erlaubt: [...vorl.en, ...vorl.de] });
fs.writeFileSync(path.join(AUS, 'namen.json'), JSON.stringify({ en: boese.en, de: boese.de, teilsicher: [...f.teilsicher].sort() }));

// ── Lizenzen ──
const ldnLizenz = fs.readFileSync(path.join(ldn, 'LICENSE'), 'utf8');
fs.writeFileSync(path.join(AUS, 'LIZENZEN.txt'), [
  'Wortlisten in diesem Ordner',
  '===========================',
  '',
  'en.txt — aus SCOWL (Spell Checker Oriented Word Lists), Größen 35/50/60, http://wordlist.aspell.net/',
  'Umgepackt (sortiert, Präfix-kodiert, Häufigkeitsstufe ergänzt). Original-Hinweis:',
  '',
  fs.readFileSync(scowlCopy, 'utf8').trim(),
  '',
  '---------------------------------------------------------------------------',
  'de.txt — aus „german-wordlist“ von enz, https://github.com/enz/german-wordlist',
  'Lizenz: CC0 1.0 Universal (gemeinfrei). Ergänzt um: psst, pst.',
  enzCopy ? '\n' + fs.readFileSync(enzCopy, 'utf8').trim() : '',
  '',
  '---------------------------------------------------------------------------',
  'namen.json — Schimpfwort-Listen (en, de) aus „List of Dirty, Naughty, Obscene, and Otherwise Bad Words“',
  'von Shutterstock, https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words',
  'Lizenz: Creative Commons Namensnennung 4.0 International (CC BY 4.0). Unverändert übernommen;',
  'ergänzt um eine daraus berechnete Liste „teilsicher“.',
  '',
  ldnLizenz.trim(),
  '',
].join('\n'));

console.log(`en ${en.n} Wörter, ${en.aus.length} Zeichen · de ${de.n} Wörter, ${de.aus.length} Zeichen · Vorlagen ${vorl.en.size}/${vorl.de.size} · teilsicher ${f.teilsicher.size} (${Date.now() - t0} ms)`);
