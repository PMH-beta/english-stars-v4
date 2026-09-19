# English Stars — Nachtrag zum Pastell-Entwurf

Stand: **v4.0.387**, 19.09.2026 · Grundlage: der gelieferte Entwurf „English Stars UI Pastell"
(32 Screens) ist in der App umgesetzt.

Beim Umsetzen hat sich gezeigt: Die App hat **rund 50 weitere Fenster, Zustände und Popups**,
die im Entwurf nicht vorkommen. Claude Code hat sie behelfsmäßig ins Pastell-System übertragen
oder sie stehen noch im alten Look. Dieses Dokument listet sie alle auf, damit sie in derselben
Sprache gestaltet werden.

**Screenshots** (`screens/`): heutiger Zustand der echten App, 402 × 874 px (@2x), lange Seiten
in voller Höhe. Sie zeigen **Inhalt und Feldreihenfolge** — das Aussehen soll aus dem
Pastell-System kommen, nicht aus dem Screenshot.

Legende: **(alt)** = steht noch im alten Look (weiße Karte, Weichschatten, Lila `#a86cdb`,
Emoji) · **(behelfsmäßig)** = von Claude Code ohne Vorlage ins Pastell-System übertragen.

---

## Regeln (unverändert aus dem Entwurf)

- Geräte-Grundton: **ein** Pastellton pro Screen; darüber das cremefarbene Blatt.
- `2px solid #1F1F24` auf jedem Element. Keine Schatten außer dem harten an der angehobenen Karte.
- Nur **Nunito**. Pixel-Icons nur in 14/28/42/56 px.
- **Emoji nur bei Charakter, Gefährte und Profilbild.** Alles andere ist Pixel-Art aus der
  Icon-Engine — fehlende Symbole bitte in derselben Engine ergänzen (Liste unten).
- Die 32 bestehenden Screens **nicht verändern**. Pixel-Sprites (Charakter, Gefährte, Waffen,
  Gegner, Kampfkulisse) bleiben wie sie sind.
- Maskottchen Vondu wie bisher nur auf Anmeldung, Name, Info-Popups und Dialogen.

## Neue Pixel-Symbole, die gebraucht werden

Heute stehen dort Emoji. Vorhanden sind die 45 Masken der Engine (`coin`, `crown`, `flame`,
`book`, `test`, `target`, `pencil`, `check`, `scan`, `speaker`, `trash`, `sword`, `shield`,
`potion`, `map`, `campfire`, `gem`, `paw`, `bossCrest` …).

| Symbol | wofür (heute als Emoji) |
|---|---|
| Mikrofon | Aussprache, „Sprich die Form" (🎙️) |
| Lupe | Freunde suchen, Erkennen-Disziplin (🔍) |
| Freunde (zwei Köpfe) | Freunde-Sektion (👥) |
| Wolke | Cloud-Konto (☁️) |
| Kalender | „Dabei seit" (📅) |
| Kiste | Vorlagen (📦) |
| Balkendiagramm | Statistik (📊) |
| Pfeilkreis | Zurücksetzen, Wiederholen (🔄) |
| Sanduhr | Warten, Zeittrank, Angefragt (⌛ ⏳) |
| Herz | Heiltrank, Leben (❤️) |
| Totenkopf | Niederlage (💀) |
| Konfetti/Fähnchen | Sieg (🎉) |
| Handy mit Pfeil | App installieren (📲) |
| Werkzeugkiste | Ausrüstung (🧰) |
| Pfeile kreuzen | Formen/Buchstaben ordnen (🔀) |
| Zauberstab | Verzaubern-Disziplin (🪄) |

Bewusst Emoji bleiben darf der **Meteor** im Meteoriten-Spiel (gehört zur Spielfläche).

---

## A · Vokabeln — Hauptmenü und Verwaltung

**N01 · Hauptmenü · Vokabeln, leer** — `1-vokabeln/vokabeln-01-leerzustand` (behelfsmäßig)
Kind hat noch keine Sammlung. Probetest-Zeile, darunter „Womit möchtest du starten?" mit zwei
Wahlkarten: *Vorlage auswählen* (Fertige Wortgruppen nehmen und sofort starten) und *Eigene
Sammlung anlegen* (Wörter selbst eingeben, einfügen oder scannen).

**N02 · Dialog · Neue Sammlung: Vorlage oder selbst** — `vokabeln-02-neue-sammlung-aufbau` (alt)
Nach „+ Neue Vokabelsammlung". Titel „Wie soll diese Sammlung aufgebaut werden?", Hinweis
„Einmalige Wahl — kann später nicht mehr geändert werden", zwei Wahlkarten (*Vorlage nutzen* /
*Selbst zusammenstellen*), Textknopf *Abbrechen*.

**N03 · Dialog · Lernvorlagen-Hinweis** — `vokabeln-03-lernvorlagen-hinweis` (alt)
Erscheint einmalig beim ersten Einschalten einer Vorlage: „Für den Anfang empfehlen wir 1 Vorlage.
Wer auffrischen will, kann 2 nehmen. Mehr als 2 gleichzeitig sind nicht möglich." Knopf *Verstanden*.

**N04 · Vokabeln verwalten · Vorlagen-Auswahl** — `vokabeln-04`, `-05`, `-08` (behelfsmäßig)
Bei einer Vorlagen-Sammlung hat „Vokabeln verwalten" die Tabs **Vorlagen · Liste (n) ·
Statistik**. Vorlagen-Tab: Erklärsatz, dann eine lange Liste (bis zu 60 Wortgruppen) mit Name,
Schwierigkeit (leicht/mittel/schwer), Wortzahl; eingeschaltete Gruppe mit Fortschritt (%) als
Füllung und Schalter „AN ✓". Höchstens 2 gleichzeitig an.

**N05 · Vokabeln verwalten · Text einfügen** — `vokabeln-06-verwalten-text` (behelfsmäßig)
Tabs einer eigenen Sammlung: **Hinzufügen · Text · Scan · Liste (n)**; darüber „Sammlung: …"
und *Umbenennen*. Text-Tab: Anleitung „Beste Erkennung mit dem Handy" (iPhone/Android),
großes Textfeld mit Beispiel, Knopf *Text auswerten*. (Der Hinzufügen-Tab ist im Entwurf.)

**N06 · Vokabeln verwalten · Scan** — `vokabeln-07-verwalten-scan` (behelfsmäßig)
Gestrichelte Ablagefläche: Scan-Symbol, „Bild auswählen oder Kamera öffnen", „JPG, PNG —
Tesseract-OCR (offline)". **Zweiter Zustand ohne Screenshot:** *Scan läuft* — Pille mit drei
hüpfenden Punkten und Text („Bild wird vorbereitet…" → „Texterkennung: 40 %"), danach geht es
in „Vokabeln prüfen" (im Entwurf). Fehlerzustand: „Texterkennung fehlgeschlagen".

**N07 · Vokabeln verwalten · Statistik der Sammlung** — `vokabeln-09-sammlung-statistik` (behelfsmäßig)
Je Übungsart (Vokabeln, Rechtschreibung, Aussprache) eine Tabelle: Deutsch · Englisch · Stand
(✓ 100 % / ~ 71 % / –) · richtig/falsch (Punkte).

**N08 · Hauptmenü · Probetest aufgeklappt** — `vokabeln-10-probetest-verlauf` (behelfsmäßig)
Probetest-Zeile offen: Knopf *Neuen Probetest starten*, darunter der Verlauf — je Eintrag die
Sammlungen („Tiere und Natur + Farben"), Note als Chip, %, „17/20 richtig", Datum, Löschen.

**N09 · Dialog · Probetest wählen** — `vokabeln-11`, `-12` (alt)
„Bis zu 2 Sammlungen wählen — gemischte Prüfung, ohne Speichern." Liste der Sammlungen mit
Häkchen und Wortzahl; ab 2 gewählten werden die übrigen blass. *Abbrechen* / *Start*.

**N10 · Spiel · Probetest** — `vokabeln-13-probetest-frage` (behelfsmäßig)
Wie die Spielmodi, aber gemischt (Auswahl, Tippen, Sprechen) und unten die Leiste „Prüfung"
statt des Modusfortschritts.

**N11 · Rundenende · Probetest mit Note** — `vokabeln-14-probetest-ergebnis` (behelfsmäßig)
Statt des Pokals die Note (1–6) im Kreis, „Gut!", „90 % richtig · Datum", ggf. „Neuer
Highscore!", drei Wertkacheln, nur *Hauptmenü*. Konfetti.

## B · Spielmodi

**N12 · Spiel · Aussprache (sprechen)** — `2-spiel/spiel-01-aussprache-mikrofon` (behelfsmäßig)
Der Entwurf zeigt „Hör zu und wähle" — **die App fragt aber gesprochen ab**: „Sprich auf
Englisch: DE Sonne", Anzeige des Gehörten, großer Knopf *Sprechen*. Zustände: bereit ·
**hört zu** (Aufnahme läuft, pulsiert) · **erkannt richtig** · **erkannt falsch** (mit dem
Gehörten) · *Nochmal versuchen*.

**N13 · Spiel · Aussprache, Selbstbewertung** — `spiel-02-aussprache-selbstbewertung` (behelfsmäßig)
Wenn die Spracherkennung nicht sicher ist: *Lösung anhören*, „Hör dir die Aussprache an und
entscheide:", *✓ Hatte ich richtig* / *✗ Daneben*.

**N14 · Spiel · Fehler** — `spiel-03-falsche-antwort` (behelfsmäßig)
Nur „Treffer" ist gezeichnet. Fehler: falsche Wahl rosa, richtige mint markiert, Vondu-Kasten
rosa „Üben hilft! Richtige Antwort: brown", Knopf *Weiter*.

**N15 · Spiel · Wiederholung der falschen Fragen** — `spiel-04-wiederholung-hinweis` (alt)
Zwischenkarte am Rundenende: „Jetzt nochmal die 1 falschen Fragen! Punkte zählen halb." —
danach laufen nur die falschen Fragen nochmal.

**N16 · Wiederholungsmodus (Schnell)** — `spiel-05-schnellmodus-an-dialog`, `-06-…-menue`, `-07-…-spiel`
Schalter „Schnell: Aus/An" im Vokabeln-Tab. Beim Einschalten ein Dialog („Nur zum schnellen
Üben — zählt NICHT in die Statistik …"). **Der Modus hat keinen eigenen Look mehr** (früher
dunkel): Menü und Spiel sehen aus wie normal. Gesucht: ein klares, aber ruhiges Zeichen „du bist
im Wiederholungsmodus" in Menü und Spiel.

**N17–N22 · Spiel · Formen, alle Aufgabenarten** — `formen-01` … `formen-06` (alt/behelfsmäßig)
Trainingsplatz und Schmiede-Aufträge üben in drei Disziplinen, die Aufgabenart wechselt
zufällig. Im Entwurf ist nur „Formen tippen" gezeichnet.
- **N17 Formen ordnen** — `formen-01`: Plakette „Alle drei Formen", „Zieh die Formen in die
  richtige Reihenfolge", drei Ablagen (Present · Simple Past · Past Participle), Kacheln
  *go · gone · went*, *Prüfen*.
- **N18 Falsche Form korrigieren** — `formen-02`: falsche Form groß in Rot („getted"),
  „Diese Form ist falsch — welche stimmt?", vier Antworten.
- **N19 Formen tippen** — `formen-03` (entspricht „Spiel · Formen"; heute noch mit alter
  Plakette und Regenbogenstreifen).
- **N20 Buchstaben ordnen** — `formen-04`: leere Buchstabenfächer, Kacheln *h · d · a*.
- **N21 Fehlender Buchstabe** — `formen-05`: „m _ d e", nur ein Buchstabe wird getippt.
- **N22 Form sprechen** — `formen-06`: „Sprich die Form", Mikrofon wie N12.
- Dazu die **Form-Plaketten** (Simple Past · Past Participle · Alle drei Formen), heute bunte
  Altfarben, und unten die Leiste „Schmiede 0 % · 0/20 gemeistert".

## C · Formen-Tab: Trainingsplatz und Schmiede

**N23 · Hauptmenü · Formen, Trainings-Deck offen** — `3-formen-tab-schmiede/formen-tab-01` (behelfsmäßig)
Trainingsplatz aufgeklappt: *Neues Trainings-Deck*, Deck-Karte („Verben-Set A · 10 Verben ·
Beide Formen · 0/3 Taler · %"), darunter die drei Disziplinen als Modus-Zeilen (Erkennen,
Schmieden, Verzaubern mit „x/20 gemeistert · bei 100 % 1 Taler") und die Aktionen *Statistik ·
Zurücksetzen · Löschen* (heute mit Emoji).

**N24 · Dialog · Neues Trainings-Deck** — `formen-tab-02`, `-03` (behelfsmäßig)
Name, Formen-Wahl (Simple Past · Participle · Beide), Zähler „4/10", Liste aller Verben mit
Häkchen, Deutsch, Englisch; Verben, die schon in einem Deck derselben Form stecken, sind
„vergeben" und ausgegraut. *Abbrechen* / *Anlegen* (erst bei genau 10).

**N25 · Statistik · Trainings-Deck** — `formen-tab-04` (behelfsmäßig)
Eigener Screen: Kopf mit Deckname und %, je Disziplin eine Tabelle Deutsch · Englisch ·
Simple Past · Participle mit Stand je Form.

**N26 · Hauptmenü · Formen, Schmiede-Stationen** — `formen-tab-05`, `-06`, `-06b` (behelfsmäßig)
Der Entwurf zeigt eine einzelne Station. In der App gibt es **mehrere Aufträge** untereinander:
Kopf (Name, Löschen), die Waffe auf Sand, **Wischen zwischen Stahl (Simple Past) und Gold (Past
Participle)** mit Pfeilen ‹ › und zwei Punkten, Schritt-Balken „Schmieden 20 %", fertige
Stücke mit „✓ Gefährte fertig". *Wörter anzeigen ▾* klappt die Verbliste des Auftrags auf
(`-06`). Darüber die Kacheln Stationen · Schritte · noch frei und *Werkstoff wählen*.

**N27 · Dialog · Was willst du schmieden?** — `formen-tab-07`, `-08` (behelfsmäßig)
Liste aller Objekte mit Pixel-Bild und Wirkung (Speer: +2 Schaden gegen Bosse, Helm: wehrt
verlorene Wellen ab …). Zustände: frei (›), wird geschmiedet (x %), fertig (✓).

**N28 · Dialog · Auftrag befüllen** — `formen-tab-09`, `-10` (behelfsmäßig)
„Speer befüllen — Wähle genau 10 Wörter, die du üben willst", Zähler 0/10, Verbliste mit
Stufe (A1/A2 …), *← Objekt* / *Fertig*.

**N29 · Info · Die Schmiede** — `formen-tab-11` (behelfsmäßig)
Heute ein langer Erklärtext im Dialog. Der Entwurf hat „Vondu-Info · Popup" mit drei
nummerierten Schritten — bitte an den aktuellen Inhalt anpassen (zwei Waffen je Station,
5 Teile, drei Disziplinen, Verzaubern erst später, Wischen zwischen den Waffen).

## D · Kampagne und Kampf

**N30 · Hauptmenü · Kampagne ohne Lauf** — `4-kampagne-kampf/kampagne-01`, `-02`, `-02b` (behelfsmäßig)
Drei Zustände über einer Vorschau der Karte („So sieht eine Karte aus — mit 2 Taler geht's
los"): **gesperrt** („Bring erst 2 Übungsarten auf 100 % … Freigeschaltet 0/2"), **bereit**
(„Setze 2 Taler ein …", Deine Taler, *Kampagne starten (2 Taler)*), **zu wenig Taler**
(Knopf gesperrt + Hinweis). Vierte Variante ohne Screenshot: nach einem Boss-Sieg ist der
nächste Lauf **kostenlos**.

**N31 · Dialog · Schatz: Trank wählen** — `kampagne-03-schatz-trank-waehlen` (behelfsmäßig)
„Schatz gefunden! Wähle einen Trank für diesen Lauf": Schildtrank, Zeittrank, Heiltrank je mit
Wirkung (heute Emoji). Mit Ring gibt es mehr Auswahl.

**N32 · Rastplatz** — `kampagne-04-rastplatz-heute-nur-toast` (neu gestalten)
Heute nur ein kurzer Toast „Ausgeruht: +15 HP". Gewünscht: ein kleiner eigener Moment am
Lagerfeuer (Dialog oder Szene) mit dem geheilten Leben.

**N33 · Karte · Trank-Info** — ohne Screenshot
Tippen auf einen Trank in der Kopfleiste der Karte zeigt eine kleine Infoblase mit Name und
Wirkung; nochmal tippen schließt sie.

**N34–N37 · Kampf · die vier Minispiele** — `kampf-01` … `kampf-04` (behelfsmäßig)
Die Kopfleiste und die Lebensleisten sind im Entwurf („Kampf · Pixel bleibt"), das Spielfeld
darüber nicht:
- **N34 Wort-Meteoriten** — `kampf-01`: deutsches Wort oben, 4 englische Wörter fallen als
  Meteore; den richtigen antippen, bevor er einschlägt.
- **N35 Richtig oder falsch?** — `kampf-02`: Zeitbalken, drei Punkte (3 Paare), Wortkarte
  „DE Ei — egg", Knöpfe *Falsch* / *Richtig*.
- **N36 Echo-Fang** — `kampf-03`: „Welches Wort hörst du?" mit Nochmal-hören, Zeitbalken,
  5 treibende Wortkarten.
- **N37 Buchstabensturm** — `kampf-04`: deutsches Wort, Zeitbalken, leere Buchstabenfächer,
  treibende Buchstaben.
- Formen-Varianten ohne Screenshot: dieselben Spiele mit Verbformen („go → welche Form hörst
  du?", Plakette 🌀).
- Regel: ein Fehlgriff kostet Leben, die falsche Option verschwindet, das Spiel läuft weiter.

**N38 · Kampf · Gegner besiegt** — `kampf-06-sieg` (alt)
**N39 · Kampf · Boss besiegt** — `kampf-07-boss-besiegt` (alt)
**N40 · Kampf · Niederlage** — `kampf-05-niederlage` (alt)
Der gezeichnete „Kampf · Sieg" passt nicht zur Logik: es gibt keine Punkte und Taler pro Welle.
Tatsächlich: **Sieg** = Gegner besiegt → „Der Weg ist frei — wähle den nächsten Knoten",
*Weiter* (zurück zur Karte). **Boss besiegt** = Lauf geschafft, +1 Taler, *Neue Runde starten*,
Konfetti. **Niederlage** = Leben auf 0, Lauf vorbei, Einsatz (2 Taler) weg, Aufstieg beginnt
wieder bei Runde 1, *Weiter*. Im Hintergrund zerfällt der Gegner bzw. kippt der Held um.

**N41 · Kampf · Schutz-Meldungen** — ohne Screenshot
Kurze Einblendung über der Figur, wenn Ausrüstung oder Trank wirkt: Schildtrank wehrt eine
verlorene Welle ab, Helm blockt, Stiefel/Dolch: ausgewichen, Gefährte fängt einen Fehler.

## E · Profil und Fortschritt

**N42 · Profil · angemeldet, mit Freunden** — `5-profil-global/profil-01` (alt)
Der Entwurf zeigt nur den abgemeldeten Zustand. Angemeldet: Freunde-Sektion mit Suchfeld,
**Anfragen** (Annehmen ✓ / Ablehnen ✕), **Freundesliste** (Profilbild, Name antippbar →
N46, Entfernen), **Gesendet** (⏳ Angefragt, Zurückziehen). Darunter **Cloud-Konto
angemeldet**: E-Mail, „Fortschritt wird synchronisiert", *Abmelden*.

**N43 · Profil · Freunde suchen** — `profil-02-freunde-suche` (alt)
Ergebnisse mit vier Zuständen rechts: *Anfrage* (neu), *Annehmen* (hat mich angefragt),
Angefragt (warte), ✓ Freunde. Leerzustand „Niemand mit „…" gefunden".

**N44 · Profil · Ausrüstung: Slot gewählt** — `profil-03-ausruestung-slot-tasche` (behelfsmäßig)
Slot antippen → darunter erscheint die Tasche mit den passenden, nicht angelegten Teilen
(leere Plätze gestrichelt). Teile lassen sich auch auf den Slot ziehen.

**N45 · Profil · Ausrüstung: Teil-Vorschau** — `profil-03b-ausruestung-teil-vorschau` (behelfsmäßig)
Teil angetippt: Karte mit Bild, Name („Stahl-Gefährte ✨"), Wirkung, *Anlegen* bzw.
*Ablegen*; die Werte-Tabelle zeigt die Änderung (grün/rot) als Vorschau.

**N46 · Fortschritt · eines Freundes** — `profil-04-fortschritt-eines-freundes` (behelfsmäßig)
Wie „Fortschritt", aber mit Name des Freundes im Titel, seiner Figur, Bossen und Talern —
nur ansehen, nichts bearbeiten.

**N47 · Charakter · erster Start** — `profil-05-charakter-erster-start` (behelfsmäßig)
Onboarding nach der Namenseingabe: ohne Zurück-Knopf, Überschrift, Namensfeld und
Gefährten-Wahl — nur die Figur und ihre Merkmale, unten *Los geht's!*.

## F · Überall

**N48 · App installieren** — `global-01-app-installieren-knopf` (alt)
Nur im Browser (nicht in der installierten App), heute ein grüner Knopf, der im Menükopf den
Namen verdeckt. Auf iPhone öffnet er eine Anleitung (Teilen → Zum Home-Bildschirm). Gesucht:
ein Platz, der nichts verdeckt.

**N49 · Toast** — `global-02-toast` (behelfsmäßig): kurze Meldung oben („Ausgeruht: +15 HP").
**N50 · Speichern-Hinweis** — `global-03-speichern-hinweis` (behelfsmäßig): „Speichern…" oben,
bei Zeitüberschreitung Toast „Im Hintergrund gespeichert".
**N51 · Menü lädt** — `global-04-menue-laedt-skelett` (alt): beim Start, solange der
Fortschritt aus der Cloud kommt; Name „Lädt…", Ladekreis, Platzhalter-Karten.
**N52 · Musik und Lautstärke** — `global-05-musik-lautstaerke-desktop` (behelfsmäßig):
Musikknopf unten rechts auf jedem Screen; am Computer zusätzlich ein Lautstärke-Regler.
**N53 · Ziehen zum Neuladen** — ohne Screenshot: auf Menü, Profil und Fortschritt nach unten
ziehen, eine Leiste oben zeigt den Zug, beim Loslassen wird der Stand aus der Cloud neu geladen.
**N54 · Versionsnummer** — steht auf dem Startscreen heute doppelt (Fehler). Bitte festlegen,
wo sie einmal steht.

## Nicht nötig

Einfache Ja/Nein- und Hinweis-Dialoge (Sammlung sperren, zurücksetzen, umbenennen, Aufgeben,
Freund entfernen …) folgen der gelieferten Vorlage „Dialog · Sammlung löschen" bzw.
„Vondu-Info · Popup".
