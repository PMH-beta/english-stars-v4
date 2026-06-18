// src/modules/irregular-game.js
// Gestaltwandler — eigenständige UV-Engine (unregelmäßige Verben) für den
// Schülermodus. KEIN Deck: Quelle ist der Datensatz (irregular-verbs.js),
// Stats wohnen in SD.globalPresetStats (presetId 'irregular-verbs').
//
// Reitet bewusst auf den vorhandenen Spiel-Primitiven (game.js: startGame →
// buildPool → Render/Antwort/Stat), getrennt vom Deck-System: buildPool kennt
// einen UV-Zweig, saveProgress einen UV-Guard. Hier nur Einstieg + Fortschritt.

import { startGame } from './game.js';
import { effectivePct, isStatMastered } from './stats.js';
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

// ── Lernstand (Phase 4, §7) ─────────────────────────────────────────────────
// Alle 9 Suffixe eines Verbs (Basis + past + pp, je lesen/sprechen/schreiben).
const UV_ALL_SUFFIXES = ['_mc','_sp','_pr','_past_mc','_past_sp','_past_pr','_pp_mc','_pp_sp','_pp_pr'];
const UV_ART_NAMES = {
  einzel: 'Einzelgänger', gleich: 'Gleichmacher', iau: 'i–a–u-Wandler',
  en: '-en-Verwandler', keine: 'Faulpelze',
};

// Beherrschung eines Verbs: 'voll' (alle 9 Suffixe gemeistert) | 'offen'
// (nichts gemeistert) | 'teilweise'.
export function verbStatus(v, ws) {
  ws = ws || window.SD?.globalPresetStats?.wordStats || {};
  let m = 0;
  for (const suf of UV_ALL_SUFFIXES) {
    if (isStatMastered(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)])) m++;
  }
  return m === 0 ? 'offen' : (m === UV_ALL_SUFFIXES.length ? 'voll' : 'teilweise');
}

// Gesamter Lernstand über den aktiven Satz: Verb-Zähler (voll/teilweise/offen),
// Aufschlüsselung nach Kompetenz und nach Art, offene Verbnamen für die Liste.
export function uvLernstand() {
  const ws = window.SD?.globalPresetStats?.wordStats || {};
  const verbs = activeVerbs();
  const counts = { voll: 0, teilweise: 0, offen: 0 };
  const byArt = {};
  const open = [];
  for (const v of verbs) {
    const st = verbStatus(v, ws);
    counts[st]++;
    const a = byArt[v.art] || (byArt[v.art] = { name: UV_ART_NAMES[v.art] || v.art, voll: 0, total: 0 });
    a.total++; if (st === 'voll') a.voll++;
    if (st !== 'voll') open.push(v.en);
  }
  const byMode = { vocab: uvProgress('vocab'), pronounce: uvProgress('pronounce'), spelling: uvProgress('spelling') };
  return { total: verbs.length, ...counts, byArt, byMode, open, curriculum: getUvCurriculum() };
}
