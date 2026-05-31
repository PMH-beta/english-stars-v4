// src/modules/stats.js
import { EMA_ALPHA, MASTERY_THRESHOLD, MASTERY_MIN_ATTEMPTS } from './config.js';

// Gewichteter Durchschnitt der letzten Antworten (jüngste zählen stärker).
// Verhindert, dass ein User nach 3× falsch nun 27× richtig braucht um auf 90% zu kommen.
export function effectivePct(stat) {
  if (!stat || !stat.asked) return 0;
  const recent = stat.recent || '';
  if (!recent) return (stat.correct || 0) / stat.asked;
  let ema = null;
  for (let i = 0; i < recent.length; i++) {
    const v = recent[i] === '1' ? 1 : 0;
    ema = ema === null ? v : EMA_ALPHA * v + (1 - EMA_ALPHA) * ema;
  }
  const total = (stat.correct || 0) / stat.asked;
  const recentWeight = Math.min(recent.length / 5, 1) * 0.75;
  return ema * recentWeight + total * (1 - recentWeight);
}

// Zentrales Mastery-Kriterium für eine einzelne Stat (ein Wort, ein Modus).
// Quelle der Wahrheit — von isMastered und allen Aggregationen wiederverwendet.
export function isStatMastered(s) {
  return !!s && Math.floor(s.asked || 0) >= MASTERY_MIN_ATTEMPTS && effectivePct(s) >= MASTERY_THRESHOLD;
}

export function isMastered(q) {
  const store = q._presetId ? window.SD?.globalPresetStats?.wordStats : window.SD.wordStats;
  return isStatMastered(store?.[q.statKey]);
}

// Gibt die Stat-Daten für ein Vokabel-Objekt zurück — routet automatisch:
// Vorlage-Wörter (v._presetId gesetzt) → SD.globalPresetStats.wordStats
// Manuelle Wörter → SD.wordStats (Spiegel des aktiven Decks)
export function getVocabStat(v, suffix) {
  const key = statKeyFor(v.de, v.en, suffix, v._presetId || null);
  if (v._presetId) return window.SD?.globalPresetStats?.wordStats?.[key];
  return window.SD?.wordStats?.[key];
}

// buildPool → src/modules/game.js (braucht Question-Builder die dort leben)

// ════════════════════════════════════════════════
//  STAT-KEY NORMALISIERUNG
// ════════════════════════════════════════════════

// Vorlagen-Wörter:   normDE|normEN|presetId + suffix  (2 Pipes)
// Eigene Vokabeln:   normDE|normEN + suffix            (1 Pipe, altes Format)
export function normStatDE(de) {
  return (de || '').trim().toLowerCase();
}
export function normStatEN(en) {
  return (en || '').trim().toLowerCase().replace(/^to /, '');
}
export function statKeyFor(de, en, suffix, presetId = null) {
  const base = normStatDE(de) + '|' + normStatEN(en);
  return presetId ? base + '|' + presetId + suffix : base + suffix;
}
