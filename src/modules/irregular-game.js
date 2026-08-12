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
import { effectivePct, statKeyFor } from './stats.js';
import { UV_MASTERY_MIN_ATTEMPTS, MASTERY_THRESHOLD } from './config.js';
import { irregularAsVocab, getConstellations, IRREGULAR_PRESET_ID, UV_TRAIN_SUF, verbsByEns, forgeObject } from './irregular-verbs.js';

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
// Erkennen ×2, Schmieden ×2, Verzaubern ×1. Feste Regeln: Teil 1 IMMER Erkennen
// (man erkennt die Form zuerst), Verzaubern nur in Slot 2–4 (= Teil 3–5), der Rest
// (1× Erkennen, 2× Schmieden) zufällig auf die übrigen Slots.
export function weaponSlots(cIdx, which) {
  const rnd = _seeded(((cIdx + 1) * 73856093) ^ (which === 'pp' ? 19349663 : 0));
  const slots = new Array(SLOTS_PER_FORM);
  slots[0] = 'erkennen';                       // Teil 1 immer Erkennen
  const vPos = 2 + Math.floor(rnd() * 3);      // Verzaubern nur Teil 3–5
  slots[vPos] = 'verzaubern';
  const rest = ['erkennen', 'schmieden', 'schmieden'];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  let r = 0;
  for (let i = 1; i < SLOTS_PER_FORM; i++) if (i !== vPos) slots[i] = rest[r++];
  return slots;
}

// ── Slot-Zustand ──────────────────────────────────────────────────────────────
// Gemeistert in der SCHMIEDE/im TRAINING: eigene, niedrigere Abfrage-Schwelle
// (UV_MASTERY_MIN_ATTEMPTS statt MASTERY_MIN_ATTEMPTS). Ein Waffenteil verlangt
// alle 10 Verben × 5 Teile — mit der Vokabel-Schwelle wären das ~150 richtige
// Antworten je Waffe; die Quote (EMA ≥ 90 %) bleibt unverändert streng.
function _uvMastered(s) {
  return !!s && Math.floor(s.asked || 0) >= UV_MASTERY_MIN_ATTEMPTS && effectivePct(s) >= MASTERY_THRESHOLD;
}

// Ein Slot „leuchtet", wenn jedes Verb der Gruppe in diesem Slot-Suffix sitzt.
export function starLit(verbs, suf) {
  const ws = _ws();
  return verbs.length > 0 && verbs.every((v) => _uvMastered(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)]));
}
export function starProgress(verbs, suf) {
  const ws = _ws(); let m = 0;
  verbs.forEach((v) => { if (_uvMastered(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)])) m++; });
  return { mastered: m, total: verbs.length };
}

// Hat das Kind diese Verbform schon geübt? Schmiede-Slots (_past_s0…) UND
// Trainingsplatz (_tr_…) zusammen — die Kampagne zieht ihre 🌀-Verben danach aus,
// damit der Kampf Wiederholung bleibt und keine Erstbegegnung ist.
export function uvFormPracticed(v, which, minAsked = 2) {
  const ws = _ws();
  for (let i = 0; i < SLOTS_PER_FORM; i++) {
    const s = ws[statKeyFor(v.de, v.en, _slotSuf(which, i), IRREGULAR_PRESET_ID)];
    if (s && Math.floor(s.asked || 0) >= minAsked) return true;
  }
  for (const disc in UV_TRAIN_SUF) {
    const s = ws[statKeyFor(v.de, v.en, UV_TRAIN_SUF[disc][which], IRREGULAR_PRESET_ID)];
    if (s && Math.floor(s.asked || 0) >= minAsked) return true;
  }
  return false;
}

// Teilpunkte EINER Stat aus dem EMA (0..1) + ob sie als gemeistert gilt — die
// Kern-Rechnung hinter _slotScore, auch für Pro-Wort-Listen (uvTrainWords) genutzt.
function _itemScore(s) {
  if (!s || !s.asked) return { score: 0, mastered: false };
  const asked = s.asked;
  if (_uvMastered(s)) return { score: 1, mastered: true };
  const pct = effectivePct(s);
  if (asked >= 1) return { score: Math.max(0, (pct - 0.5) * 2) * Math.min(asked / UV_MASTERY_MIN_ATTEMPTS, 1) * 0.85, mastered: false };
  return { score: 0, mastered: false };
}

// Fortschritt eines Slots als SCORE (Teilpunkte je Verb aus dem EMA) — EXAKT die
// Rechnung wie der In-Game-Balken, damit Übersicht und Spiel denselben % zeigen.
function _slotScore(verbs, suf) {
  const ws = _ws(); let score = 0, mastered = 0;
  for (const v of verbs) {
    const r = _itemScore(ws[statKeyFor(v.de, v.en, suf, IRREGULAR_PRESET_ID)]);
    score += r.score; if (r.mastered) mastered++;
  }
  return { score, mastered, total: verbs.length };
}

// Eine Form ist fertig, wenn alle 5 Slot-Teile leuchten.
export function formComplete(c, which) {
  return weaponSlots(c.idx, which).every((_, i) => starLit(c.verbs, _slotSuf(which, i)));
}

// Freischaltung: jede vom Kind SELBST angelegte Station (= jeder Befüll-Auftrag)
// ist sofort spielbar — kein Vorab-Freispielen der vorigen Station nötig. Innerhalb
// einer Form bleiben die Schritte trotzdem der Reihe nach gestaffelt (constellationStars).
export function constellationUnlocked(idx) {
  return idx >= 0 && idx < getConstellations().length;
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
      out.push({ which, i, discipline: disc, suffix: suf, lit, unlocked, prog: _slotScore(c.verbs, suf) });
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
  window._uvTrain = null;          // Stations-Runde ≠ Trainingsplatz (uvProgress-Routing)
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
  // Merker für die End-Karte: Spielt diese Runde das LETZTE offene Teil eines
  // Gefährten frei? (Gefährten tauchen erst mit allen 5 Teilen in der Tasche auf.)
  const unlocksCompanion = forgeObject(cIdx, which).slot === 'companion'
    && !slot.lit && slots.filter((s) => !s.lit).length === 1;
  window._uvStar = { which, slot: slot.i, discipline: slot.discipline, suf: slot.suffix, unlocksCompanion };
  startGame('uvslot');
}

// ── Trainingsplatz: eine Disziplin über ALLE Verben eines Trainings-Decks ────
// (eigene _tr_-Stats — der Schmiede-Fortschritt bleibt unberührt).
// Deck.vocab hält nur {de,en}; die Formen kommen aus IRREGULAR_VERBS (verbsByEns).
// deck.uvForms steuert die geübten Formen: 'past' = nur Simple Past, 'pp' = nur
// Past Participle, 'both' = beide, 'open' = nach Reset noch nicht gewählt,
// null/undefined = Legacy (beide).
export function uvTrainForms(deck) {
  if (deck && deck.uvForms === 'past') return ['past'];
  if (deck && deck.uvForms === 'pp') return ['pp'];
  return ['past', 'pp'];
}

export function startUvTraining(deckId, disc) {
  if (!UV_TRAIN_SUF[disc]) return;
  const deck = window.SD && window.SD.decks ? window.SD.decks[deckId] : null;
  if (!deck) return;
  if (deck.uvForms === 'open') {
    window.esAlert?.({ icon: '⏱', title: 'Erst Formen wählen', body: 'Wähle auf der Deck-Karte, ob du nur Simple Past oder beide Formen üben willst.' });
    return;
  }
  const verbs = verbsByEns((deck.vocab || []).map((v) => v.en));
  if (!verbs.length) {
    window.esAlert?.({ icon: '🎯', title: 'Keine Verben', body: 'In diesem Trainings-Deck stecken keine unregelmäßigen Verben.' });
    return;
  }
  window.isUV = true;
  window.isSchnellModus = false;
  window._uvConstellation = null;
  window._uvStar = null;
  window._uvTrain = { deckId, disc, forms: uvTrainForms(deck) };
  if (typeof window.VOCAB === 'undefined') window.VOCAB = [];
  window.VOCAB.length = 0;
  verbs.map(irregularAsVocab).forEach((v) => window.VOCAB.push(v));
  startGame('uvtrain');
}

// Trainings-Fortschritt eines Decks je Disziplin — in FORM-Einheiten gerechnet
// (total = Verben × gewählte Formen), damit die Prozente mathematisch stimmen:
// ein „Beide Formen"-Deck mit fertigem Past steht bei 50 %, nicht bei 0 %.
// score = Teilpunkte je Verb (EXAKT dieselbe _slotScore-Rechnung wie der Live-
// Balken im Spiel, s. uvProgress) statt nur ganz-oder-gar-nicht — sonst steht die
// Fortschritt-Seite nach ein paar Runden noch bei 0 %, obwohl schon geübt wurde.
export function uvTrainProgress(deck, disc) {
  const sufs = UV_TRAIN_SUF[disc];
  const forms = uvTrainForms(deck);
  const verbs = verbsByEns(((deck && deck.vocab) || []).map((v) => v.en));
  let score = 0, mastered = 0, total = 0;
  for (const w of forms) {
    const r = _slotScore(verbs, sufs[w]);
    score += r.score; mastered += r.mastered; total += r.total;
  }
  return { score, mastered, total };
}

// Pro-Verb-Liste für den Trainingsplatz (Fortschritt-Seite, aufklappbar): score
// (Teilpunkte, wie die Vokabel-Wortliste den Balken füllt) + gemeisterte Disziplinen
// (Erkennen/Schmieden/Verzaubern) über die gewählten Formen je Verb als x/y-Text.
export function uvTrainWords(deck) {
  const ws = _ws();
  const forms = uvTrainForms(deck);
  const verbs = verbsByEns(((deck && deck.vocab) || []).map((v) => v.en));
  const discs = Object.keys(FORGE_DISC);
  const total = discs.length * forms.length;
  return verbs.map((v) => {
    let score = 0, mastered = 0;
    for (const disc of discs) {
      const sufs = UV_TRAIN_SUF[disc];
      for (const w of forms) {
        const r = _itemScore(ws[statKeyFor(v.de, v.en, sufs[w], IRREGULAR_PRESET_ID)]);
        score += r.score; if (r.mastered) mastered++;
      }
    }
    return { de: v.de, en: v.en, score, mastered, total };
  });
}

// Ein Trainings-Deck fasst genau so viele Verben. Vorher waren 1–15 erlaubt.
export const UV_TRAIN_SIZE = 10;

/**
 * Bestehende Trainings-Decks auf UV_TRAIN_SIZE Verben kürzen.
 *
 * Was dabei NICHT verloren geht:
 * - Taler: liegen in SD.campaign.claimed als deckId|disziplin und werden dort nur
 *   angehängt, nie entfernt (campaign.js refreshClaimedTaler). Ein einmal
 *   freigespielter Taler bleibt also, auch wenn das Deck kleiner wird.
 * - Fortschritt: die Verb-Stände hängen NICHT am Deck, sondern global pro Verb in
 *   SD.globalPresetStats (Schlüssel verb+suffix). Ein entferntes Verb behält seinen
 *   Stand — taucht es später in einem anderen Deck auf, ist er wieder da.
 * - Prozente: uvTrainProgress rechnet live über deck.vocab, passt sich also von
 *   selbst auf die 10 verbleibenden Verben an. Nichts umzurechnen.
 *
 * Welche fliegen raus: die am wenigsten geübten. Der Nutzer sagte "egal welche" —
 * so bleibt aber das Geschaffte erhalten statt weggeworfen zu werden.
 * Decks mit 10 oder weniger Verben bleiben unangetastet (nicht aufgefüllt).
 *
 * Rückgabe: Ids der geänderten Decks (leer = nichts zu tun).
 */
export function migrateUvTrainSize(sd) {
  sd = sd || window.SD;
  const changed = [];
  for (const deck of Object.values((sd && sd.decks) || {})) {
    if ((deck.mode || 'free') !== 'training') continue;
    const vocab = deck.vocab || [];
    if (vocab.length <= UV_TRAIN_SIZE) continue;
    const score = new Map(uvTrainWords(deck).map((w) => [w.en, w.score]));
    const keep = new Set([...vocab]
      .sort((a, b) => (score.get(b.en) || 0) - (score.get(a.en) || 0))
      .slice(0, UV_TRAIN_SIZE)
      .map((v) => v.en));
    deck.vocab = vocab.filter((v) => keep.has(v.en));   // Originalreihenfolge behalten
    changed.push(deck.id);
  }
  return changed;
}

// ── Live-Fortschritt im Spiel (progressForCurrentMode in game.js) ────────────
// Slot-Runde → genau das aktive Teil-Suffix. Fallback: ganze Waffe.
export function uvProgress() {
  const verbs = (window.VOCAB || []).filter((v) => v.forms);
  const tr = window._uvTrain;
  if (tr && UV_TRAIN_SUF[tr.disc]) {   // Trainingsplatz: die gewählten Formen der Disziplin
    const sufs = UV_TRAIN_SUF[tr.disc];
    let score = 0, mastered = 0, total = 0;
    for (const w of (tr.forms || ['past', 'pp'])) {
      const r = _slotScore(verbs, sufs[w]);
      score += r.score; mastered += r.mastered; total += r.total;
    }
    return { score, mastered, total };
  }
  const star = window._uvStar;
  if (star && star.suf) return _slotScore(verbs, star.suf);   // aktuelles Teil (= Overview-%)
  if (star && star.which) {                                   // Fallback: ganze Waffe
    let score = 0, mastered = 0, total = 0;
    for (let i = 0; i < SLOTS_PER_FORM; i++) { const r = _slotScore(verbs, _slotSuf(star.which, i)); score += r.score; mastered += r.mastered; total += r.total; }
    return { score, mastered, total };
  }
  return { score: 0, mastered: 0, total: 0 };
}

// Pro-Wort-Liste (Wörter-Dropdown): gemeisterte Teile getrennt nach Past/PP (je x/5).
export function constellationWords(c) {
  const ws = _ws();
  const cnt = (v, which) => {
    let m = 0;
    for (let i = 0; i < SLOTS_PER_FORM; i++) if (_uvMastered(ws[statKeyFor(v.de, v.en, _slotSuf(which, i), IRREGULAR_PRESET_ID)])) m++;
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

// ── Selbstheilung: verwaiste Stations-Slot-Stats ─────────────────────────────
// Slot-Stats (…|irregular-verbs_past_s0 … _pp_s4) von Verben, die in KEINER
// aktuellen Station stecken, sind Waisen: Beim Auftrag-Löschen älterer Versionen
// war der Cloud-Delete fire-and-forget — schlug er fehl, blieben gemeisterte
// Slots in der Cloud. Ein neuer Auftrag mit denselben Verben stünde sofort auf
// „fertig" (auch in der Freund-Ansicht). Räumt lokal auf und liefert die Keys
// für den Cloud-Delete. Trainingsplatz-Stats (_tr_…) bleiben unberührt.
export function uvPruneOrphanSlotStats() {
  const SD = window.SD;
  if (!SD || !Array.isArray(SD.uvFills)) return [];
  const ws = SD.globalPresetStats?.wordStats;
  if (!ws) return [];
  const valid = new Set();
  for (const c of getConstellations())
    for (const v of c.verbs)
      for (const which of ['past', 'pp'])
        for (let i = 0; i < SLOTS_PER_FORM; i++)
          valid.add(statKeyFor(v.de, v.en, _slotSuf(which, i), IRREGULAR_PRESET_ID));
  const slotSuffix = new RegExp('\\|' + IRREGULAR_PRESET_ID + '_(past|pp)_s\\d+$');
  const orphans = Object.keys(ws).filter((k) => slotSuffix.test(k) && !valid.has(k));
  for (const k of orphans) delete ws[k];
  return orphans;
}

// ── Lernstand-Übersicht (Kopfzeile der Schmiede) ─────────────────────────────
export function uvLernstand() {
  const map = uvMap();
  let complete = 0, totalLit = 0, scoreSum = 0, scoreMax = 0;
  const rows = map.map((m) => {
    const lit = m.stars.filter((s) => s.lit).length;   // 0..10
    const pastLit = m.stars.filter((s) => s.which === 'past' && s.lit).length;   // 0..5
    const ppLit = m.stars.filter((s) => s.which === 'pp' && s.lit).length;       // 0..5
    totalLit += lit;
    if (m.complete) complete++;
    // %-Wert über die SCORE-Teilpunkte aller 10 Slots (wie die Deck-%): so wächst
    // die Anzeige mit jedem geübten Verb, statt erst zu springen, wenn ein ganzer
    // Schritt (= alle Verben gemeistert) fertig ist.
    const score = m.stars.reduce((s, st) => s + ((st.prog && st.prog.score) || 0), 0);
    const smax = m.stars.reduce((s, st) => s + ((st.prog && st.prog.total) || 0), 0);
    scoreSum += score; scoreMax += smax;
    const scorePct = smax > 0 ? Math.min(100, Math.round((score / smax) * 100)) : 0;
    return { idx: m.c.idx, name: m.c.name, cefr: m.c.cefr, count: m.c.verbs.length, lit, pastLit, ppLit, formTotal: SLOTS_PER_FORM, total: 2 * SLOTS_PER_FORM, scorePct, complete: m.complete, unlocked: m.unlocked, words: constellationWords(m.c) };
  });
  const scorePct = scoreMax > 0 ? Math.min(100, Math.round((scoreSum / scoreMax) * 100)) : 0;
  return { total: map.length, complete, totalLit, maxLit: map.length * 2 * SLOTS_PER_FORM, scorePct, rows };
}
