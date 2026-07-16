// scripts/db-backup.mjs
// Lädt den NEUESTEN nächtlichen DB-Snapshot (Tabelle `backups`, gefüllt vom
// pg_cron-Job `daily-backup`) aus Supabase herunter und speichert ihn als
// JSON-Datei in db-backups/ — die externe Kopie für den Fall, dass das
// Supabase-Projekt selbst verloren geht.
//
// Voraussetzung (EINMALIG): Service-Role-Key als Umgebungsvariable, NIE im Code:
//   setx SUPABASE_SERVICE_KEY "<service_role-Key aus Dashboard → Settings → API>"
//   (danach Terminal neu öffnen)
//
// Ausführen:  node scripts/db-backup.mjs
// Behalten werden die letzten 12 Dateien (ältere löscht das Script selbst).

import { writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_BASE = 'https://bjjdofvvzlivyhvjdfyw.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const KEEP = 12;   // Anzahl aufbewahrter Backup-Dateien

if (!KEY) {
  console.error('FEHLER: Umgebungsvariable SUPABASE_SERVICE_KEY fehlt.');
  console.error('Einmalig setzen:  setx SUPABASE_SERVICE_KEY "<service_role-Key>"  (dann Terminal neu öffnen)');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// Neuesten Snapshot-Zeitpunkt holen, dann alle Zeilen dieses Snapshots.
const latest = await fetch(`${URL_BASE}/rest/v1/backups?select=taken_at&order=taken_at.desc&limit=1`, { headers });
if (!latest.ok) { console.error('FEHLER beim Lesen der backups-Tabelle:', latest.status, await latest.text()); process.exit(1); }
const [row] = await latest.json();
if (!row) { console.error('FEHLER: backups-Tabelle ist leer — läuft der pg_cron-Job?'); process.exit(1); }

const takenAt = row.taken_at;
const res = await fetch(`${URL_BASE}/rest/v1/backups?select=table_name,taken_at,rows&taken_at=eq.${encodeURIComponent(takenAt)}`, { headers });
if (!res.ok) { console.error('FEHLER beim Laden des Snapshots:', res.status, await res.text()); process.exit(1); }
const snapshot = await res.json();

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db-backups');
mkdirSync(dir, { recursive: true });
const file = join(dir, `db-backup-${takenAt.slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify({ takenAt, tables: snapshot }, null, 1));

const sizes = snapshot.map((t) => `${t.table_name}: ${Array.isArray(t.rows) ? t.rows.length : 0}`).join(', ');
console.log(`OK — Snapshot vom ${takenAt} gespeichert nach ${file}`);
console.log(`Inhalt: ${sizes}`);

// Alte Dateien ausdünnen (nur die letzten KEEP behalten).
const files = readdirSync(dir).filter((f) => /^db-backup-.*\.json$/.test(f)).sort();
for (const f of files.slice(0, Math.max(0, files.length - KEEP))) {
  unlinkSync(join(dir, f));
  console.log('alt entfernt:', f);
}
