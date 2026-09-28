# Handoff: English Stars — Pastell-Redesign (UI + Pixel-Art-Ikonografie)

> **Einstieg für Claude Code: `START-HERE.md`** (Phasenplan, Prompts, Platzhalter). Maßgebliche Screen-Liste: `SCREENS.md` (106 Screens). Der Abschnitt „Screens / Views“ weiter unten beschreibt noch den ersten Stand mit 32 Screens.

## Overview
„English Stars" ist ein Vokabel-Lernspiel mit Kampf-Modi (Deutsch → Englisch). Dieses Paket
beschreibt ein vollständiges visuelles Redesign der App: eine **Pastell-Oberfläche mit
durchgehender 2-px-Tintenkontur** und einer **selbstgezeichneten Pixel-Art-Ikonografie im
95er-Stil**, die jedes Emoji und jedes Vektor-Symbol ersetzt.

Enthalten sind 32 Screens von der Anmeldung über Hauptmenü, Vokabelverwaltung, Kampagnenkarte,
Schmiede und die vier Spielmodi bis zu Kampf, Sieg und Rundenende.

**Nicht Teil des Redesigns** (bewusst unangetastet, weiterhin System-Emoji): Charakter-Avatar,
Gefährten-Tiere und das Profilbild. Alles andere ist Pixel-Art.

## About the Design Files
Die Dateien in diesem Paket sind **Design-Referenzen in HTML** — Prototypen, die Aussehen und
Verhalten zeigen, **kein Produktionscode zum Kopieren**. Die Aufgabe ist, diese Designs in der
bestehenden Umgebung der App nachzubauen.

Die reale App ist Vanilla JS + CSS (`src/style.css`, `src/modules/*.js`, siehe `tokens.json` im
Projekt). Das Redesign sollte dort in die bestehende Struktur eingearbeitet werden — die
Klassennamen und Module der App bleiben, nur Werte und Markup-Details ändern sich. Falls das
Redesign stattdessen Anlass für einen Framework-Umzug ist, sind die Screens 1:1 in React/Vue/
SwiftUI umsetzbar; die Pixel-Ikonografie ist Canvas-basiert und damit framework-neutral.

**Wichtig zur Dateistruktur der Referenz:** `English Stars UI Pastell.dc.html` ist eine
Design-Component-Datei mit einem eigenen kleinen Runtime-Wrapper. Für die Umsetzung sind nur
zwei Dinge relevant: (1) das Markup der einzelnen `.dv-opt`-Blöcke (ein Block = ein Screen) und
(2) die JS-Klasse am Dateiende mit `ICON_PAL()`, `ICONS()`, `icon()`, `weapon()`, `enemy()`,
`arena()` — das ist die komplette Icon-Engine und direkt übernehmbar.

## Fidelity
**High-fidelity (hifi).** Alle Farben, Schriftgrößen, Abstände, Radien und Rahmenstärken sind
final und exakt. Die Screens sind auf **402 × 874 px (iPhone 17)** als Mindestmaß gebaut und
dürfen nach unten wachsen. Der Entwickler soll die Oberfläche pixelgenau nachbauen.

Einzige Ausnahme: Emoji-Platzhalter bei Charakter/Gefährte/Profilbild — dort kommen die echten
Assets der App hin.

---

## Design Tokens

### Grundfarben

| Rolle | Wert | Einsatz |
| --- | --- | --- |
| Tinte | `#1F1F24` | **Jede** Kontur, jeder Rahmen, Standardtext, dunkle Buttons |
| Text sekundär | `#3E3E46` | Labels, Metazeilen |
| Text tertiär | `#37373F` | Fließtext in Karten |
| Text auf Akzent | `#2E2E36` | Text auf Pastellflächen |
| Akzent-Lila (Text) | `#5B3FC4` | Unterüberschriften auf der Fortschritt-Seite |

### Pastell-Grundtöne (Geräte-Hintergrund, je Screen genau einer)

| Name | Wert | Screens |
| --- | --- | --- |
| Lila | `#C9B8FF` | Start, Anmelden, Registrieren, Name, Formen-Tab, Fortschritt, Schmiede, Rechtschreibung |
| Mint | `#B7E3C2` | Vokabeln-Tab, Vokabeln-Spiel, Treffer, Reset-Mail, Scan-Hinweis, Verwalten |
| Amber | `#FFD66B` | Kampagne, Rundenende, Sieg, Passwort zurücksetzen |
| Rosa | `#FFBBC1` | Kampf, Charakter, Aussprache |
| Hellblau | `#BCE3FF` | Profil, Postfach prüfen |
| Pfirsich | `#FFD6A5` | Neues Passwort, Vokabeln prüfen, Spiel Formen |

Regel: **maximal ein Grundton pro Screen.** Die Pastelltöne wiederholen sich innerhalb des
Screens nur als Akzentflächen in Chips und Kacheln.

### Neutrale Flächen (die „Papier"-Ebene)

| Rolle | Wert |
| --- | --- |
| Blatt (das große Panel über dem Grundton) | `#F1EEE0` |
| Karte | `#F8F6EC` |
| Karte hell (Dialoge, hervorgehobene Karten) | `#FDFAF3` |
| Einsatz / inaktiv | `#EAE7D6` |
| Balken-Spur | `#E3DFCD` |
| Chip „nicht verdient" | `#E6E2D4` |
| Eingabefeld gefüllt | `#F3EFE6` |

### Signalfarben

| Rolle | Wert |
| --- | --- |
| Richtig / Erfolg | `#B7E3C2` |
| Falsch / Löschen | `#FFBBC1` |
| Belohnung / Gold | `#FFD66B` |
| Gold dunkel (Schattierung) | `#E0A82E` |
| Gold hell (Glanz) | `#FFE9A8` |
| Info / Vokabeln | `#BCE3FF` |
| Rechtschreibung / Schmiede | `#C9B8FF` |
| Violett dunkel (Schattierung) | `#8B6FE8` |
| Formen / Werkstoff | `#FFD6A5` |
| Flamme / Serie | `#FF8A3D` |
| Stahl hell | `#C3CDD9` |
| Stahl dunkel | `#8A97A3` |
| Holz hell | `#A9703F` |
| Holz dunkel | `#6B4423` |

### Typografie
Eine einzige Familie: **Nunito** (Google Fonts, Gewichte 400, 600, 700, 800, 900).

| Rolle | Wert |
| --- | --- |
| Screen-Titel (Versalien) | `900 13px`, `letter-spacing: .18em`, `text-transform: uppercase` |
| Große Zahl / Held | `900 34px/1` bis `900 44px/1` |
| Karten-Titel groß | `900 24px` – `900 26px` |
| Karten-Titel | `900 17px` – `900 19px` |
| Zeilen-Titel | `900 13px` – `900 14px` |
| Button | `900 13px` – `900 15px` |
| Prozentwert | `900 17px` (klein) / `900 24px` (Karte) |
| Fließtext | `700 11px/1.5` – `700 12px/1.5` |
| Metazeile | `700 10px` – `700 11px` |
| Sektions-Kicker | `900 10px`, `letter-spacing: .14em`, uppercase |
| Chip | `800 10px` |
| Mikro-Label in Kacheln | `800 9px`, `letter-spacing: .11em`, uppercase |
| Statusleiste | `800 12px` |

### Rahmen
**`border: 2px solid #1F1F24` auf praktisch jedem Element.** Das ist das prägende Merkmal des
Designs — Karten, Chips, Buttons, Kacheln, Eingabefelder, Icon-Slots, der Gerätrahmen selbst.

Abweichungen mit Bedeutung:
- `2px dashed #1F1F24` — leere Ablagefläche, Vondu-Hinweiskasten, offene Schmiede-Schritte
- `2px dashed rgba(31,31,36,.55)` — **„noch nicht verdient"** (Taler-Chips)
- `2px dotted rgba(31,31,36,.25)` — Trennlinie innerhalb einer Karte
- `2px solid rgba(31,31,36,.2)` — Haarlinie unter Sektions-Kickern
- `1px dotted rgba(31,31,36,.3)` — Zeilentrenner in Statistiktabellen

### Radien

| Element | Wert |
| --- | --- |
| Geräterahmen | `34px` |
| Blatt (oben) | `26px 26px 0 0` |
| Große Karte / Dialog | `24px` – `30px` |
| Karte | `20px` – `22px` |
| Button / Eingabefeld | `18px` |
| Kachel / Icon-Slot groß | `16px` |
| Chip groß / Sekundärbutton | `14px` |
| Icon-Slot klein | `12px` |
| Chip | `10px` – `11px` |
| Balken | `5px` – `8px` |
| Kreis (Zurück-Knopf, Münzziel) | `50%` |

### Abstände
Keine Skala-Variablen — die beobachteten Werte:
- Blatt-Innenabstand: `16px 16px 18px`
- Karten-Innenabstand: `13px 14px` (Zeile), `15px 14px 16px` (Block), `22px 18px` (Dialog)
- Chip-Innenabstand: `3px 9px` (`3px 9px 3px 7px` mit Icon links)
- Abstand zwischen Karten: `11px` – `12px`
- Flex/Grid-`gap`: `6px`, `8px`, `9px`, `10px`, `11px`, `14px`
- Statusleiste: `13px 22px 4px`
- Kopfbereich über dem Blatt: `8px 16px 0`

**Layout-Regel:** Sibling-Gruppen immer `display:flex`/`grid` + `gap`, nie Margins pro Element.

### Schatten
Nur an einer Stelle, und dort bewusst hart (kein Weichzeichnen):
`box-shadow: 6px 8px 0 rgba(31,31,36,.28)` — die angehobene Sammlung im Verschieben-Screen,
zusammen mit `transform: rotate(-1.4deg)`.

Sonst **keine Schatten**. Tiefe entsteht ausschließlich über die 2-px-Kontur.

---

## Die Pixel-Art-Ikonografie

Das ist der aufwendigste Teil des Redesigns und sollte 1:1 übernommen werden. Die Engine steht
vollständig in der Logik-Klasse der Referenzdatei.

### Prinzip
Jedes Icon ist eine **Zeichenmaske**: ein Array von Strings, ein Zeichen = ein Pixel, jeder
Buchstabe ein Palettenschlüssel, `.` = transparent. Gerendert wird auf ein `<canvas>` mit
`image-rendering: pixelated`.

```js
ICON_PAL(){ return {
  K:'#1F1F24', W:'#F8F6EC', A:'#FFD66B', Y:'#FFE9A8', O:'#E0A82E',
  L:'#C9B8FF', V:'#8B6FE8', M:'#B7E3C2', R:'#FFBBC1', S:'#BCE3FF',
  P:'#FFD6A5', F:'#FF8A3D', G:'#C3CDD9', D:'#8A97A3', N:'#A9703F', B:'#6B4423'
}; }
```

### Zwei Konturmodi
1. **Berechnete Kontur (Standard).** Die Engine legt automatisch eine 1-px-Tintenkontur um die
   Füllmaske. Vorteil: die Kontur ist in jeder Größe exakt gleich stark.
   **Fallstrick:** die Kontur wächst 1 px in *jede* Richtung — Binnenlücken unter 3 px Breite
   werden von beiden Seiten zugeschüttet und verschwinden. Hohlformen (Fahne einer Note, Bügel
   eines Mülleimers) brauchen ≥ 3 px Lücke oder gehören in den zweiten Modus.
3. **`noOutline: true`.** Die Kontur ist in der Maske selbst gezeichnet. Nötig für alles mit
   feiner Binnenzeichnung — Stern, Haken, X, Chevrons, Statusleiste, Scan-Rahmen, Griff.

### Skalierungsregel — kritisch
Alle `ic:*`-Canvas haben einen **14 × 14 Backing-Store**. Sie dürfen **nur in ganzzahligen
Vielfachen von 14 px** angezeigt werden: `14`, `28`, `42`, `56`. Jede andere Größe rechnet das
Raster um, die Pixelspalten werden abwechselnd 1 und 2 px breit und die Kontur wirkt ungleich
stark. Das ist der häufigste Fehler beim Nachbau.

```html
<canvas data-paint="ic:coin" width="14" height="14"
        style="width:28px;height:28px;image-rendering:pixelated;flex:none"></canvas>
```

Ebenso: **keine beliebige Rotation** auf Pixel-Sprites — nur 90°-Schritte, sonst interpoliert
der Browser das Raster (`image-rendering: pixelated` verhindert das nicht).

### Icon-Inventar (42 Symbole)
Statusleiste: `signal`, `battery` · Navigation: `back`, `chevron`, `chevronUp`,
`chevronUpLight`, `close`, `dots`, `grip` · Werte: `coin`, `coinOff`, `crown`, `crownBig`,
`star`, `starInk`, `trophy`, `flame`, `gem` · Lernen: `book`, `test`, `target`, `pencil`,
`bulb`, `check`, `scan`, `mail`, `key`, `lock`, `music`, `speaker`, `trash` · Abenteuer:
`sword`, `shield`, `helm`, `glove`, `boots`, `hammer`, `potion`, `map`, `campfire`, `portal`,
`orb`, `ring`, `paw`, `bossCrest`

Dazu drei größere Sprites mit eigener Zeichenroutine: `weapon` (22 × 38, die Schmiede-Klinge),
`px:<gegner>` (20 × 20, Gegner) und `arena` (die Kampfkulisse).

### Gestaltungsregeln für neue Icons
- Mindestens 2 px Strichstärke, bei tragenden Symbolen 3 px. Dünner reißt die Form bei 14 px.
- Binnenzeichnung über **Farbe**, nicht über Lücken (siehe Münze: Diagonalstreifen in `O`,
  Glanzpunkt in `Y` — beides Füllfarben, keine Löcher).
- Zwei Luminanzstufen pro Material: `G`/`D` für Stahl, `N`/`B` für Holz, `A`/`O`/`Y` für Gold,
  `L`/`V` für Violett. Stufen mit gleicher Luminanz (z. B. `G` auf `Y`) sind unsichtbar.
- Asymmetrie erzeugt Lesbarkeit: der Haken hat einen kurzen Arm, der erst bei 55 % der Höhe
  ansetzt, und eine 4-px-Kerbe zwischen den Armen.
- Nach jeder Änderung die **Alphamaske des Canvas prüfen**, nicht nur den Screenshot:

```js
const c = document.querySelector('canvas[data-paint="ic:check"]');
const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
for (let y=0; y<c.height; y++) {
  let r=''; for (let x=0; x<c.width; x++) r += d[(y*c.width+x)*4+3] > 40 ? '#' : '.';
  console.log(r);
}
```

---

## Wiederverwendbare Bausteine

### Geräterahmen
```
width: 402px; min-height: 874px; background: <Grundton>;
border: 2px solid #1F1F24; border-radius: 34px;
overflow: hidden; display: flex; flex-direction: column;
```

### Statusleiste
`display:flex; justify-content:space-between; padding:13px 22px 4px; font:800 12px Nunito`
— links „9:41", rechts `ic:signal` + `ic:battery` à 14 px.

### Das Blatt
Das durchgehende Muster aller Screens: Grundton oben (Kopfbereich), darunter ein
cremefarbenes Panel, das bis zur Unterkante läuft.
```
margin-top: 14px; flex: 1;
background: #F1EEE0;
border: 2px solid #1F1F24; border-bottom: 0;
border-radius: 26px 26px 0 0;
margin-left: -2px; margin-right: -2px;   /* Kontur schließt mit dem Gerät ab */
padding: 16px 16px 18px;
```
`flex:1` ist zwingend — ohne endet das Blatt mitten im Screen.

### Zurück-Knopf
`34 × 34`, `border-radius: 50%`, `background: #F8F6EC`, `2px` Kontur, darin `ic:back` à 28 px.
Rechts daneben ein leeres `34 × 34`-Div, damit der Titel optisch zentriert bleibt.

### Spielerbanner (Hauptmenü)
Links: Avatar-Slot `44 × 44`, `border-radius:16px`, Emoji `22px` · Name `900 17px` · darunter
`ic:crown` + Wert und `ic:coin` + Wert à 14 px, `800 11px`. Rechts: Chip „Fortschritt".

### Drei-Tab-Leiste
```
border: 2px solid #1F1F24; border-radius: 20px; background: #F8F6EC;
display: flex; padding: 4px; gap: 4px;
```
Jeder Tab `flex:1; height:38px; border-radius:16px`. Aktiv: Grundton des Tabs + `2px` Kontur +
`900 12px`. Inaktiv: kein Rahmen, `800 12px`, `#3E3E46`.

### Fortschrittsbalken
```
height: 10px; border-radius: 6px; overflow: hidden; background: #E3DFCD;
  └ innen: height:100%; width:<pct>%; background:#B7E3C2 (Sammlung) | #1F1F24 (Modus) | #FFD66B (Schmiede)
```
Varianten: `8px`/`9px` in Listen, `11px`–`13px` bei Modus-Zeilen, `12px` mit eigener Kontur im
Schmiede-Werkstück.

### Taler-Belohnung
Die zentrale Spielmechanik-Anzeige: **pro Modus auf 100 % gibt es einen Taler, drei Modi = drei
Taler pro Sammlung.**

- **Sammlungskarte:** Chip `0/3 Taler` mit `ic:coinOff` links.
- **Modus-Zeile:** Balken in voller Breite, **darunter** eine Zeile mit `6/12 gemeistert` links
  und dem Chip `+1 Taler` rechts.
- **Zustand „noch nicht verdient":** `background:#E6E2D4`, `border:2px dashed rgba(31,31,36,.55)`,
  `color:#4A4A52`, Icon `ic:coinOff` (Stahltöne).
- **Zustand „verdient":** `background:#FFD66B`, `border:2px solid #1F1F24`, `color:#1F1F24`,
  Icon `ic:coin` (Gold).
- Chips immer `white-space: nowrap`.

### Chips allgemein
`border:2px solid #1F1F24; border-radius:10px; padding:3px 9px; font:800 10px Nunito`
Mit Icon: `display:inline-flex; align-items:center; gap:5px; padding:3px 9px 3px 7px`.
Farbcode: `#BCE3FF` = „Eigene", `#FFD6A5` = „Vorlage", `#B7E3C2` = „Aktiv", `#FFD66B` = Gold.

### Buttons
| Variante | Fläche | Text |
| --- | --- | --- |
| Primär | `#1F1F24` | `#FFD66B`, `900 14px` |
| Akzent | Grundton des Screens | `#1F1F24`, `900 14px` |
| Sekundär | `#F8F6EC` | `#1F1F24`, `800`–`900 13px` |
| Gefahr | `#FFBBC1` | `#1F1F24`, `900 12px` |

Immer `height: 50px`–`56px`, `border-radius: 18px`, `2px` Kontur, Inhalt per Flex zentriert.

### Vondu-Hinweis (Maskottchen)
`vondu-logo.svg` (48 × 46) links, Text `800 11.5px/1.45` rechts, in einer Karte mit
`2px dashed` Kontur. Vondu erscheint **nur** auf Anmeldung, Name-Eingabe, Info-Popups und
Bestätigungsdialogen — nicht im Hauptmenü.

---

## Screens / Views

32 Screens, in der Referenzdatei jeweils ein `.dv-opt`-Block mit Label. Gruppen:

**Start & Auth (7)** — `Start · lädt & bereit` (zwei Zustände nebeneinander: nur Ladebalken +
Prozent + Wortmarke + Logo + Version; im bereiten Zustand zusätzlich „Los geht's") ·
`Anmelden` · `Registrieren` · `Wie heißt du?` · `Passwort zurücksetzen` · `Reset-Mail
verschickt` · `Neues Passwort` · `Postfach prüfen`

**Hauptmenü (5)** — `Hauptmenü · Vokabeln` (Sammlungen eingeklappt) · `Hauptmenü · Vokabeln,
Sammlung offen` (mit den drei Modus-Zeilen) · `Hauptmenü · Sammlung verschieben` (Zustand nach
langem Halten: Griffsymbole **links neben** den Karten, gehaltene Karte gekippt mit hartem
Schlagschatten, gestrichelte Ablagefläche) · `Hauptmenü · Kampagne` (Knotenkarte mit
verbundenen Pfaden nach Slay-the-Spire-Muster; Pfade laufen **hinter** den Knoten, nicht durch
sie hindurch) · `Hauptmenü · Unregelmäßige` (Trainingsplatz + Schmiede)

**Vokabelverwaltung (3)** — `Vokabeln verwalten` · `Vokabeln prüfen · nach dem Scan` ·
`Scan-Hinweis · kein Key nötig`

**Spielmodi (5)** — `Spiel · Vokabeln` · `Spiel · Rechtschreibung` · `Spiel · Aussprache` ·
`Spiel · Formen` · `Spiel · Treffer` (Feedback-Zustand)

**Kampf & Abschluss (4)** — `Kampf · Pixel bleibt` (3a) und `Kampf · alles flach` (3b) als zwei
Stilvarianten der Kampfansicht · `Kampf · Sieg` · `Rundenende`

**Schmiede (1)** — `Schmiede · Auftrag läuft` (Pixel-Klinge, vier Verbform-Schritte, 75-%-Balken)

**Profil (4)** — `Profil` · `Charakter` · `Charakter · Gefährte` · `Fortschritt`

**Overlays (2)** — `Vondu-Info · Popup` · `Dialog · Sammlung löschen`

Jeder Block enthält das vollständige, exakt bemaßte Markup. Für Layout, Farben und Typografie
gilt: **die Datei ist die Spezifikation** — die Tabellen oben erklären das System dahinter.

### Reihenfolge und Inhalt
Die Screens folgen in Anordnung und Beschriftung den Screenshots der laufenden App
(`ref/*.png` im Projekt). Wo Inhalte vom Original abweichen, war das eine bewusste
Design-Entscheidung; die Feldreihenfolge innerhalb eines Screens dagegen nicht — sie folgt dem
Original.

---

## Interactions & Behavior

Die Prototypen sind **statische Zustandsbilder**, keine lauffähige Anwendung. Das erwartete
Verhalten:

| Element | Verhalten |
| --- | --- |
| Drei-Tab-Leiste | wechselt den Hauptmenü-Inhalt; aktiver Tab bekommt Grundton + Kontur |
| Sammlungskarte | Tippen klappt die drei Modus-Zeilen auf (Chevron dreht: `ic:chevron` → `ic:chevronUpLight` auf dunklem Slot) |
| Sammlungskarte, langes Halten | wechselt in den Sortiermodus (siehe `Hauptmenü · Sammlung verschieben`); Griffsymbole erscheinen links, gehaltene Karte hebt sich mit `rotate(-1.4deg)` + hartem Schatten |
| Modus-Zeile | startet den Spielmodus |
| Kampagnenknoten | erreichbare Knoten voll deckend, gesperrte mit `opacity:.45` auf `#EAE7D6`, aktueller Knoten in Tinte gefüllt |
| Eingabe prüfen | Treffer → `#B7E3C2`-Fläche + `ic:check`; Fehler → `#FFBBC1` |
| Schmiede-Schritt | erledigt `#B7E3C2` + `ic:check`, aktiv `#FFD66B` + `ic:hammer`, offen `#F8F6EC` mit `opacity:.6` |
| Taler | bei 100 % wechselt der Chip von grau/gestrichelt auf gold/durchgezogen |

Animationen sind im Prototyp nicht ausgeführt. Empfehlung für die Umsetzung: Pixel-Art-Sprites
ausschließlich mit `steps()` animieren (so macht es die bestehende App bereits im Kampf) — kein
Easing, kein Sub-Pixel-Versatz.

## State Management
Pro Screen benötigter Zustand:
- `activeTab`: `'kampagne' | 'vokabeln' | 'formen'`
- `openCollectionId`: welche Sammlung ausgeklappt ist (oder `null`)
- `reorderMode` + `heldCollectionId`: Sortiermodus
- pro Sammlung: `words[]`, `perModeProgress{vokabeln, rechtschreibung, aussprache}`,
  `talerEarned` (0–3), `kind` (`eigene | vorlage`)
- pro Schmiede-Auftrag: `verb`, `steps[]` mit `done | active | open`, `percent`
- Kampf: `wave`, `hp`, `streak`, `enemy`
- Spielmodus: `currentWord`, `input`, `feedback` (`null | 'correct' | 'wrong'`), `score`

## Assets

### App-Icons, Favicons, Startbilder
Vollständig in `appicon/` — 47 Dateien, alle aus `vondu-logo.svg` in Zielgröße gerastert
(**ohne** Wortmarke). Icon- und Splash-Grund ist der Markenton Lila `#C9B8FF`.

Enthalten: iOS-Set mit `Contents.json` · Android Adaptive Icon mit Monochrom-Variante für
Android-13-Themed-Icons, `ic_launcher.xml`, `colors.xml` und fünf Legacy-Größen ·
Web/PWA-Set mit `favicon.ico`, vier PNG-Favicons, Apple-Touch-Icon, vier Manifest-Icons und
zwei Maskable-Icons · fertige `manifest.json` · `head-snippet.html` mit allen `<link>`- und
`<meta>`-Zeilen · acht iOS-Startbilder.

Einbauanleitung inklusive Ordnerstruktur und Service-Worker-Hinweis: `appicon/README.md`.

### Markenassets

| Datei | Verwendung |
| --- | --- |
| `vondu-logo.svg` | Maskottchen-Gesicht — Startbildschirm, Anmeldung, Info-Popups, Dialoge |
| `vondu-wordmark.svg` | Wortmarke „VONDU" — Startbildschirm, Anmeldung, Registrierung |

Beide vom Kunden geliefert und unverändert eingebunden (`<img>`, feste `width`/`height`).

Alle übrigen Symbole sind Pixel-Art aus der Icon-Engine — **keine weiteren Bilddateien nötig**.

Die vierfarbige Google-Wortmarke auf den Auth-Screens ist im Prototyp **nicht** nachgezeichnet
(geschützte Fremdmarke). Dort steht ein Pixel-Schlüssel in einem `30 × 30`-Slot als Platzhalter.
In der Produktion gehört an diese Stelle das offizielle Google-Asset nach deren Branding-Vorgaben.

## Files

| Datei | Inhalt |
| --- | --- |
| `START-HERE.md` | Übergabe-Anleitung: Ablage im Repo, Prompt-Reihenfolge, CLAUDE.md-Regeln |
| `English Stars UI Pastell.dc.html` | **Die Spezifikation.** 32 Screens + komplette Icon-Engine |
| `appicon/` | App-Icons, Favicons, Startbilder, `manifest.json`, `head-snippet.html` — mit eigener `README.md` |
| `ref/` | 26 Screenshots des heutigen App-Zustands — Referenz für Inhalte und Feldreihenfolge |
| `vondu-logo.svg`, `vondu-wordmark.svg` | Markenassets |
| `support.js` | Runtime-Wrapper der Referenzdatei — **nicht** Teil des Designs, nur damit die HTML-Datei im Browser öffnet |
| `tokens.json` | Tokens der **bestehenden** App (Ausgangszustand, zum Abgleich) |
| `DESIGN.md` | Original-Screen- und Bausteinliste des Kunden |

`English Stars UI.dc.html` (die frühere, kräftigere „Acid"-Fassung) liegt weiter im Projekt und
ist bewusst nicht Teil dieses Pakets — sie dient nur dem Vergleich.


---

## Nachtrag N01–N54 (Stand v4.0.387)

Die Datei enthält jetzt **106 Screens**: die ursprünglichen 32 plus sechs Nachtrag-Abschnitte am Ende,
jeweils mit Überschrift „Nachtrag A–F". Jeder Screen ist mit seiner N-Nummer beschriftet — das ist die
Zuordnung zu `design_handoff_nachtrag/NACHTRAG.md` im Repo.

| Abschnitt | Screens | Kernpunkte |
| --- | --- | --- |
| A · Vokabeln | N01–N11 | Leerzustand, Aufbau-Dialog, Vorlagen, Text/Scan, Statistik, Probetest mit Note |
| B · Spielmodi | N12–N22 | Aussprache in 4 Zuständen, Selbstbewertung, Fehler, Wiederholung, **Schnellmodus = Amber-Chip „Schnellmodus" im Kopf**, 6 Formen-Aufgaben + Plaketten (Stahlblau = Simple Past, Gold = Past Participle, Lila = alle drei) |
| C · Formen & Schmiede | N23–N29 | Trainings-Deck mit 3 Disziplinen, Deck-Anlage, Statistik, mehrere Stationen mit Stahl/Gold-Wischen, Objektwahl, Befüllen, Info |
| D · Kampagne & Kampf | N30–N41 | Kampagne gesperrt/bereit/zu wenig/gratis, Schatz, **Rastplatz als eigene Szene**, 4 Minispiele im neuen Kampf-Layout, **3 getrennte Kampf-Enden**, Trank-Info, Schutz-Meldungen |
| E · Profil | N42–N47 | Freunde (Anfragen/Liste/Gesendet), Suche mit 4 Zuständen, Ausrüstung + Vorschau, Freundes-Fortschritt, erster Start |
| F · Überall | N48–N54 | **Installieren = einmaliges Vondu-Popup beim 3. Start**, Toast, Speichern, Lade-Skelett, Musik, Ziehen zum Neuladen, **Version einmal unter dem Ladebalken** |

### Neues Kampf-Layout (gilt für alle Minispiele)
Die Szene ist vollflächig; darüber **eine** Aufgabenkarte oben: farbiger Kopf mit Aufgabe und
deutschem Wort, darunter das Spielfeld (Antworten, Zeitbalken, Fächer). Unten rechts die
Gegner-Leiste, unten die Lebensleiste mit Trank-Chip. Keine frei schwebenden Elemente mehr —
Meteore und treibende Wörter bleiben innerhalb der Aufgabenkarte.

### Neue Pixel-Symbole
`mic, lupe, friends, cloud, calendar, box, chart, refresh, hourglass, heart, skull, flag, install,
toolbox, order, wand, checkLight` sowie der Sprite `meteor` (14 × 12). Gleiche Regeln wie oben:
nur ganzzahlige Vielfache anzeigen.

## Nachtrag · Feine Pixel-Art für Gegner, Figur und Gefährten

Gegner, Spielfigur und Gefährten sind jetzt im selben feinen Pixel-Stil gezeichnet (Formen mit 5-stufiger Schattierung, farbiger Kontur, Licht von oben links). Überblick in der Referenzdatei: **7 · Kampf → „Gegner · Dungeon-Stil"** und **8.11 · Charakter-Baukasten**.

| Datei | Inhalt | ersetzt |
| --- | --- | --- |
| `app/pixel-enemies-dungeon.js` | 36 Gegner als fertige Pixeldaten (20 Übung · 8 Elite · 8 Bosse), `enemySpriteSVG(kind)` | `pixel-enemies.js` (gleiche Signatur) |
| `app/pixel-hero-fine.js` | Laufzeit-Renderer für Figur und Gefährten: `renderHero(cfg)`, `renderHead(cfg)`, `renderPet(kind, color)` | Zeichenteil von `avatar.js` |

**Optionen:** 20 Frisuren · 12 Augen · 12 Münder · 16 Oberteile · 16 Hosen · 3 Staturen · 16 Hauttöne (8 davon Fantasie) · 12 Haarfarben · 12 Kleidungsfarben · 8 Augenfarben · 20 Gefährten × 3 Farben. Ausrüstung (`gear`) zeichnet Helm, Rüstung, Beinschienen, Armschienen und die Waffe in Stahl oder Gold direkt an die Figur.

**Anzeige:** Figur 54 × 81 → im Kampf 2× (108 × 162), Gegner 72 × 72 / Bosse 96 × 96 → 2×, Gefährte 40 × 40 → 2×. Nur ganzzahlig skalieren, immer mit `image-rendering: pixelated`.

## Nachtrag · Kampf-Animationen

Referenz: **7.2 · Kampf-Animationen** (Live-Vorschau, Einzelbilder, Ablauf eines Treffers). In allen Kampf-Screens laufen die Animationen bereits; 7.5 zeigt den Gegner-Angriff mit Treffer am Helden, 7.6 den Angriff des Helden.

| Animation | fps | Bilder | Inhalt |
| --- | --- | --- | --- |
| `idle` Stehen | 4 | 4, Schleife | Rumpf sinkt 1 px, Kopf folgt ein Bild später. Schleime wabbeln, Fliegende schweben 2 px (Schatten wird kleiner). |
| `attack` Angriff | 8 | 6 | 2× Ausholen, Vorstoß mit Wischspur, **Treffer-Bild (Index 3, 375 ms)** mit Funke, 2× Rückzug |
| `hurt` Treffer | 8 | 5 | weißer Blitz mit Tintenkontur, Rot-Ton, 5 px Rückstoß, zurück |

**Aufbau:** `app/pixel-anim.js` erzeugt aus der Kampf-Figur ein Blatt mit allen Bildern (`heroCombatSheet(avatarCfg)`, `enemyCombatSheet(key)`) – einmal pro Kampf, dauert wenige Millisekunden. Gegner brauchen keine eigenen Animationszeichnungen; der Held bekommt drei Schlüsselposen mit seiner aktuellen Waffe (Speer stößt, Schwert/Axt/Hammer hauen im Bogen, ohne Waffe Faustschlag).

**Einbau in `campaign-fight.js`:**
```js
import { SpritePlayer, heroCombatSheet, enemyCombatSheet } from './pixel-anim.js';
const held   = new SpritePlayer(heldCanvas,   heroCombatSheet(avatar));      // Canvas absolut im Container der Figur
const gegner = new SpritePlayer(gegnerCanvas, enemyCombatSheet(gegnerKey));
// richtige Antwort
held.play('attack', { onHit: () => { gegner.play('hurt'); zeigeSchaden(schaden); } });
// falsche Antwort
gegner.play('attack', { onHit: () => { held.play('hurt'); zeigeSchaden(schaden, 'held'); } });
```
Schadenszahl, Lebensleiste und Ton gehören in `onHit`, nicht an den Start des Angriffs – nur so sitzen sie auf dem Treffer-Bild. Nach `onEnd` läuft jede Figur automatisch wieder in `idle`.

**Regeln:** Bilder hart wechseln (kein CSS-Übergang, kein Easing), Canvas nur ganzzahlig skalieren. Alle Bilder einer Figur haben dieselbe Größe; `ox/oy` geben an, wo die ruhende Figur im Bild liegt, damit sie beim Wechsel nicht springt. Bei `prefers-reduced-motion` spielt der Player nur das Treffer- bzw. Blitz-Bild. Neue Gegner bekommen ihren Steh-Stil über `STYLE` (`breathe`, `wobble`, `hover`). Offen: eigener Ablauf für den Bogen (Spannen und Loslassen).
