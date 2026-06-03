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
- Modus-Toggle-Gerüst: Dreier-Toggle (Freier Modus / Schülermodus
  / Kampagne) auf Startseite, SD.activeMode + profiles.active_mode
  Cloud-sync; Schülermodus + Kampagne = Platzhalter
- Globaler Vorlage-Fortschritt (Auftrag 6): SD.globalPresetStats,
  neue Supabase-Tabellen preset_stats + preset_category_progress,
  Routing in game/stats/decks/vocab, Offline-Queue-Type 'global_preset'
- Vosk vom Startup entkoppelt: kein blockierendes await mehr (App-Ready
  vorher >180s, jetzt 1-2s); Vosk lädt fire-and-forget im Hintergrund,
  window._voskReady-Flag; Aussprache-Übung wartet freundlich mit Status
  falls Vosk noch lädt. Musik-An/Aus an gespeicherte es_music-Einstellung
  gekoppelt (Resume bei Rückkehr nur wenn bewusst an)
- PWA-Lifecycle: Boot-Cache-/localStorage-Wipe entfernt; SW jetzt
  network-first für App-Code, cache-first für Modell/Statik; Vosk-Modell
  same-origin (models/, ~40 MB) statt Fremd-CDN → persistent gecacht;
  Musik-Auto-Resume entfernt (stoppt im Hintergrund, kein Selbststart);
  Relaunch-Restore (es_last_screen → Menü/Profil/Fortschritt);
  controllerchange-Reload aufgeschoben bei Nutzung
- Android Zurück-Button (In-App-Back): Back-Layer SOFORT beim Laden aktiv
  (ui.js, initBackNav via DOMContentLoaded — nicht an Menü/Login gekoppelt).
  History-Wächter (pushState, gleiche URL → Recovery-Hash unberührt) +
  popstate: (1) offenes Overlay schließen (Kennung position:fixed+
  z-index:9999/.es-overlay), (2) Spiel → confirmHome, (3) sonst nicht im
  Menü → Menü; danach Wächter gestennah neu. (4) im Menü → Hinweis-Toast
  (auto-hide), KEIN Re-Arm → nächster Zurück verlässt die PWA. Wächter NUR
  gestengedeckt (Init / popstate / Geste wenn keiner liegt) — gestenloses
  Am-Leben-Halten scheitert an Chromes Geste-Sperre. Finaler Exit-Abfang
  BEWUSST aufgegeben (Plattformgrenze, s. TWA-To-do unten). Nach 8
  Iterationen aufgeräumt: Zwei-Wächter-/bfcache-/Diagnose-Code entfernt.
  Im Menü zeitbasierter Double-Back wieder drin (minimal: _lastBackTs +
  EXIT_WINDOW≈2s; erster Zurück Toast, zweiter <2s verlässt) — unabhängig
  vom Wächter-Stand, weil der Zurück-Wisch via touchstart sofort nacharmt
- Statistik-Ansichten neu aufgeteilt: (1) Vorlagen-Deck-Statistik
  tablos (aktive Vorlagen-Kacheln + 3 Wort-Tabellen, openPresetDeckStats),
  (2) Custom-Deck-Statistik unverändert, (3) Fortschritt-Seite neu:
  Custom-Wörter-Übersicht + fertige Custom-Wörter + aktive Vorlagen
  über alle Decks; Mastery zentral in stats.js (isStatMastered)

## Offen
- TWA-Wrapper (Trusted Web Activity, Bubblewrap/Play Store): einziger
  Weg, den Android-Hardware-Back zuverlässig abzufangen (onBackPressed)
  → echtes Double-Back-to-Exit. Auf reiner PWA nicht möglich (Chrome
  ignoriert gestenlos gesetzte History-Wächter). Aktuell: In-App-Back
  funktioniert, finaler Exit verlässt direkt. Erst beim Store-Schritt
  relevant (zusammen mit DSGVO/COPPA-Punkten unten)
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
