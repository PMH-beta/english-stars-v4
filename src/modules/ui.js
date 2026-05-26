// src/modules/ui.js
import { persist, freshData, clearStorage } from './storage.js';
import { effectivePct, statKeyFor } from './stats.js';
import { syncMirrorFromActiveDeck, activeDeck, deckProgress, renderDecks, migrateStatKeys } from './decks.js';
import { releaseMicStream, stopVisualizer, voskStop, speakWord } from './speech.js';
import { signIn, signUp, signOut, resendConfirmation, requestPasswordReset, updatePassword, signInWithGoogle } from './auth.js';
import { cloudLoad, saveProfile, cloudReset, loadProfile, saveDeck, saveWordStats, saveExam, markDirty, flushPendingSync } from './sync.js';

const API_KEY_SK = 'es_apikey';

// ────────────────────────────────────────────────
//  AUTH UI STATE
// ────────────────────────────────────────────────
let _authMode = 'login';
let _pendingConfirmEmail = '';
let _authInFlight = false;
let _loginInFlight = false;

// ────────────────────────────────────────────────
//  SCREEN ROUTING
// ────────────────────────────────────────────────
export function showScreen(id) {
  // Mic/Audio-Session freigeben wenn Spieler den Game-Screen verlässt (z.B. ← Zurück)
  if (id !== 'game-screen' && document.body.classList.contains('in-game')) {
    try { voskStop(); } catch(e) {}
    try { stopVisualizer(); } catch(e) {}
  }
  ['loading-screen','apikey-screen','name-screen','menu-screen','game-screen','end-screen','stats-screen','profile-screen','scan-screen','review-screen','auth-screen','email-confirm-screen','password-reset-screen','password-reset-sent-screen','new-password-screen'].forEach(s => {
    const el = document.getElementById(s); if (el) el.style.display = 'none';
  });
  const el = document.getElementById(id);
  el.style.display = ['loading-screen','menu-screen','game-screen','stats-screen','profile-screen','scan-screen','review-screen'].includes(id) ? 'flex' : 'block';
  if (id === 'game-screen') document.body.classList.add('in-game');
  else document.body.classList.remove('in-game');
  const ft = document.getElementById('menu-footer');
  if (ft) ft.style.display = (id === 'menu-screen') ? 'flex' : 'none';
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) installBtn.style.display = (id === 'menu-screen' && window._pwaInstallReady) ? 'flex' : 'none';
  const isLoading = id === 'loading-screen';
  const musicBtnGlobal = document.getElementById('music-btn-global');
  const musicVolBtn = document.getElementById('music-vol-btn');
  if (musicBtnGlobal) musicBtnGlobal.style.display = isLoading ? 'none' : '';
  if (musicVolBtn) musicVolBtn.style.display = isLoading ? 'none' : '';
}

// ────────────────────────────────────────────────
//  NAME SCREEN
// ────────────────────────────────────────────────
export function saveName() {
  const v = document.getElementById('name-input').value.trim();
  if (!v) { document.getElementById('name-input').style.borderColor = 'var(--red)'; return; }
  window.SD.playerName = v;
  persist(window.SD);
  if (window.currentUser) {
    saveProfile(window.SD, window.currentUser.id).catch(e => console.error('[saveName] sync:', e));
  }
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
//  MODUS-TOGGLE
// ────────────────────────────────────────────────

function _renderModeToggle(mode) {
  ['free', 'student', 'campaign'].forEach(m => {
    const btn = document.getElementById('mode-btn-' + m);
    if (!btn) return;
    btn.style.background  = (m === mode) ? '#fff' : 'transparent';
    btn.style.color       = (m === mode) ? 'var(--purple)' : '#999';
    btn.style.boxShadow   = (m === mode) ? '0 2px 6px rgba(0,0,0,.12)' : 'none';
  });
}

export function renderModeContent(mode) {
  const freeEl    = document.getElementById('mode-free');
  const studentEl = document.getElementById('mode-student');
  const campEl    = document.getElementById('mode-campaign');
  if (freeEl)    freeEl.style.display    = (mode === 'free')     ? '' : 'none';
  if (studentEl) studentEl.style.display = (mode === 'student')  ? '' : 'none';
  if (campEl)    campEl.style.display    = (mode === 'campaign') ? '' : 'none';
  _renderModeToggle(mode);
}

export function setActiveMode(mode) {
  const valid = ['free', 'student', 'campaign'];
  if (!valid.includes(mode)) mode = 'free';
  window.SD.activeMode = mode;
  persist(window.SD);
  if (window.currentUser) {
    saveProfile(window.SD, window.currentUser.id).catch(() => {});
  }
  renderModeContent(mode);
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
  renderModeContent(window.SD.activeMode || 'free');
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

  const cloudSection = document.getElementById('prof-cloud-section');
  if (cloudSection) {
    const user = window.currentUser;
    if (user) {
      cloudSection.innerHTML = `
        <h3 style="color:var(--purple);margin-top:0">☁️ Cloud-Konto</h3>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.82rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.email}</div>
            <div style="font-size:.72rem;color:#2a7a35;font-weight:700;">Fortschritt wird synchronisiert</div>
          </div>
          <button onclick="authLogout()" style="font-family:'Fredoka One',cursive;font-size:.78rem;padding:6px 14px;background:#ffd0d0;color:#c0001a;border:none;border-radius:50px;cursor:pointer;white-space:nowrap;flex-shrink:0;">Abmelden</button>
        </div>`;
    } else {
      cloudSection.innerHTML = `
        <h3 style="color:#888;margin-top:0">☁️ Cloud-Konto</h3>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="flex:1;">
            <div style="font-size:.82rem;font-weight:700;color:#888;">Nicht eingeloggt</div>
            <div style="font-size:.72rem;color:#aaa;font-weight:700;">Speichere deinen Fortschritt auf allen Geräten</div>
          </div>
          <button onclick="showAuth()" style="font-family:'Fredoka One',cursive;font-size:.78rem;padding:8px 14px;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;border:none;border-radius:50px;cursor:pointer;box-shadow:0 3px 0 #7a4ba8;white-space:nowrap;flex-shrink:0;">☁️ Anmelden</button>
        </div>`;
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
  if (window.currentUser) {
    saveProfile(window.SD, window.currentUser.id).catch(e => console.error('[editPlayerName] sync:', e));
  }
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

  const vocabMastered    = VOCAB.filter(v => { const s = SD.wordStats[statKeyFor(v.de,v.en,'_mc')]; return s && Math.floor(s.asked||0) >= 3 && s.correct/s.asked >= 0.9; }).length;
  const spellMastered    = VOCAB.filter(v => { const s = SD.wordStats[statKeyFor(v.de,v.en,'_sp')]; return s && Math.floor(s.asked||0) >= 3 && s.correct/s.asked >= 0.9; }).length;
  const pronounceMastered = VOCAB.filter(v => { const s = SD.wordStats[statKeyFor(v.de,v.en,'_pr')]; return s && Math.floor(s.asked||0) >= 3 && s.correct/s.asked >= 0.9; }).length;

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
    const s = SD.wordStats[statKeyFor(v.de,v.en,'_mc')];
    const st = wordStatus(s, 3);
    return `<tr><td>${v.de}</td><td>${v.en}</td><td><span class="ws-badge ${st.cls}">${st.label}</span></td><td>${wrongDots(s)}</td></tr>`;
  }).join('');

  const st2 = document.getElementById('stats-spelling-table').querySelector('tbody');
  st2.innerHTML = VOCAB.map(v => {
    const s = SD.wordStats[statKeyFor(v.de,v.en,'_sp')];
    const st = wordStatus(s, 3);
    return `<tr><td>${v.de}</td><td>${v.en}</td><td><span class="ws-badge ${st.cls}">${st.label}</span></td><td>${wrongDots(s)}</td></tr>`;
  }).join('');

  const pt = document.getElementById('stats-pronounce-table').querySelector('tbody');
  pt.innerHTML = VOCAB.map(v => {
    const s = SD.wordStats[statKeyFor(v.de,v.en,'_pr')];
    const st = wordStatus(s, 3);
    return `<tr><td>${v.de}</td><td>${v.en}</td><td><span class="ws-badge ${st.cls}">${st.label}</span></td><td>${wrongDots(s)}</td></tr>`;
  }).join('');
}

// ────────────────────────────────────────────────
//  RESET
// ────────────────────────────────────────────────
export async function confirmReset() {
  if (!confirm('⚠️ Bist du dir wirklich sicher?\n\nALL dein Fortschritt wird gelöscht!')) return;

  const name = window.SD.playerName;

  if (window.currentUser) {
    const btn = document.querySelector('[title="Fortschritt zurücksetzen"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    try {
      await cloudReset(window.currentUser.id);
      try { localStorage.removeItem('pending_sync'); } catch(e) {}
    } catch(e) {
      console.error('[confirmReset] Cloud-Reset Fehler:', e.message);
      if (btn) { btn.disabled = false; btn.textContent = '🗑️'; }
      alert('Fehler beim Zurücksetzen. Bitte erneut versuchen.');
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = '🗑️'; }
    window.SD = {
      _version: 4, playerName: name, highscore: 0, totalPoints: 0,
      activeMode: 'free', activeDeckId: null, decks: {},
      categoryProgress: {
        vocab:       { played: 0, correct: 0, bestStreak: 0 },
        spelling:    { played: 0, correct: 0, bestStreak: 0 },
        pronounce:   { played: 0, correct: 0, bestStreak: 0 },
        mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
      },
      wordStats: {},
    };
  } else {
    window.SD = window.freshData();
    window.SD.playerName = name;
  }

  syncMirrorFromActiveDeck();
  persist(window.SD);
  showMenu();
  setTimeout(() => alert('✅ Fortschritt zurückgesetzt!'), 100);
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

export async function importData(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  let parsed;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch(e) { alert('❌ Datei konnte nicht gelesen werden.'); return; }

  const imported = window.migrateData ? window.migrateData(parsed) : parsed;
  const srcDecks = Object.values(imported?.decks || {});
  if (!srcDecks.length) { alert('❌ Keine Sammlungen in der Datei gefunden.'); return; }

  const userId = window.currentUser?.id;
  console.log('[import] Starte Import von', srcDecks.length, 'Sammlung(en) | userId:', userId);

  let count = 0;
  for (const src of srcDecks) {
    // Temp-ID (non-UUID) → saveDeck macht INSERT + UUID-Rename
    const tempId = 'import_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const deck = {
      id:               tempId,
      name:             src.name || 'Importierte Sammlung',
      createdAt:        Date.now(),
      vocab:            src.vocab || [],
      wordStats:        src.wordStats || {},
      categoryProgress: src.categoryProgress || {
        vocab:       { played: 0, correct: 0, bestStreak: 0 },
        spelling:    { played: 0, correct: 0, bestStreak: 0 },
        pronounce:   { played: 0, correct: 0, bestStreak: 0 },
        mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
      },
      lastExam: src.lastExam || null,
    };

    // IDs vor dem Insert merken um Cloud-UUID zu erkennen
    const beforeIds = new Set(Object.keys(window.SD.decks));
    window.SD.decks[tempId] = deck;
    console.log('[import] Deck vorbereitet:', deck.name, '|', deck.vocab.length, 'Wörter');

    if (userId) {
      await saveDeck(deck, userId);

      if (window.SD.decks[tempId]) {
        // saveDeck hat tempId nicht ersetzt → INSERT fehlgeschlagen
        delete window.SD.decks[tempId];
        console.warn('[import] Cloud-Insert fehlgeschlagen für:', deck.name);
        continue;
      }

      const cloudId = Object.keys(window.SD.decks).find(id => !beforeIds.has(id));
      if (cloudId) {
        const cd = window.SD.decks[cloudId];
        if (Object.keys(cd.wordStats).length > 0) {
          await saveWordStats(cloudId, cd.wordStats, userId);
          console.log('[import] WordStats gespeichert:', cd.name);
        }
        if (cd.lastExam?.grade != null) {
          await saveExam({ deckId: cloudId, grade: cd.lastExam.grade, percent: cd.lastExam.percent }, userId);
          console.log('[import] Exam gespeichert:', cd.name);
        }
      }
    }
    count++;
  }

  persist(window.SD);
  syncMirrorFromActiveDeck();
  renderDecks();
  showMenu();
  setTimeout(() => alert('✅ ' + count + ' Sammlung' + (count !== 1 ? 'en' : '') + ' importiert!'), 100);
}

// ────────────────────────────────────────────────
//  AUTH UI
// ────────────────────────────────────────────────

export function showAuth() {
  _authMode = 'login';
  _pendingConfirmEmail = '';
  const emailEl = document.getElementById('auth-email');
  const pwEl = document.getElementById('auth-password');
  const errEl = document.getElementById('auth-error');
  if (emailEl) emailEl.value = '';
  if (pwEl) pwEl.value = '';
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  _updateAuthModeUI();
  showScreen('auth-screen');
}

function _updateAuthModeUI() {
  const title = document.getElementById('auth-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const confirmEl = document.getElementById('auth-password-confirm');
  const isLogin = _authMode === 'login';
  if (title) title.textContent = isLogin ? 'Anmelden' : 'Konto erstellen';
  if (submitBtn) submitBtn.textContent = isLogin ? 'Anmelden' : 'Registrieren';
  if (toggleBtn) toggleBtn.textContent = isLogin
    ? 'Noch kein Konto? Registrieren'
    : 'Schon registriert? Anmelden';
  if (confirmEl) { confirmEl.style.display = isLogin ? 'none' : 'block'; confirmEl.value = ''; }
  const forgotBtn = document.getElementById('auth-forgot-btn');
  if (forgotBtn) forgotBtn.style.display = isLogin ? 'block' : 'none';
}

export function authToggleMode() {
  _authMode = _authMode === 'login' ? 'signup' : 'login';
  const errEl = document.getElementById('auth-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  _updateAuthModeUI();
}

export async function authSubmit() {
  if (_authInFlight) return;
  const emailEl = document.getElementById('auth-email');
  const pwEl = document.getElementById('auth-password');
  const submitBtn = document.getElementById('auth-submit-btn');
  const email = emailEl ? emailEl.value.trim() : '';
  const password = pwEl ? pwEl.value : '';

  if (!email || !password) {
    _setAuthError('Bitte E-Mail und Passwort eingeben.');
    return;
  }

  if (_authMode === 'signup') {
    const confirmEl = document.getElementById('auth-password-confirm');
    if (password !== (confirmEl ? confirmEl.value : '')) {
      _setAuthError('Passwörter stimmen nicht überein.');
      return;
    }
  }

  _authInFlight = true;
  submitBtn.disabled = true;
  submitBtn.textContent = '…';

  let result;
  try {
    result = _authMode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password);
  } finally {
    _authInFlight = false;
    submitBtn.disabled = false;
    _updateAuthModeUI();
  }

  if (result.emailNotConfirmed) {
    _pendingConfirmEmail = email;
    const display = document.getElementById('confirm-email-display');
    if (display) display.textContent = email;
    const msg = document.getElementById('confirm-message');
    if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
    showScreen('email-confirm-screen');
    return;
  }

  if (result.error) {
    _setAuthError(result.error);
    return;
  }

  // signup: Email-Confirm-Screen zeigen (Supabase bestätigt per Link)
  if (result.user === 'pending_confirmation' || _authMode === 'signup') {
    _pendingConfirmEmail = email;
    const display = document.getElementById('confirm-email-display');
    if (display) display.textContent = email;
    const msg = document.getElementById('confirm-message');
    if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
    showScreen('email-confirm-screen');
    return;
  }

  // login erfolgreich
  handleLogin(result.user);
}

function _setAuthError(msg) {
  const errEl = document.getElementById('auth-error');
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

export async function authResend() {
  if (!_pendingConfirmEmail) return;
  const btn = document.getElementById('confirm-resend-btn');
  const msgEl = document.getElementById('confirm-message');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const err = await resendConfirmation(_pendingConfirmEmail);
  if (btn) { btn.disabled = false; btn.textContent = 'Erneut senden'; }
  if (msgEl) {
    msgEl.style.display = 'block';
    if (err) {
      msgEl.textContent = err;
      msgEl.style.cssText = 'display:block;font-size:.82rem;font-weight:700;text-align:center;max-width:300px;margin-bottom:12px;padding:8px 12px;border-radius:10px;background:#fff0f0;color:#c0001a;';
    } else {
      msgEl.textContent = 'Mail wurde erneut gesendet!';
      msgEl.style.cssText = 'display:block;font-size:.82rem;font-weight:700;text-align:center;max-width:300px;margin-bottom:12px;padding:8px 12px;border-radius:10px;background:#f0fff4;color:#2a7a35;';
    }
  }
}

export async function authLogout() {
  try { sessionStorage.setItem('force_account_picker', '1'); } catch(e) {}
  await signOut();
  handleLogout();
}

export async function authGoogleSignIn() {
  let forceAccountPicker = false;
  try {
    forceAccountPicker = sessionStorage.getItem('force_account_picker') === '1';
    if (forceAccountPicker) sessionStorage.removeItem('force_account_picker');
  } catch(e) {}
  const btn = document.getElementById('auth-google-btn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const { error } = await signInWithGoogle(forceAccountPicker);
  // On success: browser redirects to Google — no further action needed here.
  if (error) {
    _setAuthError(error);
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48" style="flex-shrink:0"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.04 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.54-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Mit Google anmelden'; }
  }
}

// ────────────────────────────────────────────────
//  PASSWORT VERGESSEN
// ────────────────────────────────────────────────

export function showPasswordReset() {
  const emailEl = document.getElementById('auth-email');
  const resetEmailEl = document.getElementById('pw-reset-email');
  if (resetEmailEl && emailEl) resetEmailEl.value = emailEl.value.trim();
  const errEl = document.getElementById('pw-reset-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  showScreen('password-reset-screen');
}

export async function submitPasswordReset() {
  const emailEl = document.getElementById('pw-reset-email');
  const btn = document.getElementById('pw-reset-btn');
  const errEl = document.getElementById('pw-reset-error');
  const email = emailEl ? emailEl.value.trim() : '';
  if (!email) {
    if (errEl) { errEl.textContent = 'Bitte E-Mail eingeben.'; errEl.style.display = 'block'; }
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const err = await requestPasswordReset(email);
  if (btn) { btn.disabled = false; btn.textContent = 'Reset-Link senden'; }
  if (err) {
    if (errEl) { errEl.textContent = err; errEl.style.display = 'block'; }
    return;
  }
  showScreen('password-reset-sent-screen');
}

export function showNewPasswordScreen() {
  const pwEl = document.getElementById('new-pw-input');
  const confirmEl = document.getElementById('new-pw-confirm');
  const errEl = document.getElementById('new-pw-error');
  if (pwEl) pwEl.value = '';
  if (confirmEl) confirmEl.value = '';
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  showScreen('new-password-screen');
}

export async function submitNewPassword() {
  const pwEl = document.getElementById('new-pw-input');
  const confirmEl = document.getElementById('new-pw-confirm');
  const btn = document.getElementById('new-pw-btn');
  const errEl = document.getElementById('new-pw-error');
  const password = pwEl ? pwEl.value : '';
  const confirm = confirmEl ? confirmEl.value : '';
  if (!password || password.length < 6) {
    if (errEl) { errEl.textContent = 'Passwort muss mind. 6 Zeichen haben.'; errEl.style.display = 'block'; }
    return;
  }
  if (password !== confirm) {
    if (errEl) { errEl.textContent = 'Passwörter stimmen nicht überein.'; errEl.style.display = 'block'; }
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const err = await updatePassword(password);
  if (btn) { btn.disabled = false; btn.textContent = 'Passwort speichern'; }
  if (err) {
    if (errEl) { errEl.textContent = err; errEl.style.display = 'block'; }
    return;
  }
  window.location.hash = '';
  // Supabase hat den User automatisch eingeloggt nach updateUser
  if (window.currentUser) await handleLogin(window.currentUser);
  else showScreen('auth-screen');
}

export async function cancelNewPassword() {
  window.location.hash = '';
  await signOut();
  window.currentUser = null;
  showScreen('auth-screen');
}

// ────────────────────────────────────────────────
//  AUTH LIFECYCLE (aufgerufen von startup.js + authSubmit)
// ────────────────────────────────────────────────

export async function handleLogin(user) {
  if (_loginInFlight) return;
  _loginInFlight = true;
  window.currentUser = user;
  // Lokalen Stand vor Cloud-Overwrite sichern — für Stat-Merge unten.
  const localSDBeforeCloud = window.SD;
  console.log('[handleLogin] CALLED with user:', user?.email);
  const mergedDeckIds = [];
  try {
    const cloudState = await cloudLoad(user.id);
    // Only replace SD when cloud returned actual data — never overwrite with empty state.
    // If cloudLoad returns null (new user or retry exhausted), keep whatever localStorage had.
    if (cloudState) {
      // Stats mergen: pro Key den Stand mit dem höheren asked-Wert bevorzugen.
      // Verhindert dass besserer lokaler Fortschritt (noch nicht gesynct) durch
      // niedrigere Cloud-Stats überschrieben wird.
      for (const [deckId, cloudDeck] of Object.entries(cloudState.decks || {})) {
        const localDeck = localSDBeforeCloud?.decks?.[deckId];
        if (!localDeck?.wordStats) continue;
        for (const [key, localStat] of Object.entries(localDeck.wordStats)) {
          const cloudStat = cloudDeck.wordStats[key];
          if (!cloudStat || (localStat.asked || 0) > (cloudStat.asked || 0)) {
            cloudDeck.wordStats[key] = localStat;
            if (!mergedDeckIds.includes(deckId)) mergedDeckIds.push(deckId);
          }
        }
      }
      window.SD = cloudState;
      persist(window.SD);
      syncMirrorFromActiveDeck();
    }
    // Explicit profile load — final guarantee that player_name is in SD,
    // even when cloudLoad returned null (no decks yet) but profile row exists.
    const data = await loadProfile(user.id);
    console.log('[handleLogin] Cloud profile loaded:', data);
    if (data && data.player_name) {
      window.SD.playerName   = data.player_name;
      window.SD.highscore    = data.highscore      || window.SD.highscore    || 0;
      window.SD.totalPoints  = data.total_points   || window.SD.totalPoints  || 0;
      window.SD.activeDeckId = data.active_deck_id || window.SD.activeDeckId || null;
      window.SD.activeMode   = data.active_mode    || window.SD.activeMode   || 'free';
      persist(window.SD);
    }
  } catch(e) {
    console.error('[handleLogin] Cloud-Sync Fehler — lokale Daten bleiben erhalten:', e.message);
  } finally {
    _loginInFlight = false;
  }
  console.log('[handleLogin] SD nach Load:', window.SD.playerName, window.SD.highscore);
  if (migrateStatKeys()) persist(window.SD);
  // Zusammengeführte Stats zurück in die Cloud schreiben, damit beim nächsten
  // Login kein erneuter Merge-Konflikt entsteht.
  if (mergedDeckIds.length > 0 && window.currentUser) {
    mergedDeckIds.forEach(id => markDirty('word_stats', id));
    flushPendingSync().catch(() => {});
  }
  if (!window.SD?.playerName) showScreen('name-screen');
  else showMenu();
}

export function handleLogout() {
  window.currentUser = null;
  clearStorage();
  window.SD = freshData();
  syncMirrorFromActiveDeck();
  showScreen('auth-screen');
}
