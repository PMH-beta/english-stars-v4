# App-Icons & Startbilder — English Stars

Alles aus `vondu-logo.svg` erzeugt, **ohne Wortmarke** (die Marke steht auf dem
Startbildschirm, nicht im Icon).

## Gestaltung

| | |
| --- | --- |
| Icon-Grund | **Lila `#C9B8FF`** — der Markengrundton, identisch mit dem Startbildschirm |
| Splash-Grund | **Lila `#C9B8FF`** — gleicher Ton wie das Icon, der Start springt dadurch nicht |
| Theme-Color | `#C9B8FF` |
| Logo-Anteil | 72 % der Kantenlänge (Standard) · 80 % (Favicon, damit es bei 16 px trägt) · 55 % (maskable / Android adaptive, damit nichts in die Beschnittzone läuft) |
| Kein Rahmen | Die 2-px-Tintenkontur der App-Oberfläche bleibt draußen — sie würde von jeder OS-Maske angeschnitten. Das Logo bringt seine eigene Kontur mit. |
| Hinweis | Das lila Schwert im Logo sitzt auf lila Grund — es liest über seine Tintenkontur, nicht über den Farbkontrast. Bei 16 px verschmilzt es leicht mit dem Grund; das ist bewusst in Kauf genommen, damit das Icon den Markenton trägt. |

Alle PNGs sind direkt aus der SVG in Zielgröße gerastert (nicht hochskaliert), damit die
Pixelkanten in jeder Größe scharf bleiben.

---

## iOS — `ios/`
`Contents.json` + 13 PNGs. Ordner in Xcode als `AppIcon.appiconset` in den Asset-Katalog legen
(oder nur `AppIcon-1024.png` als Single-Size-Icon verwenden, das reicht ab Xcode 14).

`AppIcon-1024.png` ist gleichzeitig das App-Store-Icon.

## Android — `android/`
| Datei | Ziel |
| --- | --- |
| `ic_launcher_foreground.png` (432) | `res/mipmap-xxxhdpi/` |
| `ic_launcher_monochrome.png` (432) | `res/mipmap-xxxhdpi/` — für die Themed Icons ab Android 13 |
| `ic_launcher_background.png` (432) | nur als Referenz; im XML wird die **Farbe** benutzt |
| `ic_launcher.xml` | `res/mipmap-anydpi-v26/ic_launcher.xml` |
| `colors.xml` | Werte in `res/values/colors.xml` ergänzen |
| `legacy/*.png` | `res/mipmap-<dpi>/ic_launcher.png` für Android < 8 |
| `play-store-512.png` | Play-Console-Eintrag |

## Web / PWA — `web/`
| Datei | Einsatz |
| --- | --- |
| `favicon.ico` | Browser-Tab (enthält 16 und 32 px) |
| `favicon-16/32/48/96.png` | moderne Browser |
| `apple-touch-icon.png` (180) | iOS-Homescreen |
| `icon-144/192/384/512.png` | Manifest, `purpose: any` |
| `maskable-192/512.png` | Manifest, `purpose: maskable` |
| `manifest.json` | fertig zum Einsetzen — Pfade auf `/icons/…` und `/splash/…` anpassen |
| `head-snippet.html` | alle `<link>`- und `<meta>`-Zeilen für `index.html` |

## Startbilder — `splash/`
Acht iOS-PWA-Startbilder (Lila-Grund, Logo mittig, 42 % der kurzen Kante). Die Media-Queries
dafür stehen komplett in `head-snippet.html`.

Android braucht keine Dateien: der Splash wird aus `background_color` + Manifest-Icon erzeugt.
Für einen nativen Android-Splash (`android:windowSplashScreenBackground`) `#C9B8FF` und
`ic_launcher_foreground` verwenden.

---

## Einbau in die bestehende PWA

```
public/
├── manifest.json            ← web/manifest.json
├── icons/                   ← alles aus web/ außer manifest.json und head-snippet.html
└── splash/                  ← alles aus splash/
```

Dann den Inhalt von `head-snippet.html` in den `<head>` der `index.html` — die bestehenden
`<link rel="icon">`- und `<link rel="manifest">`-Zeilen ersetzen, nicht ergänzen.

Service Worker: die neuen Icon-Pfade in die Precache-Liste aufnehmen und die Cache-Version
hochzählen, sonst hält der alte Cache das alte Icon fest.
