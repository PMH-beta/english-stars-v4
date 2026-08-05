-- backend/preset-categories-60.sql
-- 29 neue Vorlagen-Sammlungen (31 vorhanden -> 60 gesamt) + Umbau der zwei alten
-- Satz-Sammlungen auf Woerter.
--
-- AUSFUEHREN: komplette Datei markieren, in den Supabase-SQL-Editor pasten, Run.
-- Das ist EIN Durchlauf; die letzte Anweisung gibt die Kontrollzahlen aus.
-- Mehrfaches Ausfuehren ist unschaedlich (ON CONFLICT (slug) DO NOTHING, die
-- UPDATEs schreiben immer denselben Stand).
--
-- sort_order sitzt bewusst ZWISCHEN den bestehenden Zehnerschritten (15, 25, 45 …),
-- damit die neuen Sammlungen im Vokabeln-Tab thematisch neben den passenden alten
-- stehen und die Bloecke leicht/mittel/schwer zusammenbleiben.
--
-- Verteilung danach: leicht 20 · mittel 24 · schwer 16.

INSERT INTO preset_categories (name, slug, sort_order, difficulty, words) VALUES

-- ── LEICHT ───────────────────────────────────────────────────────────────────
('Auf dem Bauernhof', 'bauernhof', 15, 'leicht', '[
  {"de":"Bauernhof","en":"farm"},
  {"de":"Bauer","en":"farmer"},
  {"de":"Traktor","en":"tractor"},
  {"de":"Scheune","en":"barn"},
  {"de":"Feld","en":"field"},
  {"de":"Heu","en":"hay"},
  {"de":"Henne","en":"hen"},
  {"de":"Ziege","en":"goat"},
  {"de":"Gans","en":"goose"},
  {"de":"Esel","en":"donkey"},
  {"de":"Zaun","en":"fence"}
]'::jsonb),

('Formen', 'formen', 25, 'leicht', '[
  {"de":"Kreis","en":"circle"},
  {"de":"Quadrat","en":"square"},
  {"de":"Dreieck","en":"triangle"},
  {"de":"Rechteck","en":"rectangle"},
  {"de":"Stern","en":"star"},
  {"de":"Herz","en":"heart"},
  {"de":"Linie","en":"line"},
  {"de":"Punkt","en":"dot"},
  {"de":"Oval","en":"oval"},
  {"de":"Würfel","en":"cube"}
]'::jsonb),

('Frühstück', 'fruehstueck', 45, 'leicht', '[
  {"de":"Brot","en":"bread"},
  {"de":"Brötchen","en":"roll"},
  {"de":"Marmelade","en":"jam"},
  {"de":"Butter","en":"butter"},
  {"de":"Ei","en":"egg"},
  {"de":"Müsli","en":"cereal"},
  {"de":"Honig","en":"honey"},
  {"de":"Käse","en":"cheese"},
  {"de":"Milch","en":"milk"},
  {"de":"Saft","en":"juice"},
  {"de":"Toast","en":"toast"}
]'::jsonb),

('Wo ist es? (in, auf, unter)', 'praepositionen', 55, 'leicht', '[
  {"de":"in","en":"in"},
  {"de":"auf","en":"on"},
  {"de":"unter","en":"under"},
  {"de":"neben","en":"next to"},
  {"de":"hinter","en":"behind"},
  {"de":"vor","en":"in front of"},
  {"de":"zwischen","en":"between"},
  {"de":"über","en":"above"},
  {"de":"hier","en":"here"},
  {"de":"dort","en":"there"},
  {"de":"links","en":"left"},
  {"de":"rechts","en":"right"}
]'::jsonb),

('Geburtstag & Feiern', 'geburtstag', 75, 'leicht', '[
  {"de":"Geburtstag","en":"birthday"},
  {"de":"Geschenk","en":"present"},
  {"de":"Kuchen","en":"cake"},
  {"de":"Kerze","en":"candle"},
  {"de":"Luftballon","en":"balloon"},
  {"de":"Party","en":"party"},
  {"de":"Karte","en":"card"},
  {"de":"Einladung","en":"invitation"},
  {"de":"Überraschung","en":"surprise"},
  {"de":"Gast","en":"guest"},
  {"de":"Wunsch","en":"wish"}
]'::jsonb),

('Musikinstrumente', 'musikinstrumente', 85, 'leicht', '[
  {"de":"Klavier","en":"piano"},
  {"de":"Gitarre","en":"guitar"},
  {"de":"Geige","en":"violin"},
  {"de":"Flöte","en":"flute"},
  {"de":"Trompete","en":"trumpet"},
  {"de":"Harfe","en":"harp"},
  {"de":"Blockflöte","en":"recorder"},
  {"de":"Klarinette","en":"clarinet"},
  {"de":"Schlagzeug","en":"drums"},
  {"de":"Musik","en":"music"}
]'::jsonb),

('Kleine Wörter (ich, du, er …)', 'kleine-woerter', 95, 'leicht', '[
  {"de":"ich","en":"I"},
  {"de":"du","en":"you"},
  {"de":"er","en":"he"},
  {"de":"sie","en":"she"},
  {"de":"es","en":"it"},
  {"de":"wir","en":"we"},
  {"de":"sie (mehrere)","en":"they"},
  {"de":"mein","en":"my"},
  {"de":"dein","en":"your"},
  {"de":"sein (von ihm)","en":"his"},
  {"de":"ihr (von ihr)","en":"her"},
  {"de":"unser","en":"our"}
]'::jsonb),

('Fragewörter', 'fragewoerter', 105, 'leicht', '[
  {"de":"was","en":"what"},
  {"de":"wer","en":"who"},
  {"de":"wo","en":"where"},
  {"de":"wann","en":"when"},
  {"de":"wie","en":"how"},
  {"de":"warum","en":"why"},
  {"de":"welcher","en":"which"},
  {"de":"wessen","en":"whose"},
  {"de":"wie viele","en":"how many"},
  {"de":"wie viel","en":"how much"}
]'::jsonb),

('Am Strand', 'am-strand', 115, 'leicht', '[
  {"de":"Strand","en":"beach"},
  {"de":"Sand","en":"sand"},
  {"de":"Meer","en":"sea"},
  {"de":"Welle","en":"wave"},
  {"de":"Muschel","en":"shell"},
  {"de":"Eimer","en":"bucket"},
  {"de":"Schaufel","en":"spade"},
  {"de":"Handtuch","en":"towel"},
  {"de":"Sonnenbrille","en":"sunglasses"},
  {"de":"Sandburg","en":"sandcastle"},
  {"de":"Badeanzug","en":"swimsuit"}
]'::jsonb),

-- ── MITTEL ───────────────────────────────────────────────────────────────────
('Küche & Geschirr', 'kueche-geschirr', 125, 'mittel', '[
  {"de":"Teller","en":"plate"},
  {"de":"Tasse","en":"cup"},
  {"de":"Glas","en":"glass"},
  {"de":"Schüssel","en":"bowl"},
  {"de":"Löffel","en":"spoon"},
  {"de":"Gabel","en":"fork"},
  {"de":"Messer","en":"knife"},
  {"de":"Topf","en":"pot"},
  {"de":"Pfanne","en":"pan"},
  {"de":"Flasche","en":"bottle"},
  {"de":"Kühlschrank","en":"fridge"},
  {"de":"Herd","en":"cooker"}
]'::jsonb),

('Computer & Handy', 'computer-handy', 145, 'mittel', '[
  {"de":"Computer","en":"computer"},
  {"de":"Handy","en":"mobile phone"},
  {"de":"Bildschirm","en":"screen"},
  {"de":"Tastatur","en":"keyboard"},
  {"de":"Computermaus","en":"computer mouse"},
  {"de":"Internet","en":"internet"},
  {"de":"Passwort","en":"password"},
  {"de":"Nachricht","en":"message"},
  {"de":"Video","en":"video"},
  {"de":"Kopfhörer","en":"headphones"},
  {"de":"Ladekabel","en":"charger"}
]'::jsonb),

('Wie spät ist es? (Uhrzeit)', 'uhrzeit', 165, 'mittel', '[
  {"de":"Uhr","en":"clock"},
  {"de":"Armbanduhr","en":"watch"},
  {"de":"Stunde","en":"hour"},
  {"de":"Minute","en":"minute"},
  {"de":"Wecker","en":"alarm clock"},
  {"de":"Mittag","en":"noon"},
  {"de":"Mitternacht","en":"midnight"},
  {"de":"halb (nach)","en":"half past"},
  {"de":"Viertel nach","en":"quarter past"},
  {"de":"Viertel vor","en":"quarter to"},
  {"de":"Zeit","en":"time"}
]'::jsonb),

('Tageszeiten & Zeitwörter', 'tageszeiten', 175, 'mittel', '[
  {"de":"Morgen","en":"morning"},
  {"de":"Nachmittag","en":"afternoon"},
  {"de":"Abend","en":"evening"},
  {"de":"Nacht","en":"night"},
  {"de":"heute","en":"today"},
  {"de":"morgen (der Tag danach)","en":"tomorrow"},
  {"de":"gestern","en":"yesterday"},
  {"de":"jetzt","en":"now"},
  {"de":"früh","en":"early"},
  {"de":"spät","en":"late"},
  {"de":"immer","en":"always"},
  {"de":"nie","en":"never"}
]'::jsonb),

('Im Supermarkt', 'supermarkt', 185, 'mittel', '[
  {"de":"Supermarkt","en":"supermarket"},
  {"de":"Einkaufswagen","en":"trolley"},
  {"de":"Kasse","en":"checkout"},
  {"de":"Geld","en":"money"},
  {"de":"Preis","en":"price"},
  {"de":"Tüte","en":"bag"},
  {"de":"kaufen","en":"buy"},
  {"de":"bezahlen","en":"pay"},
  {"de":"billig","en":"cheap"},
  {"de":"teuer","en":"expensive"},
  {"de":"Einkaufsliste","en":"shopping list"}
]'::jsonb),

('Reisen & Urlaub', 'reisen', 195, 'mittel', '[
  {"de":"Urlaub","en":"holiday"},
  {"de":"Koffer","en":"suitcase"},
  {"de":"Fahrkarte","en":"ticket"},
  {"de":"Flughafen","en":"airport"},
  {"de":"Hotel","en":"hotel"},
  {"de":"Landkarte","en":"map"},
  {"de":"Reisepass","en":"passport"},
  {"de":"Reise","en":"journey"},
  {"de":"Bahnhof","en":"station"},
  {"de":"Gepäck","en":"luggage"},
  {"de":"Fotoapparat","en":"camera"},
  {"de":"Rucksack","en":"backpack"}
]'::jsonb),

('Im Wald', 'im-wald', 205, 'mittel', '[
  {"de":"Wald","en":"forest"},
  {"de":"Fuchs","en":"fox"},
  {"de":"Reh","en":"deer"},
  {"de":"Eule","en":"owl"},
  {"de":"Eichhörnchen","en":"squirrel"},
  {"de":"Igel","en":"hedgehog"},
  {"de":"Wolf","en":"wolf"},
  {"de":"Pilz","en":"mushroom"},
  {"de":"Ast","en":"branch"},
  {"de":"Tanne","en":"fir tree"},
  {"de":"Pfad","en":"path"}
]'::jsonb),

('Hobbys & Freizeit', 'hobbys', 215, 'mittel', '[
  {"de":"Hobby","en":"hobby"},
  {"de":"Verein","en":"club"},
  {"de":"Comic","en":"comic"},
  {"de":"Schach","en":"chess"},
  {"de":"sammeln","en":"collect"},
  {"de":"malen","en":"paint"},
  {"de":"basteln","en":"do crafts"},
  {"de":"Kino","en":"cinema"},
  {"de":"Camping","en":"camping"},
  {"de":"Skateboard","en":"skateboard"}
]'::jsonb),

('Krankheit & Arzt', 'krankheit', 225, 'mittel', '[
  {"de":"Arzt","en":"doctor"},
  {"de":"Krankenschwester","en":"nurse"},
  {"de":"krank","en":"ill"},
  {"de":"Fieber","en":"fever"},
  {"de":"Erkältung","en":"cold"},
  {"de":"Husten","en":"cough"},
  {"de":"Halsschmerzen","en":"sore throat"},
  {"de":"Bauchschmerzen","en":"stomach ache"},
  {"de":"Medizin","en":"medicine"},
  {"de":"Krankenhaus","en":"hospital"},
  {"de":"Pflaster","en":"plaster"}
]'::jsonb),

('Ordnungszahlen', 'ordnungszahlen', 235, 'mittel', '[
  {"de":"erster","en":"first"},
  {"de":"zweiter","en":"second"},
  {"de":"dritter","en":"third"},
  {"de":"vierter","en":"fourth"},
  {"de":"fünfter","en":"fifth"},
  {"de":"sechster","en":"sixth"},
  {"de":"siebter","en":"seventh"},
  {"de":"achter","en":"eighth"},
  {"de":"neunter","en":"ninth"},
  {"de":"zehnter","en":"tenth"}
]'::jsonb),

-- ── SCHWER ───────────────────────────────────────────────────────────────────
('Unregelmäßige Mehrzahl', 'mehrzahl', 265, 'schwer', '[
  {"de":"Kinder (Mehrzahl)","en":"children"},
  {"de":"Männer (Mehrzahl)","en":"men"},
  {"de":"Frauen (Mehrzahl)","en":"women"},
  {"de":"Füße (Mehrzahl)","en":"feet"},
  {"de":"Zähne (Mehrzahl)","en":"teeth"},
  {"de":"Mäuse (Mehrzahl)","en":"mice"},
  {"de":"Gänse (Mehrzahl)","en":"geese"},
  {"de":"Messer (Mehrzahl)","en":"knives"},
  {"de":"Blätter (Mehrzahl)","en":"leaves"},
  {"de":"Menschen, Leute","en":"people"}
]'::jsonb),

('Tiere im Meer', 'tiere-meer', 275, 'schwer', '[
  {"de":"Delfin","en":"dolphin"},
  {"de":"Wal","en":"whale"},
  {"de":"Hai","en":"shark"},
  {"de":"Krake","en":"octopus"},
  {"de":"Krebs","en":"crab"},
  {"de":"Qualle","en":"jellyfish"},
  {"de":"Robbe","en":"seal"},
  {"de":"Schildkröte","en":"turtle"},
  {"de":"Seestern","en":"starfish"},
  {"de":"Seepferdchen","en":"seahorse"},
  {"de":"Koralle","en":"coral"}
]'::jsonb),

('Rechnen & Mathe', 'rechnen', 285, 'schwer', '[
  {"de":"plus","en":"plus"},
  {"de":"minus","en":"minus"},
  {"de":"mal","en":"times"},
  {"de":"geteilt durch","en":"divided by"},
  {"de":"gleich","en":"equals"},
  {"de":"Zahl","en":"number"},
  {"de":"zählen","en":"count"},
  {"de":"rechnen","en":"calculate"},
  {"de":"Ergebnis","en":"result"},
  {"de":"Hälfte","en":"half"},
  {"de":"Rechenaufgabe","en":"sum"}
]'::jsonb),

('Charakter beschreiben', 'charakter', 295, 'schwer', '[
  {"de":"freundlich","en":"friendly"},
  {"de":"lustig","en":"funny"},
  {"de":"klug","en":"clever"},
  {"de":"mutig","en":"brave"},
  {"de":"schüchtern","en":"shy"},
  {"de":"nett","en":"kind"},
  {"de":"faul","en":"lazy"},
  {"de":"fleißig","en":"hard-working"},
  {"de":"ehrlich","en":"honest"},
  {"de":"höflich","en":"polite"},
  {"de":"ruhig","en":"quiet"}
]'::jsonb),

('Feste & Feiertage', 'feste', 305, 'schwer', '[
  {"de":"Weihnachten","en":"Christmas"},
  {"de":"Ostern","en":"Easter"},
  {"de":"Halloween","en":"Halloween"},
  {"de":"Silvester","en":"New Year''s Eve"},
  {"de":"Neujahr","en":"New Year"},
  {"de":"Fasching","en":"carnival"},
  {"de":"Feiertag","en":"public holiday"},
  {"de":"Feuerwerk","en":"fireworks"},
  {"de":"Weihnachtsbaum","en":"Christmas tree"},
  {"de":"Osterhase","en":"Easter bunny"}
]'::jsonb),

('Körperteile bei Tieren', 'tierkoerper', 315, 'schwer', '[
  {"de":"Schwanz","en":"tail"},
  {"de":"Flügel","en":"wing"},
  {"de":"Feder","en":"feather"},
  {"de":"Fell","en":"fur"},
  {"de":"Pfote","en":"paw"},
  {"de":"Kralle","en":"claw"},
  {"de":"Schnabel","en":"beak"},
  {"de":"Horn","en":"horn"},
  {"de":"Flosse","en":"fin"},
  {"de":"Schuppe","en":"scale"}
]'::jsonb),

('Wegbeschreibung', 'wegbeschreibung', 325, 'schwer', '[
  {"de":"geradeaus","en":"straight on"},
  {"de":"Ecke","en":"corner"},
  {"de":"Kreuzung","en":"crossroads"},
  {"de":"Ampel","en":"traffic lights"},
  {"de":"Zebrastreifen","en":"zebra crossing"},
  {"de":"Bürgersteig","en":"pavement"},
  {"de":"Brücke","en":"bridge"},
  {"de":"gegenüber","en":"opposite"},
  {"de":"Richtung","en":"direction"},
  {"de":"weit","en":"far"},
  {"de":"in der Nähe","en":"nearby"}
]'::jsonb),

('Naturgewalten', 'naturgewalten', 335, 'schwer', '[
  {"de":"Sturm","en":"storm"},
  {"de":"Gewitter","en":"thunderstorm"},
  {"de":"Blitz","en":"lightning"},
  {"de":"Donner","en":"thunder"},
  {"de":"Nebel","en":"fog"},
  {"de":"Hagel","en":"hail"},
  {"de":"Regenbogen","en":"rainbow"},
  {"de":"Überschwemmung","en":"flood"},
  {"de":"Erdbeben","en":"earthquake"},
  {"de":"Vulkan","en":"volcano"},
  {"de":"Wüste","en":"desert"}
]'::jsonb),

('Weltall', 'weltall', 345, 'schwer', '[
  {"de":"Weltall","en":"space"},
  {"de":"Planet","en":"planet"},
  {"de":"Erde","en":"earth"},
  {"de":"Mond","en":"moon"},
  {"de":"Rakete","en":"rocket"},
  {"de":"Astronaut","en":"astronaut"},
  {"de":"Satellit","en":"satellite"},
  {"de":"Teleskop","en":"telescope"},
  {"de":"Komet","en":"comet"},
  {"de":"Galaxie","en":"galaxy"},
  {"de":"Raumanzug","en":"space suit"}
]'::jsonb),

('Umwelt schützen', 'umwelt', 355, 'schwer', '[
  {"de":"Umwelt","en":"environment"},
  {"de":"Müll","en":"rubbish"},
  {"de":"recyceln","en":"recycle"},
  {"de":"Plastik","en":"plastic"},
  {"de":"Energie","en":"energy"},
  {"de":"Verschmutzung","en":"pollution"},
  {"de":"Klima","en":"climate"},
  {"de":"sparen","en":"save"},
  {"de":"Sonnenenergie","en":"solar power"},
  {"de":"Mülltonne","en":"rubbish bin"},
  {"de":"Papiertonne","en":"paper bin"}
]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Die zwei bestehenden Satz-Sammlungen auf Wörter umbauen.
-- Grund: im Buchstabensturm wird jedes Zeichen einzeln angetippt — ein ganzer Satz
-- sind ~15 Plättchen und ist unspielbar. „(Mini-Sätze)" faellt auch aus dem Namen.
-- ACHTUNG: Sammlungen, die bereits in einem Deck aktiviert sind, behalten dort ihre
-- alten Wörter (das Deck kopiert sie beim Aktivieren). Nur neue Aktivierungen
-- bekommen die neuen Wörter.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE preset_categories SET name = 'Begrüßungen & Höflichkeit', words = '[
  {"de":"hallo","en":"hello"},
  {"de":"tschüss","en":"goodbye"},
  {"de":"Guten Morgen","en":"good morning"},
  {"de":"Guten Abend","en":"good evening"},
  {"de":"Gute Nacht","en":"good night"},
  {"de":"bitte","en":"please"},
  {"de":"danke","en":"thank you"},
  {"de":"Entschuldigung","en":"sorry"},
  {"de":"willkommen","en":"welcome"},
  {"de":"ja","en":"yes"},
  {"de":"nein","en":"no"}
]'::jsonb WHERE slug = 'begruessungen';

UPDATE preset_categories SET name = 'Im Restaurant', words = '[
  {"de":"Restaurant","en":"restaurant"},
  {"de":"Kellner","en":"waiter"},
  {"de":"Speisekarte","en":"menu"},
  {"de":"Rechnung","en":"bill"},
  {"de":"Trinkgeld","en":"tip"},
  {"de":"Vorspeise","en":"starter"},
  {"de":"Hauptgericht","en":"main course"},
  {"de":"Nachtisch","en":"dessert"},
  {"de":"Getränk","en":"drink"},
  {"de":"bestellen","en":"order"},
  {"de":"Serviette","en":"napkin"}
]'::jsonb WHERE slug = 'restaurant';

-- ─────────────────────────────────────────────────────────────────────────────
-- Kontrolle — läuft automatisch als letzte Anweisung mit. Der SQL-Editor zeigt
-- dieses Ergebnis an; SOLL: 60 / 20 / 24 / 16 / 0.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM preset_categories)                                AS sammlungen_soll_60,
  (SELECT count(*) FROM preset_categories WHERE difficulty = 'leicht')    AS leicht_soll_20,
  (SELECT count(*) FROM preset_categories WHERE difficulty = 'mittel')    AS mittel_soll_24,
  (SELECT count(*) FROM preset_categories WHERE difficulty = 'schwer')    AS schwer_soll_16,
  (SELECT count(*) FROM preset_categories WHERE name ILIKE '%Mini-S%')    AS satz_sammlungen_soll_0;
