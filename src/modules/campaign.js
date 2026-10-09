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
import { HP_MAX, REST_HEAL, BOSS_WIN_TALER, scaledEnemy, VERB_TIER_START, VERB_TIER_PER_ROUND, VERB_OWN_SHARE_START, VERB_OWN_SHARE_PER_ROUND, VERB_OWN_SHARE_MIN } from './campaign-balance.js';
import { openFight, fightPoolReady, verbsReady, loadPresetSupply } from './campaign-fight.js';
import { equipEffects, openPotionChoice, POTIONS, POTION_TON, potionStacks } from './campaign-equipment.js';
import { arenaTag, campfireTag, CAMPFIRE_FRAMES, CAMPFIRE_FPS } from './world.js';
import { renderAvatarInto } from './avatar.js';
import { dungeonEnemySVG } from './pixel-enemies-dungeon.js';

const ROWS = 13;            // Reihe 0 = Start (unten), Reihe ROWS-1 = Boss (oben)
const COLS = 5;
const PATHS = 6;            // Anzahl generierter Pfade von unten nach oben
export const STAKE_COST = 2;
export const UNLOCK_NEED = 2;      // so viele 100%-Deck-Modi (Taler) zum Freischalten

// Knotentypen. Farben nach Fragment 6.1: Kampf pfirsich, Rast rosa, Schatz
// hellblau, Boss flieder. Die „Unregelmäßigen" zeigt 6.1 nur ausgegraut — ihr
// Portal ist in der Vorschau 6.2 flieder, das übernehmen wir.
const NODE = {
  fight:     { icon: 'sword',    ton: 'var(--p-pfirsich)', label: 'Übung' },
  irregular: { icon: 'portal',   ton: 'var(--p-lila)',     label: 'Unregelmäßige' },
  rest:      { icon: 'campfire', ton: 'var(--p-rosa)',     label: 'Rastplatz' },
  treasure:  { icon: 'gem',      ton: 'var(--p-blau)',     label: 'Schatz' },
  boss:      { icon: 'crownBig', ton: 'var(--p-lila)',     label: 'Boss' },
};

// Lagerfeuer flackern überall gleich (Übersicht 9.7): 4 Bilder mit 4 fps.
const _flackern = (html, d = 0) =>
  html.replace('<canvas ', `<canvas data-ui="swap" data-seq="campfire,campfireL,campfire,campfireR" data-d="${d}" `);

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
// erst der Tod beendet ihn. c.runLen sammelt die abgeschlossenen Karten,
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
  // +1 pro Boss-Sieg, bei Niederlage zurück auf 0. bossWins bleibt davon
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
      // Schnellmodus bringt keine Taler (F-30): solange er läuft, stehen in den
      // Decks nur die vorläufigen Schnell-Stände — nichts davon wird eingelöst.
      if (window.schnellByMode && window.schnellByMode.free) continue;
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

// ── Rastplatz (Screen 6.7) ───────────────────────────────────────────────────
// Eigener Screen statt Toast: Abend-Kampfplatz, Lagerfeuer in 8 fps, die Figur
// daneben, darunter die Lebensleiste mit dem Zugewinn als schraffiertem Stück.
// Die Heilung selbst ist unverändert (REST_HEAL, auf hpMax gedeckelt) — der
// Screen zeigt sie nur.
let _restTimer = null;

function _removeRest() {
  clearInterval(_restTimer); _restTimer = null;
  document.getElementById('camp-rest')?.remove();
}

function _renderRest(run, before) {
  _removeRest();
  const gewinn = run.hp - before;
  const pctVor = Math.max(0, Math.min(100, before / run.hpMax * 100));
  const pctZu = Math.max(0, Math.min(100 - pctVor, gewinn / run.hpMax * 100));
  const ov = document.createElement('div');
  ov.id = 'camp-rest';
  ov.className = 'rest-ov p-ton-mint';
  ov.innerHTML = `
    <div class="cf-scenery">${arenaTag('abend')}</div>
    <div class="rest-kopf"><span class="rest-titel">${_flackern(iconHTML('campfire', 14))}Rastplatz</span></div>
    <div class="rest-mitte">
      <div class="rest-karte">
        <div class="rest-h1">Ausgeruht</div>
        <div class="rest-tx">Das Feuer wärmt. Du sammelst Kraft für den Weg zum Boss.</div>
        <div class="rest-zeile">
          <span class="rest-lbl">Leben</span>
          <span class="rest-zahl">${before} → ${run.hp}/${run.hpMax}</span>
        </div>
        <div class="rest-bar">
          <i class="rest-bar-alt" style="width:${pctVor}%"></i>
          <i class="rest-bar-neu" style="left:${pctVor}%;width:${pctZu}%"></i>
        </div>
        <div class="rest-plus"><span class="rest-chip">${iconHTML('heart', 14).replace('<canvas ', '<canvas data-ui="beat" data-c="12" ')}+${gewinn} Leben</span></div>
        <button class="rest-weiter" id="rest-weiter">Weiter</button>
      </div>
    </div>
    <div class="rest-buehne">
      <div class="rest-held" id="rest-held"></div>
      <div class="rest-feuer" id="rest-feuer">${campfireTag(0, 2)}</div>
    </div>`;
  document.body.appendChild(ov);
  // Wie Fragment 6.7 („hero:…:s"): Figur mit Pixel-Schatten, 2× = 108 × 174.
  renderAvatarInto('rest-held', window.SD, { shadow: true, scale: 2 });
  let bild = 0;
  _restTimer = setInterval(() => {
    bild = (bild + 1) % CAMPFIRE_FRAMES.length;
    const el = document.getElementById('rest-feuer');
    if (el) el.innerHTML = campfireTag(bild, 2); else _removeRest();
  }, 1000 / CAMPFIRE_FPS);
  document.getElementById('rest-weiter')?.addEventListener('click', () => { _removeRest(); renderCampaign(); });
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
  // (siehe _startFight/onEnd) — beim Tod gibt es kein carryPotions, dann 0.
  c.run = { map: generateMap(), pos: null, visited: [], hp: hpMax, hpMax, potions: c.carryPotions || [] };
  c.carryPotions = null;
  _saveCampaign();
  updateTalerBadge();
  renderCampaign();
  // Frischer Lauf: zum Startbereich (unten) scrollen, damit die Startpunkte sichtbar sind.
  document.getElementById('camp-map')?.scrollIntoView({ block: 'end', behavior: 'smooth' });
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
    if (!fightPoolReady()) { window.esToast?.('Keine Vokabeln in deinen Decks — der Kampf braucht Wörter'); return; }
    run.pos = id;
    if (!run.visited.includes(id)) run.visited.push(id);
    _saveCampaign();
    _startFight(node);
    return;
  }
  run.pos = id;
  if (!run.visited.includes(id)) run.visited.push(id);
  if (node.type === 'rest') {
    // 🔥 Rastplatz: ausruhen (+HP, gedeckelt). Die Heilung ist unverändert —
    // seit Screen 6.7 sieht man sie nur, statt sie im Vorbeigehen zu bekommen.
    const before = run.hp;
    run.hp = Math.min(run.hpMax, run.hp + REST_HEAL);
    _saveCampaign();
    renderCampaign();
    _renderRest(run, before);
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
        window.esToast?.(`${POTIONS[key].name} eingesteckt!`);
      },
    });
    return;
  }
  _saveCampaign();
  renderCampaign();
}

// Zurückgehen im Kampf (F-78 neu gefasst, F-84/F-85, Wunsch des Nutzers 09.10.2026):
// alles von vorn — neue Karte, Runde 1 (Gegner wie zu Beginn), volle Leben,
// Lauf-Länge 0. Der Einsatz bleibt (der neue Lauf startet gleich gratis), die Tränke
// wandern mit, als verlorener Lauf zählt es nicht. Zum Heilen lohnt es sich so nie.
function _vonVorn(c) {
  _finishMap(c, false);
  c.round = 0;
  c.carryPotions = c.run.potions || [];
  c.run = null;
  c.freeStart = true;
  startCampaignRun();
}

// Boss-Sieg verbuchen: Runde +1 (nächste ist schwerer), Belohnung (wie Einsatz, nur
// umgekehrt), nächster Lauf gratis, unverbrauchte Tränke wandern mit. Die Karte ist
// zu Ende, die Lauf-Länge läuft in der nächsten Runde weiter.
function _bossSieg(c) {
  if (!c.run) return;
  c.bossWins = (c.bossWins || 0) + 1;
  c.round = (c.round || 0) + 1;
  c.talerSpent -= BOSS_WIN_TALER;
  c.freeStart = true;
  c.stats.boss++;
  c.stats.runsWon++;
  _finishMap(c, true);
  c.carryPotions = c.run.potions || [];
  c.run = null;
}

// Kampf am Knoten öffnen. onEnd regelt die Run-Folgen: Boss-Sieg oder Tod beendet den
// Run, 'retreat' fängt von vorn an (_vonVorn); null ist nur der interne
// Nicht-Fall (z. B. Wortpool beim Laden leer).
function _startFight(node) {
  const c = _camp();
  openFight({
    run: c.run,
    node,
    save: _saveCampaign,
    round: campRound(),
    stat: (key) => { if (CAMP_STAT_KEYS.includes(key)) c.stats[key]++; },
    onEnd: (result) => {
      if (result === 'retreat') { if (c.run) _vonVorn(c); else renderCampaign(); return; }
      // Schon verbucht (_renderCampaignNow hat den Boss-Sieg nachgeholt): nur zeichnen.
      if (!c.run) { renderCampaign(); return; }
      if (result === 'victory' && node.type === 'boss') _bossSieg(c);
      else if (result === 'victory' && CAMP_STAT_KEYS.includes(node.type)) c.stats[node.type]++;
      else if (result === 'death') {
        // Der Tod beendet den Lauf: Lauf-Länge zurück, Aufstieg beginnt von vorn.
        c.stats.runsLost++;
        _finishMap(c, false);
        c.round = 0;
        c.run = null;
      }
      _saveCampaign();
      // Nach dem Boss führt „Zur Kampagne“ zurück zur Übersicht (F-35); dort kommt
      // das Popup mit der neuen Runde (F-82, _rundePopup).
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
  // Sprechblase wie Fragment 6.8 (N33). Die Tränke sitzen oben rechts in der
  // Kopfkarte, rechts daneben ist kein Platz — die Blase hängt deshalb darunter,
  // rechtsbündig, der Zipfel zeigt nach oben auf den Trank.
  const tip = document.createElement('div');
  tip.id = 'camp-potion-tip';
  tip.className = 'p-trank-blase';
  tip.dataset.key = key;
  const right = Math.max(16, window.innerWidth - r.right);
  tip.style.cssText = `right:${right}px;top:${r.bottom + 10}px;`;
  tip.innerHTML = `<span class="p-trank-blase-zipfel" style="right:${Math.round(r.width / 2) - 6}px"></span>`
    + `<div class="p-trank-blase-name">${info.name}</div>`
    + `<div class="p-trank-blase-text">${info.desc}. Nochmal tippen schließt.</div>`;
  document.body.appendChild(tip);
  setTimeout(() => { if (tip.parentNode) tip.remove(); }, 3500);
}

// ── Rendering ──
// Vorschau (Fragmente 6.2–6.5): eine feste kleine Beispielkarte über dem
// Startkasten — Boss oben, zwei Ebenen, Start unten. Nicht spielbar; sie zeigt
// nur, wie eine Karte aussieht. Bis Phase 7 stand hier eine volle Zufallskarte.
function _vorschauHtml() {
  const k = (ton, inhalt, boss) =>
    `<div class="p-vk-knoten${boss ? ' p-vk-knoten--boss' : ''}" style="background:${ton}">${inhalt}</div>`;
  const strich = '<div class="p-vk-strich"></div>';
  return `<div class="p-vk-titel">So sieht eine Karte aus — mit ${STAKE_COST} Taler geht's los</div>
  <div class="p-vk-karte">
    <div class="p-vk-reihe p-vk-reihe--mitte">${k('var(--p-rosa)', `<div class="p-vk-lich">${dungeonEnemySVG('lichHead')}</div>`, true)}</div>
    ${strich}
    <div class="p-vk-reihe">${k('var(--p-pfirsich)', _flackern(iconHTML('campfire', 28)))}${k('var(--p-karte)', iconHTML('sword', 28))}${k('var(--p-gold)', iconHTML('box', 28))}</div>
    ${strich}
    <div class="p-vk-reihe">${k('var(--p-karte)', iconHTML('sword', 28))}${k('var(--p-lila)', iconHTML('portal', 28))}</div>
    ${strich}
    <div class="p-vk-reihe p-vk-reihe--mitte">${k('var(--p-mint)', iconHTML('flag', 28))}</div>
    <div class="p-vk-chipplatz"><span class="p-vk-chip">Vorschau</span></div>
  </div>`;
}

// Neue Runde nach dem Boss (F-82, Wunsch des Nutzers 09.10.2026): Popup über der
// Kampagnen-Übersicht — wie stark die Gegner jetzt werden (alt → neu), Zeit gleich
// (F-83), Verben schwerer — und „Runde N starten“; danach unten am ersten Punkt.
// Einmal je Runde und Sitzung; wer es schließt, startet über den Startkasten.
let _rundePopupFuer = null;
function _rundePopup(host) {
  const c = _camp();
  if (c.run || !c.freeStart || !c.round || _rundePopupFuer === c.round) return;
  if (!host.offsetParent || document.querySelector('.p-runde-grund')) return;   // Tab nicht sichtbar
  _rundePopupFuer = c.round;
  const neu = c.round, alt = neu - 1, nr = neu + 1;
  const zeile = (icon, name, typ) => {
    const a = scaledEnemy(typ, alt), b = scaledEnemy(typ, neu);
    return `<tr><th><span class="p-runde-name">${iconHTML(icon, 14)}${name}</span></th><td>${a.hp} → <b>${b.hp}</b></td><td>${a.dmg} → <b>${b.dmg}</b></td></tr>`;
  };
  // Verben: schwerer, solange die Stufen-Glocke steigt oder der Anteil eigener Verben sinkt.
  const stufe = (r) => Math.min(5, VERB_TIER_START + VERB_TIER_PER_ROUND * r);
  const eigen = (r) => Math.max(VERB_OWN_SHARE_MIN, VERB_OWN_SHARE_START - VERB_OWN_SHARE_PER_ROUND * r);
  const verben = verbsReady()
    ? `<tr><th><span class="p-runde-name">${iconHTML('portal', 14)}Verben</span></th><td colspan="2"><b>${stufe(neu) > stufe(alt) || eigen(neu) < eigen(alt) ? 'schwerer' : 'gleich'}</b></td></tr>`
    : '';
  const d = document.createElement('div');
  d.className = 'p-dlg-grund p-runde-grund';
  d.innerHTML = `<div class="p-dlg-karte">
      <div class="p-dlg-emblem" style="background:var(--p-gold)">${iconHTML('crownBig', 28, { style: 'position:relative;left:1px' })}</div>
      <div class="p-dlg-titel">Runde ${nr}</div>
      <div class="p-kicker p-runde-kicker">So stark sind die Gegner</div>
      <table class="p-runde-tabelle">
        <thead><tr><th></th><th>Leben</th><th>Schaden</th></tr></thead>
        <tbody>
          ${zeile('sword', 'Gegner', 'fight')}${zeile('crown', 'Boss', 'boss')}
          <tr><th><span class="p-runde-name">${iconHTML('hourglass', 14)}Zeit</span></th><td colspan="2"><b>gleich</b></td></tr>
          ${verben}
        </tbody>
      </table>
      <div class="p-dlg-knoepfe"><button class="p-dlg-btn p-dlg-btn--ok" data-start>Runde ${nr} starten · gratis</button></div>
    </div>`;
  d.querySelector('[data-start]').addEventListener('click', () => { d.remove(); startCampaignRun(); });
  document.body.appendChild(d);
}

export function renderCampaign() {
  const host = document.getElementById('mode-campaign');
  if (!host) return;
  // Vorlagen-Nachschub im Hintergrund holen (einmal pro Session), damit der Kampf
  // nachfüllen kann, sobald das erste Wort gelernt ist.
  loadPresetSupply().catch(() => {});
  _renderCampaignNow(host);
  _rundePopup(host);
  // Bestehende 100%-Teilabschnitte (auch aus früherem Fortschritt) nachzählen; wenn dadurch
  // neue Taler dazukommen und keine Runde läuft, die Startansicht neu rendern.
  const before = _camp().claimed.length;
  refreshClaimedTaler().then(() => {
    if (!_camp().run && _camp().claimed.length !== before) _renderCampaignNow(host);
  }).catch(() => {});
}

// App-Tour (1.14): nur die Startansicht zeichnen — ohne Vorlagen-Nachschub und ohne
// das nachgelagerte Taler-Nachzählen. Beides liefe erst nach dem Demo-Zeichnen und
// läse dann den echten Stand (renderMenuDemo in ui.js).
export function renderCampaignDemo() {
  const host = document.getElementById('mode-campaign');
  if (host) _renderCampaignNow(host);
}

function _renderCampaignNow(host) {
  const c = _camp();
  // Sicherheitsnetz: Run mit 0 HP (z. B. Reload genau zwischen Tod und Aufräumen)
  // gilt als beendet — Einsatz ist weg, Startansicht zeigen. Die Lauf-Länge geht
  // dabei zurück auf 0, sonst zählte sie in den nächsten Lauf hinein.
  if (c.run && c.run.hp <= 0) { c.run = null; c.runLen = 0; _saveCampaign(); }
  // Boss gefallen, aber „Zur Kampagne“ nie getippt (App vorher geschlossen): der Lauf
  // stand auf dem Boss-Punkt, der keinen Folgepunkt hat — nichts war mehr antippbar
  // (Hänger nach Runde 3, 09.10.2026). Gilt als Boss-Sieg.
  if (c.run && !c.run.fight && c.run.map.nodes[c.run.pos]?.type === 'boss') { _bossSieg(c); _saveCampaign(); }
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
    // Startansicht: Vorschau, darunter gesperrt / Einsatz / gratis (6.2–6.5).
    host.innerHTML = _startScreenHtml();
    return;
  }
  host.innerHTML = _mapHtml(c.run);
  _drawEdges(c.run);
  // Kein Sprung nach unten beim Tab-Wechsel (Wunsch des Nutzers 09.10.2026) — nach
  // unten zu den Startpunkten geht es nur beim Start eines Laufs (startCampaignRun).
}

// Startkasten unter der Vorschau: gesperrt (6.2), gratis nach Boss-Sieg (6.5),
// sonst Einsatz mit genug (6.3) oder zu wenig Talern (6.4). Regeln unverändert.
function _startScreenHtml() {
  const c = _camp();
  const claimed = c.claimed.length;
  const avail = talerAvailable();
  const kopf = (kachelTon, icon, titel, text) => `<div class="p-kstart-kopf">
      <div class="p-kstart-kachel" style="background:${kachelTon}">${iconHTML(icon, 28)}</div>
      <div class="p-wachs"><div class="p-kstart-titel">${titel}</div><div class="p-kstart-text" style="margin-top:2px">${text}</div></div>
    </div>`;
  let box;
  if (claimed < UNLOCK_NEED) {
    const pct = Math.round(Math.min(claimed, UNLOCK_NEED) / UNLOCK_NEED * 100);
    box = `<div class="p-kstart">
      ${kopf('var(--p-inaktiv)', 'lock', 'Noch gesperrt', `Bring erst ${UNLOCK_NEED} Übungsarten auf 100 %.`)}
      <div class="p-kstart-frei"><span>Freigeschaltet</span><span>${claimed}/${UNLOCK_NEED}</span></div>
      <div class="p-kstart-balken"><i style="width:${pct}%"></i></div>
    </div>`;
  } else if (c.freeStart) {   // Boss gerade besiegt → dieser Lauf kostet nichts
    box = `<div class="p-kstart p-kstart--hell">
      ${kopf('var(--p-gold)', 'crownBig', 'Boss besiegt!', 'Der nächste Lauf kostet dich nichts.')}
      <button onclick="startCampaignRun()" class="p-kstart-btn p-kstart-btn--gratis">${iconHTML('flag', 14)}Neuen Lauf starten · gratis</button>
    </div>`;
  } else {
    const canStart = avail >= STAKE_COST;
    const fehlt = STAKE_COST - avail;
    box = `<div class="p-kstart">
      <div class="p-kstart-titel">Setze ${STAKE_COST} Taler ein</div>
      ${canStart ? '<div class="p-kstart-text" style="margin-top:3px">Kämpf dich bis zum Boss. Verlierst du, ist der Einsatz weg.</div>' : ''}
      <div class="p-kstart-taler"><span>Deine Taler</span><b>${iconHTML('coin', 14)}${avail}</b></div>
      <button onclick="startCampaignRun()" ${canStart ? '' : 'disabled'} class="p-kstart-btn${canStart ? '' : ' is-aus'}">${iconHTML(canStart ? 'coin' : 'lock', 14)}Kampagne starten · ${STAKE_COST} Taler</button>
      ${canStart ? '' : `<div class="p-kstart-fehlt">${fehlt === 1
        ? 'Dir fehlt 1 Taler — schließ eine Übungsart auf 100 % ab.'
        : `Dir fehlen ${fehlt} Taler — schließ ${fehlt} Übungsarten auf 100 % ab.`}</div>`}
    </div>`;
  }
  return _vorschauHtml() + box;
}

// Reihenabstand wie Fragment 6.1 (82 px von Mitte zu Mitte).
const _MAP_H = ROWS * 82;   // px Gesamthöhe der Karte

function _mapHtml(run) {
  let nodesHtml = '';
  let offenN = 0;
  for (const id in run.map.nodes) {
    const n = run.map.nodes[id];
    const x = (n.col + 0.5) / COLS * 100;
    const y = (ROWS - 1 - n.row + 0.5) / ROWS * 100;
    const meta = NODE[n.type];
    const isBoss = n.type === 'boss';
    // Außenmaße wie Fragment 6.1: 46 + Rahmen, der Boss 70 + Rahmen.
    const size = isBoss ? 74 : 50;
    const radius = isBoss ? 'var(--p-r-dialog)' : 'var(--p-r-kachel)';
    // Offener Kampf (App mitten im Kampf geschlossen): antippbar ist genau sein Punkt
    // und setzt ihn fort — vorher waren es die Folgepunkte, und beim Boss gab es
    // keine (Hänger, 09.10.2026).
    const reachable = run.fight ? run.fight.nodeId === id : _isReachable(run, n);
    const isCur = run.pos === id;
    const visited = run.visited.includes(id);
    // Aktueller Knoten in Tinte, erreichbare in ihrer Farbe mit Goldring, alle
    // übrigen auf Sand mit blassem Symbol (die Kachel selbst bleibt satt). Der
    // Boss steht immer in Farbe mit Goldring und schwebt: er ist das Ziel (6.1).
    // Ein offener Kampf leuchtet auf seinem (Tinten-)Punkt.
    const offen = (reachable && (!isCur || !!run.fight)) || isBoss;
    const bg = isCur ? 'var(--p-ink)' : (reachable || visited || isBoss) ? meta.ton : 'var(--p-inaktiv)';
    const blass = !(reachable || visited || isCur || isBoss);
    let icon = iconHTML(meta.icon, isBoss ? 56 : 28);
    if (n.type === 'rest') icon = _flackern(icon, n.row % 4);
    // Die Krone ist im 14er-Raster nur 13 breit und säße 2 px zu weit links
    // (Wunsch des Nutzers: mittig) — verschoben, Pixeldaten unverändert.
    if (isBoss) icon = icon.replace('<canvas ', '<canvas class="p-knoten-krone" data-ui="bob" data-a="2" ');
    if (blass) icon = `<span class="p-knoten-blass">${icon}</span>`;
    // Goldring wächst im Takt (data-ui="halo"), jeder offene Punkt 2 Takte versetzt.
    const halo = offen ? ` data-ui="halo" data-d="${isBoss ? 0 : 2 * ++offenN}"` : '';
    const click = reachable ? `onclick="campaignNode('${id}')"` : '';
    const cursor = reachable ? 'pointer' : 'default';
    nodesHtml += `<button ${click} title="${meta.label}" class="p-knoten${offen ? ' p-knoten--offen' : ''}"${halo}
      style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;border-radius:${radius};
      background:${bg};cursor:${cursor};">${icon}</button>`;
  }
  let header;
  {   // Kopfkarte des laufenden Laufs (Fragment 6.1)
    const hpPct = Math.max(0, Math.round(run.hp / run.hpMax * 100));
    // Mitgeführte Tränke über der Lebensanzeige (spielbar sind sie erst im Kampf — hier
    // nur Anzeige; Antippen zeigt Name+Wirkung als kleine Sprechblase daneben).
    // Gleiche Tränke liegen auf EINEM Platz mit kleiner Anzahl in der Ecke; mindestens
    // drei Plätze stehen immer da (leer gestrichelt), damit man sieht, wo etwas hinkommt.
    const slots = potionStacks(run.potions).map(s =>
      `<button onclick="campPotionInfo(this,'${s.key}')" class="camp-slot" style="background:${POTION_TON[s.key] || 'var(--p-karte)'}">${iconHTML('potion', 14)}${
        s.count > 1 ? `<span class="potion-n">${s.count}</span>` : ''}</button>`);
    while (slots.length < 3) slots.push('<div class="camp-slot empty"></div>');
    const potionsHtml = `<div style="display:flex;gap:6px;flex:none">${slots.join('')}</div>`;
    // Runde = Stufe des laufenden Aufstiegs (1. Boss-Sieg schließt Runde 1 ab, danach läuft
    // Runde 2 usw.; eine Niederlage setzt zurück auf Runde 1);
    // Run-Länge = wie weit dieser Aufstieg insgesamt gekommen ist (alle Karten zusammen,
    // siehe _runLength) — bewusst nicht die Gesamtsumme über ALLE Läufe: neben „Runde 2"
    // wirkte eine dreistellige Summe wie ein Fehler. Der Rekord steht auf der
    // Fortschritt-Seite („Längster Run").
    const c = _camp();
    const roundNum = (c.round || 0) + 1;
    // Kopfkarte (Wunsch des Nutzers 09.10.2026): so hoch wie Probetest und
    // Trainingsplatz, damit beim Tab-Wechsel nichts springt — Runde und Leben links,
    // Tränkeplätze rechts. „Aufgeben" und die Hinweiszeile darunter sind weg.
    header = `
  <div class="p-karte camp-kopf">
    <div class="p-wachs">
      <div class="camp-kopf-runde">Runde ${roundNum} · Run-Länge ${_runLength(c)}</div>
      <div class="camp-kopf-leben"><span>Leben</span><div class="p-balken"><i style="width:${hpPct}%"></i></div><b>${run.hp}/${run.hpMax}</b></div>
    </div>
    ${potionsHtml}
  </div>`;
  }
  // Die Karte liegt in einer eigenen Karte; die Legende „offen / später" ist weg
  // (Wunsch des Nutzers 09.10.2026) — offene Punkte leuchten ohnehin golden.
  return `${header}
  <div class="p-karte" style="border-radius:24px;padding:15px 13px;margin-top:12px">
    <div class="p-kicker" style="border:0;padding:0;margin-bottom:12px">Pfad wählen</div>
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
      lines += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${offen ? '#1F1F24' : '#9B968A'}" stroke-width="4" stroke-dasharray="${offen ? '5 4' : '4 6'}" stroke-linecap="butt" vector-effect="non-scaling-stroke"/>`;
    }
  }
  svg.innerHTML = lines;
}
