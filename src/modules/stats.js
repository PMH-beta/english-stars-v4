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
  const s = SD.wordStats[q.statKey];
  return s && Math.floor(s.asked || 0) >= MASTERY_MIN_ATTEMPTS && effectivePct(s) >= MASTERY_THRESHOLD;
}

export function buildPool(m) {
  let qs = [];
  const TOTAL = QPERROUND;
  const limit = isSchnellModus ? VOCAB.length : TOTAL;
  if (m === 'vocab') {
    weightedPickUnique(VOCAB, v => SD.wordStats[v.de + '_mc'], limit).forEach(v => qs.push(bVocabMC(v)));
  }
  if (m === 'spelling') {
    weightedPickUnique(VOCAB, v => SD.wordStats[v.de + '_sp'], limit).forEach(v => qs.push(bVocabType(v)));
  }
  if (m === 'pronounce') {
    weightedPickUnique(VOCAB, v => SD.wordStats[v.de + '_pr'], limit).forEach(v => qs.push(bVocabPronounce(v)));
  }
  if (m === 'mixed_vocab') {
    if (isSchnellModus) {
      VOCAB.forEach(v => { qs.push(bVocabMC(v)); qs.push(bVocabType(v)); qs.push(bVocabPronounce(v)); });
    } else {
      const n1 = Math.round(TOTAL / 3), n2 = Math.round(TOTAL / 3), n3 = TOTAL - n1 - n2;
      weightedPickUnique(VOCAB, v => SD.wordStats[v.de + '_mc'], n1).forEach(v => qs.push(bVocabMC(v)));
      weightedPickUnique(VOCAB, v => SD.wordStats[v.de + '_sp'], n2).forEach(v => qs.push(bVocabType(v)));
      weightedPickUnique(VOCAB, v => SD.wordStats[v.de + '_pr'], n3).forEach(v => qs.push(bVocabPronounce(v)));
    }
  }
  if (window._skipMasteryFilter) return shuffle(qs).slice(0, limit);
  const filtered = qs.filter(q => !isMastered(q));
  if (filtered.length === 0) return qs.slice(0, limit);
  return shuffle(filtered).slice(0, limit);
}
