// src/modules/decks.js
import { effectivePct, statKeyFor, presetWordsPct } from './stats.js';
import { markDirty, flushPendingSync, deleteCloudDeck, deleteCloudWordStats, saveDeck } from './sync.js';

// ────────────────────────────────────────────────
//  UI STATE
// ────────────────────────────────────────────────
let _expandedDeckId = null;
let _dragState = null;

// ────────────────────────────────────────────────
//  CORE DECK OPERATIONS
// ────────────────────────────────────────────────
export function activeDeck() {
  const SD = window.SD;
  return SD.activeDeckId ? SD.decks[SD.activeDeckId] : null;
}

// Synchronisiert die Compatibility-Spiegel (SD.wordStats etc.) mit dem aktiven Deck
export function syncMirrorFromActiveDeck(sd) {
  if (window._draftDeck) return;
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
  const maxSort = Math.max(0, ...Object.values(window.SD.decks).map(d => d.sortOrder || 0));
  window.SD.decks[id] = {
    id, name: name || 'Neue Vokabelsammlung', createdAt: Date.now(),
    vocab: [], wordStats: {},
    categoryProgress: {
      vocab: {played:0,correct:0,bestStreak:0},
      spelling: {played:0,correct:0,bestStreak:0},
      pronounce: {played:0,correct:0,bestStreak:0},
      mixed_vocab: {played:0,correct:0,bestStreak:0},
    },
    presetCategories: [],
    presetsLocked: false,
    deckPath: 'none',
    sortOrder: maxSort + 10,
    lastExam: null,
  };
  window.persist();
  if (window.currentUser) { markDirty('deck', id); flushPendingSync().catch(() => {}); }
  return id;
}

export function deleteDeck(deckId) {
  const SD = window.SD;
  if (window.currentUser) deleteCloudDeck(deckId, window.currentUser.id).catch(() => {});
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
  if (window.currentUser) {
    console.log('[decks] renameDeck', deckId, '→', newName, '| cloud-sync queued');
    markDirty('deck', deckId);
    flushPendingSync().catch(() => {});
  }
}

// ────────────────────────────────────────────────
//  DECK RENDERING
// ────────────────────────────────────────────────
export function deckProgress(deck) {
  function pf(suffix) {
    let score = 0, mastered = 0;
    deck.vocab.forEach(v => {
      const key = statKeyFor(v.de, v.en, suffix);
      const s = v._presetId
        ? window.SD?.globalPresetStats?.wordStats?.[key]
        : deck.wordStats[key];
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
  let overallPct;
  if (deck.deckPath === 'preset' && deck.vocab.length > 0) {
    const ws = window.SD?.globalPresetStats?.wordStats || {};
    overallPct = presetWordsPct(deck.vocab, ws);
  } else {
    overallPct = deck.vocab.length > 0 ? Math.min(100, Math.round((totalScore / deck.vocab.length) * 100)) : 0;
  }
  return {
    overallPct,
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
  _ensureDocListeners();
  const c = document.getElementById('decks-container');
  if (!c) return;
  const SD = window.SD;
  c.innerHTML = '';

  // «+ Neue Sammlung» — immer erstes Element, nicht verschiebbar
  const newBtn = document.createElement('button');
  newBtn.className = 'big-btn purple center';
  newBtn.style.cssText = 'margin-bottom:14px;font-size:.95rem;';
  newBtn.innerHTML = '<span class="icon-btn">➕</span><span>Neue Vokabelsammlung anlegen</span>';
  newBtn.addEventListener('click', () => window.newDeckFlow());
  c.appendChild(newBtn);

  _getSortedDeckIds().forEach(id => {
    const deck = SD.decks[id];
    const p = deckProgress(deck);
    const isActive = id === SD.activeDeckId;
    const isExpanded = id === _expandedDeckId;
    const dt = new Date(deck.createdAt);
    const dateStr = dt.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'});
    const card = document.createElement('div');
    card.className = 'deck-card' + (isActive ? ' active' : '') + (isExpanded ? ' expanded' : '') + (!isActive ? ' inactive' : '');
    card.dataset.deckId = id;
    card.innerHTML = `
      <div class="deck-header">
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
        <div class="deck-chevron">▼</div>
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
          ${window.SD?.activeMode !== 'free' ? `<button class="big-btn green" onclick="startGameWithDeck('${id}','mixed_vocab')">
            <span class="icon-btn">🎲</span>
            <div><span>Alle gemischt</span><span class="btn-sub">${deck.lastExam ? '📊 Note ' + deck.lastExam.grade + ' · ' + new Date(deck.lastExam.date).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '📊 Noch keine Prüfung'}</span></div>
          </button>` : ''}
          <button class="big-btn teal" onclick="openVocabManager('${id}')">
            <span class="icon-btn">📷</span>
            <div><span>Vokabeln verwalten</span><span class="btn-sub">Hinzufügen, scannen, löschen</span></div>
          </button>
        </div>
        <div class="deck-actions">
          <button class="deck-action-btn" onclick="renameDeckPrompt('${id}')">✏️ Umbenennen</button>
          <button class="deck-action-btn" onclick="resetDeckProgress('${id}')">🔄 Zurücksetzen</button>
          <button class="deck-action-btn danger" onclick="confirmDeleteDeck('${id}')">🗑️ Löschen</button>
        </div>
      </div>
    `;
    _attachCardListeners(card, id);
    c.appendChild(card);
  });
}

// ────────────────────────────────────────────────
//  DECK INTERACTION (Tap + Long-Press Drag)
// ────────────────────────────────────────────────
let _docListenersInit = false;
function _ensureDocListeners() {
  if (_docListenersInit) return;
  _docListenersInit = true;
  document.addEventListener('touchmove', e => {
    if (!_dragState) return;
    _moveDrag(e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { if (_dragState) _endDrag(); });
  document.addEventListener('mousemove', e => { if (_dragState) _moveDrag(e.clientY); });
  document.addEventListener('mouseup', () => { if (_dragState) _endDrag(); });
}

function _getSortedDeckIds() {
  const SD = window.SD;
  return Object.keys(SD.decks).sort((a, b) => {
    const da = SD.decks[a], db = SD.decks[b];
    const sa = da.sortOrder != null ? da.sortOrder : (da.createdAt || 0);
    const sb = db.sortOrder != null ? db.sortOrder : (db.createdAt || 0);
    return sa - sb;
  });
}

function _handleTap(deckId) {
  const SD = window.SD;
  if (SD.activeDeckId !== deckId) {
    SD.activeDeckId = deckId;
    _expandedDeckId = null;
    syncMirrorFromActiveDeck();
    window.persist();
  } else {
    _expandedDeckId = (_expandedDeckId === deckId) ? null : deckId;
  }
  renderDecks();
}

function _attachCardListeners(cardEl, deckId) {
  const header = cardEl.querySelector('.deck-header');
  if (!header) return;
  let longPressTimer = null, startY = 0, startX = 0, tapBlocked = false;

  function onStart(e) {
    const pt = e.touches ? e.touches[0] : e;
    startY = pt.clientY; startX = pt.clientX; tapBlocked = false;
    longPressTimer = setTimeout(() => {
      longPressTimer = null; tapBlocked = true;
      _initDrag(cardEl, deckId, startY);
    }, 450);
  }
  function onMove(e) {
    if (_dragState) return;
    const pt = e.touches ? e.touches[0] : e;
    if (Math.abs(pt.clientY - startY) > 12 || Math.abs(pt.clientX - startX) > 12) {
      clearTimeout(longPressTimer); longPressTimer = null; tapBlocked = true;
    }
  }
  function onEnd() {
    clearTimeout(longPressTimer); longPressTimer = null;
    if (!tapBlocked) _handleTap(deckId);
  }

  header.addEventListener('touchstart', onStart, { passive: true });
  header.addEventListener('touchmove', onMove, { passive: true });
  // preventDefault verhindert synthetische mousedown/mouseup-Events nach Touch
  header.addEventListener('touchend', e => { e.preventDefault(); onEnd(); }, { passive: false });
  header.addEventListener('mousedown', e => { if (e.button === 0) onStart(e); });
  header.addEventListener('mousemove', onMove);
  header.addEventListener('mouseup', e => { if (e.button === 0) onEnd(); });
}

function _initDrag(cardEl, deckId, clientY) {
  // Finger-Offset VOR DOM-Änderungen berechnen — sonst verschiebt sich der Offset
  // wenn eine aufgeklappte Karte oberhalb beim Collapse die Position ändert.
  const preTop = cardEl.getBoundingClientRect().top;
  const offsetY = clientY - preTop;

  if (_expandedDeckId) {
    _expandedDeckId = null;
    document.querySelectorAll('.deck-card.expanded').forEach(el => el.classList.remove('expanded'));
  }
  // Post-Collapse-Rect für Breite/Links (Höhe kann sich geändert haben)
  const rect = cardEl.getBoundingClientRect();
  const ph = document.createElement('div');
  ph.style.cssText = `height:${rect.height}px;margin-bottom:10px;border-radius:18px;border:2px dashed var(--purple,#9b4dca);background:rgba(155,77,202,.06);box-sizing:border-box;`;
  cardEl.after(ph);
  Object.assign(cardEl.style, {
    position: 'fixed', top: preTop + 'px', left: rect.left + 'px',
    width: rect.width + 'px', zIndex: '1000', margin: '0',
    boxShadow: '0 16px 48px rgba(0,0,0,.25)',
    transform: 'scale(1.02)', transition: 'none', pointerEvents: 'none',
  });
  _dragState = { deckId, el: cardEl, ph, offsetY };
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
}

function _moveDrag(clientY) {
  if (!_dragState) return;
  const { el, ph, offsetY } = _dragState;
  el.style.top = (clientY - offsetY) + 'px';
  const container = document.getElementById('decks-container');
  const cards = [...container.querySelectorAll('.deck-card')].filter(c => c !== el);
  let insertBefore = null;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) { insertBefore = c; break; }
  }
  if (insertBefore) container.insertBefore(ph, insertBefore);
  else if (cards.length) cards[cards.length - 1].after(ph);
  else container.appendChild(ph);
}

function _endDrag() {
  if (!_dragState) return;
  const { el, ph } = _dragState;
  ph.before(el);
  ph.remove();
  el.removeAttribute('style');
  const container = document.getElementById('decks-container');
  const newOrder = [...container.querySelectorAll('.deck-card')].map(c => c.dataset.deckId).filter(Boolean);
  newOrder.forEach((id, i) => { if (window.SD.decks[id]) window.SD.decks[id].sortOrder = (i + 1) * 10; });
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
  _dragState = null;
  window.persist();
  if (window.currentUser) { newOrder.forEach(id => markDirty('deck', id)); flushPendingSync().catch(() => {}); }
  renderDecks();
}

// ────────────────────────────────────────────────
//  DECK UI ACTIONS
// ────────────────────────────────────────────────
export function toggleDeck(id) {
  _expandedDeckId = (_expandedDeckId === id) ? null : id;
  renderDecks();
}

export function activateDeck(id) {
  _handleTap(id);
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

export function resetDeckProgress(id) {
  const deck = window.SD.decks[id];
  if (!deck) return;
  if (!confirm(`Fortschritt von "${deck.name}" wirklich zurücksetzen?\n\nDie Wörter bleiben erhalten.`)) return;
  deck.wordStats = {};
  deck.categoryProgress = {
    vocab:       { played: 0, correct: 0, bestStreak: 0 },
    spelling:    { played: 0, correct: 0, bestStreak: 0 },
    pronounce:   { played: 0, correct: 0, bestStreak: 0 },
    mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
  };
  deck.lastExam = null;
  syncMirrorFromActiveDeck();
  window.persist();
  if (window.currentUser) {
    const userId = window.currentUser.id;
    console.log('[decks] resetDeckProgress', id, '| cloud-sync');
    deleteCloudWordStats(id, userId).catch(e => console.error('[resetDeckProgress] deleteWordStats:', e));
    saveDeck(deck, userId).catch(e => console.error('[resetDeckProgress] saveDeck:', e));
  }
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
  const deck = window._draftDeck || activeDeck();
  const v = deck.vocab[idx];
  if (!v) return;
  if (!confirm('"' + v.de + ' → ' + v.en + '" wirklich löschen?')) return;
  deck.vocab.splice(idx, 1);
  if (!window._draftDeck) {
    syncMirrorFromActiveDeck();
    window.persist();
    if (window.currentUser) {
      markDirty('deck', deck.id);
      markDirty('word_stats', deck.id);
      flushPendingSync().catch(() => {});
    }
  }
  window.renderVocabList();
}

// Migration beim Login: wandelt alte statKeys (de+suffix) in das neue
// Format (normDE|normEN+suffix) um. Gibt true zurück wenn etwas geändert wurde.
// Pass 1: aktuelle Vokabeln — kennt DE+EN, kann präzise konvertieren.
// Pass 2: verwaiste Altformat-Keys (z.B. nach Cloud-Reload) — DE-only-Matching
//   sofern eindeutig (genau ein Vokabel-Eintrag mit gleichem normDE), sonst überspringen.
export function migrateStatKeys(sd) {
  sd = sd || window.SD;
  let changed = false;
  const SUFFIXES = ['_mc', '_sp', '_pr'];

  for (const deck of Object.values(sd.decks || {})) {
    const stats = deck.wordStats;
    if (!stats) continue;
    const vocab = deck.vocab || [];

    // Pass 1: für jeden aktuellen Vokabel-Eintrag den alten Key migrieren
    for (const v of vocab) {
      for (const suf of SUFFIXES) {
        const oldKey = v.de + suf;
        const newKey = statKeyFor(v.de, v.en, suf);
        if (stats[oldKey] && !stats[newKey]) {
          stats[newKey] = stats[oldKey];
          delete stats[oldKey];
          changed = true;
        } else if (stats[oldKey] && stats[newKey]) {
          // Neuer Key existiert bereits (nach Cloud-Reload) — alten Orphan entfernen
          delete stats[oldKey];
          changed = true;
        }
      }
    }

    // Pass 2: verwaiste Altformat-Keys (kein '|') per eindeutigem DE-Match konvertieren.
    // Notwendig wenn z.B. nach Logout/Login der Cloud-State alte Keys zurückbringt,
    // die nicht mehr durch Pass 1 aufgelöst werden (Wort zwischenzeitlich gelöscht).
    const normDEToVocab = {};
    for (const v of vocab) {
      const nd = (v.de || '').trim().toLowerCase();
      if (!normDEToVocab[nd]) normDEToVocab[nd] = [];
      normDEToVocab[nd].push(v);
    }
    for (const key of Object.keys(stats)) {
      if (key.includes('|')) continue; // bereits neues Format
      for (const suf of SUFFIXES) {
        if (!key.endsWith(suf)) continue;
        const de = key.slice(0, -suf.length);
        const nd = de.trim().toLowerCase();
        const matches = normDEToVocab[nd] || [];
        if (matches.length === 1) {
          const newKey = statKeyFor(matches[0].de, matches[0].en, suf);
          if (!stats[newKey]) {
            stats[newKey] = stats[key];
            delete stats[key];
            changed = true;
          } else {
            delete stats[key]; // neuer Key existiert schon → Orphan entfernen
            changed = true;
          }
        }
        break;
      }
    }
  }
  return changed;
}

export function vmAddManual() {
  const de = (document.getElementById('vm-add-de')?.value || '').trim();
  const en = (document.getElementById('vm-add-en')?.value || '').trim();
  if (!de || !en) { alert('Bitte Deutsch UND Englisch eingeben.'); return; }
  const deck = window._draftDeck || activeDeck();
  if (deck.vocab.some(v => v.en.toLowerCase() === en.toLowerCase())) {
    alert('"' + en + '" ist bereits in der Sammlung.');
    return;
  }
  deck.vocab.push({de, en});
  if (!window._draftDeck) {
    syncMirrorFromActiveDeck();
    window.persist();
    if (window.currentUser) { markDirty('deck', deck.id); flushPendingSync().catch(() => {}); }
  }
  document.getElementById('vm-add-de').value = '';
  document.getElementById('vm-add-en').value = '';
  document.getElementById('vm-add-de').focus();
  const btn = event.target;
  const orig = btn.textContent;
  btn.textContent = '✅ Hinzugefügt: ' + de + ' → ' + en;
  setTimeout(() => { btn.textContent = orig; }, 1400);
}
