# Architecture Reference

## Module-Übersicht (`src/modules/`)

| Modul | Aufgabe | Wichtige Exports |
|---|---|---|
| `config.js` | Konstanten, Grading-Logik, Device-Detection | `APP_VERSION`, `QPERROUND`, `EXAM_QUESTIONS`, `MAX_PRESET_CATEGORIES`, `calcGrade`, `gradeText`, `isMobile`, `isIOS`, `shouldUseVosk` |
| `supabase.js` | Supabase-Client (anon key, RLS-geschützt) | `supabase`, `testConnection` |
| `storage.js` | LocalStorage-Operationen für window.SD | `persist`, `loadData`, `freshData`, `clearStorage`, `cleanupStorage`, `clearSWCache` |
| `default-decks.js` | Starter-Vokabelsammlungen für neue Nutzer | `DEFAULT_DECKS` |
| `auth.js` | Supabase Auth: Login, Registrierung, Passwort-Reset, Google-OAuth | `signIn`, `signUp`, `signOut`, `onAuthChange`, `requestPasswordReset`, `updatePassword`, `resendConfirmation`, `signInWithGoogle` |
| `sync.js` | Cloud Read/Write zwischen Supabase und window.SD + Offline-Queue | `cloudLoad`, `saveProfile`, `saveDeck`, `saveWordStats`, `saveGlobalPresetStats`, `saveExam`, `deleteCloudDeck`, `deleteCloudWordStats`, `deleteCloudPresetStats`, `loadProfile`, `cloudReset`, `markDirty`, `flushPendingSync`, `getPendingCount` |
| `decks.js` | Deck CRUD + UI-State + Spiegel-Sync | `activeDeck`, `syncMirrorFromActiveDeck`, `switchDeck`, `createDeck`, `deckProgress`, `presetProgressPct`, `renderDecks`, `migrateStatKeys` |
| `stats.js` | EMA-basierte Statistik-Berechnungen + statKey-Normalisierung | `effectivePct`, `isStatMastered`, `isMastered`, `statKeyFor`, `normStatDE`, `normStatEN`, `getVocabStat`, `presetWordsPct`, `modePct` |
| `speech.js` | TTS (Web Speech API) + Spracherkennung (Vosk offline) | `_initTTS`, `primeTTS`, `speakWord`, `speakWordOnce`, `ensureMicStream`, `releaseMicStream`, `startVoskRecognition`, `startRecording`, `voskStop`, `stopVisualizer` |
| `audio.js` | Hintergrundmusik (MP3-Playlist, endlos) | `_discoverTracks`, `_initAudio`, `_trackUrl`, `startMusicSync`, `_setMusicBtns` |
| `pwa.js` | PWA Install-Prompt + iOS-Hinweis-Banner | `pwaInstall`, `pwaSetup` |
| `game.js` | Spielmechanik: Fragen, Punkte, Streak, Exam | `_sfx` + zahlreiche `window.*` Game-State-Variablen |
| `vocab.js` | VokabelManager UI: Hinzufügen, Scannen, Einfügen, Preset-Kategorien, Draft-Flow für neue Sammlungen, Vorlagen-Deck-Statistik | `openVocabManager`, `openPresetDeckStats`, `getPresetCategories`, `vmTab`, `renderVocabList`, `confirmAddVocab`, `renderPresetsTab`, `togglePresetCategory`, `vmRenameActiveDeck`, `newDeckFlow`, `vmBack` |
| `ui.js` | Screen-Routing, Auth-Lifecycle, Modus-Toggle, alle UI-Event-Handler | `showScreen`, `showMenu`, `handleLogin`, `handleLogout`, `showNewPasswordScreen`, `saveName`, `authGoogleSignIn`, `setActiveMode`, `renderModeContent` |
| `startup.js` | Boot-Sequenz: TTS, Audio, Vosk, Auth-Session | `startupSequence`, `finishStartup` |

---

## Datenfluss

### `window.SD` — Struktur

```
window.SD = {
  _version: 4,
  playerName: string,
  highscore: number,
  totalPoints: number,
  activeMode: 'free' | 'student' | 'campaign',  // zuletzt gewählter Modus, Default 'free'
  presetIntroSeen: boolean,                      // ob Vorlagen-Intro-Modal schon gezeigt wurde
  activeDeckId: string | null,      // UUID (Cloud) oder 'deck_TIMESTAMP_RANDOM' (lokal, noch nicht gepusht)

  decks: {
    [deckId]: {
      id: string,
      name: string,
      createdAt: number,
      vocab: [{ de: string, en: string, _presetId?: string }],  // _presetId: UUID der Preset-Kategorie
      wordStats: {
        // statKey-Format: normDE(de) + '|' + normEN(en) + suffix
        // normDE = trim+lowercase; normEN = trim+lowercase+führendes "to " entfernen
        // Suffixe: '_mc' (Vokabel), '_sp' (Rechtschreibung), '_pr' (Aussprache)
        // Stats schlummern beim Löschen eines Worts — Wiederhinzufügen stellt den Stand wieder her.
        // Einmalige Migration von altem Format (de+suffix) beim Login via migrateStatKeys().
        [statKey]: { asked, correct, wrong, recent }   // recent = Binär-String "1011..." für EMA
      },
      categoryProgress: {
        vocab | spelling | pronounce | mixed_vocab: { played, correct, bestStreak }
      },
      presetCategories: string[],   // UUIDs aktiver preset_categories
      presetsLocked: boolean,        // true = Vorlage-Auswahl dauerhaft gesperrt; gesetzt beim ersten Verlassen mit aktiven Vorlagen
      deckPath: 'none'|'preset'|'custom', // Exklusiver Weg: 'preset' sperrt Add/Paste-Tabs; 'custom' sperrt Vorlagen-Tab; einmalig gesetzt, nicht umkehrbar
      sortOrder: number,             // Reihenfolge in der Sammlungs-Liste (10, 20, 30 …); per Drag geändert → saveDeck
      lastExam: null | object,
    }
  },

  // Draft-Deck (flüchtig, kein Persist) — gesetzt während neuer Sammlung anlegen:
  // window._draftDeck: { id:'_draft', name, vocab:[], presetCategories:[], deckPath, presetsLocked }
  // window.VOCAB wird auf window._draftDeck.vocab gesetzt → syncMirrorFromActiveDeck() ist in diesem Zustand geblockt.
  // Bei Abschluss (lock/name-confirm) → createDeck() + switchDeck() → Draft gelöscht.
  // Bei Abbruch oder Reload → Draft einfach weg (keine Geister-Decks).

  // Spiegel-Felder — immer vom aktiven Deck via syncMirrorFromActiveDeck():
  wordStats: { ... },
  categoryProgress: { ... },

  // Globaler Vorlage-Fortschritt — deck-unabhängig, kein Spiegel.
  // Preset-Wörter (v._presetId gesetzt) schreiben hier; manuelle Wörter bleiben in deck.wordStats.
  // Migration alter Daten: keine — globaler Topf startet bei 0.
  globalPresetStats: {
    wordStats: {
      // identisches Format wie deck.wordStats — statKey → {asked, correct, wrong, recent}
      [statKey]: { asked, correct, wrong, recent }
    },
    categoryProgress: {
      // keyed by preset_id (UUID aus preset_categories.id)
      [presetId]: { played, correct, bestStreak }
    }
  },
}
```

`window.SD` wird immer via `persist()` (storage.js) in localStorage/sessionStorage gespiegelt.

---

### Cloud-Sync: Welche Funktion schreibt welche Tabelle

| Funktion | Supabase-Tabelle | Trigger |
|---|---|---|
| `saveProfile(sd, userId)` | `profiles` | nach Name-Änderung, Highscore, activeDeckId-Wechsel |
| `saveDeck(deck, userId)` | `decks` | nach Vokabel-Änderung, Fortschritts-Reset; INSERT → Cloud gibt UUID zurück, ersetzt lokale ID in window.SD; schreibt deck_path |
| `saveWordStats(deckId, stats, userId)` | `word_stats` | nach jeder Spielrunde (Upsert per `user_id,deck_id,stat_key`) |
| `saveGlobalPresetStats(stats, userId)` | `preset_stats` + `preset_category_progress` | nach jeder Runde mit aktiven Vorlagen (Upsert; Queue-Type `'global_preset'`) |
| `saveExam(...)` | `exams` | direkt nach Prüfungs-Abschluss (kein Queue) |
| `cloudReset(userId)` | `decks` + `preset_stats` + `preset_category_progress` + `profiles` | Reset im Profil-Screen |

#### Offline-Queue (`markDirty` / `flushPendingSync`)

```
markDirty(type, deckId)
  → schreibt {type, deckId, ts} in localStorage:'pending_sync'
  → dedupliziert: gleicher type+deckId ersetzt alten Eintrag
  → type 'global_preset' hat kein deckId (null)

flushPendingSync()
  → liest Queue
  → ruft je nach type: saveProfile | saveDeck | saveWordStats | saveGlobalPresetStats auf
  → fehlgeschlagene Einträge bleiben in der Queue (retry beim nächsten Aufruf)
```

`cloudLoad` nutzt `fetchWithRetry()` intern um JWT-Race-Conditions nach Login abzufangen (bis zu 3 Versuche mit 1,5s Delay).

---

### Auth-Flow: `startup.js` → `handleLogin` → `cloudLoad`

```
window.load
  └─ startupSequence()                  startup.js
       ├─ supabase.auth.getSession()    → window.currentUser (kann null sein)
       ├─ onAuthChange() registrieren   → reagiert auf Session-Ablauf / Tab-Wechsel
       └─ Assets laden (TTS, Audio, Vosk …)
            └─ finishStartup()
                 ├─ _pendingRecovery? → showNewPasswordScreen()
                 ├─ !currentUser?     → showScreen('auth-screen')
                 └─ currentUser?      → handleLogin(user)          ui.js

handleLogin(user)                       ui.js
  ├─ cloudLoad(user.id)                 sync.js
  │    ├─ SELECT profiles WHERE id=userId
  │    ├─ SELECT decks WHERE user_id=userId
  │    ├─ SELECT word_stats WHERE user_id=userId
  │    ├─ SELECT preset_stats WHERE user_id=userId
  │    └─ SELECT preset_category_progress WHERE user_id=userId
  │         → baut window.SD auf, fügt word_stats in Decks ein,
  │           baut SD.globalPresetStats aus preset_stats + preset_category_progress
  ├─ window.SD = cloudState
  ├─ persist(window.SD)
  ├─ syncMirrorFromActiveDeck()         → aktualisiert SD.wordStats + SD.categoryProgress
  ├─ loadProfile(user.id)               → expliziter Fallback falls cloudLoad null lieferte
  └─ !playerName? → name-screen | sonst → showMenu()
```

Passwort-Reset-Sonderfall: Supabase feuert `PASSWORD_RECOVERY` Event → `onAuthChange` setzt `_pendingRecovery = true` → `finishStartup` leitet auf `new-password-screen`.

---

### Google-OAuth-Pfad

```
auth-screen: "Mit Google anmelden"
  └─ authGoogleSignIn()                      ui.js
       ├─ liest sessionStorage:'force_account_picker'
       │    → gesetzt von authLogout() bei Hard-Logout
       │    → nach Lesen sofort löschen
       └─ signInWithGoogle(forceAccountPicker)   auth.js
            └─ supabase.auth.signInWithOAuth({
                 provider:'google',
                 options:{
                   redirectTo: _redirectTo(),     // dynamisch, lokal+GH Pages
                   queryParams: { prompt:'select_account' }  // nur wenn force=true
                 }
               })
                 → Browser-Redirect zu Google
                 → nach Auth: Redirect zurück zur App-URL

App lädt neu → startupSequence()              startup.js
  └─ detectSessionInUrl:true im Supabase-Client
       → Token aus URL-Hash wird automatisch verarbeitet
  └─ supabase.auth.getSession()
       → gibt OAuth-User zurück (kein Unterschied zu Passwort-User)
  └─ finishStartup() → handleLogin(user) → cloudLoad()
       → normaler Pfad, identisch mit E-Mail-Login
```

**Account-Picker-Logik:**
- Normaler Google-Button → `forceAccountPicker=false` → kein `prompt`-Parameter → Google nimmt aktives Konto still
- Nach Hard-Logout (`authLogout`) → `sessionStorage:'force_account_picker'='1'` → nächster Google-Button-Click → `prompt:'select_account'` → Kontoauswahl erzwingen

**Identity Linking:** Supabase-Setting "Allow email-based account linking across providers" muss aktiv sein, damit Google-OAuth und E-Mail+Passwort-Konto mit gleicher bestätigter E-Mail auf denselben User zeigen.

---

## PWA-Lifecycle & Caching

**Service Worker (`sw.js`)** — Cache-Name `english-stars-<VERSION>`, `activate` löscht alle Caches außer der aktuellen Version. Fetch-Strategie:
- **network-first** für same-origin App-Code/Shell (HTML, JS, CSS, manifest, JSON) → Deploy-Updates kommen online sofort an, offline Cache-Fallback.
- **cache-first** für große/statische Assets (Vosk-Modell `.tar.gz`, Bilder, Fonts, Audio) + alle Cross-Origin-Libs (CDN) → persistent über Kaltstarts.

Es gibt **keinen** Boot-Cache-/localStorage-Wipe mehr (früher in `startup.js`). Der Wipe untergrub den SW und kostete bei jedem Start einen Vosk-Re-Download + Verlust von `pending_sync`.

**Vosk-Modell** liegt same-origin unter `models/vosk-model-small-en-us-0.15.tar.gz` (~40 MB), URL via `new URL('models/…', document.baseURI)`. `Vosk.createModel` lädt es per Voll-GET (200) und untart es im Worker → vom SW cache-first persistent gecacht.

**Vosk-Laden entkoppelt** vom Startup: `startup.js` blockiert **nicht** mehr mit `await _voskLoad()`, sondern stößt es fire-and-forget an → App ist in 1–2 s „bereit". Flag `window._voskReady` zeigt Fertigstellung. Öffnet jemand eine Aussprache-Übung bevor Vosk fertig ist, wartet `startVoskRecognition` (speech.js) freundlich mit sichtbarem Status („⏳ Spracherkennung wird vorbereitet…") und startet automatisch, sobald bereit — kein Blockieren, kein stilles Fehlschlagen.

**Musik** (`audio.js`): `visibilitychange`+`document.hidden` → pausiert. Auto-Resume bei Rückkehr ist an die **gespeicherte bewusste Einstellung** `localStorage['es_music']` gekoppelt (nicht an einen flüchtigen „lief gerade"-Zustand): war Musik bewusst an und die Session entsperrt (`_musicOn`), läuft sie wieder; war sie aus, bleibt sie aus. Toggle-Button schreibt `es_music`; Start-Button (`startup.js`) stellt die Einstellung nach der Audio-Unlock-Geste wieder her.

**Relaunch-Restore** (`ui.js`): `showScreen` merkt Menü/Profil/Fortschritt in `localStorage['es_last_screen']`; `handleLogin` → `restoreLastScreen()` landet nach Relaunch dort (kein Restore mitten in Spiel/Scan/Review).

**controllerchange-Reload** (`pwa.js`): neuer SW → Reload, aber **aufgeschoben** wenn in Spiel/Scan/Review (`window._pendingReload`), ausgeführt beim nächsten `showMenu`.

**Android Zurück-Button** (`ui.js`): Back-Layer, **sofort beim Laden** aktiv (`initBackNav` via DOMContentLoaded — bewusst NICHT an `menu-screen`/Login gekoppelt). Setzt History-Wächter (`pushState` mit **gleicher URL** → Recovery-Hash unberührt) und einen `popstate`-Listener; zusätzlich `visibilitychange`/`pageshow` für die Rückkehr aus anderen Apps. `showScreen` merkt nur `_currentScreen`. **Grundregel: es liegen IMMER zwei Wächter-Einträge über dem Ausgang** (`_depth`/`_GUARD_DEPTH=2`, aufgefüllt via `_ensureDepth`). Diagnose hat gezeigt: `pushState` greift auch **ohne** Nutzer-Geste — das Problem war nicht das Verschlucken, sondern die **Tiefe**: bei nur einem Eintrag popt der erste Back ihn weg und der zweite fällt durch und verlässt. Mit zwei Einträgen landet der erste (Menü-)Back auf einem Wächter (Toast), erst ein bewusster zweiter Back im Fenster verlässt. Nach jedem abgefangenen Pop (Overlay/Screen/Spiel) wird die Tiefe wieder auf 2 aufgefüllt — auch nach **Timer-Ablauf** und **App-Wechsel** (`_onAppResume`), ganz ohne Nutzer-Interaktion. Ob verlassen wird, entscheidet allein das Flag `_exitArmed`. **Best-effort: 100% ist auf reiner PWA nicht garantiert** (Chrome-Schutz); für garantierte Kontrolle wäre ein TWA-Wrapper nötig. `popstate` (= Zurück) in Priorität (Tiefe wird bei jedem Pop um 1 verringert): (1) `_exitArmed` (zweiter Zurück im Exit-Fenster) → App verlassen via **einzelnem `history.back()`** (kein `go(-2)`, kein Auffüllen); (2) oberstes Overlay schließen — generisch über die Dialog-Kennung `position:fixed`+`z-index:9999` bzw. `.es-overlay`; (3) `game-screen` → `confirmHome` (Speichern-Nachfrage); (4) sonst nicht im Menü (und kein Pre-Login-Screen aus `NAV_IGNORE`) → `showMenu`; (5) im Menü/Pre-Login → **Double-Back-to-Exit**: erster Zurück zeigt einen Toast (`z-index:10000`, damit `_topOverlay` ihn nicht als Modal greift), setzt `_exitArmed=true` und startet ein Zeitfenster (~2,5 s, `_exitTimer`) — die Tiefe bleibt bewusst bei 1, damit ein zweiter Zurück durchpoppt. In (2)–(4) wird die Tiefe via `_ensureDepth` wieder auf 2 aufgefüllt. Verstreicht das Fenster ohne zweiten Zurück, löscht der Timer das Flag **und füllt die Tiefe wieder auf 2** → nächster Zurück zeigt erneut den Toast. `_onAppResume` (Rückkehr sichtbar/pageshow) setzt `_exitArmed=false`, blendet den Toast aus und füllt die Tiefe auf 2 — der nächste Zurück landet wieder auf einem Wächter statt zu verlassen.
