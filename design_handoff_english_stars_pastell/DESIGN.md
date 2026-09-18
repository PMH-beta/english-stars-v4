# English Stars — UI-Inventar

Bestandsaufnahme für die Anbindung an Claude Design.
Stand: **v4.0.365** (letzter Commit 909214b, 08.08.2026) · erstellt 03.09.2026
Quellen: `index.html`, `src/main.js`, `src/modules/*.js` (29 Module, 15.488 Zeilen), `src/style.css` (1.728 Zeilen).

> **Wie die UI entsteht:** Es gibt keine Komponenten und kein Framework. Die 16 Screens
> stehen als leere `<div>`-Hüllen in `index.html`; alles darin wird zur Laufzeit per
> `innerHTML`-Template-Strings aus den Modulen erzeugt. Ein Teil der Optik steht als
> CSS-Klasse in `style.css`, ein großer Teil als Inline-`style=""` im JS.
> Ein „Baustein" ist deshalb hier immer: **CSS-Klasse + die Stelle, die sie erzeugt.**

---

## 1. Screens und Navigation

### 1.1 Der Router

`showScreen(id)` in `src/modules/ui.js:31` ist die einzige Navigation: Es blendet **alle**
16 Screens aus (`display:none`) und den gewünschten als `display:flex` ein. Es gibt keine
Routen, keine URLs, keinen History-Stack im klassischen Sinn — nur einen `pushState`-Wächter
für den Android-Zurück-Button.

Nebenwirkungen bei jedem Screenwechsel (alle in `showScreen`):
- `body.in-game` an/aus (steuert Musik-Buttons, Fortschrittsleiste, PWA-Knopf)
- `body.schnell-active` an/aus (Dark-Theme; **nie** auf Profil und Fortschritt)
- Footer-Leiste nur im Menü sichtbar, PWA-Install-Knopf nur im Menü
- Mikrofon/Vosk werden freigegeben, wenn man das Spiel verlässt
- `es_last_screen` merkt Menü/Profil/Fortschritt für den Relaunch

### 1.2 Die 16 Screens

| # | ID | Titel in der App | Zweck | Container-Breite |
|---|---|---|---|---|
| 1 | `loading-screen` | ⭐ English Stars | Ladebildschirm mit Status + Hinweistext | 540px |
| 2 | `auth-screen` | Anmelden / Registrieren | E-Mail+Passwort, Google-Button, „Passwort vergessen" | `.screen` 580px |
| 3 | `email-confirm-screen` | Postfach prüfen | nach Registrierung, „Erneut senden" | `.screen` |
| 4 | `password-reset-screen` | Passwort zurücksetzen | E-Mail-Eingabe | `.screen` |
| 5 | `password-reset-sent-screen` | Mail ist raus! | reine Bestätigung | `.screen` |
| 6 | `new-password-screen` | Neues Passwort | zwei Passwortfelder | `.screen` |
| 7 | `apikey-screen` | Kein Key nötig! | Rest-Screen, nur noch „Los geht's" | `.screen` |
| 8 | `name-screen` | Wie heißt du? | Namenseingabe beim ersten Start | `.screen` |
| 9 | `menu-screen` | ⭐ English Stars | **Hauptmenü**, 3 Modus-Tabs | 580px |
| 10 | `game-screen` | — | **Spiel** (alle Lernmodi) | 640px |
| 11 | `end-screen` | Super! / … | Rundenende: Sterne, Punkte, Statistik | `.screen` |
| 12 | `profile-screen` | 👤 Profil | Avatar, Ausrüstung (Paperdoll), Freunde, Cloud | 540px |
| 13 | `character-screen` | 🎨 Charakter | Charakter-Editor + Onboarding-Variante | 540px |
| 14 | `stats-screen` | 📊 Fortschritt | Statistik über alle Sammlungen, auch für Freunde | 540px |
| 15 | `scan-screen` | — | Vokabel-Manager: Tabs, Liste, Scannen, Vorlagen | 580px |
| 16 | `review-screen` | — | gescannte Vokabeln prüfen/korrigieren | 580px |

Dazu kommt `#init-overlay` (in `index.html`, z-index 9999): steht **vor** dem Boot,
zeigt Logo + rotierenden Ring und wird von `startup.js` entfernt.

### 1.3 Navigationswege

```
Boot → init-overlay → loading-screen
                          ├─(nicht eingeloggt)→ auth-screen ⇄ password-reset ⇄ …-sent
                          │                        └→ email-confirm-screen
                          └─(eingeloggt)────→ [kein Name?] → name-screen
                                                   └→ [kein Charakter?] → character-screen (Onboarding)
                                                          └→ menu-screen
menu-screen ──📊 Fortschritt──→ stats-screen ──(Freund)──→ stats-screen im Freund-Modus
       │
       ├──Spielerbanner──→ profile-screen ──✏️-Badge──→ character-screen
       │                        └── Ausrüstung (Paperdoll, im Screen)
       │
       ├─ Tab „📚 Vokabeln"     → Deck-Karte aufklappen → 3 Modus-Buttons → game-screen → end-screen
       │                          └→ „Vokabeln verwalten" → scan-screen → review-screen
       ├─ Tab „⚒️ Unregelmäßige" → Schmiede + Trainingsplatz → game-screen
       └─ Tab „🗺️ Kampagne"     → Karte → Knoten → #cf-overlay (Kampf, Vollbild)
```

`end-screen` führt über „Nochmal" zurück ins Spiel oder über „Menü" ins Menü.
Der Kampf ist **kein** Screen, sondern ein Overlay über allem (siehe 1.5).

### 1.4 Menü-Tabs (Segmented Control)

Ein `.mode-toggle` mit drei `.mode-btn`, Reihenfolge im DOM: **🗺️ Kampagne · 📚 Vokabeln · ⚒️ Unregelmäßige**.
Default ist „Vokabeln". Der Tab wird in `SD.activeMode` und in Supabase (`profiles.active_mode`)
gespeichert. Jeder Tab füllt einen eigenen Container (`#mode-free`, `#mode-student`, `#mode-campaign`);
es wird nicht neu navigiert, nur umgeschaltet (`setActiveMode` → `renderModeContent`).

### 1.5 Overlay-Ebenen (z-index)

| z-index | Was | Wo erzeugt |
|---|---|---|
| 10002 / 10001 / 10000 | Drag-Ghost beim Ausrüstung-Ziehen (`.pd-drag-ghost`) | `campaign-equipment.js` |
| 9999 | Dialoge `esAlert`/`esConfirm`/`esPrompt`/`esPrompt2`, Befüllen-Popup, Pull-to-Refresh-Pille, Init-Overlay | `dialog.js`, `ui.js`, `index.html` |
| 9998 | `.adv-backdrop` + `.adv-card` (Trank-Wahl am 💎) | `campaign-equipment.js` |
| 9000 | Speicher-Indikator (`withSaving`) | `dialog.js` |
| 8000 | **Kampf-Overlay** `#cf-overlay` (Vollbild) | `campaign-fight.js:378` |
| 1000 | Versions-Badge unten | `index.html` |
| 999 | Konfetti | `style.css` |
| 500 / 499 / 498 | Musik-Knopf, Lautstärke-Popup, Lautstärke-Knopf; PWA-Install | `style.css` |
| 400 | Menü-Footer (Glas-Leiste) | `style.css` |
| 300 | Sticky-Zurück-Button | `style.css` |

Ad-hoc-Overlays mit `rgba(0,0,0,.45)`-Backdrop erzeugen zusätzlich `vocab.js` (6×),
`decks.js` (2×) und `ui.js` (1×) — sie haben **keine** gemeinsame Klasse, jeder Aufruf
setzt seine eigenen Inline-Styles.

### 1.6 Android-Zurück

Ein Back-Layer in `ui.js:116-260` fängt den Hardware-/Gesten-Zurück ab, in vier Stufen:
(1) offenes Overlay schließen → (2) im Spiel: Speichern-Nachfrage → (3) sonst: zurück ins
Menü → (4) im Menü: Toast, zweiter Druck innerhalb ~2 s verlässt die PWA.
Erkennungsmerkmal eines Overlays für Stufe 1: `position:fixed` **und** `z-index:9999`
(oder Klasse `.es-overlay`) — wer ein neues Overlay baut, muss das treffen.

---

## 2. UI-Bausteine

Legende: **Tokens** = tatsächlich per `var(--…)` verwendete Variablen. Alles andere in
den Regeln ist hart codiert (siehe `tokens.json`).

### 2.1 Flächen und Karten

| Baustein | Klasse | Tokens | Zustände |
|---|---|---|---|
| Screen-Karte | `.screen` | `--card`, `--line`, `--shadow` | — (Radius 24px, max 580px) |
| Spielkarte | `.game-card` | `--card`, `--line`, `--yellow/--orange/--pink/--purple/--blue` (Regenbogen-Streifen `::before`) | `.es-press`, `.es-wobble` |
| Deck-Karte (Akkordeon) | `.deck-card` | `--line`, `--shadow`, `--text`, `--purple`, `--pink` | `.expanded`, `.active`, `.deck-type-custom` (grün), `.deck-type-preset` (weiß), `.es-press`, `.es-wobble` |
| Spielerbanner | `.player-banner` | `--line`, `--shadow` | `:hover` (hebt sich 1px) |
| Statistik-Panel | `.stats-panel` | `--line`, `--shadow` | — |
| Kategorie-Kachel | `.cat-card` | `--line`, `--shadow` | — |
| Vorlagen-Zeile | `.preset-row` | `--line` | `.es-press`, `.es-wobble` |
| Kampagnen-Panel | `#mode-campaign` | `--line`, `--shadow`, `--r-lg` | — |

### 2.2 Buttons

| Baustein | Klasse | Varianten / Zustände |
|---|---|---|
| Hauptbutton | `.big-btn` | 8 Farben: `.green .blue .orange .purple .teal .pink .gray .brand` · `.center` · `:hover` (−2px) · `:active` (+3px). Die 3D-Kante ist `box-shadow:0 5px 0 <dunkler>` |
| Antwort-Button | `.choice-btn` | `:hover`, `.correct`, `.wrong`, `:disabled` |
| Absenden | `.submit-btn` | `:hover`, `:active`, `:disabled` (opacity .5) |
| Weiter (im Feedback) | `.next-btn` | erbt Farbe von `.feedback.success` / `.feedback.error` |
| Zurück | `.back-btn` | `.sticky` (klebt beim Scrollen oben) |
| Zurück im Spiel | `.home-btn` | `:hover` |
| Textlink | `.link-btn` | `.accent` |
| Google-Login | `.google-btn` | `:hover` |
| Deck-Aktionen | `.deck-action-btn` | `.danger` (rot) |
| Vorlage an/aus | `.preset-toggle` | `.on` (gefüllt mit Verlauf), `:hover`, `:active` (scale .95) |
| Schnellmodus | `.schnell-btn` | `.on` (orange Verlauf) |
| Musik | `.music-btn`, `.music-btn-global`, `.music-vol-btn` | `.on` (Gold-Verlauf + Puls-Animation), `.active` |
| Mikrofon | `.mic-btn` | `.recording` (rot, pulsiert), `.done-correct` (grün, Feder-Animation), `.done-wrong` (rot, Schüttel-Animation), `:disabled` |
| Segmented Control | `.mode-toggle` / `.mode-btn` | `.active`, `.dark` (Dark-Theme-Variante) |
| Tabs | `.vm-tabs` / `.vm-tab` | `.active`, Zähler-Pille `.vm-count` |

**Globaler Antipp-Effekt (Wackelpudding):** `main.js` hängt an jedes antippbare Element
`.es-press` (drückt sich ein, solange der Finger drauf ist) und beim Loslassen `.es-wobble`
(federt nach). Stärke und Dauer kommen aus der Laufzeit-Variable `--wob`. Breite Flächen
(Deck-Karte, Vorlagen-Zeile, Spielkarte) nutzen die schwächere Kurve `es-wobble-soft`.
`prefers-reduced-motion` schaltet **nur diesen Effekt** ab.

### 2.3 Eingaben und Feedback

| Baustein | Klasse | Zustände |
|---|---|---|
| Standard-Eingabefeld | `.es-input` | `:focus` (lila Rahmen + 4px-Ring), `::placeholder` |
| Fehlerbox | `.es-error` | — (rot, nur ein-/ausgeblendet) |
| Namensfeld | `.name-input` | `:focus` |
| Tipp-Feld im Spiel | `.type-input` | `:focus`, `.correct`, `.wrong`, `.gap` (schmale Variante) |
| Buchstaben-Lücke im Wort | `.gap-cell.gap-input` | `.filled` (Pop-Animation), `.correct`, `.wrong` |
| Feedback-Leiste | `.feedback` | **leer** (zeigt „⌛ Warte auf deine Antwort…" per `::before`), `.show`, `.success`, `.error` |
| Ziehen & Ordnen | `.order-slot`, `.order-tile`, `.order-tray` | `.drop-hover`, `.dragging`, `.correct`, `.wrong`; Variante `.letters` (schmalere Kacheln) |
| Aussprache-Ergebnis | `.pronounce-result` | `.heard` (orange) |
| Lade-Pille | `.analyzing-pill` + `.dot-loader` | 3 hüpfende Punkte |

### 2.4 HUD und Fortschritt

| Baustein | Klasse | Wo |
|---|---|---|
| Punkte/Serie-Pillen | `.score-pill` (`.streak`, `.points`) | Spiel, Kopfzeile |
| Rundenfortschritt | `.progress-wrap` / `.progress-fill` | Spiel, unter der Kopfzeile |
| Modus-Gesamtfortschritt | `.mode-progress` + `-label/-track/-bar/-sub/-pop` | Spiel, unten; nur bei `body.in-game` sichtbar; Balken mit laufendem Verlauf (`gradientFlow`) |
| Mini-Balken in Buttons | `.btn-progress` / `-fill` / `-text` | Modus-Buttons der Deck-Karte |
| Deck-Fortschritt | `.deck-progress-mini` / `-fill` | Deck-Karte |
| Wort-Ampel | `.ws-badge` (`.ws-green/.ws-yellow/.ws-red/.ws-gray`) | Statistik-Tabellen |
| Trefferquote | `.acc-mini` + `.acc-bar-wrap` / `.acc-bar` | Statistik |
| Fehlerpunkte | `.wrong-dots` / `.wrong-dot` | Statistik |
| Wort-Tabelle | `.word-table` | Statistik (Kopfzeile klebt) |
| Endstatistik | `.stat-grid` / `.stat-box` / `.stat-num` / `.stat-label` / `.stars-row` | end-screen |
| Kampf-HUD | `.cf-pill` (dunkles Glas) + Inline-HP-Balken | Kampf-Overlay |

### 2.5 Dialoge und Popups

| Baustein | Wo definiert | Aufbau / Zustände |
|---|---|---|
| `esAlert` / `esConfirm` / `esPrompt` / `esPrompt2` | `dialog.js` (Inline-Styles) | Backdrop `rgba(15,10,30,.55)` + Blur, weiße Karte, optional Icon/Titel/Text/Felder, Button-Reihe. Geben ein Promise zurück. **Ersetzen `window.alert/confirm/prompt` vollständig.** |
| Speicher-Indikator | `dialog.js` (`withSaving`) | schmale Pille oben mit Spinner; im Timeout-Fall Toast „im Hintergrund gespeichert" |
| Trank-Wahl | `.adv-backdrop` / `.adv-card` / `.adv-choice` | 3 Auswahlzeilen mit Icon + Text; `:hover` |
| Befüllen-Popup (Schmiede) | `.uv-fill-overlay` / `-card` / `-head` / `-list` / `-row` / `-foot` | `.sel` (gewählt), `.used` (vergeben, ausgegraut), Slide-Animation beim Formwechsel (`.slide-left/-right`), Formen-Chips `.uv-form-chip` (`.past/.pp/.both` × `.sel`), OK-Button `:disabled` |
| Objekt-Wahl | `.uv-obj-row` | `.sel`, `.taken` |
| Ad-hoc-Overlays | `vocab.js`, `decks.js`, `ui.js` | jeweils eigene Inline-Styles, kein gemeinsamer Baustein |

### 2.6 Kampagne, Kampf, Schmiede, Ausrüstung

| Baustein | Klasse | Zustände |
|---|---|---|
| Kampagnen-Knoten | (Inline in `campaign.js:555`) | erreichbar (oranger 3px-Ring + `campNodeGlow`-Puls), aktuell (lila Ring), besucht (lavendel), gesperrt (grau, opacity .45), Vorschau-Modus |
| Trank-Platz auf der Karte | `.camp-slot` + `.potion-n` | `.empty` (gestrichelt), `:active` (scale .92); gleiche Tränke stapeln mit Zähler |
| Trank im Kampf | `.cf-potion` | `:hover` (Gold-Rand), `:active` |
| Kampf-Kulisse | `.cf-scenery`, `.cf-hills`, `.cf-grass` | statisch |
| Held | `.cf-hero` | Idle (`cfIdleHero`), `.attack` (+ `.av-weapon` schwingt), `.hit` (Aufblinken), `.shake` (Rückstoß), `.cheer` (Sieg), `.down` (Niederlage) |
| Gegner | `.cf-enemy` | `.boss` (größer), Idle (`cfIdleEnemy`, 3 Frames), `.attack`, `.hit`, `.shake`, `.poof` (Auflösen) |
| Treffer-Effekte | `.cf-spark` (Splitter, `--dx/--dy`), `.cf-dmg` (Schadenszahl) | Einweg-Animationen |
| Schmiede-Station | `.forge-station` | `.locked` (opacity .5), `.current` (lila Ring), `.complete` (Goldrand) |
| Werkstück | `.forge-item` (`.past` = Stahl, `.pp` = Gold) | `.done`; Bau-Segmente `.fi-seg` mit `.built` / `.next` (pulsiert) / leer |
| Waffe (Pixel-Art) | `.forge-weapon` / `.fw-weapon` / `.wp` | `.locked`, `.done`; Teile `.ghost` (angedeutet), `.next` (pulsiert), gebaut |
| Schmiede-Schritt | `.forge-step` | `.open`, `.next`, `.done`, `.locked` |
| Paperdoll | `.pd-wrap` / `.pd-avatar` / `.pd-slot` | `.filled`, `.active`, `.drop-ok` (pulsiert beim Ziehen), `.drop-hover` (wächst auf 1.28) |
| Tasche | `.pd-item` | `.sel` (gold), `.empty` (gestrichelt), `.dragging` (blass) |
| Werte-Tabelle | `.pd-stats` / `.pd-stat` | `.chg.up` (grün), `.chg.down` (rot) — Vorschau des angewählten Teils |
| Item-Vorschau | `.pd-preview` + `.pd-equip-btn` | `.off` (rot = ablegen) |
| Sternenpfad (UV, dunkel) | `.star-path`, `.cst-*` | Sterne: `.ghost`, `.locked`, `.play` (pulsiert), `.lit` (gold + ✓), `.complete`; Karte `.cst-flip` → `.flipped` |
| Charakter-Editor | `.cg-grid` / `.cg-tile` / `.cg-fig` / `.cg-featbar` / `.cg-dot` | `.sel`, `.locked` (grau, gesperrt), `.active` |

### 2.7 Themes

Es gibt **ein** helles Grunddesign und **einen** Dark-Modus:

- **Hell (Standard):** `--bg #f4f1fc` mit drei radialen Farbwolken, weiße Karten, lila Marke.
- **Dark (`body.schnell-active`):** wird **nur** vom Schnellmodus (Wiederholen) gesetzt,
  überschreibt `--bg/--card/--text/--line/--shadow` und färbt zusätzlich ~40 fest
  verdrahtete helle Flächen um (`style.css:56-135`). Profil und Fortschritt bleiben
  bewusst hell, JS-Dialoge ebenfalls.
- **Abenteuer-Palette** (`--adv-*`): war als drittes, dunkles Panel-Theme gedacht;
  davon lebt heute nur noch die Trank-Kachel im Kampf. 5 der 8 Variablen sind tot
  (siehe `tokens.json`), die Kampfszene ist stattdessen hell/Taghimmel.

---

## 3. Stand der Kampf-Modi

Alles in `campaign-fight.js` (926 Zeilen), Zahlen in `campaign-balance.js`.
Zuletzt bearbeitet in der Nacht 07./08.08.2026 (4 Commits), **auf dem Gerät noch nicht getestet**.

### 3.1 Struktur

Ein Kampf = ein Gegner mit HP. Wellen sind **unbegrenzt**; pro Welle läuft **ein Minispiel**.
Gewonnene Welle → Waffenschaden am Gegner. Verlorene Welle → der Gegner schlägt zu.
Ende bei Gegner-HP 0 (Sieg) oder Spieler-HP 0 (Tod, Lauf vorbei).

**Grundregel (seit 08.08.):** Ein Fehler beendet ein Minispiel nie. Jeder Fehlgriff kostet
`STORM_MISS_DMG = 6` HP, die falsche Option verschwindet und das Spiel läuft weiter.
Eine Welle verliert man **nur durch Zeitablauf** (bzw. wenn der richtige Meteor einschlägt).

### 3.2 Die sieben Wellen-Typen

| Typ | Interner Name | Aufgabe | Zeit | Module |
|---|---|---|---|---|
| Buchstabensturm | `storm` | Wort aus treibenden Buchstaben zusammensetzen | 20 s + 2 s je Buchstabe ab dem 6. | `minigame-letterstorm.js` |
| Wort-Meteoriten | `meteors` | richtige Übersetzung von 4 fallenden Meteoren treffen | Fallzeit 9 s | `minigame-meteors.js` |
| Echo-Fang | `echo` | gehörtes Wort aus 5 Optionen wählen (braucht TTS) | 15 s | `minigame-echo.js` |
| Stimmt das? | `truefalse` | **3 Wortpaare** nacheinander als richtig/falsch beurteilen | 17 s für alle Paare zusammen | `minigame-truefalse.js` |
| Wirbelsturm (Formen) | `verbstorm` | Simple Past / Past Participle schreiben | wie Sturm | `minigame-letterstorm.js` |
| Formen-Meteoriten | `verbmeteors` | richtige Verbform treffen | 9 s | `minigame-meteors.js` |
| Formen-Echo | `verbecho` | gehörte Verbform wählen | 15 s | `minigame-echo.js` |

**Welche Welle wann:**
- ⚔️ Übung → zufällig aus `storm` / `meteors` / `echo` / `truefalse`
- 🌀 Unregelmäßige → zufällig aus den drei Formen-Varianten (nur wenn Sternbild-Verben befüllt sind)
- 👑 Boss → alles gemischt
- Fallbacks: zu wenig Wörter → nur Sturm; kein `speechSynthesis` → kein Echo

### 3.3 Gegner und Balancing

| Knoten | Gegner | HP | Schaden | Skalierung |
|---|---|---|---|---|
| ⚔️ `fight` | 👾 Wortgeist | 22 | 9 | +15 % HP/Schaden pro abgeschlossener Runde |
| 🌀 `irregular` | 🌀 Gestaltwandler | 36 | 11 | dito |
| 👑 `boss` | 🐉 Boss | 58 | 16 | dito |

Spieler: 60 HP pro Lauf, Rastplatz heilt 15. Waffenschaden: Faust 4, geschmiedete Waffe
3 + fertige Teile (Gold +2), Formen-Bonus +2 auf die passende Formen-Welle.

### 3.4 Wortauswahl

Der Kampf führt einen **eigenen** Lernstand je Wort (Stat-Suffix `_cf`), getrennt von den
Vokabel-Stats — er beeinflusst weder Taler noch Deck-Prozente noch die Statistik-Seiten.
Im Vorrat stehen immer 20 offene Wörter: eigene Deck-Wörter zuerst (erst ab 2× geübt),
Vorlagen füllen auf. Ein gelerntes Wort wird 1:1 nachbesetzt.

**Offene Abhängigkeit:** `backend/preset-categories-60.sql` muss noch im Supabase-Dashboard
ausgeführt werden — sonst stehen nur 31 statt 60 Vorlagen-Sammlungen als Nachschub bereit.

---

## 4. Leveldesign und Gegner

### 4.1 Was existiert

**Kampfkulisse** (`campaign-fight.js:323-372`, prozedural als SVG erzeugt, `shape-rendering:crispEdges`):
- Pixel-Taghimmel mit Verlauf, Sonne mit Korona, zwei Wolkenebenen, zwei Vögel, harte Lichtstreifen
- Hügel-Parallax in **3 Ebenen** (hinten blaugrau/flach → vorne hellgrün/hoch), immer an der Rasenkante verankert
- Rasen als CSS-Fläche mit eingebetteter 8×8-Pixel-Textur (`image-rendering:pixelated`) und heller Grasnarbe an der Oberkante

**Gegner** (`pixel-enemies.js`, 185 Zeilen, ebenfalls prozedural):
- 3 Typen mit je 2–3 Silhouetten-Varianten und 2–3 Farbpaletten → **8 Farbwelten insgesamt**
  (Glut-Orange, Rubinrot, Sumpfgrün / Frostcyan, Violettschimmer / Feuerkönig, Schattenfürst, Tiefenschrecken)
- Abstands-Schattierung (außen dunkel → innen Glut → heißer Kern unten), ein mandelförmiges Auge,
  per Dithering in den Boden auslaufender Fuß, bewusst **keine** Outline — Gegenentwurf zum Helden
- Raster: Wortgeist 40×40, Gestaltwandler 44×48, Boss 64×60 (Anzeige 142/142/192 px)

**Held**: Avatar-Sprite aus `avatar.js` (64×96) inklusive angelegter Ausrüstung (`pixel-items.js`, 827 Zeilen).

**Animationen** (alles `steps()`, kein Easing — bewusste Pixel-Art-Entscheidung):
Idle für beide, Angriff in 3 Phasen mit mitschwingender Waffe, Squash-&-Stretch beim Gegner,
Rückstoß beim Getroffenen, Aufblinken, Splitter, Schadenszahlen, Sieges-Hüpfen, Niederlage-Kippen, Boss-Auflösen.

### 4.2 Was fehlt

- **Nur eine einzige Kulisse.** Taghimmel + Hügel + Rasen gelten für *jeden* Kampf: ⚔️, 🌀 und 👑
  sehen identisch aus, ebenso Runde 1 und Runde 10. Kein Biom-, Tageszeit- oder Wetterwechsel.
- **Rastplatz 🔥 und Schatz 💎 haben gar keine Szene** — sie lösen nur einen Dialog aus.
- **Der Boss hat keinen eigenen Auftritt**: gleiche Kulisse, gleicher Ablauf, nur größerer Sprite
  und eigene Palette. Kein Intro, keine Phasen, keine eigene Musik-/Bildstimmung.
- **Die Kampagnenkarte ist kein Leveldesign**: 13 Reihen × 5 Spalten aus 44-px-Kreisen mit
  Emoji-Icons (⚔️🌀🔥💎👑) auf lavendelfarbenem Panel, Verbindungslinien als SVG-Kanten.
  Sie ist funktional, aber stilistisch nicht bei der Pixel-Art des Kampfes.
- **Gegner haben keine eigenen Angriffs-Frames**: der Angriff ist eine CSS-Transformation
  des einen Sprites, kein zweiter gezeichneter Zustand.
- **Kein Vordergrund/Tiefenebene** in der Arena (keine Bäume, Steine, Partikel vor den Figuren).

> Einordnung zur Notiz „Win95-Stil": Die **Charaktere und Gegner sind umgesetzt**
> (Pixel-Art, prozedural). Offen ist das **Leveldesign** — die eine Kulisse und vor allem
> die Kampagnenkarte, die noch im hellen App-Stil steckt.

---

## 5. Viewports

**Meta-Tag:** `width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover`
→ Zoom ist gesperrt, Safe-Areas werden berücksichtigt (`env(safe-area-inset-*)` in `.menu-footer` und `.adv-screen`).

**Breakpoints** (alle in `style.css`):

| Query | Zeile | Wirkung |
|---|---|---|
| `max-width:420px` | 1718 | h1 kleiner, weniger Padding in `.screen`/`.game-card`/`.player-banner`, engere Grids, kleinere Paperdoll-Slots |
| `max-width:599px` | 1029 | kompakteres Feedback (Padding, Schriftgrößen, Weiter-Button) |
| `pointer:coarse` **oder** `max-width:599px` | 517 | Lautstärke-Regler komplett aus — auf Touch regelt man am Gerät |
| `min-width:600px` | 1079 | einzige „Desktop"-Anpassung: mehr Body-Padding, größere Schrift in h1/Untertitel/Antwort-Buttons/Absenden/Punkte-Pillen |
| `max-height:700px` | 1353 | Kampf: Held/Gegner kleiner, Rasenkante höher |
| `max-height:480px` | 1360 | Kampf: noch kleiner (Handy quer oder offene Tastatur) |
| `prefers-reduced-motion:reduce` | 1712 | schaltet **nur** den Wackelpudding ab |

**Inhaltsbreiten** (die App ist immer eine zentrierte Spalte, es gibt kein mehrspaltiges
Desktop-Layout):

| Breite | Wofür |
|---|---|
| 640px | Spiel-Screen, Feedback, Fortschrittsbalken |
| 580px | Menü, `.screen`-Karten, Vokabel-Manager |
| 540px | Profil, Fortschritt, Charakter, Ladebildschirm |
| 440px | Kampf-Spielfeld (`#cf-stage`) |
| 420px | Kampf-Arena (Figuren) |
| 380/360/340/320px | Popups, Schmiede-Slider, Charakter-Bühne |
| 300px | Formularfelder in den Auth-Screens |

**Gebaut für:** Hochkant-Handy. Querformat ist nur im Kampf über die `max-height`-Regeln
abgefangen; auf Desktop wächst die Spalte nicht über 640px, der Rest bleibt Hintergrund.

---

## 6. Altlasten, die beim Design auffallen werden

| Fund | Details |
|---|---|
| **Toter Font-Import** | `Press Start 2P` wird in `style.css:1` von Google Fonts geladen, aber **nirgends** verwendet |
| **Tote CSS-Blöcke** | `.adv-screen`, `.adv-head`, `.adv-head-title`, `.adv-x`, `.adv-hint`, `.ce-grid`, `.ce-slot`, `.ce-picker`, `.ce-pick`, `.ce-effects` — der alte Ausrüstungs-Screen, ersetzt durch die Paperdoll (`.pd-*`) im Profil |
| **5 tote Variablen** | `--adv-bg1/-bg2/-text/-dim/-accent` (siehe `tokens.json`) |
| **Doppeltes `@keyframes bounce`** | Zeile 995 und 1089; der zweite überschreibt den ersten — laut Kommentar Absicht |
| **Kaum Tokens** | 6 von 143 Radien, 11 von 121 Schatten und 0 von 200 Schriftgrößen laufen über eine Variable |
| **Zwei Stil-Welten** | heller App-Stil (Menü, Lernen, Schmiede, Karte) vs. Pixel-Art (Kampf, Charaktere, Waffen). Der Übergang ist die Kampagnenkarte — sie gehört stilistisch zu keinem von beidem |
