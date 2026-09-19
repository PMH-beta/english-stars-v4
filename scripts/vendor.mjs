// scripts/vendor.mjs
// Erzeugt die Dateien in vendor/ neu. Sie liegen im Repo, damit der Boot-Pfad
// der App KEINEN Cross-Origin-Request mehr braucht (Offline-Fähigkeit): der
// Service Worker kann nur Same-Origin-Dateien zuverlässig vorcachen.
//
// Aufruf:  node scripts/vendor.mjs
//
// - supabase-js: aus node_modules gebündelt (Version = package.json/Lockfile).
//   Vorher kam es über esm.sh@2 rein — ein Shim mit max-age=600, der auf die
//   jeweils NEUESTE 2.x zeigte und in 8 Einzel-Requests auffächerte. Nach jedem
//   Supabase-Release zeigten die Sub-Imports auf URLs, die nicht im Cache lagen
//   → offline weißer Bildschirm.
// - vosk.js: enthält sein WASM inline (5,6 MB), lädt zur Laufzeit nichts nach.
//   Das Sprachmodell liegt ohnehin schon lokal unter models/.
//
// NICHT gevendort: tesseract.js. Es lädt Worker, Core-WASM und die ~15 MB
// Sprachdaten zur Laufzeit selbst vom CDN — eine lokale Kopie der 66-KB-Hülle
// würde das Scannen nicht offline-fähig machen. Es wird stattdessen erst beim
// Öffnen des Scan-Tabs nachgeladen (siehe src/modules/lazyload.js).

import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const VOSK_VERSION = '0.0.8';   // muss zur Modell-Version in models/ passen

await mkdir('vendor', { recursive: true });

// ── supabase-js bündeln ──
const supaVersion = require('@supabase/supabase-js/package.json').version;
execFileSync('npx', [
  'esbuild', 'node_modules/@supabase/supabase-js/dist/index.mjs',
  '--bundle', '--format=esm', '--platform=browser', '--target=es2020',
  '--minify', '--legal-comments=none',
  '--outfile=vendor/supabase-js.esm.js',
], { stdio: 'inherit' });
console.log(`[vendor] supabase-js ${supaVersion} → vendor/supabase-js.esm.js`);

// ── vosk.js holen ──
const voskUrl = `https://cdn.jsdelivr.net/npm/vosk-browser@${VOSK_VERSION}/dist/vosk.js`;
const res = await fetch(voskUrl);
if (!res.ok) throw new Error(`vosk.js Download fehlgeschlagen: ${res.status}`);
await writeFile('vendor/vosk.js', Buffer.from(await res.arrayBuffer()));
console.log(`[vendor] vosk-browser ${VOSK_VERSION} → vendor/vosk.js`);

console.log('[vendor] Fertig. Danach APP_VERSION in src/modules/config.js hochziehen.');
