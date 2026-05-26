# Konzept: App-Modi

## Überblick

English Stars hat drei Modi, auswählbar über den Toggle auf der Startseite (unter Profil-Banner, über Vokabelsammlungen). Der zuletzt gewählte Modus wird lokal und per Cloud synchronisiert (`SD.activeMode`, `profiles.active_mode`).

---

## Die drei Modi

### Freier Modus (`free`) — voll funktionsfähig, Standard
- Aktueller App-Zustand, alle Features aktiv
- Eigene Vokabelsammlungen anlegen, Spielmodi wählen, Statistiken
- Nutzt `SD.decks`, `SD.activeDeckId`, `SD.wordStats` (bestehende Struktur)

### Schülermodus (`student`) — Platzhalter
- Geplant: eigene, vom Freien Modus vollständig getrennte Daten (eigene Decks, eigener Fortschritt)
- Lehrerzugewiesene Aufgaben, strukturiertes Lernen, Klassen-Kontext
- Status: nur Gerüst, Inhalt kommt später

### Kampagne (`campaign`) — Platzhalter
- Geplant: geführter Lernpfad mit Story/Missionen, schrittweise freizuschaltende Inhalte
- Status: nur Gerüst, Inhalt kommt später

---

## Datenstruktur

### Aktueller Stand (Gerüst)

`SD.activeMode: 'free' | 'student' | 'campaign'`

Freier Modus nutzt unverändert `SD.decks` / `SD.wordStats` / `SD.activeDeckId`.

### Geplante Erweiterung für Schülermodus

Neue Top-Level-Felder neben den bestehenden — kein Umbau der bestehenden Struktur nötig:

```
SD.studentDecks: { [deckId]: { ... } }
SD.studentActiveDeckId: string | null
SD.studentWordStats: { [statKey]: { ... } }
```

Analoges Schema für Kampagne falls nötig. Der Freie Modus bleibt davon unberührt.

### DB (`profiles`-Tabelle)
- `active_mode TEXT NOT NULL DEFAULT 'free'` — gespeicherter Modus pro User
- Schülermodus-Decks werden als normale `decks`-Zeilen gespeichert; ggf. später `mode TEXT DEFAULT 'free'` Spalte zu `decks` ergänzen, um Modi-Decks zu trennen

---

## Punkte-Ökonomie

Noch nicht definiert — wird festgelegt wenn Schülermodus und Kampagne echten Inhalt bekommen.

---

## Status

| Modus | Status |
|---|---|
| Freier Modus | ✅ Voll funktionsfähig |
| Schülermodus | 🔲 Gerüst (Platzhalter "Kommt bald") |
| Kampagne | 🔲 Gerüst (Platzhalter "Kommt bald") |
