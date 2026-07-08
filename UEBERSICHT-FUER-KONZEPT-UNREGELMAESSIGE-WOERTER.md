# English Stars — App-Übersicht (Briefing für Konzept „Unregelmäßige Wörter")

Dieses Dokument fasst zusammen, **wie die App heute funktioniert**, damit darauf
ein Konzept für unregelmäßige Wörter (v. a. unregelmäßige Verben:
go/went/gone) entwickelt werden kann. Es beschreibt den Ist-Zustand — keine
Vorschläge, nur die Fakten, an denen ein Konzept andocken muss.

---

## 1. Was die App ist

Deutsch→Englisch Vokabel-PWA für Grundschulkinder. Buildless Vite-PWA
(ESM-CDN), Module in `src/modules/`, Supabase-Backend. Login per E-Mail+Passwort
oder Google. Offline-fähig (PWA, Spracherkennung via Vosk offline).

Drei Modi (Toggle auf Startseite): **Freier Modus** (voll funktionsfähig),
**Schülermodus** (im Aufbau), **Kampagne** (Platzhalter). Der ganze unten
beschriebene Spiel-/Datenkern gehört zum Freien Modus.

---

## 2. Das Vokabel-Datenmodell — der zentrale Punkt

Eine Vokabel ist heute **ein flaches Paar**:

```js
{ de: 'gehen', en: 'to go', _presetId?: 'uuid' }
```

- `de` = deutsche Seite (Frage), `en` = englische Seite (Antwort).
- `en` darf **Alternativen mit `/`** enthalten: `'go/walk'` → beide gelten beim
  Tippen als richtig (`submitType` splittet an `/`).
- Führendes `'to '` wird bei der Aussprache/Normalisierung ignoriert.
- `_presetId` = stammt aus einer Vorlagen-Kategorie (sonst manuell angelegt).

Vokabeln liegen in **Sammlungen (Decks)**:
`SD.decks[deckId].vocab = [ {de,en}, … ]`. Das aktive Deck spiegelt seine
Vokabeln nach `window.VOCAB` — **alle Spiel-Logik liest nur `window.VOCAB`**.

> **Kernbeschränkung für das Konzept:** Es gibt aktuell **kein Feld für
> Wortformen** (Infinitiv / Past Simple / Past Participle). Ein unregelmäßiges
> Verb wäre heute nur als ein `{de,en}`-Paar abbildbar — die drei Formen
> (go / went / gone) haben keinen Platz im Modell. Genau hier muss ein
> Konzept ansetzen.

---

## 3. Die drei Spielmodi (Fragetypen)

Aus jedem `{de,en}` werden Fragen gebaut (`game.js` → `buildPool`). Pro Vokabel
gibt es **drei Übungsarten**, jede mit eigener Statistik:

| Modus | Typ | Frage | Antwort-Eingabe | statKey-Suffix |
|---|---|---|---|---|
| `vocab` | Multiple Choice | „🇩🇪 gehen" + 4 Buttons | Klick (1 richtig, 3 falsche aus anderen Vokabeln) | `_mc` |
| `spelling` | Tippen | „Schreibe auf Englisch: gehen" | Texteingabe (Vergleich case-insensitive, `/`-Alternativen) | `_sp` |
| `pronounce` | Aussprache | „Sprich auf Englisch: gehen" | Mikrofon → Vosk/Web-Speech, fuzzy-Vergleich | `_pr` |
| `mixed_vocab` | Prüfung | Mischung aus allen drei | — | (alle) |

- Falsche MC-Antworten sind **andere englische Wörter aus demselben Deck**
  (`wrongVocab`). Bei wenigen/ähnlichen Wörtern wird das relevant.
- Runde = 20 Fragen (`QPERROUND`), Prüfung = 30 (`EXAM_QUESTIONS`).
- Falsch beantwortete Fragen kommen am Rundenende als Wiederholung (halbe Punkte).

---

## 4. Statistik & Mastery (wie „gelernt" gemessen wird)

Pro Vokabel **und pro Übungsart** ein Eintrag in `wordStats`:

```
statKey = normDE(de) + '|' + normEN(en) + suffix   // suffix: _mc | _sp | _pr
wordStats[statKey] = { asked, correct, wrong, recent }
// recent = Binär-String der letzten Antworten "1011…" für gewichteten Schnitt (EMA)
```

- **normDE** = trim+lowercase; **normEN** = trim+lowercase + führendes „to " weg.
- „Gemeistert" = mind. 3 Versuche **und** ≥ 90 % (EMA) richtig
  (`MASTERY_THRESHOLD`, `MASTERY_MIN_ATTEMPTS`).
- Fortschrittsbalken/Prozente pro Modus rechnen über alle Wörter des Decks.
- Vorlagen-Wörter (`_presetId`) schreiben in einen **globalen** Topf
  (`SD.globalPresetStats`), manuelle Wörter ins Deck. Beides gleiche Struktur.

> **Folge für das Konzept:** Sobald ein Verb mehrere Formen hat, stellt sich die
> Frage, ob jede Form ein eigener statKey/„Wort" ist oder ob eine Verbform-Übung
> ein **neuer vierter Fragetyp** mit eigenem Suffix wird (z. B. `_vf`).

---

## 5. Vokabeln anlegen (woher Wörter kommen)

`vocab.js` (VokabelManager). Drei sich ausschließende Wege pro Deck (`deckPath`):
- **Manuell hinzufügen** (Einzeln / Einfügen mehrerer Zeilen).
- **Scannen** (Foto/OCR von Wortlisten).
- **Vorlagen** (Preset-Kategorien aus Supabase, max. 2 pro Deck).

Eingabeformat beim Einfügen ist Zeilen mit `deutsch - englisch` o. ä. → wird zu
`{de,en}`. Ein Format für Verbformen existiert dort heute **nicht**.

---

## 6. Cloud / Persistenz (nur zur Einordnung)

- `window.SD` = gesamter App-Zustand, in localStorage gespiegelt (`persist`).
- Supabase-Tabellen: `profiles`, `decks`, `word_stats`, `preset_stats`,
  `preset_category_progress`, `exams`.
- Sync-Modell: beim Öffnen **hart aus der Cloud laden** (Cloud = Wahrheit),
  jede Änderung wird bestätigt gespeichert; offline geht in eine Queue.
- **Eine neue Datenart (z. B. Verbformen) bräuchte** entweder ein zusätzliches
  Feld an der Vokabel/dem Deck (geht in `decks`-JSON mit) oder eigene
  Tabellen/Stat-Töpfe — analog zum bestehenden `globalPresetStats`-Muster.

---

## 7. Offene Design-Fragen, die ein Konzept klären muss

1. **Datenmodell:** Bekommt eine Vokabel optionale Formen
   (`{de, en, forms?: {past, participle}}`) oder werden Verben ein eigener
   Sammlungstyp? Das Spiegel-/Stat-/Sync-System hängt an `{de,en}`.
2. **Abfragerichtung:** Soll abgefragt werden „go → went/gone" (englische Formen),
   „Vergangenheit von go?", oder deutsch→englisch mit Zeitform? MC/Tippen/Aussprache
   müssten je definiert werden.
3. **Mastery-Zählung:** Gilt ein Verb erst als gemeistert, wenn alle Formen
   sitzen? Eigener Fragetyp-Suffix oder mehrere Wörter?
4. **Eingabe/Pflege:** Wie trägt man Verbformen ein (Scan? Vorlage? Format)?
5. **Kindgerecht:** Grundschulniveau — wie viele Formen, wie viel Grammatik-Last,
   passt es eher in Schülermodus/Kampagne als in den Freien Modus?

---

## 8. Relevante Dateien (zum Nachschlagen)

| Datei | Inhalt |
|---|---|
| `src/modules/game.js` | Fragetypen, Pool-Bau, Antwort-Prüfung, Punkte, Mastery-Anzeige |
| `src/modules/stats.js` | statKey, EMA, Mastery-Logik |
| `src/modules/decks.js` | Deck-CRUD, `window.VOCAB`-Spiegel |
| `src/modules/vocab.js` | Vokabeln anlegen/scannen/Vorlagen |
| `src/modules/config.js` | Konstanten (Rundenlänge, Mastery-Schwellen, Noten) |
| `ARCHITECTURE.md` | vollständige Architektur inkl. `SD`-Struktur & Sync |
| `KONZEPT-MODI.md` | die drei Modi |
</content>
</invoke>
