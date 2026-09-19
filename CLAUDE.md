# English Stars — Arbeitsanweisungen

## Projekt
Deutsch→Englisch Vokabel-PWA für Grundschulkinder.
Vite-PWA, buildless (ESM-CDN-Import), Module in src/modules/,
Supabase-Backend (Projekt bjjdofvvzlivyhvjdfyw).
Branch: main (einziger Arbeitsbranch, Repo english-stars-v4).
Ablauf auf jedem Rechner: git pull -> arbeiten -> commit -> push.
Remote-NAME ist je Rechner anders: Linux-Laptop = origin,
Windows-Hauptrechner = dev (dort ist origin das ALTE Repo, NICHT
anfassen). Also erst `git remote -v` pruefen, dann pushen.
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

## Doku (ARCHITECTURE.md, KONZEPT-MODI.md, PROJEKT-STATUS.md)
- Sind NICHT in git (lokal, gitignored). Nur auf ausdrückliche
  Ansage anfassen — kein automatisches Mitpflegen.
