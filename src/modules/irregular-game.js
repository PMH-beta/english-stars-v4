// src/modules/irregular-game.js
// Gestaltwandler — eigenständige UV-Engine (unregelmäßige Verben) für den
// Schülermodus. KEIN Deck: Quelle ist der Datensatz (irregular-verbs.js),
// Stats wohnen in SD.globalPresetStats (presetId 'irregular-verbs').
//
// Reitet bewusst auf den vorhandenen Spiel-Primitiven (game.js: startGame →
// buildPool → Render/Antwort/Stat), getrennt vom Deck-System: buildPool kennt
// einen UV-Zweig, saveProgress einen UV-Guard. Hier nur Einstieg + Fortschritt.

import { startGame } from './game.js';
import { effectivePct } from './stats.js';
import { statKeyFor } from './stats.js';
import { IRREGULAR_VERBS, irregularVocabSet, IRREGULAR_PRESET_ID } from './irregular-verbs.js';

// Form×Kompetenz-Suffixe je Kompetenz (Basisfrage + past + pp).
const UV_SUFFIXES = {
  vocab:     ['_mc', '_past_mc', '_pp_mc'],
  spelling:  ['_sp', '_past_sp', '_pp_sp'],
  pronounce: ['_pr', '_past_pr', '_pp_pr'],
};

// Eine Übungsrunde starten. mode = 'vocab' (Erkennen) | 'spelling' (Schmieden)
// | 'pronounce' (Rufen). Setzt window.VOCAB auf das Verb-Set (kein Deck-Spiegel)
// und markiert die Runde als UV. Schnell-Modus ist hier immer aus (UV zählt echt).
export function startIrregularVerbs(mode) {
  window.isUV = true;
  window.isSchnellModus = false;   // UV hat keinen Schnell-Toggle → immer echte Wertung
  const set = irregularVocabSet();
  if (typeof window.VOCAB === 'undefined') window.VOCAB = [];
  window.VOCAB.length = 0;
  for (const v of set) window.VOCAB.push(v);
  startGame(mode);
}

// Fortschritt einer Kompetenz über alle Verben (Basis + past + pp).
// Gleiche Score-Formel wie progressForCurrentMode/deckProgress, Quelle ist
// globalPresetStats. Rückgabe: { score, mastered, total }.
export function uvProgress(mode) {
  const ws = window.SD?.globalPresetStats?.wordStats || {};
  const sufs = UV_SUFFIXES[mode] || UV_SUFFIXES.vocab;
  let score = 0, mastered = 0;
  const total = IRREGULAR_VERBS.length * sufs.length;
  for (const v of IRREGULAR_VERBS) {
    for (const suf of sufs) {
      const s = ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)];
      if (!s || !s.asked) continue;
      const asked = s.asked, pct = effectivePct(s);
      if (Math.floor(asked) >= 3 && pct >= 0.9) { score += 1; mastered += 1; }
      else if (asked >= 1) {
        score += Math.max(0, (pct - 0.5) * 2) * Math.min(asked / 3, 1) * 0.85;
      }
    }
  }
  return { score, mastered, total };
}

// Prozent für einen Balken (0–100).
export function uvProgressPct(mode) {
  const p = uvProgress(mode);
  return p.total > 0 ? Math.min(100, Math.round((p.score / p.total) * 100)) : 0;
}
