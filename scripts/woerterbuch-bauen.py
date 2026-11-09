# Baut das Offline-Wörterbuch für die Live-Übersetzung (models/woerterbuch-v1/).
# Quelle: WikDict (https://www.wikdict.com, Daten aus Wiktionary über DBnary, CC BY-SA 4.0),
#   https://download.wikdict.com/dictionaries/sqlite/2/de-en.sqlite3 und en-de.sqlite3
# Aufruf: python -I scripts/woerterbuch-bauen.py <ordner-mit-sqlite> models/woerterbuch-v1
# Ausgabe je Richtung: eine Zeile pro Stichwort (klein geschrieben) TAB Übersetzungen mit |
# getrennt, beste zuerst: WikDict-Kurzliste der Richtung, dann übrige Bedeutungen derselben
# Richtung, zuletzt Paare, die nur die Gegenrichtung kennt.
import sqlite3, sys, re, os
src, out = sys.argv[1], sys.argv[2]
MAXV = 12
gut = re.compile(r"^[A-Za-zÄÖÜäöüßéèêàâçñ' .\-]+$")
def ok(w):
    return (0 < len(w) <= 40 and gut.match(w) and not w.startswith(('-', "'", '.'))
            and not w.endswith('-') and '  ' not in w)
karten = {'de': {}, 'en': {}}
def add(r, k, v, g, gleich=True):
    # gleich: gleich geschriebene Paare (Hotel/hotel) zulassen — nur aus der eigenen Richtung,
    # sonst rutschen Namen wie „Essen“ (Stadt) unter „essen“.
    k, v = k.strip(), v.strip()
    if not (ok(k) and ok(v)) or (not gleich and k.lower() == v.lower()): return
    d = karten[r].setdefault(k.lower(), {})
    if d.get(v, -1e9) < g: d[v] = g
for datei, r, gg in (('de-en.sqlite3', 'de', 'en'), ('en-de.sqlite3', 'en', 'de')):
    c = sqlite3.connect(os.path.join(src, datei))
    for wr, tl, rel in c.execute('select written_rep, trans_list, rel_importance from simple_translation'):
        for p, t in enumerate((tl or '').split(' | ')):
            add(r, wr, t, 2000 + (rel or 0) * 10 - p)
    for wr, tl, score, good, imp in c.execute('select written_rep, trans_list, score, is_good, importance from translation'):
        if not good or not tl: continue
        for p, t in enumerate(tl.split(' | ')):
            g = (imp or 0) * 10 + (score or 0) / 100 - p * 0.1
            add(r, wr, t, 1000 + g)
            add(gg, t, wr, g, False)
os.makedirs(out, exist_ok=True)
for r, name in (('de', 'de-en.txt'), ('en', 'en-de.txt')):
    with open(os.path.join(out, name), 'w', encoding='utf-8', newline='\n') as f:
        for k in sorted(karten[r]):
            vs, seen = [], set()
            for v, g in sorted(karten[r][k].items(), key=lambda x: -x[1]):
                if v.lower() in seen: continue
                seen.add(v.lower()); vs.append(v)
                if len(vs) >= MAXV: break
            f.write(k + '\t' + '|'.join(vs) + '\n')
    print(name, len(karten[r]), os.path.getsize(os.path.join(out, name)))
