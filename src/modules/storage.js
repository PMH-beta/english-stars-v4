// src/modules/storage.js
// Alle LocalStorage-Operationen zentral. Später wird hier auch das Backend (Supabase) eingebunden.

const SK = 'english_stars_v3';
const SK_OLD = 'english_stars_v2';
// H7/B-13: wem der lokale Stand gehört (Nutzer-Id). Nur auf dem Gerät, nie in der Cloud.
const OWNER_SK = 'es_stand_uid';

/**
 * Speichert State-Object in localStorage und sessionStorage
 * @param {object} state
 */
export function persist(state = window.SD) {
  // App-Tour: der Demo-Stand wird nie gespeichert (renderMenuDemo in ui.js).
  if (window._tourDemoAktiv || state?._tourDemo) return;
  if (state?._freundAnsicht) return;   // Fortschritt eines Freundes: nie als eigenen Stand speichern (K1)
  const json = JSON.stringify(state);
  if (json === undefined) return;   // D-1: nie den Text „undefined“ ablegen
  try { localStorage.setItem(SK, json); } catch (e) {
    console.error('[storage] persist localStorage failed:', e);
  }
  try { sessionStorage.setItem(SK, json); } catch (e) {}
}

/**
 * Lädt rohe State-Daten aus localStorage/sessionStorage.
 * Gibt geparsten Object zurück oder null — ohne App-Logik (Migration etc.).
 * @returns {object|null}
 */
export function loadData() {
  try {
    const raw = localStorage.getItem(SK)
      || localStorage.getItem(SK_OLD)
      || sessionStorage.getItem(SK);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[storage] loadData failed:', e);
  }
  return null;
}

/** @deprecated Verwende loadData() */
export function load() {
  return loadData();
}

/**
 * Erzeugt einen frischen, leeren App-State.
 * @param {Array} defaultVocab - Vokabeln für das Standard-Deck (Default: leer)
 * @returns {object}
 */
export function freshData() {
  // Neue Konten starten OHNE Decks → der Vokabeln-Tab zeigt den Auswahl-
  // Leerzustand (Vorlage auswählen / eigene Sammlung anlegen).
  return {
    _version: 4,
    playerName: '', highscore: 0, totalPoints: 0,
    avatar: { skin: 0, build: 4, hair: 0, eyes: 0, nose: 0, mouth: 0, ears: 2 },
    activeMode: 'free',
    presetIntroSeen: false,
    activeDeckId: null,
    decks: {},
    categoryProgress: {
      vocab:       { played: 0, correct: 0, bestStreak: 0 },
      spelling:    { played: 0, correct: 0, bestStreak: 0 },
      pronounce:   { played: 0, correct: 0, bestStreak: 0 },
      mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
    },
    wordStats: {},
    globalPresetStats: { wordStats: {}, categoryProgress: {} },
    probetests: [],
    campaign: { claimed: [], talerSpent: 0, run: null },
  };
}

/**
 * Räumt alle nicht-User-relevanten LocalStorage-Keys auf
 * (für sauberen App-Start)
 */
export function cleanupStorage() {
  const KEEP_KEYS = [SK, SK_OLD, 'es_vosk_loaded'];
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // sb-* Keys: Supabase Auth-Token — niemals löschen
      if (k && !KEEP_KEYS.includes(k) && !k.startsWith('sb-')) toRemove.push(k);
    }
    toRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  } catch (e) {
    console.error('[storage] cleanup failed:', e);
  }
}

/** Löscht User-Daten aus LocalStorage beim Logout. */
export function clearStorage() {
  try { localStorage.removeItem(SK); } catch(e) {}
  try { localStorage.removeItem(SK_OLD); } catch(e) {}
  try { localStorage.removeItem('pending_sync'); } catch(e) {}
  try { localStorage.removeItem('es_sync_meta'); } catch(e) {}   // Legacy-Key
  try { localStorage.removeItem('es_sync_meta2'); } catch(e) {}
  try { localStorage.removeItem('es_schnell_backup'); } catch(e) {}
  try { localStorage.removeItem(OWNER_SK); } catch(e) {}
  try { sessionStorage.removeItem(SK); } catch(e) {}   // B-13: auch die Kopie im Tab
}

/**
 * H7/B-13: Beim Anmelden prüfen, ob der lokale Stand (samt Merkliste und
 * Schnellmodus-Sicherung) zu diesem Konto gehört. Gehört er einem anderen, wird
 * er gelöscht, bevor ihn irgendetwas anzeigt oder hochlädt. Danach gilt das
 * angemeldete Konto als Besitzer. Ein Stand ohne Besitzer (Gerät vor diesem
 * Update) zählt als eigener, damit beim Update nichts verloren geht.
 * @param {string} uid
 * @returns {boolean} true, wenn ein fremder Stand verworfen wurde
 */
export function standFuerKonto(uid) {
  if (!uid) return false;
  let fremd = false;
  try {
    const besitzer = localStorage.getItem(OWNER_SK);
    fremd = !!besitzer && besitzer !== uid;
    if (fremd) clearStorage();
    localStorage.setItem(OWNER_SK, uid);
  } catch (e) {}
  return fremd;
}

/**
 * Löscht den Service Worker Cache (alle App-Files werden frisch geladen)
 */
export async function clearSWCache() {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch (e) {
    console.warn('[storage] SW cache clear failed:', e);
  }
}
