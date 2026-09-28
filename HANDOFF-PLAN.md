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
| **5** | Gegenstände, Kampfplätze, Lagerfeuer | `pixel-items.js`, `campaign-fight.js`, `campaign-equipment.js`, Schmiede in `ui.js` | F-06, F-10 | mittel |
| **6** | Kampf-Animationen | `campaign-fight.js` | F-12, F-13 | mittel — Treffer-Timing wandert in `onHit` |
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

## Phase 5 — als Nächstes

Gegenstände, Kampfplätze und Lagerfeuer aus `pixel-world-fine.js`: Schmiede mit
5 Teilen (`PART_NAMES`, `partStates`, `itemPartsCanvasTrimmed`), Profil-Slots,
`ARENAS` im Kampf, Rastplatz mit `CAMPFIRE_FRAMES` (8 fps). Nie `opacity` oder
`grayscale`.

**Vorher beantworten: F-06** (Stufe „verzaubert" hat kein Bild) und **F-10**
(welcher der 6 Kampfplätze wann erscheint).

F-22 (Canvas statt SVG) ist mit Phase 4 entschieden: die Figur läuft über
Canvas, und der Maßstab wird am Container gemessen, damit er ganzzahlig bleibt.

## Was in jeder Phase gilt

- Vor einer Funktionsänderung anhalten und im Format `F-nn` fragen
  (`CLAUDE-REGELN.md`, Abschnitt 2). Antwort hier und in
  `HANDOFF-ENTSCHEIDUNGEN.md` eintragen.
- Module unverändert lassen, Anbindung und Caching in eigene Dateien.
- Nach jedem Bereich committen, am Ende `npm run build`.
- Abschlussbericht: fertig · wo und wie prüfen · Abweichungen · offene Fragen ·
  nächste Phase.
