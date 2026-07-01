// src/modules/config.js
// Zentrale Konstanten und Konfiguration

export const APP_VERSION = 'v4.0.248';

export const QPERROUND = 20;
export const EXAM_QUESTIONS = 30;
export const MAX_PRESET_CATEGORIES = 2;

export function calcGrade(pct) {
  if (pct >= 0.92) return 1;
  if (pct >= 0.81) return 2;
  if (pct >= 0.67) return 3;
  if (pct >= 0.50) return 4;
  if (pct >= 0.30) return 5;
  return 6;
}

export function gradeText(grade) {
  return ['','Sehr gut! 🌟','Gut! 👍','Befriedigend','Ausreichend','Mangelhaft','Ungenügend'][grade] || '';
}

export const EMA_ALPHA = 0.45; // Faktor für gewichteten Durchschnitt der letzten Antworten
export const MASTERY_THRESHOLD = 0.9; // 90% korrekt = gemeistert
export const MASTERY_MIN_ATTEMPTS = 3; // mindestens 3 Versuche bevor Wort als gemeistert gilt

// Gestaltwandler (UV): Methoden-Stufen werden aus dem EMA abgeleitet (kein
// gespeicherter Zustand → kein Sync-Umbau). up2/up3 = Schwellen leicht→mittel
// →schwer (up3 = bestehende Mastery-Schwelle). interleave = Wahrscheinlichkeit,
// gelegentlich eine leichtere Variante einzustreuen (nie „alles schwer").
export const UV_LVL = { up2: 0.80, up3: 0.90, interleave: 0.2 };

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

// Entscheidet welche Spracherkennung verwendet wird (Spiegel von speech.js _shouldUseVosk)
// Alle Mobilgeräte inkl. iOS → Vosk (offline, Huawei-tauglich)
// Desktop → Web Speech API
export function shouldUseVosk() {
  const ua = navigator.userAgent || '';
  const isIosDevice = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(ua);
  if (isIosDevice) return true;
  if (!isMobileDevice) return false;
  return true;
}
