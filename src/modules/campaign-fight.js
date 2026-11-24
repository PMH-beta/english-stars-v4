// src/modules/campaign-fight.js
// Kampf-Wrapper der Kampagne. Ein Knoten = Gegner mit HP; Wellen sind UNBEGRENZT —
// pro Welle ein Minispiel. Erfolg = Gegner erhält Waffenschaden, Misserfolg = Spieler
// verliert HP. Kampf endet bei Gegner-HP 0 (Sieg) oder Spieler-HP 0 (Tod → Run vorbei,
// Einsatz weg — Logik in campaign.js).
//
// Wellen-Mix: ⚔️ zieht zufällig aus Buchstabensturm / Meteoriten / Echo-Fang /
// Stimmt-das; 🌀 aus den drei Verbform-Spielarten (Wirbelsturm = schreiben,
// Formen-Meteoriten und Formen-Echo = auswählen, befüllte Sternbild-Verben aus
// SD.uvFills); 👑 mischt alles. Meteoriten/Echo/Stimmt-das brauchen genug Wörter,
// Echo zusätzlich TTS — sonst fällt die Welle auf den Buchstabensturm zurück.
// Formen-Wellen geben der passenden Waffe +FORM_BONUS (Stahl = Past, Gold = PP).
//
// Fehler beenden ein Minispiel NIE: jeder Fehlgriff kostet HP (_onMiss, STORM_MISS_DMG)
// und die Welle läuft weiter. Verloren ist eine Welle nur, wenn die Zeit ausgeht (bzw.
// der richtige Meteor einschlägt) — dann schlägt zusätzlich der Gegner zu.
//
// Der Kampf führt einen EIGENEN Lernstand je Wort (Stat-Suffix _cf, siehe _record):
// pro Welle ein Eintrag richtig/falsch (Fehlgriffe unterwegs zählen als falsch). Er steuert NUR die Wortauswahl hier und hat
// keinen Einfluss auf Taler, Deck-Prozente oder die Statistik-Seiten — analog zu den
// _tr_-Stats des Trainingsplatzes. Die Vokabel-Stats (_sp) werden weiterhin nur
// GELESEN: als Startwert für die Gewichtung und für den Zeitbonus (+25 % bei
// unsicheren Wörtern). Zwischenstand lebt in run.fight (reitet im profiles.campaign-
// jsonb mit) → Reload mitten im Kampf verliert nichts; nur das aktuelle Wort der
// Welle wird neu gezogen.

import { scaledEnemy, roundTimeFactor, FORM_BONUS, TALISMAN_MULT, PERK_DOLCH_DODGE, STORM_BASE_MS, STORM_PER_LETTER_MS, STORM_MISS_DMG, WEAK_TIME_BONUS, WEAK_EMA, METEOR_FALL_MS, METEOR_COUNT, ECHO_TIME_MS, ECHO_CHOICES, TF_PAIRS, TF_TIME_MS, PERK_SPEER_BOSS, PERK_AXT_ELITE, PERK_HAMMER_MULT, PERK_BOGEN_FIGHT, POTION_HEAL, POTION_POWER, POTION_TIME_MS, POTION_TIME_WAVES, BOSS_WIN_TALER, BOSS_NOCHMAL_TALER, CF_MIN_ASKED, CF_MASTER, CF_NO_REPEAT, CF_SEEN_MIN, CF_LEARNED_WEIGHT, CF_TOPF_MIX, CF_BOGEN_FRUEH_C, CF_BOGEN_SPAET_C, CF_BOGEN_SPAET_W, CF_STUFE_FENSTER, CF_STUFE_HOCH, CF_STUFE_RUNTER, CF_STUFE_MAX, CF_NEU_OFFEN, CF_ABSTAND, CF_W_FAELLIG, CF_W_NICHT_FAELLIG, CF_W_GEUEBT, CF_GEUEBT_TAGE, VERB_OWN_SEEN_MIN, VERB_BOGEN_BIS, VERB_TIER_SPREAD, VERB_TIER_FLOOR, VERB_FILLED_BONUS } from './campaign-balance.js';
import { startLetterstorm, stormTarget } from './minigame-letterstorm.js';
import { startMeteors } from './minigame-meteors.js';
import { startEcho } from './minigame-echo.js';
import { iconHTML } from './pixel-icons.js';
import { startTrueFalse } from './minigame-truefalse.js';
import { equippedWeapon, equipEffects, equippedGearMap, POTIONS, POTION_TON, potionStacks } from './campaign-equipment.js';
import { frageForm, setKnotenKachel } from './minigame-karte.js';
import { STAKE_COST } from './campaign.js';   // nur zur Laufzeit gelesen — der Kreis-Import ist unkritisch
import { pickEnemyKey, enemyName, enemyBattleSVG } from './enemies.js';
import { arenaTag, arenaForRound } from './world.js';
import { ensureAvatar } from './avatar.js';
import { heroCombatSheet, enemyCombatSheet, SpritePlayer, ProjectileLayer } from './pixel-anim.js';
import { gearFor, createPetPlayer, petKind, petColorHex } from './hero.js';
import { playSfx } from './game.js';
import { effectivePct, statKeyFor, heuteTag, kurzSchluessel, statBasis, geuebtTag } from './stats.js';
import { getConstellations, IRREGULAR_VERBS, IRREGULAR_PRESET_ID, verbsByEns } from './irregular-verbs.js';
import { uvFormPracticed } from './irregular-game.js';
import { getPresetCategories } from './vocab.js';
import { markDirty } from './sync.js';
import { zaehleRichtig } from './lernwoche.js';

// Titel in der Kopfleiste: Kachel in der Farbe der Knotenart + Wort (F.1, F.8, F.11).
const _TITLE = {
  fight:     ['sword', 'Übung', 'var(--p-lila)'],
  irregular: ['orb', 'Unregelmäßige', 'var(--p-blau)'],
  boss:      ['bossCrest', 'Boss', 'var(--p-falsch-stark)'],
};
const _titelHTML = (typ) => {
  const [ic, wort, ton] = _TITLE[typ] || _TITLE.fight;
  return `<span class="cf-titel-kachel" style="background:${ton}">${iconHTML(ic, 14)}</span><span class="cf-titel">${wort}</span>`;
};
// Eigene Kachel der Aufgabe bei Unregelmäßigen und Boss (F.8, F.9, F.11); die
// normale Übung zeigt die Kachel der Kampfart.
const _AUFGABE_KACHEL = {
  irregular: { icon: 'orb', ton: 'var(--p-lila)' },
  boss:      { icon: 'bossCrest', ton: 'var(--p-falsch-stark)' },
};
// Rechts in der Kopfleiste (F-63): wo man im Lauf steht und wie lang er ist —
// „Reihe 5 / 13" wie in der Lauf-Karte der Statistik. Ändert sich im Kampf nicht.
const _laufHTML = (run, node) => `Reihe <b>${node.row + 1}</b> / ${run.map?.rows || 13}`;

// Waffen-/Ausrüstungslogik lebt in campaign-equipment.js (equippedWeapon,
// equipEffects) — der Kampf liest sie nur.

// ── Verb-Pool: die selbst befüllten Sternbild-Verben (SD.uvFills) ────────────
function _verbPool() {
  const out = [];
  const seen = new Set();
  for (const c of getConstellations()) {
    for (const v of c.verbs) {
      if (seen.has(v.en)) continue;
      seen.add(v.en);
      out.push(v);
    }
  }
  return out;
}
// campaign.js nutzt das bei der Kartengenerierung: ohne Verben keine 🌀-Knoten.
export function verbsReady() { return _verbPool().length > 0; }

// ── Wortpool: alle eigenen Freier-Modus-Decks gemischt ───────────────────────
// Vorlagen-Wörter aus globalPresetStats, manuelle aus dem jeweiligen Deck
// (SD.wordStats ist nur eine REFERENZ auf das aktive Deck → ein Schreiben ins Deck
// wirkt dort automatisch mit).
//
// Ein Filter: nur Wörter, die im normalen Deck-Üben schon CF_SEEN_MIN-mal dran waren.
// Der Deck-Stand wird NICHT eingefroren — wer mitten im Lauf neue Wörter anlegt und
// zweimal übt, hat sie ab der nächsten Welle im Kampf dabei.
const _MODE_SUF = ['_mc', '_sp', '_pr', '_sp_lu', '_sp_so'];   // mit den Rechtschreib-Teilen (F-71)
function _seenEnough(item) {
  const store = item._presetId ? window.SD?.globalPresetStats?.wordStats : item._deck?.wordStats;
  if (!store) return false;
  for (const suf of _MODE_SUF) {
    const s = store[statKeyFor(item.de, item.en, suf, item._presetId || null)];
    if (s && Math.floor(s.asked || 0) >= CF_SEEN_MIN) return true;
  }
  return false;
}

function _pool() {
  const out = [];
  const decks = window.SD?.decks || {};
  for (const id in decks) {
    const deck = decks[id];
    if ((deck.mode || 'free') !== 'free' || !deck.vocab?.length) continue;
    for (const v of deck.vocab) {
      const item = { de: v.de, en: v.en, _presetId: v._presetId || null, _deck: deck };
      if (_seenEnough(item)) out.push(item);
    }
  }
  return out;
}
// Buchstabensturm = Schreib-Kompetenz → _sp-Stat aus dem Vokabel-Üben (nur gelesen).
function _statOf(item) {
  const key = statKeyFor(item.de, item.en, '_sp', item._presetId);
  return item._presetId ? window.SD?.globalPresetStats?.wordStats?.[key] : item._deck?.wordStats?.[key];
}

// ── Nachschub: alle Vorlagen-Sammlungen als eine flache Wortliste ────────────
// Sortiert leicht → mittel → schwer, darin nach sort_order — in genau dieser
// Reihenfolge rücken die Wörter nach. Einmal geladen beim Öffnen der Kampagne
// (renderCampaign); solange nichts da ist, kämpft man nur mit den eigenen Wörtern.
let _supply = null;
const _DIFF_RANK = { leicht: 0, mittel: 1, schwer: 2 };
// Stufe für die Anpassung (LU-06): B1/B2-Sammlungen (slug b1-/b2-) sind Stufe 3.
const _stufeVon = (c) => (/^b[12]-/.test(c.slug || '') ? 3 : (_DIFF_RANK[c.difficulty] ?? 1));
export async function loadPresetSupply() {
  if (_supply) return _supply;
  let cats = [];
  try { cats = await getPresetCategories(); } catch (e) { cats = []; }
  const out = [];
  const seen = new Set();
  const sorted = [...cats].sort((a, b) =>
    (_stufeVon(a) - _stufeVon(b)) || ((a.sort_order || 0) - (b.sort_order || 0)));
  for (const c of sorted) {
    for (const w of (c.words || [])) {
      const key = (w.en || '').trim().toLowerCase();
      if (!w.de || !key || seen.has(key)) continue;
      seen.add(key);
      out.push({ de: w.de, en: w.en, _presetId: c.id, _deck: null, _stufe: _stufeVon(c) });
    }
  }
  if (out.length) _supply = out;   // leer = nicht cachen, nächster Versuch lädt neu
  return out;
}
// campaign.js prüft das vor dem Kampfstart: ohne eigene Wörter reicht auch der
// Vorlagen-Nachschub, damit der Kampf überhaupt Wörter hat.
export function fightPoolReady() { return _pool().length + (_supply?.length || 0) >= 1; }

// ── Kampf-eigener Lernstand (_cf) ────────────────────────────────────────────
// Getrennt von den Vokabel-Stats: dieselbe Struktur ({asked,correct,wrong,recent}),
// aber eigener Suffix. Verbformen bekommen zusätzlich _past/_pp, damit beide Formen
// eines Verbs einzeln zählen.
const CF_SUF = '_cf';
function _cfKey(item, suf) { return statKeyFor(item.de, item.en, suf || CF_SUF, item._presetId || null); }
function _cfStore(item) {
  return item._presetId ? window.SD?.globalPresetStats?.wordStats : item._deck?.wordStats;
}
function _cfStat(item, suf) { return _cfStore(item)?.[_cfKey(item, suf)]; }
// „Gelernt" = im KAMPF oft genug richtig. Diese Wörter kommen nur noch selten
// (CF_LEARNED_WEIGHT) und ziehen je ein neues Vorlagen-Wort nach.
function _learned(item, suf) {
  const s = _cfStat(item, suf);
  return !!s && Math.floor(s.asked || 0) >= CF_MIN_ASKED && effectivePct(s) >= CF_MASTER;
}
// Wellenergebnis auf das gezogene Wort schreiben. Lokal gespeichert wird über das
// save() der Welle (läuft in jedem Zweig von _onWave); für die Cloud wird nur
// vorgemerkt und erst am Kampfende gemeldet (_markCfDirty) — ein markDirty pro Welle
// würde über dasselbe save() jedes Mal einen Komplett-Upsert ALLER Stat-Zeilen
// auslösen. Bricht die Sitzung mitten im Kampf ab, ist der Stand lokal trotzdem da
// und geht beim nächsten Kampfende mit hoch (Upsert schreibt immer die ganze Map).
function _record(item, ok, suf) {
  if (!item || !_ctx) return;
  const store = _cfStore(item);
  if (!store) return;
  const key = _cfKey(item, suf);
  if (!store[key]) store[key] = { asked: 0, correct: 0, wrong: 0, recent: '' };
  const s = store[key];
  if (!suf && item._stufe != null && !(s.asked > 0)) _stufeBuchen(ok);   // LU-06: erste Begegnung
  s.asked += 1;
  if (ok) { s.correct += 1; zaehleRichtig(1); } else s.wrong += 1;   // LU-14 Wochenziel
  s.recent = ((s.recent || '') + (ok ? '1' : '0')).slice(-8);
  _merkeZeit(item, ok, suf);
  if (item._presetId) _ctx.cfPreset = true;
  else if (item._deck) _ctx.cfDecks.add(item._deck.id);
}
// Am Kampfende in die Sync-Queue legen; geleert wird sie vom _saveCampaign des
// Aufrufers (onEnd → commitDirty).
function _markCfDirty() {
  if (!_ctx || !window.currentUser) return;
  if (_ctx.cfPreset) markDirty('global_preset');
  for (const id of _ctx.cfDecks) markDirty('word_stats', id);
}

// ── Fälligkeit je Kampf-Wort (LU-04) ─────────────────────────────────────────
// SD.campaign.cfZeit: kurzer Schlüssel des _cf-Stats → tag*8 + box. box 0–4 steht für
// den Abstand CF_ABSTAND[box] in Tagen bis zum nächsten Mal. Liegt im campaign-jsonb
// (reitet mit dem Kampf-Speichern mit) statt in den Stat-Einträgen — deren Upload
// kennt nur asked/correct/wrong/recent.
function _zeitKey(item, suf) { return kurzSchluessel(_cfKey(item, suf)); }
function _zeit(item, suf) {
  const v = window.SD?.campaign?.cfZeit?.[_zeitKey(item, suf)];
  return typeof v === 'number' ? { tag: Math.floor(v / 8), box: v % 8 } : null;
}
function _merkeZeit(item, ok, suf) {
  const c = window.SD?.campaign;
  if (!c || typeof c !== 'object') return;
  if (!c.cfZeit || typeof c.cfZeit !== 'object' || Array.isArray(c.cfZeit)) c.cfZeit = {};
  const heute = heuteTag();
  const alt = _zeit(item, suf);
  let box = 0;   // falsch → zurück auf 1 Tag; erstes Mal richtig → 1 Tag
  if (ok && alt) box = alt.tag < heute ? Math.min(CF_ABSTAND.length - 1, alt.box + 1) : alt.box;
  c.cfZeit[_zeitKey(item, suf)] = heute * 8 + box;
}
// Zeit-Faktor fürs Gewicht: fällig bzw. nie im Kampf dran = hoch, gerade dran = sehr
// niedrig. Frisch geübt (Vokabeln/Schmiede/Training) und im Kampf seitdem nicht dran
// = zusätzlich hoch.
function _zeitFaktor(item, suf) {
  const heute = heuteTag();
  const z = _zeit(item, suf);
  const faellig = !z || heute - z.tag >= CF_ABSTAND[Math.min(z.box, CF_ABSTAND.length - 1)];
  let f = faellig ? CF_W_FAELLIG : CF_W_NICHT_FAELLIG;
  const g = geuebtTag(statBasis(statKeyFor(item.de, item.en, '', item._presetId || null)));
  if (g != null && heute - g <= CF_GEUEBT_TAGE && (!z || z.tag < g)) f = CF_W_FAELLIG * CF_W_GEUEBT;
  return { f, faellig };
}

// ── Drei Töpfe (LU-04) ───────────────────────────────────────────────────────
// A = selbst angelegte Deck-Wörter, B = übernommene und geübte Vorlagen-Wörter,
// C = Vorlagen aus Sammlungen, die in keinem Deck stehen (Nachschub). In C sind
// neue Wörter nur aus der aktuellen Stufe (_stufe); ist sie aufgebraucht, aus der
// nächsten darüber, sonst darunter. Schon angefangene C-Wörter bleiben drin. Neue
// C-Wörter kommen nur, solange weniger als CF_NEU_OFFEN angefangen und nicht gelernt
// sind. `pool` (A+B+angefangene C, bei Bedarf mit neuen C aufgefüllt) liefert die
// Falschantworten und entscheidet, welche Wellenarten genug Wörter haben.
function _runde() { return Math.max(0, _ctx?.round || 0) + 1; }
function _stock() {
  const a = [], b = [];
  for (const v of _pool()) (v._presetId ? b : a).push(v);
  const inDeck = new Set();
  const decks = window.SD?.decks || {};
  for (const id in decks) for (const v of (decks[id].vocab || [])) if (v._presetId) inDeck.add(v._presetId);
  const begonnen = [], jeStufe = [];
  let offen = 0, deckStufe = 0;
  for (const v of (_supply || [])) {
    if (inDeck.has(v._presetId)) { deckStufe = Math.max(deckStufe, v._stufe); continue; }
    const st = _cfStat(v);
    if (st && (st.asked || 0) > 0) { begonnen.push(v); if (!_learned(v)) offen++; }
    else (jeStufe[v._stufe] ||= []).push(v);
  }
  const stufe = _supply?.length ? _stufe(deckStufe) : 0;   // ohne Vorlagen nichts festlegen
  let neu = [];
  for (const s of [stufe, stufe + 1, stufe + 2, stufe + 3, stufe - 1, stufe - 2, stufe - 3]) {
    if (jeStufe[s]?.length) { neu = jeStufe[s]; break; }
  }
  const c = offen < CF_NEU_OFFEN ? begonnen.concat(neu) : begonnen;
  const pool = a.concat(b, begonnen);
  for (let i = 0; pool.length < 20 && i < neu.length; i++) pool.push(neu[i]);
  return { a, b, c, pool };
}

// ── Stufe der neuen Wörter (LU-06) ───────────────────────────────────────────
// SD.campaign.cfStufe = { s: 0–3, r: '1011…' } — r = erste Antworten auf neue Wörter
// (1 = richtig), höchstens CF_STUFE_FENSTER Zeichen. Fehlt s (Altstand, neues Konto),
// startet die Stufe bei der schwersten Vorlage in einem eigenen Deck.
function _stufe(deckStufe = 0) {
  const c = window.SD?.campaign;
  const st = c?.cfStufe;
  if (st && Number.isInteger(st.s)) return Math.max(0, Math.min(CF_STUFE_MAX, st.s));
  const s = Math.min(CF_STUFE_MAX, deckStufe);
  if (c && typeof c === 'object') c.cfStufe = { s, r: '' };
  return s;
}
function _stufeBuchen(ok) {
  const c = window.SD?.campaign;
  if (!c || typeof c !== 'object') return;
  const s = _stufe();
  let r = ((c.cfStufe?.r || '') + (ok ? '1' : '0')).slice(-CF_STUFE_FENSTER);
  let neu = s;
  if (r.length >= CF_STUFE_FENSTER) {
    const richtig = r.split('').filter((x) => x === '1').length;
    if (richtig >= CF_STUFE_HOCH && s < CF_STUFE_MAX) neu = s + 1;
    else if (richtig <= CF_STUFE_RUNTER && s > 0) neu = s - 1;
    if (neu !== s) r = '';
  }
  c.cfStufe = { s: neu, r };
}

// Anteile der Töpfe für die aktuelle Welle: nach Runde (CF_TOPF_MIX) und Spannungsbogen
// je Karte (erstes Drittel der Reihen: weniger Neues, letztes Drittel: mehr Neues,
// Fälliges und Schwaches wiegt mehr).
function _topfMix() {
  const runde = _runde();
  const m = CF_TOPF_MIX.find((x) => runde <= x.bis) || CF_TOPF_MIX[CF_TOPF_MIX.length - 1];
  let { a, b, c } = m;
  const rows = _ctx?.run?.map?.rows || 0, row = _ctx?.node?.row ?? 0;
  let phase = 'mitte';
  if (rows) phase = row < rows / 3 ? 'frueh' : (row >= rows * 2 / 3 ? 'spaet' : 'mitte');
  if (phase === 'frueh') { const d = c * (1 - CF_BOGEN_FRUEH_C); c -= d; a += d; }
  else if (phase === 'spaet') { const d = Math.min(a, CF_BOGEN_SPAET_C); a -= d; c += d; }
  return { a, b, c, spaet: phase === 'spaet' };
}
// Topf auswürfeln; leere Töpfe geben ihren Anteil an die anderen ab.
function _waehleTopf(toepfe, mix) {
  const keys = ['a', 'b', 'c'].filter((k) => toepfe[k].length);
  if (!keys.length) return [];
  let r = Math.random() * keys.reduce((sum, k) => sum + mix[k], 0);
  for (const k of keys) { r -= mix[k]; if (r < 0) return toepfe[k]; }
  return toepfe[keys[keys.length - 1]];
}

// Kurzzeit-Gedächtnis über Kampfgrenzen hinweg (nur Sitzung, nichts gespeichert):
// die zuletzt gezogenen Wörter bzw. Verben fallen aus der nächsten Ziehung. Ohne das
// konnte dieselbe Handvoll über mehrere Kämpfe hinweg immer wieder drankommen — die
// Gewichtung allein zieht schwache Wörter ja gerade absichtlich wieder hoch.
const _recent = [];
const _recentV = [];
function _fresh(list, seen) {
  const out = list.filter((v) => !seen.includes(v.en));
  return out.length >= 2 ? out : list;   // zu wenig übrig → lieber wiederholen als nichts
}
function _remember(seen, en) {
  if (!en) return;
  seen.push(en);
  while (seen.length > CF_NO_REPEAT) seen.shift();
}

// Zeitlimit: Grundzeit + Zuschlag pro Buchstabe ab dem 6.; unsichere Deck-Wörter
// (nie/kaum geübt oder EMA < 0.5) bekommen +25 %. Verb-Wellen nutzen nur die
// Buchstaben-Formel (kein Deck-Stat).
function _lettersMs(en) {
  const letters = stormTarget(en).replace(/ /g, '').length;
  return STORM_BASE_MS + Math.max(0, letters - 5) * STORM_PER_LETTER_MS;
}
function _timeLimit(item) {
  let ms = _lettersMs(item.en);
  const s = _statOf(item);
  const weak = !s || Math.floor(s.asked || 0) < 3 || effectivePct(s) < WEAK_EMA;
  if (weak) ms = Math.round(ms * (1 + WEAK_TIME_BONUS));
  return ms;
}

// Erste /-Alternative fürs Anzeigen/Sprechen (Meteoriten/Echo zeigen ganze Wörter).
function _displayEn(en) { return (en || '').split('/')[0].trim(); }

// n falsche Antworten aus dem Pool (einzigartig, ≠ richtige Antwort).
function _distractors(pool, correct, n) {
  const seen = new Set([correct]);
  const cands = [];
  for (const v of pool) {
    const w = _displayEn(v.en);
    if (seen.has(w)) continue;
    seen.add(w);
    cands.push(w);
  }
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  return cands.slice(0, n);
}

function _shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// ── Kampf-Lifecycle ──────────────────────────────────────────────────────────
let _ctx = null;   // { run, node, enemy, weapon, save, onEnd, mg, round }

// onEnd(result): 'victory' | 'death' | 'retreat' (X-Knopf: alles von vorn, F-78/F-84) | null
// (interner Nicht-Fall, z. B. Wortpool beim Laden leer). stat(key) zählt einen
// Kampagnen-Statistikwert hoch (die Zähler selbst liegen in campaign.js).
// LU-08: 'nochmal' = am Boss verloren und für Taler weitergekämpft; kannNochmal()
// sagt, ob genug Taler da sind; enemyKey hält dabei denselben Boss.
export function openFight({ run, node, save, onEnd, round, stat, kannNochmal, enemyKey: festKey }) {
  // M1: Ein Doppeltipp auf den Knoten öffnete den Kampf ein zweites Mal — das erste
  // Minispiel lief mit seinem Takt weiter (Geister-Zeitablauf). Steht der Kampf
  // schon, bleibt es bei ihm; ein verwaister Rest ohne Overlay wird abgeräumt.
  if (_ctx && _el('cf-overlay')) return;
  if (_ctx) { try { _ctx.mg?.destroy(); } catch (e) {} _destroyPlayers(); _ctx = null; }
  const enemy = scaledEnemy(node.type, round);
  if (!run.fight || run.fight.nodeId !== node.id) {
    // headUsed/guardsUsed = Zähler; shield/power/timeBoost = aktive Trank-Effekte.
    run.fight = { nodeId: node.id, type: node.type, enemyHp: enemy.hp, enemyHpMax: enemy.hp, wave: 1, headUsed: 0, guardsUsed: 0, shield: false, power: 0, timeBoost: 0 };
    save();
  }
  // cfPreset/cfDecks merken sich, welche Stat-Töpfe der Kampf angefasst hat (siehe
  // _record/_markCfDirty).
  // enemyKey = welcher der 36 Gegner auftritt. Bleibt für den ganzen Kampf gleich,
  // liegt aber bewusst NUR hier und nicht im Spielstand — wie bisher wird beim
  // Fortsetzen eines Kampfes neu gewürfelt.
  const enemyKey = festKey || pickEnemyKey(node.type);
  // Kampf-Blaetter EINMAL beim Laden bauen (Handoff-Regel 6) - ein Helden-Blatt
  // kostet rund 110 ms, beim ersten Angriff waere das ein sichtbarer Haenger.
  const heroCfg = { ...ensureAvatar(window.SD), gear: gearFor(equippedGearMap()) };
  _ctx = { run, node, enemy, enemyKey, heroCfg, kannNochmal,
    heroSheet: heroCombatSheet(heroCfg), enemySheet: enemyCombatSheet(enemyKey),
    players: null, layer: null,
    weapon: equippedWeapon(), eff: equipEffects(), save, onEnd, stat, mg: null, round, cfPreset: false, cfDecks: new Set() };
  _renderOverlay();
  _startWave();
}

// ── Tränke im Kampf ──────────────────────────────────────────────────────────
// Gleiche Tränke liegen als EIN Feld mit kleiner Anzahl in der Ecke; der Klick
// verbraucht den ersten dieser Sorte (stack.index).
function _renderPotions() {
  const el = _el('cf-potions');
  if (!el || !_ctx) return;
  // Kachel in der Trankfarbe mit Pixel-Icon, Anzahl immer sichtbar (7.4).
  el.innerHTML = potionStacks(_ctx.run.potions).map(s =>
    `<button class="cf-potion" data-pi="${s.index}" title="${POTIONS[s.key].name}: ${POTIONS[s.key].desc}" style="background:${POTION_TON[s.key] || 'var(--p-karte)'}">${iconHTML('potion', 14)}<span class="potion-n">${s.count}</span></button>`).join('');
  el.querySelectorAll('[data-pi]').forEach(btn => { btn.onclick = () => _usePotion(+btn.dataset.pi); });
}

function _usePotion(i) {
  if (!_ctx || (_ctx.vorbei && _ctx.run.hp <= 0)) return;   // M5: nach „Lauf vorbei“ kein Trank mehr
  const { run, save } = _ctx;
  const f = run.fight;
  const key = (run.potions || [])[i];
  const p = POTIONS[key];
  if (!key || !p || !f) return;
  run.potions.splice(i, 1);
  _ctx.stat?.('potions');   // Statistik: getrunkene Tränke (Fortschritt-Seite)
  // Wirkung als Popup über dem eigenen Character (wie Schaden über dem Gegner) —
  // beim Heiltrank die TATSÄCHLICH geheilte Menge (gedeckelt an hpMax).
  if (key === 'heal') {
    const before = run.hp;
    run.hp = Math.min(run.hpMax, run.hp + POTION_HEAL);
    _setBars();
    _damagePop('cf-hero', '+' + (run.hp - before), '#69db7c');
  } else {
    if (key === 'shield') f.shield = true;
    else if (key === 'power') f.power = (f.power || 0) + POTION_POWER;
    else if (key === 'time') f.timeBoost = (f.timeBoost || 0) + POTION_TIME_WAVES;
    _damagePop('cf-hero', `${iconHTML('potion', 14)}${p.name}`, '#69db7c', true);
  }
  try { playSfx('streak'); } catch (e) {}
  save();
  _renderPotions();
}

function _el(id) { return document.getElementById(id); }

// Kleine Bildschirme: unter 390 × 780 wird der ganze Kampf verkleinert, als wäre der
// Bildschirm mindestens 390 × 780 groß — darunter wird es für Bühne (Boss bis
// Mitte + 187 px), Spielfeld und lange Wörter eng. Der Faktor rastet so ein, dass ein Bildpunkt der Figuren und
// des Kampfplatzes (2 CSS-px) auf ganze Geräte-Pixel fällt — die Pixel-Art bleibt
// scharf. --cf-h = Höhe, mit der das Layout rechnet (Richtig/Falsch, style.css).
const _MIN_W = 390, _MIN_H = 780;
let _zoom = 1;
function _passeGroesse() {
  const ov = _el('cf-overlay');
  if (!ov) return;
  const w = window.innerWidth, h = window.innerHeight;
  const max = Math.min(1, w / _MIN_W, h / _MIN_H);
  _zoom = 1;
  if (max < 1) {
    const dpr = window.devicePixelRatio || 1;
    const n = Math.floor(2 * dpr * max);
    _zoom = n >= 1 ? n / (2 * dpr) : max;
  }
  const klein = _zoom < 1;
  ov.style.inset = klein ? '0 auto auto 0' : '0';
  ov.style.width = klein ? (w / _zoom) + 'px' : '';
  ov.style.height = klein ? (h / _zoom) + 'px' : '';
  ov.style.transform = klein ? `scale(${_zoom})` : '';
  ov.style.transformOrigin = '0 0';
  ov.style.setProperty('--cf-h', (h / _zoom) + 'px');
}

// Kampfplatz (Update 1: fertiges Bild, fest 2×, unten mittig). Welcher erscheint,
// haengt an der RUNDE: Wiese, Abend, Kerker, Kristall, Vulkan, Friedhof — die
// Kampagne wird mit jedem Durchlauf sichtbar tiefer, ohne dass die Kulisse
// innerhalb eines Laufs springt.
function _arenaScene(round) { return arenaTag(arenaForRound(round)); }

// Kampf-Szene wie die ursprüngliche Kampagnen-Version: dunkler Violett-Verlauf,
// Kartenlogik und Sprites bleiben; die Bedienoberflaeche traegt seit dem
// Pastell-Redesign Kontur und Pixelsymbole. Der Show-Teil oben ist Pixel-Art:
// die Landschafts-Arena mit Spieler (links) und Gegner (rechts).
function _renderOverlay() {
  _removeOverlay();
  const { run, node, enemy, weapon, enemyKey } = _ctx;
  const f = run.fight;
  const ov = document.createElement('div');
  ov.id = 'cf-overlay';
  ov.className = 'p-sperrt';   // Hintergrund scrollt nicht mit (main.js)
  ov.style.cssText = 'position:fixed;inset:0;z-index:8000;background:#bfe6ff;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;';
  // Aufbau nach den Fragmenten F.1–F.11 (Update 1): Kulisse als Hintergrund,
  // Kopfleiste, die Mitte (Aufgabe + Spielfeld, befüllt vom Minispiel), unten die
  // Bühne mit Held und Gegner und der dunklen Statusleiste mit beiden
  // Lebensbalken. Tränke und Waffenschaden stehen auf der Seite des Helden, der
  // Schaden des Gegners auf seiner.
  const boss = node.type === 'boss';
  const esc = (s) => (window.escHtml ? window.escHtml(String(s)) : String(s));
  ov.innerHTML = `
    <div class="cf-scenery">${_arenaScene(_ctx.round)}</div>
    <div class="cf-kopf">
      <button id="cf-flee" class="cf-rund" title="Zurückgehen (von vorne beginnen)">${iconHTML('close', 14)}</button>
      <div class="cf-kopfleiste">
        ${_titelHTML(node.type)}
        <span class="cf-welle">${_laufHTML(run, node)}</span>
      </div>
    </div>
    <div id="cf-stage" class="cf-mitte"></div>
    <div class="cf-buehne">
      <canvas class="cf-flug" id="cf-flug"></canvas>
      <div class="cf-hero" id="cf-hero"><div class="cf-pet" id="cf-pet"></div></div>
      <div class="cf-feind-platz${boss ? ' boss' : ''}"><div class="cf-enemy${boss ? ' boss' : ''}" id="cf-enemy"></div></div>
      <div class="cf-leiste">
        <div class="cf-leiste-seite">
          <div class="cf-leiste-kopf">
            <span class="cf-leiste-name">${esc(window.SD?.playerName || 'Leben')}</span>
            <span class="cf-leiste-zahl"><span id="cf-php">${run.hp}</span><span class="cf-leiste-max">/${run.hpMax}</span></span>
          </div>
          <div class="cf-leiste-balken"><i id="cf-phpbar" style="width:${run.hp / run.hpMax * 100}%"></i></div>
          <div class="cf-leiste-fuss">
            <div id="cf-potions" class="cf-traenke"></div>
            <span class="cf-waffe" title="${esc(weapon.name)}">${iconHTML('sword', 14)}${weapon.dmg}</span>
          </div>
        </div>
        <div class="cf-leiste-seite cf-leiste-seite--feind">
          <div class="cf-leiste-kopf">
            <span class="cf-leiste-name">${esc(enemyName(enemyKey) || enemy.name)}</span>
            <span class="cf-leiste-zahl"><span id="cf-ehp">${f.enemyHp}</span><span class="cf-leiste-max">/${f.enemyHpMax}</span></span>
          </div>
          <div class="cf-leiste-balken"><i id="cf-ehpbar" style="width:${f.enemyHp / f.enemyHpMax * 100}%"></i></div>
          <div class="cf-leiste-fuss"><span class="cf-waffe cf-waffe--feind" title="Schaden des Gegners">${iconHTML('sword', 14)}${enemy.dmg}</span></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _passeGroesse();
  window.addEventListener('resize', _passeGroesse);
  // Erst jetzt zeichnen: renderAvatarInto misst den Container, um die Figur
  // ganzzahlig zu skalieren (Handoff-Regel 6). Vor dem Einhaengen hat .cf-hero
  // noch keine Groesse.
  _buildPlayers();
  _el('cf-flee').onclick = () => {
    // Zurückgehen (F-78/F-84/F-85, Wunsch des Nutzers 09.10.2026): alles von vorn,
    // Taler bleiben, Tränke verfallen (LU-09) — die Folgen regelt campaign.js (onEnd 'retreat').
    // Vorher fragen; die Welle pausiert währenddessen, der Hintergrund ist unscharf
    // (style.css). Der sichere Weg (Weiterkämpfen) ist der hervorgehobene Knopf.
    if (_ctx?.mg?.pause) _ctx.mg.pause();
    const leave = () => _close('retreat');
    // Dialog wie Fragment 7.14 (Text ohne Vondu-Kasten), Emblem Zurück-Pfeil statt
    // Totenkopf — Taler verliert man nicht.
    const d = document.createElement('div');
    d.className = 'p-dlg-grund cf-weg-grund';
    d.innerHTML = `<div class="p-dlg-karte cf-weg-karte">
        <div class="cf-ende-emblem" style="background:var(--p-inaktiv)">${iconHTML('back', 42)}</div>
        <div class="cf-weg-titel">Zurückgehen?</div>
        <div class="cf-weg-text">Dann fängst du ganz von vorne an: neue Karte, Runde 1. Deine Tränke sind weg, deine Taler behältst du.</div>
        <div class="cf-weg-knoepfe">
          <button class="cf-weg-btn" data-weg="1">Zurückgehen</button>
          <button class="cf-weg-btn cf-weg-btn--bleib" data-weg="0">Weiterkämpfen</button>
        </div>
      </div>`;
    let entschieden = false;
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-weg]');
      if (!b) return;
      entschieden = true;
      d.remove();
      if (b.dataset.weg === '1') leave();
      else if (_ctx?.mg?.resume) _ctx.mg.resume();
    });
    // Schließt der Zurück-Knopf (Android) den Dialog, geht der Kampf weiter — sonst
    // bliebe die Welle für immer „pausiert“.
    const beob = new MutationObserver(() => {
      if (d.isConnected) return;
      beob.disconnect();
      if (!entschieden && _ctx?.mg?.resume) _ctx.mg.resume();
    });
    beob.observe(document.body, { childList: true });
    document.body.appendChild(d);
  };
  _renderPotions();
}

// ── Figuren im Kampf ────────────────────────────────────────────────────────
// Held, Gegner und Gefaehrte laufen ueber SpritePlayer bzw. createPetPlayer.
// Massstab am Container gemessen, damit er ganzzahlig bleibt: der Held misst
// ruhend 54 x 87, der Gegner 72 x 78 (Boss 96 x 102).
function _buildPlayers() {
  if (!_ctx) return;
  const heroEl = _el('cf-hero'), enemyEl = _el('cf-enemy'), petEl = _el('cf-pet'), flug = _el('cf-flug');
  if (!heroEl || !enemyEl) return;
  const boss = _ctx.node.type === 'boss';
  const hs = Math.max(1, Math.round(heroEl.clientWidth / 54));
  const es = Math.max(1, Math.round(enemyEl.clientWidth / (boss ? 96 : 72)));
  const hero = new SpritePlayer(document.createElement('canvas'), _ctx.heroSheet, { scale: hs });
  heroEl.insertBefore(hero.cv, petEl || null);
  let feind = null;
  if (_ctx.enemySheet) { feind = new SpritePlayer(document.createElement('canvas'), _ctx.enemySheet, { scale: es }); enemyEl.appendChild(feind.cv); }
  else enemyEl.innerHTML = enemyBattleSVG(_ctx.enemyKey);   // Notnagel ohne Kampf-Blatt
  // Gefaehrte nur, wenn einer geschmiedet und angelegt ist - seine Wirkung
  // (COMPANION_GUARDS) haengt unveraendert an der Ausruestung, nicht am Bild.
  let pet = null;
  const gm = equippedGearMap();
  if (petEl && gm && gm.companion) {
    const a = ensureAvatar(window.SD);
    pet = createPetPlayer(petEl, petKind(a.pet), petColorHex(a.pet, a.petColor), hs, gm.companion.which === 'pp');   // Holo-Fell F-97
  }
  _ctx.players = { hero, feind, pet };
  if (flug) { try { _ctx.layer = new ProjectileLayer(flug, { scale: hs }); } catch (e) { _ctx.layer = null; } }
  // Ist der Kampf verkleinert (_passeGroesse), misst toLocal am Bildschirm um _zoom zu
  // klein — Abstand hier zurückrechnen, sonst landet der Pfeil neben dem Ziel.
  const layer = _ctx.layer;
  if (layer) layer.toLocal = (player, pt) => {
    const a = player.cv.getBoundingClientRect(), b = layer.cv.getBoundingClientRect(), s = layer.scale;
    return { x: (a.left - b.left) / _zoom / s + pt.x * player.scale / s, y: (a.top - b.top) / _zoom / s + pt.y * player.scale / s };
  };
}

function _destroyPlayers() {
  const p = _ctx && _ctx.players;
  if (!p) return;
  p.hero?.destroy(); p.feind?.destroy(); p.pet?.destroy();
  _ctx.players = null; _ctx.layer = null;
}

function _setBars() {
  const { run } = _ctx;
  const f = run.fight;
  if (f) {
    const e = _el('cf-ehp'), eb = _el('cf-ehpbar');
    if (e) e.textContent = f.enemyHp;
    if (eb) eb.style.width = (f.enemyHp / f.enemyHpMax * 100) + '%';
  }
  const p = _el('cf-php'), pb = _el('cf-phpbar');
  if (p) p.textContent = run.hp;
  if (pb) pb.style.width = (run.hp / run.hpMax * 100) + '%';
}

// Schadenszahl über dem Getroffenen (F.2, F.3, E.6): groß, mit Tintenkontur,
// steigt 12 Takte lang und blendet aus. Schaden ist immer rot (auch der eigene
// Treffer am Gegner), Heilung und Tränke grün. `html` darf Pixel-Icons enthalten;
// `text` = Wort statt Zahl (Trank-Name) in der kleineren Knopf-Stufe (E.1).
const _POP_TON = { '#c084fc': 'var(--p-falsch-stark)', '#ff8787': 'var(--p-falsch-stark)', '#69db7c': 'var(--p-richtig)' };
function _damagePop(overId, html, color, text = false) {
  const arena = document.querySelector('.cf-buehne');
  const over = _el(overId);
  if (!arena || !over) return;
  const a = arena.getBoundingClientRect(), o = over.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'cf-dmg' + (text ? ' cf-dmg--text' : '');
  s.innerHTML = html;
  s.style.color = _POP_TON[color] || 'var(--p-falsch-stark)';
  s.style.left = ((o.left - a.left + o.width / 2) / _zoom) + 'px';
  s.style.top = ((o.top - a.top) / _zoom - 6) + 'px';
  arena.appendChild(s);
  setTimeout(() => s.remove(), 1500);
}

// Schutz-Meldung über der Figur (Fragment 6.8, N41): Karte mit Symbol, Titel und
// Grund, kurz eingeblendet. Ersetzt die frühere Textzeile „Block!".
function _schutzMeldung(icon, titel, grund, ton) {
  const buehne = document.querySelector('.cf-buehne');
  if (!buehne) return;
  buehne.querySelector('.cf-schutz')?.remove();
  const d = document.createElement('div');
  d.className = 'cf-schutz';
  d.style.background = ton;
  d.innerHTML = `${iconHTML(icon, 28)}<div><div class="cf-schutz-titel">${titel}</div><div class="cf-schutz-grund">${grund}</div></div>`;
  buehne.appendChild(d);
  setTimeout(() => d.remove(), 1600);
}

// Aufschlag-Splitter: ein paar Pixel fliegen vom Getroffenen weg (CSS .cf-spark,
// Richtung/Weite je Splitter über --dx/--dy). Kurz, hart gesteppt, kein Glow.
function _impactBurst(overId, color) {
  const arena = document.querySelector('.cf-buehne');
  const over = _el(overId);
  if (!arena || !over) return;
  const a = arena.getBoundingClientRect(), o = over.getBoundingClientRect();
  const cx = (o.left - a.left + o.width / 2) / _zoom, cy = (o.top - a.top + o.height * 0.45) / _zoom;
  for (let i = 0; i < 7; i++) {
    const ang = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
    const dist = 16 + Math.random() * 18;
    const s = document.createElement('span');
    s.className = 'cf-spark';
    s.style.background = color;
    s.style.left = Math.round(cx) + 'px';
    s.style.top = Math.round(cy) + 'px';
    s.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
    s.style.setProperty('--dy', Math.round(Math.sin(ang) * dist - 10) + 'px');
    arena.appendChild(s);
    setTimeout(() => s.remove(), 460);
  }
}

// Ein Schlagabtausch. Der Angreifer spielt seinen Angriff; SCHADEN, LEBENSLEISTE
// und TON haengen am Treffer-Bild (onHit), nicht am Start des Angriffs
// (Handoff-Regel 6). Bei Bogen und Stab feuert onHit erst beim Einschlag des
// Geschosses - dafuer bekommt der Spieler `target` und die Pfeil-Ebene mit.
// `treffer` wendet den Schaden an, `danach` laeuft, wenn der Angriff durch ist.
function _strike(wer, dmgText, color, treffer, danach) {
  const p = _ctx && _ctx.players;
  const held = wer === 'hero';
  const ziel = held ? 'cf-enemy' : 'cf-hero';
  if (!p || !p.hero) {   // ohne Figuren (Notnagel): Schaden sofort, ohne Animation
    treffer(); _damagePop(ziel, dmgText, color); if (danach) danach();
    return;
  }
  const angreifer = held ? p.hero : p.feind;
  const getroffen = held ? p.feind : p.hero;
  const onHit = () => {
    treffer();
    _damagePop(ziel, dmgText, color);
    _impactBurst(ziel, color);
    getroffen?.play('hurt');
    if (!held) p.pet?.play('hurt');   // der Gefaehrte zuckt mit
  };
  if (!angreifer) { onHit(); if (danach) danach(); return; }
  // Waehrend des Angriffs liegen Held und Gefaehrte vor dem Gegner.
  const heroEl = _el('cf-hero');
  if (held && heroEl) heroEl.classList.add('vorn');
  if (held) p.pet?.play('attack');
  angreifer.play('attack', {
    target: getroffen, layer: _ctx.layer,
    onHit,
    onEnd: () => { if (held && heroEl) heroEl.classList.remove('vorn'); if (danach) danach(); },
  });
}

// Fehlgriff in EINEM Minispiel (falscher Buchstabe, falscher Meteor, falsches Wort,
// Fehlurteil): kostet direkt HP, die Welle läuft aber weiter — kein Minispiel bricht
// mehr beim ersten Fehler ab. Kann mitten in der Welle zum Tod führen; dann bricht der
// Kampf sofort ab statt erst am Wellenende. waveMiss merkt sich den Fehler für den
// Lernstand: eine mit Fehlgriffen zu Ende gebrachte Welle zählt nicht als „gewusst".
function _onMiss() {
  if (!_ctx) return;
  const { run, save } = _ctx;
  _ctx.waveMiss = true;
  run.hp = Math.max(0, run.hp - STORM_MISS_DMG);
  _setBars();
  _ctx.players?.hero?.play('hurt');
  _ctx.players?.pet?.play('hurt');
  _impactBurst('cf-hero', '#ff8787');
  _damagePop('cf-hero', '−' + STORM_MISS_DMG, '#ff8787');
  save();
  if (run.hp <= 0) {
    if (_ctx.mg) _ctx.mg.destroy();
    _endScreen(false);
  }
}


// Gewicht = Schwäche × Zeit. Schwäche wie die Leiter in weightedPickUnique (game.js):
// gezählt wird der Kampf-Stat, solange der leer ist, hilft der Vokabel-Stat aus;
// gelernte Wörter fallen auf CF_LEARNED_WEIGHT. Zeit siehe _zeitFaktor. Im letzten
// Drittel der Karte zählen Fälliges und Schwaches CF_BOGEN_SPAET_W-fach.
function _schwaeche(item, suf) {
  if (_learned(item, suf)) return CF_LEARNED_WEIGHT;
  const s = _cfStat(item, suf) || (suf ? null : _statOf(item));
  if (!s || (s.asked || 0) < 3) return 3;
  const ep = effectivePct(s);
  if (ep >= 0.9) return 1;
  if (ep >= 0.7) return 3;
  if (ep >= 0.4) return 4;
  return 5;
}
function _weightOf(item, suf, spaet) {
  const base = _schwaeche(item, suf);
  const { f, faellig } = _zeitFaktor(item, suf);
  let w = base * f;
  if (spaet && (faellig || base >= 4)) w *= CF_BOGEN_SPAET_W;
  return w;
}

// Gewichtete Ziehung nach demselben Verfahren wie weightedPickUnique (kleinster
// Schlüssel gewinnt), nur mit eigener Gewichtsfunktion.
function _pickWeighted(list, weightFn) {
  let best = null, bestKey = Infinity;
  for (const item of list) {
    const w = weightFn(item);
    if (!(w > 0)) continue;
    const k = -Math.pow(Math.random(), 1 / w);
    if (k < bestKey) { bestKey = k; best = item; }
  }
  return best;
}

// Ein Wort ziehen: erst den Topf (_topfMix), darin gewichtet (_weightOf), die zuletzt
// gezogenen ausgespart (_fresh).
function _pickItem(stock) {
  const mix = _topfMix();
  const list = _waehleTopf(stock, mix);
  const item = _pickWeighted(_fresh(list, _recent), (v) => _weightOf(v, null, mix.spaet));
  _remember(_recent, item && item.en);
  return item;
}

// Eigene Verben einer Form: alles aus den Schmiede-Aufträgen (Sternbilder) und den
// Trainingsplatz-Decks, das dort schon geübt wurde. Das ist der Vorrat, aus dem der
// Wirbelsturm zuerst zieht — analog zu den eigenen Deck-Wörtern.
function _ownVerbs(which) {
  const seen = new Set();
  const out = [];
  const add = (v) => {
    if (!v || seen.has(v.en)) return;
    seen.add(v.en);
    if (uvFormPracticed(v, which, VERB_OWN_SEEN_MIN)) out.push(v);
  };
  for (const c of getConstellations()) for (const v of c.verbs) add(v);
  const decks = window.SD?.decks || {};
  for (const id in decks) {
    const d = decks[id];
    if ((d.mode || 'free') !== 'training' || !d.vocab?.length) continue;
    for (const v of verbsByEns(d.vocab.map((x) => x.en))) add(v);
  }
  return out;
}

// Form der Welle: hat das Kind nur EINE Form geübt (z. B. Trainingsplatz „nur
// Simple Past"), fragt der Wirbelsturm auch nur die — sonst je zur Hälfte.
function _pickForm() {
  const past = _ownVerbs('past').length, pp = _ownVerbs('pp').length;
  if (past && !pp) return 'past';
  if (pp && !past) return 'pp';
  return Math.random() < 0.5 ? 'past' : 'pp';
}

// 🌀-Verb ziehen — dieselben drei Töpfe wie bei den Wörtern (LU-04):
// A = in Schmiede/Training geübt (_ownVerbs), B = schon im Kampf dran (diese Form),
// C = noch nie dran, höchstens eine Stufe über dem höchsten geübten Verb. In C wandert
// der Stufen-Schwerpunkt bis Runde VERB_BOGEN_BIS von 1 auf 5 (Glocke; leichte Stufen
// bleiben immer möglich, befüllte Sternbild-Verben bevorzugt).
const _verbItem = (v) => ({ de: v.de, en: v.en, _presetId: IRREGULAR_PRESET_ID });
function _pickVerb(which) {
  const suf = CF_SUF + (which === 'pp' ? '_pp' : '_past');
  const a = _ownVerbs(which);
  const eigen = new Set(a.map((v) => v.en));
  const deckel = a.reduce((m, v) => Math.max(m, v.tier || 1), 0) + 1;
  const b = [], c = [];
  for (const v of IRREGULAR_VERBS) {
    if (eigen.has(v.en)) continue;
    const st = _cfStat(_verbItem(v), suf);
    if (st && (st.asked || 0) > 0) b.push(v);
    else if ((v.tier || 1) <= deckel) c.push(v);
  }
  const mix = _topfMix();
  const list = _waehleTopf({ a, b, c }, mix);
  let picked;
  if (list === c) {
    const filled = new Set(_verbPool().map((v) => v.en));
    const center = 1 + 4 * Math.min(1, (_runde() - 1) / Math.max(1, VERB_BOGEN_BIS - 1));
    picked = _pickWeighted(_fresh(c, _recentV), (v) => {
      const d = (v.tier || 1) - center;
      // Mindestgewicht nur nach UNTEN: schon abgehakte Stufen bleiben als Auflockerung
      // immer möglich, während schwerere erst hochkommen, wenn der Schwerpunkt da ist.
      let w = Math.exp(-(d * d) / VERB_TIER_SPREAD);
      if (d < 0) w = Math.max(w, VERB_TIER_FLOOR);
      if (filled.has(v.en)) w *= VERB_FILLED_BONUS;
      return w;
    });
  } else {
    picked = _pickWeighted(_fresh(list, _recentV), (v) => _weightOf(_verbItem(v), suf, mix.spaet));
  }
  _remember(_recentV, picked && picked.en);
  return picked;
}

// Falsche Verbformen für die Auswahl-Wellen (Formen-Meteoriten/-Echo). Reihenfolge der
// Quellen: die ANDERE Form desselben Verbs und die Grundform (die typischen Verwechs-
// lungen), dann die regelmäßig gebildete Falle (go → „goed"), zuletzt dieselbe Form
// fremder Verben. Doppelte und die richtige Antwort fallen raus.
function _regularPast(en) {
  const w = (en || '').toLowerCase();
  if (/e$/.test(w)) return w + 'd';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(w)) return w + w.slice(-1) + 'ed';   // run → runned
  return w + 'ed';
}
function _verbDistractors(v, which, n) {
  // Alle „/“-Schreibweisen sperren (burnt/burned …) — sonst steht die zweite richtige
  // Form als Falschantwort da (K-3).
  const seen = new Set(((which === 'past' ? v.past : v.pp) || '').split('/').map(s => s.trim().toLowerCase()));
  const out = [];
  const add = (form) => {
    const s = _displayEn(form);
    if (!s || out.length >= n || seen.has(s.toLowerCase())) return;
    seen.add(s.toLowerCase());
    out.push(s);
  };
  add(which === 'past' ? v.pp : v.past);
  add(v.en);
  add(_regularPast(v.en));
  for (const o of _shuffle(IRREGULAR_VERBS)) add(which === 'past' ? o.past : o.pp);
  return out;
}

// Spielart einer 🌀-Welle auswürfeln: schreiben (Wirbelsturm), die richtige Form aus
// fallenden Formen fangen (Meteoriten) oder die vorgesprochene Form heraushören (Echo).
// Ohne TTS fällt Echo weg.
function _verbWaveType() {
  const types = ['verbstorm', 'verbmeteors'];
  if (window.speechSynthesis) types.push('verbecho');
  return types[Math.floor(Math.random() * types.length)];
}

function _startWave() {
  const { run, node } = _ctx;
  if (!run.fight) { _close(null); return; }
  const stock = _stock();
  const pool = stock.pool;
  const verbs = _verbPool();

  // Wellen-Typ wählen: 🌀 nur Verbformen (aber in drei Spielarten, _verbWaveType);
  // ⚔️ mischt Sturm/Meteoriten/Echo/Stimmt-das; 👑 mischt alles. Fallbacks: zu wenig
  // Wörter → kein Meteoriten/Echo/Stimmt-das; kein TTS → kein Echo; 🌀 ohne befüllte
  // Verben (alte Karte) → normale Wellen.
  let type;
  if (node.type === 'irregular' && verbs.length) {
    type = _verbWaveType();
  } else {
    if (!pool.length) { _close(null); return; }
    const types = ['storm'];
    if (pool.length >= METEOR_COUNT) types.push('meteors');
    if (window.speechSynthesis && pool.length >= 3) types.push('echo');
    if (pool.length >= TF_PAIRS) types.push('truefalse');
    if (node.type === 'boss' && verbs.length) types.push(_verbWaveType());
    type = types[Math.floor(Math.random() * types.length)];
  }

  setKnotenKachel(_AUFGABE_KACHEL[node.type] || null);
  const host = _el('cf-stage');
  _ctx.waveForm = null;
  _ctx.waveType = type;
  _ctx.cfItem = null;    // Wort dieser Welle — bekommt in _onWave seinen _cf-Eintrag
  _ctx.cfSuf = null;
  _ctx.waveMiss = false; // Fehlgriff in dieser Welle? (siehe _onMiss)
  _ctx.angriffe = [];    // Teilangriffe bei Richtig/Falsch (siehe _tfTreffer)
  _ctx.nachAngriffen = null;

  // Ausrüstungs-Effekte: 🧤/🪄 Zeitbonus auf jedes Minispiel (Meteoriten fallen
  // langsamer), ⏳ Zeittrank für begrenzte Wellen, 🐾 Gefährte fängt Fehlgriffe
  // pro KAMPF im Buchstabensturm.
  const eff = _ctx.eff;
  const f = run.fight;
  let tBonus = eff.timeBonusMs || 0;
  if (f.timeBoost > 0) { tBonus += POTION_TIME_MS; f.timeBoost--; }
  // Grundzeit schrumpft je Runde (F-102), die Boni bleiben voll.
  const tf = roundTimeFactor(_ctx.round);
  const zeit = (ms) => Math.round(ms * tf) + tBonus;
  const guards = Math.max(0, (eff.companionGuards || 0) - (f.guardsUsed || 0));
  const onGuardUsed = () => {
    f.guardsUsed = (f.guardsUsed || 0) + 1; _ctx.save();
    _schutzMeldung('paw', 'Gefährte fängt den Fehler!', 'Kein Leben verloren', 'var(--p-falsch)');
  };

  if (type === 'verbstorm' || type === 'verbmeteors' || type === 'verbecho') {
    // Verbform-Welle: „go → Simple Past?" — entweder zusammensetzen (Wirbelsturm) oder
    // aus Formen auswählen (Meteoriten/Echo). Formen-Welle → passende Waffe
    // (Stahl=past / Gold=pp) bekommt FORM_BONUS.
    const which = _pickForm();
    const v = _pickVerb(which) || verbs[Math.floor(Math.random() * verbs.length)];
    _ctx.waveForm = which;
    _ctx.cfItem = { de: v.de, en: v.en, _presetId: IRREGULAR_PRESET_ID, _deck: null };
    _ctx.cfSuf = CF_SUF + (which === 'pp' ? '_pp' : '_past');
    const raw = which === 'past' ? v.past : v.pp;   // mit /-Alternativen (Tippen erlaubt beide)
    const label = which === 'past' ? 'Simple Past' : 'Past Participle';
    const head = frageForm(v.en, which);   // „go → [Simple Past]" (F.8, F.9)
    if (type === 'verbmeteors') {
      const choices = _shuffle([_displayEn(raw), ..._verbDistractors(v, which, METEOR_COUNT - 1)]);
      _ctx.mg = startMeteors({ host, de: v.de, answer: _displayEn(raw), choices, prompt: head, fallMs: zeit(METEOR_FALL_MS), onMiss: _onMiss, onResult: _onWave });
    } else if (type === 'verbecho') {
      // Gehört wird die FORM — die Frage ist also nicht „welches Wort", sondern
      // welche Form dieses Verbs; die Auswahl sind lauter Verbformen.
      const choices = _shuffle([_displayEn(raw), ..._verbDistractors(v, which, ECHO_CHOICES - 1)]);
      _ctx.mg = startEcho({ host, answer: _displayEn(raw), speakText: _displayEn(raw), choices,
        verb: v.en, timeLimitMs: zeit(ECHO_TIME_MS), onMiss: _onMiss, onResult: _onWave });
    } else {
      _ctx.mg = startLetterstorm({
        host, de: v.de, en: raw, prompt: head,
        timeLimitMs: zeit(_lettersMs(raw)),
        guards, onGuardUsed, onMiss: _onMiss,
        onResult: _onWave,
      });
    }
  } else if (type === 'truefalse') {
    // „Stimmt das?": mehrere Paare in EINER Welle, alle aus derselben gewichteten
    // Ziehung und durch _fresh verschieden. Der Lernstand hängt hier je Paar am
    // eigenen Wort (K-5, _tfBuche) — nicht wie sonst an einem Wort der Welle.
    const items = [];
    for (let i = 0; i < TF_PAIRS; i++) { const it = _pickItem(stock); if (it) items.push(it); }
    if (!items.length) { _close(null); return; }
    // Etwa halb/halb, aber nie alle gleich — sonst hat man die Welle nach zwei Paaren
    // durchschaut.
    const nOk = Math.floor(items.length / 2) + (Math.random() < 0.5 ? 0 : 1);
    const oks = _shuffle(items.map((_, i) => i < nOk));
    const pairs = items.map((it, i) => {
      const right = _displayEn(it.en);
      // Falsches Paar: eine Übersetzung aus dem Vorrat, die NICHT zu diesem deutschen
      // Wort gehört — gleiches de wäre ein zweites Wort für dasselbe und damit richtig.
      const wrong = oks[i] ? null : _distractors(pool.filter((p) => p.de !== it.de), right, 1)[0];
      return { de: it.de, en: wrong || right, ok: oks[i] || !wrong };
    });
    _ctx.tfPaare = pairs.length;
    _ctx.tf = { items, pairs };
    _ctx.mg = startTrueFalse({ host, pairs, timeLimitMs: zeit(TF_TIME_MS),
      onMiss: (i) => { _tfBuche(i, false); _tfSchlag(pairs.length); },
      onRight: (i) => { _tfBuche(i, true); _tfTreffer(pairs.length); }, onResult: _onWave });
  } else if (type === 'meteors') {
    const item = _ctx.cfItem = _pickItem(stock);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, METEOR_COUNT - 1)]);
    _ctx.mg = startMeteors({ host, de: item.de, answer, choices, fallMs: zeit(METEOR_FALL_MS), onMiss: _onMiss, onResult: _onWave });
  } else if (type === 'echo') {
    const item = _ctx.cfItem = _pickItem(stock);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, ECHO_CHOICES - 1)]);
    _ctx.mg = startEcho({ host, answer, speakText: answer, choices, timeLimitMs: zeit(ECHO_TIME_MS), onMiss: _onMiss, onResult: _onWave });
  } else {
    const item = _ctx.cfItem = _pickItem(stock);
    _ctx.mg = startLetterstorm({ host, de: item.de, en: item.en, timeLimitMs: zeit(_timeLimit(item)), guards, onGuardUsed, onMiss: _onMiss, onResult: _onWave });
  }
}

// Schaden des Helden: Waffe + Formen-Bonus (Stahl=past / Gold=pp) + Typ-Vorteil
// (Speer vs Boss, Axt vs Elite, Hammer verdoppelt Welle 1) + 💪 Krafttrank;
// 🧿 Talisman: ×1.5 an 🌀-Knoten. teile > 1 = Teilangriff bei Richtig/Falsch: der
// volle Schaden geteilt und aufgerundet (keine halben Punkte). Alle Zusatz-Effekte
// stehen als Pixel-Icons in der Schadenszahl über dem Gegner.
function _heroDmg(teile = 1) {
  const { run, node, weapon, eff } = _ctx;
  const f = run.fight;
  const bonus = _ctx.waveForm && weapon.which === _ctx.waveForm ? FORM_BONUS : 0;
  let dmg = weapon.dmg + bonus + (f.power || 0);
  if (weapon.type === 'speer' && node.type === 'boss') dmg += PERK_SPEER_BOSS;
  if (weapon.type === 'axt' && node.type === 'irregular') dmg += PERK_AXT_ELITE;
  if (weapon.type === 'bogen' && node.type === 'fight') dmg += PERK_BOGEN_FIGHT;
  const hammer = weapon.type === 'hammer' && f.wave === 1;
  if (hammer) dmg *= PERK_HAMMER_MULT;
  const tali = node.type === 'irregular' && eff.talisman;
  if (tali) dmg = Math.round(dmg * (eff.talismanMult || TALISMAN_MULT));   // Sonnen-Talisman stärker (F-100)
  if (teile > 1) dmg = Math.ceil(dmg / teile);
  return { dmg, html: '−' + dmg + (bonus ? iconHTML('star', 14) : '') + (hammer ? iconHTML('hammer', 14) : '') + (tali ? iconHTML('orb', 14) : '') };
}

// Richtig/Falsch (F-66, F-68): jedes Paar ist ein eigener, kleinerer Schlag — der
// Held für jedes richtige, der Gegner für jedes falsche und bei Zeitablauf für jedes
// offene. Ein Schlag = voller Schaden geteilt durch die Paare, aufgerundet; alle
// Paare zusammen ergeben so genau einen vollen Angriff. Die Schläge laufen
// nacheinander: play() bricht eine laufende Animation ab, und mit ihr ginge der
// Treffer verloren. Ausgewertet wird die Welle erst, wenn alle durch sind (_onWave).
function _einreihen(ctx, schlag) {
  ctx.angriffe.push(schlag);
  if (ctx.angriffe.length === 1) schlag();
}
// Der Folgeschritt läuft erst im nächsten Durchlauf (K3): _naechsterSchlag kommt aus dem
// onEnd des letzten Schlags, und direkt danach schaltet SpritePlayer den Angreifer selbst
// auf 'idle' — ein sofort gestarteter Folgeschlag desselben Angreifers wurde dadurch
// abgebrochen, sein Treffer kam nie an und der Kampf stand still (wie in _endScreen).
// Der fertige Schlag bleibt bis dahin vorn in der Schlange, damit ein in der Lücke
// eingereihter Schlag nicht schon von _einreihen gestartet wird (sonst liefe er doppelt).
function _naechsterSchlag(ctx) {
  setTimeout(() => {
    if (_ctx !== ctx || ctx.vorbei) return;
    ctx.angriffe.shift();
    if (ctx.angriffe.length) ctx.angriffe[0]();
    else if (ctx.nachAngriffen) { const w = ctx.nachAngriffen; ctx.nachAngriffen = null; w(); }
  }, 0);
}

// Lernstand je Paar (K-5): ein richtiges Paar zeigt die echte Übersetzung — das
// Urteil zählt dann als gewusst bzw. nicht gewusst. Ein falsches Paar zeigt sie
// nicht: es richtig abzulehnen beweist das Wort nicht (keine Buchung), es für
// richtig zu halten heißt aber, das Wort nicht sicher zu kennen.
function _tfBuche(i, ok) {
  const tf = _ctx?.tf;
  const p = tf?.pairs[i];
  if (!p) return;
  if (p.ok) _record(tf.items[i], ok, null);
  else if (!ok) _record(tf.items[i], false, null);
}

function _tfTreffer(teile) {
  const ctx = _ctx;
  if (!ctx) return;
  _einreihen(ctx, () => {
    if (_ctx !== ctx || ctx.vorbei) return;
    const f = ctx.run.fight;
    const { dmg, html } = _heroDmg(teile);
    _strike('hero', html, '#c084fc',
      () => {
        f.enemyHp = Math.max(0, f.enemyHp - dmg);
        _setBars();
        try { playSfx('correct'); } catch (e) {}
        ctx.save();
      },
      () => {
        if (_ctx !== ctx || ctx.vorbei) return;
        if (f.enemyHp <= 0) {   // Gegner fällt mitten in der Welle → sofort Sieg
          if (ctx.mg) ctx.mg.destroy();
          ctx.run.fight = null; ctx.save(); _endScreen(true);
          return;
        }
        _naechsterSchlag(ctx);
      });
  });
}

// Schlag des Gegners für ein falsches oder offenes Paar. Wie beim Fehlgriff in
// den anderen Spielen schützt hier nichts; Schild, Ausweichen und Helm wirken wie
// heute nur auf die verlorene Welle (Zeitablauf, siehe _onWave).
function _tfSchlag(teile) {
  const ctx = _ctx;
  if (!ctx) return;
  ctx.waveMiss = true;
  _einreihen(ctx, () => {
    if (_ctx !== ctx || ctx.vorbei) return;
    const dmg = Math.ceil(ctx.enemy.dmg / teile);
    _strike('enemy', '−' + dmg, '#ff8787',
      () => {
        ctx.run.hp = Math.max(0, ctx.run.hp - dmg);
        _setBars();
        try { playSfx('wrong'); } catch (e) {}
        ctx.save();
      },
      () => {
        if (_ctx !== ctx || ctx.vorbei) return;
        if (ctx.run.hp <= 0) { if (ctx.mg) ctx.mg.destroy(); _endScreen(false); return; }
        _naechsterSchlag(ctx);
      });
  });
}

// offen = bei Richtig/Falsch die Paare, die beim Zeitablauf noch nicht beurteilt waren.
function _onWave(success, _rest, offen = 0, gezeigt = -1) {
  if (!_ctx) return;
  // Laufen noch Schläge (Richtig/Falsch), erst danach auswerten.
  if (_ctx.angriffe?.length) { _ctx.nachAngriffen = () => _onWave(success, _rest, offen, gezeigt); return; }
  const { run, node, enemy, weapon, eff, save } = _ctx;
  const f = run.fight;
  if (!f) return;
  // Lernstand des Wortes zuerst: er hängt an der Antwort, nicht daran, ob Schild/
  // Helm/Ausweichen den Schaden abgefangen haben. Eine Welle, die nur mit Fehlgriffen
  // fertig wurde, zählt dabei NICHT als gewusst (waveMiss) — sonst würde jedes Wort
  // als gelernt durchgewinkt, seit ein Fehler die Welle nicht mehr beendet.
  _record(_ctx.cfItem, success && !_ctx.waveMiss, _ctx.cfSuf);
  // Verlorene Welle (LU-01): das Minispiel zeigt „Richtig wäre · …"; die nächste
  // Welle wartet, bis der Chip mindestens LOESUNG_MS zu sehen war.
  const loesungBis = Date.now() + LOESUNG_MS;
  const naechsteWelle = (min) => setTimeout(() => { if (_ctx) _startWave(); }, Math.max(min, loesungBis - Date.now()));
  let wurf;   // Ausweich-Wurf, siehe unten
  // Richtig/Falsch: Held und Gegner haben schon je Paar zugeschlagen (_tfTreffer,
  // _tfSchlag) — am Ende kommt kein weiterer Angriff, die nächste Welle beginnt.
  // Lief die Zeit erst nach dem letzten Urteil ab, ist nichts mehr offen.
  // Richtig/Falsch bei Zeitablauf: das gerade gezeigte Paar war nicht rechtzeitig
  // gewusst (K-5) — die noch nicht gezeigten bleiben ungebucht.
  if (_ctx.waveType === 'truefalse' && !success && gezeigt >= 0) _tfBuche(gezeigt, false);
  if (_ctx.waveType === 'truefalse' && (success || !offen)) {
    f.wave++; save();
    setTimeout(() => { if (_ctx) _startWave(); }, 300);
    return;
  }
  if (success) {
    const { dmg, html } = _heroDmg();
    _strike('hero', html, '#c084fc',
      () => {
        f.enemyHp = Math.max(0, f.enemyHp - dmg);
        _setBars();
        try { playSfx('correct'); } catch (e) {}
      },
      () => {
        if (!_ctx) return;
        if (f.enemyHp <= 0) { run.fight = null; save(); _endScreen(true); return; }
        f.wave++; save();
        setTimeout(() => { if (_ctx) _startWave(); }, 300);
      });
    return;
  } else if (f.shield) {
    // 🛡️ Schildtrank: wehrt genau eine verlorene Welle ab. Meldung über der
    // Figur wie Fragment 6.8 (N41).
    f.shield = false;
    _schutzMeldung('potion', 'Schildtrank!', 'Verlorene Welle abgewehrt', 'var(--p-blau)');
    try { playSfx('click'); } catch (e) {}
  } else if (eff.dodge && (wurf = Math.random()) < eff.dodge) {
    // 🥾 Stiefel / 🗡️ Dolch: der verlorenen Welle ausgewichen — kein HP-Verlust.
    // Die Chance ist die Summe aus beiden; derselbe Wurf sagt nur noch, welcher
    // Teil gegriffen hat (unterer Teil Stiefel, oberer Dolch) — für die Meldung.
    const dolch = weapon.type === 'dolch' ? PERK_DOLCH_DODGE : 0;
    const ausDolch = dolch > 0 && wurf >= eff.dodge - dolch;
    _schutzMeldung(ausDolch ? 'sword' : 'boots', 'Ausgewichen!', ausDolch ? 'Dolch' : 'Stiefel', 'var(--p-pfirsich)');
    try { playSfx('click'); } catch (e) {}
  } else if ((f.headUsed || 0) < (eff.headGuards || 0)) {
    // 🪖 Helm: wehrt verlorene Wellen ab (Anzahl je Stufe).
    f.headUsed = (f.headUsed || 0) + 1;
    _schutzMeldung('helm', 'Helm blockt!', 'Kein Schaden', 'var(--p-stahl)');
    try { playSfx('click'); } catch (e) {}
  } else if (_ctx.waveType === 'truefalse') {
    // Zeit abgelaufen: der Gegner schlägt für jedes offene Paar einmal zu.
    _ctx.nachAngriffen = () => { f.wave++; save(); setTimeout(() => { if (_ctx) _startWave(); }, 300); };
    for (let i = 0; i < offen; i++) _tfSchlag(_ctx.tfPaare);
    return;
  } else {
    _strike('enemy', '−' + enemy.dmg, '#ff8787',
      () => {
        run.hp = Math.max(0, run.hp - enemy.dmg);
        _setBars();
        try { playSfx('wrong'); } catch (e) {}
      },
      () => {
        if (!_ctx) return;
        if (run.hp <= 0) { save(); _endScreen(false); return; }
        f.wave++; save();
        naechsteWelle(300);
      });
    return;
  }
  f.wave++;
  save();
  naechsteWelle(900);
}

const LOESUNG_MS = 1500;   // so lange steht „Richtig wäre · …" mindestens (LU-01)

// Konfetti beim Boss-Sieg (7.16): Pastell-Plättchen mit Kontur, die im Takt
// fallen und sich drehen (data-ui="confetti", Übersicht 9.7). Liegt über allem
// im Kampf-Overlay und bleibt, bis der Kampf geschlossen wird.
function _confettiBurst() {
  const wrap = document.createElement('div');
  wrap.className = 'cf-konfetti';
  const farben = ['#FFBBC1', '#BCE3FF', '#C9B8FF', '#B7E3C2', '#FFD6A5', '#FFD66B'];
  const ov = _el('cf-overlay');
  const w = (ov && ov.clientWidth) || 402, h = (ov && ov.clientHeight) || 874;
  let html = '';
  for (let i = 0; i < 18; i++) {
    const x = Math.round(Math.random() * (w - 16)), y = Math.round(Math.random() * h);
    const dreh = Math.round(Math.random() * 70 - 35);
    // position inline: ui-anim.js erkennt Plättchen nur daran.
    html += `<span style="position:absolute;left:${x}px;top:${y}px;background:${farben[i % farben.length]};transform:rotate(${dreh}deg)"></span>`;
  }
  wrap.innerHTML = html;
  wrap.dataset.ui = 'confetti';
  (_el('cf-overlay') || document.body).appendChild(wrap);
}

function _endScreen(victory) {
  const { node, players } = _ctx;
  _ctx.vorbei = true;   // wartende Teilangriffe (Richtig/Falsch) verfallen
  _el('cf-hero')?.classList.remove('vorn');
  const boss = node.type === 'boss';
  const bossWin = victory && boss;
  const stage = _el('cf-stage');
  if (victory) try { playSfx('end'); } catch (e) {}
  // Sieg und Niederlage kommen aus dem Modul (7.15/7.16 bzw. 7.17):
  // play('win') laeuft in Schleife, play('die') geht von selbst in 'ko' ueber -
  // nicht selbst zurueck auf 'idle' schalten (Handoff-Regel 6).
  // Erst im nächsten Durchlauf: das Kampf-Ende kommt meist aus dem onEnd des letzten
  // Schlags, und direkt danach schaltet SpritePlayer den Angreifer selbst zurück auf
  // 'idle' — das überschrieb bisher den Jubel des Helden (Sieg) bzw. des Gegners
  // (Niederlage). Der Gefährte hat einen eigenen Player und jubelte deshalb als Einziger.
  const figuren = () => {
    if (victory) {
      players?.feind?.play('die');
      players?.hero?.play('win');
      players?.pet?.play('win');
    } else {
      players?.hero?.play('die');
      players?.pet?.play('die');
      players?.feind?.play('win');
    }
  };
  setTimeout(figuren, 0);
  if (bossWin) _confettiBurst();
  // Karten wie Fragment 7.15 (Gegner besiegt), 7.16 (Boss besiegt) und 7.17
  // (Lauf vorbei). Wirkung der Knöpfe unverändert.
  const esc = (s) => (window.escHtml ? window.escHtml(String(s)) : String(s));
  const hebt = (html) => html.replace('<canvas ', '<canvas data-ui="bob" data-a="2" ');
  const chip = (ton, icon, text) => `<span class="cf-ende-chip" style="background:${ton}">${iconHTML(icon, 14)}${text}</span>`;
  // Kein Wellen-Chip mehr (F-36 hebt F-13 auf, wie die neuen Fragmente).
  let inhalt;
  if (bossWin) {
    inhalt = `<div class="cf-ende-emblem cf-ende-emblem--boss">${hebt(iconHTML('crownBig', 56))}</div>
      <div class="cf-ende-titel cf-ende-titel--boss">Boss besiegt!</div>
      <div class="cf-ende-text">${esc(enemyName(_ctx.enemyKey) || 'Der Boss')} ist gefallen — Lauf geschafft.</div>
      <div class="cf-ende-chips">
        ${chip('var(--p-gold)', 'crown', '+1 Boss')}${chip('var(--p-ok)', 'flag', 'Nächster Lauf gratis')}
        ${chip('var(--p-gold)', 'coin', `+${BOSS_WIN_TALER} Taler`)}
      </div>
      <button id="cf-endbtn" class="cf-ende-btn">Zur Kampagne</button>`;
  } else if (victory) {
    inhalt = `<div class="cf-ende-emblem" style="background:var(--p-ok)">${hebt(iconHTML('sword', 42))}</div>
      <div class="cf-ende-titel">Gegner besiegt!</div>
      <div class="cf-ende-text">Der Weg ist frei — wähle den nächsten Knoten auf der Karte.</div>
      <button id="cf-endbtn" class="cf-ende-btn" style="margin-top:18px">Weiter</button>`;
  } else {
    // LU-08: am Boss einmal für Taler weiterkämpfen (volle Leben, Boss behält seinen Stand).
    const nochmal = boss && _ctx.run.fight && !_ctx.run.fight.nochmal && !!_ctx.kannNochmal?.();
    inhalt = `<div class="cf-ende-emblem" style="background:var(--p-inaktiv)">${iconHTML('skull', 42)}</div>
      <div class="cf-ende-titel">Lauf vorbei</div>
      <div class="cf-ende-liste">
        <div class="cf-ende-zeile">${iconHTML('heart', 14)}Dein Leben ist auf 0</div>
        <div class="cf-ende-zeile cf-ende-zeile--weg">${iconHTML('coinOff', 14)}Einsatz von ${STAKE_COST} Talern ist weg</div>
        <div class="cf-ende-zeile">${iconHTML('flag', 14)}Nächster Lauf beginnt bei Runde 1</div>
      </div>
      ${nochmal
        ? `<div class="cf-weg-knoepfe">
            <button id="cf-nochmal" class="cf-weg-btn">${iconHTML('coin', 14)}&nbsp;Nochmal · ${BOSS_NOCHMAL_TALER} Taler</button>
            <button id="cf-endbtn" class="cf-weg-btn cf-weg-btn--bleib">Weiter</button>
          </div>`
        : `<button id="cf-endbtn" class="cf-ende-btn">Weiter</button>`}`;
  }
  if (stage) stage.innerHTML = `<div class="cf-ende"><div class="cf-ende-karte">${inhalt}</div></div>`;
  const flee = _el('cf-flee');
  if (flee) flee.style.display = 'none';
  const btn = _el('cf-endbtn');
  if (btn) btn.onclick = () => _close(victory ? 'victory' : 'death');
  const noch = _el('cf-nochmal');
  if (noch) noch.onclick = () => _close('nochmal');
}

function _close(result) {
  if (_ctx?.mg) _ctx.mg.destroy();
  _destroyPlayers();
  const onEnd = _ctx?.onEnd;
  const enemyKey = _ctx?.enemyKey;
  _markCfDirty();
  _ctx = null;
  _removeOverlay();
  if (onEnd) onEnd(result, enemyKey);
}

function _removeOverlay() {
  window.removeEventListener('resize', _passeGroesse);
  const ov = _el('cf-overlay');
  if (ov) ov.remove();
}
