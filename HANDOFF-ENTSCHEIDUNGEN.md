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
| F-17 | 3.5 „Kein Key nötig!“: den Screen gibt es (`apikey-screen`, jetzt wie 3.5), er wird aber nie gezeigt — der Scan braucht keinen Key. Irgendwo zeigen oder stillgelegt lassen? | Phase 7, Bereich 3 |
| F-18 | 4.11 Selbstbewertung nach dem Sprechen | Phase 7 |
| F-19 | 5.7 und 5.10 — heute 5 Modi, Design zeigt 6. **Neuer Befund (29.09.):** beide Spielformen gibt es schon (`bErkennenFix` = falsche Form korrigieren, `bSchmiedenGap` = fehlender Buchstabe, beide über `bDisc`); die Frage ist damit wohl gegenstandslos — bitte bestätigen | Phase 7 |
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
| F-39 | 3.6 Zeilen: Wort + Übersetzung als Text mit Knopf ✓ bzw. Stift (fehlende Übersetzung) — heute zwei Eingabefelder, direkt bearbeitbar | Phase 7, Bereich 3 |
| F-40 | 3.6 Knopf „Neu scannen“ oben rechts (heute nur der Zurück-Knopf) | Phase 7, Bereich 3 |
| F-41 | 3.6 „+ Wort manuell ergänzen“ — heute kann man auf „Vokabeln prüfen“ kein Wort hinzufügen (`addReviewItem` hat keine Felder; „Wörter manuell eingeben“ nach einem Fehlscan führt auf eine leere Liste) | Phase 7, Bereich 3 |
| F-42 | 3.6 Kopfzeile „3 erkannt“ statt der Zeile „3 Wörter erkannt · 2 neu · 1 bereits vorhanden (grau)“ — Dubletten zeigt der Entwurf nicht | Phase 7, Bereich 3 |
| F-43 | 3.1 zeigt unter „Hinzufügen“ zusätzlich die Liste („Liste · 12 Wörter“, ohne Bearbeiten/Löschen); 3.3/3.4 und der Reiter „Liste“ tun das nicht | Phase 7, Bereich 3 |
| F-44 | 3.2 Zurück-Knopf auch in einer neuen Sammlung (Entwurf) — heute ausgeblendet, dort gibt es nur „Abbrechen“/„Bestätigen“ | Phase 7, Bereich 3 |
| F-45 | 4.5 Spiel im Schnellmodus: Chip „Schnellmodus“ unter dem Titel, statt Warte-Kasten und Fortschrittskarte nur der Hinweis „Schnellmodus — zählt nicht in die Statistik“ (heute sieht das Spiel aus wie sonst) | Phase 7, Bereich 4 |
| F-46 | 4.4 Zwischenkarte „Jetzt nochmal …“ mit Knopf „Los“ — heute geht es nach 2 s von selbst weiter | Phase 7, Bereich 4 |
| F-47 | 4.12 Fortschrittskarte im Probetest: „0/20 · gemischt aus 2 Sammlungen“ statt „3/5 richtig · Note 2“ (heute mit laufender Note) | Phase 7, Bereich 4 |
| F-48 | 4.10 Knopf „Nochmal versuchen“ nach falscher Aussprache — heute ist eine falsch erkannte Aussprache endgültig (Rückmeldung + „Weiter“) | Phase 7, Bereich 4 |
| F-49 | 4.11 beim Selbstbewerten kein Mikrofon mehr — heute kann man dort mit „Nochmal“ noch einmal sprechen | Phase 7, Bereich 4 |
| F-50 | 5.3 zeigt den Trainingsplatz ohne Einklapp-Karte (Überschrift, Knopf und Decks immer offen); 5.1 (älter) und heute: einklappbar | Phase 7, Bereich 5 |
| F-51 | 5.7/5.8/5.11 geben zusätzlich die englische Grundform vor („write“ groß, „schreiben · Infinitiv“; 5.7 „get · bekommen“) — heute nur das deutsche Wort bzw. nur die falsche Form. Macht die Aufgaben leichter. | Phase 7, Bereich 5 |
| F-52 | 5.7 streicht die falsche Form durch — im Juni bewusst entfernt (Commit `9396dfe`) | Phase 7, Bereich 5 |
| F-53 | 5.8 Tipp-Knopf (Glühbirne) neben „Prüfen“ — gibt es heute nicht | Phase 7, Bereich 5 |
| F-55 | 9.5 Lautstärke als feste Leiste neben dem Musik-Knopf (nur am Computer) — heute eigener Knopf, der einen senkrechten Regler aufklappt (4 s) | Phase 7, Bereich 9 |
| F-54 | 5.13 Info „Die Schmiede“: Punkt 4 „Verzaubern öffnet sich erst, wenn die Waffe fertig ist“ — heute ist Verzaubern eines der 5 Teile (Teil 3–5, `weaponSlots`); außerdem fehlen „Tippe die Waffe …“ und „nächste Station geht auf“ | Phase 7, Bereich 5 |

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
| Zurück-Knopf | überall 34 + Rahmen = 38 px wie in allen Fragmenten (vorher 34). Pfeil 28 px — 3.6, 4.2 und 4.6 zeigen 14 px, alle anderen 28 px. | 29.09.2026 |
| 3.x Kopf/Reiter | nach 3.3/3.4 (Nachtrag): Buch + „Vokabeln verwalten“, „Hinzufügen“ statt „+ Neu“. 3.1 ist der ältere Stand. | 29.09.2026 |
| 3.4 „Zustand · Scan läuft“ | als Beschriftung des Entwurfs gelesen und weggelassen; es steht immer nur eine Zustandspille da (vorbereiten / erkennen / Prozent / Fehler). Der Hinweis „Nach dem Erkennen …“ steht fest unter der Fläche. | 29.09.2026 |
| 3.4 Scan-Linie | läuft immer über den Kamerarahmen (Übersicht 9.7: „läuft in 24 Takten … über den Kamerarahmen“). | 29.09.2026 |
| 3.4 Fehlertexte | „Texterkennung fehlgeschlagen“ ohne technische Meldung (die steht in der Konsole). „Kein Text erkannt“ und „Keine Vokabeln erkannt“ als rosa Pille; Rohtext und „Wörter manuell eingeben“ wie der Chip „Neu scannen“ (3.6). | 29.09.2026 |
| 3.1 Balkenfarbe | Liste: ab 80 % mint, ab 30 % gold, darunter rosa (Entwurf: 92 / 58 / 24 %). | 29.09.2026 |
| 3.2 Vorlagen | Kopfzeile „30 Wortgruppen · 1 von 2 an“ aus echten Zahlen. „AUS“ ist nur Anzeige, getippt wird wie bisher die ganze Karte. Aktive Vorlage mit Balken statt Prozentzahl. Gesperrt/Limit: Hinweis in der Textzeile mit Schloss bzw. Haken; ausgegraute Karten wie bisher (Deckkraft .38). | 29.09.2026 |
| 3.7 Tabellen | „R / F“ als Zahlen „4 / 0“ statt farbiger Punkte; vorläufiger Stand (unter 3 Abfragen) bleibt als Punkte im Chip. | 29.09.2026 |
| Statistik aus dem Menü | Kopf „Statistik“ ohne Symbol wie 5.5, der einzelne Reiter „Statistik“ fällt weg; Vorlagen-Übersicht als Karte wie 5.5 (Name, Wörter, Prozent, Balken). | 29.09.2026 |
| Dialoge im Verwalten | „Sammlung sperren?“, „Sammlung abschließen?“ und „Name der Sammlung“ im Gerüst der übrigen Dialoge (Emblem, Vondu-Kasten, Knöpfe); Texte, Knöpfe und Ablauf unverändert. | 29.09.2026 |
| 4.x Fragekarte | nach den Nachtrag-Fragmenten (N10, N14, N16): Antworten in der Karte, Wort 32 px, Kürzel „DE“ 14 px, Antwortkacheln 58 + Rahmen in 900 16 px. 4.1/4.2/4.6 sind der ältere Stand (Antworten unter der Karte, 34 px); 4.12 weicht um 1–2 px ab. | 29.09.2026 |
| 4.x Rückmeldung | Treffer wie 4.2 (mint, „Weiter“ rechts in der Fläche), Fehler wie 4.3 (rosa, „Weiter“ darunter über die Breite), Warten wie 4.12 (Sanduhr, „Warte auf deine Antwort …“). Texte ohne Emoji, „Pkt“ → „Punkte“, Antwort fett. | 29.09.2026 |
| 4.x Fortschrittskarte | immer wie 4.7/4.12: Symbol + Modus, Prozent 17 px, Balken in Tinte — auch bei Vokabeln und Rechtschreibung (4.1/4.2/4.6 zeigen noch Mint ohne Symbol). In 4.3 fehlt die Karte, sie bleibt trotzdem stehen. | 29.09.2026 |
| 4.x Animationen | falsche Kachel/Eingabe wackelt, Haken der richtigen ploppt, Flamme flackert, Sanduhr dreht, Punkte laufen — mit den Takten aus den Fragmenten. Die alte Hüpf-Animation der Karte und das Karten-Wackeln sind weg. | 29.09.2026 |
| 4.13/4.14 | Pokal wippt mit drei Funkeln, Sterne ploppen nacheinander; Probetest-Ende als Karte mit Notenkreis (immer mint — Farben je Note gibt der Entwurf nicht vor), „Gut!“ mit Fahne, Zahlen zählen hoch, Konfetti dahinter bei Note 1–2 (Bedingung wie bisher). Beschriftung „Serie“ beim Probetest, „Streak“ sonst (je Fragment). | 29.09.2026 |
| Konfetti | überall als gerahmte Pastell-Plättchen im 8-fps-Takt (wie 7.16), nach 3 s weg — Anlässe wie bisher. | 29.09.2026 |
| 4.7–4.10 Aussprache | runder Knopf mit Mikrofon, Zustand als Text darunter („Tippen und sprechen“, „Ich höre zu…“, „Richtig!“, „Das klang anders“, dazu „Nochmal“/„Bereite vor…“ ohne Emoji), Kasten „Gehört“ mit dem erkannten Wort; Meldungen (Mikrofon verweigert, lädt …) stehen im selben Kasten ohne „Gehört“. Kein Warte-Kasten bei Aussprache. Nach der Antwort bleibt die Rückmeldung mit „Weiter“ (4.9/4.10 zeigen keine). | 29.09.2026 |
| 4.8 Pegel | bis F-21 entschieden ist, der heutige Visualizer (nur beim Zuhören sichtbar) statt der 9 Balken — daher ist die Karte 37 px höher als 4.8. | 29.09.2026 |
| 4.11 / F-18 | Die Selbstbewertung erscheint wie heute nur, wenn die Erkennung nichts verstanden hat (= Option B aus F-18); gebaut ist das Aussehen aus 4.11 samt Vondu-Hinweis. Abstand Karte–Hinweis 12 px (im Fragment 0). | 29.09.2026 |
| 5.3 Deck-Karte | nach 5.3 (Nachtrag) in der einklappbaren Außenkarte aus 5.1 (F-50) — daher 32 px schmaler, senkrecht deckungsgleich. „Formen wählen“ nach dem Zurücksetzen mit den Kacheln aus 5.4. | 29.09.2026 |
| 5.4/5.12 Dialoge | senkrecht mittig wie alle Dialoge (Entwurf: oben bei 52 bzw. 70 px), Liste scrollt. Stufe A1 mint, A2 pfirsich, ab B1 rosa (wie Schwierigkeit in 3.2; B2/C1 zeigt der Entwurf nicht). Hinweis nur „Anlegen erst bei genau 10“ — „+ 3 weitere Verben“ im Fragment bezieht sich auf die gekürzte Liste. Belegte Verben: Stufen-Chip „vergeben“, Zeile blass. „Abbrechen“ voll deckend (im Fragment wie „Anlegen“ blass). | 29.09.2026 |
| 5.5 Statistik | wie 5.5 für beide Formen; bei nur einer Form eine Formen-Spalte. Prozent wie bisher aus gemeisterten Verben. | 29.09.2026 |
| 5.1 Stationskarte | Kopf „Stahl-Dolch“ + „Simple Past“ (wechselt beim Wischen auf Gold/Past Participle), Rahmen 176 + Rahmen, Pfeile zur Rahmenmitte, Schritt-Zeile mit Pixel-Symbol, Balken mit Rahmen, Punkte, Chip „Wörter anzeigen“. Auftragsname und Stern entfallen (der Titel trägt das Objekt), rechts oben bleibt Löschen statt „i“ (F-08/F-09). „Werkstoff wählen“ und „Noch nicht begonnen“ warten auf F-08. | 29.09.2026 |
| 9.3–9.6 | Musik-Knopf 52 + Rahmen unten rechts (24 px), aus Papier, an Flieder, immer die Note. Speichern-Pille und Toast 52 px unter der Oberkante, Hinweis unten mit Wolke; bei Zeitüberschreitung Text aus 9.4, bei Fehler „Im Hintergrund gespeichert“. Zurück-Hinweis „Zum Schließen erneut zurück“ im Toast-Aussehen (ohne Symbol, 2 s wie bisher). Neuladen: Balken folgt dem Zugweg, Screen rutscht bis 64 px mit, Texte ohne Emoji. 9.1 (allgemeines Vondu-Popup) hat keinen eigenen Einsatzort — die Schmiede-Info ist 5.13 (F-54). | 29.09.2026 |
| 5.6–5.11 Formen-Spiele | Plakette je Form (Simple Past hellblau, Past Participle gold, alle drei flieder), Anweisungen aus den Fragmenten, Vorgabe „wählen → Simple Past“ wie 5.9/5.10 auch bei 5.8/5.11 (bis F-51), Prüfen in Gold mit Haken vorn, kein Warte-Kasten. Lücke (5.10) als Kacheln mit Feld darunter; lange Wörter: Kacheln schrumpfen statt umzubrechen. | 29.09.2026 |
