# START HERE — Nachtrag an Claude Design übergeben

Inhalt dieses Ordners:

| | |
|---|---|
| `NACHTRAG.md` | Die Liste aller fehlenden Fenster N01–N54: wann sie erscheinen, Inhalt in Reihenfolge, Zustände, was heute nicht passt, fehlende Pixel-Symbole |
| `screens/1-vokabeln/` … `5-profil-global/` | 62 Screenshots der echten App (Ist-Zustand), in fünf Portionen à 11–14 Bilder |

`screens/` liegt nicht in git (wie beim ersten Handoff) — nur auf diesem Rechner.

## 1. Wo

Im **selben Claude-Design-Projekt**, in dem „English Stars UI Pastell" entstanden ist. Dort
kennt Claude Design schon Palette, Bausteine, Vondu und die Icon-Engine — der Nachtrag baut
darauf auf.

## 2. Nachricht 1 — Auftrag + Teil 1

Anhängen: `NACHTRAG.md` und alle Bilder aus `screens/1-vokabeln/`. Dazu:

```
Das ist ein Nachtrag zum Pastell-Redesign „English Stars UI Pastell". Die 32 Screens daraus
sind in der App umgesetzt. Beim Umsetzen hat sich gezeigt, dass die App noch rund 50 weitere
Fenster, Zustände und Popups hat, die im Entwurf fehlen. NACHTRAG.md listet sie auf (N01–N54),
die Screenshots zeigen den heutigen Zustand der echten App.

Bitte gestalte sie im bestehenden Pastell-System — als weitere Screens in derselben Datei, mit
denselben Bausteinen, Tokens und derselben Icon-Engine, und mit genau den Labels aus
NACHTRAG.md (z. B. „N12 · Spiel · Aussprache (sprechen)"). Inhalte und Feldreihenfolge vom
Screenshot übernehmen, das Aussehen aus dem Pastell-System. Die 32 bestehenden Screens bitte
nicht verändern. Fehlende Pixel-Symbole (Liste in NACHTRAG.md) in der Icon-Engine ergänzen.

Ich schicke die Screenshots in fünf Teilen. Das hier ist Teil 1 von 5 (Vokabeln).
Bitte noch nicht loslegen — warte, bis alle fünf Teile da sind.
```

## 3. Nachrichten 2 bis 4

Jeweils die Bilder des Ordners anhängen:

```
Teil 2 von 5: Spielmodi und Formen-Aufgaben (Abschnitt B). Bitte weiter warten.
```
```
Teil 3 von 5: Formen-Tab, Trainingsplatz und Schmiede (Abschnitt C). Bitte weiter warten.
```
```
Teil 4 von 5: Kampagne und Kampf (Abschnitt D). Bitte weiter warten.
```

## 4. Nachricht 5 — letzter Teil, dann loslegen

```
Teil 5 von 5: Profil, Fortschritt und alles Übergreifende (Abschnitte E und F).
Jetzt kannst du loslegen, am besten in der Reihenfolge A bis F. Wo NACHTRAG.md eine
Entscheidung offen lässt — N16 Wiederholungsmodus, N32 Rastplatz, N38–N40 Kampf-Ende,
N48 App installieren, N54 Versionsnummer —, zeig mir bitte zuerst einen Vorschlag.
```

Passen bei dir alle Bilder in eine Nachricht, geht es auch in einem Rutsch: `NACHTRAG.md` plus
alle fünf Ordner, und am Ende von Nachricht 1 statt „Bitte noch nicht loslegen …" den Text aus
Schritt 4 verwenden.

## 5. Zum Schluss: Export

```
Bitte exportiere den Nachtrag als Übergabepaket für Claude Code wie beim letzten Mal:
README mit allen neuen Labels, die aktualisierte .dc.html (bestehende und neue Screens)
und die erweiterte Icon-Engine.
```

Das Paket kommt als `design_handoff_nachtrag_pastell/` ins Repo, neben
`design_handoff_english_stars_pastell/`. Dann in Claude Code:

```
Lies design_handoff_nachtrag_pastell/README.md und design_handoff_nachtrag/NACHTRAG.md
und sag mir, in welcher Reihenfolge du den Nachtrag umsetzen würdest. Noch nichts ändern.
```
