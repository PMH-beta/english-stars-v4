// src/main.js
// Einstiegspunkt - lädt die Legacy-App und ergänzt sie schrittweise mit Modulen
import { APP_VERSION } from './modules/config.js';
import { persist, loadData, freshData, cleanupStorage, clearSWCache } from './modules/storage.js';
import { _initTTS, speakWord, speakWordOnce, ensureMicStream, releaseMicStream, startVisualizer, stopVisualizer, voskStart, voskStop, _shouldUseVosk, startRecording, startVoskRecognition } from './modules/speech.js';
import { _trackUrl, _discoverTracks, _playNext, _initAudio, startMusic, startMusicSync, stopMusic, setMusicVolume, _setMusicBtns, toggleMusic, toggleVolPopup } from './modules/audio.js';
import { effectivePct, isMastered } from './modules/stats.js';
import { buildPool, toggleSchnell, startGame, confirmHome, nextQuestion, restartSame, checkMC, submitType, showSelfRateButtons, retryPronounce, evaluateWithClaude, setMicFinalStatus, _sfx, playSfx } from './modules/game.js';
import { syncMirrorFromActiveDeck, activeDeck, switchDeck, createDeck, deleteDeck, renameDeck, deckProgress, renderDecks, toggleDeck, activateDeck, startGameWithDeck, newDeckPrompt, renameDeckPrompt, confirmDeleteDeck, vmDeleteWord, vmAddManual } from './modules/decks.js';
import { showScreen, saveName, showMenu, saveApiKey, skipApiKey, showProfile, editPlayerName, showStats, confirmReset, showFeedback, hideFeedback } from './modules/ui.js';

console.log('[main] English Stars', APP_VERSION, 'startet…');

// Vor Legacy-App: Storage aufräumen (Service Worker Cache + temporäre LocalStorage Keys)
async function preBoot() {
  await clearSWCache();
  cleanupStorage();
  console.log('[main] Pre-Boot abgeschlossen');
}

// Boot starten
preBoot().then(() => {
  console.log('[main] Legacy-App startet');
  // Die alte index.html-Logik wird parallel als <script> geladen.
  // In den folgenden Refactor-Iterationen ziehen wir mehr Funktionalität nach src/modules/
});

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
// window.freshData: liest window.DEFAULT_VOCAB als Standard-Vokabular
window.freshData = () => freshData(window.DEFAULT_VOCAB || []);

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
window.startGame = startGame;
window.confirmHome = confirmHome;
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
window.confirmDeleteDeck = confirmDeleteDeck;
window.vmDeleteWord = vmDeleteWord;
window.vmAddManual = vmAddManual;

// UI via window für Legacy-Code
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
