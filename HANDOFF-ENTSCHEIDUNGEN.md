# Entscheidungen zum Pastell-Handoff

Jede beantwortete Frage aus dem Funktions-Abgleich steht hier. Was hier steht,
wird nicht noch einmal gefragt und genau so umgesetzt. Format nach
`design_handoff_english_stars_pastell/CLAUDE-REGELN.md`, Abschnitt 2.

## Dauernde Vorgabe des Nutzers (28.09.2026)

**Die Vokabeldecks sind das Einzige, was wirklich schützenswert ist.** Außer
Hannah sind alle Konten Testkonten; Kampagnen-Fortschritt, Ausrüstung und
Avatare dürfen bei einer Migration verloren gehen. Kein Umbau darf `SD.decks`,
`wordStats` oder die Deck-Tabellen in Supabase anfassen.

## Entschieden

| Nr. | Frage (kurz) | Entscheidung | Phase | Datum |
| --- | --- | --- | --- | --- |
| F-01 | Neue Pixel-Art-Module übernehmen? Widerspricht der Entscheidung vom 19.09.2026 („bestehende Pixel-Art bleibt") | **A — alles neu.** Phasen 0, 3, 4, 5, 6 werden gebaut. Die Entscheidung vom 19.09.2026 ist damit aufgehoben. | 0, 3–6 | 28.09.2026 |
| F-02 | Schalter `pastell` für den Vergleich alt/neu | **Kein Schalter.** Der Rückweg ist `git revert`. Begründung des Nutzers: der Fortschritt der Bestandskonten ist entbehrlich. | alle | 28.09.2026 |
| F-24 | Wie ist `dev/sprites.html` erreichbar? | **A — im Build**, wie `dev/pixel-icons-test.html` und `dev/bausteine.html`. Damit auch vom Handy über `/dev/sprites.html`. | 0 | 28.09.2026 |
| F-11 | Gegnername im Kampf: Einzelname oder Typ-Name? | **A — Einzelname.** Die Lebensleiste zeigt „Moosschleim" statt „Wortgeist". Die Titelzeile trägt weiterhin den Knotentyp („⚔️ Übung"), die Information geht also nicht verloren. | 3 | 29.09.2026 |
| F-23 | Wie werden die 402 KB Gegner-Sprites geladen? | **Statisch + vorgecacht.** Normaler Import in `campaign-fight.js`, Eintrag im PRECACHE von `sw.js`. Bewusst in Kauf genommen: der App-Start lädt und parst 402 KB mehr. | 3 | 29.09.2026 |
| F-03 | Sechs Merkmale fallen weg, drei kommen dazu | **A — ersatzlos streichen.** `ears`, `nose`, `petEars`, `petTail`, `petEyes`, `petPattern` fliegen aus dem Spielstand; `iris`, `topC`, `pantsC` kommen dazu; `build` 20 → 3. | 4 | 29.09.2026 |
| F-04 | Gefährten-Zuordnung 0–9 | **A — wie im Handoff.** Die Zahlen 0–9 werden direkt übernommen; fünf Kinder bekommen dadurch ein anderes Tier. | 4 | 29.09.2026 |
| F-05 | Migration auf `avatarVersion: 2` | **A — umrechnen.** Formen per Modulo, Farben über den nächstliegenden Ton. Die Kleidungsfarbe kommt aus der ALTEN Kleidung, weil dort Schnitt und Farbe zusammenhingen. Dry-Run vor dem Einbau gezeigt und freigegeben. | 4 | 29.09.2026 |
| — | Augenfarbe bei der Migration | **Aus der alten Haarfarbe ableiten** statt bei allen 0 zu lassen — sonst bekämen alle Kinder dieselben Augen. Schwarzes Haar → dunkel, rot → rot, blond → bernstein. | 4 | 29.09.2026 |
| F-07 | Talisman und Ring an der Figur | **A — akzeptieren.** Die neue Figur trägt sie nicht mehr sichtbar. Wirkung im Kampf und Fach im Profil bleiben unverändert. Der Gefährte steht als eigene Figur daneben. | 4 | 29.09.2026 |
| F-06 | Stufe „verzaubert" hat im neuen Modul kein Bild | **Keine Frage nötig.** `itemSpriteSVG` hat `tier` schon immer ignoriert — „verzaubert" hatte nie ein eigenes Bild. `itemSprite(typ, material)` bildet dasselbe ab: Stahl oder Gold. Werte und Fortschritt unberührt. | 5 | 29.09.2026 |
| F-10 | Welcher der 6 Kampfplätze erscheint wann? | **An die Runde gebunden** (Wiese → Abend → Kerker → Kristall → Vulkan → Friedhof, dann von vorn). Keine Funktionsänderung — es ist nur das Hintergrundbild; deshalb ohne Rückfrage entschieden, wie am 29.09. vereinbart. | 5 | 29.09.2026 |
| F-12 | Gefährte als eigene Figur im Kampf | **Ohne Rückfrage gebaut.** Seine Wirkung (COMPANION_GUARDS) ändert sich nicht — seit Phase 4 war er nur unsichtbar geworden. Er steht jetzt neben dem Helden, springt beim Angriff mit und zuckt beim Treffer. | 6 | 29.09.2026 |
| F-13 | 7.15/7.16 zeigen Punkte je Welle | **C — Wellen zählen statt Punkte.** Der Sieg-Screen zeigt „N Wellen gewonnen" aus `run.fight.wave`. Keine neue Spielregel, kein neues Feld. | 6 | 29.09.2026 |
| F-27 | Rastplatz-Screen 6.7 gibt es heute nicht | **A — Screen bauen.** Kampfplatz „abend", Lagerfeuer in 8 fps, Lebensleiste mit dem Zugewinn, Knopf „Weiter". Die Heilung bleibt exakt REST_HEAL und gedeckelt. | 5 | 29.09.2026 |
| — | Neuen Handoff-Stand committen | **Ja**, eigener Commit `12f94b6` (Unterlagen + `CLAUDE.md`, kein App-Code). | — | 28.09.2026 |

## Offen — je Phase zu beantworten

| Nr. | Frage (kurz) | Gebraucht vor |
| --- | --- | --- |
| F-09 | Info-Knopf je Station mit den Werten der Waffe | Phase 7 |
| F-15 | Erster Start: 7 Reiter statt 10 Merkmale | Phase 7 |
| F-16 | Charakter-Editor: Zurück verwirft + Rückfrage 8.12 (heute speichert Zurück) | Phase 7 |
| F-17 | 3.5 „kein Key nötig" — heute hängt der Scan am API-Key | Phase 7 |
| F-18 | 4.11 Selbstbewertung nach dem Sprechen | Phase 7 |
| F-19 | 5.7 und 5.10 — heute 5 Modi, Design zeigt 6 | Phase 7 |
| F-20 | 9.2 „App installieren" beim 3. Start | Phase 7 |
| F-21 | 9.7 Mikrofon-Pegel an die echte Lautstärke koppeln? | Phase 7 |
| F-08 | „Werkstoff wählen" → „Wörter befüllen", Station löschen entfällt | Phase 7 |
| F-14 | App-Tour 1.11–1.15, Feld `tourSeen`, Demo-Stand | Phase 7b |
| F-25 | Was liefert die RPC `get_friend_progress` heute? | Phase 7, Bereich 8 |
| F-26 | Abnahme je Phase: nur `npm run build` oder zusätzlich Headless-Screenshots | nebenbei |
| F-28 | 2.5 Sortieren: Probetest, Kopfzeile und „+ Neue Vokabelsammlung“ während des Ziehens ausblenden | Phase 7, Bereich 2 |
| F-29 | 2.10 Schnellmodus: Rückfrage „Abbrechen / Einschalten“ vor dem Einschalten (heute: sofort an + Hinweis) | Phase 7, Bereich 2 |
| F-30 | 2.10 Text „bringt keine Taler“ — heute schaltet eine Schnellrunde Taler frei (getestet: `d1\|mc`) | Phase 7, Bereich 2 |
| F-31 | 2.11 Menü im Schnellmodus: Probetest und „+ Neue“ weg, Karten ohne Datum/Chips/Pfeil, Chip „Schnellmodus“ im Banner | Phase 7, Bereich 2 |
| F-32 | Versionsnummer unten im Menü (kein Fragment zeigt sie dort; sie liegt über der letzten Karte) | Phase 7, Bereich 2 |
| F-33 | 6.6 Schatz: erst auswählen (Haken), dann „Nehmen“ — heute nimmt ein Tipp den Trank sofort | Phase 7, Bereich 6 |
| F-34 | 6.6 Zeittrank „+5 Sekunden in jedem Minispiel“ — heute „+5 s für 3 Wellen“ | Phase 7, Bereich 6 |
| F-35 | 7.16 Boss besiegt: Knopf „Zur Kampagne“ (heute startet „Neue Runde starten“ sofort den nächsten Lauf); Chip „+1 Taler“ fehlt im Entwurf | Phase 7, Bereich 7 |
| F-36 | 7.15 zeigt keine Wellen mehr — F-13 („N Wellen gewonnen“) aufheben? | Phase 7, Bereich 7 |
| F-37 | 1.5 „Mail ist raus!“: Knopf „Erneut senden“ für den Reset-Link (gibt es heute nicht) | Phase 7, Bereich 1 |
| F-38 | 1.1 Reihenfolge: Entwurf erst Ladebalken, dann „Los geht's“ — heute erst der Knopf (iOS gibt Ton nur nach dem Tippen frei), dann der Balken | Phase 7, Bereich 1 |

## Ohne Rückfrage entschieden (Aussehen) — Phase 7

| Punkt | Entscheidung | Datum |
| --- | --- | --- |
| Maße | Die Referenz rechnet ohne `box-sizing`, der Rahmen kommt außen dazu. Im CSS stehen deshalb Außenmaße (Fragmentwert + Rahmen). | 29.09.2026 |
| 2.1 Banner beim Laden | Karte aus 2.3 statt des alten Banners aus 2.1, damit beim Fertigladen nichts springt. Inhalt wie 2.1. | 29.09.2026 |
| 2.1 Ladekreis | steht still (keine Animation im Fragment, Übersicht 9.7: nur die Punkte bewegen sich). | 29.09.2026 |
| 2.4 Karte „Farben“ | Im Fragment liegt ihr Balken außerhalb der Karte (Markup-Fehler). Gebaut wie 2.3. | 29.09.2026 |
| Dialoge | senkrecht mittig. Im Entwurf je Dialog anders (2.12 rund 130 px höher, 2.7 knapp mittig). | 29.09.2026 |
| 2.6 offen ohne Verlauf | Tintenkasten mit hellem Pfeil wie 2.6 (Zustand fehlt im Entwurf). | 29.09.2026 |
| 6.2–6.5 Vorschau | feste kleine Beispielkarte wie im Fragment statt der vollen Zufallskarte; sie ist nicht spielbar. | 29.09.2026 |
| 6.1 Portal-Knoten | flieder (einzige Angabe: Vorschau 6.2). | 29.09.2026 |
| 6.1 Boss | immer in Farbe mit Goldring und schwebender Krone, wie im Fragment — auch wenn er noch nicht erreichbar ist. | 29.09.2026 |
| Krafttrank | Farbe fehlt im Entwurf: Pfirsich (Vorschlag). | 29.09.2026 |
| 6.8 Trank-Info | Blase hängt unter dem Trank (rechts neben der Kopfkarte ist kein Platz), Zipfel nach oben. | 29.09.2026 |
| 6.4 zu wenig Taler | bei 2 fehlenden Talern Mehrzahl: „Dir fehlen 2 Taler — schließ 2 Übungsarten auf 100 % ab.“ | 29.09.2026 |
| 7.x Meteoriten | fallen in harten 8-fps-Stufen statt per CSS-Übergang (Regel 6: keine Übergänge auf Sprites); Fallzeit gleich. | 29.09.2026 |
| 7.x Treiben | Buchstaben und Echo-Wörter treiben weiter wie bisher (Spielmechanik); das Fragment zeigt sie still. | 29.09.2026 |
| 7.6 „Richtig · Wort“ | nach jeder gelösten Welle mit einem Wort (Sturm, Meteoriten, Echo), nicht bei Richtig/Falsch. | 29.09.2026 |
| 7.16 Text | „{Bossname} ist gefallen — Lauf geschafft.“ ohne Artikel (Namen haben verschiedene Geschlechter). | 29.09.2026 |
| N41 Lage | Schutz-Meldung links über dem Helden, 1,6 s; der Entwurf zeigt nur die Karte, nicht die Lage. | 29.09.2026 |
