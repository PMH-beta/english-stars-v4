// src/modules/sync.js
// Cloud-Sync: Read/Write zwischen Supabase und window.SD
import { supabase } from './supabase.js';
import { persist } from './storage.js';

// ────────────────────────────────────────────────
//  UTILS
// ────────────────────────────────────────────────

function isUUID(str) {
  return typeof str === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const EMPTY_CAT = {
  vocab:       { played: 0, correct: 0, bestStreak: 0 },
  spelling:    { played: 0, correct: 0, bestStreak: 0 },
  pronounce:   { played: 0, correct: 0, bestStreak: 0 },
  mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
};

// ────────────────────────────────────────────────
//  READ — Cloud → window.SD format
// ────────────────────────────────────────────────

// Retry-Helper für JWT-Propagation-Race-Condition nach signInWithPassword()
async function fetchWithRetry(fn) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await fn();
    if (!result.error?.message?.includes('issued at future')) return result;
    console.warn(`[sync] JWT issued at future — retry ${attempt + 1}/3 in 1.5s`);
    await new Promise(r => setTimeout(r, 1500));
  }
  return await fn();
}

/**
 * Lädt kompletten User-State aus Cloud.
 * Gibt null zurück wenn User noch keine Decks hat (= neuer User).
 */
export async function cloudLoad(userId) {
  const [profileRes, decksRes, wordStatsRes, presetStatsRes, presetCatProgRes] = await Promise.all([
    fetchWithRetry(() => supabase.from('profiles').select('player_name, highscore, total_points, active_deck_id, active_mode').eq('id', userId).maybeSingle()),
    fetchWithRetry(() => supabase.from('decks').select('*').eq('user_id', userId).order('sort_order').order('created_at')),
    fetchWithRetry(() => supabase.from('word_stats').select('*').eq('user_id', userId)),
    fetchWithRetry(() => supabase.from('preset_stats').select('*').eq('user_id', userId)),
    fetchWithRetry(() => supabase.from('preset_category_progress').select('*').eq('user_id', userId)),
  ]);

  if (decksRes.error) throw new Error('[sync] cloudLoad decks: ' + decksRes.error.message);

  const profile = profileRes.data || {};
  if (profileRes.error) console.error('[cloudLoad] profile error:', profileRes.error.message);

  // Globale Vorlage-Stats aufbauen
  const globalPresetStats = { wordStats: {}, categoryProgress: {} };
  if (presetStatsRes.error) console.error('[cloudLoad] preset_stats:', presetStatsRes.error.message);
  for (const ps of (presetStatsRes.data || [])) {
    globalPresetStats.wordStats[ps.stat_key] = {
      asked:   Number(ps.asked)   || 0,
      correct: Number(ps.correct) || 0,
      wrong:   Number(ps.wrong)   || 0,
      recent:  ps.recent || '',
    };
  }
  if (presetCatProgRes.error) console.error('[cloudLoad] preset_category_progress:', presetCatProgRes.error.message);
  for (const pcp of (presetCatProgRes.data || [])) {
    globalPresetStats.categoryProgress[pcp.preset_id] = {
      played:     Number(pcp.played)      || 0,
      correct:    Number(pcp.correct)     || 0,
      bestStreak: Number(pcp.best_streak) || 0,
    };
  }

  if (!decksRes.data?.length) {
    // No decks yet. If profile has a name this is a returning user (e.g. after cloud reset).
    if (!profile.player_name) return null; // truly new user
    return {
      _version:     4,
      playerName:   profile.player_name,
      highscore:    profile.highscore    || 0,
      totalPoints:  profile.total_points || 0,
      activeMode:   profile.active_mode  || 'free',
      activeDeckId: null,
      decks:        {},
      categoryProgress: { ...EMPTY_CAT },
      wordStats:    {},
      globalPresetStats,
    };
  }

  // Decks aufbauen
  const decks = {};
  for (let i = 0; i < decksRes.data.length; i++) {
    const row = decksRes.data[i];
    decks[row.id] = {
      id:               row.id,
      name:             row.name,
      createdAt:        new Date(row.created_at).getTime(),
      vocab:            row.vocab || [],
      wordStats:        {},
      categoryProgress: row.category_progress || { ...EMPTY_CAT },
      presetCategories: row.preset_categories || [],
      presetsLocked:    row.presets_locked || false,
      deckPath:         row.deck_path || 'none',
      sortOrder:        (row.sort_order > 0) ? row.sort_order : (i + 1) * 10,
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

  const activeDeckId = profile.active_deck_id || decksRes.data[0]?.id || null;

  // Reconcile: Preset-Stats aus der Cloud herausfiltern, die zu keinem aktiven Deck gehören.
  // Sicherheitsnetz gegen Zombie-Einträge die durch fehlgeschlagene Deletes überlebt haben.
  {
    const boundStatKeys  = new Set();
    const boundPresetIds = new Set();
    for (const deck of Object.values(decks)) {
      if (deck.deckPath !== 'preset') continue;
      for (const pid of (deck.presetCategories || [])) boundPresetIds.add(pid);
      for (const v of (deck.vocab || [])) {
        if (!v._presetId) continue;
        const de = (v.de || '').trim().toLowerCase();
        const en = (v.en || '').trim().toLowerCase().replace(/^to /, '');
        for (const suf of ['_mc', '_sp', '_pr']) boundStatKeys.add(de + '|' + en + suf);
      }
    }
    const orphanStatKeys  = Object.keys(globalPresetStats.wordStats).filter(k => !boundStatKeys.has(k));
    const orphanPresetIds = Object.keys(globalPresetStats.categoryProgress).filter(id => !boundPresetIds.has(id));
    if (orphanStatKeys.length || orphanPresetIds.length) {
      console.log('[cloudLoad] Reconcile:', orphanStatKeys.length, 'orphane stat_keys,', orphanPresetIds.length, 'orphane preset_ids → Queue-Eintrag für Cloud-Löschung');
      for (const k of orphanStatKeys)  delete globalPresetStats.wordStats[k];
      for (const id of orphanPresetIds) delete globalPresetStats.categoryProgress[id];
      const pending  = readPending();
      const existing = pending.find(p => p.type === 'delete_preset_stats');
      const rest     = pending.filter(p => p.type !== 'delete_preset_stats');
      rest.push({
        type:       'delete_preset_stats',
        statKeys:   [...new Set([...(existing?.statKeys || []), ...orphanStatKeys])],
        presetIds:  [...new Set([...(existing?.presetIds || []), ...orphanPresetIds])],
        ts:         Date.now(),
      });
      writePending(rest);
    }
  }

  return {
    _version:         4,
    playerName:       profile.player_name || '',
    highscore:        profile.highscore || 0,
    totalPoints:      profile.total_points || 0,
    activeMode:       profile.active_mode || 'free',
    activeDeckId,
    decks,
    categoryProgress: { ...EMPTY_CAT },
    wordStats:        {},
    globalPresetStats,
  };
}


// ────────────────────────────────────────────────
//  WRITE
// ────────────────────────────────────────────────

export async function saveProfile(sd, userId) {
  const payload = {
    player_name:    sd.playerName || '',
    highscore:      sd.highscore || 0,
    total_points:   sd.totalPoints || 0,
    active_deck_id: isUUID(sd.activeDeckId) ? sd.activeDeckId : null,
    active_mode:    sd.activeMode || 'free',
    updated_at:     new Date().toISOString(),
  };
  const { data, error } = await fetchWithRetry(() => supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select());
  if (error) throw new Error('[sync] saveProfile: ' + error.message);
  if (!data?.length) console.warn('[sync] saveProfile: 0 rows updated — Auth oder RLS?');
}

/**
 * Speichert ein Deck in der Cloud.
 * - UUID-ID → UPDATE
 * - String-ID (lokal erzeugt) → INSERT → ersetzt lokale ID durch Cloud-UUID in window.SD
 */
export async function saveDeck(deck, userId) {
  const now = new Date().toISOString();
  const row = {
    user_id:            userId,
    name:               deck.name,
    vocab:              deck.vocab,
    category_progress:  deck.categoryProgress,
    preset_categories:  deck.presetCategories || [],
    presets_locked:     deck.presetsLocked || false,
    deck_path:          deck.deckPath || 'none',
    sort_order:         deck.sortOrder || 0,
    last_exam:          deck.lastExam || null,
    updated_at:         now,
  };
  console.log('[sync] saveDeck →', deck.id, '| vocab:', deck.vocab?.length ?? '?', 'words | row:', row);

  if (isUUID(deck.id)) {
    const { error } = await fetchWithRetry(() => supabase
      .from('decks').update(row).eq('id', deck.id).eq('user_id', userId));
    if (error) throw new Error('[sync] saveDeck update: ' + error.message);
    console.log('[sync] saveDeck update OK:', deck.id);
    return;
  }

  // Neues Deck: INSERT → Cloud gibt UUID zurück → lokal ersetzen
  const { data, error } = await fetchWithRetry(() => supabase
    .from('decks').insert({ ...row, created_at: now }).select('id').single());
  if (error) throw new Error('[sync] saveDeck insert: ' + error.message);

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

export async function deleteCloudWordStats(deckId, userId) {
  if (!isUUID(deckId)) return;
  const { error } = await supabase
    .from('word_stats').delete().eq('deck_id', deckId).eq('user_id', userId);
  if (error) console.error('[sync] deleteCloudWordStats:', error.message);
  else console.log('[sync] deleteCloudWordStats OK:', deckId);
}

export async function deleteCloudPresetStats(statKeys, presetIds, userId) {
  if (statKeys.length) {
    const { data, error } = await supabase
      .from('preset_stats').delete().eq('user_id', userId).in('stat_key', statKeys).select();
    if (error) throw new Error('[sync] deleteCloudPresetStats: ' + error.message);
    console.log('[sync] deleteCloudPresetStats OK:', data?.length ?? 0, 'von', statKeys.length, 'Keys gelöscht');
  }
  if (presetIds.length) {
    const { data, error } = await supabase
      .from('preset_category_progress').delete().eq('user_id', userId).in('preset_id', presetIds).select();
    if (error) throw new Error('[sync] deleteCloudPresetCatProgress: ' + error.message);
    console.log('[sync] deleteCloudPresetCatProgress OK:', data?.length ?? 0, 'von', presetIds.length, 'IDs gelöscht');
  }
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
  const { error } = await fetchWithRetry(() => supabase
    .from('word_stats')
    .upsert(rows, { onConflict: 'user_id,deck_id,stat_key' }));
  if (error) throw new Error('[sync] saveWordStats: ' + error.message);
}

/**
 * Batch-Upsert der globalen Vorlage-Stats (preset_stats + preset_category_progress).
 * Analog zu saveWordStats — schreibt SD.globalPresetStats in die Cloud.
 */
export async function saveGlobalPresetStats(stats, userId) {
  if (!stats) return;
  const now = new Date().toISOString();
  const wordRows = Object.entries(stats.wordStats || {}).map(([statKey, s]) => ({
    user_id:    userId,
    stat_key:   statKey,
    asked:      s.asked   || 0,
    correct:    s.correct || 0,
    wrong:      s.wrong   || 0,
    recent:     s.recent  || '',
    updated_at: now,
  }));
  if (wordRows.length) {
    const { error } = await fetchWithRetry(() => supabase
      .from('preset_stats')
      .upsert(wordRows, { onConflict: 'user_id,stat_key' }));
    if (error) throw new Error('[sync] saveGlobalPresetStats words: ' + error.message);
  }
  const catRows = Object.entries(stats.categoryProgress || {}).map(([presetId, cp]) => ({
    user_id:     userId,
    preset_id:   presetId,
    played:      cp.played     || 0,
    correct:     cp.correct    || 0,
    best_streak: cp.bestStreak || 0,
    updated_at:  now,
  }));
  if (catRows.length) {
    const { error } = await fetchWithRetry(() => supabase
      .from('preset_category_progress')
      .upsert(catRows, { onConflict: 'user_id,preset_id' }));
    if (error) throw new Error('[sync] saveGlobalPresetStats cats: ' + error.message);
  }
}

/** Speichert eine Prüfung in der exams-Tabelle. */
export async function saveExam({ deckId, grade, percent }, userId) {
  if (!isUUID(deckId)) return;
  const { error } = await fetchWithRetry(() => supabase.from('exams').insert({
    user_id: userId,
    deck_id: deckId,
    grade:   Math.round(grade),
    percent: Math.round(percent),
  }));
  if (error) throw new Error('[sync] saveExam: ' + error.message);
}

/** Lädt nur das Profil eines Users aus der Cloud (playerName, Scores, activeDeckId). */
export async function loadProfile(userId) {
  const { data, error } = await fetchWithRetry(() => supabase
    .from('profiles')
    .select('player_name, highscore, total_points, active_deck_id, active_mode')
    .eq('id', userId)
    .maybeSingle()
  );
  if (error) console.error('[sync] loadProfile:', error.message);
  return data || null;
}

/** Löscht alle Cloud-Daten eines Users (Decks, word_stats und exams via CASCADE). */
export async function cloudReset(userId) {
  const { error: decksErr } = await supabase
    .from('decks').delete().eq('user_id', userId);
  if (decksErr) throw new Error('[sync] cloudReset decks: ' + decksErr.message);

  const { error: psErr } = await supabase
    .from('preset_stats').delete().eq('user_id', userId);
  if (psErr) console.error('[sync] cloudReset preset_stats:', psErr.message);
  const { error: pcpErr } = await supabase
    .from('preset_category_progress').delete().eq('user_id', userId);
  if (pcpErr) console.error('[sync] cloudReset preset_category_progress:', pcpErr.message);

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ highscore: 0, total_points: 0, active_deck_id: null, active_mode: 'free', updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (profErr) throw new Error('[sync] cloudReset profile: ' + profErr.message);
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

const MAX_DELETE_ATTEMPTS = 3;

/** Stellt sicher dass Preset-Stats beim nächsten Flush aus der Cloud gelöscht werden.
 *  Wird nach fehlgeschlagenem deleteCloudPresetStats als Retry-Eintrag gesetzt.
 *  Gibt auf nach MAX_DELETE_ATTEMPTS Versuchen (verhindert Endlos-Retry bei Strukturmismatch). */
export function markDeletePresetStats(statKeys, presetIds) {
  const pending = readPending();
  const existing = pending.find(p => p.type === 'delete_preset_stats');
  const rest = pending.filter(p => p.type !== 'delete_preset_stats');
  const attempts = (existing?.attempts ?? 0) + 1;
  if (attempts > MAX_DELETE_ATTEMPTS) {
    console.error('[sync] markDeletePresetStats: aufgegeben nach', MAX_DELETE_ATTEMPTS, 'Versuchen.',
      'Nicht gelöschte Keys:', statKeys, '| Preset-IDs:', presetIds);
    writePending(rest); // Eintrag nicht wieder einreihen
    return;
  }
  const mergedKeys = [...new Set([...(existing?.statKeys || []), ...statKeys])];
  const mergedIds  = [...new Set([...(existing?.presetIds || []), ...presetIds])];
  rest.push({ type: 'delete_preset_stats', statKeys: mergedKeys, presetIds: mergedIds, attempts, ts: Date.now() });
  writePending(rest);
}

/** Entfernt alle Queue-Einträge eines bestimmten Typs. */
export function removePending(type) {
  writePending(readPending().filter(p => p.type !== type));
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
      } else if (item.type === 'global_preset') {
        await saveGlobalPresetStats(sd.globalPresetStats, userId);
      } else if (item.type === 'delete_preset_stats') {
        await deleteCloudPresetStats(item.statKeys || [], item.presetIds || [], userId);
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
