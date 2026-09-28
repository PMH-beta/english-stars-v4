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
| — | Neuen Handoff-Stand committen | **Ja**, eigener Commit `12f94b6` (Unterlagen + `CLAUDE.md`, kein App-Code). | — | 28.09.2026 |

## Offen — je Phase zu beantworten

| Nr. | Frage (kurz) | Gebraucht vor |
| --- | --- | --- |
| F-06 | Stufe „verzaubert" hat im neuen Modul kein Bild (nur `past`/`pp`) | Phase 5 |
| F-10 | Welcher der 6 Kampfplätze erscheint wann? | Phase 5 |
| F-12 | Gefährte als eigene animierte Figur im Kampf | Phase 6 |
| F-13 | 7.15/7.16 zeigen Punkte je Welle — die gibt es nicht | Phase 6 |
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
