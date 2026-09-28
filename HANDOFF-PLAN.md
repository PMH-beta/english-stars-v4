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
| **0** | Prüfblatt `dev/sprites.html` | neue Datei; die vier Module nach `src/modules/` kopieren | — | keins |
| **3** | Gegner | `pixel-enemies.js` → `pixel-enemies-dungeon.js`; Kampfrichtung in `campaign-fight.js` | F-11 | gering |
| **4** | Figur & Gefährte | `avatar.js`, `storage.js`, `sync.js`, `ui.js`, `campaign-equipment.js` | F-03, F-04, F-05, F-07 | Speicherstand (Avatare entbehrlich, **Decks unantastbar**) |
| **5** | Gegenstände, Kampfplätze, Lagerfeuer | `pixel-items.js`, `campaign-fight.js`, `campaign-equipment.js`, Schmiede in `ui.js` | F-06, F-10, F-22 | mittel |
| **6** | Kampf-Animationen | `campaign-fight.js` | F-12, F-13 | mittel — Treffer-Timing wandert in `onHit` |
| **7** | Screens, ein Commit je Bereich | `index.html`, `ui.js`, `decks.js`, `vocab.js`, `game.js`, `campaign*.js`, `style.css` | F-08, F-09, F-15–F-21, F-25 | gering je Bereich |
| **7b** | App-Tour | neu `tour.js`, dazu `ui.js`, `storage.js`, `sync.js` | F-14 | `tourSeen` muss in die sync-Whitelist |
| **8** | Aufräumen | alte SVG-Renderer, alter CSS-Block (~1000 Zeilen) | Freigabe | hoch — erst zum Schluss |

## Phase 0 — als Nächstes

1. `pixel-hero-fine.js`, `pixel-enemies-dungeon.js`, `pixel-world-fine.js`,
   `pixel-anim.js`, `ui-anim.js` unverändert nach `src/modules/` kopieren
   (nicht umformatieren, keine Pixeldaten anfassen).
2. `dev/sprites.html` anlegen, im Build erreichbar (F-24), mit:
   36 Gegner vorn und in Kampfrichtung · 10 Vorlagen · 20 Frisuren ·
   20 Gefährten, auch als Silhouette · 8 Waffen in der Hand · alle Gegenstände
   in Stahl und Gold · 6 Kampfplätze · Lagerfeuer · alle sechs Abläufe
   (Stehen, Angriff, Treffer, Sieg, Niederlage, K.O.) für Held, alle 36 Gegner
   und alle 20 Gefährten · Bogen-Angriff in Schleife.
3. `npm run build`, dann auf dem Handy `/dev/sprites.html` anschauen.

Die Seite ist ab dann die Sichtprüfung für jede weitere Phase.

## Was in jeder Phase gilt

- Vor einer Funktionsänderung anhalten und im Format `F-nn` fragen
  (`CLAUDE-REGELN.md`, Abschnitt 2). Antwort hier und in
  `HANDOFF-ENTSCHEIDUNGEN.md` eintragen.
- Module unverändert lassen, Anbindung und Caching in eigene Dateien.
- Nach jedem Bereich committen, am Ende `npm run build`.
- Abschlussbericht: fertig · wo und wie prüfen · Abweichungen · offene Fragen ·
  nächste Phase.
