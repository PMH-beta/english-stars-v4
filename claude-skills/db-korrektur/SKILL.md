---
name: db-korrektur
description: Daten in der English-Stars-Datenbank selbst lesen oder korrigieren (Taler gutschreiben, Wortstände reparieren, Spielstand eines Kontos nachsehen) per Supabase-REST mit dem Service-Key. Nutzen, wenn der Nutzer eine Backend-Korrektur oder einen Blick in echte Daten verlangt. Nicht für Schema-Änderungen — die macht der Nutzer per SQL im Dashboard.
---

# DB-Korrektur per REST

Projekt `bjjdofvvzlivyhvjdfyw`. Key: Umgebungsvariable `SUPABASE_SERVICE_KEY`
(per `setx` gesetzt, Laden wie in `scripts/db-backup.mjs`). Den Key **nie** ausgeben,
loggen, in Dateien im Repo schreiben oder committen. Helfer-Skripte nur im Scratchpad.

## Rechte (Stand 25.10.2026)
`select, insert, update` auf `profiles`, `decks`, `word_stats`, dazu `preset_stats`, `backups`.
**Kein delete.** `auth.users` nur auf ausdrückliche Anweisung.

## Ablauf bei Änderungen
1. Nutzer bitten, die App auf dem betroffenen Gerät **ganz zu schließen** (sonst überschreibt
   der nächste Upload die Korrektur). Bestätigung abwarten.
2. Sicherung: `POST /rest/v1/rpc/take_backup` (204).
3. Aktuellen Stand lesen (immer mit `Range`/Paging, max. 1000 Zeilen je Abfrage).
4. Plan + Vorher/Nachher dem Nutzer zeigen.
5. `PATCH` nur mit Bedingung auf den gelesenen Stand (`updated_at=eq.<alt>` oder alte Werte),
   `Prefer: return=representation`, betroffene Zeilenzahl prüfen.
6. Frisch nachlesen und bestätigen. Hinweis: App komplett neu laden (Cloud = Wahrheit).

## Häufige Fälle
- **Taler:** kein eigenes Feld. Gutschrift = `campaign.talerSpent` senken (nur diesen Key
  per jsonb ändern, nie das ganze `campaign`-Objekt ersetzen). Zum Testen geht auch in der App
  `talerTest(50)`.
- **Nur lesen:** `take_backup` + Snapshot aus `backups` lesen, oder direkt `select`.
- Der DB-Trigger setzt `updated_at` bei jedem Upsert neu — gleicher Zeitstempel = ein Upload.
- Konten: Hannah ist das einzige echte Konto (besonders vorsichtig), alle anderen sind
  Testkonten. Die UUIDs stehen in der Memory (`reference_db_lesezugriff`, `project_taler_testen`),
  sonst den Nutzer fragen — nie ins Repo schreiben.
- Den Key gibt es nur auf dem Windows-Hauptrechner. Fehlt er (z. B. Linux-Laptop): Nutzer fragen.
