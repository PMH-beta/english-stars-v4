// src/modules/irregular-game.js
// Gestaltwandler — eigenständige UV-Engine (unregelmäßige Verben) für den
// Schülermodus. KEIN Deck, KEINE Schulart/Klasse: die Verben sind nach
// Schwierigkeit in benannte Sternbilder gruppiert (irregular-verbs.js).
//
// Ein Sternbild deckt eine kleine Wortgruppe ab und hat 6 spielbare Sterne, die in
// dieser Reihenfolge freischalten (kodiert „Erkennen → Schmieden → Rufen" und
// „Simple Past vor Past Participle"):
//   1 Erkennen·Past   2 Erkennen·PP   3 Schmieden·Past   4 Schmieden·PP
//   5 Rufen·Past      6 Rufen·PP
// Der 7. Stern ist nur ein Komplett-Leuchtstern (kein Boss — Bosse/Prüfungen
// kommen in die Kampagne). Ein Stern „leuchtet", wenn ALLE Verben der Gruppe in
// diesem Suffix gemeistert sind. Alle 6 leuchten ⇒ Sternbild komplett ⇒ nächstes frei.
//
// Stats wohnen wie bisher in SD.globalPresetStats (presetId 'irregular-verbs') —
// kein Schema-/Sync-Umbau. Geändert wird nur, dass eine Runde auf EIN Sternbild
// (window.VOCAB) und EINEN Stern (window._uvStar) eingegrenzt ist.

import { startGame } from './game.js';
import { effectivePct, isStatMastered, statKeyFor } from './stats.js';
import { irregularAsVocab, getConstellations, IRREGULAR_PRESET_ID } from './irregular-verbs.js';

// Sterne eines Sternbilds (ohne Boss) — Disziplin × Form, in Freischalt-Reihenfolge.
export const UV_STARS = [
  { mode: 'vocab',     which: 'past', icon: '🔍', name: 'Erkennen',  form: 'Simple Past' },
  { mode: 'vocab',     which: 'pp',   icon: '🔍', name: 'Erkennen',  form: 'Past Participle' },
  { mode: 'spelling',  which: 'past', icon: '🔨', name: 'Schmieden', form: 'Simple Past' },
  { mode: 'spelling',  which: 'pp',   icon: '🔨', name: 'Schmieden', form: 'Past Participle' },
  { mode: 'pronounce', which: 'past', icon: '🗣️', name: 'Rufen',     form: 'Simple Past' },
  { mode: 'pronounce', which: 'pp',   icon: '🗣️', name: 'Rufen',     form: 'Past Participle' },
];
const SUF = {
  vocab:     { past: '_past_mc', pp: '_pp_mc' },
  spelling:  { past: '_past_sp', pp: '_pp_sp' },
  pronounce: { past: '_past_pr', pp: '_pp_pr' },
};

function _ws() { return window.SD?.globalPresetStats?.wordStats || {}; }

// ── Stern-Zustand ───────────────────────────────────────────────────────────
// Ein Stern leuchtet, wenn jedes Verb der Gruppe in diesem Suffix gemeistert ist.
export function starLit(verbs, mode, which) {
  const ws = _ws(); const suf = SUF[mode][which];
  return verbs.length > 0 && verbs.every((v) => isStatMastered(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)]));
}
// Fortschritt eines Sterns (gemeisterte / alle Verben der Gruppe).
export function starProgress(verbs, mode, which) {
  const ws = _ws(); const suf = SUF[mode][which];
  let m = 0;
  verbs.forEach((v) => { if (isStatMastered(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)])) m++; });
  return { mastered: m, total: verbs.length };
}

// Disziplin-Reihenfolge innerhalb einer Form: Erkennen → Schmieden → Rufen.
const DISC_ORDER = ['vocab', 'spelling', 'pronounce'];

// Eine Form (Simple Past / Past Participle) eines Sternbilds ist fertig, wenn alle
// drei Disziplinen dieser Form gemeistert sind.
export function formComplete(c, which) {
  return DISC_ORDER.every((mode) => starLit(c.verbs, mode, which));
}

// Freischaltung: Ein Sternbild ist erreichbar, sobald beim VORHERIGEN mindestens
// EINE Form (Simple Past ODER Past Participle) komplett ist — man muss also nur
// eine der beiden Seiten fertigspielen, um weiterzukommen. Das erste Sternbild ist
// immer frei. Innerhalb eines erreichbaren Sternbilds sind BEIDE Formen sofort
// offen: man wählt selbst, ob man zuerst Past oder Past Participle übt.
export function constellationUnlocked(idx) {
  if (idx <= 0) return true;
  const prev = getConstellations()[idx - 1];
  return formComplete(prev, 'past') || formComplete(prev, 'pp');
}
// which bleibt im Signatur erhalten (constellationStars ruft pro Form auf); beide
// Formen teilen jetzt dieselbe Freischaltung.
export function formUnlocked(idx, _which) {
  return constellationUnlocked(idx);
}

// Zustand aller 7 Sterne eines Sternbilds. Jede Form hat ihre eigene Kette
// (formUnlocked); innerhalb einer Form klettern die Disziplinen linear
// (Erkennen → Schmieden → Rufen). Der 7. Stern ist KEIN Boss (Bosse/Prüfungen
// wandern in die Kampagne) — ein reiner Komplett-Leuchtstern: nicht spielbar,
// leuchtet, sobald alle 6 Disziplin-Sterne leuchten.
export function constellationStars(c) {
  const states = UV_STARS.map((st, i) => {
    const lit = starLit(c.verbs, st.mode, st.which);
    const di = DISC_ORDER.indexOf(st.mode);
    const prevDiscLit = di === 0 ? true : starLit(c.verbs, DISC_ORDER[di - 1], st.which);
    const unlocked = formUnlocked(c.idx, st.which) && prevDiscLit;
    return { ...st, i, lit, unlocked, prog: starProgress(c.verbs, st.mode, st.which) };
  });
  const allLit = states.every((s) => s.lit);   // alle 6 Disziplin-Sterne leuchten
  states.push({ mode: null, which: null, icon: '🌟', name: 'Komplett', form: '', i: 6, lit: allLit, unlocked: false, done: true });
  return states;
}
export function constellationComplete(c) {
  return UV_STARS.every((st) => starLit(c.verbs, st.mode, st.which));
}

// Alles, was die Sternkarte (ui.js) braucht.
export function uvMap() {
  return getConstellations().map((c) => ({
    c,
    unlocked: constellationUnlocked(c.idx),
    complete: constellationComplete(c),
    stars: constellationStars(c),
  }));
}

// ── Runde starten ───────────────────────────────────────────────────────────
function _enterUV(c) {
  window.isUV = true;
  window.isSchnellModus = false;   // UV hat keinen Schnell-Toggle → immer echte Wertung
  window._uvConstellation = c;
  if (typeof window.VOCAB === 'undefined') window.VOCAB = [];
  window.VOCAB.length = 0;
  c.verbs.map(irregularAsVocab).forEach((v) => window.VOCAB.push(v));
}

// Einen Disziplin-Stern eines Sternbilds spielen (cIdx, starIdx 0–5).
export function startConstellationStar(cIdx, starIdx) {
  const c = getConstellations()[cIdx]; if (!c) return;
  const st = UV_STARS[starIdx]; if (!st) return;
  _enterUV(c);
  window._uvStar = { mode: st.mode, which: st.which };
  startGame(st.mode);
}

// ── Live-Fortschrittsbalken im Spiel (progressForCurrentMode in game.js) ─────
// Rechnet über window.VOCAB (= das aktive Sternbild). Bei einer Stern-Runde nur
// das aktive Suffix, beim Boss alle sechs.
export function uvProgress(mode) {
  const ws = _ws();
  const star = window._uvStar;
  let sufs;
  if (mode === 'mixed_vocab' || !star) {
    sufs = mode === 'mixed_vocab'
      ? Object.values(SUF).flatMap((o) => [o.past, o.pp])
      : [SUF[mode].past, SUF[mode].pp];
  } else {
    sufs = [SUF[mode][star.which]];
  }
  const verbs = (window.VOCAB || []).filter((v) => v.forms);
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

// Form-Suffixe getrennt nach Simple Past / Past Participle (je 3 Disziplinen) —
// für die Pro-Wort-Übersicht, die den Fortschritt nach Form aufteilt.
const PAST_SUF = Object.values(SUF).map((o) => o.past);
const PP_SUF   = Object.values(SUF).map((o) => o.pp);
function _countMastered(v, sufs, ws) {
  let m = 0;
  sufs.forEach((suf) => { if (isStatMastered(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)])) m++; });
  return m;
}

// Pro Verb eines Sternbilds: gemeisterte Formen getrennt nach Simple Past und
// Past Participle (je x/3). mastered/total bleiben als Gesamtwert erhalten
// (Lernstand-Ansicht). Für die Pro-Wort-Liste im Sternenpfad.
export function constellationWords(c) {
  const ws = _ws();
  return c.verbs.map((v) => {
    const pm  = _countMastered(v, PAST_SUF, ws);
    const ppm = _countMastered(v, PP_SUF, ws);
    return {
      de: v.de, en: v.en,
      past: { mastered: pm,  total: PAST_SUF.length },
      pp:   { mastered: ppm, total: PP_SUF.length },
      mastered: pm + ppm, total: PAST_SUF.length + PP_SUF.length,
    };
  });
}

// ── Lernstand-Übersicht (Fortschritt-Ansicht) ───────────────────────────────
// Sternbild-Karte: pro Sternbild gefüllte Disziplin-Sterne (0–6), komplett-Flag,
// frei/gesperrt. Plus Gesamt-Zähler.
export function uvLernstand() {
  const map = uvMap();
  let complete = 0, totalLit = 0;
  const rows = map.map((m) => {
    const lit = m.stars.filter((s) => s.lit && !s.done).length;   // 0..6
    totalLit += lit;
    if (m.complete) complete++;
    return { name: m.c.name, cefr: m.c.cefr, count: m.c.verbs.length, lit, total: 6, complete: m.complete, unlocked: m.unlocked, words: constellationWords(m.c) };
  });
  return { total: map.length, complete, totalLit, maxLit: map.length * 6, rows };
}
