# English Stars · Update 1 — Prompt für Claude Code

> Kopiere alles ab „Prompt“ in Claude Code. Dieser Ordner (`claude_code_update/`) enthält **nur die Änderungen** seit dem ersten Handoff (`design_handoff_english_stars_pastell/`). Alles andere gilt dort weiter.

---

## Prompt

Lies `claude_code_update/UPDATE-PROMPT.md` und setze die fünf Änderungen unten um. Es gelten weiter die Regeln aus `design_handoff_english_stars_pastell/CLAUDE-REGELN.md`, vor allem:

- **Frag mich vor jeder Funktionsänderung.** Das betrifft Spielregeln, Abläufe, Datenmodell, Speicherung, Belohnungen und alles, was nicht rein optisch ist. Rein optische Änderungen setzt du direkt um.
- Interpretiere nichts. Wenn eine Vorlage etwas nicht zeigt, frag nach, statt zu raten.
- Die Pixel-Grafiken nimmst du 1:1. Nicht neu zeichnen, nicht glätten, immer mit `image-rendering: pixelated` und ganzzahligem Maßstab.
- Arbeite eine Änderung nach der anderen ab und zeig mir nach jeder kurz, was du geändert hast.

### 1 · Gedrückt-Zustand für alles Antippbare (Stil A)

Vorlage: `screens/A.1-…`, `screens/A.2-…`

- Gilt für **jedes** antippbare Element in der App: Knöpfe, Kacheln, Reiter, Listeneinträge, Icons mit Funktion.
- **Ruhezustand:** kein Schatten. Feste Schlagschatten an Knöpfen fallen weg, auch im Kampf.
- **Beim Drücken** (pointerdown bis pointerup/cancel):
  - Helle Fläche: `box-shadow: inset 4px 5px 0 rgba(31,31,36,.28)` und die Hintergrundfarbe ×0.94 (leicht dunkler).
  - Dunkle Fläche (Helligkeit < 60): `box-shadow: inset 3px 4px 0 rgba(0,0,0,.6)` und Hintergrund `#34343C`.
  - Transparente Fläche: Hintergrund `rgba(31,31,36,.05)` und der helle Schatten.
- Ohne Übergang, sofort, wie beim Verschieben einer Sammlung (2.5). Rahmen und Größe bleiben gleich.
- Referenz-Logik im Design: `pressInit()` in `English Stars UI Pastell.dc.html`.

### 2 · Reiter bündig (8.4 – 8.10)

Vorlage: `screens/B.2-…`

- Die Reiter laufen von Kante zu Kante.
- Die Kachel darunter ist oben eckig, unten bleibt sie rund.
- So schneidet keine Rundung mehr in den ersten und den letzten Reiter.

### 3 · Kampf: Aufbau, Schrift, Richtig/Falsch

Vorlagen: `screens/F.1` – `F.11` (alle Kampfarten), `E.1` (Schrift), `E.5`/`E.6` (Rückmeldung)

- **Drei Ebenen:**
  1. **Aufgabe:** ein Panel oben mit Kopfband in der Farbe des Modus und dem Zeitbalken direkt darunter.
  2. **Spielfeld/Antwort:** farbige Kacheln.
  3. **Status:** dunkle Leiste unten mit beiden Lebensbalken.
- **Antippbare Steine:** Alles Antippbare im Spielfeld sind Pixel-Steine mit Kante. Meteoriten brennen, Echo-Blasen schweben, Buchstaben sind Runensteine.
- **Schrift (E.1):** Eine Schrift (Nunito) in vier Stufen:
  - Groß 900/28 px: Aufgabenwort, Buchstaben, Schaden
  - Knopf 900/16 px: Antwortknöpfe, Rückmeldung
  - Text 800/13 px: alles andere
  - Klein 900/10 px: nur Zähler und Sprachkürzel

  Keine Großbuchstaben, kein Sperrsatz. Grau nur für Nebensachen.
- **Richtig/Falsch (Pflicht):** Richtig ist immer grün mit Haken (`#6CCB8F`, Kante `#4EAD73`), falsch immer rot mit Kreuz (`#FF7F86`, Kante `#E25F68`, Fläche `#FFBBC1`).
- **Gestrichen:** das DE-Kästchen über dem Wort, der Rahmen um die Zeit und die doppelte Wellen-Angabe.
- **Schatten:** keine festen Schatten auf Kampf-Elementen, nur der Gedrückt-Zustand aus Punkt 1.
- **Was gleich bleibt:** Kampfarten, Regeln, Zeiten und Schaden. Wenn dir beim Umbau etwas davon anders vorkommt: **fragen**.

### 4 · Kampfplätze ohne Skalierung

Vorlagen: `arena-wide/*.png`, `screens/D.1-…`

- **Format:** Sechs Kampfplätze (`A_wiese`, `A_abend`, `A_kerker`, `A_kristall`, `A_vulkan`, `A_friedhof`), je **2560 × 720 px**. Angezeigt im Maßstab **2**, also 5120 × 1440.
- **Position:** unten mittig: `left:50%; bottom:0; transform:translateX(-50%)`, mit fester Breite und Höhe in px.
- **Nie skalieren:** kein `cover`/`contain` und keine Prozentgrößen. Wird das Fenster breiter oder höher, sieht man einfach mehr Landschaft.
- **Gleich bleiben:** Figuren, Gefährte, Gegner und Boden behalten Größe und Position relativ zur unteren Mitte.
- **Handy:** Es zeigt genau den bisherigen Ausschnitt, also die mittleren 201 × 437 px unten mittig, im Maßstab 2 = 402 × 874.
- Die PNGs sind fertig und ersetzen die bisherigen Kampfplatz-Hintergründe. Nichts daran nachzeichnen oder kacheln.

### 5 · Boss-Symbol = Krone

Vorlage: `icons/bossCrest.png` (13 × 10 px), Vorschau `icons/bossCrest-8x.png`

- Das Icon `bossCrest` ist jetzt die goldene Pixel-Krone wie auf der Kampagnenkarte.
- Es ersetzt den bisherigen Totenkopf überall, wo ein Boss markiert wird, z. B. Boss-Welle und Kampagnen-Boss.
- Pixel-Raster (ohne automatische Kontur):

```
.K....K....K.
KYK..KYK..KYK
KAK..KAK..KAK
KAAK.KAK.KAAK
KAAAKAAAKAAAK
KAAAAAAAAAAAK
KARAAALAAARAK
KAAAAAAAAAAAK
KOOOOOOOOOOOK
KKKKKKKKKKKKK
K #1F1F24  Y #FFE9A8  A #FFD66B  R #FFBBC1  L #C9B8FF  O #E0A82E
```

---

## Inhalt dieses Ordners

- `UPDATE-PROMPT.md`: diese Datei
- `screens/`: Referenz-Markup der neuen Entwürfe (A, B, E, F, D), nur Inline-Styles. `data-paint`/`data-anim` funktionieren wie im ersten Handoff.
- `arena-wide/`: 6 Kampfplätze, 2560 × 720 px
- `icons/`: Boss-Krone

Die Entwürfe kannst du dir live ansehen: `English Stars UI Pastell.dc.html` im Design-Projekt, Abschnitt „Entwürfe“ ganz oben.
