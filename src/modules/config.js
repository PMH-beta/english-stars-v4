// src/modules/config.js
// Zentrale Konstanten und Konfiguration

export const APP_VERSION = 'v4.0';

export const QPERROUND = 20;

export const EMA_ALPHA = 0.45; // Faktor für gewichteten Durchschnitt der letzten Antworten
export const MASTERY_THRESHOLD = 0.9; // 90% korrekt = gemeistert
export const MASTERY_MIN_ATTEMPTS = 3; // mindestens 3 Versuche bevor Wort als gemeistert gilt

// Erkennt ob das aktuelle Gerät ein Mobile-Touch-Gerät ist
export function isMobile() {
  return matchMedia('(pointer:coarse)').matches || innerWidth < 600;
}

// Erkennt ob iOS (iPhone/iPad)
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Erkennt ob die App standalone (als PWA installiert) läuft
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

// Entscheidet welche Spracherkennung verwendet wird
// iOS/Desktop → Web Speech API
// Android/Rest → Vosk (offline, Huawei-tauglich)
export function shouldUseVosk() {
  const ua = navigator.userAgent || '';
  const isIosDevice = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(ua);
  if (isIosDevice) return false;
  if (!isMobileDevice) return false;
  return isAndroid || true;
}
