// src/main.js
// Einstiegspunkt - lädt die Legacy-App und ergänzt sie schrittweise mit Modulen
import { APP_VERSION, isIOS, isStandalone } from './modules/config.js';
import { persist, loadData, freshData } from './modules/storage.js';
import { _initTTS, speakWord, speakWordOnce, ensureMicStream, releaseMicStream, startVisualizer, stopVisualizer, voskStart, voskStop, _shouldUseVosk, startRecording, startVoskRecognition } from './modules/speech.js';
import { _trackUrl, _discoverTracks, _playNext, _initAudio, startMusic, startMusicSync, stopMusic, setMusicVolume, _setMusicBtns, toggleMusic, toggleVolPopup } from './modules/audio.js';
import { effectivePct, isMastered } from './modules/stats.js';
import { buildPool, toggleSchnell, syncSchnellForMode, startGame, confirmHome, goHomeSaving, nextQuestion, restartSame, checkMC, submitType, showSelfRateButtons, retryPronounce, evaluateWithClaude, setMicFinalStatus, _sfx, playSfx } from './modules/game.js';
import { syncMirrorFromActiveDeck, activeDeck, switchDeck, createDeck, deleteDeck, renameDeck, deckProgress, renderDecks, toggleDeck, activateDeck, startGameWithDeck, newDeckPrompt, renameDeckPrompt, confirmDeleteDeck, resetDeckProgress, vmDeleteWord, vmEditWord, vmAddManual, openDeckStats } from './modules/decks.js';
import { showScreen, saveName, showMenu, saveApiKey, skipApiKey, showProfile, editPlayerName, showStats, confirmReset, showFeedback, hideFeedback, exportData, importData, showAuth, authToggleMode, authSubmit, authResend, authLogout, authGoogleSignIn, handleLogin, handleLogout, showPasswordReset, submitPasswordReset, showNewPasswordScreen, submitNewPassword, cancelNewPassword, setActiveMode, renderModeContent, chooseStudentTab, onAppResume, checkForRemoteChange } from './modules/ui.js';
import { pwaInstall } from './modules/pwa.js';
import { startConstellationStar, startConstellationBoss, uvProgress, markBossCleared } from './modules/irregular-game.js';
import { openVocabManager, openPresetDeckStats, vmTab, renderVocabList, parsePastedText, onScanFile, showReview, renderReviewList, removeReviewItem, addReviewItem, confirmAddVocab, renderPresetsTab, togglePresetCategory, vmBack, vmRenameActiveDeck, newDeckFlow, confirmAbortDraft } from './modules/vocab.js';
import './modules/dialog.js'; // registriert window.esAlert/esConfirm/esPrompt (App-Overlays statt nativer Dialoge)
import { startupSequence, finishStartup } from './modules/startup.js';
import { supabase, testConnection } from './modules/supabase.js';
import { flushPendingSync } from './modules/sync.js';

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
window.showSelfRateButtons = showSelfRateButtons;
window.retryPronounce = retryPronounce;
window.evaluateWithClaude = evaluateWithClaude;
window.setMicFinalStatus = setMicFinalStatus;
window._sfx = _sfx;
window.playSfx = playSfx;

// Gestaltwandler (UV-Engine): Sternbild-Sterne starten + Live-Fortschritt.
// _uvProgress wird von game.js (progressForCurrentMode) im UV-Zweig genutzt.
window.startConstellationStar = startConstellationStar;
window.startConstellationBoss = startConstellationBoss;
window._uvProgress = uvProgress;
window._uvMarkBoss = markBossCleared;   // game.js markiert nach der Vollwandlung

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
window.saveApiKey = saveApiKey;
window.skipApiKey = skipApiKey;
window.showProfile = showProfile;
window.editPlayerName = editPlayerName;
window.showStats = showStats;
window.confirmReset = confirmReset;
window.showFeedback = showFeedback;
window.hideFeedback = hideFeedback;

// Auth via window für HTML onclick-Handler
window.setActiveMode = setActiveMode;
window.renderModeContent = renderModeContent;
window.chooseStudentTab = chooseStudentTab;
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
window.confirmAddVocab = confirmAddVocab;
window.renderPresetsTab = renderPresetsTab;
window.togglePresetCategory = togglePresetCategory;
window.vmBack = vmBack;
window.vmRenameActiveDeck = vmRenameActiveDeck;
window.confirmAbortDraft = confirmAbortDraft;
window.newDeckFlow = newDeckFlow;

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
    if (_hiddenAt && (Date.now() - _hiddenAt) > RESUME_RELOAD_MS) {
      onAppResume().catch(() => {});
    }
  }
});

// Minuten-Check: hat ein anderes Gerät die Cloud geändert? → Reload-Hinweis (ui.js).
// Begrenzt den „last-write-wins"-Worst-Case auf ~1 Min. Läuft nur im Menü/sichtbar.
setInterval(() => { checkForRemoteChange().catch(() => {}); }, 60 * 1000);

// Supabase-Verbindung testen (kann später raus)
testConnection();
window.supabase = supabase; // temporär für Debugging in DevTools