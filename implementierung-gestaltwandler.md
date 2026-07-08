# Umsetzungs-Briefing — „Gestaltwandler" (unregelmäßige Verben) für English Stars v4

Dieses Dokument ist für Claude Code. Es beschreibt, **was** gebaut wird und **wie** es an
den bestehenden Kern andockt. Zusammen mit diesem Briefing übergeben: `irregular-verbs.js`
(150 Verben + Lehrplan-Tabelle).

Leitprinzip: Der Verb-Modus reitet auf den vorhandenen Schienen. Drei Spielmodi sind
deine drei bestehenden Fragetypen, der „Boss" ist `mixed_vocab`, Mastery bleibt
`≥ 3 Versuche & ≥ 90 % EMA`. Es wird nichts dupliziert.

---

## 1. Datenmodell

Eine Vokabel bekommt **optionale** Felder — kein neuer Sammlungstyp:

```js
{ de: 'gehen', en: 'to go', forms: { past: 'went', participle: 'gone' }, art: 'einzel', tier: 1 }
```

- Anwesenheit von `forms` = das Verb-Flag. Ohne `forms` verhält sich alles wie heute.
- `en` bleibt der Infinitiv (Anker). `forms.past` / `forms.participle` dürfen „/"-Alternativen
  enthalten (`burnt/burned`) — nutzt die vorhandene Split-Logik.
- Reitet im `decks`-JSON mit → kein Sync-Umbau.
- Die 150 Verben kommen als **Preset-Kategorie** „Unregelmäßige Verben" rein (Stats in
  `globalPresetStats`, wie andere Presets). Datenquelle: `irregular-verbs.js`.

---

## 2. Stat- & Mastery-Modell

Pro Verb werden **Form × Kompetenz** getrennt geführt — als erweiterte Suffixe unter *einer*
Verb-Identität (`normDE|normEN`), damit das Verb *ein* Wort im Deck bleibt:

```
_past_mc  _past_pr  _past_sp        (Vergangenheit: lesen / sprechen / schreiben)
_pp_mc    _pp_pr    _pp_sp          (Partizip:      lesen / sprechen / schreiben)
```

Jeder Suffix bekommt einen normalen `wordStats`-Eintrag (`asked/correct/recent`, EMA wie
bisher). „Verb-Stern" = Aggregat der **aktiven** Suffixe (Partizip-Suffixe sind level-gated,
siehe §5).

---

## 3. Spielmodi

Drei **reine** Modi (je eine Kompetenz), Mischen erst spät:

| Modus | Suffix | Eingabe |
|---|---|---|
| Erkennen | `_mc` | Multiple Choice (lesen) |
| Rufen | `_pr` | Mikrofon → Vosk (sprechen) |
| Schmieden | `_sp` | Texteingabe (schreiben) |
| Vollwandlung | mixed | = `mixed_vocab`, mischt alle drei |

- Die **Basisfrage** `gehen → go` bleibt der normale Vokabel-Modus. NEU obendrauf die
  Transformation *innerhalb* des Englischen: `go → went`, `go → gone`.
- **Vollwandlung** für ein Verb/eine Art schaltet erst frei, wenn alle drei reinen Modi
  gemeistert sind.
- **MC-Distraktoren für Verbformen:** NICHT andere Deck-Wörter, sondern verlockend falsche
  Formen (`goed`, `cutted`, `cutten`). Kleiner Zusatz in `buildPool` nur für den Verb-Fragetyp.

---

## 4. Methoden-Leiter pro Disziplin

Jede Disziplin hat drei Methoden von leicht nach schwer:

| Stufe | Erkennen | Rufen | Schmieden |
|---|---|---|---|
| leicht | 4er-Auswahl | gezeigte Form vorlesen | Buchstaben ordnen / `w_nt` |
| mittel | Zuordnen / Lücke im Satz | Form aus dem Kopf sagen | Korrigieren (`goed → went`) |
| schwer | Hochstapler entlarven / einsortieren | ganze Kette/Satz sprechen | frei tippen / Lückentext |

(„Hör-Diktat" und „Echo" wären eine vierte Lane — hängen aber an TTS, siehe §8.)

---

## 5. Hochrück-Logik (Methodenstufe)

Pro (Verb × Disziplin) ein kleiner Zustand `lvl` (1/2/3) zusätzlich zum `wordStats`-Eintrag.
Jede Disziplin klettert unabhängig.

```js
const LVL = { up2: 0.80, up3: 0.90, down: 0.50, minTries: 3, window: 5 };

function updateLevel(s, correct) {            // s = Disziplin-Stat des Verbs
  s.lvl = s.lvl || 1;                          // 1=leicht 2=mittel 3=schwer
  if (s.grace) { s.grace = 0; return s.lvl; }  // Schonfrist nach Aufstieg
  s.lvlBits = ((s.lvlBits || '') + (correct ? '1' : '0')).slice(-LVL.window);
  if (s.lvlBits.length < LVL.minTries) return s.lvl;

  const ema = emaOf(s.lvlBits);                // vorhandene EMA-Logik
  if (s.lvl === 1 && ema >= LVL.up2) promote(s, 2);
  else if (s.lvl === 2 && ema >= LVL.up3) promote(s, 3);
  else if (s.lvl > 1 && ema < LVL.down) { s.lvl--; s.lvlBits = ''; }
  return s.lvl;
}
function promote(s, lvl) { s.lvl = lvl; s.lvlBits = ''; s.grace = 1; }
const isMastered = (s) => s.lvl === 3 && emaOf(s.lvlBits || '') >= LVL.up3;
```

- `up3 = 0.90` = die bestehende Mastery-Schwelle.
- **Stufe ⟂ Spaced Repetition:** `lvl` bestimmt nur die *Methode*; *wann* das Verb wiederkommt,
  regelt weiterhin die vorhandene SR-Logik.
- Eine Runde mischt sich von selbst, weil ein Kind Verben auf allen Stufen gleichzeitig hat.
  Zusätzlich gelegentlich eine leichte Variante einstreuen (Interleaving) — nie „alles schwer".

---

## 6. Level- / Lehrplan-Gating

Aus `irregular-verbs.js`: `tier` (1–5 ≈ A1–C1) + `CURRICULUM[schulart][klasse]` → Tier-Decke.

- `expectedVerbs(schulart, klasse)` liefert den Soll-Satz eines Schülers.
- Aktive Verben = `tier ≤ Decke`. Innerhalb: **Vergangenheit zuerst**, Partizip-Suffixe schalten
  erst auf höherem Level dazu.
- Curriculum ist bewusst editierbar (Bundesland-Unterschiede).

---

## 7. Lernstand-Ansicht

Eigene Ansicht (passt in Schülermodus), liest aus `wordStats`:
- erwartet (= `expectedVerbs`) vs. beherrscht (voll / teilweise / offen)
- Aufschlüsselung nach Kompetenz (lesen/sprechen/schreiben) und nach Art
- „offene Verben üben" startet eine gezielte Runde aus den Lücken

---

## 8. Offene Entscheidungen (NICHT raten — bei Mowel rückfragen)

- **TTS / Audio-Wiedergabe:** Vosk kann nur erkennen, nicht vorsprechen. „Hör-Diktat", „Echo"
  und die read/read-Hörfallen brauchen TTS oder Aufnahmen. Bis geklärt: keine hörbasierten
  Methoden bauen.
- **Curriculum-Kalibrierung:** Tier-Zuordnung und `CURRICULUM`-Zahlen sind Startwerte.

---

## 9. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `vocab.js` | Preset „Unregelmäßige Verben" importieren; optionales Einfügeformat `de - en - past - pp` |
| `decks.js` | `forms` über den `window.VOCAB`-Spiegel mitgeben |
| `game.js` | Verb-Fragetyp in `buildPool`; Methoden-Renderer (§4); Verbform-Distraktoren (§3) |
| `stats.js` | Form×Kompetenz-Suffixe (§2); `updateLevel` (§5) |
| `config.js` | `LVL`-Konstanten; Verb-Modus-Schalter |
| *neu* | `irregular-verbs.js` (Datensatz); Lernstand-Ansicht (§7) |

---

## 10. Empfohlene Reihenfolge

1. **Phase 0** — Datenmodell + Preset-Import (`forms`, §1).
2. **Phase 1** — Drei reine Modi + Form×Kompetenz-Stats, Basisfrage unangetastet (§2–3).
3. **Phase 2** — Methoden-Leiter + `updateLevel` (§4–5).
4. **Phase 3** — Level-/Lehrplan-Gating (§6).
5. **Phase 4** — Lernstand-Ansicht (§7).
6. **Phase 5** — Vollwandlung-Freischaltung + freier Übe-Modus.

Jede Phase ist für sich lauffähig; Phase 0–1 ergeben schon einen spielbaren Verb-Modus.
