// src/modules/irregular-game.js
// Gestaltwandler — eigenständige UV-Engine (unregelmäßige Verben) für den
// Schülermodus. KEIN Deck, KEINE Schulart/Klasse: die Verben werden vom Kind in
// Sternbilder/Stationen befüllt (irregular-verbs.js, SD.uvFills).
//
// Schmiede-Modell: jede Station hat zwei Waffen (Stahl = Simple Past, Gold = Past
// Participle). Jede Waffe = 5 TEILE (Slots). Zusammensetzung fest: Erkennen ×2,
// Schmieden ×2, Verzaubern ×1 — die Reihenfolge ist grob zufällig, aber FIX pro
// Waffe (deterministisch geseedet), mit der Regel: Verzaubern nur in Teil 3–5.
// Jeder Teil ist ein eigener „aufleuchtbarer" Slot mit eigenem Stat-Suffix
// (_past_s0 … _pp_s4) in SD.globalPresetStats (presetId 'irregular-verbs').

import { startGame } from './game.js';
import { effectivePct, isStatMastered, statKeyFor } from './stats.js';
import { irregularAsVocab, getConstellations, IRREGULAR_PRESET_ID } from './irregular-verbs.js';

export const SLOTS_PER_FORM = 5;
// Die drei Disziplinen (Icon + Name) — von ui.js/game.js für Label/% genutzt.
export const FORGE_DISC = {
  erkennen:   { icon: '🔍', name: 'Erkennen' },
  schmieden:  { icon: '🔨', name: 'Schmieden' },
  verzaubern: { icon: '🪄', name: 'Verzaubern' },
};

function _ws() { return window.SD?.globalPresetStats?.wordStats || {}; }
function _slotSuf(which, i) { return `_${which}_s${i}`; }   // which = 'past' | 'pp'

// Kleiner deterministischer PRNG → stabile, aber je Waffe unterschiedliche Anordnung.
function _seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Die 5 Disziplinen-Slots einer Waffe (deterministisch, jede Waffe anders).
// Erkennen ×2, Schmieden ×2, Verzaubern ×1 — Verzaubern nur in Slot 2–4 (= Teil 3–5).
export function weaponSlots(cIdx, which) {
  const rnd = _seeded(((cIdx + 1) * 73856093) ^ (which === 'pp' ? 19349663 : 0));
  const vPos = 2 + Math.floor(rnd() * 3);
  const rest = ['erkennen', 'erkennen', 'schmieden', 'schmieden'];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const slots = []; let r = 0;
  for (let i = 0; i < SLOTS_PER_FORM; i++) slots.push(i === vPos ? 'verzaubern' : rest[r++]);
  return slots;
}

// ── Slot-Zustand ──────────────────────────────────────────────────────────────
// Ein Slot „leuchtet", wenn jedes Verb der Gruppe in diesem Slot-Suffix sitzt.
export function starLit(verbs, suf) {
  const ws = _ws();
  return verbs.length > 0 && verbs.every((v) => isStatMastered(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)]));
}
export function starProgress(verbs, suf) {
  const ws = _ws(); let m = 0;
  verbs.forEach((v) => { if (isStatMastered(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)])) m++; });
  return { mastered: m, total: verbs.length };
}

// Eine Form ist fertig, wenn alle 5 Slot-Teile leuchten.
export function formComplete(c, which) {
  return weaponSlots(c.idx, which).every((_, i) => starLit(c.verbs, _slotSuf(which, i)));
}

// Freischaltung: nächste Station offen, sobald beim vorigen EINE Form komplett ist.
export function constellationUnlocked(idx) {
  if (idx <= 0) return true;
  const prev = getConstellations()[idx - 1];
  return formComplete(prev, 'past') || formComplete(prev, 'pp');
}
export function formUnlocked(idx) { return constellationUnlocked(idx); }

// Zustand aller 10 Slot-Teile (5 je Form). Innerhalb einer Form werden die Teile
// der Reihe nach freigeschaltet (Teil i offen, wenn Teil i-1 fertig ist).
export function constellationStars(c) {
  const out = [];
  ['past', 'pp'].forEach((which) => {
    const slots = weaponSlots(c.idx, which);
    let prevLit = true;
    slots.forEach((disc, i) => {
      const suf = _slotSuf(which, i);
      const lit = starLit(c.verbs, suf);
      const unlocked = formUnlocked(c.idx) && prevLit;
      out.push({ which, i, discipline: disc, suffix: suf, lit, unlocked, prog: starProgress(c.verbs, suf) });
      prevLit = lit;
    });
  });
  return out;
}
export function constellationComplete(c) {
  return formComplete(c, 'past') && formComplete(c, 'pp');
}

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

// Alt-Pfad (Einzel-Stern-Tap) entfällt im Slot-Modell — Stub für Kompatibilität
// (window.startConstellationStar wird im Render nicht mehr verdrahtet).
export function startConstellationStar() {}

// Eine Waffe (Form) schmieden: spielt das AKTUELLE Teil (erstes offenes, noch nicht
// fertige; sonst das letzte offene → Wiederholung). Eine Runde = EINE Disziplin;
// die Aufgabentypen werden je Frage zufällig gewählt (game.js bDisc).
export function startConstellationForm(cIdx, which) {
  if (which !== 'past' && which !== 'pp') return;
  const c = getConstellations()[cIdx]; if (!c) return;
  const slots = constellationStars(c).filter((s) => s.which === which);
  let slot = slots.find((s) => s.unlocked && !s.lit);
  if (!slot) slot = [...slots].reverse().find((s) => s.unlocked) || slots[0];
  if (!slot) return;
  _enterUV(c);
  window._uvStar = { which, slot: slot.i, discipline: slot.discipline, suf: slot.suffix };
  startGame('uvslot');
}

// ── Live-Fortschritt im Spiel (progressForCurrentMode in game.js) ────────────
// Slot-Runde → genau das aktive Teil-Suffix. Fallback: ganze Waffe.
export function uvProgress() {
  const ws = _ws();
  const star = window._uvStar;
  let sufs;
  if (star && star.suf) sufs = [star.suf];
  else if (star && star.which) sufs = Array.from({ length: SLOTS_PER_FORM }, (_, i) => _slotSuf(star.which, i));
  else sufs = [];
  const verbs = (window.VOCAB || []).filter((v) => v.forms);
  let score = 0, mastered = 0;
  const total = verbs.length * sufs.length;
  for (const v of verbs) {
    for (const suf of sufs) {
      const s = ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)];
      if (!s || !s.asked) continue;
      const asked = s.asked, pct = effectivePct(s);
      if (Math.floor(asked) >= 3 && pct >= 0.9) { score += 1; mastered += 1; }
      else if (asked >= 1) score += Math.max(0, (pct - 0.5) * 2) * Math.min(asked / 3, 1) * 0.85;
    }
  }
  return { score, mastered, total };
}

// Pro-Wort-Liste (Wörter-Dropdown): gemeisterte Teile getrennt nach Past/PP (je x/5).
export function constellationWords(c) {
  const ws = _ws();
  const cnt = (v, which) => {
    let m = 0;
    for (let i = 0; i < SLOTS_PER_FORM; i++) if (isStatMastered(ws[statKeyFor(v.de, v.en, _slotSuf(which, i), IRREGULAR_PRESET_ID)])) m++;
    return m;
  };
  return c.verbs.map((v) => {
    const pm = cnt(v, 'past'), ppm = cnt(v, 'pp');
    return {
      de: v.de, en: v.en,
      past: { mastered: pm, total: SLOTS_PER_FORM },
      pp:   { mastered: ppm, total: SLOTS_PER_FORM },
      mastered: pm + ppm, total: 2 * SLOTS_PER_FORM,
    };
  });
}

// ── Lernstand-Übersicht (Kopfzeile der Schmiede) ─────────────────────────────
export function uvLernstand() {
  const map = uvMap();
  let complete = 0, totalLit = 0;
  const rows = map.map((m) => {
    const lit = m.stars.filter((s) => s.lit).length;   // 0..10
    totalLit += lit;
    if (m.complete) complete++;
    return { name: m.c.name, cefr: m.c.cefr, count: m.c.verbs.length, lit, total: 2 * SLOTS_PER_FORM, complete: m.complete, unlocked: m.unlocked, words: constellationWords(m.c) };
  });
  return { total: map.length, complete, totalLit, maxLit: map.length * 2 * SLOTS_PER_FORM, rows };
}
