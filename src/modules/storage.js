// src/modules/storage.js
// Alle LocalStorage-Operationen zentral. Später wird hier auch das Backend (Supabase) eingebunden.

const SK = 'english_stars_v3';
const SK_OLD = 'english_stars_v2';

/**
 * Speichert State-Object in localStorage
 * @param {object} state
 */
export function persist(state) {
  try {
    localStorage.setItem(SK, JSON.stringify(state));
  } catch (e) {
    console.error('[storage] persist failed:', e);
  }
}

/**
 * Lädt State aus localStorage (mit Migration aus altem v2-Format)
 * @returns {object|null}
 */
export function load() {
  try {
    // Erst v3 versuchen
    const raw = localStorage.getItem(SK);
    if (raw) return JSON.parse(raw);

    // Fallback: alter v2 Stand zur Migration
    const oldRaw = localStorage.getItem(SK_OLD);
    if (oldRaw) {
      console.log('[storage] Migriere von v2 zu v3');
      return JSON.parse(oldRaw);
    }
  } catch (e) {
    console.error('[storage] load failed:', e);
  }
  return null;
}

/**
 * Räumt alle nicht-User-relevanten LocalStorage-Keys auf
 * (für sauberen App-Start)
 */
export function cleanupStorage() {
  const KEEP_KEYS = [SK, SK_OLD, 'es_apikey', 'es_vosk_loaded'];
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !KEEP_KEYS.includes(k)) toRemove.push(k);
    }
    toRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  } catch (e) {
    console.error('[storage] cleanup failed:', e);
  }
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
