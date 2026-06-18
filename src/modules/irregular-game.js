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
import { irregularAsVocab, expectedVerbs, IRREGULAR_PRESET_ID } from './irregular-verbs.js';

// Form×Kompetenz-Suffixe je Kompetenz (Basisfrage + past + pp).
const UV_SUFFIXES = {
  vocab:     ['_mc', '_past_mc', '_pp_mc'],
  spelling:  ['_sp', '_past_sp', '_pp_sp'],
  pronounce: ['_pr', '_past_pr', '_pp_pr'],
};

// ── Lehrplan-Wahl (Phase 3, §6) ─────────────────────────────────────────────
// Schulart + Klasse bestimmen die Tier-Decke (CURRICULUM). Liegt in localStorage
// wie es_student_subtab → überlebt Cloud-Load 1:1, kein Schema-/Sync-Umbau.
// Ohne Wahl: ceiling 1 (A1) — expectedVerbs(undefined,undefined) liefert tier≤1.
const UV_CURRICULUM_KEY = 'es_uv_curriculum';
export function getUvCurriculum() {
  try { return JSON.parse(localStorage.getItem(UV_CURRICULUM_KEY) || 'null'); }
  catch (e) { return null; }
}
export function setUvCurriculum(schulart, klasse) {
  try {
    if (!schulart) localStorage.removeItem(UV_CURRICULUM_KEY);
    else localStorage.setItem(UV_CURRICULUM_KEY, JSON.stringify({ schulart, klasse: klasse ? Number(klasse) : null }));
  } catch (e) {}
}

// Aktiver Soll-Satz (tier ≤ Klassendecke) als rohe Verb-Objekte.
export function activeVerbs() {
  const c = getUvCurriculum();
  return expectedVerbs(c && c.schulart, c && c.klasse);
}

// Eine Übungsrunde starten. mode = 'vocab' (Erkennen) | 'spelling' (Schmieden)
// | 'pronounce' (Rufen). Setzt window.VOCAB auf den AKTIVEN Verb-Satz (kein
// Deck-Spiegel) und markiert die Runde als UV. Schnell ist hier immer aus.
export function startIrregularVerbs(mode) {
  window.isUV = true;
  window.isSchnellModus = false;   // UV hat keinen Schnell-Toggle → immer echte Wertung
  const set = activeVerbs().map(irregularAsVocab);
  if (typeof window.VOCAB === 'undefined') window.VOCAB = [];
  window.VOCAB.length = 0;
  for (const v of set) window.VOCAB.push(v);
  startGame(mode);
}

// Fortschritt einer Kompetenz über die AKTIVEN Verben (Basis + past + pp).
// Gleiche Score-Formel wie progressForCurrentMode/deckProgress, Quelle ist
// globalPresetStats. Rückgabe: { score, mastered, total }.
export function uvProgress(mode) {
  const ws = window.SD?.globalPresetStats?.wordStats || {};
  const sufs = UV_SUFFIXES[mode] || UV_SUFFIXES.vocab;
  const verbs = activeVerbs();
  let score = 0, mastered = 0;
  const total = verbs.length * sufs.length;
  for (const v of verbs) {
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
