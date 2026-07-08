// src/modules/campaign-fight.js
// Kampf-Wrapper der Kampagne (Phase 1). Ein Knoten = Gegner mit HP; Wellen sind
// UNBEGRENZT — pro Welle ein Minispiel (aktuell: Buchstabensturm). Erfolg = Gegner
// erhält Waffenschaden, Misserfolg = Spieler verliert HP. Kampf endet bei Gegner-HP 0
// (Sieg) oder Spieler-HP 0 (Tod → Run vorbei, Einsatz weg — Logik in campaign.js).
//
// KEIN Mastery/EMA-Schreiben: eine Welle ist einmalig richtig oder falsch. EMA wird
// nur GELESEN — für die Wortauswahl (unsichere Wörter bevorzugt, weightedPickUnique)
// und den Zeitbonus (+25 % bei unsicheren Wörtern). Zwischenstand lebt in run.fight
// (reitet im profiles.campaign-jsonb mit) → Reload mitten im Kampf verliert nichts;
// nur das aktuelle Wort der Welle wird neu gezogen.

import { ENEMY, FIST_DMG, WEAPON_BASE_DMG, STORM_BASE_MS, STORM_PER_LETTER_MS, WEAK_TIME_BONUS, WEAK_EMA } from './campaign-balance.js';
import { startLetterstorm, stormTarget } from './minigame-letterstorm.js';
import { weightedPickUnique, playSfx } from './game.js';
import { effectivePct, statKeyFor } from './stats.js';
import { getConstellations, forgeObject } from './irregular-verbs.js';
import { starLit, SLOTS_PER_FORM } from './irregular-game.js';

const _TITLE = {
  fight:     '⚔️ Übung',
  irregular: '🌀 Unregelmäßige',
  boss:      '👑 Boss',
};

// ── Waffe aus der Schmiede ableiten ──────────────────────────────────────────
// Beste Waffe über alle Stationen × Formen: Schaden = WEAPON_BASE_DMG + fertige
// Teile (starLit je Slot-Suffix _past_s0…_pp_s4). Ausrüstbar ab 1 fertigem Teil;
// ohne Schmiede-Fortschritt kämpft die Faust. (Phase 3: echtes Ausrüsten im Profil.)
export function bestWeapon() {
  let best = { dmg: FIST_DMG, icon: '👊', name: 'Faust' };
  for (const c of getConstellations()) {
    for (const which of ['past', 'pp']) {
      let lit = 0;
      for (let i = 0; i < SLOTS_PER_FORM; i++) if (starLit(c.verbs, `_${which}_s${i}`)) lit++;
      if (!lit) continue;
      const dmg = WEAPON_BASE_DMG + lit;
      if (dmg > best.dmg) {
        const ob = forgeObject(c.idx, which);
        best = { dmg, icon: ob.icon, name: ob.name };
      }
    }
  }
  return best;
}

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

// Zeitlimit: Grundzeit + Zuschlag pro Buchstabe ab dem 6.; unsichere Wörter
// (nie/kaum geübt oder EMA < 0.5) bekommen +25 %.
function _timeLimit(item) {
  const letters = stormTarget(item.en).replace(/ /g, '').length;
  let ms = STORM_BASE_MS + Math.max(0, letters - 5) * STORM_PER_LETTER_MS;
  const s = _statOf(item);
  const weak = !s || Math.floor(s.asked || 0) < 3 || effectivePct(s) < WEAK_EMA;
  if (weak) ms = Math.round(ms * (1 + WEAK_TIME_BONUS));
  return ms;
}

// ── Kampf-Lifecycle ──────────────────────────────────────────────────────────
let _ctx = null;   // { run, node, enemy, weapon, save, onEnd, mg, lastEn }

// onEnd(result): 'victory' | 'death' | null (Kampf verlassen, Zustand bleibt).
export function openFight({ run, node, save, onEnd }) {
  const enemy = ENEMY[node.type] || ENEMY.fight;
  if (!run.fight || run.fight.nodeId !== node.id) {
    run.fight = { nodeId: node.id, type: node.type, enemyHp: enemy.hp, enemyHpMax: enemy.hp, wave: 1 };
    save();
  }
  _ctx = { run, node, enemy, weapon: bestWeapon(), save, onEnd, mg: null, lastEn: null };
  _renderOverlay();
  _startWave();
}

function _el(id) { return document.getElementById(id); }

function _renderOverlay() {
  _removeOverlay();
  const { run, node, enemy, weapon } = _ctx;
  const f = run.fight;
  const ov = document.createElement('div');
  ov.id = 'cf-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:8000;background:linear-gradient(180deg,#2b2350,#1a1533);display:flex;flex-direction:column;padding:14px;overflow-y:auto;';
  ov.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <button id="cf-flee" title="Kampf verlassen (geht später weiter)" style="border:none;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;width:36px;height:36px;font-size:1rem;cursor:pointer;flex-shrink:0;">✖</button>
      <div style="font-family:'Fredoka One',cursive;color:#fff;font-size:1rem;flex:1;">${_TITLE[node.type] || _TITLE.fight}</div>
      <div id="cf-wave" style="font-family:'Fredoka One',cursive;color:#ffd43b;font-size:.85rem;">Welle ${f.wave}</div>
    </div>
    <div style="text-align:center;margin-bottom:10px;">
      <div id="cf-enemyicon" style="font-size:3.6rem;line-height:1.1;">${enemy.icon}</div>
      <div id="cf-feedback" style="height:24px;font-family:'Fredoka One',cursive;font-size:1rem;color:#ffd43b;"></div>
      <div style="max-width:280px;margin:2px auto 0;">
        <div style="font-size:.75rem;font-weight:800;color:#d0bfff;margin-bottom:2px;">${enemy.name}: <span id="cf-ehp">${f.enemyHp}</span> / ${f.enemyHpMax}</div>
        <div style="height:10px;background:rgba(255,255,255,.15);border-radius:6px;overflow:hidden;"><div id="cf-ehpbar" style="height:100%;width:${f.enemyHp / f.enemyHpMax * 100}%;background:linear-gradient(90deg,#845ef7,#5f3dc4);transition:width .4s;"></div></div>
      </div>
    </div>
    <div id="cf-stage" style="flex:1;"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:.75rem;font-weight:800;color:#ffc9c9;margin-bottom:2px;">❤️ <span id="cf-php">${run.hp}</span> / ${run.hpMax}</div>
        <div style="height:10px;background:rgba(255,255,255,.15);border-radius:6px;overflow:hidden;"><div id="cf-phpbar" style="height:100%;width:${run.hp / run.hpMax * 100}%;background:linear-gradient(90deg,#ff6b6b,#e03131);transition:width .4s;"></div></div>
      </div>
      <div title="${weapon.name}" style="font-family:'Fredoka One',cursive;color:#fff;font-size:.85rem;background:rgba(255,255,255,.12);padding:8px 12px;border-radius:12px;flex-shrink:0;">${weapon.icon} ${weapon.dmg}</div>
    </div>`;
  document.body.appendChild(ov);
  _el('cf-flee').onclick = () => _close(null);
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

function _feedback(t) { const el = _el('cf-feedback'); if (el) el.textContent = t; }

function _startWave() {
  const { run } = _ctx;
  const pool = _pool();
  if (!pool.length || !run.fight) { _close(null); return; }
  let item = weightedPickUnique(pool, _statOf, 1)[0];
  // Direkte Wiederholung desselben Worts vermeiden (wenn der Pool es hergibt).
  if (pool.length > 1 && _ctx.lastEn === item.en) {
    item = weightedPickUnique(pool.filter(v => v.en !== item.en), _statOf, 1)[0] || item;
  }
  _ctx.lastEn = item.en;
  const w = _el('cf-wave');
  if (w) w.textContent = 'Welle ' + run.fight.wave;
  _feedback('');
  _ctx.mg = startLetterstorm({ host: _el('cf-stage'), de: item.de, en: item.en, timeLimitMs: _timeLimit(item), onResult: _onWave });
}

function _onWave(success) {
  if (!_ctx) return;
  const { run, enemy, weapon, save } = _ctx;
  const f = run.fight;
  if (!f) return;
  if (success) {
    f.enemyHp = Math.max(0, f.enemyHp - weapon.dmg);
    _setBars();
    _feedback('💥 Treffer! −' + weapon.dmg);
    try { playSfx('correct'); } catch (e) {}
    if (f.enemyHp <= 0) { run.fight = null; save(); _endScreen(true); return; }
  } else {
    run.hp = Math.max(0, run.hp - enemy.dmg);
    _setBars();
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
