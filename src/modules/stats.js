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
  const s = window.SD.wordStats[q.statKey];
  return s && Math.floor(s.asked || 0) >= MASTERY_MIN_ATTEMPTS && effectivePct(s) >= MASTERY_THRESHOLD;
}

// buildPool → src/modules/game.js (braucht Question-Builder die dort leben)
