# English Stars · Pastell-Redesign · Dauerregeln für Claude Code

Diese Regeln gelten in jeder Sitzung, bis das Redesign abgeschlossen ist (Phase 8). Alle Unterlagen liegen in `design_handoff_english_stars_pastell/` neben `src/`.

## 1 · Auftrag
Übernimm das Pastell-Redesign von English Stars 1:1 in unsere App: 106 Screens, Pixel-Icons, Figur und Gefährte, 36 Gegner, Waffen und Ausrüstung, 6 Kampfplätze, Schmiede, Lagerfeuer, alle Kampf- und UI-Animationen und die App-Tour.

Das Redesign ändert das **Aussehen**. Die **Funktion** der App bleibt so, wie sie heute ist, bis ich etwas anderes entscheide.

## 2 · Rückfrage-Pflicht bei Funktionsänderungen (wichtigste Regel)
Bevor du irgendetwas an der Funktion änderst, hältst du an und fragst mich. Das gilt auch, wenn der Handoff (Screens, `START-HERE.md`) die Änderung beschreibt, und auch, wenn sie klein oder selbstverständlich wirkt.

### Das ist eine Funktionsänderung
- **Spielregeln und Werte:** Taler, Kronen, Punkte, Noten, Leben, Schaden, Werte von Waffen und Ausrüstung, Zeitlimits, Kosten, Belohnungen, Freischaltungen, Schwierigkeit, Reihenfolge oder Auswahl von Aufgaben und Gegnern.
- **Daten und Speicherstand:** neue, umbenannte oder gelöschte Felder, andere Wertebereiche, Migration alter Spielstände, Sync, Server, API, was an Freunde übertragen wird.
- **Abläufe und Navigation:** Screens oder Dialoge, die es heute nicht gibt oder die wegfallen, Rückfragen, Knöpfe mit anderer Wirkung, andere Reihenfolge, andere Einstiege oder Rücksprünge.
- **Eingaben:** Mikrofon und Spracherkennung, Kamera und Scan, Tastatur, Gesten (langes Drücken, Ziehen, Wischen).
- **Funktionen, Einstellungen, Modi, Schalter,** die neu dazukommen oder wegfallen.
- **Technik:** neue Abhängigkeiten, Build- oder Manifest-Einstellungen, Berechtigungen, Offline-Verhalten, Ordnerstruktur außerhalb der aktuellen Phase.
- **Texte,** die eine andere Regel beschreiben, als der Code heute umsetzt (z. B. „+1 Taler“, „nächster Lauf kostenlos“, „+15 Leben“). Dann passt du weder den Text an den Code noch den Code an den Text an, sondern fragst.
- **Löschen** von Code, Daten oder Funktionen, die noch benutzt werden.

### Das darfst du ohne Rückfrage (reines Aussehen)
- Farben, Schriften, Rahmen, Radien, Schatten, Abstände und Anordnung auf einem Screen, den es heute schon gibt.
- Emojis und Vektor-Symbole durch die Pixel-Icons ersetzen.
- Figur, Gefährte, Gegner, Gegenstände, Kampfplätze und Lagerfeuer aus den Modulen einbauen.
- Animationen genau so, wie sie im Handoff festgelegt sind.
- Texte wörtlich aus den Fragmenten, solange sie dieselbe Funktion beschreiben wie heute.
- Bilder cachen und Sprites vorbereiten, damit es schnell bleibt.

Im Zweifel ist es eine Funktionsänderung: fragen.

### So fragst du
Eine Frage pro Punkt, fortlaufend nummeriert (F-01, F-02 …), in diesem Format:

    FRAGE F-12 · Funktionsänderung · Screen 8.12 · Datei(en): …
    Heute:        was der Code jetzt tut
    Laut Design:  was Fragment bzw. START-HERE.md vorsieht (mit Fundstelle)
    Optionen:     A) wie im Design · B) wie heute lassen · C) andere Lösung, falls sinnvoll
    Empfehlung:   A, B oder C, mit einem Satz Begründung
    Folgen:       Speicherstand · betroffene Screens · Aufwand

Danach wartest du auf meine Antwort. An dieser Stelle rätst du nie und baust keine Übergangslösung. Teile, die nicht von der Frage abhängen, darfst du weiterbauen. Sag mir, welche das sind.

### Entscheidungen festhalten
Jede Antwort trägst du in `HANDOFF-ENTSCHEIDUNGEN.md` im Projektordner ein (anlegen, falls es sie nicht gibt):

    | Nr. | Frage (kurz) | Entscheidung | Phase | Datum |

Zu Beginn jeder Sitzung liest du diese Datei und `HANDOFF-PLAN.md`. Was entschieden ist, fragst du nicht noch einmal und setzt es genau so um.

## 3 · Quellen und Rangfolge
1. `app/*.js`: Grafik und Animation als fertiger Code. Gilt vor allem anderen.
2. `screens/` und `SCREENS.md`: Aufbau, Texte und Abstände jedes Screens.
3. `START-HERE.md`: Regeln, Datenbereiche, Abläufe, Phasen, Platzhalter.
4. `README.md`: Design-System (Farben, Typo, Rahmen, Bausteine, Icon-Regeln).
5. `English Stars UI Pastell.dc.html`: Gesamtreferenz zum Anschauen im Browser. Enthält die Pixel-Icon-Engine (`ICON_PAL`, `ICONS`, `icon`) und `uiIdle`.
6. `DESIGN.md`, `tokens.json`, `ref/`: alter Stand, nur zum Abgleich.

Widersprechen sich zwei Quellen, fragst du (Format oben).

**Nicht übernehmen:** `app/avatar.js`, `pixel-items.js`, `pixel-enemies.js`, `arena.js`, `storage.js`, `sync.js`, `dialog.js`. Das sind nur Stubs, damit die Referenzdatei im Browser läuft.

## 4 · Nichts erfinden
- Keine eigenen Grafiken, Icons, Emojis, SVGs, Farben, Texte oder Animationen. Alles Nötige steht in den Modulen und Fragmenten.
- Werte in den Fragmenten (Namen, Zahlen, Wörter, Prozente) sind Beispiele. Nie fest einbauen, immer an echte Daten binden. Zeigt ein Fragment Daten, die es in der App nicht gibt: fragen.
- Fehlt ein Zustand (Fehler, leer, lädt, sehr lange Wörter oder Namen): das nächstliegende Fragment als Vorbild nehmen und mir den Vorschlag zeigen, bevor du ihn baust.
- Sieht eine Grafik aus einem Modul falsch aus, zeichnest du sie nicht nach und änderst keine Pixeldaten. Beschreib mir genau, was du siehst (Screen, Figur, Ablauf, Bild-Nr.). Ich kläre es im Design.

## 5 · Module unverändert übernehmen
`pixel-hero-fine.js`, `pixel-enemies-dungeon.js`, `pixel-world-fine.js`, `pixel-anim.js` und `ui-anim.js` werden kopiert und nur über ihre Exporte benutzt.
- Nicht umbauen, nicht umbenennen, nicht umformatieren (auch nicht automatisch per Formatter oder Linter), nicht minifizieren, keine Pixeldaten anfassen.
- Anbindung, Adapter und Caching schreibst du in eigenen Dateien.
- Braucht es trotzdem eine Änderung im Modul, fragst du.

## 6 · Technische Regeln (Details in START-HERE.md)
- **Pixel:** nur ganzzahlig skalieren, immer `image-rendering: pixelated`, keine CSS-Übergänge oder Easing auf Sprites, keine freie Rotation. Pixel-Icons nur in 14, 28, 42 oder 56 px.
- **Takt:** ein gemeinsamer 8-fps-Takt (125 ms) für Figuren und UI-Animationen. Stehen 4 fps; Angriff, Treffer, Sieg und Niederlage 8 fps; K.O. 4 fps.
- **Treffer:** Schaden, Lebensleiste und Ton gehören in `onHit`, nie an den Start des Angriffs. Bei Bogen und Stab erst beim Einschlag (`ProjectileLayer`).
- **Niederlage:** `play('die')` geht von selbst in `ko` über. Nicht selbst zurück auf `idle` schalten.
- **Gegner:** Angriffsart und Niederlage wählt `enemyCombatSheet(key)` selbst (`ATK_OF`, `DIE_OF`). Nichts davon selbst zuordnen.
- **Held:** Posen, Ablauf, Projektil und Aufprall wählt `heroCombatSheet(cfg)` selbst aus der angelegten Waffe.
- **Gefährte im Kampf:** an der Stelle des Helden, 24 px zum Gegner versetzt und 4 px tiefer, **immer vor dem Helden** (Gefährte z-index 3, Held 2; im Angriff 7 und 6). Synchron über `petBattleSequence`.
- **Leistung:** Figuren einmal zeichnen und als Bild cachen (Schlüssel: Avatar + Ausrüstung). Kampf-Blätter beim Laden des Kampfes bauen, nicht beim ersten Angriff.
- **Schmiede:** nie `opacity` oder `grayscale`. Werkstücke immer mit `itemPartsCanvasTrimmed(…)` und den Teile-Zuständen zeichnen.
- **Bewegung reduzieren** (`prefers-reduced-motion`): keine UI-Animationen. Figuren zeigen nur das Treffer- bzw. Liegebild, kein fliegender Pfeil.
- **Start (1.1) und Anmeldung (1.2–1.7):** Vondu und „Los geht's“ bewegen sich nicht.

## 7 · Arbeitsweise
- Eigener Branch (z. B. `pastell-redesign`). Kein Merge und kein Push auf `main` ohne mein Okay.
- Das Neue kommt hinter den Schalter `pastell`, damit ich alt und neu vergleichen kann. Der alte Stand bleibt bis Phase 8 lauffähig.
- Eine Phase pro Sitzung, in der Reihenfolge aus `START-HERE.md`. Nichts vorziehen.
- Keine eigenen Verbesserungen. Ideen schreibst du als Liste ans Ende deines Berichts.
- Nach jedem abgeschlossenen Bereich committen, mit klarer Nachricht (z. B. `pastell: Phase 3 – Gegner im Kampf`).
- Nach jeder Phase Build und vorhandene Tests laufen lassen. Schlägt etwas fehl, nichts abschalten oder umgehen, sondern melden.
- Phase 8 (Aufräumen: alte Renderer und Schalter entfernen) erst nach meiner ausdrücklichen Freigabe. Vorher zeigst du mir die Liste aller Dateien und Stellen, die wegfallen.

## 8 · Abschlussbericht am Ende jeder Phase
1. **Fertig:** Dateien, Screens, Commits.
2. **Prüfen:** genaue Schritte auf dem Handy (Tab, Knopf, Zustand) und welches Fragment der Vergleich ist.
3. **Abweichungen** vom Handoff, jeweils mit Grund.
4. **Offene Fragen** (F-nn) und was davon blockiert ist.
5. **Nächste Phase:** was kommt und was du dafür von mir brauchst.

Danach stoppst du und wartest.
