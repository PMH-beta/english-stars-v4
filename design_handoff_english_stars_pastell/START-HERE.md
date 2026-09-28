# START HERE · English Stars Pastell → Claude Code

## Kann Claude Code das bauen?
Ja, ohne etwas zu erfinden. Figuren, Gegner, Waffen, Ausrüstung, Kampfplätze und Animationen sind **keine Bilder zum Nachzeichnen**, sondern fertiger JavaScript-Code in `app/`. Claude Code baut ihn ein und schließt ihn an eure Daten an. Die Screens sind reines Inline-Style-Markup und werden direkt übertragen.


## Neu in diesem Stand (28.09.2026)

Alles unten steckt bereits in den Modulen unter `app/` und in den Fragmenten. Claude Code übernimmt es 1:1 und erfindet nichts dazu.

**Kampf · sechs Abläufe je Figur** (`app/pixel-anim.js`, Übersicht Screen 7.2)
- `idle` Schleife 4 fps · `attack` und `hurt` 8 fps · `win` Schleife 8 fps · `die` einmal 8 fps, geht danach von selbst in `ko` · `ko` Schleife 4 fps (liegt, drei Sterne kreisen über dem Kopf).
- `SpritePlayer.play('die')` endet in `ko`, `play('win')` und `play('ko')` laufen in Schleife. Bei „Bewegung reduzieren“ zeigt `die` sofort das Liegebild.
- **Held:** Siegerpose `cheer` je Waffe (Waffe hoch, frohe Augen). Niederlage wie in Street Fighter 2: Treffer, taumelt zurück, wird rückwärts von den Füßen gerissen, schlägt mit Staub auf, federt 2 px nach und bleibt auf dem Rücken liegen. Kopf zeigt vom Gegner weg, Gesicht zur Kamera, X-Augen, Knie hoch, Waffe am Boden. Die Liegebilder zeichnet `pixel-hero-fine.js` passend zu jeder Frisur, Kleidung, Rüstung und Waffe (`heroKneel`, `heroFall`, `heroDown`).
- **Gegner (alle 36):** Angriffsart je Körper (`ATK_OF`: Krallenhieb, Bodenschlag, Sprung, Sturzflug, Schnappen, Zauberkugel). Jeder Gegner mit Körper hat eine **eigens gezeichnete Liegepose** in `DUNGEON_ENEMIES_KO[key] = { kneel, fall, down, hd }` (gleiche Kodierung wie die übrigen Sprites, `ox` = waagerechter Versatz zum Stehbild, `hd` = wo der Kopf liegt, für die Sterne). Ablauf je Gegner: `DIE_OF` (`back` = zurückgeschleudert, liegt; `flip` = überschlägt sich, landet auf dem Rücken; `fade` = die drei Geister Kettengeist, Irrlicht, Schattengänger lösen sich auf und haben darum keinen KO-Eintrag). `ATK_OF`, `DIE_OF` und `E_ATK` sind aus `pixel-anim.js` exportiert. Zauber-Gegner schießen dieselbe Kugel wie der Stab, gespiegelt und rot-violett eingefärbt.
- **Gefährte:** hüpft beim Sieg, bricht bei der Niederlage vor dem Helden zusammen und bleibt mit Sternen liegen. `petBattleFrames(kind, farbe, ablauf)` liefert idle, attack, hurt, win, die, ko. Das Bild hat genug Rand, nichts wird abgeschnitten.
- **Gefährten-Farben:** jedes der 20 Tiere hat 6 Farben (`PETS[i][2]`), `pet(kind, farbe)` nimmt den Hex-Wert.

**UI-Animationen** (`app/ui-anim.js`, Übersicht Screen 9.7)
- Alle im selben 8-fps-Takt wie die Figuren, harte Stufen, kein weiches Überblenden. Nur wo etwas passiert: zuhören (4.8), warten, belohnen (4.13, 4.14, 7.16), Fehler (4.3, 4.10), Treffer (7.6), Zeit läuft ab (Kampf).
- Start (1.1) und Anmeldung (1.2–1.7): Vondu und „Los geht's“ bewegen sich **nicht**.
- Ein gemeinsamer Takt für Figuren und UI: `let t = 0; setInterval(() => { t++; ui.tick(t); }, 125)`.

**Weitere Änderungen seit dem letzten Export**
- Frisuren in der Kampfansicht: die abgewandte Haarseite liegt hinter dem Kopf. Afro ohne Lücke zu den Ohren, Irokese als Kamm über den Schädel.
- Charakter-Editor (8.4–8.10): Speichern oben rechts im Kopf, beim Verlassen ohne Speichern Rückfrage (8.12).
- 2.5: Sammlung verschieben wie 2.4, nur angehoben und leicht gekippt, ohne Griffe.
- Minotaurus: die Axt liegt vor dem Körper.
- Schlange, Pilz, Truhe und Auge zerfließen oder kippen nicht mehr einfach, sie laufen denselben Ablauf wie der Held.
- Neu: `PROMPT.md` (Prompts) und `CLAUDE-REGELN.md` (Dauerregeln, Rückfrage-Pflicht bei Funktionsänderungen). `petBattleSequence` versteht jetzt die Schreibweise der Fragmente, auch `win` und `die`.

## Inhalt

| Pfad | Wofür |
| --- | --- |
| `PROMPT.md` | **Die Prompts für Claude Code:** Start und Plan, eine Phase umsetzen, Kurzbefehle |
| `CLAUDE-REGELN.md` | **Dauerregeln** für jede Sitzung, vor allem: vor jeder Funktionsänderung fragen. In die `CLAUDE.md` im Projektordner übernehmen |
| `SCREENS.md` + `screens/` | **Hauptquelle für die Oberfläche:** 106 Screens, je ein kleines Markup-Fragment |
| `README.md` | Design-System: Farben, Typo, Rahmen, Bausteine, Icon-Regeln |
| `app/pixel-hero-fine.js` | Figur + Gefährte, jede Kombination zur Laufzeit: `renderHero`, `renderHead`, `renderPet`, `renderPetSilhouette`, `renderHeroFacing`. 20 Gefährten (`PETS`), alle 8 Waffenarten in der Hand (`WEAPON_TYPES`) |
| `app/pixel-enemies-dungeon.js` | 36 Gegner, alle auch in Kampf-Blickrichtung: `enemySpriteSVG(kind)` (gleiche Signatur wie `pixel-enemies.js`), `DUNGEON_ENEMIES_FACING_LEFT` |
| `app/pixel-world-fine.js` | 6 Kampfplätze (`ARENAS`), 8 Waffen (`WEAPONS`) und 7 Ausrüstungsteile (`ITEMS`) je Stahl/Gold, Pfeile (`ARROWS`), `itemSprite(typ, material)`. **Schmiede in 5 Teilen:** `PART_NAMES`, `partStates(fertig)`, `itemPartsCanvas(typ, material, zustände, bild)`. **Lagerfeuer:** `CAMPFIRE` (statisch) und `CAMPFIRE_FRAMES` (6 Bilder, 8 fps) |
| `app/pixel-anim.js` | Sechs Abläufe je Figur: Stehen, Angriff, Treffer, Sieg, Niederlage, K.O. Dazu Bogen mit Pfeil und Zauberkugeln (auch von Gegnern): `SpritePlayer`, `ProjectileLayer`, `heroCombatSheet`, `enemyCombatSheet` |
| `app/ui-anim.js` | **UI-Animationen** (`data-ui`): `createUiAnimator({ icon, idleFrames })`, `tick(t)` im 8-fps-Takt. Übersicht aller Arten: Screen 9.7 |
| `English Stars UI Pastell.dc.html` | Gesamtreferenz zum Anschauen im Browser (groß, lädt ca. 10 s). Enthält die Pixel-Icon-Engine (`ICON_PAL`, `ICONS`, `icon`) |
| `appicon/` | App-Icons, Favicons, Startbilder (eigenes README) |
| `tokens.json`, `DESIGN.md`, `ref/` | Ausgangsstand der App zum Abgleich |
| `app/avatar.js`, `pixel-items.js`, `pixel-enemies.js`, `arena.js`, `storage.js`, `sync.js`, `dialog.js` | **Nicht übernehmen.** Kopien bzw. leere Stubs eurer Dateien, nur damit die Referenzdatei im Browser läuft |

## So übergibst du es
1. Den Ordner `design_handoff_english_stars_pastell/` im Repo neben `src/` durch diese Fassung ersetzen.
2. Den Inhalt von `CLAUDE-REGELN.md` in die `CLAUDE.md` im Projektordner übernehmen (anlegen, falls es keine gibt).
3. Claude Code im **Plan-Modus** starten und **Prompt 1** aus `PROMPT.md` schicken. Die Fragen beantworten.
4. Danach **eine Phase pro Sitzung** mit **Prompt 2** aus `PROMPT.md`. Nach jeder Phase auf dem Handy prüfen.

## Phasen

| # | Phase | Fertig, wenn … |
| --- | --- | --- |
| 0 | **Prüfblatt** `dev/sprites.html`: alle 36 Gegner (vorn + Kampfrichtung), 10 Vorlagen, 20 Frisuren, alle 20 Gefährten (auch als Silhouette), 8 Waffen in der Hand, alle Gegenstände in Stahl und Gold, 6 Kampfplätze, Lagerfeuer, alle sechs Abläufe (Stehen, Angriff, Treffer, Sieg, Niederlage, K.O.) für Held, alle 36 Gegner und alle 20 Gefährten und der Bogen-Angriff in Schleife | alles auf einer Seite zu sehen ist. Das ist ab jetzt die Sichtprüfung für jede weitere Phase |
| 1 | **Grundbausteine:** `--p-*`-Tokens in `style.css`, 2-px-Rahmen, Blatt, Karten, Chips, Buttons, Tab-Leiste | ein beliebiger Screen die neuen Flächen und Rahmen zeigt |
| 2 | **Pixel-Icons:** Icon-Engine aus der Referenzdatei als Modul, `iconHTML()` darauf umstellen | nirgends mehr Emojis oder Vektor-Symbole stehen |
| 3 | **Gegner:** `pixel-enemies.js` → `pixel-enemies-dungeon.js`, im Kampf die Kampfrichtung | der Kampf die neuen Gegner zeigt, zum Helden gedreht |
| 4 | **Figur & Gefährte:** Adapter statt `avatarSVG`, Migration alter Spielstände, Ausrüstung anschließen | ein alter Spielstand eine sinnvolle neue Figur ergibt und angelegte Ausrüstung an der Figur erscheint |
| 5 | **Gegenstände, Kampfplätze, Lagerfeuer** aus `pixel-world-fine.js`: Schmiede, Profil-Slots, Kampf, Rastplatz | nirgends mehr `itemIconSVG` oder `arena.js` gebraucht wird |
| 6 | **Kampf-Animationen** in `campaign-fight.js`, inklusive Bogen und Gegner-Zauber mit `ProjectileLayer`, Sieg (7.15, 7.16) und Niederlage (7.17) | Schaden, Lebensleiste und Ton auf dem Treffer-Bild sitzen, beim Bogen erst beim Einschlag des Pfeils |
| 7 | **Screens** nach `SCREENS.md`, Bereich 1 bis 9, ein Commit je Bereich. UI-Animationen mit `app/ui-anim.js` anschließen | jeder Screen dem Fragment entspricht |
| 7b | **App-Tour** (1.11–1.15) und „App-Tour ansehen“ im Profil (8.1), siehe unten | ein neuer Spielstand die Tour genau einmal sieht und sie im Profil erneut startet |
| 7c | **App-Icons und Startbilder** aus `appicon/` (eigenes README). Wo sie eingebunden werden (Manifest, iOS, Android), vorher klären | Home-Bildschirm und Start das neue Icon zeigen |
| 8 | **Aufräumen:** alte Renderer und Schalter `pastell` entfernen, erst nach Freigabe | nur noch der neue Stand im Code ist |

## Worauf Claude Code achten muss
1. **Alte Avatare migrieren.** Die neue Figur hat andere Wertebereiche: Hautton 0–15 (8–15 Fantasie), Frisur 0–19, Haarfarbe 0–11, Augen 0–11, Augenfarbe 0–7, Mund 0–11, Oberteil 0–15, Hose 0–15, Kleidungsfarben 0–11, Statur 0–2, Gefährte 0–19. Einmalig `avatarVersion: 2` setzen: Formen per Modulo, Farben per nächstliegendem Farbton aus den alten Paletten in `avatar.js`. Gefährten 0–9 behalten Reihenfolge und Bedeutung (Wolf … Krake), 10–19 sind neu (Hase, Frosch, Pinguin, Bär, Igel, Maus, Axolotl, Papagei, Fledermaus, Schleim). Gefährten-Farbe 0–2 behält die Bedeutung, 3–5 sind neu.
2. **Ausrüstung anschließen.** `equippedGearMap()` → `{ weapon: { type, which }, head, body, arms, legs }`. `type` ist eine der 8 Waffenarten aus `WEAPON_TYPES`, `which` bzw. die Rüstungswerte sind `'past'` (Stahl) oder `'pp'` (Gold). Gegenstands-Bilder immer über `itemSprite(typ, material)`: Waffen `schwert dolch speer axt hammer stab bogen streitkolben`, Ausrüstung `helm ruestung handschuhe stiefel ring talisman gefaehrte`.
3. **Anzeigegrößen.** Waffe als Gegenstand 2× (48 × 72), Ausrüstungsteil 2× (64 × 64), in Slots unter 60 px 1×. In der Schmiede **nie** `opacity`/`grayscale`: Teile mit `itemPartsCanvas()` zeichnen (siehe „Schmiede · 5 Teile“).
4. **Rechenzeit.** Eine Figur braucht ca. 20 ms, ein Kampf-Blatt für den Helden ca. 110 ms (Desktop; auf älteren Handys 3–5-mal so lang). Figuren einmal zeichnen und als Bild cachen (Schlüssel: Avatar + Ausrüstung). Kampf-Blätter beim Laden des Kampfes bauen, nicht beim ersten Angriff.
5. **Pixel-Regeln.** Nur ganzzahlig skalieren, immer `image-rendering: pixelated`, keine CSS-Übergänge oder Easing auf Sprites, keine freie Rotation. Icons nur in 14, 28, 42 oder 56 px.
6. **Treffer-Timing.** Schaden, Lebensleiste und Ton gehören in `onHit`, nicht an den Start des Angriffs.
7. **Bogen.** `heroCombatSheet` erkennt den Bogen selbst (`sheet.ranged`). Im Kampf ein `<canvas>` über die ganze Bühne legen, daraus `new ProjectileLayer(canvas)` machen und beim Angriff mitgeben: `held.play('attack', { target: gegner, layer, onHit })`. Der Pfeil startet bei Bild 3 (250 ms), `onHit` kommt beim Einschlag (Bild 5, 500 ms). Alle anderen Waffen brauchen `target` und `layer` nicht.
8. **Bewegung reduzieren.** Bei `prefers-reduced-motion` spielt der `SpritePlayer` nur das Treffer- bzw. Blitz-Bild, der Pfeil fliegt dann nicht.

## App-Tour (1.11–1.15) · geführt, mit Vondu, auf neutralem Demo-Stand
- **Wann:** genau einmal nach der Charakter-Erstellung eines neuen Spielstands (nach 1.10). Beim Beenden **und** beim Überspringen `tourSeen: true` speichern. Bestehende Spielstände mit Avatar bekommen `tourSeen: true` und sehen die Tour nicht automatisch. **Nochmal ansehen:** Profil 8.1 → „App-Tour ansehen“ → **Starten**; am Ende zurück ins Profil.
- **Immer neutraler Hintergrund:** Die Tour zeigt nie den echten Fortschritt – auch nicht beim erneuten Abspielen. Während der Tour rendert das Hauptmenü einen festen Demo-Stand: Name „Vondu“ und Standardfigur (nicht die des Spielers), 0 Kronen, 0 Taler, keine eigenen Sammlungen (Leerzustand wie 2.2), Formen mit dem Standard-Deck bei 0 % und unbegonnener Schmiede (0/150 Schritte, keine Station begonnen), Kampagne „Noch gesperrt · Freigeschaltet 0/2“ (wie 6.2). Echte Daten werden während der Tour weder angezeigt noch verändert; danach erscheint wieder der echte Stand.
- **Ablauf:** Die Tour wechselt selbst die Tabs.
- **Demo-Stand:** Name „Vondu“, Standardfigur, 0 Kronen, 0 Taler. Schritt 2 zeigt genau eine Sammlung „Tiere“ (Vorlage, 12 Wörter, alles 0 %) – die, die in Schritt 1 entstehen würde. Schritt 3: Trainingsplatz zugeklappt, Schmiede unbegonnen (0/15 · 0/150 · 120 frei), alle Objekte als graue Umrisse (`'ggggg'`).

| Schritt | Tab | Markiertes Element | Dialog-Box | Titel |
| --- | --- | --- | --- | --- |
| 1 | Vokabeln | beide Startwege „Vorlage auswählen“ + „Eigene Sammlung anlegen“ (gemeinsam markiert) | unten | Hi, ich bin Vondu! |
| 2 | Vokabeln | Sammlung „Tiere“: Kopf mit „0/3 Taler“, Balken und die 3 Übungsarten mit „+1 Taler“ | oben | Taler sammeln |
| 3 | Formen | Schmiede-Kopf (Titel + Stationen · Schritte · Noch frei) | unten, mit 5-Teile-Beispiel | Die Schmiede |
| 4 | Kampagne | Karte „Noch gesperrt“ | oben | Kampagne & Kampf |
| 5 | Vokabeln | Kopfkarte mit Bild und Name | unten | Dein Profil |

- **Texte** wörtlich aus den Fragmenten 1.11–1.15.
- **Spotlight:** Abdunklung `rgba(31,31,36,.62)` über dem ganzen Bildschirm, das markierte Element darüber (`position:relative; z-index:41`) mit `outline: 3px solid #FF8A3D; outline-offset: 3px` und `tourPulse 1.6s steps(4,end) infinite` (Pixel-Takt, nicht weich). Markierte Gruppen bekommen eine eigene Fläche (`padding` 6–8 px, gleiche negative Ränder, `border-radius` 22–26 px).
- **Dialog-Box (Spiel-Stil, ersetzt die Sprechblase):** sitzt immer am Bildschirmrand gegenüber dem markierten Element – unten (`bottom:16px`; Schritt 3 `10px`) oder oben (`top:124px`) – und überdeckt es nie. `left/right: 12px`, 2-px-Kontur, Radius 18, `#FDFAF3`, doppelter Innenrahmen `box-shadow: inset 0 0 0 3px #FDFAF3, inset 0 0 0 5px #E3DFCD`, Innenabstand 22 / 18 / 14 px (Schritt 3: 20 / 16 / 12). Auf der Oberkante links das Namensschild „VONDU“ (`left:100px; top:-13px`, 24 px hoch, `#1F1F24` / `#FFD66B`, 900 11 px, Laufweite .18em), rechts die Fortschrittsleiste (`right:16px; top:-10px`, 20 px hoch, 5 Quadrate 8 × 8: erledigt `#1F1F24`, aktuell `#FF8A3D`, offen nur Kontur). Innen: Titel 900 19 px, Text 700 13 px / 1,5 (`#2E2E36`), in Schritt 3 das Beispiel, dann die Knopfzeile (14 px Abstand): „Überspringen“ (unterstrichener Textlink, fehlt in Schritt 5) · Leerraum · „‹“ (44 × 44, ab Schritt 2) · „Weiter ›“ bzw. „Los geht’s!“ (44 px hoch, `#1F1F24` / `#FFD66B`, der Pfeil zuckt mit `tvNudge`).
- **Vondu:** steht **auf** der Dialog-Box links (`left:10px; bottom:calc(100% - 4px)` – die Füße stehen auf der Kontur) und schaut nach rechts in die Box. Keine Requisiten, keine Icons. Pixel-Sprite 42 × 42 in 2× (84 × 84), 4 Bilder mit 4 fps wie das Stehen der Figuren: der Körper wippt 1 px nach unten (Bilder 1–2), die Klinge gegenläufig 1 px nach oben (Bilder 2–3, ein Bild versetzt). Daten: `VONDU_FRAMES` / `VONDU_FPS` in `app/pixel-world-fine.js`; überall sonst bleibt `vondu-logo.svg`. Bei `prefers-reduced-motion` nur Bild 0.
- **Keyframes** wörtlich übernehmen:

```css
@keyframes tourPulse{0%{box-shadow:0 0 0 0 rgba(255,138,61,.6)}100%{box-shadow:0 0 0 12px rgba(255,138,61,0)}}
@keyframes tvNudge{0%,49%{transform:translateX(0)}50%,100%{transform:translateX(2px)}}
```
- **Schritt 3 · Beispiel in der Dialog-Box:** Speer im Zustand `'bbngg'` (`itemPartsCanvas('speer','past','bbngg',bild,2)`, 4 fps) neben der Teile-Liste aus `PART_NAMES.speer` (fertig = grünes Kästchen mit Haken, in Arbeit = gelbes Kästchen mit Hammer + Chip „in Arbeit“, offen = gestricheltes Kästchen mit Nummer), darunter Chips „Stahl · Simple Past“ (`#C3CDD9`) und „Gold · Past Participle“ (`#FFD66B`).

## Schmiede · 5 Teile pro Objekt (5.1, 5.2, 5.12, Tour 1.13)
- Jedes der 15 Objekte besteht aus genau **5 Teilen** in fester Bauabfolge (`PART_NAMES`, identisch mit `ITEM_ART` in `pixel-items.js`). Handschuhe und Stiefel sind deshalb Paare (linke/rechte Seite), der Gefährte eine Figur (Körper · Kopf · Ohren · Schwanz · Augen).
- **Zustand je Teil:** `b` fertig · `n` wird gerade geschmiedet – immer genau das Teil nach dem letzten fertigen, glüht in 4 Bildern mit 4 fps orange auf, Funken in Bild 2 und 3 · `g` noch offen, drei Grautöne nach Helligkeit. `partStates(fertigeTeile)` liefert die Zeichenkette.
- **Anzeige:** unbegonnen `'ggggg'` (statisch), fertig `'bbbbb'` (= `itemSprite`). Werkstücke werden immer auf ihren sichtbaren Inhalt zugeschnitten (`itemBounds` – Vereinigung über alle Zustände und Bilder) und mittig in eine Fläche fester Größe gesetzt: `itemPartsCanvasTrimmed(…)`. Stationskarte 4× (Gefährte 3×) in einer Fläche von 176 px Höhe, Kacheln „Noch nicht begonnen“ 2× in einer Fläche von 92 px. **Nie** `opacity` oder `grayscale` – der graue Zustand steckt schon in `'ggggg'`.
- **Stationskarte (5.1, 5.2):** Kopf: links untereinander der Name („Stahl-Dolch“, 900 16 px / 1,2) und darunter „Simple Past“ bzw. „Past Participle“ (Sanduhr 14 px, 700 11 px, `#3E3E46`, 3 px Abstand), rechts mittig daneben der Info-Knopf (34 × 34). Gleiches Muster für alle Werkstoffe und den Gefährten – kein zusätzlicher Titel darüber. Darunter das Werkstück im Karussell (‹ ›): Fläche 176 px hoch für **alle** Stationen gleich, `#EAE7D6`, Radius 20, Inhalt zugeschnitten und exakt mittig. **Keine** zweite Miniatur, **keine** Einzelsegmente: welches Teil gerade entsteht, zeigt allein das Werkstück (glühendes Teil). Darunter „Schmieden NN %“ und **ein** Balken (12 px, 2-px-Kontur, Radius 7, Spur `#E3DFCD`, Füllung Stahl `#8A97A3` / Gold `#E2B53C`). Prozent = fertige Teile × 20. Punkte = Position im Karussell, danach „Wörter anzeigen ▾“.
- **Kacheln „Noch nicht begonnen“:** Raster mit 2 Spalten und `grid-auto-rows: 1fr` – alle Kacheln gleich hoch. Werkstück-Fläche 92 px, Inhalt zugeschnitten und mittig (2×), Bonus-Text mindestens 2 Zeilen hoch (`min-height: 27px`), Knopf „Wörter befüllen“ unten (`margin-top: auto`). Kopfzahl „Schritte“ = Summe aller fertigen Teile (max. 15 × 2 × 5 = 150).
- **Lagerfeuer (6.7):** `CAMPFIRE_FRAMES` mit 8 fps in 2× (96 × 96); `CAMPFIRE` = Bild 0 für statische Stellen.

## Charakter-Editor (1.9, 1.10, 8.4–8.10)
- **Aufbau:** Oben die Bühne (Figur 3×, Gefährte 3×, beide mit Pixel-Schatten). Darunter die **Reiter** (Karteikarten-Tabs, kein Slider, keine Chips): Zeile `display:flex; gap:4px; padding:0 8px; position:relative; z-index:1; margin-bottom:-2px`, ein Reiter je Kategorie, gleich breit (`flex:1`), nur Pixel-Icon 28 px (2×), Kontur 2 px, Radius 12 12 0 0. Inaktiv 42 px hoch, `#E3DFCD`. Aktiv 52 px hoch, `#FDFAF3`, untere Kontur in Flächenfarbe (öffnet sich in die Tafel), oben ein 5-px-Streifen im Grundton des Screens (`box-shadow: inset 0 5px 0 <Grundton>`). Erster Start 7 Reiter (Frisur, Haut, Augen, Mund, Oberteil, Hose, Statur), Profil 8 (+ Gefährte). Direkt darunter die **Tafel** (`#FDFAF3`, 2-px-Kontur, Radius 18, Innenabstand 12 / 8 px): Kopfzeile mit Kategorie (900 9 px, Versalien) über dem gewählten Namen (900 17 px, eine Zeile), Zähler „2 / 16“ (Chip im Grundton), Pfeile ‹ › (36 × 36) zum Durchschalten; bei „noch keiner freigespielt“ Zähler grau und Pfeile gestrichelt. Darunter – falls vorhanden – „Farbe“ mit Farbreihe, dann das Kachel-Raster mit 4 Spalten (8 px Abstand). Gewählte Kachel `#FFD66B` + Häkchen.
- **Kategorien** (nichts zusammengefasst, nur die Farbe gehört zur jeweiligen Kategorie):

| Kategorie | Optionen | Farbe | Kachel zeigt (Ausschnitt der Figur) |
| --- | --- | --- | --- |
| Frisur | 20 | Haarfarbe · 12 | Kopf 34 × 34 ab (10, 0), 2× |
| Haut | 16 – 8 natürlich, 8 Fantasie | – (die Kacheln sind die Farben) | Kopf, 2× |
| Augen | 12 | Augenfarbe · 8 | Gesicht 26 × 24 ab (14, 9), 3× |
| Mund | 12 | – | Gesicht, 3× |
| Oberteil | 16 | Farbe · 12 | Oberkörper 38 × 36 ab (8, 31), 2× |
| Hose | 16 | Farbe · 12 | Beine 34 × 31 ab (10, 50), 2× |
| Statur | 3 | – | ganze Figur 1× (Kachel 100 px hoch) |
| Gefährte | 20 | Farbe · 6 | Gefährte 40 × 40, 2× |

  Namen und Reihenfolge: `HAIR_N`, `EYES_N`, `MOUTH_N`, `TOPS_N`, `PANTS_N`, `PETS` in `app/pixel-hero-fine.js`; Farbnamen stehen als `aria-label` in den Fragmenten.
- **Live eingefärbt:** Jede Kachel zeigt die Figur mit **allen aktuellen Einstellungen**, nur die Option der Kachel ist ausgetauscht. Ändert sich eine Farbe oder Option, werden alle Kacheln sofort neu gezeichnet (`renderHero`/`renderHead` + Ausschnitt oben). Die Farbreihe steht deshalb **über** dem Raster: Farbe tippen, die Kacheln darunter färben sich um – nie hochscrollen müssen.
- **Kacheln & Farben:** Kachel 86 px hoch (Statur 100), gewählt `#FFD66B` + Haken-Plakette. Farbkreise 32 px in 44 × 44-Trefferfläche, 6 pro Zeile (Augenfarbe 8 in einer Zeile), gewählte Farbe mit doppeltem Ring, ihr Name rechts neben der Überschrift.
- **Erster Start (1.9, 1.10):** Titel „Wer bist du?“, ohne Zurück, ohne Chip „Gefährte“ (noch keiner geschmiedet), Knopf „Los geht's!“. **Profil (8.4–8.10):** Zurück-Pfeil verwirft, „Speichern“ übernimmt.
- **Noch kein Gefährte (8.10):** solange die Schmiede-Station „Gefährte“ nicht fertig ist: Bühne mit gestricheltem leerem Platz und „Noch kein Gefährte“, Vondu-Hinweis mit „Zur Schmiede“ (öffnet Tab Formen und scrollt zur Station „Gefährte“), darunter alle 20 Gefährten als graue Silhouetten ohne Auswahl (`renderPetSilhouette(kind)`, 2×; Regel siehe `petSilhouette` im Modul).
- **Daten:** `skin` 0–15 (8–15 Fantasie), `hair` 0–19, `hairC` 0–11, `eyes` 0–11, `iris` 0–7, `mouth` 0–11, `top` 0–15, `topC` 0–11, `pants` 0–15, `pantsC` 0–11, `build` 0–2, `pet` 0–19 (0–9 wie bisher), `petColor` 0–5 (0–2 wie bisher). Neue Optionen hängen hinten an, bestehende Werte behalten ihre Bedeutung.

## Platzhalter in den Screen-Fragmenten

| Attribut | Bedeutung | In der App |
| --- | --- | --- |
| `data-paint="ic:NAME"` | Pixel-Icon | `iconHTML(NAME, px)` |
| `data-paint="dg:KEY"` | fertiges Sprite aus der Referenz (Schlüssel siehe unten) | die passenden Module erzeugen es selbst |
| `data-anim="KEY\|rolle\|ablauf"` | animierte Kampffigur. `idle` · `attack@4` bzw. `hurt@7` = Start in Takt 4 bzw. 7 eines Zyklus · `win@9` = ab Takt 9 Sieg in Schleife · `die@2` = ab Takt 2 einmal Niederlage, danach K.O.-Schleife (liegt, Sterne) · `win` / `ko` allein = Schleife · mehrere mit Komma, Zykluslänge mit `/48` · `frame:attack:3` = Einzelbild | `SpritePlayer` |
| `data-ui="art"` | UI-Animation (Mikrofon-Ringe, Konfetti, Pop, Wackeln, Balken füllen, Zählen, Lebensbalken …). `data-d` Verzögerung in Takten, `data-c` Zyklus, `data-a` Stärke, `data-from` Startwert, `data-at` Treffer-Takt. Alle Arten mit Werten: Screen 9.7 | `app/ui-anim.js` |
| `data-pxa-scene` | Bühne mit Pfeil-Ebene (nur 7.2) | `ProjectileLayer` |
| `data-tour-target`, `data-tour-bubble` | markiertes Element bzw. Dialog-Box der Tour | siehe „App-Tour“ |
| `data-anim="P{a}_{b}\|pet\|ablauf"` | Gefährte im Kampf (Kampfansicht, schaut zum Gegner). `petf` statt `pet` = einzelner Gefährte in Vorderansicht mit Pixel-Schatten. Ablauf wie beim Helden, mehrere Aktionen möglich: `attack@4,hurt@12/16` | `petBattleSequence(kind, color, 'attack@4,hurt@12/16')` (Schreibweise wie im Fragment) bzw. `petMenuImage(kind, color)` |
| `dg:HP{v}_{ausrüstung}_P{a}_{b}` | Figur und Gefährte als ein Bild mit einem gemeinsamen Pixel-Schatten (8.1 3×, 8.2 und 8.3 2×), unten bündig | `heroWithPet(hero(cfg).render(), pet(kind, color).render(), { dx: 26, dy: 3 })` |
| `dg:or_hair{i}` · `or_ey{i}` · `or_mo{i}` · `rb_top{i}` · `rb_pa{i}` | Kampfansicht der Option (8.11, jeweils rechts neben der Vorderansicht) | `turned(() => hero({ ...cfg, face: 1 }), 1, 34, { sort: false })` |
| `data-frames="KEY\|fps"` | Bildfolge: Bilder `KEY~0 … ~n` im Takt (`PW_{typ}_{material}_{zustände}` = Schmiede-Teile, `campfire` = Lagerfeuer) | `itemPartsCanvas(…, bild)` bzw. `CAMPFIRE_FRAMES` |
| `dg:PG_{typ}_past` | Objekt unbegonnen (`'ggggg'`) | `itemPartsCanvas(typ, 'past', 'ggggg')` |
| `data-app="sky"`, `"hills"` | alte Kulisse, nur im Ist-Stand 7.3 | — |

**Sprite-Schlüssel:** `H{vorlage}_{ausrüstung}` Figur vorn · `…_r` Figur in Kampfrichtung · `…_r~wind|smear|strike|ouch` Schlüsselposen · `Hw_{waffe}` bzw. `Hw_{waffe}_r` Figur mit Waffe in der Hand · `Hh{n}` Kopf · `Hb{n}` Büste · `P{art}_{farbe}` Gefährte · `oh_hair{n}` Frisur-Kachel · `{gegner}` vorn · `{gegner}_l` Kampfrichtung · `A_{platz}` Kampfplatz · `W_{waffe}_{past|pp}` Waffe · `I_{teil}_{past|pp}` Ausrüstungsteil · `arrow_{past|pp}` Pfeil · `campfire` Lagerfeuer · `lichHead` Boss auf der Karte · `PWt_{typ}_{material}_{zustände}~{bild}` / `PGt_{typ}_{material}` Schmiede-Werkstück zugeschnitten · `Pt0_0` Gefährte zugeschnitten · `vondu~{0–3}` Vondu in der Tour · `H{vorlage}_none_s` Figur vorn mit Schatten. **Editor:** `E_st…` Bühne (Figur mit Schatten, 3×) · `E_pet{n}` Gefährte auf der Bühne · Kacheln `E_fr{n}` Frisur · `E_hu{n}` Haut · `E_au{n}` Augen · `E_mu{n}` Mund · `E_ob{n}` Oberteil · `E_ho{n}` Hose · `E_sb{n}` Statur · `E_ps{n}` Gefährte noch nicht freigespielt · Baukasten 8.11: `oh_ey{n}` `oh_mo{n}` `ob_top{n}` `ob_pa{n}` `ob_bu{n}`. In der App entstehen alle Kacheln live aus `renderHero`/`renderHead` + Ausschnitt (Tabelle oben).

## Stand
Alles ist gezeichnet und festgelegt: 8 Waffenarten in der Hand, alle Gegenstände in Stahl und Gold, eigener Bogen-Angriff mit fliegendem Pfeil, alle 36 Gegner in Kampf-Blickrichtung (auch Schleimkönig und Spinnenkönigin), 20 Gefährten mit Silhouette für „noch nicht freigespielt“, Reiter statt Slider, Vondu auf der Dialog-Box der Tour, Schmiede mit großem Werkstück und einem Fortschrittsbalken. Pixel-Art beurteilt trotzdem am besten ein Mensch: nach Phase 0, 3, 4, 5 und 6 selbst auf dem Handy anschauen.

## Nachtrag · Reiter, Kleidung, Gefährte im Kampf, Vondu

- **Neue Oberteile (12–15):** Bluse (Kragen weiß, Schößchen, Knopfleiste, kurze Ärmel) · Rüschentop (drei Rüschenreihen, kurze Ärmel) · Strickjacke (offene Jacke im Oberteil-Ton über Shirt im 2. Ton, Knöpfe, Bündchen, Herz) · Sommerkleid (weit ausgestellt bis Wade, Schärpe mit Schleife im 2. Ton, Punkte). **Neue Unterteile (12–15):** Faltenrock · Tüllrock (zackiger Saum, Punkte) · Jeansrock (Mittelnaht, Taschen, Saumnaht) · Glockenrock (lang, Bund im 2. Ton). Alle Röcke zeigen die Beine in Hautfarbe. Zeichnung: `hero()` in `app/pixel-hero-fine.js`, Namen `TOPS_N` / `PANTS_N`.
- **Editor-Kacheln:** Oberteil = Ausschnitt 38 × 36 ab (8, 31), Hose = 34 × 31 ab (10, 50) aus `renderHero(cfg)` mit der aktuellen Figur, Anzeige 2×.
- **Gefährte im Kampf:** in jedem Kampf-Screen (7.4–7.17) an derselben Stelle wie der Held, nur leicht zum Gegner versetzt: Mitte = Fußmitte des Helden + 24 px, Fußlinie 4 px tiefer (steht weiter vorn). Er liegt über dem Helden (z-index 3, Held 2) und verdeckt dessen Beine; Kopf und Oberkörper bleiben sichtbar. Schaut nach rechts zum Gegner, 2× mit eigenem Pixel-Schatten. Maße: `PET_BATTLE` (im Helden-Container 108 × 174: `left:38px; bottom:-4px`). Bilder: `petBattleFrames(kind, color, 'idle' | 'attack' | 'hurt' | 'win' | 'die' | 'ko')`; synchron zum Helden über `petBattleSequence(kind, color, anim, start, zyklus)` mit 8 fps (Held `attack@4` → Gefährte springt ab Schritt 4 mit, Held `hurt@7` → Gefährte zuckt ab Schritt 7). `anim` darf auch die Schreibweise aus den Fragmenten sein: `'attack@4,hurt@12/16'`, `'win@9/48'`, `'die@3/48'`. Sieg (7.15, 7.16): `win`, hüpft in Schleife. Niederlage (7.17): `die`, danach `ko`. Der Gefährte bricht an seiner Stelle vor dem Helden zusammen und bleibt mit Sternen liegen. Animationsblatt 7.2: Live-Vorschau mit Gefährte, dazu Einzelbilder Stehen / Angriff / Treffer (1×).
- **Ebenen beim Angriff:** Während der Angriffsbilder hebt die Kampfbühne den Helden auf `z-index: 6` (damit Waffe und Vorstoß vor dem Gegner liegen). Der Gefährte geht im selben Bild auf `z-index: 7` mit und fällt danach zusammen mit dem Helden zurück (Gefährte 3, Held 2). Der Gefährte liegt also **immer** vor dem Helden – auch mitten im Angriff. Die Ausgangswerte vorher merken und danach wiederherstellen, nicht leeren.
- **Vondu (Tour):** Hand und Klinge bewegen sich als eine Einheit – der Körper wippt in Bild 2–3 um 1 px nach unten, Hand und Klinge folgen ein Bild später (Bild 3–4). In den Bildern mit Versatz ist die Fuge zwischen Hand/Klinge und Körper mit Tinte (`#1F1F24`) geschlossen, es blitzt nie Hintergrund durch. Daten: `VONDU_FRAMES`.

## Nachtrag · Alle 8 Waffen greifen eigen an

Jede Waffe hat eigene Schlüsselposen (`HERO_POSES[type]` in `app/pixel-anim.js`, von der Figur gezeichnet mit der angelegten Ausrüstung) und einen eigenen Ablauf. `posesFor(type)` gibt `HERO_POSES[type]` zurück (ohne Waffe `HERO_POSES.ohne`). `heroCombatSheet(cfg)` wählt Posen, Ablauf, Projektil und Aufprall selbst aus der angelegten Waffe – nichts davon nachbauen oder zuordnen. Alle Angriffe: 6 Bilder, 8 fps (125 ms je Bild); der Gegner spielt „Treffer“ genau beim Treffer-Bild (`sheet.hit`, `onHit`). Live zu sehen in 7.2 unter „Alle Waffen im Angriff“.

- **Schwert** – `ANIMS.attack`: holt über die Schulter aus (Bild 1–2), weißer Bogen (Bild 3), Treffer Bild 4 mit Funke.
- **Speer** – `ANIMS.attack`: zieht zurück (Bild 1–2), Stoß mit Speedlines (Bild 3), Treffer Bild 4.
- **Dolch** – `ATK.dolch`, Doppelstich: wind → strike (kleiner Funke `fx:'tick'`, Bild 2) → wind2 → strike2 (Funke, Treffer Bild 4) → halten → zurück. Vorstoß 7 bzw. 11 px.
- **Axt** – `ATK.axt`, Hieb von oben: Ausholen hinter dem Kopf mit Rücklage (Bild 1–2), Bogen nach unten (Bild 3), Treffer Bild 4; Funke im unteren Teil (`band:[.35,1]`).
- **Hammer** – `ATK.hammer`, Sprung + Bodenschlag: ducken (Bild 1), Sprung `dy:-5` mit erhobenem Hammer, Schatten schrumpft (Bild 2, Pose `lift`), Abwärtsbogen (Bild 3), Bodenschlag Bild 4 (`fx:'quake'`: Funke am Hammerkopf, zwei Staubwolken links/rechts, drei Steinchen), Bild 5 kleinere Wolken 3 px höher, Steinchen weiter oben (`fx:'dust'`).
- **Streitkolben** – `ATK.streitkolben`, Aufwärtsschlag: tief in die Knie, Kolben hängt vorn unten (Bild 1–2), Bogen von unten nach oben (Bild 3), Treffer Bild 4; Funke oben (`band:[0,.4]`).
- **Stab** – `ATK.stab`, Fernkampf (`sheet.ranged`): Stabkugel leuchtet größer mit Funkelpixeln (`glow:3.6`, Bild 1–2), Stab zeigt nach vorn, die Zauberkugel startet an der Stabkugel (Bild 3, `launch:2`), fliegt in 2 Schritten, Treffer Bild 5 (`hit:4`). Projektil `MAGIC.orb` (`sheet.projectile`, Kopf bei 67 % der Breite: `sheet.projectileHead`), am Ziel `MAGIC.burst` statt Funke (`sheet.impact`). `ProjectileLayer.fly(…, { impact, head })` übernimmt beides.
- **Bogen** – `ANIMS.shoot`: unverändert (Pfeil `ARROWS`, Funke am Ziel).

Effekte liegen im Animator (`frame()`): `fx:'spark'` großer Funke, `fx:'tick'` kleiner Funke (5 × 5), `fx:'quake'`/`'dust'` Staub (`PUFF`/`PUFF_S`, Farbe `#F3EBD8`) und Steinchen (`#7A5A3A`) am vordersten Punkt in Bodennähe. `band:[a,b]` = Höhenbereich (Anteil der Figurhöhe), in dem der Funke am vordersten Pixel sitzt.

## Nachtrag · Gefährten im Kampf (alle 20) · nichts wird abgeschnitten

**Kampfansicht aller Gefährten** – `petFacing(kind, color, dir = 1)` in `app/pixel-hero-fine.js`:
- Sieben Gefährten sind im Menü frontal gezeichnet: Eule, Krake, Frosch, Pinguin, Bär, Fledermaus, Schleim (`PET_TURN`). Für den Kampf werden sie mit derselben Technik wie der Held gedreht: `turned(() => pet(kind, color), 1, 24, { sort: true })`.
- Die übrigen 13 sind schon im Profil nach rechts gezeichnet; ihre Kampfansicht ist identisch mit `pet()`. `dir = -1` spiegelt.
- Menüs (Profil, Freunde, Auswahl 8.9) zeigen weiter die Vorderansicht `pet()`, mit Pixel-Schatten über `petMenuImage(kind, color)`.
- Referenz-Sprites: `dg:Pr{a}_{b}` = gedrehte Kampfansicht (nur die sieben aus `PET_TURN`), sonst `P{a}_{b}`.

**Animation für alle** – `petBattleFrames(kind, color, 'idle' | 'attack' | 'hurt' | 'win' | 'die' | 'ko')` rechnet jetzt immer mit `petFacing()`; `petFrames(img, anim)` ist die allgemeine Form für jede Ansicht. Schwebende Gefährten (unterstes Pixel mehr als 8 px über dem Boden: Biene, Fledermaus) wippen im Stehen ganz statt nur mit dem Oberkörper und werfen einen kleineren Schatten auf den Boden (`rx × .36`, `ry 1,8`). 7.2 zeigt im neuen Abschnitt „Alle Gefährten im Kampf“ alle 20 im 16er-Takt (Stehen · Sprung ab 4 · Stehen · Autsch ab 12) neben ihrer Menü-Ansicht.

**Profil und Freunde**: siehe „Menü-Bühne“ unten (ersetzt die getrennten Canvases von Figur und Gefährte).

**Nichts ragt mehr über die Leinwand** (oberstes/äußerstes Pixel ≥ 1 px vom Rand, die Kontur passt ganz hinein):
- Helm-Feder 2 px tiefer (`S.bez([[cx,7],[cx+4,1.2],[cx+10,3]], …)`), Frisur „Palme“ tiefer und etwas kürzer.
- Blick zum Gegner in Ruhe: Axt, Hammer, Streitkolben steiler (`REST_F = { axt: .05, hammer: .15, streitkolben: .2 }`, gilt nur ohne Pose), sonst lag der Kopf rechts außerhalb der 54 px.
- Posen (`HERO_POSES` in `app/pixel-anim.js`): axt.strike `hy -7`, hammer.strike `hy -5`, hammer.lift `hy -18`, speer/stab.ouch `hy 0`.
- Gefährten: `PET_FIT` (intern in `pixel-hero-fine.js`) passt Fuchs und Drache (waagerecht 96 %, +0,5 px), Schlange (−1 px) und Krake (−1 px nach oben) ein.
- Gegenstände: Handschuhe und Stiefel (`ITEMS` in `app/pixel-world-fine.js`) je eine Spalte schmaler, Kontur links und rechts ergänzt.

## Nachtrag · Menü-Bühne mit Gefährte · Seitenansicht jeder Option

**Menü-Bühne (8.1, 8.2, 8.3):** Figur und Gefährte sind EIN Bild: `heroWithPet(heroImg, petImg, { dx: 26, dy: 3 })` (bzw. `renderHeroWithPet(cfg, kind, color, scale)`) in `app/pixel-hero-fine.js`.
- Beide in Vorderansicht und im selben Maßstab (8.1 3×, 8.2/8.3 2×). Der Gefährte steht rechts leicht vor der Figur: linke Kante seines 40er-Bilds bei x = 26, Bodenlinie 3 px tiefer; er verdeckt das hintere Bein.
- Ein gemeinsamer Pixel-Schatten: Ellipsen von Figur und Gefährte als Vereinigung in einem Ton `#1F1F2461`, nie doppelt dunkel. Reihenfolge: Schatten → Figur → Gefährte. Schwebende Gefährten (Biene, Fledermaus) schweben über ihrem kleineren Schatten.
- Das Bild ist auf die Pixel zugeschnitten und endet mit der untersten Schattenzeile. Unten bündig setzen: In 8.2/8.3 schließt es mit den Kennzahl-Karten ab, in 8.1 bleiben 6 px bis zum Bühnenrand. Kein Schatten ragt in Karten oder Ränder.
- Ohne Gefährten: `shadowed(hero(cfg).render())` wie bisher.

**Seitenansicht (Kampf) für jede Option:** Sie wird nicht gezeichnet, sondern aus denselben Ebenen gerechnet: `turned(() => hero({ ...cfg, face: 1 }), 1, 34, { sort: false })`. Damit gilt sie automatisch für alle 20 Frisuren, 12 Augen, 12 Münder, 16 Oberteile, 16 Hosen, 3 Staturen, alle Farben und jede Ausrüstung. 8.11 zeigt jede Option vorn und im Kampf nebeneinander.
- Korrigiert: Der Pferdeschwanz (`zopf`) hing in der Kampfansicht vorn zum Gegner. Mit `face > 0` wird er jetzt samt Haargummi auf die Hinterkopfseite gespiegelt (`x → 54 − x`).
- Regel für neue Optionen: Alles, was hinten an Kopf oder Körper sitzt (Zopf, Dutt-Schleife, Umhang-Schließe …), bei `face > 0` auf die linke Seite spiegeln. Alles andere dreht `turned()` von selbst.
