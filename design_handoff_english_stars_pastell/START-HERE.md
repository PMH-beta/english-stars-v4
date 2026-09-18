# START HERE — Übergabe an Claude Code

Dieses Verzeichnis ist das komplette Designpaket für das Pastell-Redesign von **English Stars**.
Es ist so gebaut, dass Claude Code allein damit arbeiten kann.

## 1. Ablegen

Den ganzen Ordner **ins Repo der App** legen, auf gleicher Höhe wie `src/`:

```
english-stars/
├── src/
├── index.html
├── manifest.json
└── design_handoff_english_stars_pastell/   ← dieser Ordner
```

Dann `git add` + commit, bevor irgendwas geändert wird — so ist der Ausgangszustand gesichert
und jeder Umbauschritt bleibt im Diff nachvollziehbar.

## 2. Erster Prompt

```
Lies design_handoff_english_stars_pastell/START-HERE.md und danach README.md
im gleichen Ordner. Verschaffe dir einen Überblick über die bestehende Codebase
(src/style.css, src/modules/*.js, index.html) und sag mir dann, in welcher
Reihenfolge du das Redesign umsetzen würdest. Noch nichts ändern.
```

Claude Code liest dann von selbst weiter. Wichtig: **erst planen lassen, dann bauen** — die
Codebase hat 1728 Zeilen CSS, ein Blindflug durch alle Screens auf einmal geht schief.

## 3. Reihenfolge, die sich bewährt

Ein Prompt pro Schritt, nach jedem Schritt im Browser anschauen und committen.

| # | Schritt | Prompt-Kern |
| --- | --- | --- |
| 1 | **Tokens** | Die Farb-, Typo-, Radien- und Rahmenwerte aus README.md als CSS-Variablen in `:root` anlegen. Noch keine Screens anfassen. |
| 2 | **Icon-Engine** | `ICON_PAL()`, `ICONS()`, `icon()`, `weapon()`, `enemy()`, `arena()` aus der Logik-Klasse von `English Stars UI Pastell.dc.html` in ein eigenes Modul `src/modules/pixel-icons.js` übernehmen. Die Skalierungsregel beachten: nur Vielfache von 14 px. |
| 3 | **Bausteine** | Blatt, Karte, Chip, Button, Fortschrittsbalken, Zurück-Knopf, Tab-Leiste als wiederverwendbare Klassen bauen. |
| 4 | **Hauptmenü** | Die drei Tabs: Vokabeln (zu und offen), Kampagne, Formen. |
| 5 | **Spielmodi** | Vokabeln, Rechtschreibung, Aussprache, Formen, Treffer-Feedback. |
| 6 | **Auth & Start** | Startbildschirm, Anmelden, Registrieren, Name, Passwort-Kette. |
| 7 | **Profil** | Profil, Charakter, Gefährte, Fortschritt. |
| 8 | **Kampf & Schmiede** | Kampfansicht, Sieg, Rundenende, Schmiede. |
| 9 | **Overlays** | Info-Popup, Bestätigungsdialoge. |
| 10 | **Icons & PWA** | `appicon/` einbauen — siehe `appicon/README.md`. |

## 4. Wie man Claude Code auf einen Screen zeigt

Jeder Screen steht in `English Stars UI Pastell.dc.html` in einem eigenen `<div class="dv-opt">`
mit einem Label darüber. Das Label ist der Referenzname:

```
Baue den Screen "Hauptmenü · Vokabeln, Sammlung offen" nach.
Das Markup steht in design_handoff_english_stars_pastell/English Stars UI Pastell.dc.html
im dv-opt-Block mit genau diesem Label.
Der Screenshot des heutigen Zustands liegt in
design_handoff_english_stars_pastell/ref/menue-sammlung-offen.png.
Feldreihenfolge und Inhalte vom Screenshot übernehmen, Aussehen vom Prototyp.
```

Die 32 Labels stehen vollständig im README unter „Screens / Views".

## 5. Was man Claude Code mitgeben sollte

Diese vier Regeln am besten gleich in die `CLAUDE.md` des Repos schreiben, dann gelten sie in
jeder Sitzung:

```markdown
## Design-Regeln (Pastell-Redesign)
- Jedes Element hat `border: 2px solid #1F1F24`. Gestrichelt = leer oder noch nicht
  verdient, gepunktet = Trennlinie innerhalb einer Karte.
- Keine Schatten außer dem harten `6px 8px 0` an der angehobenen Sammlungskarte.
  Tiefe kommt allein aus der Kontur.
- Pixel-Icons nur in ganzzahligen Vielfachen von 14 px anzeigen (14/28/42/56)
  und niemals um andere Winkel als 90° drehen.
- Sibling-Gruppen immer mit flex/grid + gap, nie mit Margins pro Element.
- Emoji bleiben ausschließlich bei Charakter, Gefährte und Profilbild.
  Alles andere ist Pixel-Art.
```

## 6. Was im Paket liegt

| | |
| --- | --- |
| `README.md` | **Die Spezifikation.** Tokens, Bausteine, alle 32 Screens, Verhalten, State |
| `English Stars UI Pastell.dc.html` | Der Prototyp — exaktes Markup jedes Screens + komplette Icon-Engine |
| `support.js` | Runtime, damit die HTML-Datei im Browser öffnet. Kein Teil des Designs |
| `appicon/` | 47 Dateien: iOS, Android, Web/PWA, Startbilder, `manifest.json`, `head-snippet.html` — mit eigener `README.md` |
| `ref/` | 26 Screenshots des heutigen Zustands — Referenz für Inhalte und Feldreihenfolge |
| `tokens.json` | Tokens der bestehenden App, Ausgangszustand zum Abgleich |
| `DESIGN.md` | Original-Screen- und Bausteinliste |

## 7. Den Prototyp selbst anschauen

`English Stars UI Pastell.dc.html` im Browser öffnen — die Datei ist eigenständig, alle 32
Screens liegen untereinander. Beim Nachbau lohnt es sich, sie in einem zweiten Fenster offen zu
haben.
