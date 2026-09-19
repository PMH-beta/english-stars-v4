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
import { statKeyFor } from './stats.js';
import { uvTrainProgress } from './irregular-game.js';
import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';
import { iconHTML } from './pixel-icons.js';
import { HP_MAX, REST_HEAL, BOSS_WIN_TALER } from './campaign-balance.js';
import { openFight, fightPoolReady, verbsReady, loadPresetSupply } from './campaign-fight.js';
import { equipEffects, openPotionChoice, POTIONS, potionStacks } from './campaign-equipment.js';

const ROWS = 13;            // Reihe 0 = Start (unten), Reihe ROWS-1 = Boss (oben)
const COLS = 5;
const PATHS = 6;            // Anzahl generierter Pfade von unten nach oben
export const STAKE_COST = 2;
const UNLOCK_NEED = 2;      // so viele 100%-Deck-Modi (Taler) zum Freischalten

// Knotentypen. Farbe und Pixelsymbol folgen der Bedeutung, die die Farbe im
// uebrigen Design schon hat: Kampf rosa wie der Kampfbildschirm, Formen
// pfirsich wie der Formen-Tab, Rast mint, Schatz hellblau, Boss flieder.
const NODE = {
  fight:     { icon: 'sword',    ton: 'var(--p-rosa)',     label: 'Übung' },
  irregular: { icon: 'portal',   ton: 'var(--p-pfirsich)', label: 'Unregelmäßige' },
  rest:      { icon: 'campfire', ton: 'var(--p-mint)',     label: 'Rastplatz' },
  treasure:  { icon: 'gem',      ton: 'var(--p-blau)',     label: 'Schatz' },
  boss:      { icon: 'crownBig', ton: 'var(--p-lila)',     label: 'Boss' },
};

// Gewichtete Zufallswahl: höheres Gewicht = wahrscheinlicher, aber nie ausgeschlossen.
function _weightedPick(arr, weightFn) {
  const weights = arr.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  let x = Math.random() * total;
  for (let i = 0; i < arr.length; i++) { x -= weights[i]; if (x <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

// Tiefe (row+1) des Knotens, an dem ein Lauf gerade steht — 0, wenn noch kein Knoten
// betreten wurde. Fließt beim Karten-Ende in die Lauf-Länge (siehe _finishMap) — DORT
// und nicht bei jedem Schritt, sonst zählte jeder Zwischenknoten mit.
function _runDepth(run) {
  if (!run || run.pos == null) return 0;
  const n = run.map.nodes[run.pos];
  return n ? n.row + 1 : 0;
}

// Lauf-Länge = Tiefe ALLER Karten des laufenden Aufstiegs zusammen: ein Boss-Sieg
// beendet nur die Karte, der Lauf geht in der nächsten Runde weiter (freeStart) —
// erst Tod oder Aufgeben beendet ihn. c.runLen sammelt die abgeschlossenen Karten,
// die aktuelle kommt über _runDepth dazu.
function _runLength(c) { return (c.runLen || 0) + _runDepth(c.run); }
// Karte zu Ende: Rekord festhalten (längster Lauf + wie viele Bosse dabei fielen) und
// die Länge entweder weitertragen (Boss-Sieg) oder auf 0 zurücksetzen (Lauf vorbei).
function _finishMap(c, keepRun) {
  const total = _runLength(c);
  if (total > (c.stats.bestRun || 0)) {
    c.stats.bestRun = total;
    c.stats.bestRunBosses = c.round || 0;
  }
  c.runLen = keepRun ? total : 0;
}

// fight/irregular/boss = gewonnene Kämpfe je Gegner-Art (= Knoten-Typ). bestRow = höchste
// je auf EINER Karte erreichte Reihe (Highscore, kein Zähler). bestRun/bestRunBosses =
// längster Lauf über alle Runden hinweg und die Bosse darin. potions/treasures = getrunkene
// Tränke bzw. gefundene Schätze.
export const CAMP_STAT_KEYS = ['fight', 'irregular', 'boss', 'runsWon', 'runsLost', 'bestRow', 'bestRun', 'bestRunBosses', 'potions', 'treasures'];

// ── SD-Zugriff (mit Default-Reparatur) ──
function _camp() {
  const SD = window.SD;
  if (!SD.campaign || typeof SD.campaign !== 'object') SD.campaign = { claimed: [], talerSpent: 0, run: null };
  if (!Array.isArray(SD.campaign.claimed)) SD.campaign.claimed = [];
  if (typeof SD.campaign.talerSpent !== 'number') SD.campaign.talerSpent = 0;
  if (typeof SD.campaign.bossWins !== 'number') SD.campaign.bossWins = 0;
  // Runde = Schwierigkeitsstufe des LAUFENDEN Aufstiegs (Slay-the-Spire-Ascension):
  // +1 pro Boss-Sieg, bei Niederlage/Aufgeben zurück auf 0. bossWins bleibt davon
  // unberührt (Lebenszähler fürs Profil). Altstände erben ihre bisherige Stufe.
  if (typeof SD.campaign.round !== 'number') SD.campaign.round = SD.campaign.bossWins || 0;
  if (typeof SD.campaign.freeStart !== 'boolean') SD.campaign.freeStart = false;
  // Länge der schon abgeschlossenen Karten des laufenden Aufstiegs (siehe _runLength).
  if (typeof SD.campaign.runLen !== 'number') SD.campaign.runLen = 0;
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

// Aktuelle Runde (0 = erste). Steuert die Gegner-Skalierung und die Verb-Stufen.
export function campRound() { return _camp().round || 0; }

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
// Debug-Helfer (nur Konsole): schließt n Übungsarten in den Freier-Modus-Decks
// WIRKLICH ab — jedes Wort der Art bekommt einen gemeisterten Lernstand
// (asked 3 / 3× richtig), damit Deck-Prozente, Wortlisten und Fortschritt-Seite
// 100 % zeigen. Die Taler holt danach refreshClaimedTaler auf dem normalen Weg.
// Ein negativer Rest aus talerTest wird zurückgesetzt. Aufruf: talerDeckTest(4)
const _TALER_SUF = { mc: '_mc', sp: '_sp', pr: '_pr' };
export async function talerDeckTest(n = 4) {
  const c = _camp();
  if (c.talerSpent < 0) c.talerSpent = 0;   // negativer Rest aus talerTest raus
  const SD = window.SD;
  const decks = SD?.decks || {};
  if (!SD.globalPresetStats) SD.globalPresetStats = { wordStats: {}, categoryProgress: {} };
  if (!SD.globalPresetStats.wordStats) SD.globalPresetStats.wordStats = {};
  const presetWs = SD.globalPresetStats.wordStats;
  const done = [];
  const dirtyDecks = new Set();
  let dirtyPreset = false, words = 0;
  for (const id in decks) {
    if (done.length >= n) break;
    const deck = decks[id];
    if ((deck.mode || 'free') !== 'free' || !deck.vocab?.length) continue;
    if (!deck.wordStats) deck.wordStats = {};
    for (const m of TALER_MODES) {
      if (done.length >= n) break;
      if (isModeComplete(m.prog(deckProgress(deck).perMode))) continue;   // schon fertig
      for (const v of deck.vocab) {
        const store = v._presetId ? presetWs : deck.wordStats;
        store[statKeyFor(v.de, v.en, _TALER_SUF[m.key], v._presetId || null)] =
          { asked: 3, correct: 3, wrong: 0, recent: '111' };
        words++;
        if (v._presetId) dirtyPreset = true; else dirtyDecks.add(id);
      }
      done.push((deck.name || id) + '|' + m.key);
    }
  }
  if (window.currentUser) {
    if (dirtyPreset) markDirty('global_preset');
    for (const id of dirtyDecks) markDirty('word_stats', id);
  }
  await refreshClaimedTaler();     // claimed füllen — läuft den normalen Weg
  _saveCampaign();                 // speichert + schiebt die neuen Wort-Stats hoch
  try { window.renderModeContent?.(); } catch (e) {}   // Vokabeln-Tab sofort neu zeichnen
  console.log('[talerDeckTest] abgeschlossen:', done.join(', ') || 'nichts (alles schon auf 100 %)',
    '| Wort-Stats geschrieben:', words, '| claimed:', _camp().claimed.length, '→ verfügbar:', talerAvailable());
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

  // Wie oft die PATHS-Läufe eine Spalte je Reihe schon besucht haben — spätere Läufe
  // meiden dadurch schon volle Spalten (gewichtet, nicht hart ausgeschlossen). Ohne das
  // klumpt ein reiner Zufallslauf leicht auf 1-2 Spalten und lässt Ränder leer; die
  // Gewichtung sorgt für gleichmäßigere Verteilung, ohne die Wege deterministisch/gleich
  // aussehen zu lassen. Anzahl der Läufe (PATHS) bleibt unverändert.
  const load = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const pickCol = (cands, row) => _weightedPick(cands, c => 1 / (1 + load[row][c]));

  for (let p = 0; p < PATHS; p++) {
    let col = pickCol([0, 1, 2, 3, 4], 0);
    load[0][col]++;
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
      const nc = pickCol(cands.length ? cands : [col], r + 1);
      link(cur, ensure(r + 1, nc));
      load[r + 1][nc]++;
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

export function startCampaignRun() {
  const c = _camp();
  if (c.run) { renderCampaign(); return; }
  const free = c.freeStart;                           // Boss gerade besiegt → dieser Lauf ist gratis
  if (!free && talerAvailable() < STAKE_COST) return;
  if (free) c.freeStart = false; else c.talerSpent += STAKE_COST;   // Einsatz sofort gesetzt
  const hpMax = HP_MAX + equipEffects().hpBonus;     // 🛡️ Rüstung: mehr HP
  // Wort-Grundlage des Laufs sind immer die Freier-Modus-Decks, wie sie GERADE
  // dastehen — auch mitten im Lauf neu angelegte Wörter rutschen nach, sobald sie
  // im Üben zweimal dran waren (Filter in campaign-fight.js).
  // Unverbrauchte Tränke aus einem Boss-Sieg wandern in die neue Runde mit
  // (siehe _startFight/onEnd) — bei Tod/Aufgeben gibt es kein carryPotions, dann 0.
  c.run = { map: generateMap(), pos: null, visited: [], hp: hpMax, hpMax, potions: c.carryPotions || [] };
  c.carryPotions = null;
  _saveCampaign();
  updateTalerBadge();
  renderCampaign();
}

// Ausrüstung liegt als Paperdoll im PROFIL — die Kampagne verweist nicht mehr
// darauf. Die max. HP eines laufenden Runs werden beim Karten-Render an die
// Rüstung angeglichen (_renderCampaignNow).

export function campaignNode(id) {
  const c = _camp();
  const run = c.run;
  if (!run) return;
  if (run.fight) { resumeCampaignFight(); return; }   // offener Kampf geht vor
  const node = run.map.nodes[id];
  if (!node || !_isReachable(run, node)) return;
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
    c.stats.treasures++;
    _saveCampaign();
    renderCampaign();
    openPotionChoice({
      onPick: (key) => {
        if (!Array.isArray(run.potions)) run.potions = [];
        run.potions.push(key);
        _saveCampaign();
        renderCampaign();   // sonst zeigt die Kopfzeile den neuen Trank erst beim nächsten Klick
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
    round: campRound(),
    stat: (key) => { if (CAMP_STAT_KEYS.includes(key)) c.stats[key]++; },
    onEnd: (result) => {
      const bossWin = result === 'victory' && node.type === 'boss';
      if (bossWin) {
        c.bossWins = (c.bossWins || 0) + 1;
        c.round = (c.round || 0) + 1;     // nächste Runde ist schwerer
        c.talerSpent -= BOSS_WIN_TALER;   // Belohnung (wie Einsatz, nur umgekehrt)
        c.freeStart = true;               // nächster Lauf startet ohne Einsatz
      }
      // Gewonnener Kampf zählt auf die Gegner-Art (Knoten-Typ); ein Boss-Sieg
      // beendet den Lauf erfolgreich, der Tod lässt ihn scheitern.
      if (result === 'victory' && CAMP_STAT_KEYS.includes(node.type)) c.stats[node.type]++;
      if (bossWin) c.stats.runsWon++;
      else if (result === 'death') c.stats.runsLost++;
      if (bossWin || result === 'death') {
        // Boss-Sieg beendet nur die Karte — die Lauf-Länge läuft in der nächsten
        // Runde weiter; der Tod beendet den Lauf und setzt sie zurück.
        _finishMap(c, bossWin);
        if (result === 'death') c.round = 0;   // Niederlage → Aufstieg beginnt von vorn
        if (bossWin) c.carryPotions = c.run.potions || [];   // unverbrauchte Tränke: Belohnung wie freeStart
        c.run = null;
      }
      _saveCampaign();
      // „🔄 Neue Runde starten" ist der cf-endbtn im Sieges-Popup selbst (campaign-fight.js
      // _endScreen) — der Klick darauf landet hier UND startet direkt den neuen Lauf.
      if (bossWin) startCampaignRun(); else renderCampaign();
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
  const finish = () => { c.stats.runsLost++; _finishMap(c, false); c.round = 0; c.run = null; _saveCampaign(); renderCampaign(); };
  if (window.esConfirm) {
    window.esConfirm({
      icon: '🏳️', title: 'Aufgeben?',
      body: 'Dein Einsatz (2 🪙) ist schon gesetzt und kommt nicht zurück — und du fängst wieder bei Runde 1 an.',
      ok: 'Aufgeben', cancel: 'Weiter', danger: true,
    }).then(ok => { if (ok) finish(); });
  } else finish();
}

// Mini-Infoblase für einen Trank auf der Karte (Icon antippen). Nochmal auf dasselbe
// Icon tippen schließt sie wieder, sonst verschwindet sie nach ein paar Sekunden.
export function campPotionInfo(el, key) {
  const old = document.getElementById('camp-potion-tip');
  const already = old && old.dataset.key === key;
  if (old) old.remove();
  if (already) return;
  const info = POTIONS[key];
  if (!info || !el) return;
  const r = el.getBoundingClientRect();
  const tip = document.createElement('div');
  tip.id = 'camp-potion-tip';
  tip.dataset.key = key;
  const left = Math.min(window.innerWidth - 16, Math.max(16, r.left + r.width / 2));
  tip.style.cssText = `position:fixed;left:${left}px;top:${r.bottom + 6}px;transform:translateX(-50%);
    background:#2b2350;color:#fff;font-family:'Nunito',sans-serif;font-size:.76rem;font-weight:700;
    line-height:1.4;padding:9px 13px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.32);
    z-index:9000;max-width:200px;text-align:center;`;
  tip.innerHTML = `<div style="font-family:'Fredoka One',cursive;font-size:.85rem;margin-bottom:2px;">${info.icon} ${info.name}</div>${info.desc}`;
  document.body.appendChild(tip);
  setTimeout(() => { if (tip.parentNode) tip.remove(); }, 3500);
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
  // Vorlagen-Nachschub im Hintergrund holen (einmal pro Session), damit der Kampf
  // nachfüllen kann, sobald das erste Wort gelernt ist.
  loadPresetSupply().catch(() => {});
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
  // gilt als beendet — Einsatz ist weg, Startansicht zeigen. Die Lauf-Länge geht
  // dabei zurück auf 0, sonst zählte sie in den nächsten Lauf hinein.
  if (c.run && c.run.hp <= 0) { c.run = null; c.runLen = 0; _saveCampaign(); }
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
  const box = (inner) => `<div class="p-dialogkarte" style="text-align:center">
    <div class="p-emblem p-ton-amber">${iconHTML('map', 42)}</div>
    <div class="p-h1">Kampagne</div>
    ${inner}</div>`;
  if (claimed < UNLOCK_NEED) {
    return box(`<div class="p-lead">
      Bring erst <b>${UNLOCK_NEED} Übungsarten</b> (z. B. Vokabeln) in deinen Sammlungen auf <b>100 %</b>, um die Kampagne freizuschalten.</div>
      <div class="p-feldgruppe"><div class="p-karte p-reihe" style="justify-content:center;gap:7px">
        ${iconHTML('coin', 14)}<span style="font:900 13px var(--p-font)">Freigeschaltet: ${claimed} / ${UNLOCK_NEED}</span>
      </div></div>`);
  }
  const free = c.freeStart;   // Boss gerade besiegt → dieser Lauf kostet nichts
  const canStart = free || avail >= STAKE_COST;
  return box(`
    <div class="p-lead">
      ${free
        ? 'Boss besiegt! Dein <b>nächster Lauf ist kostenlos</b> — kämpf dich über die Karte zum nächsten Boss.'
        : `Setze <b>${STAKE_COST} Taler</b> ein und kämpf dich über die Karte zum Boss.`}
      Fällst du (Leben auf 0), ist der Einsatz verloren.
    </div>
    <div class="p-feldgruppe">
      <div class="p-karte p-reihe" style="justify-content:center;gap:7px">
        ${iconHTML('coin', 14)}<span style="font:900 13px var(--p-font)">Deine Taler: ${avail}</span>
      </div>
      <button onclick="startCampaignRun()" ${canStart ? '' : 'disabled'}
        class="p-btn p-btn--primaer" style="${canStart ? '' : 'opacity:.45;cursor:not-allowed'}">
        Kampagne starten ${free ? '(kostenlos)' : `(${STAKE_COST} Taler)`}</button>
    </div>
    ${canStart ? '' : `<div class="p-lead">Nicht genug Taler — bring weitere Übungsarten auf 100 %.</div>`}`);
}

const _MAP_H = ROWS * 78;   // px Gesamthöhe der Karte

function _mapHtml(run, preview) {
  let nodesHtml = '';
  for (const id in run.map.nodes) {
    const n = run.map.nodes[id];
    const x = (n.col + 0.5) / COLS * 100;
    const y = (ROWS - 1 - n.row + 0.5) / ROWS * 100;
    const meta = NODE[n.type];
    const isBoss = n.type === 'boss';
    // Der Boss sitzt groesser auf der Karte — 70 statt 46, Radius 24 statt 16.
    const size = isBoss ? 70 : 46;
    const radius = isBoss ? 'var(--p-r-dialog)' : 'var(--p-r-kachel)';
    let bg, opacity, click, cursor, klasse;
    if (preview) {
      bg = 'var(--p-inaktiv)'; opacity = '.6'; click = ''; cursor = 'default'; klasse = '';
    } else {
      const reachable = _isReachable(run, n);
      const isCur = run.pos === id;
      const visited = run.visited.includes(id);
      // Aktueller Knoten in Tinte gefuellt, erreichbare mit Goldring, gesperrte
      // blass auf Sand — so steht es in der Spezifikation.
      bg = isCur ? 'var(--p-ink)' : (reachable || visited) ? meta.ton : 'var(--p-inaktiv)';
      opacity = (reachable || visited || isCur) ? '1' : '.45';
      klasse = reachable && !isCur ? ' p-knoten--offen' : '';
      click = reachable ? `onclick="campaignNode('${id}')"` : '';
      cursor = reachable ? 'pointer' : 'default';
    }
    nodesHtml += `<button ${click} title="${meta.label}" class="p-knoten${klasse}"
      style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;border-radius:${radius};
      background:${bg};opacity:${opacity};cursor:${cursor};">${iconHTML(meta.icon, isBoss ? 56 : 28)}</button>`;
  }
  let header;
  if (preview) {
    header = `<div style="font-size:.8rem;color:#8a83a5;font-weight:700;text-align:center;margin:4px 0 6px;">🔍 So sieht eine Karte aus — mit ${STAKE_COST} 🪙 geht's los</div>`;
  } else {
    const hpPct = Math.max(0, Math.round(run.hp / run.hpMax * 100));
    const statusText = run.fight
      ? 'Ein Kampf wartet auf dich — tippe einen Punkt an'
      : run.pos == null
        ? 'Wähle unten deinen Startpunkt'
        : 'Wähle den nächsten Knoten';
    // Mitgeführte Tränke über der Lebensanzeige (spielbar sind sie erst im Kampf — hier
    // nur Anzeige; Antippen zeigt Name+Wirkung als kleine Sprechblase daneben).
    // Gleiche Tränke liegen auf EINEM Platz mit kleiner Anzahl in der Ecke; mindestens
    // drei Plätze stehen immer da (leer gestrichelt), damit man sieht, wo etwas hinkommt.
    const slots = potionStacks(run.potions).map(s =>
      `<button onclick="campPotionInfo(this,'${s.key}')" class="camp-slot">${POTIONS[s.key].icon}${
        s.count > 1 ? `<span class="potion-n">${s.count}</span>` : ''}</button>`);
    while (slots.length < 3) slots.push('<div class="camp-slot empty"></div>');
    const potionsHtml = `<div style="display:flex;gap:6px;">${slots.join('')}</div>`;
    // Runde = Stufe des laufenden Aufstiegs (1. Boss-Sieg schließt Runde 1 ab, danach läuft
    // Runde 2 usw.; eine Niederlage setzt zurück auf Runde 1);
    // Run-Länge = wie weit dieser Aufstieg insgesamt gekommen ist (alle Karten zusammen,
    // siehe _runLength) — bewusst nicht die Gesamtsumme über ALLE Läufe: neben „Runde 2"
    // wirkte eine dreistellige Summe wie ein Fehler. Der Rekord steht auf der
    // Fortschritt-Seite („Längster Run").
    const c = _camp();
    const roundNum = (c.round || 0) + 1;
    // Kopfkarte: Runde und Run-Laenge links, Traenkeplaetze rechts, darunter
    // Lebensbalken und Aufgeben.
    header = `
  <div class="p-karte" style="border-radius:22px;padding:14px">
    <div class="p-reihe" style="justify-content:space-between">
      <div style="font:900 12px var(--p-font);letter-spacing:.06em;text-transform:uppercase;color:var(--p-text-3)">Runde ${roundNum} · Run-Länge ${_runLength(c)}</div>
      ${potionsHtml}
    </div>
    <div class="p-reihe" style="gap:10px;margin-top:12px">
      <div class="p-wachs">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font:800 9px var(--p-font);letter-spacing:var(--p-ls-mikro);text-transform:uppercase;color:var(--p-text-2)">Leben</span>
          <span style="font:900 13px var(--p-font)">${run.hp}/${run.hpMax}</span>
        </div>
        <div class="p-balken" style="margin-top:5px"><i style="width:${hpPct}%"></i></div>
      </div>
      <button onclick="campaignGiveUp()" class="p-chip" style="border-radius:14px;padding:7px 11px;background:var(--p-falsch);flex:none">Aufgeben</button>
    </div>
  </div>
  <div style="text-align:center;font:700 11px var(--p-font);color:var(--p-text-2);margin-top:12px">${statusText}</div>`;
  }
  // Die Karte liegt in einer eigenen Karte mit Legende — welcher Pfad jetzt offen
  // ist und welcher spaeter kommt, ist sonst nicht zu unterscheiden.
  const legende = preview ? '' : `
    <div class="p-reihe" style="justify-content:space-between;margin-bottom:12px">
      <div class="p-kicker" style="border:0;padding:0">Pfad wählen</div>
      <div class="p-reihe" style="gap:7px;font:800 10px var(--p-font);color:var(--p-text-2)">
        <span class="p-pfad-probe p-pfad-probe--offen"></span>offen
        <span class="p-pfad-probe p-pfad-probe--spaeter" style="margin-left:5px"></span>später
      </div>
    </div>`;
  return `${header}
  <div class="p-karte" style="border-radius:24px;padding:15px 13px;margin-top:12px">
    ${legende}
    <div id="camp-map" style="position:relative;width:100%;height:${_MAP_H}px;">
      <svg id="camp-edges" style="position:absolute;inset:0;width:100%;height:100%;z-index:1;" viewBox="0 0 100 ${_MAP_H}" preserveAspectRatio="none"></svg>
      ${nodesHtml}
    </div>
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
      // Offen = gegangen oder von hier aus erreichbar: kraeftige Tinte. Alles
      // Weitere liegt blass dahinter. Pfade laufen HINTER den Knoten (z-index).
      const done = run.visited.includes(id) && run.visited.includes(bid);
      const offen = done || run.pos === id || (run.pos == null && a.row === 0);
      lines += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${offen ? '#1F1F24' : '#9B968A'}" stroke-width="${offen ? 4 : 3}" stroke-dasharray="${offen ? '5 4' : '4 6'}" stroke-linecap="butt" vector-effect="non-scaling-stroke"/>`;
    }
  }
  svg.innerHTML = lines;
}
