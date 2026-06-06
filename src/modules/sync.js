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
//  SCHREIB-GATE (Empty-Write-Schutz — EINE Stelle)
// ────────────────────────────────────────────────
// Cloud-Writes sind gesperrt, bis ein App-Öffnen den Cloud-Stand bestätigt hat.
// Verhindert, dass ein leeres/unbestätigtes window.SD echte Cloud-Daten mit
// Leerwerten überschreibt. Gesetzt NUR von adoptCloudState (true) und
// handleLogout (false) — sonst nirgends getoggelt.
let _cloudConfirmed = false;
export function setCloudConfirmed(v) { _cloudConfirmed = !!v; }
export function cloudConfirmed() { return _cloudConfirmed; }

// Token-Resilienz: Vor REST-Calls sicherstellen, dass der Access-Token gültig ist.
// getSession() liest nur den Cache (validiert NICHT serverseitig) → war das Gerät
// länger im Hintergrund, ist der Token evtl. abgelaufen und autoRefresh (Timer)
// hat beim Aufwachen noch nicht erneuert → REST würde 401 liefern. Daher hier
// proaktiv erneuern, wenn abgelaufen oder <60s Restlaufzeit.
async function ensureFreshToken() {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), 3000, 'getSession');
    const exp = data?.session?.expires_at;          // Sekunden seit Epoch
    if (exp && exp * 1000 < Date.now() + 60000) {
      console.log('[sync] Token läuft ab/abgelaufen → refreshSession()');
      // HART begrenzt: refreshSession ist ein Netz-Call und darf den Start NICHT
      // minutenlang blockieren. Timeout → wir machen weiter; bei 401 greift der
      // saubere failed-Pfad statt eines Hängers.
      await withTimeout(supabase.auth.refreshSession(), 5000, 'refreshSession');
    }
  } catch (e) {
    console.warn('[sync] ensureFreshToken:', e?.message);
  }
}

// Promise mit hartem Timeout — rejected, wenn fn nicht rechtzeitig auflöst.
function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error('[sync] timeout: ' + label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// Spätesten updated_at-Wert (ISO-String aus der DB) einer Zeilenmenge zurückgeben.
function _maxTs(rows) {
  let m = null;
  for (const r of rows || []) {
    const t = r && r.updated_at;
    if (t && (!m || t > m)) m = t;   // gleiches DB-Format (UTC) → lexikografisch ok
  }
  return m;
}

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

const LOAD_TIMEOUT_MS = 5000;   // pro Versuch
const LOAD_RETRIES    = 2;      // Versuche bevor 'failed'

/**
 * Lädt kompletten User-State aus der Cloud — mit Timeout + Retry.
 * Diskriminiertes Ergebnis (statt throw/null), damit "neuer Nutzer" sauber von
 * "Load fehlgeschlagen" getrennt ist:
 *   { status:'ok', state, meta } | { status:'new', meta } | { status:'failed', error }
 */
export async function cloudLoad(userId) {
  await ensureFreshToken();   // gültigen JWT sicherstellen → kein 401 durch abgelaufenen Token
  let lastErr = null;
  for (let attempt = 1; attempt <= LOAD_RETRIES; attempt++) {
    try {
      return await withTimeout(_cloudLoadOnce(userId), LOAD_TIMEOUT_MS, 'cloudLoad');
    } catch (e) {
      lastErr = e;
      console.warn(`[sync] cloudLoad Versuch ${attempt}/${LOAD_RETRIES} fehlgeschlagen:`, e?.message);
      if (attempt < LOAD_RETRIES) await new Promise(r => setTimeout(r, 600 * attempt));
    }
  }
  console.error('[sync] cloudLoad endgültig fehlgeschlagen:', lastErr?.message);
  return { status: 'failed', error: lastErr?.message || 'unknown' };
}

async function _cloudLoadOnce(userId) {
  const [profileRes, decksRes, wordStatsRes, presetStatsRes, presetCatProgRes] = await Promise.all([
    fetchWithRetry(() => supabase.from('profiles').select('player_name, highscore, total_points, active_deck_id, active_mode, updated_at').eq('id', userId).maybeSingle()),
    fetchWithRetry(() => supabase.from('decks').select('*').eq('user_id', userId).order('sort_order').order('created_at')),
    fetchWithRetry(() => supabase.from('word_stats').select('*').eq('user_id', userId)),
    fetchWithRetry(() => supabase.from('preset_stats').select('*').eq('user_id', userId)),
    fetchWithRetry(() => supabase.from('preset_category_progress').select('*').eq('user_id', userId)),
  ]);

  // profile + decks sind Kern-Daten → Fehler hier ist FATAL (→ Retry/failed),
  // damit ein Netz-/Auth-Fehler NICHT als leeres Profil durchrutscht.
  if (decksRes.error)   throw new Error('[sync] cloudLoad decks: '   + decksRes.error.message);
  if (profileRes.error) throw new Error('[sync] cloudLoad profile: ' + profileRes.error.message);

  const profile = profileRes.data || {};

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

  // Sync-Signatur (Wahrheits-Token) aus den geladenen Zeilen.
  const meta = {
    profile:    { ts: profile.updated_at || null, count: profileRes.data ? 1 : 0 },
    decks:      { ts: _maxTs(decksRes.data),      count: decksRes.data?.length || 0 },
    word_stats: { ts: _maxTs(wordStatsRes.data),  count: wordStatsRes.data?.length || 0 },
    preset:     {
      ts:    _maxTs([...(presetStatsRes.data || []), ...(presetCatProgRes.data || [])]),
      count: (presetStatsRes.data?.length || 0) + (presetCatProgRes.data?.length || 0),
    },
  };

  if (!decksRes.data?.length) {
    // No decks yet. If profile has a name this is a returning user (e.g. after cloud reset).
    if (!profile.player_name) return { status: 'new', meta }; // truly new user (Cloud bestätigt leer)
    return { status: 'ok', meta, state: {
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
    } };
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

  return { status: 'ok', meta, state: {
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
  } };
}


// ────────────────────────────────────────────────
//  WRITE
// ────────────────────────────────────────────────

export async function saveProfile(sd, userId) {
  // Empty-Write-Schutz: kein Profil-Write, bevor der Cloud-Stand bestätigt ist.
  if (!_cloudConfirmed) { console.warn('[sync] saveProfile übersprungen — Cloud-Stand noch nicht bestätigt'); return; }
  // updated_at NICHT mitschicken — DB-Trigger setzt es serverseitig (now()).
  const payload = {
    player_name:    sd.playerName || '',
    highscore:      sd.highscore || 0,
    total_points:   sd.totalPoints || 0,
    active_deck_id: isUUID(sd.activeDeckId) ? sd.activeDeckId : null,
    active_mode:    sd.activeMode || 'free',
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
  // updated_at setzt der DB-Trigger serverseitig; created_at bleibt client-seitig (Insert).
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
  // updated_at setzt der DB-Trigger serverseitig.
  const rows = Object.entries(stats).map(([statKey, s]) => ({
    user_id:  userId,
    deck_id:  deckCloudId,
    stat_key: statKey,
    asked:    s.asked   || 0,
    correct:  s.correct || 0,
    wrong:    s.wrong   || 0,
    recent:   s.recent  || '',
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
  // updated_at setzt der DB-Trigger serverseitig.
  const wordRows = Object.entries(stats.wordStats || {}).map(([statKey, s]) => ({
    user_id:    userId,
    stat_key:   statKey,
    asked:      s.asked   || 0,
    correct:    s.correct || 0,
    wrong:      s.wrong   || 0,
    recent:     s.recent  || '',
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
    .update({ highscore: 0, total_points: 0, active_deck_id: null, active_mode: 'free' })
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


/** True, wenn eine Profil-Änderung (z.B. Namensänderung) auf Sync wartet. */
export function hasPendingProfile() {
  return readPending().some(p => p.type === 'profile');
}

/** Schreibt alle pending Änderungen in die Cloud. Fehlgeschlagene bleiben in der Queue. */
export async function flushPendingSync() {
  if (!window.currentUser) return;
  // Empty-Write-Schutz: kein Replay, bevor der Cloud-Stand bestätigt ist.
  if (!_cloudConfirmed) { console.warn('[sync] flushPendingSync übersprungen — Cloud-Stand noch nicht bestätigt'); return; }
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

// ────────────────────────────────────────────────
//  WAHRHEITS-TOKEN: updated_at-Signatur (nur beim App-Öffnen genutzt)
// ────────────────────────────────────────────────
// Signatur je Bereich = {ts: max(updated_at), count}. count fängt Löschungen ab.
// Vergleich Cloud-ts gegen gemerktes ts (beide aus der DB) → clock-skew-frei.

const SYNC_META_SK = 'es_sync_meta';
const PROBE_TIMEOUT_MS = 4000;

export function readSyncMeta() {
  try { return JSON.parse(localStorage.getItem(SYNC_META_SK) || 'null'); } catch { return null; }
}
export function writeSyncMeta(meta) {
  if (!meta) return;
  try { localStorage.setItem(SYNC_META_SK, JSON.stringify(meta)); } catch (e) {}
}
export function clearSyncMeta() {
  try { localStorage.removeItem(SYNC_META_SK); } catch (e) {}
}

/** True, wenn die Cloud-Signatur neuer/anders ist als die gemerkte (→ nachladen). */
export function metaDiffers(cloud, stored) {
  if (!cloud) return false;     // Probe lieferte nichts → nicht nachladen
  if (!stored) return true;     // nie geladen → laden
  for (const k of ['profile', 'decks', 'word_stats', 'preset']) {
    const c = cloud[k] || {}, s = stored[k] || {};
    if ((c.count || 0) !== (s.count || 0)) return true;
    const ct = c.ts ? Date.parse(c.ts) : 0;
    const st = s.ts ? Date.parse(s.ts) : 0;
    if (ct > st) return true;
  }
  return false;
}

/**
 * Billiger Abgleich-Request: aktuelle Cloud-Signatur {ts,count} je Bereich.
 * Kurzer Timeout, ein Versuch — best effort. Bei Fehler {status:'failed'}.
 */
export async function cloudProbe(userId) {
  await ensureFreshToken();   // gültigen JWT sicherstellen → Probe bekommt kein 401
  const sig = (tbl) => supabase.from(tbl)
    .select('updated_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  try {
    const [prof, decks, ws, ps, pcp] = await withTimeout(Promise.all([
      supabase.from('profiles').select('updated_at').eq('id', userId).maybeSingle(),
      sig('decks'), sig('word_stats'), sig('preset_stats'), sig('preset_category_progress'),
    ]), PROBE_TIMEOUT_MS, 'cloudProbe');

    if (prof.error || decks.error || ws.error || ps.error || pcp.error) return { status: 'failed' };

    const meta = {
      profile:    { ts: prof.data?.updated_at || null, count: prof.data ? 1 : 0 },
      decks:      { ts: decks.data?.[0]?.updated_at || null, count: decks.count ?? 0 },
      word_stats: { ts: ws.data?.[0]?.updated_at || null,    count: ws.count ?? 0 },
      preset:     {
        ts:    _maxTs([...(ps.data || []), ...(pcp.data || [])]),
        count: (ps.count ?? 0) + (pcp.count ?? 0),
      },
    };
    return { status: 'ok', meta };
  } catch (e) {
    console.warn('[sync] cloudProbe fehlgeschlagen:', e?.message);
    return { status: 'failed' };
  }
}

/** Nach einem bestätigten Write die gemerkte Signatur aktualisieren (Probe → Store). */
export async function refreshSyncMeta(userId) {
  const p = await cloudProbe(userId);
  if (p.status === 'ok') writeSyncMeta(p.meta);
}
