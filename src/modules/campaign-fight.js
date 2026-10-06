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

import { scaledEnemy, FORM_BONUS, TALISMAN_MULT, PERK_DOLCH_DODGE, STORM_BASE_MS, STORM_PER_LETTER_MS, STORM_MISS_DMG, WEAK_TIME_BONUS, WEAK_EMA, METEOR_FALL_MS, METEOR_COUNT, ECHO_TIME_MS, ECHO_CHOICES, TF_PAIRS, TF_TIME_MS, PERK_SPEER_BOSS, PERK_AXT_ELITE, PERK_HAMMER_MULT, PERK_BOGEN_FIGHT, POTION_HEAL, POTION_POWER, POTION_TIME_MS, POTION_TIME_WAVES, BOSS_WIN_TALER, CF_MIN_ASKED, CF_MASTER, CF_POOL_OPEN, CF_NO_REPEAT, CF_SEEN_MIN, CF_LEARNED_WEIGHT, CF_OWN_SHARE, CF_REVIEW_SHARE, VERB_OWN_SHARE_START, VERB_OWN_SHARE_PER_ROUND, VERB_OWN_SHARE_MIN, VERB_OWN_SEEN_MIN, VERB_TIER_START, VERB_TIER_PER_ROUND, VERB_TIER_SPREAD, VERB_TIER_FLOOR, VERB_FILLED_BONUS } from './campaign-balance.js';
import { startLetterstorm, stormTarget } from './minigame-letterstorm.js';
import { startMeteors } from './minigame-meteors.js';
import { startEcho } from './minigame-echo.js';
import { iconHTML } from './pixel-icons.js';
import { startTrueFalse } from './minigame-truefalse.js';
import { equippedWeapon, equipEffects, equippedGearMap, POTIONS, POTION_TON, potionStacks } from './campaign-equipment.js';
import { frageForm } from './minigame-karte.js';
import { STAKE_COST } from './campaign.js';   // nur zur Laufzeit gelesen — der Kreis-Import ist unkritisch
import { pickEnemyKey, enemyName, enemyBattleSVG } from './enemies.js';
import { arenaTag, arenaForRound } from './world.js';
import { ensureAvatar } from './avatar.js';
import { heroCombatSheet, enemyCombatSheet, SpritePlayer, ProjectileLayer } from './pixel-anim.js';
import { gearFor, createPetPlayer, petKind, petColorHex } from './hero.js';
import { playSfx } from './game.js';
import { effectivePct, statKeyFor } from './stats.js';
import { getConstellations, IRREGULAR_VERBS, IRREGULAR_PRESET_ID, verbsByEns } from './irregular-verbs.js';
import { uvFormPracticed } from './irregular-game.js';
import { getPresetCategories } from './vocab.js';
import { markDirty } from './sync.js';

// Titel in der Kopfleiste: Pixel-Icon + Wort (Fragmente 7.4, 7.10, 7.13).
const _TITLE = {
  fight:     ['sword', 'Übung'],
  irregular: ['orb', 'Unregelmäßige'],
  boss:      ['bossCrest', 'Boss'],
};
const _titelHTML = (typ) => { const [ic, wort] = _TITLE[typ] || _TITLE.fight; return iconHTML(ic, 14) + wort; };

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
  // enemyKey = welcher der 36 Gegner auftritt. Bleibt für den ganzen Kampf gleich,
  // liegt aber bewusst NUR hier und nicht im Spielstand — wie bisher wird beim
  // Fortsetzen eines Kampfes neu gewürfelt.
  const enemyKey = pickEnemyKey(node.type);
  // Kampf-Blaetter EINMAL beim Laden bauen (Handoff-Regel 6) - ein Helden-Blatt
  // kostet rund 110 ms, beim ersten Angriff waere das ein sichtbarer Haenger.
  const heroCfg = { ...ensureAvatar(window.SD), gear: gearFor(equippedGearMap()) };
  _ctx = { run, node, enemy, enemyKey, heroCfg,
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
    _damagePop('cf-hero', `${iconHTML('potion', 14)}${p.name}`, '#69db7c', true);
  }
  try { playSfx('streak'); } catch (e) {}
  save();
  _renderPotions();
}

function _el(id) { return document.getElementById(id); }

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
      <button id="cf-flee" class="cf-rund" title="Kampf verlassen (Fortschritt + Einsatz weg)">${iconHTML('close', 28)}</button>
      <div class="cf-kopfleiste">
        <span class="cf-titel">${_titelHTML(node.type)}</span>
        <span id="cf-wave" class="cf-welle">Welle ${f.wave}</span>
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
  // Erst jetzt zeichnen: renderAvatarInto misst den Container, um die Figur
  // ganzzahlig zu skalieren (Handoff-Regel 6). Vor dem Einhaengen hat .cf-hero
  // noch keine Groesse.
  _buildPlayers();
  _el('cf-flee').onclick = () => {
    // Verlassen zählt wie Tod (verhindert Welle-neu-würfeln durch Fliehen+Fortsetzen) —
    // deshalb vorher fragen, mit demselben Blur-Hintergrund-Dialog wie „Aufgeben". Welle
    // pausiert währenddessen (Minispiel-Timer liefe sonst im Hintergrund weiter). Der
    // sichere Weg (Weiterkämpfen) ist der hervorgehobene ok-Button, nicht Verlassen.
    if (_ctx?.mg?.pause) _ctx.mg.pause();
    const leave = () => _close('death');
    // Dialog wie Fragment 7.14: Totenkopf auf Sand, Text ohne Vondu-Kasten,
    // „Verlassen" hell, „Weiterkämpfen" als sicherer, hervorgehobener Knopf.
    const d = document.createElement('div');
    d.className = 'p-dlg-grund cf-weg-grund';
    d.innerHTML = `<div class="p-dlg-karte cf-weg-karte">
        <div class="cf-ende-emblem" style="background:var(--p-inaktiv)">${iconHTML('skull', 42)}</div>
        <div class="cf-weg-titel">Kampf verlassen?</div>
        <div class="cf-weg-text">Dein Fortschritt in diesem Kampf und dein Einsatz sind weg — du fängst wieder bei Runde 1 an, genau wie bei einer Niederlage.</div>
        <div class="cf-weg-knoepfe">
          <button class="cf-weg-btn" data-weg="1">Verlassen</button>
          <button class="cf-weg-btn cf-weg-btn--bleib" data-weg="0">Weiterkämpfen</button>
        </div>
      </div>`;
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-weg]');
      if (!b) return;
      d.remove();
      if (b.dataset.weg === '1') leave();
      else if (_ctx?.mg?.resume) _ctx.mg.resume();
    });
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
    pet = createPetPlayer(petEl, petKind(a.pet), petColorHex(a.pet, a.petColor), hs);
  }
  _ctx.players = { hero, feind, pet };
  if (flug) { try { _ctx.layer = new ProjectileLayer(flug, { scale: hs }); } catch (e) { _ctx.layer = null; } }
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
  s.style.left = (o.left - a.left + o.width / 2) + 'px';
  s.style.top = (o.top - a.top - 6) + 'px';
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

// Ein Wort aus dem Vorrat ziehen, die zuletzt gezogenen aussparen (_fresh). Zwei feste
// Quoten davor, damit weder die eigenen Wörter noch der Stoff von gestern verschwinden:
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
  const item = _pickWeighted(_fresh(list, _recent), _weightOf);
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
  let picked = null;
  if (own.length && Math.random() < share) {
    picked = _pickWeighted(_fresh(own, _recentV), (x) =>
      _learned({ de: x.de, en: x.en, _presetId: IRREGULAR_PRESET_ID }, suf) ? CF_LEARNED_WEIGHT : 1);
  }
  if (!picked) {
    const filled = new Set(_verbPool().map((v) => v.en));
    const center = Math.min(5, VERB_TIER_START + VERB_TIER_PER_ROUND * Math.max(0, _ctx.round || 0));
    picked = _pickWeighted(_fresh(IRREGULAR_VERBS, _recentV), (v) => {
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
  const seen = new Set([_displayEn(which === 'past' ? v.past : v.pp).toLowerCase()]);
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
  const pool = stock.own.concat(stock.preset);
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

  const w = _el('cf-wave');
  if (w) w.textContent = 'Welle ' + run.fight.wave;
  const host = _el('cf-stage');
  _ctx.waveForm = null;
  _ctx.cfItem = null;    // Wort dieser Welle — bekommt in _onWave seinen _cf-Eintrag
  _ctx.cfSuf = null;
  _ctx.waveMiss = false; // Fehlgriff in dieser Welle? (siehe _onMiss)

  // Ausrüstungs-Effekte: 🧤/🪄 Zeitbonus auf jedes Minispiel (Meteoriten fallen
  // langsamer), ⏳ Zeittrank für begrenzte Wellen, 🐾 Gefährte fängt Fehlgriffe
  // pro KAMPF im Buchstabensturm.
  const eff = _ctx.eff;
  const f = run.fight;
  let tBonus = eff.timeBonusMs || 0;
  if (f.timeBoost > 0) { tBonus += POTION_TIME_MS; f.timeBoost--; }
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
    const head = frageForm(v.en, which);   // „go → [Simple Past]?" (7.10, 7.11)
    if (type === 'verbmeteors') {
      const choices = _shuffle([_displayEn(raw), ..._verbDistractors(v, which, METEOR_COUNT - 1)]);
      _ctx.mg = startMeteors({ host, de: v.de, answer: _displayEn(raw), choices, prompt: head, fallMs: METEOR_FALL_MS + tBonus, onMiss: _onMiss, onResult: _onWave });
    } else if (type === 'verbecho') {
      // Gehört wird die FORM — die Frage ist also nicht „welches Wort", sondern
      // welche Form dieses Verbs; die Auswahl sind lauter Verbformen.
      const choices = _shuffle([_displayEn(raw), ..._verbDistractors(v, which, ECHO_CHOICES - 1)]);
      _ctx.mg = startEcho({ host, answer: _displayEn(raw), speakText: _displayEn(raw), choices,
        prompt: `${window.escHtml ? window.escHtml(v.en) : v.en} → welche Form hörst du?`, timeLimitMs: ECHO_TIME_MS + tBonus, onMiss: _onMiss, onResult: _onWave });
    } else {
      _ctx.mg = startLetterstorm({
        host, de: v.de, en: raw, prompt: head,
        timeLimitMs: _lettersMs(raw) + tBonus,
        guards, onGuardUsed, onMiss: _onMiss,
        onResult: _onWave,
      });
    }
  } else if (type === 'truefalse') {
    // „Stimmt das?": mehrere Paare in EINER Welle. Der Lernstand hängt wie bei jeder
    // anderen Welle an genau einem Wort (dem ersten gezogenen) — die übrigen Paare
    // kommen aus derselben gewichteten Ziehung und sind durch _fresh alle verschieden.
    const items = [];
    for (let i = 0; i < TF_PAIRS; i++) { const it = _pickItem(stock); if (it) items.push(it); }
    if (!items.length) { _close(null); return; }
    _ctx.cfItem = items[0];
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
    _ctx.mg = startTrueFalse({ host, pairs, timeLimitMs: TF_TIME_MS + tBonus, onMiss: _onMiss, onResult: _onWave });
  } else if (type === 'meteors') {
    const item = _ctx.cfItem = _pickItem(stock);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, METEOR_COUNT - 1)]);
    _ctx.mg = startMeteors({ host, de: item.de, answer, choices, fallMs: METEOR_FALL_MS + tBonus, onMiss: _onMiss, onResult: _onWave });
  } else if (type === 'echo') {
    const item = _ctx.cfItem = _pickItem(stock);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, ECHO_CHOICES - 1)]);
    _ctx.mg = startEcho({ host, answer, speakText: answer, choices, timeLimitMs: ECHO_TIME_MS + tBonus, onMiss: _onMiss, onResult: _onWave });
  } else {
    const item = _ctx.cfItem = _pickItem(stock);
    _ctx.mg = startLetterstorm({ host, de: item.de, en: item.en, timeLimitMs: _timeLimit(item) + tBonus, guards, onGuardUsed, onMiss: _onMiss, onResult: _onWave });
  }
}

function _onWave(success) {
  if (!_ctx) return;
  const { run, node, enemy, weapon, eff, save } = _ctx;
  const f = run.fight;
  if (!f) return;
  // Lernstand des Wortes zuerst: er hängt an der Antwort, nicht daran, ob Schild/
  // Helm/Ausweichen den Schaden abgefangen haben. Eine Welle, die nur mit Fehlgriffen
  // fertig wurde, zählt dabei NICHT als gewusst (waveMiss) — sonst würde jedes Wort
  // als gelernt durchgewinkt, seit ein Fehler die Welle nicht mehr beendet.
  _record(_ctx.cfItem, success && !_ctx.waveMiss, _ctx.cfSuf);
  let wurf;   // Ausweich-Wurf, siehe unten
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
    // Alle Zusatz-Effekte (Formen-Bonus/Hammer/Talisman) direkt in die Schadenszahl,
    // die über dem Gegner aufsteigt — als Pixel-Icons statt Emoji.
    _strike('hero', '−' + dmg + (bonus ? iconHTML('star', 14) : '') + (hammer ? iconHTML('hammer', 14) : '') + (tali ? iconHTML('orb', 14) : ''), '#c084fc',
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
        setTimeout(() => { if (_ctx) _startWave(); }, 300);
      });
    return;
  }
  f.wave++;
  save();
  setTimeout(() => { if (_ctx) _startWave(); }, 900);
}

// Konfetti beim Boss-Sieg (7.16): Pastell-Plättchen mit Kontur, die im Takt
// fallen und sich drehen (data-ui="confetti", Übersicht 9.7). Liegt über allem
// im Kampf-Overlay und bleibt, bis der Kampf geschlossen wird.
function _confettiBurst() {
  const wrap = document.createElement('div');
  wrap.className = 'cf-konfetti';
  const farben = ['#FFBBC1', '#BCE3FF', '#C9B8FF', '#B7E3C2', '#FFD6A5', '#FFD66B'];
  const w = window.innerWidth || 402, h = window.innerHeight || 874;
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
  const boss = node.type === 'boss';
  const bossWin = victory && boss;
  const stage = _el('cf-stage');
  if (victory) try { playSfx('end'); } catch (e) {}
  // Sieg und Niederlage kommen aus dem Modul (7.15/7.16 bzw. 7.17):
  // play('win') laeuft in Schleife, play('die') geht von selbst in 'ko' ueber -
  // nicht selbst zurueck auf 'idle' schalten (Handoff-Regel 6).
  if (victory) {
    players?.feind?.play('die');
    players?.hero?.play('win');
    players?.pet?.play('win');
    if (bossWin) _confettiBurst();
  } else {
    players?.hero?.play('die');
    players?.pet?.play('die');
    players?.feind?.play('win');
  }
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
    inhalt = `<div class="cf-ende-emblem" style="background:var(--p-inaktiv)">${iconHTML('skull', 42)}</div>
      <div class="cf-ende-titel">Lauf vorbei</div>
      <div class="cf-ende-liste">
        <div class="cf-ende-zeile">${iconHTML('heart', 14)}Dein Leben ist auf 0</div>
        <div class="cf-ende-zeile cf-ende-zeile--weg">${iconHTML('coinOff', 14)}Einsatz von ${STAKE_COST} Talern ist weg</div>
        <div class="cf-ende-zeile">${iconHTML('flag', 14)}Nächster Lauf beginnt bei Runde 1</div>
      </div>
      <button id="cf-endbtn" class="cf-ende-btn">Weiter</button>`;
  }
  if (stage) stage.innerHTML = `<div class="cf-ende"><div class="cf-ende-karte">${inhalt}</div></div>`;
  const flee = _el('cf-flee');
  if (flee) flee.style.display = 'none';
  const btn = _el('cf-endbtn');
  if (btn) btn.onclick = () => _close(victory ? 'victory' : 'death');
}

function _close(result) {
  if (_ctx?.mg) _ctx.mg.destroy();
  _destroyPlayers();
  const onEnd = _ctx?.onEnd;
  _markCfDirty();
  _ctx = null;
  _removeOverlay();
  if (onEnd) onEnd(result);
}

function _removeOverlay() { const ov = _el('cf-overlay'); if (ov) ov.remove(); }
