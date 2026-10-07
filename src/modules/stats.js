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

// ── Rechtschreibung (F-71–F-75, 08.10.2026) ──────────────────────────────
// Drei Aufgaben je Wort: Buchstabe einsetzen (_sp_lu), Buchstaben sortieren
// (_sp_so), Wort schreiben (_sp). Eine Aufgabe ist geschafft, sobald sie einmal
// richtig war; alle drei = Wort abgeschlossen. Wörter mit höchstens zwei Buchstaben
// haben nur Schreiben. Was nach der alten Regel (nur _sp) schon gemeistert war,
// gilt als abgeschlossen — niemand verliert Prozente oder Taler.
export const SP_TEILE = ['_sp_lu', '_sp_so', '_sp'];
/** Erste /-Alternative des englischen Worts. */
export const spWort = (en) => (en || '').split('/')[0].trim();
export const spKurz = (en) => spWort(en).replace(/\s/g, '').length <= 2;

/** Stand eines Wortes in Rechtschreibung. ws = Stat-Map, in der das Wort liegt. */
export function spellingStand(ws, v, presetId = null) {
  const st = (suf) => ws?.[statKeyFor(v.de, v.en, suf, presetId)];
  const alt = isStatMastered(st('_sp'));
  const kurz = spKurz(v.en);
  const offen = SP_TEILE.filter((suf) => !(alt || (kurz && suf !== '_sp') || (st(suf)?.correct || 0) >= 1));
  return {
    offen,
    // Kurze Wörter: Schreiben zählt fürs ganze Wort (sonst stünden sie ungeübt schon bei 2/3).
    geschafft: kurz ? (offen.length ? 0 : SP_TEILE.length) : SP_TEILE.length - offen.length,
    fertig: offen.length === 0,
    gefragt: SP_TEILE.some((suf) => st(suf)?.asked),
  };
}

/**
 * Beitrag eines Wortes zum Fortschritt einer Übungsart (0–1) und ob es dort
 * fertig ist. Rechtschreibung: je geschaffte Aufgabe ein Drittel (F-74); die
 * anderen Arten wie bisher (gemeistert = 1, sonst Teilpunkte aus der Quote).
 */
export function wortScore(ws, v, suffix, presetId = null) {
  if (suffix === '_sp') {
    const s = spellingStand(ws, v, presetId);
    return { score: s.geschafft / SP_TEILE.length, mastered: s.fertig, gefragt: s.gefragt };
  }
  const s = ws?.[statKeyFor(v.de, v.en, suffix, presetId)];
  if (!s || !s.asked) return { score: 0, mastered: false, gefragt: false };
  const asked = s.asked, pct = effectivePct(s);
  if (Math.floor(asked) >= 3 && pct >= 0.9) return { score: 1, mastered: true, gefragt: true };
  return { score: Math.max(0, (pct - 0.5) * 2) * Math.min(asked / 3, 1) * 0.85, mastered: false, gefragt: true };
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
