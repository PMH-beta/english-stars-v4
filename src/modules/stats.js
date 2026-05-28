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

export function isMastered(q) {
  const store = q._presetId ? window.SD?.globalPresetStats?.wordStats : window.SD.wordStats;
  const s = store?.[q.statKey];
  return s && Math.floor(s.asked || 0) >= MASTERY_MIN_ATTEMPTS && effectivePct(s) >= MASTERY_THRESHOLD;
}

// Gibt die Stat-Daten für ein Vokabel-Objekt zurück — routet automatisch:
// Vorlage-Wörter (v._presetId gesetzt) → SD.globalPresetStats.wordStats
// Manuelle Wörter → SD.wordStats (Spiegel des aktiven Decks)
export function getVocabStat(v, suffix) {
  const key = statKeyFor(v.de, v.en, suffix);
  if (v._presetId) return window.SD?.globalPresetStats?.wordStats?.[key];
  return window.SD?.wordStats?.[key];
}

// Anteiliger Fortschritt für einen einzelnen Modus (0–100).
// Gleiche Logik wie presetWordsPct, aber nur für ein Suffix.
export function modePct(words, wordStatsMap, suffix) {
  if (!words?.length) return 0;
  let total = 0;
  for (const v of words) {
    const s = wordStatsMap[statKeyFor(v.de, v.en, suffix)];
    total += s ? effectivePct(s) : 0;
  }
  return Math.round(total / words.length * 100);
}

export function presetWordsPct(words, wordStatsMap) {
  if (!words?.length) return 0;
  let totalPct = 0;
  for (const v of words) {
    let wordPct = 0;
    for (const suf of ['_mc', '_sp', '_pr']) {
      const s = wordStatsMap[statKeyFor(v.de, v.en, suf)];
      wordPct += s ? effectivePct(s) : 0;
    }
    totalPct += wordPct / 3;
  }
  return Math.round(totalPct / words.length * 100);
}

// buildPool → src/modules/game.js (braucht Question-Builder die dort leben)

// ════════════════════════════════════════════════
//  STAT-KEY NORMALISIERUNG
// ════════════════════════════════════════════════

// Format: normDE(de) + '|' + normEN(en) + suffix ('_mc'|'_sp'|'_pr')
// Normalisierung: trim + lowercase + führendes "to " beim EN entfernen.
// "to go" und "go" treffen denselben Key; DE und EN zusammen müssen passen.
export function normStatDE(de) {
  return (de || '').trim().toLowerCase();
}
export function normStatEN(en) {
  return (en || '').trim().toLowerCase().replace(/^to /, '');
}
export function statKeyFor(de, en, suffix) {
  return normStatDE(de) + '|' + normStatEN(en) + suffix;
}
