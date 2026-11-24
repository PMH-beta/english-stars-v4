// src/modules/schnell-stand.js
// K2 (24.11.2026): Umfang des Schnellmodus.
//
// Der Schnellmodus setzt nur die VOKABEL-Stände (_mc, _sp, _sp_lu, _sp_so, _pr) der
// Wörter seines Modus auf 0. In denselben Töpfen liegen auch Kampf (_cf…), Schmiede
// und Trainingsplatz — die bleiben echt. Vorher wurde der ganze Vorlagen-Topf geleert;
// ein Kampf oder eine Schmiede-Runde lud dann den leeren Topf hoch, und der
// Spiegel-Delete (sync.js saveGlobalPresetStats) löschte die Stände in der Cloud.
//
// Solange der Schnellmodus an ist, geht in die Cloud immer der ECHTE Stand: die
// Vokabel-Stände aus der Sicherung, alles andere so, wie es gerade ist.
//
// Sicherung je Modus (window._schnellBackup[mode], dauerhaft in es_schnell_backup):
//   { v: 2, decks: { deckId: { statKey: stat } }, preset: { statKey: stat }, basen: [...] }
// basen = Stat-Schlüssel ohne Suffix der Vorlagen-Wörter des Modus (für die
// Wiederherstellung nach einem Absturz, index.html). Alte Sicherungen ohne v
// enthalten die ganzen Töpfe.
import { statKeyFor } from './stats.js';

const VOKABEL_SUF = /_(?:mc|sp|sp_lu|sp_so|pr)$/;
export const istVokabelKey = (k) => VOKABEL_SUF.test(k);
const basisVon = (k) => k.replace(VOKABEL_SUF, '');

function _decks(sd, mode) {
  return Object.entries(sd?.decks || {}).filter(([, d]) => (d.mode || 'free') === mode);
}
function _basen(sd, mode) {
  const s = new Set();
  for (const [, d] of _decks(sd, mode)) {
    for (const v of (d.vocab || [])) if (v && v._presetId) s.add(statKeyFor(v.de, v.en, '', v._presetId));
  }
  return s;
}
// Entfernt die passenden Schlüssel aus store und gibt sie zurück.
function _herausnehmen(store, passt) {
  const raus = {};
  for (const k of Object.keys(store || {})) if (passt(k)) { raus[k] = store[k]; delete store[k]; }
  return raus;
}
const _vorlagePasst = (basen) => (k) => istVokabelKey(k) && basen.has(basisVon(k));

/** Einschalten: Vokabel-Stände des Modus sichern und aus den Töpfen nehmen. */
export function schnellSichern(sd, mode) {
  const basen = _basen(sd, mode);
  const b = { v: 2, decks: {}, preset: {}, basen: [...basen] };
  for (const [id, d] of _decks(sd, mode)) {
    if (!d.wordStats) d.wordStats = {};
    b.decks[id] = _herausnehmen(d.wordStats, istVokabelKey);
  }
  const gws = sd?.globalPresetStats?.wordStats;
  if (gws && basen.size) b.preset = _herausnehmen(gws, _vorlagePasst(basen));
  return b;
}

/** Ausschalten: Schnell-Stände des Modus verwerfen, Sicherung zurück. */
export function schnellZurueck(sd, mode, b) {
  if (!b || !sd) return;
  if (b.v !== 2) {   // alte Sicherung: ganze Töpfe
    for (const [id, ws] of Object.entries(b.decks || {})) if (sd.decks?.[id]) sd.decks[id].wordStats = ws;
    if (b.preset && sd.globalPresetStats) sd.globalPresetStats.wordStats = b.preset;
    return;
  }
  // Auch Decks, die erst im Schnellmodus dazukamen: deren Vokabel-Stände sind Schnell-Stände.
  for (const [id, d] of _decks(sd, mode)) {
    if (!d.wordStats) d.wordStats = {};
    _herausnehmen(d.wordStats, istVokabelKey);
    Object.assign(d.wordStats, b.decks?.[id] || {});
  }
  const gws = sd.globalPresetStats?.wordStats;
  if (gws) {
    const basen = new Set([...(b.basen || []), ..._basen(sd, mode)]);
    _herausnehmen(gws, _vorlagePasst(basen));
    Object.assign(gws, b.preset || {});
  }
}

function _aktiveSicherungen() {
  const an = window.schnellByMode || {}, bk = window._schnellBackup || {};
  return Object.keys(an).filter((m) => an[m] && bk[m] && bk[m].v === 2).map((m) => [m, bk[m]]);
}

/** Upload: Wort-Stände eines Decks, wie sie ohne Schnellmodus wären. */
export function echteDeckStats(deck) {
  const ws = deck?.wordStats || {};
  const b = _aktiveSicherungen().find(([m]) => m === (deck?.mode || 'free'))?.[1];
  if (!b) return ws;
  const out = {};
  for (const k in ws) if (!istVokabelKey(k)) out[k] = ws[k];
  return Object.assign(out, b.decks?.[deck.id] || {});
}

/** Upload: Vorlagen-Stände (globalPresetStats), wie sie ohne Schnellmodus wären. */
export function echtePresetStats(gps) {
  const aktiv = _aktiveSicherungen();
  if (!gps || !aktiv.length) return gps;
  const out = { ...(gps.wordStats || {}) };
  for (const [mode, b] of aktiv) {
    const basen = new Set([...(b.basen || []), ..._basen(window.SD, mode)]);
    _herausnehmen(out, _vorlagePasst(basen));
    Object.assign(out, b.preset || {});
  }
  return { ...gps, wordStats: out };
}
