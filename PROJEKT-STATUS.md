# English Stars — Projektstatus

## Setup
- Live v4: pmh-beta.github.io/english-stars-v4/
- Repo: github.com/PMH-beta/english-stars-v4 (Remote 'dev')
- Branch refactor-modules, Deploy: push dev refactor-modules:main
- origin = altes Repo, verfällt, NICHT anfassen
- Stack: Vite-PWA, buildless ESM-CDN, Supabase (bjjdofvvzlivyhvjdfyw)
- Workflow: Pawel ↔ Claude Code (Code) + Claude (Strategie/Review)

## Erledigt
- RLS-Fixes, Cloud-Sync (Profile/Decks/Stats)
- GitHub Pages live, Email-Confirm, Passwort-vergessen
- Import→Cloud, JWT-Race-Retry, handle_new_user-Trigger robust
- Pro-Sammlung-Menü (Umbenennen/Zurücksetzen/Löschen)
- Google-Login (OAuth): verknüpft sauber mit Bestandskonten,
  Account-Picker bei Hard-Logout, Kinderkonten via Family-Link-
  Eltern-Genehmigung getestet

## Offen
- Live-Gang v4: wird DIE Hauptversion, v3.44/altes Repo verfällt,
  Repo-Umbenennung später
- Größerer Ausbau / Lehrer-Funktionen (Schul-Pitch verworfen,
  direkt größer bauen)
- Vor Store-Veröffentlichung (Play/App Store): Datenschutz
  (DSGVO/COPPA), Eltern-Einwilligung, kindgerechter Login
  ohne Google-Zwang, native OAuth-Clients

## Test-Accounts
- Pawel: pawel.moltschanow@googlemail.com (ID de7bcd04)
- Tanja: hefele.91@googlemail.com
- Hannah: hannahhefele@gmail.com (Kinderkonto)
- Pascha: pawel.moltschanow+test1@gmail.com
