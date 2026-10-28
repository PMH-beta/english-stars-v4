---
name: app-im-browser-pruefen
description: English Stars selbst im Browser prüfen (Handy-Format, ohne echte Datenbank) mit dem Playwright-MCP. Nutzen nach jeder sichtbaren Änderung an Screens, Dialogen, Minispielen, Kampf oder Schmiede, beim Nachstellen eines gemeldeten Anzeige-Fehlers und wenn ein Screenshot oder ein Abgleich mit dem Pastell-Fragment gebraucht wird. Nicht für reine Logik-Änderungen — die lieber per Node-Probe (Module direkt importieren) testen.
---

# App im Browser prüfen

Der Playwright-MCP (`mcp__playwright__*`) ist lokal für dieses Projekt eingerichtet:
headless Chrome, 412×915 (Handy), Profil nur im Speicher (`--isolated`),
**`*.supabase.co` ist gesperrt** — keine Anfrage erreicht die echte Datenbank.
Screenshots landen im `--output-dir` des MCP (`claude mcp get playwright`).
Fehlt der MCP: zuerst `claude-skills/EINRICHTEN.md` abarbeiten; notfalls das Verfahren aus der
Memory `reference_headless_screenshots` (CDP + Fetch-Interception) nehmen.

## 1 · Server
- Eigener Port, im Hintergrund: `python -m http.server 5199` (Linux: `python3`) im Repo-Root (`run_in_background`).
  Die App ist buildless, Vite ist nicht nötig. **Nicht** `npm run dev` (öffnet ein Fenster beim Nutzer).
- Den localhost:8000 des Nutzers nicht anfassen. Server am Ende beenden.

## 2 · Anmelden ohne Konto
Erst `http://localhost:5199/manifest.json` öffnen (gleiche Origin), dann per `browser_evaluate`:
- `localStorage['sb-bjjdofvvzlivyhvjdfyw-auth-token']` = JSON-Sitzung mit unsigniertem JWT,
  `expires_at` in der Zukunft und `user: { id: '<Test-UUID>', email: 'test@example.invalid' }`.
  `cachedSessionUser()` und `getSession()` nehmen sie ohne Netz.
- `localStorage['english_stars_v3']` = Spielstand (oder leer lassen und über die App aufbauen).
- Dann `http://localhost:5199/` laden. Supabase ist gesperrt → `cloudLoad` endet `failed`, die App
  arbeitet mit dem lokalen Stand. Landet sie im Namens-Screen, fehlt der lokale Stand.

## 3 · Spielstand aufbauen (Konsolen-Helfer der App)
`createDeck`, `talerTest(50)`, `uvTestForge(1,'gefaehrte')`, `uvTestForgeRandom(2)`.
Screens direkt aufrufen statt Start-Button: `showMenu()`, `setActiveMode('student'|'campaign')`,
`openVocabManager()` …
Echter Stand eines Kontos: `node scripts/db-backup.mjs` → Zeilen aus `db-backups/` in den lokalen Stand übernehmen
(nur Testkonten; Hannah nur lesend nachstellen, nie zurückschreiben).

## 4 · Spielen
- Richtige Antwort: `window.currentQ.answer`. MC `.choice-btn`, Tippen `#type-input` + `submitType()`,
  Aussprache `showSelfRateButtons()`.
- Kampf-Minispiele: `.cf-slot` Buchstabensturm, `.mg-treiber` Meteoriten, `.mg-hoer` Echo,
  `.tf-btn` Richtig oder falsch. Sieg erzwingen: `run.fight.enemyHp = 1`, dann eine Welle lösen.
- Kampf immer sauber verlassen (Verlassen + bestätigen), sonst läuft der Takt weiter.

## 5 · Prüfen und berichten
- `browser_snapshot` für Struktur/Texte, `browser_take_screenshot` für das Aussehen,
  `browser_console_messages` auf Fehler prüfen — jeder neue Konsolen-Fehler gehört in den Bericht.
- Pastell-Abgleich: messen statt schätzen (Memory `feedback_pastell_pixelgenau`).
- Grenzen: Service Worker, echte Anmeldung, Sync und Freunde lassen sich so nicht testen —
  das dem Nutzer als Handy-Testschritt mitgeben.
- Nie mit echten Zugangsdaten anmelden, nie die Supabase-Sperre umgehen.
