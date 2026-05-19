// src/modules/decks.js
import { effectivePct } from './stats.js';

// ────────────────────────────────────────────────
//  UI STATE
// ────────────────────────────────────────────────
let _expandedDeckId = null;

// ────────────────────────────────────────────────
//  CORE DECK OPERATIONS
// ────────────────────────────────────────────────
export function activeDeck() {
  const SD = window.SD;
  return SD.activeDeckId ? SD.decks[SD.activeDeckId] : null;
}

// Synchronisiert die Compatibility-Spiegel (SD.wordStats etc.) mit dem aktiven Deck
export function syncMirrorFromActiveDeck(sd) {
  sd = sd || window.SD;
  if (typeof window.VOCAB !== 'undefined') window.VOCAB.length = 0;
  const deck = sd.activeDeckId ? sd.decks[sd.activeDeckId] : null;
  if (!deck) {
    sd.wordStats = {};
    sd.categoryProgress = {vocab:{played:0,correct:0,bestStreak:0},spelling:{played:0,correct:0,bestStreak:0},pronounce:{played:0,correct:0,bestStreak:0},mixed_vocab:{played:0,correct:0,bestStreak:0}};
    return;
  }
  sd.wordStats = deck.wordStats;
  sd.categoryProgress = deck.categoryProgress;
  if (typeof window.VOCAB !== 'undefined') {
    for (const v of deck.vocab) window.VOCAB.push(v);
  }
}

export function switchDeck(deckId) {
  const SD = window.SD;
  if (!SD.decks[deckId]) return;
  SD.activeDeckId = deckId;
  syncMirrorFromActiveDeck();
  window.persist();
}

export function createDeck(name) {
  const id = 'deck_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  window.SD.decks[id] = {
    id, name: name || 'Neue Vokabelsammlung', createdAt: Date.now(),
    vocab: [], wordStats: {},
    categoryProgress: {
      vocab: {played:0,correct:0,bestStreak:0},
      spelling: {played:0,correct:0,bestStreak:0},
      pronounce: {played:0,correct:0,bestStreak:0},
      mixed_vocab: {played:0,correct:0,bestStreak:0},
    },
    lastExam: null,
  };
  window.persist();
  return id;
}

export function deleteDeck(deckId) {
  const SD = window.SD;
  delete SD.decks[deckId];
  if (SD.activeDeckId === deckId) {
    const rest = Object.keys(SD.decks);
    SD.activeDeckId = rest.length > 0 ? rest[0] : null;
    syncMirrorFromActiveDeck();
  }
  window.persist();
  return true;
}

export function renameDeck(deckId, newName) {
  const SD = window.SD;
  if (!SD.decks[deckId] || !newName) return;
  SD.decks[deckId].name = newName;
  window.persist();
}

// ────────────────────────────────────────────────
//  DECK RENDERING
// ────────────────────────────────────────────────
export function deckProgress(deck) {
  function pf(suffix) {
    let score = 0, mastered = 0;
    deck.vocab.forEach(v => {
      const s = deck.wordStats[v.de + suffix];
      if (!s || !s.asked) return;
      const asked = s.asked, pct = effectivePct(s);
      if (Math.floor(asked) >= 3 && pct >= 0.9) { score += 1; mastered += 1; }
      else if (asked >= 1) {
        const conf = Math.min(asked / 3, 1);
        score += Math.max(0, (pct - 0.5) * 2) * conf * 0.85;
      }
    });
    return {score, mastered, total: deck.vocab.length};
  }
  const a = pf('_mc'), b = pf('_sp'), c = pf('_pr');
  const totalScore = (a.score + b.score + c.score) / 3;
  const totalMastered = Math.min(a.mastered, b.mastered, c.mastered);
  return {
    overallPct: deck.vocab.length > 0 ? Math.min(100, Math.round((totalScore / deck.vocab.length) * 100)) : 0,
    overallMastered: totalMastered,
    total: deck.vocab.length,
    perMode: {vocab: a, spelling: b, pronounce: c}
  };
}

function renderModeSubBy(p) {
  const total = p.total || 0;
  const pct = total > 0 ? Math.min(100, Math.round((p.score / total) * 100)) : 0;
  return '<span class="btn-progress-text">' + pct + '% · ' + p.mastered + '/' + total + ' fertig</span>' +
         '<span class="btn-progress"><span class="btn-progress-fill" style="width:' + pct + '%"></span></span>';
}

export function renderDecks() {
  const c = document.getElementById('decks-container');
  if (!c) return;
  const SD = window.SD;
  const ids = Object.keys(SD.decks);
  c.innerHTML = '';
  ids.forEach(id => {
    const deck = SD.decks[id];
    const p = deckProgress(deck);
    const isActive = id === SD.activeDeckId;
    const isExpanded = id === _expandedDeckId;
    const dt = new Date(deck.createdAt);
    const dateStr = dt.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'});
    const card = document.createElement('div');
    card.className = 'deck-card' + (isActive ? ' active' : '') + (isExpanded ? ' expanded' : '') + (!isActive ? ' inactive' : '');
    card.innerHTML = `
      <div class="deck-header" onclick="activateDeck('${id}')">
        <div class="deck-icon">${isActive ? '📖' : '📕'}</div>
        <div class="deck-info">
          <div class="deck-name">${window.escHtml(deck.name)}</div>
          <div class="deck-meta">
            <span>📅 ${dateStr}</span>
            <span>📝 ${deck.vocab.length} Wörter</span>
            ${isActive ? '<span style="color:var(--purple);font-weight:800">● aktiv</span>' : '<span style="color:#bbb">○ inaktiv</span>'}
          </div>
          <div class="deck-progress-mini"><div class="deck-progress-mini-fill" style="width:${p.overallPct}%"></div></div>
        </div>
        <div class="deck-pct">${p.overallPct}%</div>
        <div class="deck-chevron" onclick="event.stopPropagation();toggleDeck('${id}')" style="cursor:pointer;padding:8px;">▼</div>
      </div>
      <div class="deck-body">
        ${isActive ? `<div class="deck-active-badge">⭐ Aktive Sammlung – Statistik bezieht sich auf diese</div>` : ''}
        <div class="mode-buttons">
          <button class="big-btn blue" onclick="startGameWithDeck('${id}','vocab')">
            <span class="icon-btn">🔤</span>
            <div><span>Vokabeln</span><span class="btn-sub">${renderModeSubBy(p.perMode.vocab)}</span></div>
          </button>
          <button class="big-btn purple" onclick="startGameWithDeck('${id}','spelling')">
            <span class="icon-btn">✏️</span>
            <div><span>Rechtschreibung</span><span class="btn-sub">${renderModeSubBy(p.perMode.spelling)}</span></div>
          </button>
          <button class="big-btn pink" onclick="startGameWithDeck('${id}','pronounce')">
            <span class="icon-btn">🎙️</span>
            <div><span>Aussprache</span><span class="btn-sub">${renderModeSubBy(p.perMode.pronounce)}</span></div>
          </button>
          <button class="big-btn green" onclick="startGameWithDeck('${id}','mixed_vocab')">
            <span class="icon-btn">🎲</span>
            <div><span>Alle gemischt</span><span class="btn-sub">${deck.lastExam ? '📊 Note ' + deck.lastExam.grade + ' · ' + new Date(deck.lastExam.date).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '📊 Noch keine Prüfung'}</span></div>
          </button>
          <button class="big-btn teal" onclick="openVocabManager('${id}')">
            <span class="icon-btn">📷</span>
            <div><span>Vokabeln verwalten</span><span class="btn-sub">Hinzufügen, scannen, löschen</span></div>
          </button>
        </div>
        <div class="deck-actions">
          <button class="deck-action-btn" onclick="renameDeckPrompt('${id}')">✏️ Umbenennen</button>
          <button class="deck-action-btn danger" onclick="confirmDeleteDeck('${id}')">🗑️ Löschen</button>
        </div>
      </div>
    `;
    c.appendChild(card);
  });
}

// ────────────────────────────────────────────────
//  DECK UI ACTIONS
// ────────────────────────────────────────────────
export function toggleDeck(id) {
  _expandedDeckId = (_expandedDeckId === id) ? null : id;
  renderDecks();
}

export function activateDeck(id) {
  const SD = window.SD;
  if (SD.activeDeckId !== id) {
    SD.activeDeckId = id;
    syncMirrorFromActiveDeck();
    window.persist();
  }
  renderDecks();
}

export function startGameWithDeck(deckId, modeName) {
  switchDeck(deckId);
  window.startGame(modeName);
}

export function newDeckPrompt() {
  const name = prompt('Name der neuen Vokabelsammlung:', '');
  if (!name || !name.trim()) return;
  const id = createDeck(name.trim());
  _expandedDeckId = id;
  switchDeck(id);
  renderDecks();
}

export function renameDeckPrompt(id) {
  const cur = window.SD.decks[id];
  if (!cur) return;
  const name = prompt('Neuer Name:', cur.name);
  if (!name || !name.trim()) return;
  renameDeck(id, name.trim());
  renderDecks();
}

export function confirmDeleteDeck(id) {
  const cur = window.SD.decks[id];
  if (!cur) return;
  if (!confirm(`Vokabelsammlung "${cur.name}" wirklich löschen?\n\nAlle ${cur.vocab.length} Vokabeln und der Fortschritt gehen verloren.`)) return;
  deleteDeck(id);
  if (_expandedDeckId === id) _expandedDeckId = null;
  renderDecks();
}

// ────────────────────────────────────────────────
//  VOCAB MANAGEMENT
// ────────────────────────────────────────────────
export function vmDeleteWord(idx) {
  const deck = activeDeck();
  const v = deck.vocab[idx];
  if (!v) return;
  if (!confirm('"' + v.de + ' → ' + v.en + '" wirklich löschen?')) return;
  deck.vocab.splice(idx, 1);
  ['_mc', '_sp', '_pr'].forEach(suf => { delete deck.wordStats[v.de + suf]; });
  syncMirrorFromActiveDeck();
  window.persist();
  window.renderVocabList();
}

export function vmAddManual() {
  const de = (document.getElementById('vm-add-de')?.value || '').trim();
  const en = (document.getElementById('vm-add-en')?.value || '').trim();
  if (!de || !en) { alert('Bitte Deutsch UND Englisch eingeben.'); return; }
  const deck = activeDeck();
  if (deck.vocab.some(v => v.en.toLowerCase() === en.toLowerCase())) {
    alert('"' + en + '" ist bereits in der Sammlung.');
    return;
  }
  deck.vocab.push({de, en});
  syncMirrorFromActiveDeck();
  window.persist();
  document.getElementById('vm-add-de').value = '';
  document.getElementById('vm-add-en').value = '';
  document.getElementById('vm-add-de').focus();
  const btn = event.target;
  const orig = btn.textContent;
  btn.textContent = '✅ Hinzugefügt: ' + de + ' → ' + en;
  setTimeout(() => { btn.textContent = orig; }, 1400);
}
