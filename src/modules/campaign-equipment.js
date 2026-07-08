// src/modules/campaign-equipment.js
// Ausrüstung der Kampagne (Phase 3): 9 Slots, Inventar, Baupläne, Erz.
// Alles lebt unter SD.campaign (profiles.campaign jsonb) — kein neuer Sync-Pfad.
//
// Waffen sind KEINE Inventar-Items: sie kommen automatisch aus der Schmiede
// (Schaden = WEAPON_BASE_DMG + fertige Teile); im Waffen-Slot wählt man eine
// geschmiedete Waffe oder „Auto" (beste). Alle anderen Slots tragen Items aus
// dem Inventar, die über Baupläne entstehen: 💎/Boss droppen Baupläne, ein
// Bauplan hat 5 Teile — +1 Teil je abgeschlossener Schmiede-Runde mit ≥ 80 %
// (Hook window._campaignForgeRound in game.js showEnd), oder 1 Erz = 1 Teil.

import { FIST_DMG, WEAPON_BASE_DMG, EQUIP_EFFECT, RING_ORE_BONUS, TREASURE_ORE_CHANCE, TREASURE_ORE_AMOUNT, BOSS_ORE_AMOUNT, BP_TIER_GOLD, BP_TIER_ENCH, BP_PARTS, BP_ROUND_PCT } from './campaign-balance.js';
import { getConstellations, forgeObject } from './irregular-verbs.js';
import { starLit, SLOTS_PER_FORM } from './irregular-game.js';
import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';

const SLOTS = {
  weapon:    { icon: '⚔️', name: 'Waffe',       desc: 'Schaden pro gewonnener Welle' },
  head:      { icon: '🪖', name: 'Helm',        desc: 'wehrt 1 verlorene Welle pro Kampf ab' },
  body:      { icon: '🛡️', name: 'Rüstung',     desc: 'mehr HP' },
  arms:      { icon: '🧤', name: 'Handschuhe',  desc: 'mehr Zeit pro Minispiel' },
  legs:      { icon: '🥾', name: 'Stiefel',     desc: 'Chance auszuweichen' },
  talisman:  { icon: '🧿', name: 'Talisman',    desc: '+50 % Schaden an 🌀-Knoten' },
  ring1:     { icon: '💍', name: 'Ring',        desc: 'bessere Schätze' },
  ring2:     { icon: '💍', name: 'Ring',        desc: 'bessere Schätze' },
  companion: { icon: '🐾', name: 'Gefährte',    desc: 'fängt 1 Fehlgriff pro Kampf' },
};
const SLOT_TYPE = { ring1: 'ring', ring2: 'ring' };   // sonst = Slot-Key selbst
const TIER = {
  stahl:      { icon: '🔩', name: 'Stahl',      rank: 1 },
  gold:       { icon: '🥇', name: 'Gold',       rank: 2 },
  verzaubert: { icon: '✨', name: 'Verzaubert', rank: 3 },
};
const TIER_ORDER = ['stahl', 'gold', 'verzaubert'];
const ITEM_BASE = {
  head: { icon: '🪖', name: 'Helm' }, body: { icon: '🛡️', name: 'Rüstung' },
  arms: { icon: '🧤', name: 'Handschuhe' }, legs: { icon: '🥾', name: 'Stiefel' },
  talisman: { icon: '🧿', name: 'Talisman' }, ring: { icon: '💍', name: 'Ring' },
  companion: { icon: '🐾', name: 'Gefährte' },
};
const COMPANION_ICON = { stahl: '🐭', gold: '🦊', verzaubert: '🐉' };
// Bauplan-Slots (Waffe kommt aus der Schmiede); Helm nie in Stahl (hätte keinen Effekt).
const BP_SLOTS = ['head', 'body', 'arms', 'legs', 'talisman', 'ring', 'companion'];

// ── SD-Zugriff (mit Default-Reparatur, wie campaign.js _camp) ────────────────
function _eq() {
  const SD = window.SD;
  if (!SD.campaign || typeof SD.campaign !== 'object') SD.campaign = { claimed: [], talerSpent: 0, run: null };
  const c = SD.campaign;
  if (!c.equipment || typeof c.equipment !== 'object') c.equipment = {};
  if (!Array.isArray(c.inventory)) c.inventory = [];
  if (!Array.isArray(c.blueprints)) c.blueprints = [];
  if (typeof c.ore !== 'number') c.ore = 0;
  return c;
}
function _save() {
  persist(window.SD);
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}
const _id = () => 'i' + Date.now() + Math.random().toString(36).slice(2, 6);

function _itemIcon(it) { return it.slot === 'companion' ? COMPANION_ICON[it.tier] : ITEM_BASE[it.slot].icon; }
function _itemLabel(it) { return `${_itemIcon(it)} ${TIER[it.tier].name}-${ITEM_BASE[it.slot].name}`; }

// ── Waffen aus der Schmiede ──────────────────────────────────────────────────
export function forgedWeapons() {
  const out = [];
  for (const c of getConstellations()) {
    for (const which of ['past', 'pp']) {
      let lit = 0;
      for (let i = 0; i < SLOTS_PER_FORM; i++) if (starLit(c.verbs, `_${which}_s${i}`)) lit++;
      if (!lit) continue;
      const ob = forgeObject(c.idx, which);
      out.push({
        id: `w:${c.idx}:${which}`, dmg: WEAPON_BASE_DMG + lit, parts: lit,
        icon: ob.icon, name: `${ob.name} (${c.name})`, which,   // which: Stahl=past, Gold=pp
      });
    }
  }
  return out;
}

// Angelegte Waffe — Auswahl aus dem Waffen-Slot, sonst automatisch die beste;
// ganz ohne Schmiede-Fortschritt kämpft die Faust.
export function equippedWeapon() {
  const c = _eq();
  const ws = forgedWeapons();
  const sel = ws.find(w => w.id === c.equipment.weapon);
  if (sel) return sel;
  let best = { dmg: FIST_DMG, icon: '👊', name: 'Faust', which: null };
  for (const w of ws) if (w.dmg > best.dmg) best = w;
  return best;
}

// ── Effekte der angelegten Items (vom Kampf & den Drops gelesen) ─────────────
export function equipEffects() {
  const c = _eq();
  const get = (k) => c.inventory.find(i => i.id === c.equipment[k]);
  const eff = { hpBonus: 0, timeBonusMs: 0, dodge: 0, headGuard: false, talisman: false, companion: false, oreBonus: 0, bpBump: 0 };
  const body = get('body'); if (body) eff.hpBonus = EQUIP_EFFECT.body[body.tier] || 0;
  const arms = get('arms'); if (arms) eff.timeBonusMs = EQUIP_EFFECT.arms[arms.tier] || 0;
  const legs = get('legs'); if (legs) eff.dodge = EQUIP_EFFECT.legs[legs.tier] || 0;
  eff.headGuard = !!get('head');
  eff.talisman = !!get('talisman');
  eff.companion = !!get('companion');
  [get('ring1'), get('ring2')].forEach(r => {
    if (!r) return;
    eff.oreBonus += RING_ORE_BONUS;
    if (r.tier === 'verzaubert') eff.bpBump = 1;
  });
  return eff;
}

// ── Drops (💎-Schatz & Boss) ─────────────────────────────────────────────────
function _rollTier(bump) {
  const roll = Math.random();
  let idx = roll < BP_TIER_ENCH ? 2 : roll < BP_TIER_ENCH + BP_TIER_GOLD ? 1 : 0;
  idx = Math.min(2, idx + (bump || 0));
  return TIER_ORDER[idx];
}
function _newBlueprint(bump) {
  const slot = BP_SLOTS[Math.floor(Math.random() * BP_SLOTS.length)];
  let tier = _rollTier(bump);
  if (slot === 'head' && tier === 'stahl') tier = 'gold';   // Stahl-Helm hätte keinen Effekt
  return { id: _id(), slot, tier, done: 0 };
}
function _bpText(bp) { return `${_itemIcon(bp)} Bauplan: ${TIER[bp.tier].name}-${ITEM_BASE[bp.slot].name}`; }

export function rollTreasure() {
  const c = _eq();
  const eff = equipEffects();
  if (Math.random() < TREASURE_ORE_CHANCE + eff.oreBonus) {
    c.ore += TREASURE_ORE_AMOUNT;
    return { icon: '⛏️', title: 'Erz gefunden!', body: `Du findest <b>${TREASURE_ORE_AMOUNT} Erz</b>. Damit kannst du in der Ausrüstung Bauplan-Teile sofort fertigstellen.` };
  }
  const bp = _newBlueprint(eff.bpBump);
  c.blueprints.push(bp);
  return { icon: '📜', title: 'Bauplan gefunden!', body: `${_bpText(bp)}<br><br>Stell ihn fertig: gute Schmiede-Runden (≥ ${Math.round(BP_ROUND_PCT * 100)} %) oder Erz geben je 1 Teil (🎒 Ausrüstung).` };
}

export function rollBossDrop() {
  const c = _eq();
  const eff = equipEffects();
  const bp = _newBlueprint(1 + eff.bpBump);   // Boss-Baupläne 1 Stufe besser
  c.blueprints.push(bp);
  c.ore += BOSS_ORE_AMOUNT;
  return { body: `Beute: ${_bpText(bp)} + ⛏️ ${BOSS_ORE_AMOUNT} Erz` };
}

// ── Bauplan-Fortschritt ──────────────────────────────────────────────────────
function _activeBp(c) {
  return c.blueprints.find(b => b.id === c.activeBlueprint) || c.blueprints[0] || null;
}
function _completeBp(c, bp) {
  c.blueprints = c.blueprints.filter(b => b.id !== bp.id);
  const item = { id: _id(), slot: bp.slot, tier: bp.tier, source: 'blueprint' };
  c.inventory.push(item);
  window.esToast?.(`🎉 ${_itemLabel(item)} fertig — im 🎒 anlegen!`);
}

// Hook aus game.js showEnd: jede ABGESCHLOSSENE Schmiede-Runde (UV) mit guter
// Quote härtet den aktiven Bauplan um 1 Teil.
export function forgeRoundCredit(pct) {
  const c = _eq();
  const bp = _activeBp(c);
  if (!bp || !(pct >= BP_ROUND_PCT)) return;
  bp.done++;
  if (bp.done >= BP_PARTS) _completeBp(c, bp);
  else window.esToast?.(`⚒️ ${_bpText(bp)}: Teil ${bp.done}/${BP_PARTS}`);
  _save();
}

export function useOre(bpId) {
  const c = _eq();
  const bp = c.blueprints.find(b => b.id === bpId);
  if (!bp || c.ore < 1) return;
  c.ore--;
  bp.done++;
  if (bp.done >= BP_PARTS) _completeBp(c, bp);
  _save();
}

// ── Ausrüstungs-Overlay ──────────────────────────────────────────────────────
let _openSlotKey = null;
let _onClose = null;

export function openEquipment(opts = {}) {
  _onClose = opts.onClose || null;
  _openSlotKey = null;
  _renderEq();
}

function _renderEq() {
  let ov = document.getElementById('ce-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ce-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:8000;background:linear-gradient(180deg,#2b2350,#1a1533);overflow-y:auto;padding:14px;';
    ov.addEventListener('click', _onClick);
    document.body.appendChild(ov);
  }
  const c = _eq();
  let html = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <button data-act="close" style="border:none;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;width:36px;height:36px;font-size:1rem;cursor:pointer;flex-shrink:0;">✖</button>
      <div style="font-family:'Fredoka One',cursive;color:#fff;font-size:1.1rem;flex:1;">🎒 Ausrüstung</div>
      <div style="font-family:'Fredoka One',cursive;color:#ffd43b;font-size:.9rem;">⛏️ ${c.ore} Erz</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">`;
  for (const key in SLOTS) html += _slotCard(c, key);
  html += '</div>';
  if (_openSlotKey) html += _pickerHtml(c, _openSlotKey);
  html += _effectsHtml();
  html += _blueprintsHtml(c);
  ov.innerHTML = html;
}

function _slotCard(c, key) {
  const meta = SLOTS[key];
  let label;
  if (key === 'weapon') {
    const w = equippedWeapon();
    label = `${w.icon} ${w.dmg} Schaden`;
  } else {
    const it = c.inventory.find(i => i.id === c.equipment[key]);
    label = it ? `${_itemIcon(it)} ${TIER[it.tier].name}` : '— leer —';
  }
  const open = _openSlotKey === key;
  return `<button data-act="slot" data-slot="${key}" style="border:${open ? '2px solid #ffd43b' : '2px solid rgba(255,255,255,.15)'};
    background:rgba(255,255,255,.08);border-radius:14px;padding:10px 6px;cursor:pointer;text-align:center;">
    <div style="font-size:1.5rem;">${meta.icon}</div>
    <div style="font-family:'Fredoka One',cursive;font-size:.68rem;color:#fff;margin:2px 0;">${meta.name}</div>
    <div style="font-size:.68rem;font-weight:700;color:rgba(255,255,255,.65);">${label}</div>
  </button>`;
}

function _pickerHtml(c, key) {
  const meta = SLOTS[key];
  let rows = '';
  if (key === 'weapon') {
    const cur = c.equipment.weapon || '';
    rows += _pickRow('', '👊 Auto — beste geschmiedete Waffe (sonst Faust)', cur === '');
    for (const w of forgedWeapons()) rows += _pickRow(w.id, `${w.icon} ${w.name} — ${w.dmg} Schaden (${w.parts}/${SLOTS_PER_FORM} Teile, ${w.which === 'past' ? '🔩 Stahl' : '🥇 Gold'})`, cur === w.id);
  } else {
    const type = SLOT_TYPE[key] || key;
    const items = c.inventory.filter(i => i.slot === type);
    rows += _pickRow('', '— nichts anlegen —', !c.equipment[key]);
    for (const it of items) {
      const usedElsewhere = Object.keys(SLOTS).some(k => k !== key && c.equipment[k] === it.id);
      if (usedElsewhere) continue;   // ein Item nur in einem Slot (relevant für Ringe)
      rows += _pickRow(it.id, _itemLabel(it), c.equipment[key] === it.id);
    }
    if (!items.length) rows += `<div style="font-size:.78rem;font-weight:700;color:rgba(255,255,255,.55);padding:6px 10px;">Noch nichts im Inventar — 💎-Knoten und Bosse lassen Baupläne fallen.</div>`;
  }
  return `<div style="background:rgba(255,255,255,.08);border-radius:14px;padding:10px;margin-top:8px;">
    <div style="font-size:.75rem;font-weight:800;color:#ffd43b;margin-bottom:6px;">${meta.icon} ${meta.name} — ${meta.desc}</div>${rows}</div>`;
}
function _pickRow(id, label, selected) {
  return `<button data-act="equip" data-id="${id}" style="display:block;width:100%;text-align:left;border:none;cursor:pointer;
    background:${selected ? 'rgba(255,212,59,.25)' : 'rgba(255,255,255,.08)'};color:#fff;font-weight:700;font-size:.82rem;
    padding:9px 10px;border-radius:10px;margin-bottom:4px;">${selected ? '✅ ' : ''}${label}</button>`;
}

function _effectsHtml() {
  const eff = equipEffects();
  const w = equippedWeapon();
  const parts = [`⚔️ ${w.dmg} Schaden`];
  if (eff.hpBonus) parts.push(`❤️ +${eff.hpBonus} HP`);
  if (eff.timeBonusMs) parts.push(`⏱️ +${eff.timeBonusMs / 1000} s`);
  if (eff.dodge) parts.push(`🍃 ${Math.round(eff.dodge * 100)} % Ausweichen`);
  if (eff.headGuard) parts.push('🪖 1 Welle abgewehrt');
  if (eff.talisman) parts.push('🧿 +50 % an 🌀');
  if (eff.oreBonus) parts.push(`⛏️ +${Math.round(eff.oreBonus * 100)} % Erz`);
  if (eff.bpBump) parts.push('📜 Baupläne +1 Stufe');
  if (eff.companion) parts.push('🐾 1 Fehlgriff gefangen');
  return `<div style="font-size:.78rem;font-weight:700;color:rgba(255,255,255,.75);text-align:center;margin:12px 0;">${parts.join(' · ')}</div>`;
}

function _blueprintsHtml(c) {
  let html = `<div style="font-family:'Fredoka One',cursive;color:#fff;font-size:.95rem;margin:6px 0 4px;">📜 Baupläne</div>
    <div style="font-size:.74rem;font-weight:700;color:rgba(255,255,255,.55);margin-bottom:8px;">Der aktive Bauplan bekommt +1 Teil für jede fertige Schmiede-Runde mit ≥ ${Math.round(BP_ROUND_PCT * 100)} % — oder setze ⛏️ Erz ein.</div>`;
  if (!c.blueprints.length) {
    return html + `<div style="font-size:.8rem;font-weight:700;color:rgba(255,255,255,.55);">Keine Baupläne — 💎-Knoten und Bosse lassen welche fallen.</div>`;
  }
  const activeId = _activeBp(c)?.id;
  for (const bp of c.blueprints) {
    const active = bp.id === activeId;
    html += `<div style="background:rgba(255,255,255,.08);border-radius:12px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:.82rem;font-weight:800;color:#fff;">${_bpText(bp)}</div>
        <div style="height:8px;background:rgba(255,255,255,.15);border-radius:5px;overflow:hidden;margin-top:5px;"><div style="height:100%;width:${bp.done / BP_PARTS * 100}%;background:linear-gradient(90deg,#ffd43b,#f0a500);"></div></div>
        <div style="font-size:.7rem;font-weight:700;color:rgba(255,255,255,.6);margin-top:3px;">Teile: ${bp.done}/${BP_PARTS}</div>
      </div>
      <button data-act="bpactive" data-id="${bp.id}" style="border:none;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:.72rem;font-weight:800;
        background:${active ? '#ffd43b' : 'rgba(255,255,255,.15)'};color:${active ? '#5c4400' : '#fff'};">${active ? '⚒️ aktiv' : 'aktivieren'}</button>
      <button data-act="bpore" data-id="${bp.id}" ${c.ore < 1 ? 'disabled' : ''} style="border:none;border-radius:10px;padding:8px 10px;cursor:${c.ore < 1 ? 'not-allowed' : 'pointer'};
        font-size:.72rem;font-weight:800;background:${c.ore < 1 ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.2)'};color:#fff;">⛏️ +1</button>
    </div>`;
  }
  return html;
}

function _onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const c = _eq();
  const act = t.dataset.act;
  if (act === 'close') {
    document.getElementById('ce-overlay')?.remove();
    const cb = _onClose; _onClose = null;
    if (cb) cb();
  } else if (act === 'slot') {
    _openSlotKey = _openSlotKey === t.dataset.slot ? null : t.dataset.slot;
    _renderEq();
  } else if (act === 'equip') {
    if (_openSlotKey) c.equipment[_openSlotKey] = t.dataset.id || null;
    _save();
    _renderEq();
  } else if (act === 'bpactive') {
    c.activeBlueprint = t.dataset.id;
    _save();
    _renderEq();
  } else if (act === 'bpore') {
    useOre(t.dataset.id);
    _renderEq();
  }
}
