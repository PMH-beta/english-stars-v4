// src/modules/campaign-equipment.js
// Ausrüstung der Kampagne: 9 Slots, ALLE Items kommen aus der Schmiede.
// Es gibt KEIN Inventar und KEINE Baupläne: Items werden live aus dem
// Schmiede-Stand abgeleitet (wie Waffen seit Phase 1) — eine Station baut das
// vom Kind gewählte Objekt (Waffe ODER Rüstungsteil) in zwei Materialien:
// 🔩 Stahl (Simple Past) und 🥇 Gold (Past Participle); alle 5 Teile fertig
// (inkl. Verzaubern-Slot) = ✨ Verzaubert. Angelegt wird per Item-Id
// `f:<stationIdx>:<past|pp>` in SD.campaign.equipment (profiles.campaign jsonb).
//
// Tränke (💎 Schatz): 3 zufällige zur Wahl, run-gebunden (run.potions), im
// Kampf spielbar — Definitionen hier, Kampf-Logik in campaign-fight.js.

import { FIST_DMG, WEAPON_BASE_DMG, EQUIP_EFFECT, RING_POTION_BONUS, COMPANION_GUARDS, WEAPON_PERK, PERK_SCHWERT_DMG, PERK_DOLCH_DODGE, PERK_STAB_MS, POTION_CHOICES, POTION_HEAL, POTION_POWER, POTION_TIME_MS, POTION_TIME_WAVES } from './campaign-balance.js';
import { getConstellations, forgeObject } from './irregular-verbs.js';
import { starLit, SLOTS_PER_FORM } from './irregular-game.js';
import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';

export const SLOTS = {
  weapon:    { icon: '⚔️', name: 'Waffe',       desc: 'Schaden pro gewonnener Welle' },
  head:      { icon: '🪖', name: 'Helm',        desc: 'wehrt verlorene Wellen ab (pro Kampf)' },
  body:      { icon: '🛡️', name: 'Rüstung',     desc: 'mehr HP' },
  arms:      { icon: '🧤', name: 'Handschuhe',  desc: 'mehr Zeit pro Minispiel' },
  legs:      { icon: '🥾', name: 'Stiefel',     desc: 'Chance auszuweichen' },
  talisman:  { icon: '🧿', name: 'Talisman',    desc: '+50 % Schaden an 🌀-Knoten' },
  ring1:     { icon: '💍', name: 'Ring',        desc: 'mehr Trank-Auswahl am 💎' },
  ring2:     { icon: '💍', name: 'Ring',        desc: 'mehr Trank-Auswahl am 💎' },
  companion: { icon: '🐾', name: 'Gefährte',    desc: 'fängt 1 Fehlgriff pro Kampf' },
};
const SLOT_TYPE = { ring1: 'ring', ring2: 'ring' };   // sonst = Slot-Key selbst
export const TIER = {
  stahl:      { icon: '🔩', name: 'Stahl' },
  gold:       { icon: '🥇', name: 'Gold' },
  verzaubert: { icon: '✨', name: 'Verzaubert' },
};

// Vorteil-Text eines Objekts (Objekt-Wahl in der Schmiede + Picker hier).
export function objectPerkText(ob) {
  if (ob.slot === 'weapon') return WEAPON_PERK[ob.type]?.text || '';
  const slotKey = ob.slot === 'ring' ? 'ring1' : ob.slot === 'companion' ? 'companion' : ob.slot;
  return SLOTS[slotKey]?.desc || '';
}

// ── SD-Zugriff (mit Default-Reparatur, wie campaign.js _camp) ────────────────
function _eq() {
  const SD = window.SD;
  if (!SD.campaign || typeof SD.campaign !== 'object') SD.campaign = { claimed: [], talerSpent: 0, run: null };
  const c = SD.campaign;
  if (!c.equipment || typeof c.equipment !== 'object') c.equipment = {};
  return c;
}
function _save() {
  persist(window.SD);
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}

// ── Geschmiedete Items (live abgeleitet, keine Persistenz) ───────────────────
// Pro Station × Form ein Item, sobald ≥1 Teil fertig ist. Stufe: Stahl (past) /
// Gold (pp), Verzaubert wenn alle 5 Teile fertig. Waffen: Schaden = Basis + Teile
// (+ Schwert-Vorteil).
export function forgedItems() {
  const out = [];
  for (const c of getConstellations()) {
    for (const which of ['past', 'pp']) {
      let lit = 0;
      for (let i = 0; i < SLOTS_PER_FORM; i++) if (starLit(c.verbs, `_${which}_s${i}`)) lit++;
      if (!lit) continue;
      const ob = forgeObject(c.idx, which);
      const tier = lit >= SLOTS_PER_FORM ? 'verzaubert' : (which === 'past' ? 'stahl' : 'gold');
      const item = {
        id: `f:${c.idx}:${which}`,
        type: ob.type, slot: ob.slot, icon: ob.icon,
        name: `${TIER[tier].name}-${ob.name}`,
        station: c.name, which, tier, parts: lit,
      };
      if (ob.slot === 'weapon') {
        item.dmg = WEAPON_BASE_DMG + lit + (ob.type === 'schwert' ? PERK_SCHWERT_DMG : 0);
      }
      out.push(item);
    }
  }
  return out;
}
function _itemById(id) { return id ? forgedItems().find(i => i.id === id) : null; }

// Angelegte Waffe — Auswahl aus dem Waffen-Slot, sonst automatisch die beste;
// ganz ohne Schmiede-Fortschritt kämpft die Faust.
export function equippedWeapon() {
  const c = _eq();
  const sel = _itemById(c.equipment.weapon);
  if (sel && sel.slot === 'weapon') return sel;
  let best = { dmg: FIST_DMG, icon: '👊', name: 'Faust', type: null, which: null, parts: 0 };
  for (const w of forgedItems()) if (w.slot === 'weapon' && w.dmg > best.dmg) best = w;
  return best;
}

// ── Effekte der angelegten Items (vom Kampf & den Drops gelesen) ─────────────
export function equipEffects() {
  const c = _eq();
  const get = (k) => {
    const it = _itemById(c.equipment[k]);
    return (it && it.slot === (SLOT_TYPE[k] || k)) ? it : null;
  };
  const eff = { hpBonus: 0, timeBonusMs: 0, dodge: 0, headGuards: 0, talisman: false, companionGuards: 0, potionBonus: 0 };
  const head = get('head'); if (head) eff.headGuards = EQUIP_EFFECT.head[head.tier] || 0;
  const body = get('body'); if (body) eff.hpBonus = EQUIP_EFFECT.body[body.tier] || 0;
  const arms = get('arms'); if (arms) eff.timeBonusMs = EQUIP_EFFECT.arms[arms.tier] || 0;
  const legs = get('legs'); if (legs) eff.dodge = EQUIP_EFFECT.legs[legs.tier] || 0;
  eff.talisman = !!get('talisman');
  if (get('companion')) eff.companionGuards = COMPANION_GUARDS;
  if (get('ring1')) eff.potionBonus += RING_POTION_BONUS;
  if (get('ring2')) eff.potionBonus += RING_POTION_BONUS;
  // Waffen-Typ-Vorteile, die wie Ausrüstung wirken (Dolch/Stab).
  const w = equippedWeapon();
  if (w.type === 'dolch') eff.dodge += PERK_DOLCH_DODGE;
  if (w.type === 'stab') eff.timeBonusMs += PERK_STAB_MS;
  return eff;
}

// ── Tränke ───────────────────────────────────────────────────────────────────
export const POTIONS = {
  heal:   { icon: '❤️', name: 'Heiltrank',   desc: `+${POTION_HEAL} HP sofort` },
  shield: { icon: '🛡️', name: 'Schildtrank', desc: 'wehrt die nächste verlorene Welle ab' },
  power:  { icon: '💪', name: 'Krafttrank',  desc: `+${POTION_POWER} Schaden bis Kampfende` },
  time:   { icon: '⏳', name: 'Zeittrank',   desc: `+${POTION_TIME_MS / 1000} s Zeit für ${POTION_TIME_WAVES} Wellen` },
};

// 💎 Schatz: Wahl-Overlay mit 3 (+ Ring-Bonus) zufälligen Tränken. onPick(key)
// bekommt die Wahl — Zustand (run.potions) verwaltet der Aufrufer (campaign.js).
export function openPotionChoice({ onPick }) {
  const keys = Object.keys(POTIONS);
  for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  const n = Math.min(keys.length, POTION_CHOICES + equipEffects().potionBonus);
  const choices = keys.slice(0, n);
  const ov = document.createElement('div');
  ov.className = 'adv-backdrop';
  ov.innerHTML = `<div class="adv-card">
    <div class="adv-card-icon">💎</div>
    <div class="adv-card-title">Schatz gefunden!</div>
    <div class="adv-card-sub">Wähle einen Trank für diesen Lauf:</div>
    ${choices.map(k => `<button class="adv-choice" data-potion="${k}">
      <span class="adv-choice-icon">${POTIONS[k].icon}</span>
      <span class="adv-choice-txt"><b>${POTIONS[k].name}</b><br><span>${POTIONS[k].desc}</span></span>
    </button>`).join('')}
  </div>`;
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-potion]');
    if (!b) return;
    ov.remove();
    onPick(b.dataset.potion);
  });
  document.body.appendChild(ov);
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
    ov.className = 'adv-screen';
    ov.addEventListener('click', _onClick);
    document.body.appendChild(ov);
  }
  const c = _eq();
  let html = `
    <div class="adv-head">
      <button class="adv-x" data-act="close">✖</button>
      <div class="adv-head-title">🎒 Ausrüstung</div>
    </div>
    <div class="ce-grid">`;
  for (const key in SLOTS) html += _slotCard(c, key);
  html += '</div>';
  if (_openSlotKey) html += _pickerHtml(c, _openSlotKey);
  html += _effectsHtml();
  html += `<div class="adv-hint">Alle Teile entstehen in der ⚒️ Schmiede: wähle dort beim Befüllen ein Objekt (Waffe oder Rüstung) — 🔩 Stahl = Simple Past, 🥇 Gold = Past Participle, ✨ Verzaubert = alle 5 Teile fertig.</div>`;
  ov.innerHTML = html;
}

function _slotCard(c, key) {
  const meta = SLOTS[key];
  let label;
  if (key === 'weapon') {
    const w = equippedWeapon();
    label = `${w.icon} ${w.dmg} Schaden`;
  } else {
    const it = _itemById(c.equipment[key]);
    label = (it && it.slot === (SLOT_TYPE[key] || key)) ? `${TIER[it.tier].icon} ${TIER[it.tier].name}` : '— leer —';
  }
  return `<button class="ce-slot${_openSlotKey === key ? ' open' : ''}" data-act="slot" data-slot="${key}">
    <div class="ce-slot-ic">${meta.icon}</div>
    <div class="ce-slot-nm">${meta.name}</div>
    <div class="ce-slot-it">${label}</div>
  </button>`;
}

function _pickerHtml(c, key) {
  const meta = SLOTS[key];
  const type = SLOT_TYPE[key] || key;
  const items = forgedItems().filter(i => i.slot === type);
  let rows = '';
  if (key === 'weapon') {
    rows += _pickRow('', '👊 Auto — beste geschmiedete Waffe (sonst Faust)', !c.equipment.weapon);
    for (const w of items) {
      const perk = WEAPON_PERK[w.type]?.text;
      rows += _pickRow(w.id, `${w.icon} ${w.name} · ${w.dmg} Schaden (${w.parts}/${SLOTS_PER_FORM})${perk ? ` · ${perk}` : ''}`, c.equipment.weapon === w.id);
    }
  } else {
    rows += _pickRow('', '— nichts anlegen —', !c.equipment[key]);
    for (const it of items) {
      const usedElsewhere = Object.keys(SLOTS).some(k => k !== key && c.equipment[k] === it.id);
      if (usedElsewhere) continue;   // ein Item nur in einem Slot (relevant für Ringe)
      rows += _pickRow(it.id, `${it.icon} ${it.name} (${it.parts}/${SLOTS_PER_FORM} Teile)`, c.equipment[key] === it.id);
    }
  }
  if (!items.length) rows += `<div class="adv-hint" style="text-align:left;">Noch nichts geschmiedet — wähle in der ⚒️ Schmiede beim Befüllen „${meta.name}" als Objekt.</div>`;
  return `<div class="ce-picker">
    <div class="ce-picker-head">${meta.icon} ${meta.name} — ${meta.desc}</div>${rows}</div>`;
}
function _pickRow(id, label, selected) {
  return `<button class="ce-pick${selected ? ' sel' : ''}" data-act="equip" data-id="${id}">${selected ? '✅ ' : ''}${label}</button>`;
}

function _effectsHtml() {
  const eff = equipEffects();
  const w = equippedWeapon();
  const parts = [`⚔️ ${w.dmg} Schaden`];
  if (w.type && WEAPON_PERK[w.type]) parts.push(`${w.icon} ${WEAPON_PERK[w.type].text}`);
  if (eff.hpBonus) parts.push(`❤️ +${eff.hpBonus} HP`);
  if (eff.timeBonusMs) parts.push(`⏱️ +${eff.timeBonusMs / 1000} s`);
  if (eff.dodge) parts.push(`🍃 ${Math.round(eff.dodge * 100)} % Ausweichen`);
  if (eff.headGuards) parts.push(`🪖 ${eff.headGuards}× abgewehrt`);
  if (eff.talisman) parts.push('🧿 +50 % an 🌀');
  if (eff.potionBonus) parts.push(`💍 +${eff.potionBonus} Trank-Auswahl`);
  if (eff.companionGuards) parts.push('🐾 1 Fehlgriff gefangen');
  return `<div class="ce-effects">${parts.join(' · ')}</div>`;
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
  }
}
