# Architecture Reference

## Module-Übersicht (`src/modules/`)

| Modul | Aufgabe | Wichtige Exports |
|---|---|---|
| `config.js` | Konstanten, Grading-Logik, Device-Detection | `APP_VERSION`, `QPERROUND`, `EXAM_QUESTIONS`, `MAX_PRESET_CATEGORIES`, `calcGrade`, `gradeText`, `isMobile`, `isIOS`, `shouldUseVosk` |
| `supabase.js` | Supabase-Client (anon key, RLS-geschützt) | `supabase`, `testConnection` |
| `storage.js` | LocalStorage-Operationen für window.SD | `persist`, `loadData`, `freshData`, `clearStorage`, `cleanupStorage`, `clearSWCache` |
| `default-decks.js` | Starter-Vokabelsammlungen für neue Nutzer | `DEFAULT_DECKS` |
| `auth.js` | Supabase Auth: Login, Registrierung, Passwort-Reset, Google-OAuth | `signIn`, `signUp`, `signOut`, `onAuthChange`, `requestPasswordReset`, `updatePassword`, `resendConfirmation`, `signInWithGoogle` |
| `sync.js` | Cloud Read/Write + Offline-Queue + Schreib-Gate + updated_at-Signatur | `cloudLoad`, `cloudProbe`, `saveProfile`, `saveDeck`, `saveWordStats`, `saveGlobalPresetStats`, `saveExam`, `deleteCloud*`, `loadProfile`, `cloudReset`, `markDirty`, `flushPendingSync`, `getPendingCount`, `setCloudConfirmed`, `cloudConfirmed`, `readSyncMeta`, `writeSyncMeta`, `clearSyncMeta`, `metaDiffers` |
| `decks.js` | Deck CRUD + UI-State + Spiegel-Sync | `activeDeck`, `syncMirrorFromActiveDeck`, `switchDeck`, `createDeck`, `deckProgress`, `presetProgressPct`, `renderDecks`, `migrateStatKeys` |
| `stats.js` | EMA-basierte Statistik-Berechnungen + statKey-Normalisierung | `effectivePct`, `isStatMastered`, `isMastered`, `statKeyFor`, `normStatDE`, `normStatEN`, `getVocabStat`, `presetWordsPct`, `modePct` |
| `speech.js` | TTS (Web Speech API) + Spracherkennung (Vosk offline) | `_initTTS`, `primeTTS`, `speakWord`, `speakWordOnce`, `ensureMicStream`, `releaseMicStream`, `startVoskRecognition`, `startRecording`, `voskStop`, `stopVisualizer` |
| `audio.js` | Hintergrundmusik (MP3-Playlist, endlos) | `_discoverTracks`, `_initAudio`, `_trackUrl`, `startMusicSync`, `_setMusicBtns` |
| `pwa.js` | PWA Install-Prompt + iOS-Hinweis-Banner | `pwaInstall`, `pwaSetup` |
| `game.js` | Spielmechanik: Fragen, Punkte, Streak, Exam | `_sfx` + zahlreiche `window.*` Game-State-Variablen |
| `vocab.js` | VokabelManager UI: Hinzufügen, Scannen, Einfügen, Preset-Kategorien, Draft-Flow für neue Sammlungen, Vorlagen-Deck-Statistik | `openVocabManager`, `openPresetDeckStats`, `getPresetCategories`, `vmTab`, `renderVocabList`, `confirmAddVocab`, `renderPresetsTab`, `togglePresetCategory`, `vmRenameActiveDeck`, `newDeckFlow`, `vmBack` |
| `ui.js` | Screen-Routing, Auth-Lifecycle, Modus-Toggle, alle UI-Event-Handler | `showScreen`, `showMenu`, `handleLogin`, `handleLogout`, `maybeRefreshOnResume`, `showNewPasswordScreen`, `saveName`, `authGoogleSignIn`, `setActiveMode`, `renderModeContent` |
| `startup.js` | Boot-Sequenz: TTS, Audio, Vosk, Auth-Session | `startupSequence`, `finishStartup` |
| `dialog.js` | App-eigene Overlay-Dialoge + Speicher-Indikator. Promise-basiert; Abbrechen löst keine Speicheraktion aus | `esAlert`, `esConfirm`, `esPrompt`, `esToast`, `withSaving`, `commitDirty` (auch als `window.*`) |

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

**Token-Resilienz (`ensureFreshToken`):** `cloudLoad` und `cloudProbe` rufen am Anfang `ensureFreshToken()` — prüft via `getSession()` die Restlaufzeit des Access-Tokens und ruft bei Ablauf/<60s `supabase.auth.refreshSession()`. Verhindert 401 nach längerem Hintergrund (Gerät aufgewacht, `autoRefreshToken`-Timer noch nicht gefeuert) → der Pull bekommt einen gültigen JWT statt „failed → alter lokaler Stand". Schlägt der Refresh fehl (Refresh-Token ungültig) → bestehender `failed`-Pfad (Retry/Offline).

---

## Sync-Modell (vier Regeln) — Garantien an je EINER Stelle

Bewusst EIN zusammenhängender Aufbau. Zwei getrennte Jobs: **PULL** (Frische über
`updated_at`) nur beim App-Öffnen; **PUSH** (jede Änderung) bestätigt + sichtbar.
**Kein mid-session Reconcile bei normaler Navigation** (das war die alte Regression).

| Garantie | Wohnt in (EINE Stelle) |
|---|---|
| Empty-Write-Schutz | `_cloudConfirmed`-Gate in `sync.js` — gesetzt NUR von `adoptCloudState`/`handleLogin` (true) + `handleLogout` (false); geprüft in `saveProfile` + `flushPendingSync` |
| Cloud = einzige Wahrheit (KEIN Wert-Merge) | `adoptCloudState()` in `ui.js` — übernimmt `window.SD` **1:1** aus der Cloud; einzige Stelle, die das tut |
| Konfliktregel (Revert-Schutz) | **Probe zuerst** in `handleLogin`/`maybeRefreshOnResume`: Cloud seit letztem Sync geändert? → Cloud gewinnt (lokale Pending NICHT pushen). Cloud unverändert → eigene Pending sicher hochschieben. So kann ein öffnendes Gerät die Cloud nie mit altem Lokalstand reverten. |
| „neuer Nutzer" vs. „Load fehlgeschlagen" | Status von `cloudLoad()` (`ok`/`new`/`failed`) |
| Load-Timeout/Retry | `cloudLoad` (5s×2) / `cloudProbe` (4s×1); `ensureFreshToken` (getSession 3s, refreshSession 5s) |
| Speichern sichtbar + bestätigt + Timeout-Fallback | `withSaving()` / `commitDirty()` in `dialog.js` |

**Wahrheits-Token:** `updated_at` serverseitig per DB-Trigger (`set_updated_at` auf
profiles/decks/word_stats/preset_stats/preset_category_progress); Client schickt es
nicht mehr mit. Signatur `meta = {ts:max(updated_at), count}` je Bereich (count fängt
Löschungen ab), gemerkt in `localStorage['es_sync_meta2']`. **`es_sync_meta` wird
NUR in `adoptCloudState` geschrieben** (= „welche Cloud-Version liegt gerade in
`window.SD`"). Nie per Probe nach einem Write — sonst liefe die Signatur den Daten
voraus (fremde Cloud-Änderung geprobt, aber nicht geladen) → `metaDiffers` fälschlich
`false` → Gerät bliebe alt (nur Storage-Löschen half). Key ist versioniert (`…2`)
zur einmaligen Selbstheilung alter, verlaufener Signaturen.

**Regel 1 — App öffnen / Foreground-Resume** (`handleLogin` bzw. `maybeRefreshOnResume`):
```
Gate ZU.  probe = cloudProbe()   (ensureFreshToken intern, hart timeout-begrenzt)
 ├─ probe fail → autoritativer cloudLoad (Retry/JWT) → ok: adopt 1:1 | new: name-screen | failed: lokal/Retry
 └─ probe ok:  cloudChanged = !stored || metaDiffers(probe, stored)
       ├─ cloudChanged ODER !localValid → cloudLoad → adoptCloudState (Cloud 1:1).
       │     Lokale Pending NICHT pushen → KEIN Revert der Cloud durch altes Lokal.
       └─ sonst (Cloud unverändert) → eigene Pending sicher flushen (kein Reload).
```
**Probe zuerst** ist der Revert-Schutz: hat ein anderes Gerät die Cloud geändert,
gewinnt die Cloud — das öffnende Gerät schiebt seinen (evtl. alten) Lokalstand NICHT
hoch. Trade-off: eine rein offline gespielte Runde kann bei parallelem Cloud-Write
verloren gehen (selten, da Rundenende-Saves bestätigt sind) — besser als das stille
Zurücksetzen, das die Änderungen des anderen Geräts verlöre.

Es gibt **keinen Wert-Merge** mehr (kein `max`): die Cloud gewinnt beim Start immer,
alle Geräte gleichwertig. Eine echte ungesyncte Runde geht nicht verloren, weil sie
über Pre-Flush (Punkte UND word_stats zusammen) hochgeschoben wird, bevor übernommen
wird — und falls der Push nicht bestätigt, greift der Guard. Foreground-Resume läuft NUR
auf Menü-Ebene (nie im Spiel/Scan/Edit), debounced via `_resumeInFlight`.

**Regel 2 — Runde zu Ende / aus Spiel zurück** (`game.js`): `saveProgress()` verbucht
lokal + `markDirty`; `commitProgress()` = `commitDirty()` zeigt „Speichern…", wartet
auf Bestätigung. `confirmHome` wartet, DANN Menü.

**Regel 3 — jede Änderung** (Name/Deck/Vokabeln in `ui.js`/`decks.js`/`vocab.js`):
window.SD ändern + persist + `markDirty(...)` + `await commitDirty()`.

**Aktiver Login = „fresh" (Single-Session):** `handleLogin(user, {fresh:true})` bei
echtem Login (E-Mail-Submit, Google-Rückkehr via `sessionStorage['es_fresh_login']`,
neues Passwort) → (1) `signOutOtherDevices()` (`supabase.auth.signOut({scope:'others'})`)
loggt alle ANDEREN Geräte aus (deren Refresh-Token wird widerrufen) → nie zwei Geräte
gleichzeitig aktiv → keine Konflikte; (2) `clearStorage()` + `freshData()` → der lokale
Stand wird verworfen und die Cloud autoritativ geladen. Ein **persistierter** Session-Start
(gleiches Gerät wieder öffnen) ist `fresh:false` → lokaler Stand bleibt, offline-fest,
Pending wird hochgeschoben. Das ausgeloggte andere Gerät merkt es beim nächsten
Token-Refresh (SIGNED_OUT → `handleLogout`) und verlangt dann neuen Login → sauberer Load.

**Regel 4 — Multi-Device:** jeder bestätigte Write hebt den Server-`updated_at`.
`es_sync_meta` bleibt auf der zuletzt **geladenen** Cloud-Version stehen (nur
`adoptCloudState` schreibt sie) → JEDES Gerät (auch das schreibende selbst) erkennt
beim nächsten Öffnen via `metaDiffers`, dass die Cloud neuer ist, und lädt sie 1:1
nach. Das schreibende Gerät lädt seinen eigenen Stand einmal kurz nach (Cloud =
Wahrheit) — winzig, dafür garantiert konsistent.

`withSaving` blockiert nie: Timeout/Fehler → Balken weg + Toast „Im Hintergrund
gespeichert", `saveFn` läuft im Hintergrund weiter, Marker bleibt in der Queue.

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

**Service Worker (`sw.js`)** — Cache-Name `english-stars-<VERSION>`, `activate` löscht alle Caches außer der aktuellen Version. `VERSION` ist **an `APP_VERSION` gekoppelt**: `pwa.js` registriert `sw.js?v=<APP_VERSION>`, `sw.js` liest die Version aus seiner eigenen Script-URL (`self.location` `?v`). Dadurch ändert sich pro Deploy die SW-Script-URL → der Browser installiert einen neuen SW → `activate` purged den alten Cache. Verhindert, dass das Handy bei wackligem Mobilladen einen **gemischten Stand** fährt (frische Versionsanzeige aus `config.js`, aber altes Modul aus dem Cache via network-first-Fallback) — eine Quelle der Wahrheit, kein manuelles Synchronhalten zweier Nummern. Fetch-Strategie:
- **network-first** für same-origin App-Code/Shell (HTML, JS, CSS, manifest, JSON) → Deploy-Updates kommen online sofort an, offline Cache-Fallback. Der Netz-Fetch nutzt **`cache:'reload'`** und umgeht damit den **HTTP-Cache des Browsers** — sonst liefert `fetch()` trotz „network-first" die HTTP-gecachte alte Datei (Modul-URLs sind ohne `?v`, GitHub Pages setzt `max-age`), und ein normaler Reload bräuchte Strg+Shift+R. Der VERSION-Bump purged nur den Cache Storage, nicht den HTTP-Cache — `cache:'reload'` schließt diese Lücke.
- **cache-first** für große/statische Assets (Vosk-Modell `.tar.gz`, Bilder, Fonts, Audio) + alle Cross-Origin-Libs (CDN) → persistent über Kaltstarts.

Auch der **Precache** im `install` holt Shell/`index.html` mit `cache:'reload'` (`new Request(u,{cache:'reload'})`), damit der neue SW garantiert eine frische Shell cached und nicht versehentlich eine HTTP-gecachte stale `index.html` (Offline-Fallback).

> **Hinweis Übergangs-Deploy:** Der `?v=APP_VERSION`-Update greift nur, wenn *frischer* Code `register()` mit neuem `?v` aufruft. Solange ein SW *vor* dem `cache:'reload'`-Fix aktiv ist, liefert er Code stale aus dem HTTP-Cache → der neue SW kann sich nicht selbst ausliefern (Henne-Ei). Dieser eine Übergang braucht einmalig Strg+Shift+R / Unregister; **danach** holt jeder normale Reload frischen Code.

Es gibt **keinen** Boot-Cache-/localStorage-Wipe mehr (früher in `startup.js`). Der Wipe untergrub den SW und kostete bei jedem Start einen Vosk-Re-Download + Verlust von `pending_sync`.

**Vosk-Modell** liegt same-origin unter `models/vosk-model-small-en-us-0.15.tar.gz` (~40 MB), URL via `new URL('models/…', document.baseURI)`. `Vosk.createModel` lädt es per Voll-GET (200) und untart es im Worker → vom SW cache-first persistent gecacht.

**Vosk-Laden entkoppelt** vom Startup: `startup.js` blockiert **nicht** mehr mit `await _voskLoad()`, sondern stößt es fire-and-forget an → App ist in 1–2 s „bereit". Flag `window._voskReady` zeigt Fertigstellung. Öffnet jemand eine Aussprache-Übung bevor Vosk fertig ist, wartet `startVoskRecognition` (speech.js) freundlich mit sichtbarem Status („⏳ Spracherkennung wird vorbereitet…") und startet automatisch, sobald bereit — kein Blockieren, kein stilles Fehlschlagen.

**Musik** (`audio.js`): `visibilitychange`+`document.hidden` → pausiert. Auto-Resume bei Rückkehr ist an die **gespeicherte bewusste Einstellung** `localStorage['es_music']` gekoppelt (nicht an einen flüchtigen „lief gerade"-Zustand): war Musik bewusst an und die Session entsperrt (`_musicOn`), läuft sie wieder; war sie aus, bleibt sie aus. Toggle-Button schreibt `es_music`; Start-Button (`startup.js`) stellt die Einstellung nach der Audio-Unlock-Geste wieder her.

**Relaunch-Restore** (`ui.js`): `showScreen` merkt Menü/Profil/Fortschritt in `localStorage['es_last_screen']`; `handleLogin` → `restoreLastScreen()` landet nach Relaunch dort (kein Restore mitten in Spiel/Scan/Review).

**controllerchange-Reload** (`pwa.js`): neuer SW → Reload, aber **aufgeschoben** wenn in Spiel/Scan/Review (`window._pendingReload`), ausgeführt beim nächsten `showMenu`.

**Waiting-SW beim Laden** (`pwa.js`): Nach `register()` wird zusätzlich `reg.waiting` geprüft — ist ein neuer SW schon im `waiting`-Zustand (z. B. in einem früheren Besuch installiert), feuert `updatefound` nicht erneut; dann wird `skipWaiting` direkt nachgeholt (nur bei echtem Update, d. h. Controller vorhanden). So greift der Auto-Reload zuverlässig statt am wartenden SW hängenzubleiben.

**Android Zurück-Button** (`ui.js`): Back-Layer für **In-App-Back**, **sofort beim Laden** aktiv (`initBackNav` via DOMContentLoaded — bewusst NICHT an `menu-screen`/Login gekoppelt). Zwei Sorten History-Einträge (beide `pushState` mit **gleicher URL** → Recovery-Hash unberührt) lösen beim Zurück ein abfangbares `popstate` aus: der **Menü-Wächter** (`_armGuard`, Marker `esBackGuard`) und der **Screen-Eintrag** (Marker `esScreen`). **Wichtig — `showScreen` pusht bei echter VORWÄRTS-Navigation zu einem In-App-Screen** (nicht `menu-screen`, nicht `NAV_IGNORE`) einen `esScreen`-Eintrag, damit die History-Tiefe „im Menü" von „auf Stats/Profil/Spiel" unterscheidbar wird (sonst poppt der Zurück direkt den Wächter und landet fälschlich im Menü-Exit). Unterdrückt wird dieser Push, wenn `showScreen` **aus dem `popstate`-Handler** kommt (Flag `_inPopstate`, in `_onBackNavPop` per `try/finally` gesetzt) — sonst Stapel-Aufbau/Schleife. `_hasBackEntry()` zählt **beide** Marker; `_ensureGuard()` legt nur dann einen Wächter, wenn keiner der beiden oben liegt (verhindert Doppel-Stapeln auf einem Screen-Eintrag). Der Wächter wird **nur gestengedeckt** gesetzt (Chrome ignoriert gestenlos erzeugte Einträge beim Back): beim Init, im `popstate` selbst (gestennah) und bei echter Geste (`_refreshGuardOnGesture` via `pointerdown`/`click`/`touchstart` capture → `_ensureGuard`). `popstate` (= Zurück) in Priorität: (1) oberstes Overlay schließen — generisch über die Dialog-Kennung `position:fixed`+`z-index:9999` bzw. `.es-overlay` — dann `_ensureGuard`; (2) `game-screen` → `confirmHome` (Speichern-Nachfrage) → `_ensureGuard`; (3) sonst nicht im Menü (und kein Pre-Login-Screen aus `NAV_IGNORE`) → `showMenu` → `_ensureGuard`; (4) im Menü/Pre-Login → **zeitbasierter Double-Back-to-Exit** (minimal): erster Zurück zeigt einen Hinweis-**Toast** (`_showExitToast`, `z-index:10000`, damit `_topOverlay` ihn nicht als Modal greift; Auto-Hide ~2 s), setzt `_lastBackTs` und re-armt (`_ensureGuard`, damit der zweite Zurück wieder ein popstate auslöst); ein **zweiter Zurück innerhalb `EXIT_WINDOW≈2 s`** → `history.back()` verlässt die PWA. Die Zeitprüfung ist **unabhängig vom Wächter-Stand** — nötig, weil auf Wisch-Navigation der Zurück-Wisch selbst `touchstart` feuert und den Wächter sofort nacharmt (würde ein rein wächter-basiertes Verlassen aushebeln). Bewusst **minimal**: nur `_lastBackTs` + `EXIT_WINDOW`, **ohne** den alten Ballast (`_ensureTwoGuards`/`_depth`, bfcache/`pageshow`/`resume`, Diagnose). **Den finalen Exit erzwingen wir nicht zu 100 %** — Plattformgrenze; für garantierte Kontrolle über den Hardware-Back wäre ein **TWA-Wrapper** nötig (s. PROJEKT-STATUS To-do).
