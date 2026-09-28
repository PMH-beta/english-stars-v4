# PROMPT · English Stars Pastell → Claude Code

Alles zum Kopieren. Die Dauerregeln stehen in `CLAUDE-REGELN.md`, die Details in `START-HERE.md`.

## So gehst du vor
1. Im Repo den Ordner `design_handoff_english_stars_pastell/` neben `src/` durch diese Fassung ersetzen.
2. Den Inhalt von `CLAUDE-REGELN.md` in die `CLAUDE.md` im Projektordner kopieren (anlegen, falls es keine gibt). Claude Code liest `CLAUDE.md` in jeder Sitzung. So gilt die Rückfrage-Pflicht auch in neuen Sitzungen.
3. Claude Code im **Plan-Modus** starten und **Prompt 1** schicken. Du bekommst einen Plan und nummerierte Fragen (F-01 …). Beantworte sie mit **Kurzbefehl A**.
4. Danach je Sitzung eine Phase mit **Prompt 2** und dem passenden **Zusatz**. Nach jeder Phase auf dem Handy prüfen, erst dann die nächste starten. Besonders genau nach Phase 0, 3, 4, 5 und 6.
5. Zwischendurch helfen die **Kurzbefehle** (Antworten geben, Screen abnehmen, Fehler melden, neue Sitzung, neuer Design-Stand).

Zum Vergleichen kannst du `English Stars UI Pastell.dc.html` im Browser öffnen (lädt ca. 10 s, `support.js` muss daneben liegen).

---

## Prompt 1 · Start und Plan (Plan-Modus, noch kein Code)

```text
Wir übernehmen das Pastell-Redesign von „English Stars“ in unsere App. Alle Unterlagen liegen in design_handoff_english_stars_pastell/ neben src/. In dieser Sitzung änderst du keine Datei und schreibst keinen Code. Du liest, vergleichst und planst.

Es gelten die Regeln aus CLAUDE.md (Inhalt von design_handoff_english_stars_pastell/CLAUDE-REGELN.md). Enthält CLAUDE.md sie noch nicht, sag es mir zuerst. Die wichtigste Regel: Vor jeder Funktionsänderung fragst du mich, auch wenn der Handoff sie vorsieht. Das Redesign ändert das Aussehen, nicht die Funktion.

Schritt 1 · Handoff lesen
Lies vollständig: START-HERE.md, CLAUDE-REGELN.md, README.md, SCREENS.md, DESIGN.md und tokens.json. Sieh dir die Exporte aller Module in app/ an (pixel-hero-fine.js, pixel-enemies-dungeon.js, pixel-world-fine.js, pixel-anim.js, ui-anim.js). Öffne aus screens/ mindestens ein Fragment je Bereich 1 bis 9, dazu 7.2 (Kampf-Animationen) und 9.7 (UI-Animationen). Die Platzhalter in den Fragmenten (data-paint, data-anim, data-ui, data-frames, data-tour-*) erklärt START-HERE.md.

Schritt 2 · Codebase untersuchen
Aufbau, Framework und Build, Einstieg, Screen-Wechsel bzw. Routing, Speicherstand (storage, sync), Avatar (avatar.js, avatarSVG), Gegner (pixel-enemies.js), Gegenstände (pixel-items.js, itemIconSVG), Kampf (campaign-fight.js, arena.js), Icons (iconHTML), Styles (style.css), Dialoge, Ton, Tests. Nenne mir die Dateien, die bei uns anders heißen oder die es nicht gibt.

Schritt 3 · Liefere mir
a) Bestandsaufnahme: kurze Übersicht der Codebase mit allen Dateien, die das Redesign betrifft.
b) Zuordnung: welches Modul oder Fragment welche Datei ersetzt oder ergänzt, was neu angelegt wird, was in Phase 8 wegfällt.
c) Screen-Abgleich: eine Tabelle über alle 106 Screens aus SCREENS.md mit den Spalten Nr. · Screen · gibt es heute? (ja / anders / nein) · Datei(en) · nur Aussehen oder auch Funktion?
d) Funktions-Abgleich: jede Stelle, an der das Design etwas anderes tut als unser Code heute, als FRAGE F-nn im Format aus CLAUDE-REGELN.md. Geh dafür mindestens die Prüfliste unten Punkt für Punkt durch. Wo heute schon alles genauso funktioniert, schreib nur „gleich wie heute“ und stell keine Frage.
e) Technische Fragen (Build, Abhängigkeiten, Tests, Speicherformat, Leistung auf älteren Handys), ebenfalls als F-nn.
f) Phasenplan 0 bis 8 (mit 7b App-Tour und 7c App-Icons) aus START-HERE.md, bezogen auf unsere Dateien: Reihenfolge, was jede Phase anfasst, Risiken, grober Aufwand und welche Fragen jede Phase blockieren.

Schritt 4 · Stopp
Dann hörst du auf und wartest auf meine Antworten. Danach legst du HANDOFF-ENTSCHEIDUNGEN.md (Antworten) und HANDOFF-PLAN.md (angepasster Plan) im Projektordner an. Erst dann beginnt Phase 0, in einer eigenen Sitzung.

Prüfliste: Hier ändert sich wahrscheinlich Funktion. Vergleiche jeden Punkt mit dem heutigen Code.
1. Figur und Speicherstand: neue Wertebereiche (Haut 16, Frisur 20, Haarfarbe 12, Augen 12, Augenfarbe 8, Mund 12, Oberteil 16, Hose 16, Kleidungsfarben 12, Statur 3, Gefährte 20 mit je 6 Farben) und die einmalige Migration mit avatarVersion: 2 (START-HERE, „Worauf Claude Code achten muss“, Punkt 1).
2. Erster Start 1.8 bis 1.10: Name, dann „Wer bist du?“ mit 7 Reitern, noch ohne Gefährte.
3. App-Tour 1.11 bis 1.15 und „App-Tour ansehen“ in 8.1: tourSeen, Demo-Stand, die Tour wechselt selbst die Tabs.
4. Taler je Sammlung in 2.3, 2.4 und 1.12: „0/3 Taler“, „+1 Taler“ je Übungsart.
5. 2.5: Sammlungen per langem Drücken verschieben. Wird die Reihenfolge gespeichert?
6. Probetest und Note (2.6, 2.7, 4.12, 4.14), Schnellmodus (2.10, 2.11, 4.5), Sammlung löschen (2.12).
7. Vokabeln verwalten 3.2 bis 3.7: Vorlagen, Text einfügen, Scan mit Kamera, 3.5 „kein Key nötig“, Prüfen nach dem Scan, Statistik der Sammlung.
8. Üben: Wiederholung der falschen Fragen (4.4), Aussprache mit Mikrofon und Selbstbewertung (4.7 bis 4.11), Rundenende (4.13).
9. Schmiede 5.1, 5.2, 5.12, 5.13: 5 Teile je Objekt, 15 Objekte je Stahl und Gold, 150 Schritte, Prozent = fertige Teile × 20, „Wörter befüllen“ und „Wörter anzeigen“, Info-Knopf mit den Werten der Waffe, kein „Werkstoff wählen“ und kein Löschen mehr.
10. Trainingsplatz 5.3 bis 5.11: Trainings-Decks, Statistik, die sechs Formen-Spiele.
11. Kampagne 6.2 bis 6.8: gesperrt und bereit, Kosten („zu wenig Taler“, „nächster Lauf kostenlos“), Schatz mit Trank, Rastplatz mit +15 Leben, Trank-Info, Schutz-Meldungen.
12. Kampf 7.4 bis 7.17: Buchstabensturm (mit Fehlgriff), Wort-Meteoriten, Echo-Fang, Richtig oder falsch?, Formen-Sturm, Formen-Meteoriten, Formen-Echo, Boss-Welle, Verlassen?, Gegner besiegt, Boss besiegt, Niederlage. Welche Modi und Zeitlimits gibt es heute?
13. Gegner: 36 Gegner, Auswahl über ENEMY_POOL. Wer wo auftaucht, ist Funktion.
14. Gefährte im Kampf: Das Design zeigt ihn neben dem Helden, er springt beim Angriff mit. Hat er heute eine Wirkung? Nichts dazuerfinden.
15. Profil 8.1 und Fortschritt 8.3: Ausrüstung anlegen und ablegen, Werte der Figur mit Ausrüstung verrechnet und die Veränderung sichtbar.
16. 8.2: Fortschritt eines Freundes ohne Wörter. Was überträgt der Server heute?
17. Charakter bearbeiten 8.4 bis 8.10 und 8.12: Speichern oben, Zurück verwirft, Rückfrage beim Verlassen ohne Speichern, Gefährte erst nach der Schmiede-Station „Gefährte“ (8.10 mit „Zur Schmiede“).
18. Überall 9.2 bis 9.6: App installieren (3. Start), Toast, Speichern-Hinweis, Musik und Lautstärke, Ziehen zum Neuladen.
19. 9.7: Soll der Mikrofon-Pegel an die echte Lautstärke gekoppelt werden?
20. appicon/: wo und wie App-Icons und Startbilder eingebunden werden (Manifest, iOS, Android, Favicon).
```

---

## Prompt 2 · Eine Phase umsetzen (je Sitzung)
Ersetze `[N]` durch die Phase und hänge den passenden Zusatz von unten an.

```text
Setze Phase [N] aus design_handoff_english_stars_pastell/START-HERE.md um.

Lies vorher: CLAUDE.md, HANDOFF-ENTSCHEIDUNGEN.md, HANDOFF-PLAN.md, die Zeile zu Phase [N] in der Phasen-Tabelle und alle Abschnitte in START-HERE.md, die dazugehören (z. B. „Neu in diesem Stand“, „Worauf Claude Code achten muss“, „Schmiede · 5 Teile“, „Charakter-Editor“, „App-Tour“, „Platzhalter“ und die Nachträge).

So arbeitest du:
- Nur diese Phase. Nichts aus späteren Phasen vorziehen.
- Grafik, Animation, Texte und Abstände genau aus den Modulen und Fragmenten. Nichts erfinden, keine Pixeldaten ändern, Module nicht umformatieren.
- Das Neue hinter den Schalter pastell. Der alte Stand bleibt lauffähig.
- Triffst du auf eine Funktionsänderung, die in HANDOFF-ENTSCHEIDUNGEN.md noch nicht entschieden ist: sofort anhalten und im Format F-nn fragen. Unabhängige Teile darfst du weiterbauen, sag mir welche.
- Keine eigenen Verbesserungen. Ideen schreibst du als Liste ans Ende deines Berichts.
- Nach jedem Bereich committen. Am Ende Build und vorhandene Tests laufen lassen.
- Zum Schluss der Abschlussbericht aus CLAUDE-REGELN.md: fertig · wo und wie prüfen · Abweichungen · offene Fragen · nächste Phase. Dann stopp.

Zusatz für Phase [N]:
```

### Zusatz je Phase

**Phase 0 · Prüfblatt**
```text
Leg dev/sprites.html an, nicht als Teil der App-Oberfläche. Zeig alles aus der Phasen-Tabelle auf einer Seite: alle 36 Gegner vorn und in Kampfrichtung, 10 Vorlagen, 20 Frisuren, 20 Gefährten (auch als Silhouette), 8 Waffen in der Hand, alle Gegenstände in Stahl und Gold, 6 Kampfplätze, Lagerfeuer, alle sechs Abläufe (Stehen, Angriff, Treffer, Sieg, Niederlage, K.O.) für Held, alle Gegner und alle Gefährten, den Bogen-Angriff in Schleife. Frag mich, wie die Seite erreichbar sein soll (nur lokal oder im Build).
```

**Phase 1 · Grundbausteine**
```text
Nur die --p-*-Tokens in style.css und die Bausteine aus README.md: 2-px-Rahmen, Blatt, Karten, Chips, Buttons, Tab-Leiste. Noch keinen Screen umbauen außer einem Beispiel zum Prüfen.
```

**Phase 2 · Pixel-Icons**
```text
Übernimm die Icon-Engine (ICON_PAL, ICONS, icon) aus der Logik von English Stars UI Pastell.dc.html in ein eigenes Modul, ohne die Daten zu ändern. Stell iconHTML() darauf um. Größen nur 14, 28, 42, 56 px. Liste mir am Ende alle Stellen, an denen du ein Emoji oder Vektor-Symbol ersetzt hast, und alle, für die du kein passendes Icon gefunden hast (die ersetzt du nicht selbst, sondern fragst).
```

**Phase 3 · Gegner**
```text
Ersetze pixel-enemies.js durch app/pixel-enemies-dungeon.js (enemySpriteSVG(kind) hat dieselbe Signatur). Im Kampf die Kampfrichtung aus DUNGEON_ENEMIES_FACING_LEFT, zum Helden gedreht. Welche Gegner wo auftauchen (ENEMY_POOL), ist Funktion: frag, falls es heute anders verteilt ist.
```

**Phase 4 · Figur und Gefährte**
```text
Adapter statt avatarSVG mit renderHero, renderHead, renderPet, renderHeroWithPet aus app/pixel-hero-fine.js. equippedGearMap() nach START-HERE („Worauf Claude Code achten muss“, Punkt 2) anschließen. Figuren cachen (Schlüssel: Avatar + Ausrüstung). Die Migration alter Spielstände (avatarVersion: 2) baust du erst, wenn sie in HANDOFF-ENTSCHEIDUNGEN.md entschieden ist. Den Charakter-Editor baust du erst in Phase 7.
```

**Phase 5 · Gegenstände, Kampfplätze, Lagerfeuer**
```text
app/pixel-world-fine.js anschließen: Gegenstände über itemSprite(typ, material), Schmiede mit 5 Teilen (PART_NAMES, partStates, itemPartsCanvasTrimmed) nach „Schmiede · 5 Teile“, Profil-Slots, Kampfplätze (ARENAS), Rastplatz mit CAMPFIRE_FRAMES (8 fps). Nie opacity oder grayscale. Welcher Kampfplatz wann erscheint, ist Funktion: frag, falls es heute anders ist.
```

**Phase 6 · Kampf-Animationen**
```text
In campaign-fight.js: SpritePlayer, ProjectileLayer, heroCombatSheet, enemyCombatSheet aus app/pixel-anim.js. Kampf-Blätter beim Laden des Kampfes bauen. Schaden, Lebensleiste und Ton in onHit, bei Bogen und Stab beim Einschlag. Gefährte mit petBattleFrames / petBattleSequence synchron zum Helden und immer vor ihm (z-index nach START-HERE). Sieg 7.15 und 7.16 mit win, Niederlage 7.17 mit die (endet von selbst in ko). Hat der Gefährte heute keine Wirkung im Kampf, bleibt er reine Anzeige.
```

**Phase 7 · Screens (je Sitzung ein Bereich 1 bis 9)**
```text
Bereich [1–9] nach SCREENS.md, ein Commit je Bereich. Jeder Screen wie sein Fragment: Aufbau, Texte, Abstände, Farben, Icons. UI-Animationen mit createUiAnimator({ icon, idleFrames }) aus app/ui-anim.js am gemeinsamen 8-fps-Takt; idleFrames nach uiIdle in der Referenzdatei. Den Charakter-Editor (1.9, 1.10, 8.4 bis 8.10) baust du nach „Charakter-Editor“ in START-HERE. Screens oder Dialoge, die es heute nicht gibt, sind Funktionsänderungen: nur bauen, wenn sie entschieden sind.
```

**Phase 7b · App-Tour**
```text
Nach „App-Tour“ in START-HERE: Auslöser nach 1.10, tourSeen beim Beenden und beim Überspringen, „App-Tour ansehen“ in 8.1, neutraler Demo-Stand (Name „Vondu“, Standardfigur, 0 Kronen, 0 Taler, Sammlung „Tiere“ in Schritt 2), Spotlight, Dialog-Box mit Vondu (VONDU_FRAMES), Texte wörtlich aus 1.11 bis 1.15. Echte Daten werden während der Tour weder angezeigt noch verändert.
```

**Phase 7c · App-Icons und Startbilder**
```text
Dateien aus appicon/ nach dessen README einbinden. Zeig mir vorher, welche Dateien du wo einträgst (Manifest, iOS, Android, Favicon), und warte auf mein Okay.
```

**Phase 8 · Aufräumen**
```text
Noch nichts löschen. Zeig mir zuerst die Liste aller alten Renderer, Dateien und Stellen mit dem Schalter pastell, die wegfallen würden, und was sie heute noch benutzt. Lösch erst, wenn ich zustimme.
```

---

## Kurzbefehle

**A · Antworten geben**
```text
Meine Antworten: F-01 A · F-02 B · F-03 wie heute lassen · F-04: [eigener Text]. Trag sie in HANDOFF-ENTSCHEIDUNGEN.md ein, pass HANDOFF-PLAN.md an und sag mir, ob noch etwas offen ist.
```

**B · Screen abnehmen**
```text
Vergleiche Screen [X.Y] in der App mit seinem Fragment aus SCREENS.md: Aufbau, Texte, Abstände, Farben, Rahmen, Icons, Figuren, Animationen. Liste jede Abweichung mit Fundstelle auf. Ändere noch nichts.
```

**C · Fehler melden**
```text
Auf dem Handy sehe ich: [was, wo, wann]. Finde die Ursache und erklär sie mir, bevor du etwas änderst. Ist die Lösung eine Funktionsänderung, frag im Format F-nn. Sieht eine Grafik aus einem Modul falsch aus, beschreib sie mir, statt sie nachzuzeichnen.
```

**D · Stand abfragen**
```text
Wo stehen wir? Fertige Phasen mit Commits, offene Fragen aus HANDOFF-ENTSCHEIDUNGEN.md, nächster Schritt. Ändere nichts.
```

**E · Neue Sitzung, gleiche Phase**
```text
Neue Sitzung. Lies CLAUDE.md, HANDOFF-ENTSCHEIDUNGEN.md, HANDOFF-PLAN.md und die letzten Commits auf dem Branch pastell-redesign. Fass mir kurz zusammen, wo Phase [N] steht, und mach dann dort weiter.
```

**F · Nur umsetzen, nicht verbessern**
```text
Bitte nur umsetzen, was im Handoff steht. Nimm alles zurück, was darüber hinausgeht, und schreib mir deine Ideen stattdessen als Liste.
```

**G · Neuer Design-Stand**
```text
Ich habe design_handoff_english_stars_pastell/ durch einen neuen Stand ersetzt. Vergleich per git diff, was sich im Handoff geändert hat (START-HERE „Neu in diesem Stand“, Module, Fragmente). Liste die Änderungen, ordne sie den Phasen zu und stell Fragen zu allen Funktionsänderungen. Noch kein Code, bis ich zustimme.
```
