// src/modules/campaign-fight.js
// Kampf-Wrapper der Kampagne. Ein Knoten = Gegner mit HP; Wellen sind UNBEGRENZT —
// pro Welle ein Minispiel. Erfolg = Gegner erhält Waffenschaden, Misserfolg = Spieler
// verliert HP. Kampf endet bei Gegner-HP 0 (Sieg) oder Spieler-HP 0 (Tod → Run vorbei,
// Einsatz weg — Logik in campaign.js).
//
// Wellen-Mix: ⚔️ zieht zufällig aus Buchstabensturm / Meteoriten / Echo-Fang;
// 🌀 nur Verbform-Buchstabensturm (befüllte Sternbild-Verben, SD.uvFills);
// 👑 mischt alles. Meteoriten/Echo brauchen genug Wörter, Echo zusätzlich TTS —
// sonst fällt die Welle auf den Buchstabensturm zurück. Formen-Wellen geben der
// passenden Waffe +FORM_BONUS (Stahl = Past, Gold = PP).
//
// Der Kampf führt einen EIGENEN Lernstand je Wort (Stat-Suffix _cf, siehe _record):
// pro Welle ein Eintrag richtig/falsch. Er steuert NUR die Wortauswahl hier und hat
// keinen Einfluss auf Taler, Deck-Prozente oder die Statistik-Seiten — analog zu den
// _tr_-Stats des Trainingsplatzes. Die Vokabel-Stats (_sp) werden weiterhin nur
// GELESEN: als Startwert für die Gewichtung und für den Zeitbonus (+25 % bei
// unsicheren Wörtern). Zwischenstand lebt in run.fight (reitet im profiles.campaign-
// jsonb mit) → Reload mitten im Kampf verliert nichts; nur das aktuelle Wort der
// Welle wird neu gezogen.

import { scaledEnemy, FORM_BONUS, TALISMAN_MULT, STORM_BASE_MS, STORM_PER_LETTER_MS, STORM_MISS_DMG, WEAK_TIME_BONUS, WEAK_EMA, METEOR_FALL_MS, METEOR_COUNT, ECHO_TIME_MS, ECHO_CHOICES, PERK_SPEER_BOSS, PERK_AXT_ELITE, PERK_HAMMER_MULT, PERK_BOGEN_FIGHT, POTION_HEAL, POTION_POWER, POTION_TIME_MS, POTION_TIME_WAVES, BOSS_WIN_TALER, CF_MIN_ASKED, CF_MASTER, CF_POOL_OPEN, CF_SEEN_MIN, CF_LEARNED_WEIGHT, CF_OWN_SHARE, CF_REVIEW_SHARE, VERB_OWN_SHARE_START, VERB_OWN_SHARE_PER_ROUND, VERB_OWN_SHARE_MIN, VERB_OWN_SEEN_MIN, VERB_TIER_START, VERB_TIER_PER_ROUND, VERB_TIER_SPREAD, VERB_TIER_FLOOR, VERB_FILLED_BONUS } from './campaign-balance.js';
import { startLetterstorm, stormTarget } from './minigame-letterstorm.js';
import { startMeteors } from './minigame-meteors.js';
import { startEcho } from './minigame-echo.js';
import { equippedWeapon, equipEffects, equippedGearMap, POTIONS, potionStacks } from './campaign-equipment.js';
import { enemySpriteSVG } from './pixel-enemies.js';
import { avatarSVG, ensureAvatar } from './avatar.js';
import { playSfx } from './game.js';
import { effectivePct, statKeyFor } from './stats.js';
import { getConstellations, IRREGULAR_VERBS, IRREGULAR_PRESET_ID, verbsByEns } from './irregular-verbs.js';
import { uvFormPracticed } from './irregular-game.js';
import { getPresetCategories } from './vocab.js';
import { markDirty } from './sync.js';

const _TITLE = {
  fight:     '⚔️ Übung',
  irregular: '🌀 Unregelmäßige',
  boss:      '👑 Boss',
};

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
const _MODE_SUF = ['_mc', '_sp', '_pr'];
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
export async function loadPresetSupply() {
  if (_supply) return _supply;
  let cats = [];
  try { cats = await getPresetCategories(); } catch (e) { cats = []; }
  const out = [];
  const seen = new Set();
  const sorted = [...cats].sort((a, b) =>
    ((_DIFF_RANK[a.difficulty] ?? 1) - (_DIFF_RANK[b.difficulty] ?? 1)) || ((a.sort_order || 0) - (b.sort_order || 0)));
  for (const c of sorted) {
    for (const w of (c.words || [])) {
      const key = (w.en || '').trim().toLowerCase();
      if (!w.de || !key || seen.has(key)) continue;
      seen.add(key);
      out.push({ de: w.de, en: w.en, _presetId: c.id, _deck: null });
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
  s.asked += 1;
  if (ok) s.correct += 1; else s.wrong += 1;
  s.recent = ((s.recent || '') + (ok ? '1' : '0')).slice(-8);
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

// ── Vorrat = eigene Wörter, mit Vorlagen aufgefüllt ──────────────────────────
// Feste Grundzahl OFFENER Wörter (CF_POOL_OPEN) — hoch genug, dass sich die Ziehung
// zufällig anfühlt. Die Plätze bekommen zuerst die eigenen Deck-Wörter (Deck-, dann
// Wortreihenfolge), der Überhang wartet als Reserve; erst wenn keine eigenen mehr da
// sind, füllen Vorlagen-Wörter auf. Ist ein Wort im Kampf gelernt, gibt es seinen
// Platz frei und die Reserve rückt in derselben Reihenfolge nach — gelernte Wörter
// bleiben aber im Vorrat, damit die Wiederholungs-Quote sie noch ziehen kann.
function _stock() {
  const supply = _supply || [];
  const own = [];
  let open = 0;
  for (const v of _pool()) {
    // Gelernte bleiben im Vorrat (Wiederholungs-Quote), belegen aber keinen Platz.
    if (_learned(v)) { own.push(v); continue; }
    if (open >= CF_POOL_OPEN) continue;   // Rest wartet als Reserve auf einen freien Platz
    own.push(v);
    open++;
  }
  let take = 0;
  while (open < CF_POOL_OPEN && take < supply.length) {
    if (!_learned(supply[take])) open++;
    take++;
  }
  return { own, preset: supply.slice(0, take) };
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
let _ctx = null;   // { run, node, enemy, weapon, save, onEnd, mg, lastEn }

// onEnd(result): 'victory' | 'death' (auch bei bewusstem „Kampf verlassen") | null
// (interner Nicht-Fall, z. B. Wortpool beim Laden leer). stat(key) zählt einen
// Kampagnen-Statistikwert hoch (die Zähler selbst liegen in campaign.js).
export function openFight({ run, node, save, onEnd, round, stat }) {
  const enemy = scaledEnemy(node.type, round);
  if (!run.fight || run.fight.nodeId !== node.id) {
    // headUsed/guardsUsed = Zähler; shield/power/timeBoost = aktive Trank-Effekte.
    run.fight = { nodeId: node.id, type: node.type, enemyHp: enemy.hp, enemyHpMax: enemy.hp, wave: 1, headUsed: 0, guardsUsed: 0, shield: false, power: 0, timeBoost: 0 };
    save();
  }
  // cfPreset/cfDecks merken sich, welche Stat-Töpfe der Kampf angefasst hat (siehe
  // _record/_markCfDirty).
  _ctx = { run, node, enemy, weapon: equippedWeapon(), eff: equipEffects(), save, onEnd, stat, mg: null, lastEn: null, round, cfPreset: false, cfDecks: new Set() };
  _renderOverlay();
  _startWave();
}

// ── Tränke im Kampf ──────────────────────────────────────────────────────────
// Gleiche Tränke liegen als EIN Feld mit kleiner Anzahl in der Ecke; der Klick
// verbraucht den ersten dieser Sorte (stack.index).
function _renderPotions() {
  const el = _el('cf-potions');
  if (!el || !_ctx) return;
  el.innerHTML = potionStacks(_ctx.run.potions).map(s =>
    `<button class="cf-potion" data-pi="${s.index}" title="${POTIONS[s.key].name}: ${POTIONS[s.key].desc}">${POTIONS[s.key].icon}${
      s.count > 1 ? `<span class="potion-n">${s.count}</span>` : ''}</button>`).join('');
  el.querySelectorAll('[data-pi]').forEach(btn => { btn.onclick = () => _usePotion(+btn.dataset.pi); });
}

function _usePotion(i) {
  if (!_ctx) return;
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
    _damagePop('cf-hero', `${p.icon} ${p.name}`, '#69db7c');
  }
  try { playSfx('streak'); } catch (e) {}
  save();
  _renderPotions();
}

function _el(id) { return document.getElementById(id); }

// Pixel-Himmel hinter dem Spielfeld (Art-Direction: freundliche Tag-Szene —
// heller Himmelverlauf, Sonne, Wolken). Der grüne Boden ist KEIN Teil dieser
// Szenerie mehr, sondern ein eigener durchgehender Bereich (.cf-ground-wrap,
// siehe _renderOverlay) — so gibt es keine Bruchkante zwischen Himmel-SVG
// und Boden mehr.
function _arenaScene() {
  const px = (x, y, w, h, c, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"${o ? ` opacity="${o}"` : ''}/>`;
  let s = '<rect x="0" y="0" width="128" height="72" fill="url(#cfSky)"/>';
  // Sonne: harter Pixelkreis mit Korona-Stufe, dazu kurze Strahlen (keine weichen Glows).
  s += px(102, 6, 20, 10, '#ffd84d') + px(104, 4, 16, 14, '#ffd84d') + px(106, 2, 12, 18, '#ffd84d')
    + px(106, 6, 10, 8, '#fff3bf') + px(108, 4, 6, 3, '#fffbe6');
  s += px(98, 10, 3, 1, '#ffe8a0') + px(122, 10, 4, 1, '#ffe8a0') + px(111, 0, 1, 2, '#ffe8a0');
  // Licht als harte senkrechte Pixel-Streifen (Art-Direction: kein Glow).
  s += px(96, 0, 2, 72, '#ffffff', '.10') + px(88, 0, 1, 72, '#ffffff', '.08')
    + px(74, 0, 2, 72, '#ffffff', '.06');
  // Wolken in zwei Ebenen: hinten kleiner/blasser, vorne größer (Tiefe).
  s += px(30, 5, 12, 2, '#ffffff', '.55') + px(27, 6, 18, 2, '#ffffff', '.55');
  s += px(60, 11, 10, 2, '#ffffff', '.45') + px(58, 12, 14, 2, '#ffffff', '.45');
  s += px(8, 9, 16, 3, '#ffffff') + px(4, 11, 24, 3, '#ffffff') + px(12, 7, 10, 3, '#ffffff')
    + px(6, 11, 20, 1, '#e8f4ff');
  s += px(86, 16, 14, 3, '#ffffff') + px(82, 18, 22, 3, '#ffffff') + px(84, 18, 18, 1, '#e8f4ff');
  // Vögel (zwei Striche, klassisch)
  s += px(46, 16, 1, 1, '#7fa6c4') + px(47, 15, 2, 1, '#7fa6c4') + px(49, 16, 1, 1, '#7fa6c4');
  s += px(54, 21, 1, 1, '#7fa6c4') + px(55, 20, 2, 1, '#7fa6c4') + px(57, 21, 1, 1, '#7fa6c4');
  return `<svg viewBox="0 0 128 72" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;" aria-hidden="true">
    <defs><linearGradient id="cfSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6bbcf5"/><stop offset="0.55" stop-color="#a8dcff"/><stop offset="1" stop-color="#eaf6ff"/>
    </linearGradient></defs>${s}</svg>`;
}

// Hügel-Parallax direkt über der Rasenkante: hinten dunkler und flacher, vorne
// heller und höher (Art-Direction: 2–3 Silhouetten-Ebenen, hinten detailärmer).
// Sitzt in .cf-hills und ist damit IMMER an der Rasenkante verankert — unabhängig
// von der Bildschirmhöhe.
function _hillsScene() {
  // [Ebene: Höhenprofil je 8px-Spalte, Grundfarbe, Kantenfarbe]
  const layers = [
    [[6, 9, 12, 10, 7, 5, 8, 11, 13, 10, 7, 9, 12, 8, 6, 9], '#6d93a8', '#7fa6bb'],
    [[12, 15, 13, 17, 20, 16, 13, 15, 18, 21, 17, 14, 16, 19, 15, 13], '#4e7f57', '#5d9163'],
    [[20, 23, 26, 22, 19, 22, 25, 27, 24, 21, 23, 26, 22, 20, 23, 25], '#5d9a4a', '#74b45c'],
  ];
  let s = '';
  for (const [prof, base, edge] of layers) {
    prof.forEach((top, i) => {
      s += `<rect x="${i * 8}" y="${top}" width="8" height="${32 - top}" fill="${base}"/>`
        + `<rect x="${i * 8}" y="${top}" width="8" height="1" fill="${edge}"/>`;
    });
  }
  return `<svg viewBox="0 0 128 32" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;" aria-hidden="true">${s}</svg>`;
}

// Kampf-Szene wie die ursprüngliche Kampagnen-Version: dunkler Violett-Verlauf,
// runder ✕-Knopf, Fredoka-Schrift, weiche Verlaufs-HP-Balken. NUR der Show-Teil
// oben ist Pixel-Art: die Landschafts-Arena mit Spieler (links) und Gegner (rechts).
function _renderOverlay() {
  _removeOverlay();
  const { run, node, enemy, weapon } = _ctx;
  const f = run.fight;
  const ov = document.createElement('div');
  ov.id = 'cf-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:8000;background:#bfe6ff;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;';
  ov.innerHTML = `
    <!-- Himmel als fullscreen-Hintergrund, hinter allem anderen. -->
    <div class="cf-scenery">${_arenaScene()}</div>
    <!-- Kopfzeile: schwebt als Pille über dem Himmel — bleibt wie gehabt. -->
    <div style="position:relative;z-index:3;display:flex;align-items:center;gap:10px;padding:14px 14px 0;flex-shrink:0;">
      <button id="cf-flee" title="Kampf verlassen (Fortschritt + Einsatz weg)" style="border:none;background:rgba(43,35,80,.6);color:#fff;border-radius:50%;width:38px;height:38px;font-size:1.1rem;cursor:pointer;flex-shrink:0;">✕</button>
      <div class="cf-pill" style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 16px;">
        <span style="font-family:'Fredoka One',cursive;color:#fff;font-size:1rem;">${_TITLE[node.type] || _TITLE.fight}</span>
        <span id="cf-wave" style="font-family:'Fredoka One',cursive;color:#ffd43b;font-size:.85rem;">Welle ${f.wave}</span>
      </div>
    </div>
    <!-- Kein Feedback-Text mehr: alle Ereignisse (Treffer/Heilung/Block) zeigen sich
         als Popup direkt über dem betroffenen Character (_damagePop). -->
    <!-- Spielfeld: die fliegenden/treibenden Elemente (Buchstaben/Meteore/Wörter),
         auf dem Himmel, direkt über den Figuren. Zentrierte Spalte (max-width), damit
         es auf breiten/Web-Bildschirmen nicht auseinandergezogen wirkt. -->
    <!-- z-index deutlich über dem Rasen (2): treibende Buchstaben/Meteore/Wörter dürfen
         nie hinter dem Boden-Bereich verschwinden, sonst sind sie nicht mehr antippbar. -->
    <div id="cf-stage" style="position:relative;z-index:5;flex:1;min-height:100px;width:100%;max-width:440px;margin:0 auto;padding:18px 14px 0;box-sizing:border-box;"></div>
    <!-- Boden-Bereich: enthält Figuren, Eingabefeld, Tränke, Leben. Der Rasen selbst
         (.cf-grass) ist NUR eine Hintergrund-Ebene ab Schulterhöhe der Figuren — die
         Figuren bleiben an ihrer normalen Position, Kopf/Schultern ragen in den Himmel. -->
    <div class="cf-ground-wrap">
      <div class="cf-hills">${_hillsScene()}</div>
      <div class="cf-grass"></div>
      <div class="cf-arena">
        <div class="cf-hero" id="cf-hero">${avatarSVG(ensureAvatar(window.SD), { gear: equippedGearMap() })}</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
          <div class="cf-enemy${node.type === 'boss' ? ' boss' : ''}" id="cf-enemy">${enemySpriteSVG(node.type)}</div>
          <div style="width:110px;">
            <div style="font-size:.72rem;font-weight:800;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.35);text-align:center;margin-bottom:2px;">${enemy.name}: <span id="cf-ehp">${f.enemyHp}</span>/${f.enemyHpMax}</div>
            <div style="height:9px;background:rgba(0,0,0,.18);border-radius:6px;overflow:hidden;"><div id="cf-ehpbar" style="height:100%;width:${f.enemyHp / f.enemyHpMax * 100}%;background:linear-gradient(90deg,#ff6b6b,#e03131);transition:width .4s;"></div></div>
          </div>
        </div>
      </div>
      <div id="cf-potions" style="position:relative;z-index:3;display:flex;gap:10px;justify-content:center;padding:10px 14px 0;min-height:10px;flex-shrink:0;"></div>
      <div style="position:relative;z-index:3;padding:10px 14px 12px;flex-shrink:0;display:flex;justify-content:center;">
        <div class="cf-pill" style="width:100%;max-width:320px;padding:9px 16px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.8rem;font-weight:800;color:#ffc9c9;margin-bottom:4px;">❤️ <span id="cf-php">${run.hp}</span> / ${run.hpMax}</div>
            <div style="height:12px;background:rgba(255,255,255,.2);border-radius:8px;overflow:hidden;"><div id="cf-phpbar" style="height:100%;width:${run.hp / run.hpMax * 100}%;background:linear-gradient(90deg,#ff6b6b,#e03131);transition:width .4s;"></div></div>
          </div>
          <div title="${weapon.name}" style="font-family:'Fredoka One',cursive;color:#fff;font-size:.9rem;background:rgba(255,255,255,.14);padding:8px 12px;border-radius:12px;flex-shrink:0;">${weapon.icon} ${weapon.dmg}</div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _el('cf-flee').onclick = () => {
    // Verlassen zählt wie Tod (verhindert Welle-neu-würfeln durch Fliehen+Fortsetzen) —
    // deshalb vorher fragen, mit demselben Blur-Hintergrund-Dialog wie „Aufgeben". Welle
    // pausiert währenddessen (Minispiel-Timer liefe sonst im Hintergrund weiter). Der
    // sichere Weg (Weiterkämpfen) ist der hervorgehobene ok-Button, nicht Verlassen.
    if (_ctx?.mg?.pause) _ctx.mg.pause();
    const leave = () => _close('death');
    if (window.esConfirm) {
      window.esConfirm({
        icon: '💀', title: 'Kampf verlassen?',
        body: 'Dein Fortschritt in diesem Kampf und dein Einsatz sind weg und du fängst wieder bei Runde 1 an — genau wie bei einer Niederlage.',
        ok: 'Weiterkämpfen', cancel: 'Verlassen',
      }).then(stay => { if (stay) { if (_ctx?.mg?.resume) _ctx.mg.resume(); } else leave(); });
    } else leave();
  };
  _renderPotions();
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

// Gegner/Spieler blinken hart auf, wenn sie Schaden nehmen (kein Glow, nur Helligkeit).
function _hitFlash(id) {
  const el = _el(id);
  if (!el) return;
  el.classList.add('hit');
  setTimeout(() => el.classList.remove('hit'), 200);
}
// Kurze Kampf-Animation (attack = Ausfallschritt, shake = Wackeln) — Klasse
// neu triggern über Reflow, damit sie auch direkt hintereinander feuert.
function _anim(id, cls, ms = 500) {
  const el = _el(id);
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// Schadenszahl, die über dem Getroffenen aufsteigt und verblasst.
function _damagePop(overId, text, color) {
  const arena = document.querySelector('.cf-arena');
  const over = _el(overId);
  if (!arena || !over) return;
  const a = arena.getBoundingClientRect(), o = over.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'cf-dmg';
  s.textContent = text;
  s.style.color = color;
  s.style.left = (o.left - a.left + o.width / 2) + 'px';
  s.style.top = (o.top - a.top - 6) + 'px';
  arena.appendChild(s);
  setTimeout(() => s.remove(), 800);
}

// Aufschlag-Splitter: ein paar Pixel fliegen vom Getroffenen weg (CSS .cf-spark,
// Richtung/Weite je Splitter über --dx/--dy). Kurz, hart gesteppt, kein Glow.
function _impactBurst(overId, color) {
  const arena = document.querySelector('.cf-arena');
  const over = _el(overId);
  if (!arena || !over) return;
  const a = arena.getBoundingClientRect(), o = over.getBoundingClientRect();
  const cx = o.left - a.left + o.width / 2, cy = o.top - a.top + o.height * 0.45;
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

// Schlag-Sequenz: Angreifer holt aus und schlägt zu (Waffe schwingt mit), beim
// Aufschlag blinkt und taumelt das Ziel, Splitter stieben weg und die Schadenszahl
// steigt auf. Der Versatz passt zur Vorstoß-Phase der Angriffs-Animation (45 %).
function _strike(attackerId, targetId, dmgText, color) {
  _anim(attackerId, 'attack', 500);
  setTimeout(() => {
    _hitFlash(targetId);
    _anim(targetId, 'shake', 340);
    _impactBurst(targetId, color);
    _damagePop(targetId, dmgText, color);
  }, 210);
}

// Fehlklick im Buchstabensturm kostet jetzt auch direkt HP (zusätzlich zur
// Zeitstrafe aus minigame-letterstorm.js) — kann mitten in der Welle zum Tod führen;
// dann bricht der Kampf sofort ab statt erst am Wellenende.
function _onStormMiss() {
  if (!_ctx) return;
  const { run, save } = _ctx;
  run.hp = Math.max(0, run.hp - STORM_MISS_DMG);
  _setBars();
  _hitFlash('cf-hero');
  _anim('cf-hero', 'shake', 340);
  _impactBurst('cf-hero', '#ff8787');
  _damagePop('cf-hero', '−' + STORM_MISS_DMG, '#ff8787');
  save();
  if (run.hp <= 0) {
    if (_ctx.mg) _ctx.mg.destroy();
    _endScreen(false);
  }
}


// Gewichtsleiter wie in weightedPickUnique (game.js), damit sich die Auswahl gleich
// anfühlt — mit zwei Zusätzen: gelernte Wörter fallen auf CF_LEARNED_WEIGHT, und
// gezählt wird der Kampf-Stat; solange der leer ist, hilft der Vokabel-Stat aus.
function _weightOf(item) {
  if (_learned(item)) return CF_LEARNED_WEIGHT;
  const s = _cfStat(item) || _statOf(item);
  if (!s || (s.asked || 0) < 3) return 3;
  const ep = effectivePct(s);
  if (ep >= 0.9) return 1;
  if (ep >= 0.7) return 3;
  if (ep >= 0.4) return 4;
  return 5;
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

// Ein Wort aus dem Vorrat ziehen, direkte Wiederholung vermeiden. Zwei feste Quoten
// davor, damit weder die eigenen Wörter noch der Stoff von gestern verschwinden:
// jede fünfte Welle zieht aus dem eigenen Deck, und von den übrigen ist jede fünfte
// eine Wiederholung eines schon gelernten Wortes.
function _pickItem(stock) {
  const all = stock.own.concat(stock.preset);
  const done = all.filter((v) => _learned(v));
  const open = all.filter((v) => !_learned(v));
  let list;
  if (stock.own.length && stock.preset.length && Math.random() < CF_OWN_SHARE) list = stock.own;
  else if (done.length && open.length && Math.random() < CF_REVIEW_SHARE) list = done;
  else list = open.length ? open : all;
  let item = _pickWeighted(list, _weightOf);
  if (item && list.length > 1 && _ctx.lastEn === item.en) {
    item = _pickWeighted(list.filter(v => v.en !== item.en), _weightOf) || item;
  }
  _ctx.lastEn = item ? item.en : null;
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

// 🌀-Verb ziehen — zwei Stufen:
// 1. Zuerst die EIGENEN, schon geübten Verben (Anteil VERB_OWN_SHARE_*, sinkt pro
//    Runde). Darin zählt nur der Kampf-Lernstand: offene Formen zuerst, gelernte
//    seltener — genau wie bei den Deck-Wörtern.
// 2. Sonst (und ab höheren Runden immer öfter) aus ALLEN Verben des Datensatzes,
//    mit wanderndem Stufen-Schwerpunkt (Glockenkurve → es wird Runde für Runde
//    schwerer, leichte Stufen bleiben aber immer möglich).
function _pickVerb(which) {
  const suf = CF_SUF + (which === 'pp' ? '_pp' : '_past');
  const own = _ownVerbs(which);
  const share = Math.max(VERB_OWN_SHARE_MIN, VERB_OWN_SHARE_START - VERB_OWN_SHARE_PER_ROUND * Math.max(0, _ctx.round || 0));
  if (own.length && Math.random() < share) {
    const v = _pickWeighted(own, (x) =>
      _learned({ de: x.de, en: x.en, _presetId: IRREGULAR_PRESET_ID }, suf) ? CF_LEARNED_WEIGHT : 1);
    if (v) return v;
  }
  const filled = new Set(_verbPool().map((v) => v.en));
  const center = Math.min(5, VERB_TIER_START + VERB_TIER_PER_ROUND * Math.max(0, _ctx.round || 0));
  return _pickWeighted(IRREGULAR_VERBS, (v) => {
    const d = (v.tier || 1) - center;
    // Mindestgewicht nur nach UNTEN: schon abgehakte Stufen bleiben als Auflockerung
    // immer möglich, während schwerere erst hochkommen, wenn der Schwerpunkt da ist.
    let w = Math.exp(-(d * d) / VERB_TIER_SPREAD);
    if (d < 0) w = Math.max(w, VERB_TIER_FLOOR);
    if (filled.has(v.en)) w *= VERB_FILLED_BONUS;
    if (_learned({ de: v.de, en: v.en, _presetId: IRREGULAR_PRESET_ID }, suf)) w *= CF_LEARNED_WEIGHT;
    return w;
  });
}

function _startWave() {
  const { run, node } = _ctx;
  if (!run.fight) { _close(null); return; }
  const stock = _stock();
  const pool = stock.own.concat(stock.preset);
  const verbs = _verbPool();

  // Wellen-Typ wählen: 🌀 nur Verbformen; ⚔️ mischt Sturm/Meteoriten/Echo;
  // 👑 mischt alles. Fallbacks: zu wenig Wörter → kein Meteoriten/Echo; kein
  // TTS → kein Echo; 🌀 ohne befüllte Verben (alte Karte) → normale Wellen.
  let type;
  if (node.type === 'irregular' && verbs.length) {
    type = 'verbstorm';
  } else {
    if (!pool.length) { _close(null); return; }
    const types = ['storm'];
    if (pool.length >= METEOR_COUNT) types.push('meteors');
    if (window.speechSynthesis && pool.length >= 3) types.push('echo');
    if (node.type === 'boss' && verbs.length) types.push('verbstorm');
    type = types[Math.floor(Math.random() * types.length)];
  }

  const w = _el('cf-wave');
  if (w) w.textContent = 'Welle ' + run.fight.wave;
  const host = _el('cf-stage');
  _ctx.waveForm = null;
  _ctx.cfItem = null;    // Wort dieser Welle — bekommt in _onWave seinen _cf-Eintrag
  _ctx.cfSuf = null;

  // Ausrüstungs-Effekte: 🧤/🪄 Zeitbonus auf jedes Minispiel (Meteoriten fallen
  // langsamer), ⏳ Zeittrank für begrenzte Wellen, 🐾 Gefährte fängt Fehlgriffe
  // pro KAMPF im Buchstabensturm.
  const eff = _ctx.eff;
  const f = run.fight;
  let tBonus = eff.timeBonusMs || 0;
  if (f.timeBoost > 0) { tBonus += POTION_TIME_MS; f.timeBoost--; }
  const guards = Math.max(0, (eff.companionGuards || 0) - (f.guardsUsed || 0));
  const onGuardUsed = () => { f.guardsUsed = (f.guardsUsed || 0) + 1; _ctx.save(); };

  if (type === 'verbstorm') {
    // Verbform zusammensetzen: „go → Simple Past?" → w-e-n-t. Formen-Welle →
    // passende Waffe (Stahl=past / Gold=pp) bekommt FORM_BONUS.
    const which = _pickForm();
    const v = _pickVerb(which) || verbs[Math.floor(Math.random() * verbs.length)];
    _ctx.waveForm = which;
    _ctx.cfItem = { de: v.de, en: v.en, _presetId: IRREGULAR_PRESET_ID, _deck: null };
    _ctx.cfSuf = CF_SUF + (which === 'pp' ? '_pp' : '_past');
    const target = which === 'past' ? v.past : v.pp;
    const label = which === 'past' ? 'Simple Past' : 'Past Participle';
    _ctx.mg = startLetterstorm({
      host, de: v.de, en: target,
      prompt: `🌀 ${v.en} → <span style="color:#a67c00;">${label}</span>?`,
      sub: `(${v.de})`,
      timeLimitMs: _lettersMs(target) + tBonus,
      guards, onGuardUsed, onMiss: _onStormMiss,
      onResult: _onWave,
    });
  } else if (type === 'meteors') {
    const item = _ctx.cfItem = _pickItem(stock);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, METEOR_COUNT - 1)]);
    _ctx.mg = startMeteors({ host, de: item.de, answer, choices, fallMs: METEOR_FALL_MS + tBonus, onResult: _onWave });
  } else if (type === 'echo') {
    const item = _ctx.cfItem = _pickItem(stock);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, ECHO_CHOICES - 1)]);
    _ctx.mg = startEcho({ host, answer, speakText: answer, choices, timeLimitMs: ECHO_TIME_MS + tBonus, onResult: _onWave });
  } else {
    const item = _ctx.cfItem = _pickItem(stock);
    _ctx.mg = startLetterstorm({ host, de: item.de, en: item.en, timeLimitMs: _timeLimit(item) + tBonus, guards, onGuardUsed, onMiss: _onStormMiss, onResult: _onWave });
  }
}

function _onWave(success) {
  if (!_ctx) return;
  const { run, node, enemy, weapon, eff, save } = _ctx;
  const f = run.fight;
  if (!f) return;
  // Lernstand des Wortes zuerst: er hängt an der Antwort, nicht daran, ob Schild/
  // Helm/Ausweichen den Schaden abgefangen haben.
  _record(_ctx.cfItem, success, _ctx.cfSuf);
  if (success) {
    // Schaden: Waffe + Formen-Bonus (Stahl=past / Gold=pp) + Typ-Vorteil
    // (Speer vs Boss, Axt vs Elite, Hammer verdoppelt Welle 1) + 💪 Krafttrank;
    // 🧿 Talisman: ×1.5 an 🌀-Knoten.
    const bonus = _ctx.waveForm && weapon.which === _ctx.waveForm ? FORM_BONUS : 0;
    let dmg = weapon.dmg + bonus + (f.power || 0);
    if (weapon.type === 'speer' && node.type === 'boss') dmg += PERK_SPEER_BOSS;
    if (weapon.type === 'axt' && node.type === 'irregular') dmg += PERK_AXT_ELITE;
    if (weapon.type === 'bogen' && node.type === 'fight') dmg += PERK_BOGEN_FIGHT;
    const hammer = weapon.type === 'hammer' && f.wave === 1;
    if (hammer) dmg *= PERK_HAMMER_MULT;
    const tali = node.type === 'irregular' && eff.talisman;
    if (tali) dmg = Math.round(dmg * TALISMAN_MULT);
    f.enemyHp = Math.max(0, f.enemyHp - dmg);
    _setBars();
    // Alle Zusatz-Effekte (Formen-Bonus/Hammer/Talisman) direkt in die Schadenszahl,
    // die über dem Gegner aufsteigt — keine separate Text-Anzeige mehr nötig.
    _strike('cf-hero', 'cf-enemy', '−' + dmg + (bonus ? ' ✨' : '') + (hammer ? ' 🔨' : '') + (tali ? ' 🧿' : ''), '#c084fc');
    try { playSfx('correct'); } catch (e) {}
    if (f.enemyHp <= 0) { run.fight = null; save(); _endScreen(true); return; }
  } else if (f.shield) {
    // 🛡️ Schildtrank: wehrt genau eine verlorene Welle ab. Popup über dem eigenen
    // Character statt Text-Feedback — analog zu Schaden über dem Gegner.
    f.shield = false;
    _damagePop('cf-hero', '🛡️ Block!', '#69db7c');
    try { playSfx('click'); } catch (e) {}
  } else if (eff.dodge && Math.random() < eff.dodge) {
    // 🥾 Stiefel / 🗡️ Dolch: der verlorenen Welle ausgewichen — kein HP-Verlust.
    _damagePop('cf-hero', '🍃 Ausgewichen!', '#69db7c');
    try { playSfx('click'); } catch (e) {}
  } else if ((f.headUsed || 0) < (eff.headGuards || 0)) {
    // 🪖 Helm: wehrt verlorene Wellen ab (Anzahl je Stufe).
    f.headUsed = (f.headUsed || 0) + 1;
    _damagePop('cf-hero', '🪖 Block!', '#69db7c');
    try { playSfx('click'); } catch (e) {}
  } else {
    run.hp = Math.max(0, run.hp - enemy.dmg);
    _setBars();
    _strike('cf-enemy', 'cf-hero', '−' + enemy.dmg, '#ff8787');
    try { playSfx('wrong'); } catch (e) {}
    if (run.hp <= 0) { save(); _endScreen(false); return; }
  }
  f.wave++;
  save();
  setTimeout(() => { if (_ctx) _startWave(); }, 900);
}

// Konfetti-Regen beim Boss-Sieg — nutzt .confetti-wrap/.confetti-piece aus style.css
// (bisher ungenutzt vorbereitet), Farben/Größen/Timing kommen per Inline-Style dazu.
function _confettiBurst() {
  const wrap = document.createElement('div');
  wrap.className = 'confetti-wrap';
  const colors = ['#ffd43b', '#c084fc', '#69db7c', '#ff8787', '#4dabf7'];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + '%';
    p.style.width = p.style.height = (6 + Math.random() * 6) + 'px';
    p.style.background = colors[i % colors.length];
    p.style.borderRadius = Math.random() < 0.5 ? '50%' : '2px';
    p.style.animationDuration = (1.4 + Math.random() * 1.1) + 's';
    p.style.animationDelay = (Math.random() * 0.3) + 's';
    wrap.appendChild(p);
  }
  // An #cf-overlay hängen, nicht an <body>: der Kampf-Overlay liegt auf z-index:8000,
  // das gemeinsame .confetti-wrap nur auf 999 — an body würde es dahinter verschwinden.
  (_el('cf-overlay') || document.body).appendChild(wrap);
  setTimeout(() => wrap.remove(), 2600);
}

function _endScreen(victory) {
  const { node, round } = _ctx;
  const boss = node.type === 'boss';
  const bossWin = victory && boss;
  const stage = _el('cf-stage');
  if (victory) try { playSfx('end'); } catch (e) {}
  if (victory) {
    // Jeder besiegte Gegner zerplatzt (siehe .cf-enemy.poof), der Held reißt die
    // Waffe hoch und hüpft (.cf-hero.cheer) — beim Boss zusätzlich Konfetti.
    const enemyEl = _el('cf-enemy');
    if (enemyEl) enemyEl.classList.add('poof');
    const heroEl = _el('cf-hero');
    if (heroEl) heroEl.classList.add('cheer');
    if (bossWin) _confettiBurst();
  } else {
    // Niederlage: der Held sackt zur Seite weg (.cf-hero.down).
    const heroEl = _el('cf-hero');
    if (heroEl) heroEl.classList.add('down');
  }
  if (stage) stage.innerHTML = `<div style="display:flex;justify-content:center;padding:20px 16px;">
    <div style="background:#fff;border-radius:20px;padding:28px 24px;box-shadow:0 4px 14px rgba(0,0,0,.22);max-width:300px;text-align:center;">
      <div style="font-size:4rem;margin-bottom:12px;">${victory ? (boss ? '👑' : '🎉') : '💀'}</div>
      <div style="font-family:'Fredoka One',cursive;font-size:1.3rem;color:#333;margin-bottom:10px;">${bossWin ? `🐉 Boss Nr. ${round + 1} besiegt!` : victory ? 'Gewonnen!' : 'Besiegt …'}</div>
      <div style="font-size:.9rem;font-weight:700;color:#777;margin-bottom:${bossWin ? 14 : 22}px;line-height:1.5;">${victory
        ? (boss ? 'Du hast dich bis ganz nach oben gekämpft — der Lauf ist geschafft!' : 'Der Weg ist frei — wähle den nächsten Knoten.')
        : `Deine HP sind auf 0 — der Lauf ist vorbei und der Einsatz (2 🪙) weg.${round > 0 ? ' Der Aufstieg beginnt wieder bei Runde 1.' : ''}`}</div>
      ${bossWin ? `<div class="bounce-in" style="font-family:'Fredoka One',cursive;font-size:1.15rem;color:#a67c00;background:#fff3bf;border-radius:12px;padding:8px 14px;margin-bottom:22px;display:inline-block;">+${BOSS_WIN_TALER} 🪙</div>` : ''}
      <button id="cf-endbtn" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:14px 28px;border:none;border-radius:14px;cursor:pointer;background:linear-gradient(135deg,#a86cdb,#c084fc);color:#fff;box-shadow:0 4px 0 #7d4bb0;">${bossWin ? '🔄 Neue Runde starten' : 'Weiter'}</button>
    </div>
  </div>`;
  const flee = _el('cf-flee');
  if (flee) flee.style.display = 'none';
  const btn = _el('cf-endbtn');
  if (btn) btn.onclick = () => _close(victory ? 'victory' : 'death');
}

function _close(result) {
  if (_ctx?.mg) _ctx.mg.destroy();
  const onEnd = _ctx?.onEnd;
  _markCfDirty();
  _ctx = null;
  _removeOverlay();
  if (onEnd) onEnd(result);
}

function _removeOverlay() { const ov = _el('cf-overlay'); if (ov) ov.remove(); }
