// src/modules/ui.js
import { persist } from './storage.js';
import { effectivePct } from './stats.js';
import { syncMirrorFromActiveDeck, activeDeck, deckProgress, renderDecks } from './decks.js';
import { releaseMicStream, stopVisualizer, speakWord } from './speech.js';

const API_KEY_SK = 'es_apikey';

// ────────────────────────────────────────────────
//  SCREEN ROUTING
// ────────────────────────────────────────────────
export function showScreen(id) {
  ['loading-screen','apikey-screen','name-screen','menu-screen','game-screen','end-screen','stats-screen','profile-screen','scan-screen','review-screen'].forEach(s => {
    const el = document.getElementById(s); if (el) el.style.display = 'none';
  });
  const el = document.getElementById(id);
  el.style.display = ['loading-screen','menu-screen','game-screen','stats-screen','profile-screen','scan-screen','review-screen'].includes(id) ? 'flex' : 'block';
  if (id === 'game-screen') document.body.classList.add('in-game');
  else document.body.classList.remove('in-game');
  const ft = document.getElementById('menu-footer');
  if (ft) ft.style.display = (id === 'menu-screen') ? 'flex' : 'none';
}

// ────────────────────────────────────────────────
//  NAME SCREEN
// ────────────────────────────────────────────────
export function saveName() {
  const v = document.getElementById('name-input').value.trim();
  if (!v) { document.getElementById('name-input').style.borderColor = 'var(--red)'; return; }
  window.SD.playerName = v;
  persist(window.SD);
  showMenu();
}

// ────────────────────────────────────────────────
//  API KEY SCREEN
// ────────────────────────────────────────────────
export function saveApiKey() {
  const v = document.getElementById('apikey-input').value.trim();
  if (!v.startsWith('AIza') && v.length < 20) {
    document.getElementById('apikey-input').style.borderColor = 'var(--red)';
    return;
  }
  try { localStorage.setItem(API_KEY_SK, v); } catch (e) {}
  if (!window.SD.playerName) showScreen('name-screen');
  else showMenu();
}

export function skipApiKey() {
  if (!window.SD.playerName) showScreen('name-screen');
  else showMenu();
}

// ────────────────────────────────────────────────
//  MENU
// ────────────────────────────────────────────────
export function showMenu() {
  try { releaseMicStream(); } catch (e) {}
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  hideFeedback();
  showScreen('menu-screen');
  document.getElementById('menu-player-name').textContent = 'Hallo, ' + window.SD.playerName + '! 👋';
  document.getElementById('menu-highscore').textContent = window.SD.highscore;
  document.getElementById('menu-total').textContent = window.SD.totalPoints;
  const ft = document.getElementById('menu-footer'); if (ft) ft.style.display = 'flex';
  renderDecks();
}

// ────────────────────────────────────────────────
//  PROFILE SCREEN
// ────────────────────────────────────────────────
export function showProfile() {
  showScreen('profile-screen');
  const SD = window.SD;
  const pn = document.getElementById('prof-name');
  if (pn) pn.textContent = SD.playerName || 'Spieler';
  const ps = document.getElementById('prof-since');
  if (ps) {
    const firstDeck = Object.values(SD.decks || {})[0];
    if (firstDeck && firstDeck.createdAt) {
      const d = new Date(firstDeck.createdAt);
      ps.textContent = '📅 Dabei seit ' + d.toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'});
    } else ps.textContent = '';
  }
  const ph = document.getElementById('prof-hs'); if (ph) ph.textContent = SD.highscore || 0;
  const pp = document.getElementById('prof-pts'); if (pp) pp.textContent = SD.totalPoints || 0;
  const deckIds = Object.keys(SD.decks || {});
  const pd = document.getElementById('prof-decks'); if (pd) pd.textContent = deckIds.length;
  let totalMastered = 0;
  deckIds.forEach(id => {
    const p = deckProgress(SD.decks[id]);
    totalMastered += p.overallMastered || 0;
  });
  const pm = document.getElementById('prof-mastered'); if (pm) pm.textContent = totalMastered;
  const pdl = document.getElementById('prof-decks-list');
  if (pdl) {
    if (deckIds.length === 0) {
      pdl.innerHTML = '<div style="font-size:.85rem;color:#999;text-align:center;padding:10px;">Keine Sammlungen vorhanden.</div>';
    } else {
      pdl.innerHTML = deckIds.map(id => {
        const d = SD.decks[id];
        const p = deckProgress(d);
        const isActive = id === SD.activeDeckId;
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:${isActive?'rgba(168,108,219,.08)':'#f7f7f7'};border-radius:12px;">
          <span style="font-size:1.4rem;">${isActive ? '📖' : '📕'}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-family:'Fredoka One',cursive;font-size:.95rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${window.escHtml(d.name)}</div>
            <div style="font-size:.7rem;color:#888;font-weight:700;">${d.vocab.length} Wörter${isActive ? ' · aktiv' : ''}</div>
          </div>
          <div style="font-family:'Fredoka One',cursive;font-size:1.15rem;background:linear-gradient(135deg,var(--purple),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${p.overallPct}%</div>
        </div>`;
      }).join('');
    }
  }
}

export function editPlayerName() {
  const cur = window.SD.playerName || '';
  const nn = prompt('Dein Name:', cur);
  if (nn === null) return;
  const trimmed = nn.trim();
  if (!trimmed) return;
  window.SD.playerName = trimmed;
  persist(window.SD);
  const profEl = document.getElementById('profile-screen');
  if (profEl && profEl.style.display !== 'none') showProfile();
  else showStats();
}

// ────────────────────────────────────────────────
//  STATS SCREEN
// ────────────────────────────────────────────────
function wordStatus(stat, minAsked) {
  if (!stat || !stat.asked) return {cls:'ws-gray', label:'–', pct:0};
  const asked = stat.asked, correct = stat.correct || 0;
  const pct = effectivePct(stat);
  const display = Math.round(pct * 100);
  const flooredAsked = Math.floor(asked);
  if (flooredAsked < minAsked) {
    const dots = '·'.repeat(flooredAsked) + '<span style="opacity:.3">·</span>'.repeat(Math.max(0, minAsked - flooredAsked));
    const smoothed = (correct + 1) / (asked + 2);
    let cls = 'ws-gray';
    if (smoothed >= 0.85) cls = 'ws-green';
    else if (smoothed >= 0.4) cls = 'ws-yellow';
    else if (asked >= 1) cls = 'ws-red';
    return {cls, label:dots, pct, provisional:true};
  }
  if (pct >= 0.9) return {cls:'ws-green', label:'✓ ' + display + '%', pct};
  if (pct >= 0.3) return {cls:'ws-yellow', label:'~ ' + display + '%', pct};
  return {cls:'ws-red', label:'✗ ' + display + '%', pct};
}

function wrongDots(stat) {
  if (!stat || !stat.asked) return '<span style="color:#bbb;font-size:.75rem">–</span>';
  const a = Math.floor(stat.asked || 0);
  const c = Math.floor(stat.correct || 0);
  const w = Math.floor(stat.wrong || 0);
  return '<span style="font-size:.75rem;color:#666;font-weight:700;white-space:nowrap;">' +
    '<span style="color:#3a9b45">●</span>' + c +
    ' <span style="color:#c0001a">●</span>' + w +
    '</span>';
}

export function showStats() {
  showScreen('stats-screen');
  const SD = window.SD;
  const VOCAB = window.VOCAB;
  const pn = document.getElementById('profile-name');
  const pm = document.getElementById('profile-meta');
  const pds = document.getElementById('profile-decks-summary');
  if (pn) pn.textContent = SD.playerName || 'Spieler';
  if (pm) pm.textContent = '🏆 Highscore: ' + SD.highscore + ' · ⭐ ' + SD.totalPoints + ' Pkt gesamt';
  if (pds) {
    const deckIds = Object.keys(SD.decks || {});
    if (deckIds.length === 0) {
      pds.innerHTML = '<div style="font-size:.78rem;color:#999;text-align:center;padding:8px;">Keine Vokabelsammlungen vorhanden.</div>';
    } else {
      pds.innerHTML = deckIds.map(id => {
        const d = SD.decks[id];
        const p = deckProgress(d);
        const isActive = id === SD.activeDeckId;
        return `<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:${isActive?'rgba(168,108,219,.08)':'#f7f7f7'};border-radius:10px;font-size:.82rem;">
          <span>${isActive ? '📖' : '📕'}</span>
          <span style="flex:1;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${window.escHtml(d.name)}</span>
          <span style="font-size:.7rem;color:#888;">${d.vocab.length} W.</span>
          <span style="font-family:'Fredoka One',cursive;color:var(--purple);">${p.overallPct}%</span>
        </div>`;
      }).join('');
    }
  }
  const dl = document.getElementById('stats-deck-label');
  if (dl) dl.textContent = SD.activeDeckId ? ('Aktive Sammlung: ' + activeDeck().name + ' · ' + activeDeck().vocab.length + ' Vokabeln') : 'Keine aktive Sammlung';

  const vocabMastered    = VOCAB.filter(v => { const s = SD.wordStats[v.de+'_mc']; return s && Math.floor(s.asked||0) >= 3 && s.correct/s.asked >= 0.9; }).length;
  const spellMastered    = VOCAB.filter(v => { const s = SD.wordStats[v.de+'_sp']; return s && Math.floor(s.asked||0) >= 3 && s.correct/s.asked >= 0.9; }).length;
  const pronounceMastered = VOCAB.filter(v => { const s = SD.wordStats[v.de+'_pr']; return s && Math.floor(s.asked||0) >= 3 && s.correct/s.asked >= 0.9; }).length;

  const catData = [
    {label:'🔤 Vokabeln',    color:'var(--blue)',   done:vocabMastered,     total:VOCAB.length, cat:'vocab'},
    {label:'✏️ Schreiben',   color:'var(--purple)', done:spellMastered,     total:VOCAB.length, cat:'spelling'},
    {label:'🎙️ Aussprache', color:'var(--pink)',    done:pronounceMastered, total:VOCAB.length, cat:'pronounce'},
    {label:'🎲 Mix',         color:'var(--green)',  done:Math.min(vocabMastered,spellMastered,pronounceMastered), total:VOCAB.length, cat:'mixed_vocab'},
  ];
  const grid = document.getElementById('stats-cat-grid');
  grid.innerHTML = catData.map(c => {
    const pct = c.total ? Math.round(c.done / c.total * 100) : 0;
    const p = SD.categoryProgress[c.cat] || {};
    let subLine;
    if (c.cat === 'mixed_vocab') {
      const deck = activeDeck();
      const ex = deck && deck.lastExam;
      subLine = ex ? ('📊 Note ' + ex.grade + ' · ' + new Date(ex.date).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})) : '📊 Noch keine Prüfung';
    } else {
      subLine = c.done + '/' + c.total + ' gelernt · 🔥' + (p.bestStreak||0);
    }
    return `<div class="cat-card">
      <div class="cat-card-title" style="color:${c.color}">${c.label}</div>
      <div class="mini-bar-wrap"><div class="mini-bar" style="width:${pct}%;background:${c.color}"></div></div>
      <div class="cat-stat-small">${subLine}</div>
    </div>`;
  }).join('');

  const vt = document.getElementById('stats-vocab-table').querySelector('tbody');
  vt.innerHTML = VOCAB.map(v => {
    const s = SD.wordStats[v.de+'_mc'];
    const st = wordStatus(s, 3);
    return `<tr><td>${v.de}</td><td>${v.en}</td><td><span class="ws-badge ${st.cls}">${st.label}</span></td><td>${wrongDots(s)}</td></tr>`;
  }).join('');

  const st2 = document.getElementById('stats-spelling-table').querySelector('tbody');
  st2.innerHTML = VOCAB.map(v => {
    const s = SD.wordStats[v.de+'_sp'];
    const st = wordStatus(s, 3);
    return `<tr><td>${v.de}</td><td>${v.en}</td><td><span class="ws-badge ${st.cls}">${st.label}</span></td><td>${wrongDots(s)}</td></tr>`;
  }).join('');

  const pt = document.getElementById('stats-pronounce-table').querySelector('tbody');
  pt.innerHTML = VOCAB.map(v => {
    const s = SD.wordStats[v.de+'_pr'];
    const st = wordStatus(s, 3);
    return `<tr><td>${v.de}</td><td>${v.en}</td><td><span class="ws-badge ${st.cls}">${st.label}</span></td><td>${wrongDots(s)}</td></tr>`;
  }).join('');
}

// ────────────────────────────────────────────────
//  RESET
// ────────────────────────────────────────────────
export function confirmReset() {
  if (confirm('⚠️ Bist du dir wirklich sicher?\n\nALL dein Fortschritt wird gelöscht!')) {
    const name = window.SD.playerName;
    window.SD = window.freshData();
    window.SD.playerName = name;
    syncMirrorFromActiveDeck();
    persist(window.SD);
    showMenu();
    setTimeout(() => alert('✅ Fortschritt zurückgesetzt!'), 100);
  }
}

// ────────────────────────────────────────────────
//  FEEDBACK OVERLAY
// ────────────────────────────────────────────────
export function showFeedback(ok, text, sub) {
  const fb = document.getElementById('feedback');
  fb.className = 'feedback show ' + (ok ? 'success' : 'error');
  document.getElementById('fb-text').textContent = text;
  document.getElementById('fb-sub').textContent = sub;
  let speakEl = document.getElementById('fb-speak');
  if (!ok && window.currentQ && window.currentQ.type === 'pronounce') {
    if (!speakEl) {
      speakEl = document.createElement('button');
      speakEl.id = 'fb-speak';
      speakEl.className = 'speak-btn';
      speakEl.style.marginTop = '6px';
      speakEl.textContent = '🔊 Richtige Aussprache anhören';
      const left = document.querySelector('.feedback-left');
      if (left) left.appendChild(speakEl);
    }
    speakEl.onclick = () => speakWord(window.currentQ.answer);
    speakEl.style.display = 'inline-flex';
  } else if (speakEl) {
    speakEl.style.display = 'none';
  }
  stopVisualizer();
}

export function hideFeedback() {
  document.getElementById('feedback').className = 'feedback';
}

export function exportData() {
  const json = JSON.stringify(window.SD, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'english_stars_fortschritt.json';
  a.click();
}

export function importData(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      window.SD = window.migrateData(parsed);
      window.syncMirrorFromActiveDeck();
      window.persist();
      showMenu();
      setTimeout(() => alert('✅ Fortschritt importiert!'), 100);
    } catch(ex) { alert('❌ Fehler beim Importieren!'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}
