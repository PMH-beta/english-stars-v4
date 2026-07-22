// src/modules/campaign.js
// Kampagne — Slay-the-Spire-artige Karte.
// Schritt 1: Taler-Ökonomie + prozedurale Karte + HP-Leiste + Navigation.
// Schritt 2 (Kampfsystem Phase 1+2): ⚔️/👑/🌀 starten echte Kämpfe (campaign-fight.js;
// Minispiele Buchstabensturm/Meteoriten/Echo-Fang, 🌀 = Verbform-Wellen), 🔥 heilt;
// 💎 ist noch Platzhalter (Phase 3: Drops/Ausrüstung).
// Persistenz: SD.campaign (reitet als profiles.campaign jsonb im Sync mit, analog
// uv_fills), inkl. run.fight (Kampf-Zwischenstand, Reload-sicher).
//
// Taler-Regel: Pro Teilabschnitt (Preset-Kategorie) auf 100 % gibt es 1 Taler. Einmal
// verdient = dauerhaft „claimed" (kein Zurückfallen durch EMA-Schwankung). Freischalten
// ab 2 erledigten Teilabschnitten; Start kostet 2 Taler Einsatz; Tod (HP=0) → Einsatz weg.

import { deckProgress } from './decks.js';
import { uvTrainProgress } from './irregular-game.js';
import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';
import { HP_MAX, REST_HEAL } from './campaign-balance.js';
import { openFight, fightPoolReady, verbsReady } from './campaign-fight.js';
import { equipEffects, openPotionChoice, POTIONS } from './campaign-equipment.js';

const ROWS = 13;            // Reihe 0 = Start (unten), Reihe ROWS-1 = Boss (oben)
const COLS = 5;
const PATHS = 6;            // Anzahl generierter Pfade von unten nach oben
export const STAKE_COST = 2;
const UNLOCK_NEED = 2;      // so viele 100%-Deck-Modi (Taler) zum Freischalten

const NODE = {
  fight:     { icon: '⚔️', label: 'Übung' },
  irregular: { icon: '🌀', label: 'Unregelmäßige' },
  rest:      { icon: '🔥', label: 'Rastplatz' },
  treasure:  { icon: '💎', label: 'Schatz' },
  boss:      { icon: '👑', label: 'Boss' },
};

const _rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const _pick = (arr) => arr[_rand(0, arr.length - 1)];

// fight/irregular/boss = gewonnene Kämpfe je Gegner-Art (= Knoten-Typ). bestRow = höchste
// je in einem einzelnen Lauf erreichte Reihe (Highscore, kein Zähler).
export const CAMP_STAT_KEYS = ['fight', 'irregular', 'boss', 'runsWon', 'runsLost', 'bestRow'];

// ── SD-Zugriff (mit Default-Reparatur) ──
function _camp() {
  const SD = window.SD;
  if (!SD.campaign || typeof SD.campaign !== 'object') SD.campaign = { claimed: [], talerSpent: 0, run: null };
  if (!Array.isArray(SD.campaign.claimed)) SD.campaign.claimed = [];
  if (typeof SD.campaign.talerSpent !== 'number') SD.campaign.talerSpent = 0;
  if (typeof SD.campaign.bossWins !== 'number') SD.campaign.bossWins = 0;
  // Laufende Statistik (Fortschritt-Seite). Zählt ab Einführung — ältere Läufe
  // lassen sich nicht nachrechnen, die Zähler starten daher bei 0.
  if (!SD.campaign.stats || typeof SD.campaign.stats !== 'object') SD.campaign.stats = {};
  for (const k of CAMP_STAT_KEYS) {
    if (typeof SD.campaign.stats[k] !== 'number') SD.campaign.stats[k] = 0;
  }
  return SD.campaign;
}

// Anzahl besiegter Bosse (Anzeige im Profil + auf der Startseite).
export function bossWinCount() { return _camp().bossWins || 0; }

// Debug-Helfer (nur Konsole, kein UI): Test-Taler gutschreiben, indem
// talerSpent negativ gesetzt wird (echte claimed-Taler bleiben unberührt).
// Synct sofort in die Cloud. Aufruf in DevTools: talerTest(50)
export function talerTest(n = 50) {
  const c = _camp();
  c.talerSpent = -Math.abs(n);
  _saveCampaign();
  updateTalerBadge();
  console.log('[talerTest] verfügbar:', talerAvailable());
  return talerAvailable();
}
function _saveCampaign() {
  persist(window.SD);
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}

export function talerAvailable() {
  const c = _camp();
  return Math.max(0, c.claimed.length - c.talerSpent);
}

// ── Taler verdienen: 100%-Teilabschnitte einsammeln (retroaktiv) ──
// Taler-Regel: pro Deck (Vokabeln-Modus) und pro Übungsart (MC/Schreiben/Sprechen)
// gibt es 1 Taler, sobald diese Art im Deck 100 % (alle Wörter gemeistert) ist.
// claimed-Key = deckId|mc|sp|pr. Einmal verdient = dauerhaft (kein Zurückfallen).
// Trainingsplatz-Decks analog: pro Deck und Disziplin (Erkennen/Schmieden/
// Verzaubern) 1 Taler bei 100 % der gewählten Formen. Key = deckId|er|sc|vz.
export const TALER_MODES = [
  { key: 'mc', label: 'MC',            prog: (pm) => pm.vocab },
  { key: 'sp', label: 'Rechtschreibung', prog: (pm) => pm.spelling },
  { key: 'pr', label: 'Aussprache',    prog: (pm) => pm.pronounce },
];
export const TALER_TRAIN_DISCS = [
  { key: 'er', disc: 'erkennen' },
  { key: 'sc', disc: 'schmieden' },
  { key: 'vz', disc: 'verzaubern' },
];

// Ist diese Übungsart in diesem Deck fertig (alle Wörter gemeistert)?
export function isModeComplete(prog) {
  return !!prog && prog.total > 0 && prog.mastered === prog.total;
}

// Prüft alle Vokabeln-Decks × 3 Arten und schreibt neu-fertige in claimed. Idempotent →
// zählt auch bestehenden Fortschritt rückwirkend. Räumt alte (Kategorie-)Claims weg.
export async function refreshClaimedTaler() {
  const c = _camp();
  // Migration: frühere claimed-Einträge waren Preset-Kategorie-IDs (ohne |mode-Suffix).
  const cleaned = c.claimed.filter(k => /\|(mc|sp|pr|er|sc|vz)$/.test(k));
  let changed = cleaned.length !== c.claimed.length;
  c.claimed = cleaned;

  const decks = window.SD?.decks || {};
  for (const id in decks) {
    const deck = decks[id];
    if (!deck?.vocab?.length) continue;
    const mode = deck.mode || 'free';
    if (mode === 'free') {
      const pm = deckProgress(deck).perMode;
      for (const m of TALER_MODES) {
        if (!isModeComplete(m.prog(pm))) continue;
        const key = id + '|' + m.key;
        if (!c.claimed.includes(key)) { c.claimed.push(key); changed = true; }
      }
    } else if (mode === 'training') {
      for (const t of TALER_TRAIN_DISCS) {
        if (!isModeComplete(uvTrainProgress(deck, t.disc))) continue;
        const key = id + '|' + t.key;
        if (!c.claimed.includes(key)) { c.claimed.push(key); changed = true; }
      }
    }
  }
  if (changed) _saveCampaign();
  updateTalerBadge();
  return talerAvailable();
}

export function updateTalerBadge() {
  const el = document.getElementById('menu-taler');
  if (el) el.textContent = talerAvailable();
  const b = document.getElementById('menu-bosses');
  if (b) b.textContent = bossWinCount();
}

// ── Kartengenerierung (prozedural, DAG von unten nach oben) ──
function generateMap() {
  const grid = Array.from({ length: ROWS }, () => ({}));   // grid[row][col] = node
  const ensure = (r, col) => {
    if (!grid[r][col]) grid[r][col] = { id: r + '_' + col, row: r, col, type: 'fight', next: [] };
    return grid[r][col];
  };
  const link = (a, b) => { if (!a.next.includes(b.id)) a.next.push(b.id); };

  for (let p = 0; p < PATHS; p++) {
    let col = _rand(0, COLS - 1);
    for (let r = 0; r < ROWS - 2; r++) {
      const cur = ensure(r, col);
      let cands = [col - 1, col, col + 1].filter(c => c >= 0 && c < COLS);
      // Kreuzungs-Schutz: diagonale Kante nur, wenn der seitliche Nachbar nicht
      // gegengleich diagonal in unsere Spalte läuft.
      cands = cands.filter(nc => {
        if (nc === col) return true;
        const sib = grid[r][nc];
        return !sib || !sib.next.includes((r + 1) + '_' + col);
      });
      const nc = _pick(cands.length ? cands : [col]);
      link(cur, ensure(r + 1, nc));
      col = nc;
    }
  }

  // Boss oben, alle Knoten der vorletzten Reihe zeigen darauf.
  const boss = ensure(ROWS - 1, Math.floor(COLS / 2));
  boss.type = 'boss';
  for (const col in grid[ROWS - 2]) link(grid[ROWS - 2][col], boss);

  // 🌀-Knoten nur, wenn das Kind Sternbild-Verben befüllt hat (SD.uvFills) —
  // sonst gäbe es Verb-Kämpfe ohne Wortmaterial.
  const hasVerbs = verbsReady();
  const nodes = {};
  for (let r = 0; r < ROWS; r++) {
    for (const col in grid[r]) {
      const n = grid[r][col];
      if (n.type !== 'boss') n.type = _typeForRow(r, hasVerbs);
      nodes[n.id] = n;
    }
  }
  return { nodes, rows: ROWS, cols: COLS, bossId: boss.id };
}

function _typeForRow(r, hasVerbs) {
  if (r <= 1) return 'fight';                       // erste Reihen sanft (nur Übung)
  const roll = Math.random();
  const restW = r >= ROWS - 4 ? 0.22 : 0.12;        // Rast häufiger kurz vor dem Boss
  if (roll < 0.50) return 'fight';
  if (roll < 0.72) return hasVerbs ? 'irregular' : 'fight';
  if (roll < 0.72 + restW) return 'rest';
  return 'treasure';
}

// ── Run-Lifecycle ──
function _isReachable(run, node) {
  if (run.pos == null) return node.row === 0;
  const cur = run.map.nodes[run.pos];
  return !!cur && cur.next.includes(node.id);
}

// Wie viele Knoten von hier aus erreichbar sind — bei genau einem gibt es nichts
// zum Verwählen, der Zwei-Klick-Schutz (siehe campaignNode) entfällt dann.
function _reachableCount(run) {
  let n = 0;
  for (const id in run.map.nodes) if (_isReachable(run, run.map.nodes[id])) n++;
  return n;
}

export function startCampaignRun() {
  const c = _camp();
  if (c.run) { renderCampaign(); return; }
  if (talerAvailable() < STAKE_COST) return;
  c.talerSpent += STAKE_COST;                        // Einsatz sofort gesetzt
  const hpMax = HP_MAX + equipEffects().hpBonus;     // 🛡️ Rüstung: mehr HP
  c.run = { map: generateMap(), pos: null, visited: [], hp: hpMax, hpMax, potions: [] };
  _selectedNodeId = null;
  _saveCampaign();
  updateTalerBadge();
  renderCampaign();
}

// Ausrüstung liegt als Paperdoll im PROFIL — die Kampagne verweist nicht mehr
// darauf. Die max. HP eines laufenden Runs werden beim Karten-Render an die
// Rüstung angeglichen (_renderCampaignNow).

// Zwei-Klick-Bestätigung gegen Fehlklicks — nur wenn es überhaupt etwas zu verwählen
// gibt (_reachableCount > 1): 1. Klick auf einen erreichbaren Knoten markiert ihn nur
// ("bewaffnet"), erst der 2. Klick auf denselben Knoten startet ihn. Gibt es nur einen
// erreichbaren Knoten, startet der erste Klick direkt. Reines UI-Zwischenstand — nicht
// persistiert, heilt sich über Reachable-Check selbst (siehe _mapHtml), falls die
// Karte/der Lauf wechselt.
let _selectedNodeId = null;

export function campaignNode(id) {
  const c = _camp();
  const run = c.run;
  if (!run) return;
  if (run.fight) { resumeCampaignFight(); return; }   // offener Kampf geht vor
  const node = run.map.nodes[id];
  if (!node || !_isReachable(run, node)) return;
  if (_reachableCount(run) > 1 && _selectedNodeId !== id) {   // nur bei echter Wahl markieren
    _selectedNodeId = id;
    const host = document.getElementById('mode-campaign');
    if (host) _renderCampaignNow(host);
    return;
  }
  _selectedNodeId = null;                               // 2. Klick (oder einziger Weg): starten
  c.stats.bestRow = Math.max(c.stats.bestRow, node.row + 1);
  if (node.type === 'fight' || node.type === 'boss' || node.type === 'irregular') {
    if (!fightPoolReady()) { window.esToast?.('📭 Keine Vokabeln in deinen Decks — der Kampf braucht Wörter'); return; }
    run.pos = id;
    if (!run.visited.includes(id)) run.visited.push(id);
    _saveCampaign();
    _startFight(node);
    return;
  }
  run.pos = id;
  if (!run.visited.includes(id)) run.visited.push(id);
  if (node.type === 'rest') {
    // 🔥 Rastplatz: ausruhen (+HP, gedeckelt).
    const before = run.hp;
    run.hp = Math.min(run.hpMax, run.hp + REST_HEAL);
    _saveCampaign();
    renderCampaign();
    window.esToast?.('🔥 Ausgeruht: +' + (run.hp - before) + ' HP');
    return;
  }
  if (node.type === 'treasure') {
    // 💎 Schatz: kein Kampf — Wahl aus 3 Tränken (💍 Ringe geben mehr Auswahl).
    // Tränke gehören zum Run und sind im Kampf spielbar.
    _saveCampaign();
    renderCampaign();
    openPotionChoice({
      onPick: (key) => {
        if (!Array.isArray(run.potions)) run.potions = [];
        run.potions.push(key);
        _saveCampaign();
        window.esToast?.(`${POTIONS[key].icon} ${POTIONS[key].name} eingesteckt!`);
      },
    });
    return;
  }
  _saveCampaign();
  renderCampaign();
}

// Kampf am Knoten öffnen. onEnd regelt die Run-Folgen: Boss-Sieg oder Tod (auch durch
// bewusstes „Kampf verlassen" — campaign-fight.js fragt vorher extra nach) beendet den
// Run; null ist nur der interne Nicht-Fall (z. B. Wortpool beim Laden leer).
function _startFight(node) {
  const c = _camp();
  openFight({
    run: c.run,
    node,
    save: _saveCampaign,
    onEnd: (result) => {
      const bossWin = result === 'victory' && node.type === 'boss';
      if (bossWin) c.bossWins = (c.bossWins || 0) + 1;
      // Gewonnener Kampf zählt auf die Gegner-Art (Knoten-Typ); ein Boss-Sieg
      // beendet den Lauf erfolgreich, der Tod lässt ihn scheitern.
      if (result === 'victory' && CAMP_STAT_KEYS.includes(node.type)) c.stats[node.type]++;
      if (bossWin) c.stats.runsWon++;
      else if (result === 'death') c.stats.runsLost++;
      if (bossWin || result === 'death') { c.run = null; _selectedNodeId = null; }
      _saveCampaign();
      renderCampaign();
    },
  });
}

// Offenen Kampf (run.fight) wieder öffnen — nach Reload/App-Neustart mitten im Kampf.
export function resumeCampaignFight() {
  const c = _camp();
  const f = c.run?.fight;
  if (!f) return;
  const node = c.run.map.nodes[f.nodeId];
  if (!node) { c.run.fight = null; _saveCampaign(); renderCampaign(); return; }
  _startFight(node);
}

export function campaignGiveUp() {
  const c = _camp();
  if (!c.run) return;
  // Aufgeben beendet den Lauf ohne Boss-Sieg → zählt wie gescheitert, sonst
  // verschwänden aufgegebene Läufe spurlos aus der Statistik.
  const finish = () => { c.stats.runsLost++; c.run = null; _selectedNodeId = null; _saveCampaign(); renderCampaign(); };
  if (window.esConfirm) {
    window.esConfirm({
      icon: '🏳️', title: 'Aufgeben?',
      body: 'Dein Einsatz (2 🪙) ist schon gesetzt und kommt nicht zurück.',
      ok: 'Aufgeben', cancel: 'Weiter', danger: true,
    }).then(ok => { if (ok) finish(); });
  } else finish();
}

// ── Rendering ──
// Vorschau-Karte: eine stabile Beispiel-Karte für die Startansicht (nicht spielbar),
// damit man die Karte auch ohne genug Taler sieht. Pro Session einmal erzeugt.
let _previewMap = null;
function _preview() {
  if (!_previewMap) _previewMap = generateMap();
  return { map: _previewMap, pos: null, visited: [] };
}

export function renderCampaign() {
  const host = document.getElementById('mode-campaign');
  if (!host) return;
  _renderCampaignNow(host);
  // Bestehende 100%-Teilabschnitte (auch aus früherem Fortschritt) nachzählen; wenn dadurch
  // neue Taler dazukommen und keine Runde läuft, die Startansicht neu rendern.
  const before = _camp().claimed.length;
  refreshClaimedTaler().then(() => {
    if (!_camp().run && _camp().claimed.length !== before) _renderCampaignNow(host);
  }).catch(() => {});
}

function _renderCampaignNow(host) {
  const c = _camp();
  // Sicherheitsnetz: Run mit 0 HP (z. B. Reload genau zwischen Tod und Aufräumen)
  // gilt als beendet — Einsatz ist weg, Startansicht zeigen.
  if (c.run && c.run.hp <= 0) { c.run = null; _saveCampaign(); }
  // 🛡️-Rüstung kann sich im Profil geändert haben → max. HP des Runs angleichen.
  if (c.run) {
    const hpMax = HP_MAX + equipEffects().hpBonus;
    if (hpMax !== c.run.hpMax) {
      c.run.hpMax = hpMax;
      c.run.hp = Math.min(c.run.hp, hpMax);
      _saveCampaign();
    }
  }
  updateTalerBadge();
  if (!c.run) {
    // Startansicht (gesperrt / Einsatz) + darunter die Karte als Vorschau.
    host.innerHTML = _startScreenHtml() + _mapHtml(_preview(), true);
    _drawEdges(_preview());
    return;
  }
  host.innerHTML = _mapHtml(c.run, false);
  _drawEdges(c.run);
  // Frischer Lauf: zum Startbereich (unten) scrollen, damit die Startknoten sichtbar sind.
  if (c.run.pos == null) {
    const m = document.getElementById('camp-map');
    if (m) m.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }
}

function _startScreenHtml() {
  const c = _camp();
  const claimed = c.claimed.length;
  const avail = talerAvailable();
  const box = (inner) => `<div style="padding:22px 14px;text-align:center;">
    <div style="font-size:3.4rem;margin-bottom:12px;">🗺️</div>
    <div style="font-family:'Fredoka One',cursive;font-size:1.4rem;color:var(--purple);margin-bottom:12px;">Kampagne</div>
    ${inner}</div>`;
  if (claimed < UNLOCK_NEED) {
    return box(`<div style="font-size:.9rem;color:#8a83a5;font-weight:700;line-height:1.55;max-width:330px;margin:0 auto;">
      Bring erst <b>${UNLOCK_NEED} Übungsarten</b> (z. B. MC) in deinen Decks auf <b>100 %</b>, um die Kampagne freizuschalten.<br><br>
      Freigeschaltet: <b style="color:#a67c00;">${claimed} / ${UNLOCK_NEED}</b> 🪙</div>`);
  }
  const canStart = avail >= STAKE_COST;
  return box(`
    <div style="font-size:.9rem;color:#6f6889;font-weight:700;line-height:1.55;max-width:340px;margin:0 auto 16px;">
      Setze <b>${STAKE_COST} 🪙</b> ein und kämpf dich über die Karte zum Boss.
      <span style="color:#c0392b;">Fällst du (HP = 0), ist der Einsatz verloren.</span>
    </div>
    <div style="font-size:.95rem;font-weight:800;color:var(--text);margin-bottom:16px;">Deine Taler: <span style="color:#a67c00;">${avail} 🪙</span></div>
    <button onclick="startCampaignRun()" ${canStart ? '' : 'disabled'}
      style="font-family:'Fredoka One',cursive;font-size:1rem;padding:14px 26px;border:none;border-radius:14px;cursor:${canStart ? 'pointer' : 'not-allowed'};background:${canStart ? 'linear-gradient(135deg,#a86cdb,#c084fc)' : '#e5def2'};color:${canStart ? '#fff' : '#a79cc2'};box-shadow:${canStart ? '0 4px 0 #7d4bb0' : 'none'};">
      ▶️ Kampagne starten (${STAKE_COST} 🪙)</button>
    ${canStart ? '' : `<div style="font-size:.82rem;color:#8a83a5;font-weight:700;margin-top:12px;">Nicht genug Taler — bring weitere Übungsarten auf 100 %.</div>`}`);
}

const _MAP_H = ROWS * 78;   // px Gesamthöhe der Karte

function _mapHtml(run, preview) {
  let nodesHtml = '';
  for (const id in run.map.nodes) {
    const n = run.map.nodes[id];
    const x = (n.col + 0.5) / COLS * 100;
    const y = (ROWS - 1 - n.row + 0.5) / ROWS * 100;
    const meta = NODE[n.type];
    let bg, ring, opacity, click, cursor, glow;
    if (preview) {
      bg = '#fff'; ring = '2px solid #e5e5e5'; opacity = '.9'; click = ''; cursor = 'default'; glow = '';
    } else {
      const reachable = _isReachable(run, n);
      const isCur = run.pos === id;
      const visited = run.visited.includes(id);
      const selected = reachable && _selectedNodeId === id;
      // Glühen (Puls) zeigt jetzt an, was man ALS NÄCHSTES wählen kann — nicht mehr,
      // wo man zuletzt war. Ausgewählt (2. Klick nötig) = ruhiges Grün statt Puls.
      bg = selected ? '#f2fbec' : (isCur || visited) ? '#e9e2f5' : reachable ? '#fff' : '#f6f6f6';
      ring = selected ? '3px solid #7ed957' : isCur ? '2px solid var(--purple)' : reachable ? '3px solid #f0a500' : '2px solid #e5e5e5';
      opacity = (reachable || visited || isCur) ? '1' : '.45';
      glow = (reachable && !selected) ? 'animation:campNodeGlow 1.3s ease-in-out infinite;' : '';
      click = reachable ? `onclick="campaignNode('${id}')"` : '';
      cursor = reachable ? 'pointer' : 'default';
    }
    nodesHtml += `<button ${click} title="${meta.label}"
      style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);
      width:44px;height:44px;border-radius:50%;border:${ring};background:${bg};opacity:${opacity};
      cursor:${cursor};font-size:1.3rem;line-height:1;display:flex;
      align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.12);z-index:2;padding:0;${glow}">${meta.icon}</button>`;
  }
  let header;
  if (preview) {
    header = `<div style="font-size:.8rem;color:#8a83a5;font-weight:700;text-align:center;margin:4px 0 6px;">🔍 So sieht eine Karte aus — mit ${STAKE_COST} 🪙 geht's los</div>`;
  } else {
    const hpPct = Math.max(0, Math.round(run.hp / run.hpMax * 100));
    const statusText = run.fight
      ? '⚔️ Ein Kampf wartet auf dich — tippe einen Punkt an'
      : run.pos == null
        ? 'Wähle unten deinen Startpunkt ⬇️'
        : _selectedNodeId
          ? '☝️ Nochmal antippen zum Start'
          : 'Wähle den nächsten Knoten';
    // Mitgeführte Tränke über der Lebensanzeige (nur Anzeige — spielbar sind sie im Kampf).
    const potionsHtml = (run.potions && run.potions.length)
      ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:8px;">${run.potions.map(k => POTIONS[k]
          ? `<span title="${POTIONS[k].name}" style="font-size:1.25rem;">${POTIONS[k].icon}</span>` : '').join('')}</div>`
      : '';
    header = `
  ${potionsHtml}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
    <div style="flex:1;min-width:0;">
      <div style="font-family:'Fredoka One',cursive;font-size:.8rem;color:var(--text);margin-bottom:3px;">❤️ ${run.hp} / ${run.hpMax}</div>
      <div style="height:12px;background:#ece5f9;border-radius:8px;overflow:hidden;"><div style="height:100%;width:${hpPct}%;background:linear-gradient(90deg,#ff6b6b,#e03131);"></div></div>
    </div>
    <button onclick="campaignGiveUp()" class="back-btn" style="font-size:.72rem;padding:8px 12px;flex-shrink:0;color:#c0392b;">🏳️ Aufgeben</button>
  </div>
  <div style="font-size:.8rem;color:#8a83a5;font-weight:700;text-align:center;margin-bottom:6px;">${statusText}</div>`;
  }
  return `${header}
  <div id="camp-map" style="position:relative;width:100%;height:${_MAP_H}px;">
    <svg id="camp-edges" style="position:absolute;inset:0;width:100%;height:100%;z-index:1;" viewBox="0 0 100 ${_MAP_H}" preserveAspectRatio="none"></svg>
    ${nodesHtml}
  </div>`;
}

function _drawEdges(run) {
  const svg = document.getElementById('camp-edges');
  if (!svg) return;
  const coord = (n) => ({
    x: (n.col + 0.5) / COLS * 100,
    y: (ROWS - 1 - n.row + 0.5) / ROWS * _MAP_H,
  });
  let lines = '';
  for (const id in run.map.nodes) {
    const a = run.map.nodes[id];
    const pa = coord(a);
    for (const bid of a.next) {
      const b = run.map.nodes[bid];
      if (!b) continue;
      const pb = coord(b);
      const done = run.visited.includes(id) && run.visited.includes(bid);
      lines += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${done ? '#a86cdb' : '#d9d0ec'}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    }
  }
  svg.innerHTML = lines;
}
