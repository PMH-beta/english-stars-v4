// src/modules/sync.js
// Cloud-Sync: Read/Write zwischen Supabase und window.SD
import { supabase } from './supabase.js';
import { DEFAULT_DECKS } from './default-decks.js';
import { persist } from './storage.js';

// ────────────────────────────────────────────────
//  UTILS
// ────────────────────────────────────────────────

function isUUID(str) {
  return typeof str === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

let _provisioning = false;

const EMPTY_CAT = {
  vocab:       { played: 0, correct: 0, bestStreak: 0 },
  spelling:    { played: 0, correct: 0, bestStreak: 0 },
  pronounce:   { played: 0, correct: 0, bestStreak: 0 },
  mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
};

// ────────────────────────────────────────────────
//  READ — Cloud → window.SD format
// ────────────────────────────────────────────────

/**
 * Lädt kompletten User-State aus Cloud.
 * Gibt null zurück wenn User noch keine Decks hat (= neuer User).
 */
export async function cloudLoad(userId) {
  const [profileRes, decksRes, wordStatsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('decks').select('*').eq('user_id', userId),
    supabase.from('word_stats').select('*').eq('user_id', userId),
  ]);

  if (decksRes.error) throw new Error('[sync] cloudLoad decks: ' + decksRes.error.message);
  if (!decksRes.data?.length) return null; // neuer User, noch keine Decks

  // Decks aufbauen
  const decks = {};
  for (const row of decksRes.data) {
    decks[row.id] = {
      id:               row.id,
      name:             row.name,
      createdAt:        new Date(row.created_at).getTime(),
      vocab:            row.vocab || [],
      wordStats:        {},
      categoryProgress: row.category_progress || { ...EMPTY_CAT },
      lastExam:         row.last_exam || null,
    };
  }

  // word_stats in die Decks einfügen
  for (const ws of (wordStatsRes.data || [])) {
    if (!decks[ws.deck_id]) continue;
    decks[ws.deck_id].wordStats[ws.stat_key] = {
      asked:   Number(ws.asked)   || 0,
      correct: Number(ws.correct) || 0,
      wrong:   Number(ws.wrong)   || 0,
      recent:  ws.recent || '',
    };
  }

  const profile = profileRes.data || {};
  if (profileRes.error) console.error('[cloudLoad] profile error:', profileRes.error.message);
  const activeDeckId = profile.active_deck_id || decksRes.data[0]?.id || null;

  return {
    _version:         4,
    playerName:       profile.player_name || '',
    highscore:        profile.highscore || 0,
    totalPoints:      profile.total_points || 0,
    activeDeckId,
    decks,
    categoryProgress: { ...EMPTY_CAT },
    wordStats:        {},
  };
}

// ────────────────────────────────────────────────
//  PROVISIONING — Default-Decks für neue User
// ────────────────────────────────────────────────

/**
 * Prüft ob User Decks hat. Falls nein: Default-Decks aus default-decks.js einfügen.
 * Idempotent: zweiter Aufruf macht nichts (Decks-Check am Anfang).
 */
export async function provisionDefaultDecks(userId) {
  if (_provisioning) return;
  _provisioning = true;
  try {
    const { data: existing } = await supabase
      .from('decks').select('id').eq('user_id', userId).limit(1);
    if (existing?.length) return; // schon provisioniert

    const now = new Date().toISOString();
    const rows = DEFAULT_DECKS.map(def => ({
      user_id:           userId,
      name:              def.name,
      vocab:             def.vocab,
      category_progress: { ...EMPTY_CAT },
      last_exam:         null,
      created_at:        now,
      updated_at:        now,
    }));

    const { data: inserted, error } = await supabase
      .from('decks').insert(rows).select('id');
    if (error) throw new Error('[sync] provisionDefaultDecks: ' + error.message);

    // Erstes Deck als aktiv setzen
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ active_deck_id: inserted[0].id, updated_at: now })
      .eq('id', userId);
    if (profErr) throw new Error('[sync] provision profile: ' + profErr.message);
  } finally {
    _provisioning = false;
  }
}

// ────────────────────────────────────────────────
//  WRITE
// ────────────────────────────────────────────────

export async function saveProfile(sd, userId) {
  const { error } = await supabase
    .from('profiles')
    .update({
      player_name:    sd.playerName || '',
      highscore:      sd.highscore || 0,
      total_points:   sd.totalPoints || 0,
      active_deck_id: isUUID(sd.activeDeckId) ? sd.activeDeckId : null,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) console.error('[sync] saveProfile:', error.message);
}

/**
 * Speichert ein Deck in der Cloud.
 * - UUID-ID → UPDATE
 * - String-ID (lokal erzeugt) → INSERT → ersetzt lokale ID durch Cloud-UUID in window.SD
 */
export async function saveDeck(deck, userId) {
  const now = new Date().toISOString();
  const row = {
    user_id:           userId,
    name:              deck.name,
    vocab:             deck.vocab,
    category_progress: deck.categoryProgress,
    last_exam:         deck.lastExam || null,
    updated_at:        now,
  };

  if (isUUID(deck.id)) {
    const { error } = await supabase
      .from('decks').update(row).eq('id', deck.id).eq('user_id', userId);
    if (error) console.error('[sync] saveDeck update:', error.message);
    return;
  }

  // Neues Deck: INSERT → Cloud gibt UUID zurück → lokal ersetzen
  const { data, error } = await supabase
    .from('decks').insert({ ...row, created_at: now }).select('id').single();
  if (error) { console.error('[sync] saveDeck insert:', error.message); return; }

  const newId = data.id;
  if (window.SD?.decks[deck.id]) {
    window.SD.decks[newId] = { ...window.SD.decks[deck.id], id: newId };
    delete window.SD.decks[deck.id];
    if (window.SD.activeDeckId === deck.id) window.SD.activeDeckId = newId;
    persist(window.SD);
    // Profile mit neuer active_deck_id aktualisieren
    if (window.SD.activeDeckId === newId) {
      saveProfile(window.SD, userId).catch(() => {});
    }
  }
}

export async function deleteCloudDeck(deckId, userId) {
  if (!isUUID(deckId)) return;
  const { error } = await supabase
    .from('decks').delete().eq('id', deckId).eq('user_id', userId);
  if (error) console.error('[sync] deleteCloudDeck:', error.message);
}

/**
 * Batch-Upsert aller word_stats eines Decks.
 * Überspringt automatisch wenn deckId keine UUID ist.
 */
export async function saveWordStats(deckCloudId, stats, userId) {
  if (!isUUID(deckCloudId)) return;
  const now = new Date().toISOString();
  const rows = Object.entries(stats).map(([statKey, s]) => ({
    user_id:  userId,
    deck_id:  deckCloudId,
    stat_key: statKey,
    asked:    s.asked   || 0,
    correct:  s.correct || 0,
    wrong:    s.wrong   || 0,
    recent:   s.recent  || '',
    updated_at: now,
  }));
  if (!rows.length) return;
  const { error } = await supabase
    .from('word_stats')
    .upsert(rows, { onConflict: 'user_id,deck_id,stat_key' });
  if (error) console.error('[sync] saveWordStats:', error.message);
}

/** Speichert eine Prüfung in der exams-Tabelle. */
export async function saveExam({ deckId, grade, percent }, userId) {
  if (!isUUID(deckId)) return;
  const { error } = await supabase.from('exams').insert({
    user_id: userId,
    deck_id: deckId,
    grade:   Math.round(grade),
    percent: Math.round(percent),
  });
  if (error) console.error('[sync] saveExam:', error.message);
}

// ────────────────────────────────────────────────
//  OFFLINE QUEUE
// ────────────────────────────────────────────────

const PENDING_SK = 'pending_sync';

function readPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_SK) || '[]'); } catch { return []; }
}

function writePending(items) {
  try { localStorage.setItem(PENDING_SK, JSON.stringify(items)); } catch(e) {}
}

/** Markiert einen Datensatz als "muss synchronisiert werden". */
export function markDirty(type, deckId = null) {
  if (!window.currentUser) return;
  const pending = readPending();
  // Deduplizieren: gleicher type+deckId nur einmal in der Queue
  const filtered = pending.filter(p => !(p.type === type && p.deckId === deckId));
  filtered.push({ type, deckId, ts: Date.now() });
  writePending(filtered);
}

/** Schreibt alle pending Änderungen in die Cloud. Fehlgeschlagene bleiben in der Queue. */
export async function flushPendingSync() {
  if (!window.currentUser) return;
  const pending = readPending();
  if (!pending.length) return;

  const userId = window.currentUser.id;
  const sd = window.SD;
  const failed = [];

  for (const item of pending) {
    try {
      if (item.type === 'profile') {
        await saveProfile(sd, userId);
      } else if (item.type === 'deck' && item.deckId) {
        const deck = sd.decks[item.deckId];
        if (deck) await saveDeck(deck, userId);
        // deck nicht gefunden: wurde durch UUID-Rename bereits gespeichert → skip
      } else if (item.type === 'word_stats' && item.deckId) {
        const deck = sd.decks[item.deckId];
        if (deck) await saveWordStats(deck.id, deck.wordStats, userId);
      }
      // 'exam': wird direkt in saveExam() gespeichert, nicht via Queue
    } catch(e) {
      console.error('[sync] flush failed:', item.type, e.message);
      failed.push(item);
    }
  }

  writePending(failed);
}

/** Anzahl ausstehender Sync-Operationen (für UI-Anzeige). */
export function getPendingCount() {
  return readPending().length;
}
