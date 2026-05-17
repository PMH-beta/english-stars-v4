// src/modules/storage.js
// Alle LocalStorage-Operationen zentral. Später wird hier auch das Backend (Supabase) eingebunden.

const SK = 'english_stars_v3';
const SK_OLD = 'english_stars_v2';

/**
 * Speichert State-Object in localStorage und sessionStorage
 * @param {object} state
 */
export function persist(state) {
  const json = JSON.stringify(state);
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
