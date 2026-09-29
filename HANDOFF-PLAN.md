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
| **7** | Screens, ein Commit je Bereich | `index.html`, `ui.js`, `decks.js`, `vocab.js`, `game.js`, `campaign*.js`, `style.css` | F-08, F-09, F-15–F-21, F-25 | gering je Bereich |
| **7b** | App-Tour | neu `tour.js`, dazu `ui.js`, `storage.js`, `sync.js` | F-14 | `tourSeen` muss in die sync-Whitelist |
| **8** | Aufräumen | alte SVG-Renderer, alter CSS-Block (~1000 Zeilen) | Freigabe | hoch — erst zum Schluss |

## Wie die Prüfseite erreichbar ist

Die App wird **aus dem Repo-Wurzelverzeichnis** ausgeliefert, nicht aus `dist/`
(`.nojekyll` im Root, `PRECACHE` in `sw.js` zeigt auf `./src/modules/*.js`).
`dev/sprites.html` ist damit ohne Zutun unter `/dev/sprites.html` erreichbar —
im Dev-Server wie auf der veröffentlichten Seite. `vite.config.js` musste dafür
nicht angefasst werden. `npm run build` schreibt weiterhin nur `dist/`, was für
die Auslieferung keine Rolle spielt.

## Phase 7 — läuft

| Bereich | Stand |
| --- | --- |
| 2 · Hauptmenü | 2.1–2.9 und 2.12 fertig (`d6f12e0`, `cf916b7`). Offen: 2.5 Ausblenden beim Sortieren (F-28), 2.10/2.11 Schnellmodus (F-29–F-31), Versionsnummer (F-32). |
| 6 · Kampagne | 6.1–6.7 fertig (`358143b`). Offen: 6.6 „Nehmen“ (F-33), Zeittrank-Text (F-34); 6.8 Schutz-Meldungen kommen mit Bereich 7. |
| 7 · Kampf | 7.4–7.17 fertig (`473fe97`), dazu 6.8 Schutz-Meldungen. Offen: F-35, F-36. |
| 1 · Start & Anmeldung | 1.1–1.8 fertig (`0adb484`, `0d76958`). Offen: 1.5 „Erneut senden“ (F-37), 1.1 Reihenfolge (F-38); 1.9/1.10 hängen an F-15. |
| 3 · Verwalten | 3.1–3.5 und 3.7 fertig, dazu die Statistik-Seiten aus dem Menü und die drei Dialoge des Ablaufs. 3.6 nur Kopf, Karten und Knöpfe — Zeilen, „Neu scannen“, „+ Wort manuell ergänzen“ und die Kopfzeile hängen an F-39–F-42. Offen außerdem F-17 (3.5 nie gezeigt), F-43 (Liste unter „Hinzufügen“), F-44 (Zurück im Entwurf). |
| 4 · Üben | 4.1–4.14 fertig (`7b0e77d`, `393cd9c`). Offen: F-45 (Schnellmodus im Spiel), F-46 („Los“ statt 2 s), F-47 (Probetest-Zeile), F-48 („Nochmal versuchen“), F-49 (Mikrofon bei Selbstbewertung), Pegel F-21. |
| 5 · Formen | Trainingsplatz 5.1/5.3–5.5, Befüllen 5.12 (`de60118`), Spiele 5.6–5.11 (`e2b4c07`), Stationskarte 5.1. Offen: F-08 („Wörter befüllen“, Raster „Noch nicht begonnen“, kein Löschen), F-09 (Info je Station, 5.2), F-50 (Einklappen), F-51 (Grundform als Vorgabe), F-52 (Durchstreichen), F-53 (Tipp-Knopf), F-54 (Info-Text 5.13); F-19 neu bewertet (beide Spielformen gibt es). |
| 8, 9 | warten auf die Fragen je Bereich |

**Abnahme je Screen:** Referenz-DOM und App-DOM werden vermessen und abgeglichen
(headless Chrome). Die Referenz rechnet ohne `box-sizing` — im CSS stehen
Außenmaße (Fragmentwert + Rahmen).

Die Screens nach `SCREENS.md`, Bereich 1 bis 9, ein Commit je Bereich. Jeder
Screen wie sein Fragment: Aufbau, Texte, Abstände, Farben, Icons.
UI-Animationen mit `createUiAnimator({ icon, idleFrames })` aus `ui-anim.js` am
gemeinsamen 8-fps-Takt. Den Charakter-Editor (1.9, 1.10, 8.4–8.10) nach
„Charakter-Editor" in START-HERE.

**Offene Fragen je Bereich:** F-08 (Schmiede: „Wörter befüllen", Löschen
entfällt) · F-09 (Info-Knopf je Station) · F-15 (7 Reiter beim ersten Start) ·
F-16 (Zurück verwirft, Rückfrage 8.12) · F-17 (Scan ohne Key) · F-18
(Selbstbewertung) · F-19 (5.7 und 5.10) · F-20 („App installieren" beim
3. Start) · F-21 (Mikrofon-Pegel) · F-25 (Freund-Fortschritt).

Danach 7b (App-Tour, F-14) und zuletzt 8 (Aufräumen, nur mit Freigabe).

## Was in jeder Phase gilt

- Vor einer Funktionsänderung anhalten und im Format `F-nn` fragen
  (`CLAUDE-REGELN.md`, Abschnitt 2). Antwort hier und in
  `HANDOFF-ENTSCHEIDUNGEN.md` eintragen.
- Module unverändert lassen, Anbindung und Caching in eigene Dateien.
- Nach jedem Bereich committen, am Ende `npm run build`.
- Abschlussbericht: fertig · wo und wie prüfen · Abweichungen · offene Fragen ·
  nächste Phase.
