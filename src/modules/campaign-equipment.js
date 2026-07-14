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

import { HP_MAX, FIST_DMG, WEAPON_BASE_DMG, FORM_BONUS, EQUIP_EFFECT, RING_POTION_BONUS, COMPANION_GUARDS, WEAPON_PERK, PERK_SCHWERT_DMG, PERK_DOLCH_DODGE, PERK_STAB_MS, PERK_KOLBEN_GUARD, POTION_CHOICES, POTION_HEAL, POTION_POWER, POTION_TIME_MS, POTION_TIME_WAVES } from './campaign-balance.js';
import { getConstellations, forgeObject, FORGE_OBJECTS } from './irregular-verbs.js';
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
      // Name trägt IMMER das Material (Stahl/Gold = Form) — „Verzaubert" ist nur
      // die Ausbaustufe (✨-Suffix), sonst wären zwei fertige Teile ununterscheidbar.
      const item = {
        id: `f:${c.idx}:${which}`,
        type: ob.type, slot: ob.slot, icon: ob.icon,
        name: `${which === 'past' ? 'Stahl' : 'Gold'}-${ob.name}${tier === 'verzaubert' ? ' ✨' : ''}`,
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
// ganz ohne Schmiede-Fortschritt kämpft die Faust. Parametrisiert über die
// equipment-Map, damit die Profil-Vorschau („was wäre wenn") mitrechnen kann.
function _weaponOf(equipment) {
  const sel = _itemById(equipment.weapon);
  if (sel && sel.slot === 'weapon') return sel;
  let best = { dmg: FIST_DMG, icon: '👊', name: 'Faust', type: null, which: null, parts: 0 };
  for (const w of forgedItems()) if (w.slot === 'weapon' && w.dmg > best.dmg) best = w;
  return best;
}
export function equippedWeapon() { return _weaponOf(_eq().equipment); }

// ── Effekte der angelegten Items (vom Kampf & den Drops gelesen) ─────────────
function _effectsOf(equipment) {
  const get = (k) => {
    const it = _itemById(equipment[k]);
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
  // Waffen-Typ-Vorteile, die wie Ausrüstung wirken (Dolch/Stab/Streitkolben).
  const w = _weaponOf(equipment);
  if (w.type === 'dolch') eff.dodge += PERK_DOLCH_DODGE;
  if (w.type === 'stab') eff.timeBonusMs += PERK_STAB_MS;
  if (w.type === 'streitkolben') eff.headGuards += PERK_KOLBEN_GUARD;
  return eff;
}
export function equipEffects() { return _effectsOf(_eq().equipment); }

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

// Angelegte Ausrüstung als gear-Map von außen (Kampf-Szene: Spieler-Sprite).
export function equippedGearMap() { return _gearMap(_eq()); }

// Immer genau EIN Slot ist angewählt (Start: Waffe) — die Liste unten zeigt
// dann alle schmiedbaren Teile für genau diesen Slot.
let _selSlot = 'weapon';

function _slotTile(c, key) {
  const meta = SLOTS[key];
  let inner, filled = false, title = `${meta.name} — ${meta.desc}`;
  if (key === 'weapon') {
    const w = equippedWeapon();
    if (w.type) {
      inner = itemSpriteSVG(w.type, w.tier, w.which);
      filled = true;
      title = `${w.name} · ${w.dmg} Schaden${WEAPON_PERK[w.type] ? ' · ' + WEAPON_PERK[w.type].text : ''}`;
    } else inner = `<span class="pd-ghost">${meta.icon}</span>`;
  } else {
    const it = _itemById(c.equipment[key]);
    if (it && it.slot === (SLOT_TYPE[key] || key)) {
      inner = itemSpriteSVG(it.type, it.tier, it.which);
      filled = true;
      title = `${it.name} (${it.parts}/${SLOTS_PER_FORM} Teile)`;
    } else inner = `<span class="pd-ghost">${meta.icon}</span>`;
  }
  return `<button class="pd-slot${filled ? ' filled' : ''}${key === _selSlot ? ' active' : ''}" data-slot="${key}" title="${title}">${inner}
    <span class="pd-slot-nm">${meta.name}</span></button>`;
}

// ── Kampf-Werte (echte Spielwerte, nicht nur Boni) ───────────────────────────
// Angezeigt als Kachel-Raster; bei angewähltem Item rechnet _statVals mit der
// Vorschau-equipment-Map und die geänderten Kacheln leuchten grün (bzw. rot).
const STAT_DEFS = [
  { key: 'dmg',      icon: '⚔️', label: 'Schaden',    fmt: v => String(v) },
  { key: 'hp',       icon: '❤️', label: 'Leben',      fmt: v => String(v) },
  { key: 'guards',   icon: '🪖', label: 'Abwehr',     fmt: v => v + '×' },
  { key: 'time',     icon: '⏱️', label: 'Extra-Zeit', fmt: v => '+' + v + 's' },
  { key: 'dodge',    icon: '🍃', label: 'Ausweichen', fmt: v => v + '%' },
  { key: 'potion',   icon: '🧪', label: 'Tränke',     fmt: v => String(v) },
  { key: 'talisman', icon: '🧿', label: '🌀-Bonus',   fmt: v => v ? '+50%' : '—' },
  { key: 'comp',     icon: '🐾', label: 'Gefährte',   fmt: v => v ? v + '×' : '—' },
];
function _statVals(equipment) {
  const eff = _effectsOf(equipment);
  const w = _weaponOf(equipment);
  return {
    dmg:      w.dmg,
    hp:       HP_MAX + eff.hpBonus,
    guards:   eff.headGuards,
    time:     eff.timeBonusMs / 1000,
    dodge:    Math.round(eff.dodge * 100),
    potion:   POTION_CHOICES + eff.potionBonus,
    talisman: eff.talisman ? 1 : 0,
    comp:     eff.companionGuards,
  };
}

// Angewähltes Taschen-Item (Klick) — Vorschau in Werten + „Anlegen"-Karte.
let _selId = null;
function _selectedItem() { return _itemById(_selId) || null; }

// equipment-Map, WENN das Item angelegt (bzw. ein getragenes abgelegt) würde.
function _previewEquipment(c, it) {
  const eq = { ...c.equipment };
  const wornKey = Object.keys(SLOTS).find(k => eq[k] === it.id);
  if (wornKey) { eq[wornKey] = null; return eq; }   // getragen → Vorschau fürs Ablegen
  if (it.slot === 'ring') {
    const r1 = _itemById(eq.ring1), r2 = _itemById(eq.ring2);
    eq[!r1 ? 'ring1' : !r2 ? 'ring2' : 'ring1'] = it.id;
  } else eq[it.slot] = it.id;
  return eq;
}

function _statsHtml(c) {
  const cur = _statVals(c.equipment);
  const sel = _selectedItem();
  const prev = sel ? _statVals(_previewEquipment(c, sel)) : null;
  const tiles = STAT_DEFS.map(d => {
    const a = cur[d.key], b = prev ? prev[d.key] : a;
    const chg = prev && b !== a;
    const cls = chg ? (b > a ? ' chg up' : ' chg down') : '';
    const val = chg ? `${d.fmt(a)} → ${d.fmt(b)}` : d.fmt(a);
    return `<div class="pd-stat${cls}"><span class="ic">${d.icon}</span><b>${val}</b><span>${d.label}</span></div>`;
  }).join('');
  const w = _weaponOf(c.equipment);
  const perk = (w.type && WEAPON_PERK[w.type]) ? `<div class="pd-fx">${w.icon} Waffen-Vorteil: ${WEAPON_PERK[w.type].text}</div>` : '';
  return `<div class="pd-stats">${tiles}</div>${perk}`;
}

// Karte unter der Tasche fürs angewählte Item: was es ist, was es verbessert,
// „Anlegen"/„Ablegen"-Knopf (einfacher Weg neben dem Ziehen).
function _previewHtml(c) {
  const it = _selectedItem();
  if (!it) return '';
  const wornKey = Object.keys(SLOTS).find(k => c.equipment[k] === it.id);
  const slotKey = it.slot === 'ring' ? 'ring1' : it.slot;
  const perk = it.slot === 'weapon'
    ? `${it.dmg} Schaden${WEAPON_PERK[it.type] ? ' · ' + WEAPON_PERK[it.type].text : ''}`
    : SLOTS[slotKey].desc;
  // Material-Zeile: macht den Unterschied Stahl/Gold sichtbar — bei Waffen mit
  // dem Formen-Bonus aus dem Kampf (Stahl wirkt auf Past-, Gold auf PP-Wellen).
  const mat = it.which === 'past'
    ? `🔩 Stahl (Simple Past)${it.slot === 'weapon' ? ` · +${FORM_BONUS} Schaden bei Simple-Past-Wellen` : ''}`
    : `🥇 Gold (Past Participle)${it.slot === 'weapon' ? ` · +${FORM_BONUS} Schaden bei Past-Participle-Wellen` : ''}`;
  return `<div class="pd-preview">
    <div class="pd-preview-sprite">${itemSpriteSVG(it.type, it.tier, it.which)}</div>
    <div class="pd-preview-info">
      <b>${it.name}</b>
      <span>${SLOTS[slotKey].icon} ${SLOTS[slotKey].name} · ${it.parts}/${SLOTS_PER_FORM} Teile · ${it.station}</span>
      <span>${mat}</span>
      <span class="pd-preview-perk">✨ ${perk}</span>
    </div>
    <button class="pd-equip-btn${wornKey ? ' off' : ''}" data-equip="${it.id}">${wornKey ? 'Ablegen' : 'Anlegen'}</button>
  </div>`;
}

export function renderEquipmentPanel() {
  const host = document.getElementById('prof-equip-section');
  if (!host) return;
  const c = _eq();
  const equippedIds = new Set(Object.values(c.equipment).filter(Boolean));
  const autoWeaponId = !c.equipment.weapon ? equippedWeapon().id : null;

  // Liste unten: nur Teile für den angewählten Slot. Plätze = wie viele Teile
  // es für diesen Slot überhaupt geben kann (schmiedbare Objekte × 2 Materialien
  // Stahl/Gold) — passt sich automatisch an, wenn FORGE_OBJECTS wächst.
  const slotType = SLOT_TYPE[_selSlot] || _selSlot;
  const bagItems = forgedItems().filter(i => i.slot === slotType);
  const capacity = FORGE_OBJECTS.filter(o => o.slot === slotType).length * 2;
  let inv = bagItems.map(it => {
    const on = equippedIds.has(it.id) || it.id === autoWeaponId;
    const sel = it.id === _selId;
    const perk = it.slot === 'weapon' && WEAPON_PERK[it.type] ? ' · ' + WEAPON_PERK[it.type].text : '';
    return `<button class="pd-item${on ? ' on' : ''}${sel ? ' sel' : ''}" data-item="${it.id}"
      title="${it.name} (${it.parts}/${SLOTS_PER_FORM} Teile, ${it.station})${perk}">
      ${itemSpriteSVG(it.type, it.tier, it.which)}
    </button>`;
  }).join('');
  for (let i = bagItems.length; i < capacity; i++) inv += `<div class="pd-item empty" title="Leerer Platz — schmiede etwas in der ⚒️ Schmiede"></div>`;
  const emptyHint = bagItems.length ? '' : `<div class="pd-empty">Noch kein ${SLOTS[_selSlot].name}-Teil geschmiedet — wähle in der ⚒️ Schmiede beim Befüllen ein passendes Objekt und übe seine Verben, dann taucht es hier auf.</div>`;

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
    ${_statsHtml(c)}
    <div class="pd-inv-title">${SLOTS[_selSlot].icon} ${SLOTS[_selSlot].name}</div>
    <div class="pd-inv">${inv}</div>
    ${_previewHtml(c)}
    ${emptyHint}
    <div class="pd-hint">Feld oben antippen zeigt unten die passenden Teile · Teil antippen zeigt, was es verbessert · aufs Feld ziehen (oder „Anlegen") legt an · 🔩 Stahl = Simple Past · 🥇 Gold = Past Participle · ✨ = verzaubert (alle 5 Teile)</div>`;

  if (!host._pdWired) {
    host._pdWired = true;
    host.addEventListener('click', _onPanelClick);
    host.addEventListener('pointerdown', _onPointerDown);
  }
}

// Item in den passenden Slot legen. slotKey (vom Ziehen) gewinnt bei Ringen,
// sonst zählt der Item-Slot; freier Ring-Platz wird bevorzugt.
function _equipInto(c, it, slotKey) {
  if (it.slot === 'ring') {
    if (slotKey === 'ring1' || slotKey === 'ring2') c.equipment[slotKey] = it.id;
    else {
      const r1 = _itemById(c.equipment.ring1), r2 = _itemById(c.equipment.ring2);
      c.equipment[!r1 ? 'ring1' : !r2 ? 'ring2' : 'ring1'] = it.id;
    }
  } else c.equipment[it.slot] = it.id;
}

function _onPanelClick(e) {
  if (_dragDone) { _dragDone = false; return; }   // Drop war kein Klick
  const c = _eq();
  const eqBtn = e.target.closest('[data-equip]');
  if (eqBtn) {
    // „Anlegen"/„Ablegen"-Knopf der Vorschau-Karte.
    const it = _itemById(eqBtn.dataset.equip);
    if (!it) return;
    const wornKey = Object.keys(SLOTS).find(k => c.equipment[k] === it.id);
    if (wornKey) c.equipment[wornKey] = null;
    else _equipInto(c, it, null);
    _save();
    renderEquipmentPanel();
    return;
  }
  const itemBtn = e.target.closest('[data-item]');
  if (itemBtn) {
    // Antippen = anwählen (Werte-Vorschau), nochmal antippen = abwählen.
    const id = itemBtn.dataset.item;
    _selId = _selId === id ? null : id;
    renderEquipmentPanel();
    return;
  }
  const slotBtn = e.target.closest('[data-slot]');
  if (slotBtn) {
    // Slot antippen = anwählen → Liste unten zeigt die passenden Teile.
    // Abgelegt wird über den „Ablegen"-Knopf des angewählten Items.
    const key = slotBtn.dataset.slot;
    if (_selSlot === key) return;
    _selSlot = key;
    const sel = _selectedItem();
    if (sel && sel.slot !== (SLOT_TYPE[key] || key)) _selId = null;   // Auswahl passt nicht mehr
    renderEquipmentPanel();
  }
}

// ── Ziehen aus der Tasche auf einen Slot (Pointer Events, touch-tauglich) ────
// Erst ab 8 px Bewegung wird es ein Zug (darunter bleibt es ein Klick =
// Auswahl); passende Slots leuchten, Loslassen über einem Slot legt an.
let _drag = null, _dragDone = false;

function _slotMatches(key, it) { return (SLOT_TYPE[key] || key) === it.slot; }
function _slotUnder(e, it) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const s = el && el.closest ? el.closest('.pd-slot') : null;
  return (s && _slotMatches(s.dataset.slot, it)) ? s : null;
}

function _onPointerDown(e) {
  const btn = e.target.closest('.pd-item[data-item]');
  if (!btn) return;
  const it = _itemById(btn.dataset.item);
  if (!it) return;
  _drag = { it, x0: e.clientX, y0: e.clientY, ghost: null };
  window.addEventListener('pointermove', _onPointerMove);
  window.addEventListener('pointerup', _onPointerUp);
  window.addEventListener('pointercancel', _onPointerCancel);
}

function _onPointerMove(e) {
  const d = _drag;
  if (!d) return;
  if (!d.ghost) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
    const g = document.createElement('div');
    g.className = 'pd-drag-ghost';
    g.innerHTML = itemSpriteSVG(d.it.type, d.it.tier, d.it.which);
    document.body.appendChild(g);
    d.ghost = g;
    document.querySelectorAll('.pd-slot').forEach(el => {
      if (_slotMatches(el.dataset.slot, d.it)) el.classList.add('drop-ok');
    });
  }
  d.ghost.style.left = e.clientX + 'px';
  d.ghost.style.top = e.clientY + 'px';
  document.querySelectorAll('.pd-slot.drop-hover').forEach(el => el.classList.remove('drop-hover'));
  const s = _slotUnder(e, d.it);
  if (s) s.classList.add('drop-hover');
}

function _onPointerUp(e) {
  const d = _drag;
  _cleanupDrag();
  if (!d || !d.ghost) return;    // keine Bewegung → normaler Klick (Auswahl)
  _dragDone = true;              // den direkt folgenden click-Event schlucken
  setTimeout(() => { _dragDone = false; }, 0);
  const s = _slotUnder(e, d.it);
  if (!s) return;
  const c = _eq();
  const wornKey = Object.keys(SLOTS).find(k => c.equipment[k] === d.it.id);
  if (wornKey) c.equipment[wornKey] = null;   // z. B. Ring von Slot zu Slot ziehen
  _equipInto(c, d.it, s.dataset.slot);
  _selId = d.it.id;   // angelegtes Item bleibt angewählt → Werte bleiben sichtbar
  _save();
  renderEquipmentPanel();
}

function _onPointerCancel() { _cleanupDrag(); }

function _cleanupDrag() {
  if (_drag && _drag.ghost) _drag.ghost.remove();
  document.querySelectorAll('.pd-slot.drop-ok, .pd-slot.drop-hover')
    .forEach(el => el.classList.remove('drop-ok', 'drop-hover'));
  _drag = null;
  window.removeEventListener('pointermove', _onPointerMove);
  window.removeEventListener('pointerup', _onPointerUp);
  window.removeEventListener('pointercancel', _onPointerCancel);
}
