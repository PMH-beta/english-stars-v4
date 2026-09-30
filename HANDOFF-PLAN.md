# Plan: Pastell-Handoff in die App übernehmen

Angepasster Phasenplan aus `design_handoff_english_stars_pastell/START-HERE.md`,
bezogen auf unsere Dateien. Grundlage: die Entscheidungen in
`HANDOFF-ENTSCHEIDUNGEN.md`. Eine Phase pro Sitzung, nichts vorziehen.

Branch: `refactor-modules`. Remote: `dev` (= english-stars-v4). `origin` ist das
alte Live-Repo und wird nicht angefasst.

## Ausgangspunkt

Das Pastell-Redesign der Oberfläche ist seit Merge `38f3a2e` live. Damit sind
drei Phasen des Handoffs schon erledigt:

| Phase | Stand |
| --- | --- |
| 1 · Grundbausteine (`--p-*`, 2-px-Rahmen, Blatt, Karten, Chips, Buttons, Tabs) | **erledigt** — `src/style.css` ab Zeile 1708, 178 `.p-`-Klassen |
| 2 · Pixel-Icons (`ICON_PAL`, `ICONS`, `icon`, `iconHTML`) | **erledigt** — `src/modules/pixel-icons.js` |
| 7c · App-Icons und Startbilder | **erledigt** — Commit `69c1280`, `appicon/` im neuen Stand unverändert |

Es gibt **keinen Schalter `pastell`** (F-02). Der Rückweg ist `git revert`.

## Reihenfolge

0 → 3 → 4 → 5 → 6 → 7 (Bereiche 1–9) → 7b → 8

| # | Phase | Fasst an | Offene Fragen | Risiko |
| --- | --- | --- | --- | --- |
| **0** | Prüfblatt `dev/sprites.html` | neue Datei; die fünf Module nach `src/modules/` kopiert | — | **fertig** (`6708961`) |
| **3** | Gegner | `pixel-enemies.js` → `pixel-enemies-dungeon.js`; Kampfrichtung in `campaign-fight.js` | — | **fertig** |
| **4** | Figur & Gefährte | `avatar.js`, neu `hero.js`, `campaign-fight.js`, `campaign-equipment.js`, `style.css`, `sw.js` | — | **fertig** |
| **5** | Gegenstände, Kampfplätze, Lagerfeuer | neu `world.js`; `campaign-fight.js`, `campaign-equipment.js`, `ui.js`, `campaign.js`, `style.css` | — | **fertig** |
| **6** | Kampf-Animationen | `campaign-fight.js`, `hero.js`, `style.css` | — | **fertig** |
| **7** | Screens, ein Commit je Bereich | `index.html`, `ui.js`, `decks.js`, `vocab.js`, `game.js`, `campaign*.js`, `style.css` | alle beantwortet (29.09.) | gering je Bereich |
| **7b** | App-Tour | neu `tour.js`, dazu `ui.js`, `storage.js`, `sync.js` | F-14 = A (automatisch + Profil-Knopf) | `tourSeen` muss in die sync-Whitelist |
| **8** | Aufräumen | alte SVG-Renderer, alter CSS-Block (~1000 Zeilen) | Freigabe | hoch — erst zum Schluss |

## Wie die Prüfseite erreichbar ist

Die App wird **aus dem Repo-Wurzelverzeichnis** ausgeliefert, nicht aus `dist/`
(`.nojekyll` im Root, `PRECACHE` in `sw.js` zeigt auf `./src/modules/*.js`).
`dev/sprites.html` ist damit ohne Zutun unter `/dev/sprites.html` erreichbar —
im Dev-Server wie auf der veröffentlichten Seite. `vite.config.js` musste dafür
nicht angefasst werden. `npm run build` schreibt weiterhin nur `dist/`, was für
die Auslieferung keine Rolle spielt.

## Phase 7 — läuft

Alle Screens ohne offene Frage sind gebaut (Commits je Bereich, zuletzt
`922b542`). Am 29.09.2026 hat der Nutzer alle 43 offenen Fragen beantwortet
(`HANDOFF-ENTSCHEIDUNGEN.md`). Daraus ist noch zu bauen:

| Bereich | Umsetzung der Antworten |
| --- | --- |
| 8 · Profil | **fertig:** F-25 Freund-Ansicht ohne Wortlisten und ohne Hinweis (Code bleibt) · F-57 Antippen = anlegen, Kachel zeigt neuen Wert + Chip mit der Änderung |
| 2 · Menü | **fertig:** F-29 Rückfrage vor dem Schnellmodus (2.10) · F-30 keine Taler im Schnellmodus · F-31 Menü im Schnellmodus nur Aussehen (Chip im Banner, schlanke Karten) |
| 4 · Üben | **fertig:** F-45 Schnellmodus im Spiel (Chip + Hinweis) · F-46 Knopf „Los“ · F-47 Probetest ohne laufende Note · F-48 „Nochmal versuchen“ nach falscher Aussprache · F-21 Mikrofon-Ringe am echten Pegel |
| 3 · Verwalten | **fertig:** F-40 „Neu scannen“ · F-41 „+ Wort manuell ergänzen“ · F-42 Kopfzeile „N erkannt“ (Dubletten grau) · F-44 Zurück = Abbrechen im Entwurf |
| 5 · Formen | F-08 Raster „Noch nicht begonnen“ mit „Wörter befüllen“, ohne Löschen · F-09 „i“ je Objekt (5.2) · F-54 Info 5.13 mit Punkt 4 „Verzaubern ist eines der 5 Teile und kommt nie vor dem dritten.“ |
| 6/7 · Kampagne | **fertig:** F-33 Schatz: auswählen + „Nehmen“ · F-34 Zeittrank-Text = Regel · F-35 Boss: „Zur Kampagne“ + Taler-Chip · F-36 Wellen-Chip weg |
| 9 · Überall | F-20 Installier-Popup beim 3. Start (Zähler lokal) |
| 1/8 · Charakter-Editor | F-15 7 Reiter (Profil 8) · F-16 „Speichern“, Zurück verwirft, Rückfrage 8.12 — Screens 1.9/1.10, 8.4–8.12 |

Unverändert (Antwort „wie heute“): F-17, F-18, F-19, F-26, F-28, F-32, F-37,
F-38, F-39, F-43, F-49, F-50, F-51, F-52, F-53, F-55, F-56, F-58.

**Abnahme je Screen:** Referenz-DOM und App-DOM werden vermessen und abgeglichen
(headless Chrome). Die Referenz rechnet ohne `box-sizing` — im CSS stehen
Außenmaße (Fragmentwert + Rahmen).

Die Screens nach `SCREENS.md`, Bereich 1 bis 9, ein Commit je Bereich. Jeder
Screen wie sein Fragment: Aufbau, Texte, Abstände, Farben, Icons.
UI-Animationen mit `createUiAnimator({ icon, idleFrames })` aus `ui-anim.js` am
gemeinsamen 8-fps-Takt. Den Charakter-Editor (1.9, 1.10, 8.4–8.10) nach
„Charakter-Editor" in START-HERE.

Danach 7b (App-Tour, F-14) und zuletzt 8 (Aufräumen, nur mit Freigabe).

## Was in jeder Phase gilt

- Vor einer Funktionsänderung anhalten und im Format `F-nn` fragen
  (`CLAUDE-REGELN.md`, Abschnitt 2). Antwort hier und in
  `HANDOFF-ENTSCHEIDUNGEN.md` eintragen.
- Module unverändert lassen, Anbindung und Caching in eigene Dateien.
- Nach jedem Bereich committen, am Ende `npm run build`.
- Abschlussbericht: fertig · wo und wie prüfen · Abweichungen · offene Fragen ·
  nächste Phase.
