// src/modules/ui.js
import { persist, freshData, clearStorage } from './storage.js';
import { effectivePct } from './stats.js';
import { syncMirrorFromActiveDeck, activeDeck, deckProgress, renderDecks } from './decks.js';
import { releaseMicStream, stopVisualizer, speakWord } from './speech.js';
import { signIn, signUp, signOut, resendConfirmation } from './auth.js';
import { cloudLoad, saveProfile, cloudReset } from './sync.js';

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
  ['loading-screen','apikey-screen','name-screen','menu-screen','game-screen','end-screen','stats-screen','profile-screen','scan-screen','review-screen','auth-screen','email-confirm-screen'].forEach(s => {
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
      activeDeckId: null, decks: {},
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
  await signOut();
  handleLogout();
}

// ────────────────────────────────────────────────
//  AUTH LIFECYCLE (aufgerufen von startup.js + authSubmit)
// ────────────────────────────────────────────────

export async function handleLogin(user) {
  if (_loginInFlight) return;
  _loginInFlight = true;
  window.currentUser = user;
  try {
    let cloudState = await cloudLoad(user.id);
    if (!cloudState) {
      // Neuer eingeloggter User: leerer Start — User legt eigene Decks an
      cloudState = {
        _version: 4, playerName: '', highscore: 0, totalPoints: 0,
        activeDeckId: null, decks: {},
        categoryProgress: {
          vocab:       { played: 0, correct: 0, bestStreak: 0 },
          spelling:    { played: 0, correct: 0, bestStreak: 0 },
          pronounce:   { played: 0, correct: 0, bestStreak: 0 },
          mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
        },
        wordStats: {},
      };
    }
    if (cloudState) {
      window.SD = cloudState;
      persist(window.SD);
      syncMirrorFromActiveDeck();
    }
  } catch(e) {
    console.error('[handleLogin] Cloud-Sync Fehler:', e.message);
  } finally {
    _loginInFlight = false;
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
