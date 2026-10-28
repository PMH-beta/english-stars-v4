---
name: speicherfeld-pruefen
description: Checkliste für English Stars, sobald sich gespeicherte Daten ändern — neues, umbenanntes oder gelöschtes Feld in SD (Spielstand), in SD.campaign, in einem Deck, in word_stats/preset_stats oder in einer jsonb-Spalte (campaign, uv_fills, uv_forms …), neue Stat-Suffixe oder Migrationen alter Stände. Vor dem Bauen laden, nicht erst beim Commit.
---

# Speicherfeld prüfen

Datenänderungen sind laut CLAUDE.md eine **Funktionsänderung** → vorher per AskUserQuestion fragen,
falls der Nutzer sie nicht ausdrücklich beauftragt hat.

## Checkliste
1. **Lesen beim Cloud-Load:** `_campaignFrom` in `src/modules/sync.js` ist eine **Whitelist**.
   Neues `SD.campaign`-Feld dort eintragen, sonst ist es nach jedem Laden still weg
   (so verschwand `bossWins` monatelang). Gleiches für andere Lese-Funktionen in `sync.js`
   prüfen (`uv_fills`, `uv_forms` …).
2. **Schreiben:** `saveProfile` (`campTrivial` beachten), `saveDeck`, `saveWordStats`.
   Gibt es die DB-Spalte schon? Neue Spalte = SQL, das der **Nutzer** im Dashboard ausführt
   (kein `$$`-Quoting, nie gegen `auth.users`). Vorher Skill `supabase-postgres-best-practices`.
3. **Sync-Warteschlange:** Änderung per `markDirty(type, deckId)` anmelden; Löschungen über
   eigene Queue-Typen (`word_stats_delete`, `queuePresetStatDelete`). Globale Daten erst
   löschen, wenn der Upload bestätigt ist.
4. **Mehr als 1000 Zeilen:** PostgREST liefert max. 1000 Zeilen je Abfrage → seitenweise laden.
5. **Alte Stände:** Migration idempotent (zweiter Lauf = nichts). Geräte mit alter App-Version
   können alte Felder zurückschreiben → Stichtag oder Kennzeichen statt „einfach neu berechnen“.
   Nur Vokabeldecks sind wirklich schützenswert; außer Hannah alles Testkonten.
6. **Stat-Schlüssel:** immer über `statKeyFor(de, en, suffix, presetId)`; Regex-Migrationen in
   `campaign.js` müssen neue Suffixe durchlassen. Trainingsplatz-Stats liegen je Deck
   (`presetStatStore`).
7. **Freunde-Ansicht:** zeigt sie das Feld? Dann nur auf der Anzeige-Kopie migrieren,
   Fremddaten escapen (XSS).
8. **Testen:** Node-Probe der Migration (Module direkt importieren, alter + neuer Stand,
   zweiter Lauf), dann `npm run build`.
