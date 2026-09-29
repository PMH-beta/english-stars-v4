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

import { HP_MAX, FIST_DMG, WEAPON_BASE_DMG, WEAPON_GOLD_BONUS, EQUIP_EFFECT, TALISMAN_MULT, RING_POTION_BONUS, COMPANION_GUARDS, WEAPON_PERK, PERK_SCHWERT_DMG, PERK_DOLCH_DODGE, PERK_SPEER_BOSS, PERK_AXT_ELITE, PERK_HAMMER_MULT, PERK_STAB_MS, PERK_BOGEN_FIGHT, PERK_KOLBEN_GUARD, POTION_CHOICES, POTION_HEAL, POTION_POWER, POTION_TIME_MS, POTION_TIME_WAVES } from './campaign-balance.js';
import { getConstellations, forgeObject } from './irregular-verbs.js';
import { starLit, SLOTS_PER_FORM } from './irregular-game.js';
import { stageHTMLFor, petSVG, ensureAvatar } from './avatar.js';
import { paintStages } from './hero.js';
import { itemTag } from './world.js';
import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';
import { iconHTML } from './pixel-icons.js';

// px = Pixelsymbol des leeren Fachs (Pastell-Design); icon bleibt als Notnagel
// fuer Stellen, die noch Text erwarten.
// kurz = Beschriftung unter dem Fach (8.1), mehrzahl = Kopf der Tasche („Waffen · 4“).
export const SLOTS = {
  weapon:    { icon: '⚔️', px: 'sword',  name: 'Waffe',       kurz: 'Waffe',    mehrzahl: 'Waffen',     desc: 'Schaden pro gewonnener Welle' },
  head:      { icon: '🪖', px: 'helm',   name: 'Helm',        kurz: 'Helm',     mehrzahl: 'Helme',      desc: 'wehrt verlorene Wellen ab (pro Kampf)' },
  body:      { icon: '🛡️', px: 'shield', name: 'Rüstung',     kurz: 'Rüstung',  mehrzahl: 'Rüstungen',  desc: 'mehr HP' },
  arms:      { icon: '🧤', px: 'glove',  name: 'Handschuhe',  kurz: 'Handsch.', mehrzahl: 'Handschuhe', desc: 'mehr Zeit pro Minispiel' },
  legs:      { icon: '🥾', px: 'boots',  name: 'Stiefel',     kurz: 'Stiefel',  mehrzahl: 'Stiefel',    desc: 'Chance auszuweichen' },
  talisman:  { icon: '🧿', px: 'orb',    name: 'Talisman',    kurz: 'Talisman', mehrzahl: 'Talismane',  desc: '+50 % Schaden an Formen-Knoten' },
  ring1:     { icon: '💍', px: 'ring',   name: 'Ring',        kurz: 'Ring',     mehrzahl: 'Ringe',      desc: 'mehr Trank-Auswahl am Schatz' },
  companion: { icon: '🐾', px: 'paw',    name: 'Gefährte',    kurz: 'Gefährte', mehrzahl: 'Gefährten',  desc: 'fängt Fehlgriffe pro Kampf ab' },
};
const SLOT_TYPE = { ring1: 'ring' };   // sonst = Slot-Key selbst
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
  // Es gibt nur noch EINEN Ring-Slot — alten ring2-Stand nach ring1 retten.
  if (c.equipment.ring2) {
    if (!c.equipment.ring1) c.equipment.ring1 = c.equipment.ring2;
    delete c.equipment.ring2;
  }
  return c;
}
function _save() {
  persist(window.SD);
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}

// ── Geschmiedete Items (live abgeleitet, keine Persistenz) ───────────────────
// Pro Station × Form ein Item — erst wenn ALLE 5 Teile fertig geschmiedet sind
// (halbfertige Werkstücke sind noch keine Ausrüstung). Fertig = Stufe
// „verzaubert" (Stahl = past / Gold = pp steckt im which). Waffen: Schaden =
// Basis + Teile (+ Schwert-Vorteil).
export function forgedItems() {
  const out = [];
  for (const c of getConstellations()) {
    for (const which of ['past', 'pp']) {
      let lit = 0;
      for (let i = 0; i < SLOTS_PER_FORM; i++) if (starLit(c.verbs, `_${which}_s${i}`)) lit++;
      if (lit < SLOTS_PER_FORM) continue;
      const ob = forgeObject(c.idx, which);
      const tier = 'verzaubert';
      // Name trägt IMMER das Material (Stahl/Gold = Form) — „Verzaubert" ist nur
      // die Ausbaustufe (✨-Suffix), sonst wären zwei fertige Teile ununterscheidbar.
      const item = {
        id: `f:${c.idx}:${which}`,
        type: ob.type, slot: ob.slot, icon: ob.icon,
        name: `${which === 'past' ? 'Stahl' : 'Gold'}-${ob.name}${tier === 'verzaubert' ? ' ✨' : ''}`,
        station: c.name, which, tier, parts: lit,
      };
      if (ob.slot === 'weapon') {
        item.dmg = WEAPON_BASE_DMG + lit + (ob.type === 'schwert' ? PERK_SCHWERT_DMG : 0)
          + (which === 'pp' ? WEAPON_GOLD_BONUS : 0);   // Gold = stärkeres Material
      }
      out.push(item);
    }
  }
  return out;
}
function _itemById(id) { return id ? forgedItems().find(i => i.id === id) : null; }

// Angelegte Waffe — Auswahl aus dem Waffen-Slot, sonst automatisch die beste;
// ganz ohne Schmiede-Fortschritt kämpft die Faust. equipment.weapon = 'none'
// heißt: bewusst abgelegt → Slot bleibt LEER (Faust), keine Auto-Beste mehr.
// Parametrisiert über die equipment-Map, damit die Profil-Vorschau mitrechnet.
const FIST = { dmg: FIST_DMG, icon: '👊', name: 'Faust', type: null, which: null, parts: 0 };
function _weaponOf(equipment) {
  if (equipment.weapon === 'none') return { ...FIST };
  const sel = _itemById(equipment.weapon);
  if (sel && sel.slot === 'weapon') return sel;
  let best = { ...FIST };
  for (const w of forgedItems()) if (w.slot === 'weapon' && w.dmg > best.dmg) best = w;
  return best;
}
export function equippedWeapon() { return _weaponOf(_eq().equipment); }

// Trägt das Kind dieses Item? Die automatisch angelegte beste Waffe zählt mit —
// sonst hieße ihr Knopf „Anlegen", obwohl sie längst in der Hand liegt.
function _wornKeyOf(c, it) {
  const k = Object.keys(SLOTS).find(key => c.equipment[key] === it.id);
  if (k) return k;
  if (it.slot === 'weapon' && c.equipment.weapon !== 'none' && _weaponOf(c.equipment).id === it.id) return 'weapon';
  return null;
}

// ── Effekte der angelegten Items (vom Kampf & den Drops gelesen) ─────────────
// Rüstungs-Wirkung = Material (Stahl/Gold) + Verzaubert-Bonus obendrauf.
function _equipVal(slot, it) {
  const e = EQUIP_EFFECT[slot];
  return e[it.which === 'past' ? 'stahl' : 'gold'] + (it.tier === 'verzaubert' ? e.verzaubert : 0);
}
function _effectsOf(equipment) {
  const get = (k) => {
    const it = _itemById(equipment[k]);
    return (it && it.slot === (SLOT_TYPE[k] || k)) ? it : null;
  };
  const eff = { hpBonus: 0, timeBonusMs: 0, dodge: 0, headGuards: 0, talisman: false, companionGuards: 0, potionBonus: 0 };
  const head = get('head'); if (head) eff.headGuards = _equipVal('head', head);
  const body = get('body'); if (body) eff.hpBonus = _equipVal('body', body);
  const arms = get('arms'); if (arms) eff.timeBonusMs = _equipVal('arms', arms);
  const legs = get('legs'); if (legs) eff.dodge = _equipVal('legs', legs);
  eff.talisman = !!get('talisman');
  const comp = get('companion');
  if (comp) eff.companionGuards = COMPANION_GUARDS[comp.which === 'past' ? 'stahl' : 'gold'] || 0;
  if (get('ring1')) eff.potionBonus += RING_POTION_BONUS;
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
  heal:   { icon: '❤️', name: 'Heiltrank',   desc: `+${POTION_HEAL} Leben sofort` },
  shield: { icon: '🛡️', name: 'Schildtrank', desc: 'Wehrt eine verlorene Welle ab' },
  power:  { icon: '💪', name: 'Krafttrank',  desc: `+${POTION_POWER} Schaden bis Kampfende` },
  time:   { icon: '⏳', name: 'Zeittrank',   desc: `+${POTION_TIME_MS / 1000} s Zeit für ${POTION_TIME_WAVES} Wellen` },
};

// Kachelfarbe je Trank; gezeichnet wird überall dasselbe Pixel-Icon „potion"
// (Fragmente 6.6, 6.8, 7.4). Den Krafttrank zeigt kein Fragment — Pfirsich ist
// ein Vorschlag, damit er sich von den drei anderen abhebt.
export const POTION_TON = {
  heal: 'var(--p-rosa)', shield: 'var(--p-blau)', time: 'var(--p-lila)', power: 'var(--p-pfirsich)',
};

// Gleiche Tränke zu EINEM Feld zusammenfassen (Reihenfolge des ersten Auftretens),
// damit die Leiste bei vielen Tränken nicht überläuft. index = Platz im Array, den
// ein Klick verbraucht (der erste dieser Sorte).
export function potionStacks(list) {
  const out = [];
  const at = {};
  (Array.isArray(list) ? list : []).forEach((k, i) => {
    if (!POTIONS[k]) return;
    if (at[k] == null) { at[k] = out.length; out.push({ key: k, count: 1, index: i }); }
    else out[at[k]].count++;
  });
  return out;
}

// 💎 Schatz: Wahl-Overlay mit 3 (+ Ring-Bonus) zufälligen Tränken. onPick(key)
// bekommt die Wahl — Zustand (run.potions) verwaltet der Aufrufer (campaign.js).
export function openPotionChoice({ onPick }) {
  const keys = Object.keys(POTIONS);
  for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  const n = Math.min(keys.length, POTION_CHOICES + equipEffects().potionBonus);
  const choices = keys.slice(0, n);
  // Aussehen nach Fragment 6.6: Truhe auf Gold, Tränke als Zeilen mit Farbkachel.
  // Antippen nimmt den Trank sofort (wie bisher) — ob es wie im Entwurf erst eine
  // Auswahl mit Haken und dann „Nehmen" gibt, ist offen (Frage F-33).
  const ov = document.createElement('div');
  ov.className = 'p-dlg-grund p-schatz-grund';
  ov.innerHTML = `<div class="p-dlg-karte p-schatz-karte">
    <div class="p-schatz-emblem">${iconHTML('box', 42)}</div>
    <div class="p-schatz-titel">Schatz gefunden!</div>
    <div class="p-schatz-sub">Wähle einen Trank für diesen Lauf</div>
    <div class="p-schatz-liste">
    ${choices.map(k => `<button class="p-schatz-zeile" data-potion="${k}">
      <span class="p-schatz-kachel" style="background:${POTION_TON[k]}">${iconHTML('potion', 28)}</span>
      <span class="p-wachs"><span class="p-schatz-name">${POTIONS[k].name}</span><span class="p-schatz-text">${POTIONS[k].desc}</span></span>
    </button>`).join('')}
    </div>
  </div>`;
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-potion]');
    if (!b) return;
    ov.remove();
    onPick(b.dataset.potion);
  });
  document.body.appendChild(ov);
}

// ── Ausrüstung im Profil (8.1) ───────────────────────────────────────────────
// Links/rechts die Fächer, in der Mitte die Bühne: Figur MIT angelegter
// Ausrüstung und (falls angelegt) dem Gefährten, 3×. Darunter die Kampf-Werte
// als Kacheln und — sobald ein Fach angewählt ist — die Tasche mit allen Teilen
// dieses Fachs und der Karte des angewählten Teils.

const PD_LEFT = ['head', 'body', 'arms', 'legs'];
const PD_RIGHT = ['weapon', 'talisman', 'ring1', 'companion'];   // Waffe oben, Gefährte unten

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
  g.ring = get('ring1') || undefined;
  const w = equippedWeapon();
  if (w.type) g.weapon = w;
  return g;
}

// Angelegte Ausrüstung als gear-Map von außen (Kampf-Szene: Spieler-Sprite).
export function equippedGearMap() { return _gearMap(_eq()); }

// Angewählter Slot — zu Beginn KEINER: die Startansicht ist nur der Charakter
// mit seinen Feldern. Erst ein Antippen zeigt die Tasche mit den passenden
// Teilen darunter; nochmal antippen (oder ein Klick ins Leere) hebt das auf.
let _selSlot = null;

// Getragenes Item eines Slots (Waffe inkl. Auto-Beste), sonst null.
function _wornItem(c, key) {
  if (key === 'weapon') { const w = equippedWeapon(); return w.id ? w : null; }
  const it = _itemById(c.equipment[key]);
  return (it && it.slot === (SLOT_TYPE[key] || key)) ? it : null;
}

// Anzeigename ohne das ✨ — jedes fertige Teil ist verzaubert, das Zeichen
// unterscheidet nichts mehr (und Emojis weichen den Pixel-Icons).
const _anzeigeName = (it) => it.name.replace(/\s*✨$/, '');

// Bild eines Teils (Gegenstand aus pixel-world-fine.js, Stahl bzw. Gold).
const _teilBild = (it, scale) => itemTag(it.type, it.which, scale);

function _slotTile(c, key) {
  const meta = SLOTS[key];
  const it = _wornItem(c, key);
  // Im Fach „Gefährte“ steht das eigene Tier des Kindes (8.1), sonst das Teil.
  const inner = !it ? iconHTML(meta.px, 28, { cls: 'pf-fach-leer' })
    : key === 'companion' ? petSVG(ensureAvatar(window.SD), { scale: 1 }) : _teilBild(it, 1);
  const title = it ? `${_anzeigeName(it)} (${it.parts}/${SLOTS_PER_FORM} Teile)` : `${meta.name} — ${meta.desc}`;
  return `<button class="pf-fach${it ? ' is-voll' : ''}${key === _selSlot ? ' is-aktiv' : ''}" data-slot="${key}" title="${title}">`
    + `<span class="pf-fach-kachel">${inner}</span><span class="pf-fach-lbl">${meta.kurz}</span></button>`;
}

// ── Kampf-Werte (echte Spielwerte, nicht nur Boni) ───────────────────────────
// Kacheln nach 8.1. Bei angewähltem Teil rechnet _statVals mit der Vorschau-
// equipment-Map; geänderte Kacheln werden grün (besser) bzw. rosa (schlechter)
// und tragen die Änderung als Chip.
const STAT_DEFS = [
  { key: 'dmg',      px: 'sword',  label: 'Schaden',    fmt: v => String(v) },
  { key: 'hp',       px: 'heart',  label: 'Leben',      fmt: v => String(v) },
  { key: 'guards',   px: 'helm',   label: 'Abwehr',     fmt: v => v + '×' },
  { key: 'time',     px: 'glove',  label: 'Extra-Zeit', fmt: v => '+' + v + ' s' },
  { key: 'dodge',    px: 'boots',  label: 'Ausweichen', fmt: v => v + ' %' },
  { key: 'potion',   px: 'potion', label: 'Tränke',     fmt: v => String(v) },
  { key: 'talisman', px: 'orb',    label: 'Formen',     fmt: v => v ? '+' + Math.round((TALISMAN_MULT - 1) * 100) + ' %' : '—',
    delta: d => d * Math.round((TALISMAN_MULT - 1) * 100) },
  { key: 'comp',     px: 'paw',    label: 'Gefährte',   fmt: v => v ? v + '×' : '—' },
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
// Abgelegte Waffe → 'none' (leerer Slot, Faust) statt Rückfall auf die Auto-Beste.
function _previewEquipment(c, it) {
  const eq = { ...c.equipment };
  const wornKey = _wornKeyOf(c, it);
  if (wornKey) { eq[wornKey] = wornKey === 'weapon' ? 'none' : null; return eq; }
  eq[it.slot === 'ring' ? 'ring1' : it.slot] = it.id;
  return eq;
}

function _statsHtml(c) {
  const cur = _statVals(c.equipment);
  const sel = _selectedItem();
  const wornKey = sel ? _wornKeyOf(c, sel) : null;
  // _previewEquipment liefert den Stand MIT dem Teil (noch nicht angelegt) bzw.
  // OHNE es (schon angelegt) — beides ist der Vergleichswert.
  const other = sel ? _statVals(_previewEquipment(c, sel)) : null;
  const tiles = STAT_DEFS.map(d => {
    const a = cur[d.key];
    const o = other ? other[d.key] : a;
    let cls = '', chip = '';
    if (other && o !== a) {
      // Schon angelegt: der Wert steckt schon drin — der Chip zeigt, was DIESES
      // Teil beiträgt. Noch nicht angelegt: was sich beim Anlegen ändert.
      const diff = wornKey ? a - o : o - a;
      const shown = d.delta ? d.delta(diff) : Math.round(diff * 100) / 100;
      cls = diff > 0 ? ' is-plus' : ' is-minus';
      chip = `<div class="pf-wert-chipzeile"><span class="pf-wert-chip">${shown > 0 ? '+' : '−'}${Math.abs(shown)}</span></div>`;
    }
    return `<div class="pf-wert${cls}"><div class="pf-wert-ic">${iconHTML(d.px, 14)}</div>`
      + `<div class="pf-wert-zahl">${d.fmt(a)}</div><div class="pf-wert-lbl">${d.label}</div>${chip}</div>`;
  }).join('');
  return `<div class="pf-werte">${tiles}</div>`;
}

// ALLE Verbesserungen eines Items als kurze Zahlen-Zeilen, je mit dem
// Pixel-Icon des passenden Werts (Krone = Bosse wie im Entwurf).
function _itemBonuses(it) {
  if (it.slot === 'weapon') {
    const out = [{ px: 'sword', text: `${it.dmg} Schaden` }];
    if (it.type === 'dolch') out.push({ px: 'boots', text: `+${Math.round(PERK_DOLCH_DODGE * 100)} % Ausweichen` });
    if (it.type === 'stab') out.push({ px: 'glove', text: `+${PERK_STAB_MS / 1000} s Zeit` });
    if (it.type === 'streitkolben') out.push({ px: 'helm', text: `+${PERK_KOLBEN_GUARD}× Abwehr` });
    if (it.type === 'speer') out.push({ px: 'crown', text: `+${PERK_SPEER_BOSS} Schaden gegen Bosse` });
    if (it.type === 'axt') out.push({ px: 'orb', text: `+${PERK_AXT_ELITE} Schaden an Elite` });
    if (it.type === 'bogen') out.push({ px: 'sword', text: `+${PERK_BOGEN_FIGHT} Schaden an Wortgeistern` });
    if (it.type === 'hammer') out.push({ px: 'sword', text: `1. Welle ×${PERK_HAMMER_MULT} Schaden` });
    return out;
  }
  if (it.slot === 'head') return [{ px: 'helm', text: `${_equipVal('head', it)}× Abwehr` }];
  if (it.slot === 'body') return [{ px: 'heart', text: `+${_equipVal('body', it)} Leben` }];
  if (it.slot === 'arms') return [{ px: 'glove', text: `+${_equipVal('arms', it) / 1000} s Zeit` }];
  if (it.slot === 'legs') return [{ px: 'boots', text: `+${Math.round(_equipVal('legs', it) * 100)} % Ausweichen` }];
  if (it.slot === 'talisman') return [{ px: 'orb', text: `+${Math.round((TALISMAN_MULT - 1) * 100)} % Schaden an Formen-Knoten` }];
  if (it.slot === 'ring') return [{ px: 'potion', text: `+${RING_POTION_BONUS} Trank zur Wahl` }];
  if (it.slot === 'companion') return [{ px: 'paw', text: `fängt ${COMPANION_GUARDS[it.which === 'past' ? 'stahl' : 'gold']} Fehler pro Kampf` }];
  return [];
}

// Karte des angewählten Teils (8.1): Bild 2×, Name, „angelegt", Verbesserungen,
// „Anlegen"/„Ablegen"-Knopf (einfacher Weg neben dem Ziehen).
function _previewHtml(c) {
  const it = _selectedItem();
  if (!it) return '';
  const wornKey = _wornKeyOf(c, it);
  return `<div class="pf-karte-teil">
    <span class="pf-teil-bild">${_teilBild(it, 2)}</span>
    <div class="pf-teil-info">
      <div class="pf-teil-kopf"><span class="pf-teil-name">${_anzeigeName(it)}</span>${wornKey ? '<span class="pf-angelegt">angelegt</span>' : ''}</div>
      ${_itemBonuses(it).map(b => `<div class="pf-bonus">${iconHTML(b.px, 14)}${b.text}</div>`).join('')}
    </div>
    <button class="pf-anlegen" data-equip="${it.id}">${wornKey ? iconHTML('close', 14) + 'Ablegen' : 'Anlegen'}</button>
  </div>`;
}

// Auswahl verwerfen — beim Öffnen der Profilseite, damit dort IMMER die leere
// Startansicht steht (Modul-Zustand überlebt sonst den Seitenwechsel).
export function resetEquipmentSelection() { _selSlot = null; _selId = null; }

export function renderEquipmentPanel() {
  const host = document.getElementById('prof-equip-section');
  if (!host) return;
  const c = _eq();

  // Tasche: alle Teile des angewählten Fachs in vollen Zeilen à BAG_COLS
  // Plätzen (muss zu .pf-tasche im CSS passen); das getragene trägt einen Haken.
  // Ohne angewähltes Fach bleibt der ganze Teil unter den Werten weg.
  let bagHtml = '';
  if (_selSlot) {
    const BAG_COLS = 6;
    const meta = SLOTS[_selSlot];
    const slotType = SLOT_TYPE[_selSlot] || _selSlot;
    const allOfSlot = forgedItems().filter(i => i.slot === slotType);
    const worn = _wornItem(c, _selSlot);
    const capacity = Math.max(BAG_COLS, Math.ceil(allOfSlot.length / BAG_COLS) * BAG_COLS);
    let inv = allOfSlot.map(it => `<button class="pf-teil${it.id === _selId ? ' is-gewaehlt' : ''}" data-item="${it.id}"
        title="${_anzeigeName(it)} (${it.parts}/${SLOTS_PER_FORM} Teile, ${it.station})">
        ${_teilBild(it, 1)}${worn && worn.id === it.id ? `<span class="pf-teil-haken">${iconHTML('check', 14)}</span>` : ''}
      </button>`).join('');
    for (let i = allOfSlot.length; i < capacity; i++) inv += `<div class="pf-teil is-leer" title="Leerer Platz — schmiede etwas in der Schmiede"></div>`;
    const emptyHint = allOfSlot.length ? '' : `<div class="pf-leer">Noch kein ${meta.name}-Teil geschmiedet — wähle in der Schmiede beim Befüllen ein passendes Objekt und übe seine Verben, dann taucht es hier auf.</div>`;
    bagHtml = `
      <div class="pf-tasche-kopf">${iconHTML(meta.px, 14)}${meta.mehrzahl} · ${allOfSlot.length}</div>
      <div class="pf-tasche">${inv}</div>
      ${_previewHtml(c)}
      ${emptyHint}`;
  }

  const gear = _gearMap(c);
  host.innerHTML = `
    <div class="pf-abschnitt">${iconHTML('shield', 28)}<span class="pf-abschnitt-titel">Ausrüstung</span><span class="pf-abschnitt-linie"></span></div>
    <div class="pf-puppe">
      <div class="pf-spalte">${PD_LEFT.map(k => _slotTile(c, k)).join('')}</div>
      <div class="pf-buehne">${stageHTMLFor(window.SD, gear, 3)}</div>
      <div class="pf-spalte">${PD_RIGHT.map(k => _slotTile(c, k)).join('')}</div>
    </div>
    ${_statsHtml(c)}
    ${bagHtml}`;

  // Bühne 3× wie im Entwurf; passt sie auf einem schmalen Handy nicht, 2×
  // (nur ganzzahlig, Regel 6).
  const buehne = host.querySelector('.pf-buehne');
  const cv = buehne && buehne.querySelector('canvas');
  if (cv && buehne.clientWidth && cv.offsetWidth > buehne.clientWidth) buehne.innerHTML = stageHTMLFor(window.SD, gear, 2);
  paintStages(buehne);

  if (!host._pdWired) {
    host._pdWired = true;
    host.addEventListener('click', _onPanelClick);
    host.addEventListener('pointerdown', _onPointerDown);
  }
}

// Item in den passenden Slot legen (Ring-Items landen im ring1-Slot).
function _equipInto(c, it) {
  c.equipment[it.slot === 'ring' ? 'ring1' : it.slot] = it.id;
}

function _onPanelClick(e) {
  if (_dragDone) { _dragDone = false; return; }   // Drop war kein Klick
  const c = _eq();
  const eqBtn = e.target.closest('[data-equip]');
  if (eqBtn) {
    // „Anlegen"/„Ablegen"-Knopf der Vorschau-Karte. Abgelegte Waffe → 'none'
    // (Slot bleibt leer, Faust) — sonst käme sofort die Auto-Beste zurück.
    const it = _itemById(eqBtn.dataset.equip);
    if (!it) return;
    const wornKey = _wornKeyOf(c, it);
    if (wornKey) c.equipment[wornKey] = wornKey === 'weapon' ? 'none' : null;
    else _equipInto(c, it);
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
    // Slot antippen = anwählen → Tasche zeigt die passenden Teile; trägt der
    // Slot ein Item, wird DAS angewählt (Karte unter der Tasche, „Ablegen").
    // Denselben Slot nochmal antippen = abwählen → Tasche verschwindet wieder.
    const key = slotBtn.dataset.slot;
    if (_selSlot === key) { _selSlot = null; _selId = null; }
    else {
      _selSlot = key;
      const worn = _wornItem(c, key);
      if (worn) _selId = worn.id;
      else {
        const sel = _selectedItem();
        if (sel && sel.slot !== (SLOT_TYPE[key] || key)) _selId = null;   // Auswahl passt nicht mehr
      }
    }
    renderEquipmentPanel();
    return;
  }
  // Klick ins Leere (kein Item, kein Slot, keine Karte) = Auswahl aufheben.
  if ((_selId || _selSlot) && !e.target.closest('.pf-karte-teil')) {
    _selId = null;
    _selSlot = null;
    renderEquipmentPanel();
  }
}

// ── Ziehen aus der Tasche auf einen Slot (Pointer Events, touch-tauglich) ────
// Touch: kurz HALTEN packt die Kachel (vorher darf der Finger die Seite
// scrollen — CSS touch-action:pan-y), Maus: ab 8 px Bewegung. Darunter bleibt
// es ein Klick = Auswahl; passende Slots leuchten, Loslassen legt an.
let _drag = null, _dragDone = false;
const HOLD_MS = 220;

function _slotMatches(key, it) { return (SLOT_TYPE[key] || key) === it.slot; }
function _slotUnder(e, it) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const s = el && el.closest ? el.closest('.pf-fach') : null;
  return (s && _slotMatches(s.dataset.slot, it)) ? s : null;
}

function _onPointerDown(e) {
  const btn = e.target.closest('.pf-teil[data-item]');
  if (!btn) return;
  const it = _itemById(btn.dataset.item);
  if (!it) return;
  _drag = { it, btn, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, ghost: null, holdTimer: null };
  // Touch: erst nach kurzem Halten wird gepackt — ein sofortiges Wischen bleibt Scrollen.
  if (e.pointerType !== 'mouse') _drag.holdTimer = setTimeout(() => { if (_drag) _startCarry(); }, HOLD_MS);
  window.addEventListener('pointermove', _onPointerMove);
  window.addEventListener('pointerup', _onPointerUp);
  window.addEventListener('pointercancel', _onPointerCancel);
  window.addEventListener('touchmove', _onTouchMove, { passive: false });
}

// Kachel „gepackt": Original bleibt blass zurück, eine Kachel-Kopie hängt am Finger.
function _startCarry() {
  const d = _drag;
  const g = document.createElement('div');
  g.className = 'pf-zieh';
  g.innerHTML = _teilBild(d.it, 1);
  g.style.left = d.x + 'px';
  g.style.top = d.y + 'px';
  document.body.appendChild(g);
  d.ghost = g;
  d.btn.classList.add('is-gezogen');
  document.querySelectorAll('.pf-fach').forEach(el => {
    if (_slotMatches(el.dataset.slot, d.it)) el.classList.add('drop-ok');
  });
}

// Beim Tragen darf die Seite nicht mitscrollen — der allererste (noch
// abbrechbare) touchmove wird geschluckt, danach gehören die Events uns.
function _onTouchMove(e) {
  if (_drag && _drag.ghost && e.cancelable) e.preventDefault();
}

function _onPointerMove(e) {
  const d = _drag;
  if (!d) return;
  d.x = e.clientX;
  d.y = e.clientY;
  if (!d.ghost) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
    // Touch bewegt sich VOR dem Halten → das ist Scrollen, kein Zug.
    if (d.holdTimer) { _cleanupDrag(); return; }
    _startCarry();   // Maus: ab 8 px wird gezogen
  }
  d.ghost.style.left = e.clientX + 'px';
  d.ghost.style.top = e.clientY + 'px';
  document.querySelectorAll('.pf-fach.drop-hover').forEach(el => el.classList.remove('drop-hover'));
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
  if (wornKey) c.equipment[wornKey] = null;
  _equipInto(c, d.it);
  _selSlot = s.dataset.slot;   // Ziel-Slot bleibt offen → Tasche bleibt sichtbar
  _selId = d.it.id;            // angelegtes Item bleibt angewählt → Werte bleiben sichtbar
  _save();
  renderEquipmentPanel();
}

function _onPointerCancel() { _cleanupDrag(); }

function _cleanupDrag() {
  if (_drag && _drag.holdTimer) clearTimeout(_drag.holdTimer);
  if (_drag && _drag.ghost) _drag.ghost.remove();
  if (_drag && _drag.btn) _drag.btn.classList.remove('is-gezogen');
  document.querySelectorAll('.pf-fach.drop-ok, .pf-fach.drop-hover')
    .forEach(el => el.classList.remove('drop-ok', 'drop-hover'));
  _drag = null;
  window.removeEventListener('pointermove', _onPointerMove);
  window.removeEventListener('pointerup', _onPointerUp);
  window.removeEventListener('pointercancel', _onPointerCancel);
  window.removeEventListener('touchmove', _onTouchMove);
}
