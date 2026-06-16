// src/modules/ui.js
import { persist, freshData, clearStorage } from './storage.js';
import { effectivePct, isStatMastered, statKeyFor } from './stats.js';
import { syncMirrorFromActiveDeck, deckProgress, presetProgressPct, renderDecks, migrateStatKeys, deckMode, activeDeckIdForMode } from './decks.js';
import { getPresetCategories } from './vocab.js';
import { releaseMicStream, stopVisualizer, voskStop, speakWord } from './speech.js';
import { signIn, signUp, signOut, resendConfirmation, requestPasswordReset, updatePassword, signInWithGoogle } from './auth.js';
import { cloudLoad, cloudReset, saveDeck, saveWordStats, saveExam, markDirty, flushPendingSync, setCloudConfirmed, getPendingCount, setKnownSig, cloudChangedRemotely } from './sync.js';
import { commitDirty } from './dialog.js';

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
  window.scrollTo(0, 0);
  el.scrollTop = 0;
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
  // Letzten "wiederherstellbaren" Screen merken — ein Relaunch landet so näher dran.
  // Bewusst nur Menü/Profil/Fortschritt (kein mitten-im-Spiel/Scan/Review-Restore).
  if (['menu-screen','profile-screen','stats-screen'].includes(id)) {
    try { localStorage.setItem('es_last_screen', id); } catch(e) {}
  }
  _currentScreen = id; // aktuellen Screen merken (Android-Back-Layer)
  // Echte VORWÄRTS-Navigation zu einem In-App-Screen (nicht Menü, nicht Pre-Login)
  // bekommt einen eigenen History-Eintrag, damit der Zurück erst zum Menü navigiert
  // (Branch 3) statt sofort den Menü-Exit (Branch 4) auszulösen. NICHT aus dem
  // popstate-Handler heraus (= Zurück-Navigation) und nicht doppelt stapeln.
  const _isInAppScreen = id !== 'menu-screen' && !NAV_IGNORE.includes(id);
  if (!_inPopstate && _isInAppScreen && !(history.state && history.state.esScreen)) {
    try { history.pushState({ esScreen: true }, ''); } catch (e) {}
  }
}

// ────────────────────────────────────────────────
//  ANDROID ZURÜCK-BUTTON — Back-Layer (In-App-Back)
// ────────────────────────────────────────────────
// Ein History-Wächter (pushState) + popstate-Listener fangen den Hardware-/Gesten-
// Zurück ab, solange ein Wächter liegt. showScreen merkt nur _currentScreen.
//
// Grundregel (wegen Chromes Anti-Trap): ein pushState zählt nur, wenn er WÄHREND
// einer echten Nutzer-Geste passiert — gestenlos erzeugte Einträge markiert Chrome
// als „skippable" und überspringt sie beim nächsten Zurück. Darum:
//   • Re-Push nur dort, wo wir BLEIBEN wollen (Overlay offen / Spiel) — best effort.
//   • Beim VERLASSEN (Screen→Menü, Menü→Exit) KEIN Re-Push: der nächste Zurück soll
//     ja durchgehen. Der Menü-Wächter liegt schon darunter bzw. _refreshGuardOnGesture
//     armt ihn beim nächsten Tap gesten-gedeckt neu. (Das gestenlose Nachlegen beim
//     Verlassen war die Ursache der „mal 2, mal 3 Klicks"-Inkonsistenz.)
//
// Zurück-Logik (popstate): (1) offenes Overlay schließen; (2) Spiel → confirmHome
// (Speichern-Nachfrage); (3) nicht im Menü → Menü; (4) im Menü → Toast-Hinweis,
// nächster Zurück verlässt die PWA durch reine Propagation. Den finalen Exit
// erzwingen wir nicht (Plattformgrenze, s. TWA-To-do).
let _currentScreen = 'loading-screen';
let _navActive = false;
let _inPopstate = false;    // true während _onBackNavPop läuft → unterdrückt Screen-Push in showScreen

// Pre-Login/Transient-Screens: hier führt „zurück" NICHT ins Menü (kein Login),
// sondern direkt zum Toast-Hinweis (Branch 4).
const NAV_IGNORE = ['loading-screen','auth-screen','email-confirm-screen',
  'password-reset-screen','password-reset-sent-screen','new-password-screen',
  'name-screen','apikey-screen'];

function initBackNav() {
  if (_navActive) return;
  _navActive = true;
  window.addEventListener('popstate', _onBackNavPop);
  // Gestengedeckter Re-Arm: stellt den Wächter nach App-Wechsel beim nächsten Tap
  // wieder her (capture, konsumiert nichts; touchstart passive → Scroll ungestört).
  document.addEventListener('pointerdown', _refreshGuardOnGesture, true);
  document.addEventListener('click', _refreshGuardOnGesture, true);
  document.addEventListener('touchstart', _refreshGuardOnGesture, { capture: true, passive: true });
  _armGuard();
}

// Einen Wächter-Eintrag legen — gleiche URL (kein Hash-Wechsel!), damit die
// Passwort-Recovery-Erkennung (location.hash type=recovery in startup.js) bleibt.
function _armGuard() {
  try { history.pushState({ esBackGuard: true }, ''); } catch(e) {}
}

// Liegt oben ein abfangbarer Back-Eintrag? Das ist ENTWEDER der Menü-Wächter
// (esBackGuard) ODER ein Screen-Eintrag (esScreen, von showScreen gepusht). Beide
// lösen beim Zurück ein popstate aus, das wir abfangen — ein zweiter darf NICHT
// drauf (sonst Stapel-Aufbau).
function _hasBackEntry() {
  return !!(history.state && (history.state.esBackGuard || history.state.esScreen));
}

// Genau einen Back-Eintrag oben sicherstellen — nur pushen, wenn keiner liegt.
function _ensureGuard() {
  if (!_hasBackEntry()) _armGuard();
}

// Bei echter Nutzer-Geste den Wächter wiederherstellen, wenn keiner liegt (z.B. nach
// App-Wechsel, wo der Eintrag verlorenging) — gestengedeckt, von Chrome akzeptiert.
function _refreshGuardOnGesture() {
  _ensureGuard();
}

// Oberstes offenes Overlay finden — generisch über die gemeinsame Kennung der
// dynamischen Dialoge (position:fixed + z-index:9999) bzw. optional .es-overlay.
// Letztes Body-Kind = zuletzt geöffnet = oberstes.
function _topOverlay() {
  const kids = document.body ? document.body.children : [];
  for (let i = kids.length - 1; i >= 0; i--) {
    const el = kids[i];
    if (el.nodeType !== 1) continue;
    const s = el.style;
    // Versteckte Dauer-Elemente ignorieren (z.B. #init-overlay, das nach dem
    // Laden nur display:none gesetzt, nicht entfernt wird) — sonst „schluckt"
    // der erste Back dieses tote Overlay statt das Schließen-Popup zu öffnen.
    if (s && s.display === 'none') continue;
    if (el.classList && el.classList.contains('es-overlay')) return el;
    if (s && s.position === 'fixed' && s.zIndex === '9999') return el;
  }
  return null;
}

function _onBackNavPop() {
  // _inPopstate unterdrückt den Screen-Push in showScreen, wenn showMenu/confirmHome
  // aus diesem Handler heraus (= Zurück-Navigation) gerufen werden. finally stellt
  // sicher, dass das Flag auch bei frühem return / Fehler zurückgesetzt wird.
  _inPopstate = true;
  try {
    // 1) Modal zuerst: oberstes Overlay schließen.
    const ov = _topOverlay();
    if (ov) {
      try { ov.remove(); } catch(e) {}
      // Sonderfall Spiel-Dialog: zweiter Zurück am „Zurück zum Menü?"-Popup nimmt
      // dessen Wert „Zum Menü" (echte Navigation, kein skippable-Wächter-Glücksspiel).
      if (window._gameConfirmOpen) {
        window._gameConfirmOpen = false;
        try { (window.goHomeSaving || function(){})(); } catch(e) {}
        return;   // VERLASSEN des Spiels → kein Re-Push
      }
      _ensureGuard();   // sonst: Overlay geschlossen, im Screen bleiben → Wächter sichern
      return;
    }

    // 2) Spiel → Menü mit Speichern-Nachfrage. BLEIBEN (Dialog) → Wächter sicherstellen.
    if (_currentScreen === 'game-screen') {
      try { (window.confirmHome || function(){})(); } catch(e) {}
      _ensureGuard();   // Back-Eintrag IMMER sicherstellen, egal wie confirmHome ausgeht
      return;
    }
    // 2b) Draft „neue Sammlung" → wie „Abbrechen": Rückfrage statt direkt ins Menü.
    //     BLEIBEN (Dialog offen) → Wächter sicherstellen.
    if (_currentScreen === 'scan-screen' && window._draftDeck) {
      try { (window.confirmAbortDraft || function(){})(); } catch(e) {}
      _ensureGuard();
      return;
    }
    // 3) Sonst nicht im Menü (und kein Pre-Login-Screen) → Menü. VERLASSEN → KEIN
    //    Re-Push (Menü-Wächter liegt schon darunter; gestenloses Nachlegen wäre
    //    skippable → die „3 Klicks"-Lotterie).
    if (_currentScreen !== 'menu-screen' && !NAV_IGNORE.includes(_currentScreen)) {
      try { showMenu(); } catch(e) {}
      return;
    }

    // 4) Im Menü (oder Pre-Login): erster Zurück = Hinweis-Toast (verbraucht den
    //    Wächter), nächster Zurück verlässt die PWA durch reine Propagation. Tippt
    //    der Nutzer nach dem Hinweis irgendwo, armt _refreshGuardOnGesture den
    //    Wächter gesten-gedeckt neu → nächster Zurück zeigt wieder den Hinweis.
    _showExitToast();                  // (hat eigenen Auto-Hide)
  } finally {
    _inPopstate = false;
  }
}

// Sofort beim Laden aktivieren — entkoppelt von jedem Screen-Flow.
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackNav);
  } else {
    initBackNav();
  }
}

// Hinweis-Toast beim ersten Menü-Back — z-index 10000 (NICHT 9999), damit
// _topOverlay ihn nicht als Modal greift. Blendet sich nach kurzer Zeit selbst aus.
let _toastTimer = null;
function _showExitToast() {
  let t = document.getElementById('_es-exit-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_es-exit-toast';
    t.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;background:rgba(0,0,0,.82);color:#fff;font-family:'Fredoka One',cursive;font-size:1.15rem;text-align:center;padding:16px 28px;border-radius:24px;box-shadow:0 8px 28px rgba(0,0,0,.35);pointer-events:none;opacity:0;transition:opacity .2s;";
    t.textContent = 'Zum Schließen erneut zurück';
    (document.body || document.documentElement).appendChild(t);
  }
  void t.offsetWidth; // reflow → fade-in greift
  t.style.opacity = '1';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(_hideExitToast, 2000);   // Auto-Hide (reine Kosmetik)
}

function _hideExitToast() {
  const t = document.getElementById('_es-exit-toast');
  if (!t) return;
  t.style.opacity = '0';
  setTimeout(() => { if (t && t.parentNode) t.remove(); }, 250);
}

// ────────────────────────────────────────────────
//  NAME SCREEN
// ────────────────────────────────────────────────
export async function saveName() {
  const v = document.getElementById('name-input').value.trim();
  if (!v) { document.getElementById('name-input').style.borderColor = 'var(--red)'; return; }
  window.SD.playerName = v;
  persist(window.SD);
  if (window.currentUser) { markDirty('profile'); await commitDirty(); }
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
  // Schnell läuft global mit EINEM Backup → sobald ein anderer Modus angezeigt wird
  // als der, in dem Schnell gestartet wurde (_schnellOwnerMode), sauber beenden.
  // Fängt jeden Wechsel-Pfad ab, nicht nur den Toggle-Klick.
  if (window.isSchnellModus && window._schnellOwnerMode && mode !== window._schnellOwnerMode) {
    try { window.exitSchnellSilent && window.exitSchnellSilent(); } catch (e) {}
  }
  const freeEl    = document.getElementById('mode-free');
  const studentEl = document.getElementById('mode-student');
  const campEl    = document.getElementById('mode-campaign');
  if (freeEl)    freeEl.style.display    = (mode === 'free')     ? '' : 'none';
  if (studentEl) studentEl.style.display = (mode === 'student')  ? '' : 'none';
  if (campEl)    campEl.style.display    = (mode === 'campaign') ? '' : 'none';
  _renderModeToggle(mode);
  if (mode === 'free') renderDecks('free');
  else if (mode === 'student') renderStudentMode();
}

// Aktives Deck des Modus in den Spiegel übernehmen. SD.activeDeckByMode überlebt
// den Cloud-Load 1:1 nicht (Feld nicht in der Cloud) → activeDeckIdForMode baut es
// bei Bedarf neu auf (gemerktes Deck, sonst erstes Deck des Modus).
function _applyModeActiveDeck(mode) {
  const SD = window.SD;
  const id = activeDeckIdForMode(mode);
  SD.activeDeckId = id;
  if (!SD.activeDeckByMode) SD.activeDeckByMode = {};
  SD.activeDeckByMode[mode] = id;
  syncMirrorFromActiveDeck();
}

export async function setActiveMode(mode) {
  const valid = ['free', 'student', 'campaign'];
  if (!valid.includes(mode)) mode = 'free';
  const prev = window.SD.activeMode || 'free';
  // Schnell ist global (ein Backup) → Moduswechsel beendet ihn sauber.
  if (mode !== prev && window.isSchnellModus) {
    try { window.exitSchnellSilent && window.exitSchnellSilent(); } catch (e) {}
  }
  window.SD.activeMode = mode;
  _applyModeActiveDeck(mode);   // aktives Deck des Modus in den Spiegel
  persist(window.SD);
  renderModeContent(mode);   // sofort rendern (responsiv)
  if (window.currentUser) { markDirty('profile'); await commitDirty(); }
}

// ── Schülermodus: UV/VS-Sub-Toggle + Leerzustand-Chooser ──
// Die Wahl (vs|uv) liegt in localStorage (überlebt Cloud-Load 1:1, der window.SD
// ersetzt) → die Start-Abfrage kommt nach einmaliger Wahl nicht wieder.
const STUDENT_SUBTAB_KEY = 'es_student_subtab';
function _getStudentSubTab() {
  try { return localStorage.getItem(STUDENT_SUBTAB_KEY); } catch (e) { return null; }
}

function renderStudentMode() {
  const sub = _getStudentSubTab();
  const chooser = document.getElementById('student-chooser');
  const body = document.getElementById('student-body');
  if (!sub) {
    // Noch nichts gewählt → zwei große Kacheln zur Auswahl, Body aus.
    if (chooser) chooser.style.display = 'flex';
    if (body) body.style.display = 'none';
    return;
  }
  if (chooser) chooser.style.display = 'none';
  if (body) body.style.display = 'block';
  _renderStudentSubToggle(sub);
  const vs = document.getElementById('student-vs');
  const uv = document.getElementById('student-uv');
  if (vs) vs.style.display = (sub === 'vs') ? 'block' : 'none';
  if (uv) uv.style.display = (sub === 'uv') ? 'block' : 'none';
  // Schnell-Button nur in VS (UV ist Platzhalter).
  const schnellBtn = document.getElementById('student-schnell-toggle');
  if (schnellBtn) schnellBtn.style.display = (sub === 'vs') ? '' : 'none';
  if (sub === 'vs') renderDecks('student');
}

function _renderStudentSubToggle(sub) {
  ['vs', 'uv'].forEach(t => {
    const btn = document.getElementById('student-tab-' + t);
    if (!btn) return;
    const on = (t === sub);
    btn.style.background = on ? '#fff' : 'transparent';
    btn.style.color      = on ? 'var(--purple)' : '#999';
    btn.style.boxShadow  = on ? '0 2px 6px rgba(0,0,0,.12)' : 'none';
  });
}

export function chooseStudentTab(tab) {
  if (tab !== 'vs' && tab !== 'uv') return;
  try { localStorage.setItem(STUDENT_SUBTAB_KEY, tab); } catch (e) {}
  renderStudentMode();
}

// ────────────────────────────────────────────────
//  MENU
// ────────────────────────────────────────────────
export function showMenu() {
  // Aufgeschobenen SW-Reload (controllerchange während Nutzung) hier ausführen —
  // sicherer Moment, nicht mitten im Spiel. Siehe pwa.js.
  if (window._pendingReload) { window._pendingReload = false; window.location.reload(); return; }
  try { releaseMicStream(); } catch (e) {}
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  hideFeedback();
  showScreen('menu-screen');
  document.getElementById('menu-player-name').textContent = 'Hallo, ' + window.SD.playerName + '! 👋';
  document.getElementById('menu-highscore').textContent = window.SD.highscore;
  document.getElementById('menu-total').textContent = window.SD.totalPoints;
  const ft = document.getElementById('menu-footer'); if (ft) ft.style.display = 'flex';
  const mode = window.SD.activeMode || 'free';
  _applyModeActiveDeck(mode);   // aktives Deck des Modus sicherstellen (nach Cloud-Load 1:1)
  renderModeContent(mode);      // rendert die Decks des aktiven Modus
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
  window.esPrompt({ icon: '✏️', title: 'Dein Name', value: cur, ok: 'Speichern' }).then(async nn => {
    if (nn === null) return;
    const trimmed = nn.trim();
    if (!trimmed) return;
    window.SD.playerName = trimmed;
    persist(window.SD);
    if (window.currentUser) { markDirty('profile'); await commitDirty(); }
    const profEl = document.getElementById('profile-screen');
    if (profEl && profEl.style.display !== 'none') showProfile();
    else showStats();
  });
}

// ────────────────────────────────────────────────
//  STATS SCREEN
// ────────────────────────────────────────────────
export function wordStatus(stat, minAsked) {
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

export function wrongDots(stat) {
  if (!stat || !stat.asked) return '<span style="color:#bbb;font-size:.75rem">–</span>';
  const a = Math.floor(stat.asked || 0);
  const c = Math.floor(stat.correct || 0);
  const w = Math.floor(stat.wrong || 0);
  return '<span style="font-size:.75rem;color:#666;font-weight:700;white-space:nowrap;">' +
    '<span style="color:#3a9b45">●</span>' + c +
    ' <span style="color:#c0001a">●</span>' + w +
    '</span>';
}

export async function showStats() {
  showScreen('stats-screen');
  const SD = window.SD;
  const pn = document.getElementById('profile-name');
  const pm = document.getElementById('profile-meta');
  if (pn) pn.textContent = SD.playerName || 'Spieler';
  if (pm) pm.textContent = '🏆 Highscore: ' + SD.highscore + ' · ⭐ ' + SD.totalPoints + ' Pkt gesamt';

  const host = document.getElementById('profile-decks-summary');
  if (!host) return;
  const allDecks = Object.values(SD.decks || {});
  const freeDecks    = allDecks.filter(d => deckMode(d) === 'free');
  const studentDecks = allDecks.filter(d => deckMode(d) === 'student');

  host.innerHTML = '<div style="font-size:.82rem;color:#999;text-align:center;padding:10px;">Lade Fortschritt…</div>';

  // Vorlagen-Namen (async) — nur für die „Aktive Vorlagen"-Kacheln des Freien Modus.
  const categories = await getPresetCategories();
  const catById = Object.fromEntries((categories || []).map(c => [c.id, c]));

  // Reihenfolge wie im Hauptmenü-Toggle: Kampagne · Freier Modus · Schülermodus.
  const campSection = _statSection('🗺️ Kampagne',
    '<div style="font-size:.82rem;color:#999;text-align:center;padding:14px;">Kommt bald!</div>');

  const freeSection = _statSection('🎮 Freier Modus',
    _activePresetsBlock(freeDecks, catById) + _customWordsBlock(freeDecks));

  const studentSection = _statSection('🎒 Schülermodus',
    _studentDecksBlock(studentDecks) + _customWordsBlock(studentDecks) + _uvComingSoonBlock());

  host.innerHTML = campSection + freeSection + studentSection;
}

// Abschnitts-Rahmen mit Überschrift (Modus-Gliederung der Fortschritt-Seite).
function _statSection(title, inner) {
  return `<div style="margin-bottom:22px;">
    <div style="font-family:'Fredoka One',cursive;color:var(--text);font-size:1.1rem;margin:0 0 10px;border-bottom:2px solid #eee;padding-bottom:6px;">${title}</div>
    ${inner}
  </div>`;
}

// „Eigene Wörter"-Fortschrittsbalken über die eigenen (nicht-Vorlage) Wörter einer
// Deck-Menge. Im Schülermodus sind alle Wörter eigene → zählt die ganze Sammlung.
function _customWordsBlock(decks) {
  let total = 0, done = 0;
  for (const deck of decks) {
    for (const v of deck.vocab || []) {
      if (v._presetId) continue;
      total++;
      const allDone = ['_mc', '_sp', '_pr'].every(suf =>
        isStatMastered((deck.wordStats || {})[statKeyFor(v.de, v.en, suf)]));
      if (allDone) done++;
    }
  }
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `
    <div style="margin-bottom:16px;">
      <h3 style="font-family:'Fredoka One',cursive;color:var(--purple);font-size:1rem;margin:0 0 8px;">✏️ Eigene Wörter</h3>
      <div style="display:flex;justify-content:space-between;font-size:.85rem;font-weight:700;color:var(--text);margin-bottom:6px;">
        <span>${done} von ${total} Wörtern gelöst</span><span style="color:var(--purple);">${pct}%</span>
      </div>
      <div style="height:14px;background:#eee;border-radius:10px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--purple),var(--pink));border-radius:10px;"></div>
      </div>
    </div>`;
}

// „Aktive Vorlagen"-Kacheln (Freier Modus): je aktive Vorlage Balken + %.
function _activePresetsBlock(decks, catById) {
  const activePresets = [];
  for (const deck of decks) {
    const ids = deck.presetCategories || [];
    if (!ids.length) continue;
    const deckComplete = deckProgress(deck).overallPct === 100;
    for (const pid of ids) {
      const cat = catById[pid];
      activePresets.push({
        name: cat ? cat.name : 'Vorlage',
        deck: deck.name,
        pct: presetProgressPct(deck, pid),
        done: deckComplete,
      });
    }
  }
  return `
    <div style="margin-bottom:16px;">
      <h3 style="font-family:'Fredoka One',cursive;color:var(--purple);font-size:1rem;margin:0 0 8px;">📦 Aktive Vorlagen</h3>
      ${activePresets.length === 0
        ? '<div style="font-size:.82rem;color:#999;text-align:center;padding:10px;">Keine aktiven Vorlagen.</div>'
        : activePresets.map(p => {
            const bg = p.done
              ? 'background:linear-gradient(to right,rgba(58,170,92,.18) 100%,#fff 100%);box-shadow:inset 0 0 0 2px #3aaa5c;'
              : 'background:linear-gradient(to right,rgba(168,108,219,.15) ' + p.pct + '%,#f7f7f7 ' + p.pct + '%);';
            const right = p.done
              ? '<span style="font-size:.72rem;font-weight:700;color:#2a8a4a;background:rgba(58,170,92,.15);padding:3px 9px;border-radius:20px;white-space:nowrap;">✓ erledigt</span>'
              : '<span style="font-family:\'Fredoka One\',cursive;font-size:.95rem;color:#7a3aac;">' + p.pct + '%</span>';
            return `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;margin-bottom:6px;${bg}">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;color:var(--text);font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${window.escHtml(p.name)}</div>
                <div style="font-size:.68rem;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${window.escHtml(p.deck)}</div>
              </div>
              ${right}
            </div>`;
          }).join('')}
    </div>`;
}

// Schülermodus: Unregelmäßige Verben — noch ohne Inhalt.
function _uvComingSoonBlock() {
  return `
    <div style="margin-bottom:16px;">
      <h3 style="font-family:'Fredoka One',cursive;color:var(--purple);font-size:1rem;margin:0 0 8px;">🔁 Unregelmäßige Verben</h3>
      <div style="font-size:.82rem;color:#999;text-align:center;padding:10px;">Kommt bald!</div>
    </div>`;
}

// Schülermodus: angelegte Sammlungen als Kacheln mit Gesamt-% (analog Aktive Vorlagen).
function _studentDecksBlock(decks) {
  const tiles = decks.map(d => {
    const pct = deckProgress(d).overallPct;
    const done = pct === 100;
    const bg = done
      ? 'background:linear-gradient(to right,rgba(58,170,92,.18) 100%,#fff 100%);box-shadow:inset 0 0 0 2px #3aaa5c;'
      : 'background:linear-gradient(to right,rgba(168,108,219,.15) ' + pct + '%,#f7f7f7 ' + pct + '%);';
    const right = done
      ? '<span style="font-size:.72rem;font-weight:700;color:#2a8a4a;background:rgba(58,170,92,.15);padding:3px 9px;border-radius:20px;white-space:nowrap;">✓ erledigt</span>'
      : '<span style="font-family:\'Fredoka One\',cursive;font-size:.95rem;color:#7a3aac;">' + pct + '%</span>';
    return `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;margin-bottom:6px;${bg}">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;color:var(--text);font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${window.escHtml(d.name)}</div>
        <div style="font-size:.68rem;color:#888;">${(d.vocab || []).length} Wörter</div>
      </div>
      ${right}
    </div>`;
  }).join('');
  return `
    <div style="margin-bottom:16px;">
      <h3 style="font-family:'Fredoka One',cursive;color:var(--purple);font-size:1rem;margin:0 0 8px;">📚 Vokabelsammlungen</h3>
      ${decks.length === 0
        ? '<div style="font-size:.82rem;color:#999;text-align:center;padding:10px;">Noch keine Sammlungen angelegt.</div>'
        : tiles}
    </div>`;
}

// ────────────────────────────────────────────────
//  RESET
// ────────────────────────────────────────────────
export async function confirmReset() {
  const ok = await window.esConfirm({ icon: '⚠️', title: 'Bist du dir wirklich sicher?', body: 'ALL dein Fortschritt wird gelöscht!', ok: 'Löschen', cancel: 'Abbrechen', danger: true });
  if (!ok) return;

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
      window.esAlert({ icon: '❌', title: 'Fehler', body: 'Fehler beim Zurücksetzen. Bitte erneut versuchen.' });
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
      globalPresetStats: { wordStats: {}, categoryProgress: {} },
    };
  } else {
    window.SD = window.freshData();
    window.SD.playerName = name;
  }

  syncMirrorFromActiveDeck();
  persist(window.SD);
  showMenu();
  window.esAlert({ icon: '✅', title: 'Erledigt', body: 'Fortschritt zurückgesetzt!' });
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
  } catch(e) { window.esAlert({ icon: '❌', title: 'Fehler', body: 'Datei konnte nicht gelesen werden.' }); return; }

  const imported = window.migrateData ? window.migrateData(parsed) : parsed;
  const srcDecks = Object.values(imported?.decks || {});
  if (!srcDecks.length) { window.esAlert({ icon: '❌', title: 'Leer', body: 'Keine Sammlungen in der Datei gefunden.' }); return; }

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
  window.esAlert({ icon: '✅', title: 'Importiert', body: count + ' Sammlung' + (count !== 1 ? 'en' : '') + ' importiert!' });
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

// REGEL: Beim Start (und bei Resume > 2 Min) IMMER hart aus Supabase laden.
// Cloud ist die einzige Wahrheit; lokaler Stand ist nur Offline-Fallback und
// gewinnt nie. Kein Wert-Merge, keine Signatur, keine Single-Session.
export async function handleLogin(user) {
  if (_loginInFlight) return;
  _loginInFlight = true;
  window.currentUser = user;
  setCloudConfirmed(false);
  console.log('[handleLogin] CALLED with user:', user?.email);
  try {
    // Instagram-Gefühl: ist schon ein lokaler Name da, sofort die Menü-Shell mit
    // Skeleton-Kacheln zeigen (statt Blockier-Ladescreen), während hart geladen wird.
    if (window.SD?.playerName) showMenuSkeleton();
    const r = await loadFromCloud();
    if (r === 'new') { showScreen('name-screen'); return; }
    if (r === 'failed') {
      // Offline/unerreichbar: lokalen Cache als Fallback (Kind kann offline spielen);
      // kein lokaler Stand → klare Retry-Situation statt Leer.
      if (window.SD?.playerName) _finishLoginUI();
      else _showConnectionRetry(user);
      return;
    }
    _finishLoginUI();
  } catch (e) {
    console.error('[handleLogin] unerwartet:', e?.message);
    _finishLoginUI();
  } finally {
    _loginInFlight = false;
  }
}

// Hart aus der Cloud laden und übernehmen. Vorher offline-Nachzügler hochschieben
// (nur bei gültigem lokalem Stand → Empty-Write-Schutz), damit der harte Load sie
// nicht verwirft. Rückgabe: 'ok' | 'new' | 'failed'.
async function loadFromCloud() {
  const uid = window.currentUser?.id;
  if (!uid) return 'failed';
  if (window.SD?.playerName && getPendingCount() > 0) {
    setCloudConfirmed(true);
    await flushPendingSync().catch(() => {});
  }
  const res = await cloudLoad(uid);   // ensureFreshToken + Timeout/Retry intern
  if (res.status === 'ok')  { adoptCloudState(res.state, res.signature); return 'ok'; }
  if (res.status === 'new') { setCloudConfirmed(true); return 'new'; }
  return 'failed';
}

// DIE einzige Stelle, die window.SD aus der Cloud setzt — 1:1, kein Merge.
function adoptCloudState(state, signature) {
  window.SD = state;
  setCloudConfirmed(true);
  setKnownSig(signature);   // bekannte Cloud-Signatur merken (für Minuten-Check)
  persist(window.SD);
  syncMirrorFromActiveDeck();
}

function _finishLoginUI() {
  if (migrateStatKeys()) persist(window.SD);
  console.log('[handleLogin] SD bereit:', window.SD?.playerName, window.SD?.highscore);
  if (!window.SD?.playerName) showScreen('name-screen');
  else restoreLastScreen();
}

// Klarer Retry-Dialog statt stillem Leer-Zustand, wenn kein lokaler Stand vorliegt
// und die Cloud nicht erreichbar ist.
function _showConnectionRetry(user) {
  window.esConfirm({
    icon: '📡', title: 'Keine Verbindung',
    body: 'Dein Fortschritt konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.',
    ok: 'Erneut versuchen', cancel: 'Abmelden',
  }).then(retry => { if (retry) handleLogin(user); else authLogout(); });
}

// Resume: war die App > 2 Min im Hintergrund (Timing in main.js), beim Zurückkommen
// hart neu laden — nur auf Menü-Ebene (nie im Spiel/Scan/Edit). Skeleton während Load.
let _resumeInFlight = false;
export async function onAppResume() {
  if (!window.currentUser || _loginInFlight || _resumeInFlight) return;
  if (_currentScreen !== 'menu-screen') return;
  _resumeInFlight = true;
  try {
    showMenuSkeleton();
    const r = await loadFromCloud();
    if (r === 'new') { showScreen('name-screen'); return; }
    if (_currentScreen === 'menu-screen') showMenu();   // mit echten Daten neu rendern
  } finally {
    _resumeInFlight = false;
  }
}

// Skeleton-Menü (Instagram-Stil): Menü-Shell mit grauen Platzhalter-Kacheln während
// des harten Loads. Nach dem Load ersetzt showMenu() das durch echte Daten.
function _ensureSkeletonStyle() {
  if (document.getElementById('es-skel-style')) return;
  const st = document.createElement('style');
  st.id = 'es-skel-style';
  st.textContent = '@keyframes es-pulse{0%,100%{opacity:.5}50%{opacity:.9}}'
    + '@keyframes es-spin{to{transform:rotate(360deg)}}'
    + '.es-skel{background:#e6ddf2;border-radius:16px;animation:es-pulse 1.1s ease-in-out infinite;}';
  (document.head || document.documentElement).appendChild(st);
}
function showMenuSkeleton() {
  _ensureSkeletonStyle();
  showScreen('menu-screen');
  const nm = document.getElementById('menu-player-name'); if (nm) nm.textContent = 'Lädt…';
  const hs = document.getElementById('menu-highscore');   if (hs) hs.textContent = '·';
  const tp = document.getElementById('menu-total');       if (tp) tp.textContent = '·';
  const ft = document.getElementById('menu-footer');      if (ft) ft.style.display = 'flex';
  const c = document.getElementById('decks-container');
  if (c) c.innerHTML =
    // kleiner, halbtransparenter Ladekreis über den Kacheln → „es passiert was".
    // Liegt IM decks-container → verschwindet automatisch, sobald renderDecks rendert.
    '<div style="display:flex;justify-content:center;padding:6px 0 14px;">'
    + '<span style="width:26px;height:26px;border:3px solid rgba(168,108,219,.25);'
    + 'border-top-color:var(--purple,#a86cdb);border-radius:50%;display:inline-block;'
    + 'animation:es-spin .7s linear infinite;"></span></div>'
    + '<div class="es-skel" style="height:54px;margin-bottom:12px;"></div>'.repeat(4);
}

// Minuten-Check: hat ein ANDERES Gerät die Cloud geändert? Wenn ja → deutlicher
// Reload-Hinweis (Variante b), den man bestätigen muss, um den aktuellen Stand zu
// laden — begrenzt den „last-write-wins"-Worst-Case auf ~1 Min. Nur im Menü, nur
// bei sichtbarer App, nicht während Laden/Resume. Read-only, kein Auto-Overwrite.
let _reloadPromptOpen = false;
export async function checkForRemoteChange() {
  if (!window.currentUser || _loginInFlight || _resumeInFlight || _reloadPromptOpen) return;
  if (document.hidden || _currentScreen !== 'menu-screen') return;
  let changed = false;
  try { changed = await cloudChangedRemotely(window.currentUser.id); } catch (e) {}
  if (!changed || _currentScreen !== 'menu-screen' || _reloadPromptOpen) return;
  _reloadPromptOpen = true;
  window.esAlert({
    icon: '🔄', title: 'Neuer Stand',
    body: 'Auf einem anderen Gerät wurde gespielt. Bitte neu laden, um den aktuellen Stand zu sehen.',
    ok: 'Neu laden',
  }).then(async () => {
    showMenuSkeleton();
    await loadFromCloud();
    if (_currentScreen === 'menu-screen') showMenu();
    _reloadPromptOpen = false;
  });
}

// Baustein 4: Nach Relaunch näher am letzten Ort landen. Menü immer als Basis
// initialisieren (Back-Navigation), dann ggf. Profil/Fortschritt darüberlegen.
function restoreLastScreen() {
  showMenu();
  let last = null;
  try { last = localStorage.getItem('es_last_screen'); } catch(e) {}
  if (last === 'profile-screen') showProfile();
  else if (last === 'stats-screen') showStats();
}

export function handleLogout() {
  window.currentUser = null;
  setCloudConfirmed(false);   // nächster Login muss den Cloud-Stand neu bestätigen
  clearStorage();             // entfernt auch es_sync_meta
  window.SD = freshData();
  syncMirrorFromActiveDeck();
  showScreen('auth-screen');
}
