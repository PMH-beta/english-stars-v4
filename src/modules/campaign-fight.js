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
// KEIN Mastery/EMA-Schreiben: eine Welle ist einmalig richtig oder falsch. EMA wird
// nur GELESEN — für die Wortauswahl (unsichere Wörter bevorzugt, weightedPickUnique)
// und den Zeitbonus (+25 % bei unsicheren Wörtern). Zwischenstand lebt in run.fight
// (reitet im profiles.campaign-jsonb mit) → Reload mitten im Kampf verliert nichts;
// nur das aktuelle Wort der Welle wird neu gezogen.

import { ENEMY, FORM_BONUS, TALISMAN_MULT, STORM_BASE_MS, STORM_PER_LETTER_MS, WEAK_TIME_BONUS, WEAK_EMA, METEOR_FALL_MS, METEOR_COUNT, ECHO_TIME_MS, ECHO_CHOICES, PERK_SPEER_BOSS, PERK_AXT_ELITE, PERK_HAMMER_MULT, PERK_BOGEN_FIGHT, POTION_HEAL, POTION_POWER, POTION_TIME_MS, POTION_TIME_WAVES } from './campaign-balance.js';
import { startLetterstorm, stormTarget } from './minigame-letterstorm.js';
import { startMeteors } from './minigame-meteors.js';
import { startEcho } from './minigame-echo.js';
import { equippedWeapon, equipEffects, equippedGearMap, POTIONS } from './campaign-equipment.js';
import { enemySpriteSVG } from './pixel-enemies.js';
import { itemSpriteSVG, avatarSVG, ensureAvatar } from './avatar.js';
import { weightedPickUnique, playSfx } from './game.js';
import { effectivePct, statKeyFor } from './stats.js';
import { getConstellations } from './irregular-verbs.js';

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
// Stats werden nur GELESEN: Vorlagen-Wörter aus globalPresetStats, manuelle aus dem
// jeweiligen Deck (SD.wordStats spiegelt nur das AKTIVE Deck → hier direkt ans Deck).
function _pool() {
  const out = [];
  const decks = window.SD?.decks || {};
  for (const id in decks) {
    const deck = decks[id];
    if ((deck.mode || 'free') !== 'free' || !deck.vocab?.length) continue;
    for (const v of deck.vocab) out.push({ de: v.de, en: v.en, _presetId: v._presetId || null, _deck: deck });
  }
  return out;
}
// Buchstabensturm = Schreib-Kompetenz → _sp-Stat.
function _statOf(item) {
  const key = statKeyFor(item.de, item.en, '_sp', item._presetId);
  return item._presetId ? window.SD?.globalPresetStats?.wordStats?.[key] : item._deck.wordStats?.[key];
}
export function fightPoolReady() { return _pool().length >= 1; }

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

// onEnd(result): 'victory' | 'death' | null (Kampf verlassen, Zustand bleibt).
export function openFight({ run, node, save, onEnd }) {
  const enemy = ENEMY[node.type] || ENEMY.fight;
  if (!run.fight || run.fight.nodeId !== node.id) {
    // headUsed/guardsUsed = Zähler; shield/power/timeBoost = aktive Trank-Effekte.
    run.fight = { nodeId: node.id, type: node.type, enemyHp: enemy.hp, enemyHpMax: enemy.hp, wave: 1, headUsed: 0, guardsUsed: 0, shield: false, power: 0, timeBoost: 0 };
    save();
  }
  _ctx = { run, node, enemy, weapon: equippedWeapon(), eff: equipEffects(), save, onEnd, mg: null, lastEn: null };
  _renderOverlay();
  _startWave();
}

// ── Tränke im Kampf ──────────────────────────────────────────────────────────
function _renderPotions() {
  const el = _el('cf-potions');
  if (!el || !_ctx) return;
  const potions = _ctx.run.potions || [];
  el.innerHTML = potions.map((k, i) => POTIONS[k]
    ? `<button class="cf-potion" data-pi="${i}" title="${POTIONS[k].name}: ${POTIONS[k].desc}">${POTIONS[k].icon}</button>`
    : '').join('');
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
  if (key === 'heal') { run.hp = Math.min(run.hpMax, run.hp + POTION_HEAL); _setBars(); }
  else if (key === 'shield') f.shield = true;
  else if (key === 'power') f.power = (f.power || 0) + POTION_POWER;
  else if (key === 'time') f.timeBoost = (f.timeBoost || 0) + POTION_TIME_WAVES;
  _feedback(`${p.icon} ${p.name}!`);
  try { playSfx('streak'); } catch (e) {}
  save();
  _renderPotions();
}

function _el(id) { return document.getElementById(id); }

// Kampf-Szene im Retro-OS-Look (Art-Direction): dunkler Raum mit harten
// vertikalen Licht-Streifen, darin EIN Fenster mit Titelleiste + [–][×]
// (× = Kampf verlassen), Pixel-Font, segmentierte HP-Balken (Batterie-Stil).
// Das Minispiel läuft im dunklen „Monitor"-Bereich des Fensters.
function _renderOverlay() {
  _removeOverlay();
  const { run, node, enemy, weapon } = _ctx;
  const f = run.fight;
  const ov = document.createElement('div');
  ov.id = 'cf-overlay';
  ov.className = 'cf-scene';
  const wIcon = weapon.type ? itemSpriteSVG(weapon.type, weapon.tier) : '👊';
  ov.innerHTML = `
  <div class="rw cf-window">
    <div class="rw-title">
      <span class="rw-title-txt">${enemy.name}.EXE — ${_TITLE[node.type] || _TITLE.fight}</span>
      <button class="rw-btn" id="cf-min" title="Minimieren">–</button>
      <button class="rw-btn" id="cf-flee" title="Kampf verlassen (geht später weiter)">×</button>
    </div>
    <div class="rw-body">
      <div class="cf-arena">
        <div class="cf-hero" id="cf-hero">${avatarSVG(ensureAvatar(window.SD), { gear: equippedGearMap() })}</div>
        <div class="cf-enemy${node.type === 'boss' ? ' boss' : ''}" id="cf-enemy">${enemySpriteSVG(node.type)}</div>
        <div class="cf-ground"></div>
      </div>
      <div class="cf-bars">
        <div class="cf-bar">
          <div class="rw-label">DU</div>
          <div class="seg-bar hp" id="cf-phpseg"></div>
          <div class="rw-dim" id="cf-phptxt"></div>
        </div>
        <div class="cf-bar right">
          <div class="rw-label">${enemy.name}</div>
          <div class="seg-bar" id="cf-ehpseg"></div>
          <div class="rw-dim" id="cf-ehptxt"></div>
        </div>
      </div>
      <div class="cf-meta">
        <span class="rw-chip" title="${weapon.name} — ${weapon.dmg} Schaden">${wIcon}<b>${weapon.dmg}</b></span>
        <span class="rw-dim" id="cf-wave">Welle ${f.wave}</span>
      </div>
      <div id="cf-feedback" class="rw-feedback"></div>
      <div id="cf-potions" class="cf-potions"></div>
      <div id="cf-stage" class="cf-stage"></div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  _el('cf-flee').onclick = () => _close(null);
  _el('cf-min').onclick = () => window.esToast?.('Netter Versuch — das Fenster bleibt offen 😄');
  _setBars();
  _renderPotions();
}

// Segment-Balken (Batterie-Stil): n Zellen, gefüllt nach Anteil.
function _segBar(el, cur, max, n = 10) {
  if (!el) return;
  const on = Math.ceil((Math.max(0, cur) / Math.max(1, max)) * n);
  el.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('');
}

function _setBars() {
  const { run } = _ctx;
  const f = run.fight;
  if (f) {
    _segBar(_el('cf-ehpseg'), f.enemyHp, f.enemyHpMax);
    const et = _el('cf-ehptxt');
    if (et) et.textContent = `${f.enemyHp}/${f.enemyHpMax} HP`;
  }
  _segBar(_el('cf-phpseg'), run.hp, run.hpMax);
  const pt = _el('cf-phptxt');
  if (pt) pt.textContent = `${run.hp}/${run.hpMax} HP`;
}

// Gegner/Spieler blinken hart auf, wenn sie Schaden nehmen (kein Glow, nur Helligkeit).
function _hitFlash(id) {
  const el = _el(id);
  if (!el) return;
  el.classList.add('hit');
  setTimeout(() => el.classList.remove('hit'), 200);
}
function _enemyHit() { _hitFlash('cf-enemy'); }
function _playerHit() { _hitFlash('cf-hero'); }

function _feedback(t) { const el = _el('cf-feedback'); if (el) el.textContent = t; }

// Deck-Wort EMA-gewichtet ziehen, direkte Wiederholung vermeiden.
function _pickItem(pool) {
  let item = weightedPickUnique(pool, _statOf, 1)[0];
  if (pool.length > 1 && _ctx.lastEn === item.en) {
    item = weightedPickUnique(pool.filter(v => v.en !== item.en), _statOf, 1)[0] || item;
  }
  _ctx.lastEn = item.en;
  return item;
}

function _startWave() {
  const { run, node } = _ctx;
  if (!run.fight) { _close(null); return; }
  const pool = _pool();
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
  _feedback('');
  const host = _el('cf-stage');
  _ctx.waveForm = null;

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
    const v = verbs[Math.floor(Math.random() * verbs.length)];
    const which = Math.random() < 0.5 ? 'past' : 'pp';
    _ctx.waveForm = which;
    const target = which === 'past' ? v.past : v.pp;
    const label = which === 'past' ? 'Simple Past' : 'Past Participle';
    _ctx.mg = startLetterstorm({
      host, de: v.de, en: target,
      prompt: `🌀 ${v.en} → <span style="color:#ffd43b;">${label}</span>?`,
      sub: `(${v.de})`,
      timeLimitMs: _lettersMs(target) + tBonus,
      guards, onGuardUsed,
      onResult: _onWave,
    });
  } else if (type === 'meteors') {
    const item = _pickItem(pool);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, METEOR_COUNT - 1)]);
    _ctx.mg = startMeteors({ host, de: item.de, answer, choices, fallMs: METEOR_FALL_MS + tBonus, onResult: _onWave });
  } else if (type === 'echo') {
    const item = _pickItem(pool);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, ECHO_CHOICES - 1)]);
    _ctx.mg = startEcho({ host, answer, speakText: answer, choices, timeLimitMs: ECHO_TIME_MS + tBonus, onResult: _onWave });
  } else {
    const item = _pickItem(pool);
    _ctx.mg = startLetterstorm({ host, de: item.de, en: item.en, timeLimitMs: _timeLimit(item) + tBonus, guards, onGuardUsed, onResult: _onWave });
  }
}

function _onWave(success) {
  if (!_ctx) return;
  const { run, node, enemy, weapon, eff, save } = _ctx;
  const f = run.fight;
  if (!f) return;
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
    _enemyHit();
    _feedback('💥 Treffer! −' + dmg + (bonus ? ' ✨' : '') + (hammer ? ' 🔨' : '') + (tali ? ' 🧿' : ''));
    try { playSfx('correct'); } catch (e) {}
    if (f.enemyHp <= 0) { run.fight = null; save(); _endScreen(true); return; }
  } else if (f.shield) {
    // 🛡️ Schildtrank: wehrt genau eine verlorene Welle ab.
    f.shield = false;
    _feedback('🛡️ Schild hält!');
    try { playSfx('click'); } catch (e) {}
  } else if (eff.dodge && Math.random() < eff.dodge) {
    // 🥾 Stiefel / 🗡️ Dolch: der verlorenen Welle ausgewichen — kein HP-Verlust.
    _feedback('🍃 Ausgewichen!');
    try { playSfx('click'); } catch (e) {}
  } else if ((f.headUsed || 0) < (eff.headGuards || 0)) {
    // 🪖 Helm: wehrt verlorene Wellen ab (Anzahl je Stufe).
    f.headUsed = (f.headUsed || 0) + 1;
    _feedback('🪖 Der Helm hält!');
    try { playSfx('click'); } catch (e) {}
  } else {
    run.hp = Math.max(0, run.hp - enemy.dmg);
    _setBars();
    _playerHit();
    _feedback('💔 Daneben! −' + enemy.dmg + ' HP');
    try { playSfx('wrong'); } catch (e) {}
    if (run.hp <= 0) { save(); _endScreen(false); return; }
  }
  f.wave++;
  save();
  setTimeout(() => { if (_ctx) _startWave(); }, 900);
}

function _endScreen(victory) {
  const { node } = _ctx;
  const boss = node.type === 'boss';
  const stage = _el('cf-stage');
  if (victory) try { playSfx('end'); } catch (e) {}
  if (stage) stage.innerHTML = `<div style="text-align:center;padding:40px 16px;">
    <div style="font-size:4rem;margin-bottom:12px;">${victory ? (boss ? '👑' : '🎉') : '💀'}</div>
    <div style="font-family:'Fredoka One',cursive;font-size:1.3rem;color:#fff;margin-bottom:10px;">${victory ? (boss ? 'Boss besiegt!' : 'Gewonnen!') : 'Besiegt …'}</div>
    <div style="font-size:.9rem;font-weight:700;color:rgba(255,255,255,.75);max-width:300px;margin:0 auto 22px;line-height:1.5;">${victory
      ? (boss ? 'Du hast dich bis ganz nach oben gekämpft — der Lauf ist geschafft!' : 'Der Weg ist frei — wähle den nächsten Knoten.')
      : 'Deine HP sind auf 0 — der Lauf ist vorbei und der Einsatz (2 🪙) weg.'}</div>
    <button id="cf-endbtn" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:14px 28px;border:none;border-radius:14px;cursor:pointer;background:linear-gradient(135deg,#a86cdb,#c084fc);color:#fff;box-shadow:0 4px 0 #7d4bb0;">Weiter</button>
  </div>`;
  const flee = _el('cf-flee');
  if (flee) flee.style.display = 'none';
  const btn = _el('cf-endbtn');
  if (btn) btn.onclick = () => _close(victory ? 'victory' : 'death');
}

function _close(result) {
  if (_ctx?.mg) _ctx.mg.destroy();
  const onEnd = _ctx?.onEnd;
  _ctx = null;
  _removeOverlay();
  if (onEnd) onEnd(result);
}

function _removeOverlay() { const ov = _el('cf-overlay'); if (ov) ov.remove(); }
