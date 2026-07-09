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
import { avatarSVG, ensureAvatar, itemSpriteSVG } from './avatar.js';
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

// ── Ausrüstungs-Panel im Profil (WoW-artiges Paperdoll + Inventar) ───────────
// Links/rechts Slot-Kacheln, in der Mitte der Charakter MIT angelegter
// Ausrüstung (Pixel-Gear-Layer aus avatar.js), Waffe darunter. Darunter das
// Inventar aller geschmiedeten Items — antippen legt an / ab.

const PD_LEFT = ['head', 'body', 'arms', 'legs'];
const PD_RIGHT = ['talisman', 'ring1', 'ring2', 'companion'];

// Angelegte Items als gear-Map für den Sprite (avatarSVG opts.gear).
function _gearMap(c) {
  const get = (k) => {
    const it = _itemById(c.equipment[k]);
    return (it && it.slot === (SLOT_TYPE[k] || k)) ? it : null;
  };
  const g = {};
  for (const k of ['head', 'body', 'arms', 'legs', 'talisman', 'companion']) {
    const it = get(k);
    if (it) g[k] = it;
  }
  g.ring = get('ring1') || get('ring2') || undefined;
  const w = equippedWeapon();
  if (w.type) g.weapon = w;
  return g;
}

function _slotTile(c, key) {
  const meta = SLOTS[key];
  let inner, filled = false, title = `${meta.name} — ${meta.desc}`;
  if (key === 'weapon') {
    const w = equippedWeapon();
    if (w.type) {
      inner = itemSpriteSVG(w.type, w.tier);
      filled = true;
      title = `${w.name} · ${w.dmg} Schaden${WEAPON_PERK[w.type] ? ' · ' + WEAPON_PERK[w.type].text : ''}`;
    } else inner = `<span class="pd-ghost">${meta.icon}</span>`;
  } else {
    const it = _itemById(c.equipment[key]);
    if (it && it.slot === (SLOT_TYPE[key] || key)) {
      inner = itemSpriteSVG(it.type, it.tier);
      filled = true;
      title = `${it.name} (${it.parts}/${SLOTS_PER_FORM} Teile) — antippen zum Ablegen`;
    } else inner = `<span class="pd-ghost">${meta.icon}</span>`;
  }
  return `<button class="pd-slot${filled ? ' filled' : ''}" data-slot="${key}" title="${title}">${inner}
    <span class="pd-slot-nm">${meta.name}</span></button>`;
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
  return `<div class="pd-fx">${parts.join(' · ')}</div>`;
}

export function renderEquipmentPanel() {
  const host = document.getElementById('prof-equip-section');
  if (!host) return;
  const c = _eq();
  const items = forgedItems();
  const equippedIds = new Set(Object.values(c.equipment).filter(Boolean));
  const autoWeaponId = !c.equipment.weapon ? equippedWeapon().id : null;

  // Tasche: immer ein Slot-Raster zeigen — geschmiedete Items füllen es von
  // links, der Rest bleibt als leere (gestrichelte) Plätze sichtbar.
  let inv = items.map(it => {
    const on = equippedIds.has(it.id) || it.id === autoWeaponId;
    const perk = it.slot === 'weapon' && WEAPON_PERK[it.type] ? ' · ' + WEAPON_PERK[it.type].text : '';
    return `<button class="pd-item${on ? ' on' : ''}" data-item="${it.id}"
      title="${it.name} (${it.parts}/${SLOTS_PER_FORM} Teile, ${it.station})${perk}">
      ${itemSpriteSVG(it.type, it.tier)}
    </button>`;
  }).join('');
  const bagSize = Math.max(10, Math.ceil(items.length / 5) * 5);
  for (let i = items.length; i < bagSize; i++) inv += `<div class="pd-item empty" title="Leerer Platz — schmiede etwas in der ⚒️ Schmiede"></div>`;
  const emptyHint = items.length ? '' : `<div class="pd-empty">Deine Tasche ist noch leer — wähle in der ⚒️ Schmiede beim Befüllen ein Objekt (Waffe oder Rüstungsteil) und übe seine Verben, dann taucht es hier auf.</div>`;

  host.innerHTML = `
    <h3 style="color:var(--purple);margin-top:0">🧰 Ausrüstung</h3>
    <div class="pd-wrap">
      <div class="pd-col">${PD_LEFT.map(k => _slotTile(c, k)).join('')}</div>
      <div class="pd-center">
        <div class="pd-avatar">${avatarSVG(ensureAvatar(window.SD), { gear: _gearMap(c) })}</div>
        ${_slotTile(c, 'weapon')}
      </div>
      <div class="pd-col">${PD_RIGHT.map(k => _slotTile(c, k)).join('')}</div>
    </div>
    ${_effectsHtml()}
    <div class="pd-inv-title">🎒 Tasche</div>
    <div class="pd-inv">${inv}</div>
    ${emptyHint}
    <div class="pd-hint">Antippen legt an bzw. ab · 🔩 Stahl = Simple Past · 🥇 Gold = Past Participle · ✨ Verzaubert = alle 5 Teile</div>`;

  if (!host._pdWired) {
    host._pdWired = true;
    host.addEventListener('click', _onPanelClick);
  }
}

function _onPanelClick(e) {
  const c = _eq();
  const itemBtn = e.target.closest('[data-item]');
  if (itemBtn) {
    const it = _itemById(itemBtn.dataset.item);
    if (!it) return;
    // Bereits angelegt → ablegen; sonst in den passenden Slot legen.
    const wornKey = Object.keys(SLOTS).find(k => c.equipment[k] === it.id);
    if (wornKey) c.equipment[wornKey] = null;
    else if (it.slot === 'ring') {
      const r1 = _itemById(c.equipment.ring1), r2 = _itemById(c.equipment.ring2);
      c.equipment[!r1 ? 'ring1' : !r2 ? 'ring2' : 'ring1'] = it.id;
    } else {
      c.equipment[it.slot] = it.id;
    }
    _save();
    renderEquipmentPanel();
    return;
  }
  const slotBtn = e.target.closest('[data-slot]');
  if (slotBtn) {
    const key = slotBtn.dataset.slot;
    if (c.equipment[key]) {
      c.equipment[key] = null;   // Waffe ohne Auswahl = Auto (beste)
      _save();
      renderEquipmentPanel();
    }
  }
}
