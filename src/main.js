// src/main.js
// Einstiegspunkt - lädt die Legacy-App und ergänzt sie schrittweise mit Modulen
import { APP_VERSION } from './modules/config.js';
import { persist, loadData, freshData, cleanupStorage, clearSWCache } from './modules/storage.js';
import { _initTTS, speakWord, speakWordOnce, ensureMicStream, releaseMicStream, startVisualizer, stopVisualizer, voskStart, voskStop, _shouldUseVosk, startRecording, startVoskRecognition } from './modules/speech.js';
import { _trackUrl, _discoverTracks, _playNext, _initAudio, startMusic, startMusicSync, stopMusic, setMusicVolume, _setMusicBtns, toggleMusic, toggleVolPopup } from './modules/audio.js';
import { effectivePct, isMastered, buildPool } from './modules/stats.js';

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
