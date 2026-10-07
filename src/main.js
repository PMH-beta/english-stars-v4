// src/main.js
// Einstiegspunkt - lädt die Legacy-App und ergänzt sie schrittweise mit Modulen
import { APP_VERSION, isIOS, isStandalone } from './modules/config.js';
import { persist, loadData, freshData } from './modules/storage.js';
import { _initTTS, speakWord, speakWordOnce, ensureMicStream, releaseMicStream, startVisualizer, stopVisualizer, voskStart, voskStop, _shouldUseVosk, startRecording, startVoskRecognition } from './modules/speech.js';
import { _trackUrl, _discoverTracks, _playNext, _initAudio, startMusic, startMusicSync, stopMusic, setMusicVolume, _setMusicBtns, toggleMusic, toggleVolPopup } from './modules/audio.js';
import { effectivePct, isMastered } from './modules/stats.js';
import { buildPool, toggleSchnell, syncSchnellForMode, startGame, confirmHome, goHomeSaving, nextQuestion, restartSame, checkMC, submitType, checkOrder, showSelfRateButtons, retryPronounce, evaluateWithClaude, setMicFinalStatus, _sfx, playSfx } from './modules/game.js';
import { syncMirrorFromActiveDeck, activeDeck, switchDeck, createDeck, deleteDeck, renameDeck, deckProgress, renderDecks, toggleDeck, activateDeck, startGameWithDeck, newDeckPrompt, renameDeckPrompt, confirmDeleteDeck, resetDeckProgress, vmDeleteWord, vmEditWord, vmAddManual, openDeckStats } from './modules/decks.js';
import { charReiter, charOption, charSchritt, charFarbe } from './modules/avatar.js';
import { tourAnsehen } from './modules/tour.js';
import { showScreen, saveName, showMenu, showProfile, editPlayerName, showCharacter, showCharacterOnboarding, finishCharacterOnboarding, closeCharacter, charSpeichern, charNameBearbeiten, charZurSchmiede, showStats, showFriendStats, closeFriendStats, confirmReset, showFeedback, hideFeedback, exportData, importData, showAuth, authToggleMode, authSubmit, authResend, authLogout, authGoogleSignIn, handleLogin, handleLogout, showPasswordReset, submitPasswordReset, showNewPasswordScreen, submitNewPassword, cancelNewPassword, setActiveMode, renderModeContent, openProbetestPicker, toggleProbetestHistory, deleteProbetestEntry, uvFlip, uvSlide, uvSetForm, uvInfo, uvWaffenInfo, uvOpenFill, uvTestForge, uvTestForgeRandom, toggleUvTraining, uvTrainOpenCreate, uvTrainDelete, uvTrainToggleDeck, uvTrainChooseForms, uvTrainReset, uvTrainOpenStats, onAppResume, checkForRemoteChange, softRefresh } from './modules/ui.js';
import { pwaInstall } from './modules/pwa.js';
import { startConstellationStar, startConstellationForm, startUvTraining, uvProgress } from './modules/irregular-game.js';
import { openVocabManager, openPresetDeckStats, vmTab, renderVocabList, parsePastedText, onScanFile, showReview, renderReviewList, removeReviewItem, addReviewItem, rescanReview, confirmAddVocab, renderPresetsTab, togglePresetCategory, vmBack, vmRenameActiveDeck, newDeckFlow, newDeckPreset, newDeckCustom, confirmAbortDraft } from './modules/vocab.js';
import { onFriendSearchInput, onFriendSearchEnter, sendFriendRequest, respondFriendRequest, cancelFriendRequest, confirmRemoveFriend, openFriendStats, refreshFriendBadge, refreshFriendsLive } from './modules/friends.js';
import { startCampaignRun, campaignNode, campaignGiveUp, campPotionInfo, talerTest, talerDeckTest } from './modules/campaign.js';
import './modules/dialog.js'; // registriert window.esAlert/esConfirm/esPrompt (App-Overlays statt nativer Dialoge)
import { startupSequence, finishStartup, showStartGate } from './modules/startup.js';
import { supabase, testConnection } from './modules/supabase.js';
import { flushPendingSync } from './modules/sync.js';
import { startIconAutoPaint, iconHTML } from './modules/pixel-icons.js';
import { startUiTakt } from './modules/ui-takt.js';

console.log('[main] English Stars', APP_VERSION, 'startet…');

// Hinweis: Früher löschte ein preBoot() hier bei JEDEM Boot den kompletten
// SW-Cache (clearSWCache) + temporäre localStorage-Keys (cleanupStorage).
// Entfernt — der Service Worker verwaltet Caching jetzt korrekt (network-first
// für App-Code, cache-first für Modell/Statik). Der Wipe kostete einen Vosk-
// Re-Download pro Kaltstart und löschte pending_sync (Offline-Queue).
// clearSWCache/cleanupStorage bleiben in storage.js für bewusste Aufräum-Aktionen.

// Module global verfügbar machen für die Legacy-App (damit alte Funktionen darauf zugreifen können)
import * as storage from './modules/storage.js';
import * as config from './modules/config.js';
window.ESModules = { storage, config };
window.APP_VERSION = APP_VERSION;
const _vb = document.getElementById('version-badge');
if (_vb) _vb.textContent = APP_VERSION;
// Die Pastell-Screens tragen die Version selbst am unteren Rand.
document.querySelectorAll('.p-version').forEach(el => { el.textContent = APP_VERSION; });

// window.persist: liest window.SD als Fallback, kompatibel mit Legacy-Calls ohne Argument
window.persist = (state = window.SD) => persist(state);
// window.loadData: gibt rohe Storage-Daten zurück (ohne App-Logik wie migrateData)
window.loadData = loadData;
window.freshData = freshData;

// TTS: shared state auf window (Index.html liest/schreibt diese direkt)
window._ttsVoices = [];
window._spokenForQuestion = false;
// TTS-Funktionen via window für Legacy-Code
window._initTTS = _initTTS;
window.speakWord = speakWord;
window.speakWordOnce = speakWordOnce;

// Spracherkennung via window für Legacy-Code
window.ensureMicStream = ensureMicStream;
window.releaseMicStream = releaseMicStream;
window.startVisualizer = startVisualizer;
window.stopVisualizer = stopVisualizer;
window.voskStart = voskStart;
window.voskStop = voskStop;
window._shouldUseVosk = _shouldUseVosk;
window.startRecording = startRecording;
window.startVoskRecognition = startVoskRecognition;

// Stats via window für Legacy-Code
window.effectivePct = effectivePct;
window.isMastered = isMastered;
window.buildPool = buildPool;

// Game via window für Legacy-Code
window.toggleSchnell = toggleSchnell;
window.syncSchnellForMode = syncSchnellForMode;
window.startGame = startGame;
window.confirmHome = confirmHome;
window.goHomeSaving = goHomeSaving;
window.nextQuestion = nextQuestion;
window.restartSame = restartSame;
window.checkMC = checkMC;
window.submitType = submitType;
window.checkOrder = checkOrder;
window.showSelfRateButtons = showSelfRateButtons;
window.retryPronounce = retryPronounce;
window.evaluateWithClaude = evaluateWithClaude;
window.setMicFinalStatus = setMicFinalStatus;
window._sfx = _sfx;
window.playSfx = playSfx;

// Gestaltwandler (UV-Engine): Sternbild-Sterne starten + Live-Fortschritt.
// _uvProgress wird von game.js (progressForCurrentMode) im UV-Zweig genutzt.
window.startConstellationStar = startConstellationStar;
window.startConstellationForm = startConstellationForm;
window._uvProgress = uvProgress;

// Decks via window für Legacy-Code
window.syncMirrorFromActiveDeck = syncMirrorFromActiveDeck;
// Nach loadData() (index.html, inline) Spiegel synchronisieren — Modul läuft deferred nach inline-Script
syncMirrorFromActiveDeck();
window.activeDeck = activeDeck;
window.switchDeck = switchDeck;
window.createDeck = createDeck;
window.deleteDeck = deleteDeck;
window.renameDeck = renameDeck;
window.deckProgress = deckProgress;
window.renderDecks = renderDecks;
window.toggleDeck = toggleDeck;
window.activateDeck = activateDeck;
window.startGameWithDeck = startGameWithDeck;
window.newDeckPrompt = newDeckPrompt;
window.renameDeckPrompt = renameDeckPrompt;
window.openDeckStats = openDeckStats;
window.confirmDeleteDeck = confirmDeleteDeck;
window.resetDeckProgress = resetDeckProgress;
window.vmDeleteWord = vmDeleteWord;
window.vmEditWord = vmEditWord;
window.vmAddManual = vmAddManual;

// UI via window für Legacy-Code
window.isIOS = isIOS;
window.isStandalone = isStandalone;
window.pwaInstall = pwaInstall;
window.exportData = exportData;
window.importData = importData;
window.showScreen = showScreen;
window.saveName = saveName;
window.showMenu = showMenu;
window.showProfile = showProfile;
window.editPlayerName = editPlayerName;
window.showCharacter = showCharacter;
window.showCharacterOnboarding = showCharacterOnboarding;
window.finishCharacterOnboarding = finishCharacterOnboarding;
window.closeCharacter = closeCharacter;
window.charSpeichern = charSpeichern;
window.charNameBearbeiten = charNameBearbeiten;
window.charZurSchmiede = charZurSchmiede;
window.showFriendStats = showFriendStats;
window.closeFriendStats = closeFriendStats;
window.onFriendSearchInput = onFriendSearchInput;
window.onFriendSearchEnter = onFriendSearchEnter;
window.sendFriendRequest = sendFriendRequest;
window.respondFriendRequest = respondFriendRequest;
window.cancelFriendRequest = cancelFriendRequest;
window.confirmRemoveFriend = confirmRemoveFriend;
window.startCampaignRun = startCampaignRun;
window.campaignNode = campaignNode;
window.campaignGiveUp = campaignGiveUp;
window.campPotionInfo = campPotionInfo;
window.talerTest = talerTest;   // Debug: Test-Taler in der Konsole (talerTest(50))
window.talerDeckTest = talerDeckTest;   // Debug: Taler aus „fertigen" Deck-Übungsarten (talerDeckTest(4))
window.openFriendStats = openFriendStats;
window.refreshFriendBadge = refreshFriendBadge;
window.charReiter = charReiter;
window.tourAnsehen = tourAnsehen;
window.charOption = charOption;
window.charSchritt = charSchritt;
window.charFarbe = charFarbe;
window.showStats = showStats;
window.confirmReset = confirmReset;
window.showFeedback = showFeedback;
window.hideFeedback = hideFeedback;

// Auth via window für HTML onclick-Handler
window.setActiveMode = setActiveMode;
window.renderModeContent = renderModeContent;
window.openProbetestPicker = openProbetestPicker;
window.toggleProbetestHistory = toggleProbetestHistory;
window.deleteProbetestEntry = deleteProbetestEntry;
window.uvFlip = uvFlip;
window.uvSlide = uvSlide;
window.uvSetForm = uvSetForm;
window.uvInfo = uvInfo;
window.uvWaffenInfo = uvWaffenInfo;
window.uvOpenFill = uvOpenFill;
window.uvTestForge = uvTestForge;
window.uvTestForgeRandom = uvTestForgeRandom;   // Debug: Aufträge mit Zufalls-Teilfortschritt (uvTestForgeRandom(3))
window.toggleUvTraining = toggleUvTraining;
window.uvTrainOpenCreate = uvTrainOpenCreate;
window.uvTrainDelete = uvTrainDelete;
window.uvTrainToggleDeck = uvTrainToggleDeck;
window.uvTrainChooseForms = uvTrainChooseForms;
window.uvTrainReset = uvTrainReset;
window.uvTrainOpenStats = uvTrainOpenStats;
window.startUvTraining = startUvTraining;
window.showAuth = showAuth;
window.authToggleMode = authToggleMode;
window.authSubmit = authSubmit;
window.authResend = authResend;
window.authLogout = authLogout;
window.authGoogleSignIn = authGoogleSignIn;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.showPasswordReset = showPasswordReset;
window.submitPasswordReset = submitPasswordReset;
window.showNewPasswordScreen = showNewPasswordScreen;
window.submitNewPassword = submitNewPassword;
window.cancelNewPassword = cancelNewPassword;

// Startup via window für Legacy-Code (finishStartup: onclick="finishStartup()" im HTML)
window.startupSequence = startupSequence;
window.finishStartup = finishStartup;
// ui.js (authSubmit) ruft den Gate nach erfolgreicher Anmeldung über window auf —
// ein direkter Import waere ein Zyklus, weil startup.js seinerseits ui.js importiert.
window.showStartGate = showStartGate;

// Vocab via window für Legacy-Code
window.openVocabManager = openVocabManager;
window.openPresetDeckStats = openPresetDeckStats;
window.vmTab = vmTab;
window.renderVocabList = renderVocabList;
window.parsePastedText = parsePastedText;
window.onScanFile = onScanFile;
window.showReview = showReview;
window.renderReviewList = renderReviewList;
window.removeReviewItem = removeReviewItem;
window.addReviewItem = addReviewItem;
window.rescanReview = rescanReview;
window.confirmAddVocab = confirmAddVocab;
window.renderPresetsTab = renderPresetsTab;
window.togglePresetCategory = togglePresetCategory;
window.vmBack = vmBack;
window.vmRenameActiveDeck = vmRenameActiveDeck;
window.confirmAbortDraft = confirmAbortDraft;
window.newDeckFlow = newDeckFlow;
window.newDeckPreset = newDeckPreset;
window.newDeckCustom = newDeckCustom;

// Musik via window für Legacy-Code
window._trackUrl = _trackUrl;
window._discoverTracks = _discoverTracks;
window._playNext = _playNext;
window._initAudio = _initAudio;
window.startMusic = startMusic;
window.startMusicSync = startMusicSync;
window.stopMusic = stopMusic;
window.setMusicVolume = setMusicVolume;
window._setMusicBtns = _setMusicBtns;
window.toggleMusic = toggleMusic;
window.toggleVolPopup = toggleVolPopup;

// Offline-Queue bei Wiederverbindung leeren
window.addEventListener('online', () => { if (window.currentUser) flushPendingSync().catch(() => {}); });

// Foreground-Resume: war die App länger als 2 Min im Hintergrund, beim Zurückkommen
// HART neu aus der Cloud laden (onAppResume, nur auf Menü-Ebene). Beim Verstecken
// Zeitstempel merken + offene Nachzügler sichern.
const RESUME_RELOAD_MS = 2 * 60 * 1000;   // 2 Minuten
let _hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    _hiddenAt = Date.now();
    if (window.currentUser) flushPendingSync().catch(() => {});
    return;
  }
  if (document.visibilityState === 'visible' && window.currentUser) {
    // Sicherheitsnetz: war die WebSocket im Hintergrund getrennt, könnten Anfragen
    // verpasst worden sein → einmalig nachladen (ein Fetch, kein Dauer-Poll).
    refreshFriendsLive().catch(() => {});
    if (_hiddenAt && (Date.now() - _hiddenAt) > RESUME_RELOAD_MS) {
      onAppResume().catch(() => {});
    }
  }
});

// Minuten-Check: hat ein anderes Gerät die Cloud geändert? → Reload-Hinweis (ui.js).
// Begrenzt den „last-write-wins"-Worst-Case auf ~1 Min. Läuft nur im Menü/sichtbar.
setInterval(() => { checkForRemoteChange().catch(() => {}); }, 60 * 1000);

// ── Pixel-Icons ─────────────────────────────────────────────────────
// Die App rendert überall per innerHTML — ein MutationObserver füllt jedes neu
// aufgetauchte Icon-Canvas, damit kein Aufrufer ans Nachmalen denken muss.
startIconAutoPaint();

// ── UI-Animationen ──────────────────────────────────────────────────
// Ein gemeinsamer 8-fps-Takt für alles mit data-ui="…" (Handoff-Regel 6).
startUiTakt();

// ── Hochformat-Sperre ────────────────────────────────────────────────────────
// Das Manifest (orientation: portrait) sperrt die installierte PWA; hier
// zusätzlich best effort per API (greift z.B. im Standalone-Fenster auf
// Android). Im Browser-Tab erlauben Browser kein Sperren — dort dreht die
// Seite weiterhin mit (bewusst kein Hinweis-Overlay).
try { screen.orientation?.lock?.('portrait').catch(() => {}); } catch (e) {}

// ── Pull-to-Refresh ──────────────────────────────────────────────────────────
// overscroll-behavior:none (style.css) deaktiviert den nativen Browser-Refresh
// → eigener: ganz oben auf der Seite nach unten ziehen lädt die App neu (holt
// dabei auch eine neue Version). Nicht im Spiel (versehentlicher Reload =
// Runde weg) und nicht, wenn ein inneres Scroll-Element (z.B. eine Wortliste)
// selbst gescrollt ist.
(function initPullToRefresh() {
  const THRESHOLD = 90;   // px Zugweg bis zum Auslösen
  const bar = document.createElement('div');
  bar.id = 'ptr-bar';
  // Aussehen wie 9.6: Balken oben (füllt sich mit dem Zugweg), darunter Symbol
  // + Text; der sichtbare Screen rutscht dabei bis zu 64 px nach unten.
  bar.innerHTML = '<div class="ptr-spur"><i></i></div><div class="ptr-zeile"><span class="ptr-ic"></span><span class="ptr-text"></span></div>';
  document.body.appendChild(bar);
  const fill = bar.querySelector('.ptr-spur > i');
  const icEl = bar.querySelector('.ptr-ic'), txtEl = bar.querySelector('.ptr-text');
  let zustand = '';
  const zeige = (icon, text, dreht) => {
    if (zustand === icon + text) return;   // nur bei Wechsel neu zeichnen
    zustand = icon + text;
    icEl.innerHTML = iconHTML(icon, 28).replace('<canvas ', dreht ? '<canvas data-ui="rot90" data-a="2" ' : '<canvas ');
    txtEl.textContent = text;
  };
  let geschoben = null;
  const schiebe = (px) => {
    if (!geschoben) geschoben = [...document.querySelectorAll('.p-screen')].find((s) => s.style.display !== 'none' && getComputedStyle(s).display !== 'none') || null;
    if (!geschoben) return;
    geschoben.style.transform = px ? `translateY(${px}px)` : '';
    if (!px) geschoben = null;
  };
  let startY = 0, dist = 0, active = false;
  const innerScrolled = (t) => {
    for (let n = t; n && n !== document.body; n = n.parentElement) if (n.scrollTop > 0) return true;
    return false;
  };
  document.addEventListener('touchstart', (e) => {
    active = window.scrollY <= 0 && !document.body.classList.contains('in-game')
      && !innerScrolled(e.target);
    startY = e.touches[0].clientY;
    dist = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!active) return;
    if (window.scrollY > 0) { active = false; bar.classList.remove('show'); schiebe(0); return; }
    dist = e.touches[0].clientY - startY;
    if (dist <= 10) { bar.classList.remove('show'); schiebe(0); return; }
    bar.classList.add('show');
    fill.style.width = Math.min(100, Math.round(dist / THRESHOLD * 100)) + '%';
    schiebe(Math.min(64, Math.round(dist * 0.6)));
    if (dist > THRESHOLD) zeige('refresh', 'Loslassen zum Neuladen', true);
    else zeige('refresh', 'Ziehen zum Aktualisieren', false);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (active && dist > THRESHOLD) {
      // Kein location.reload() mehr: das bootete die App komplett neu und landete
      // dadurch auf dem Ladescreen mit „Los geht's" (bzw. im Anmeldescreen, wenn
      // die Sitzung abgelaufen war). softRefresh holt nur die Daten neu und baut
      // den sichtbaren Screen wieder auf — man bleibt, wo man war.
      zeige('refresh', 'Lädt neu …', true);
      softRefresh().then((r) => {
        schiebe(0);
        if (r === 'ok') zeige('check', 'Aktueller Stand', false);
        else if (r === 'failed') zeige('cloud', 'Keine Verbindung', false);
        else { bar.classList.remove('show'); return; }   // 'new'/'skipped': stumm
        setTimeout(() => bar.classList.remove('show'), 1000);
      });
    } else {
      bar.classList.remove('show');
      schiebe(0);
    }
    active = false; dist = 0;
  }, { passive: true });
})();

// Gedrückt-Zustand (Update 1 „Stil A", Fragmente A.1/A.2): alles Antippbare sinkt
// beim Drücken ein — harter Schatten links oben nach innen, die Fläche wird leicht
// dunkler; Rahmen und Größe bleiben gleich. Ersetzt den Wackelpudding-Effekt.
// Anders als im Entwurf (sofort umschalten) gleitet der Zustand kurz hinein und
// wieder heraus, damit es wie echtes Eindrücken aussieht (Wunsch des Nutzers) —
// stufenlos per CSS-Übergang, nicht im 8-fps-Takt. Läuft delegiert am document,
// damit auch alles mitmacht, was später per innerHTML nachgerendert wird. Das
// Aussehen steckt in style.css (.es-press/.es-press-weich).
(function pressOnTap() {
  const SEL = 'button, a[href], summary, [onclick], [role="button"]';
  const MOVE_TOL = 10;              // ab so vielen px gilt die Geste als Ziehen/Scrollen
  const MIN_MS = 180;               // so lange bleibt auch ein ganz kurzer Tipp eingedrückt
  const AUS_MS = 260;               // Zurückgleiten (Dauer wie .es-press-weich in style.css)
  // Seit 08.10.2026 deutlicher (Wunsch des Nutzers: am Handy sah man nichts):
  // tieferer Schatten, Fläche ×0,9, und der Inhalt wird kleiner (siehe groesse).
  const HELL = 'inset 5px 6px 0 rgba(31,31,36,.34)';
  const DUNKEL = 'inset 4px 5px 0 rgba(0,0,0,.66)';
  let pressed = null, pressedAt = 0, startX = 0, startY = 0, spaet = 0;
  let letzter = null;               // { quelle, at } des letzten Drückens (für die Verzögerung)

  // Antippbar ist, was als Knopf gebaut ist — oder wo im CSS der Zeiger-Cursor
  // beginnt (Kacheln/Karten mit Klick-Listener). Ererbtes cursor:pointer zählt nicht.
  // Klappkarten drücken über ihren Kopf immer als ganze Karte — zu wie A.2
  // („Probetest", „Farben"), seit 08.10.2026 auch offen (Wunsch des Nutzers; A.2
  // zeigte offen nur den Pfeil, „Tiere und Natur").
  const KOPF = '.p-sammlung-kopf, .p-zeilenkarte-kopf, .tp-deck-kopf, .fs-karte > summary';
  const zeiger = (el) => getComputedStyle(el).cursor === 'pointer';
  // Knopf ohne eigene Fläche um genau eine Kachel herum (Ausrüstungsfach: Kachel +
  // Beschriftung): eingedrückt wird die sichtbare Kachel. Reiter ohne Fläche
  // bleiben selbst das Ziel (A.2: „Kampagne", „Formen").
  // Pixel-Steine im Kampf markieren ihre Fläche wie die Fragmente mit data-press.
  const hatFlaeche = (el) => { const c = getComputedStyle(el); return c.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(c.borderTopWidth) > 0; };
  function flaeche(el) {
    if (!el) return el;
    const dp = el.matches('[data-press]') ? el : el.querySelector('[data-press]');
    if (dp) return dp;
    if (hatFlaeche(el)) return el;
    const k = [...el.children].filter(hatFlaeche);
    return k.length === 1 ? k[0] : el;
  }
  function ziel(start) {
    for (let el = start; el && el.nodeType === 1 && el !== document.body; el = el.parentElement) {
      if (el.matches(KOPF)) return el.parentElement;
      // Ausdrücklich ohne Zeiger (Kampagnen-Knoten, die gerade nicht erreichbar sind).
      if (el.matches(SEL)) return el.style.cursor === 'default' ? null : flaeche(el);
      if (zeiger(el) && !(el.parentElement && zeiger(el.parentElement))) {
        return el.classList.contains('is-offen') ? null : flaeche(el);
      }
    }
    return null;
  }

  // Farben aus der Fläche ableiten: hell → ×0,94; dunkel (Helligkeit < 60) → #34343C
  // mit dunklerem Schatten; durchsichtig → Hauch Tinte. Ein vorhandener Schatten
  // (z. B. Auswahlring) bleibt stehen, der innere kommt dazu.
  function einfaerben(el) {
    if (el.classList.contains('es-press-weich')) return;   // gleitet noch zurück: Werte stehen
    const cs = getComputedStyle(el);
    const m = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
    const [r = 0, g = 0, b = 0, a = m.length ? (m[3] ?? 1) : 0] = m;
    let bg, sh = HELL;
    if (a === 0) bg = 'rgba(31,31,36,.05)';
    else if (0.299 * r + 0.587 * g + 0.114 * b < 60) { bg = '#34343C'; sh = DUNKEL; }
    else bg = `rgba(${Math.round(r * 0.9)},${Math.round(g * 0.9)},${Math.round(b * 0.9)},${a})`;
    const alt = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow + ', ' : '';
    el.style.setProperty('--es-press-bg', bg);
    el.style.setProperty('--es-press-sh', alt + sh);
    groesse(el);
  }

  // Der Inhalt sinkt mit ein: er wird um rund 4 px je Seite kleiner — bei kleinen
  // und großen Knöpfen gleich tief. In der Bedienung bleibt der Rahmen stehen und
  // nur der Inhalt schrumpft (08.10.2026): Text direkt im Knopf bekommt dafür eine
  // eigene Hülle, Inline-Kinder werden für die Dauer des Drückens inline-block
  // (sonst greift scale nicht). Frei schwebende Teile im Kampf schrumpfen als
  // Ganzes, Pixel-Steine samt Kante (style.css, :has).
  // Faktor und Versatz je Teil: es schrumpft zur rechten unteren Ecke hin (der
  // Schatten fällt von links oben), also um die halbe Schrumpfung nach rechts unten
  // verschoben — die rechte und die untere Kante bleiben stehen.
  function setze(k) {
    const w = k.offsetWidth, h = k.offsetHeight;
    const s = Math.max(0.9, Math.min(0.985, 1 - 8 / Math.max(w, h, 1)));
    k.style.setProperty('--es-press-scale', s.toFixed(3));
    k.style.setProperty('--es-press-dx', ((1 - s) * w / 2).toFixed(1) + 'px');
    k.style.setProperty('--es-press-dy', ((1 - s) * h / 2).toFixed(1) + 'px');
  }
  const loesche = (k) => ['--es-press-scale', '--es-press-dx', '--es-press-dy'].forEach((v) => k.style.removeProperty(v));
  function groesse(el) {
    setze(el);
    const frei = !el.matches('[data-press]') && !!el.closest('#cf-overlay');
    el.classList.toggle('es-press-ganz', frei);
    if (frei || el.matches('[data-press]')) return;
    for (const n of [...el.childNodes]) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const h = document.createElement('span');
      h.className = 'es-press-txt';
      n.replaceWith(h);
      h.appendChild(n);
    }
    for (const k of el.children) {
      if (getComputedStyle(k).display === 'inline') k.classList.add('es-press-inline');
      setze(k);   // jedes Innenteil sinkt gleich tief ein
    }
  }

  function aufraeumen(el) {
    el.classList.remove('es-press', 'es-press-weich', 'es-press-ganz');
    for (const k of el.children) { k.classList.remove('es-press-inline'); loesche(k); }
    el.style.removeProperty('--es-press-bg');
    el.style.removeProperty('--es-press-sh');
    loesche(el);
  }

  // Abbruch ohne Zurückgleiten: beim Karten-Ziehen soll die Karte sofort ohne
  // Druckschatten am Finger hängen. window.esPressCancel ruft decks.js, wenn der
  // Long-Press-Drag startet (der beginnt ohne Fingerbewegung).
  const cancel = () => {
    clearTimeout(spaet);
    if (!pressed) return;
    aufraeumen(pressed);
    pressed = null;
  };
  window.esPressCancel = cancel;

  const release = () => {
    clearTimeout(spaet);
    if (!pressed) return;
    const el = pressed;
    pressed = null;
    el.classList.remove('es-press');
    setTimeout(() => { if (el !== pressed && !el.classList.contains('es-press')) aufraeumen(el); }, AUS_MS + 30);
  };
  // Loslassen: ein ganz kurzer Tipp bleibt noch bis MIN_MS unten, sonst sähe man
  // vom Eindrücken nichts.
  const loslassen = () => {
    if (!pressed) return;
    const rest = MIN_MS - (performance.now() - pressedAt);
    if (rest > 0) { clearTimeout(spaet); spaet = setTimeout(release, rest); } else release();
  };

  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;       // nur die Haupttaste
    letzter = null;                 // ein Tipp auf etwas nicht Drückbares verzögert nichts
    const el = ziel(e.target);
    if (!el || el.closest(':disabled, [aria-disabled="true"], [inert]')) return;
    release();                      // ein noch offenes Drücken sauber beenden
    einfaerben(el);
    pressed = el;
    pressedAt = performance.now();
    letzter = { quelle: e.target, at: pressedAt };
    startX = e.clientX; startY = e.clientY;
    el.classList.add('es-press', 'es-press-weich');
  }, true);

  // Aktion erst nach dem Drücken (08.10.2026, F-69 A): Ein Tipp öffnet sonst oft
  // sofort einen anderen Screen oder zeichnet die Liste neu — der gedrückte Knopf
  // ist weg, bevor man ihn einsinken sieht. Deshalb kommt der Klick erst, wenn der
  // Knopf ganz unten war und ein Stück zurückgeglitten ist (NACH_MS). Ausnahmen:
  // Kampf und Übungs-Screen (Tempo), Formularfelder, und alles, wofür der Browser
  // einen direkten Tipp verlangt (Musik, Installieren, Kamera/Datei; Mikrofon und
  // Vorlesen liegen im Übungs-Screen). data-sofort nimmt weitere Knöpfe aus.
  const NACH_MS = 120;
  const SOFORT = '#cf-overlay, #game-screen, input, select, textarea, label, [data-sofort], '
    + '[onclick*="toggleMusic"], [onclick*="pwaInstall"], [onclick*="scan-file"], .p-ih-btn--ok';
  const restZeit = () => (letzter && performance.now() - letzter.at < 1500)
    ? Math.max(0, letzter.at + MIN_MS + NACH_MS - performance.now()) : 0;
  // Für Gesten ohne click-Event (Deck-Karten reagieren auf touchend).
  window.esNachDruck = (fn) => { const w = restZeit(); if (w > 0) setTimeout(fn, w); else fn(); };
  document.addEventListener('click', (e) => {
    if (!e.isTrusted || !letzter) return;
    const t = e.target;
    if (!(t === letzter.quelle || t.contains(letzter.quelle) || letzter.quelle.contains(t))) return;
    if (t.closest(SOFORT)) return;
    const w = restZeit();
    if (w <= 0) return;
    e.stopPropagation();
    e.preventDefault();
    const { clientX, clientY } = e;
    setTimeout(() => {
      if (t.isConnected) t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1, clientX, clientY }));
    }, w);
  }, true);
  const OPTS = { capture: true, passive: true };
  window.addEventListener('pointermove', (e) => {
    if (!pressed) return;
    if (Math.abs(e.clientX - startX) > MOVE_TOL || Math.abs(e.clientY - startY) > MOVE_TOL) release();
  }, OPTS);
  window.addEventListener('pointerup', loslassen, OPTS);
  window.addEventListener('pointercancel', release, OPTS);
})();

// Supabase-Verbindung testen (kann später raus)
testConnection();
window.supabase = supabase; // temporär für Debugging in DevTools