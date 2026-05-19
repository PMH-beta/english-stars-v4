// src/modules/storage.js
// Alle LocalStorage-Operationen zentral. Später wird hier auch das Backend (Supabase) eingebunden.

import { DEFAULT_DECKS } from './default-decks.js';

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
 * Erzeugt einen frischen, leeren App-State.
 * @param {Array} defaultVocab - Vokabeln für das Standard-Deck (Default: leer)
 * @returns {object}
 */
export function freshData() {
  const decks = {};
  DEFAULT_DECKS.forEach(def => {
    decks[def.id] = {
      id: def.id,
      name: def.name,
      createdAt: Date.now(),
      vocab: def.vocab.slice(),
      wordStats: {},
      categoryProgress: {
        vocab:       { played: 0, correct: 0, bestStreak: 0 },
        spelling:    { played: 0, correct: 0, bestStreak: 0 },
        pronounce:   { played: 0, correct: 0, bestStreak: 0 },
        mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
      },
      lastExam: null,
    };
  });
  return {
    _version: 4,
    playerName: '', highscore: 0, totalPoints: 0,
    activeDeckId: DEFAULT_DECKS[0].id,
    decks,
    categoryProgress: {
      vocab:       { played: 0, correct: 0, bestStreak: 0 },
      spelling:    { played: 0, correct: 0, bestStreak: 0 },
      pronounce:   { played: 0, correct: 0, bestStreak: 0 },
      mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
    },
    wordStats: {},
  };
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

/** Löscht User-Daten aus LocalStorage beim Logout. */
export function clearStorage() {
  try { localStorage.removeItem(SK); } catch(e) {}
  try { localStorage.removeItem(SK_OLD); } catch(e) {}
  try { localStorage.removeItem('pending_sync'); } catch(e) {}
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
