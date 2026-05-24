# English Stars — Arbeitsanweisungen

## Projekt
Deutsch→Englisch Vokabel-PWA für Grundschulkinder.
Vite-PWA, buildless (ESM-CDN-Import), Module in src/modules/,
Supabase-Backend (Projekt bjjdofvvzlivyhvjdfyw).
Branch: refactor-modules. Deploy: push dev refactor-modules:main.
Remotes: origin = altes Repo NICHT anfassen, dev = english-stars-v4.
Login: E-Mail+Passwort UND Google-OAuth. Kinder dürfen NIE auf
Google angewiesen sein — E-Mail-Weg muss immer Alternative bleiben.

## Arbeitsweise
- Vor Code-Änderung relevante Dateien lesen, nicht raten.
- Kleinste Änderung die die Aufgabe löst. Kein ungefragtes
  Refactoring, keine Umbenennungen, keine Extras.
- Zusammenhängende Edits in EINEN Commit.
- Antworten knapp: was geändert wurde + warum. Kein Prosa-Bericht.
- Bei Unklarheit kurz nachfragen statt drauflos zu bauen.

## Nicht tun
- gh ist nicht installiert — nicht nutzen versuchen.
- Deploy-Status NICHT selbst per API/PowerShell abfragen.
  Der Nutzer prüft das über den GitHub Actions-Tab.
- Keine neuen Dependencies ohne Rückfrage.
- SQL gegen auth.users (Supabase-Systemtabelle) nur auf
  ausdrückliche Anweisung, nie eigenmächtig.
- Keine Secrets/Keys in Code oder Commits.

## Doku-Pflege
- Bei Änderungen an Modulen, Exports oder Datenfluss:
  ARCHITECTURE.md im selben Commit mitaktualisieren.
- Bei Stand-Änderungen (erledigt/offen): PROJEKT-STATUS.md
  mitaktualisieren.
