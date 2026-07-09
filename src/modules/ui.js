// src/modules/ui.js
import { persist, freshData, clearStorage } from './storage.js';
import { effectivePct, isStatMastered, statKeyFor } from './stats.js';
import { syncMirrorFromActiveDeck, deckProgress, presetProgressPct, renderDecks, migrateStatKeys, migrateDeckModes, deckMode, activeDeckIdForMode } from './decks.js';
import { getPresetCategories } from './vocab.js';
import { releaseMicStream, stopVisualizer, voskStop, speakWord } from './speech.js';
import { signIn, signUp, signOut, resendConfirmation, requestPasswordReset, updatePassword, signInWithGoogle } from './auth.js';
import { cloudLoad, cloudReset, saveDeck, saveWordStats, saveExam, markDirty, flushPendingSync, setCloudConfirmed, getPendingCount, setKnownSig, cloudChangedRemotely, deleteCloudPresetStats } from './sync.js';
import { commitDirty } from './dialog.js';
import { uvMap, uvLernstand, constellationWords, FORGE_DISC } from './irregular-game.js';
import { renderAvatarInto, renderCharacter, commitAvatar, resetCharacterFeature } from './avatar.js';
import { IRREGULAR_PRESET_ID, uvAvailableVerbs, CONSTELLATION_SIZE, cefrOf, forgeObject, FORGE_OBJECTS } from './irregular-verbs.js';
import { objectPerkText } from './campaign-equipment.js';
import { renderFriendsSection, refreshFriendBadge, friendProgress, subscribeFriendRealtime, unsubscribeFriendRealtime } from './friends.js';
import { renderCampaign, updateTalerBadge, refreshClaimedTaler } from './campaign.js';

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
  // Freund-Fortschritt zeigt fremde Daten über einen temporären window.SD-Tausch.
  // Verlässt man die Fortschritt-Seite auf IRGENDEINEM Weg (auch Hardware-Zurück),
  // hier den eigenen Stand zurückholen — sonst rendert/persistiert das Menü fremde Daten.
  if (_statsFriendMode && id !== 'stats-screen') {
    _statsFriendMode = false;
    if (_friendSDBackup) { window.SD = _friendSDBackup; _friendSDBackup = null; try { syncMirrorFromActiveDeck(); } catch (e) {} }
  }
  // Mic/Audio-Session freigeben wenn Spieler den Game-Screen verlässt (z.B. ← Zurück)
  if (id !== 'game-screen' && document.body.classList.contains('in-game')) {
    try { voskStop(); } catch(e) {}
    try { stopVisualizer(); } catch(e) {}
  }
  ['loading-screen','apikey-screen','name-screen','menu-screen','game-screen','end-screen','stats-screen','profile-screen','character-screen','scan-screen','review-screen','auth-screen','email-confirm-screen','password-reset-screen','password-reset-sent-screen','new-password-screen'].forEach(s => {
    const el = document.getElementById(s); if (el) el.style.display = 'none';
  });
  const el = document.getElementById(id);
  el.style.display = ['loading-screen','menu-screen','game-screen','stats-screen','profile-screen','character-screen','scan-screen','review-screen'].includes(id) ? 'flex' : 'block';
  window.scrollTo(0, 0);
  el.scrollTop = 0;
  if (id === 'game-screen') document.body.classList.add('in-game');
  else document.body.classList.remove('in-game');
  // Schnell-Dark-Mode nur auf Menü/Deck-nahen Screens — Profil & Fortschritt bleiben hell.
  const _noDark = id === 'profile-screen' || id === 'stats-screen';
  document.body.classList.toggle('schnell-active', !!window.isSchnellModus && !_noDark);
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
// Freund-Fortschritt: window.SD wird temporär durch den Stand des Freundes ersetzt.
let _statsFriendMode = false;
let _friendSDBackup = null;
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
  // Erst-Login: direkt in die Charakter-Anpassung (Onboarding-Variante).
  showCharacterOnboarding();
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
  // Dark-Variante des Haupt-Switches spiegelt den Schnell-Zustand des ANGEZEIGTEN
  // Modus. Optik liegt komplett im CSS (.mode-toggle/.mode-btn + .dark/.active).
  const dark = !!(window.schnellByMode && window.schnellByMode[mode]);
  const toggle = document.getElementById('mode-toggle');
  if (toggle) toggle.classList.toggle('dark', dark);
  ['free', 'student', 'campaign'].forEach(m => {
    const btn = document.getElementById('mode-btn-' + m);
    if (btn) btn.classList.toggle('active', m === mode);
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
  if (mode === 'free') { renderProbetestSection(); renderDecks('free'); }
  else if (mode === 'student') renderStudentMode();
  else if (mode === 'campaign') renderCampaign();
  // Schnell-Zustand DIESES Modus spiegeln (isSchnellModus + Dark-Mode + Buttons).
  if (window.syncSchnellForMode) window.syncSchnellForMode(mode);
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
  window.SD.activeMode = mode;
  _applyModeActiveDeck(mode);   // aktives Deck des Modus in den Spiegel
  persist(window.SD);
  renderModeContent(mode);   // sofort rendern (responsiv)
  if (window.currentUser) { markDirty('profile'); await commitDirty(); }
}

// ── Unregelmäßige: nur noch die Schmiede (Gestaltwandler) ──
function renderStudentMode() {
  const uv = document.getElementById('student-uv');
  if (uv) uv.style.display = 'block';
  renderStudentUV();
}

// ── Probetest: ephemerer Misch-Test über bis zu 2 Vokabelsammlungen ──
// Baut window.VOCAB aus der Vereinigung der gewählten Decks, ohne aktives Deck
// (→ kein lastExam/Sync), und startet eine Prüfungsrunde (mixed_vocab).
export function startProbetest(deckIds) {
  const SD = window.SD;
  const ids = (deckIds || []).filter(id => SD.decks[id]).slice(0, 2);
  if (!ids.length) return;
  const seen = new Set();
  const union = [];
  for (const id of ids) {
    for (const v of (SD.decks[id].vocab || [])) {
      const k = (v.de || '').trim().toLowerCase() + '|' + (v.en || '').trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k); union.push(v);
    }
  }
  if (!union.length) {
    window.esAlert({ icon: '📭', title: 'Keine Wörter', body: 'Die gewählten Sammlungen enthalten keine Vokabeln.' });
    return;
  }
  window._probetestDecks = ids.map(id => ({ name: SD.decks[id].name, count: (SD.decks[id].vocab || []).length }));
  window.isUV = false;
  window.isProbetest = true;
  SD.activeDeckId = null;   // kein Deck → Prüfung läuft ephemer (kein lastExam/Sync)
  if (typeof window.VOCAB !== 'undefined') {
    window.VOCAB.length = 0;
    for (const v of union) window.VOCAB.push(v);
  }
  window.startGame('mixed_vocab');
}

// Aufklappbare Probetest-Sektion im Vokabeln-Tab: Header (tippen = auf/zu),
// darunter „Neuer Probetest" + Verlauf der durchgeführten Tests.
let _probetestExpanded = false;
export function toggleProbetestHistory() {
  _probetestExpanded = !_probetestExpanded;
  renderProbetestSection();
}

// Ein Verlaufseintrag als Karte (geteilt: Vokabeln-Tab + Fortschritt-Seite).
function _probetestEntryHtml(t) {
  const names = (t.decks || []).map(d => window.escHtml(d.name || '')).join(' + ') || '—';
  const dateStr = new Date(t.date || Date.now()).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const gradeColor = t.grade <= 2 ? '#2a7a35' : (t.grade <= 4 ? '#cc8800' : '#c0392b');
  return '<div style="background:#fff;border-radius:14px;padding:12px 14px;margin-bottom:8px;box-shadow:var(--shadow);">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">'
    + '<span style="flex:1;min-width:0;font-family:\'Fredoka One\',cursive;font-size:.95rem;color:#444;">' + names + '</span>'
    + '<span style="font-family:\'Fredoka One\',cursive;font-size:1.1rem;color:' + gradeColor + ';white-space:nowrap;">Note ' + t.grade + '</span></div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.78rem;color:#777;font-weight:700;">'
    + '<span>📊 ' + t.percent + '%</span>'
    + '<span>✅ ' + t.correct + '/' + t.questions + ' richtig</span>'
    + '<span>📅 ' + dateStr + '</span></div></div>';
}

// Probetest-Verlauf für die Fortschritt-Seite (nur Anzeige, kein Start-Button).
function _probetestBlock() {
  const hist = Array.isArray(window.SD?.probetests) ? window.SD.probetests : [];
  if (!hist.length) return '<div style="font-size:.82rem;color:#999;text-align:center;padding:12px;">Noch keine Probetests durchgeführt.</div>';
  return hist.map(_probetestEntryHtml).join('');
}

export function renderProbetestSection() {
  const el = document.getElementById('probetest-section');
  if (!el) return;
  const hist = Array.isArray(window.SD?.probetests) ? window.SD.probetests : [];
  // Leerzustand (neues Konto: keine Sammlung, kein Verlauf) → Sektion ausblenden,
  // damit im Vokabeln-Tab nur die Start-Auswahl steht.
  const hasFreeDecks = Object.values(window.SD?.decks || {}).some(d => deckMode(d) === 'free');
  if (!hasFreeDecks && !hist.length) { el.innerHTML = ''; return; }
  const open = _probetestExpanded;
  const sub = hist.length
    ? hist.length + ' Test' + (hist.length === 1 ? '' : 's') + ' · zum Aufklappen tippen'
    : 'Gemischte Prüfung aus bis zu 2 Sammlungen';
  // Gleiche Karten-Sprache wie die Deck-Karten (weiß, weicher Schatten, Chevron).
  // Toggle liegt NUR auf dem Kopf — Klicks im aufgeklappten Bereich (Start-Button,
  // Verlauf) dürfen die Karte nicht wieder zuklappen.
  let html =
    '<div class="deck-card' + (open ? ' expanded' : '') + '">'
    + '<div class="deck-header" onclick="toggleProbetestHistory()" style="cursor:pointer;">'
    + '<div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#e8f8eb,#d2f2d8);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">🎲</div>'
    + '<div class="deck-info"><div class="deck-name">Probetest</div>'
    + '<div class="deck-meta"><span>' + sub + '</span></div></div>'
    + '<div class="deck-chevron"' + (open ? ' style="transform:rotate(180deg);"' : '') + '>▼</div>'
    + '</div>';
  if (open) {
    html += '<div style="padding:0 14px 14px;">'
      + '<button onclick="openProbetestPicker()" class="big-btn green center" style="width:100%;margin-bottom:12px;"><span class="icon-btn">➕</span><span>Neuen Probetest starten</span></button>';
    if (!hist.length) {
      html += '<div style="text-align:center;color:#8a83a5;font-size:.82rem;padding:6px 0 2px;font-weight:700;">Noch keine Tests durchgeführt.</div>';
    } else {
      html += hist.map(_probetestEntryHtml).join('');
    }
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// Auswahl-Popup: bis zu 2 Sammlungen ankreuzen, dann „Start".
export function openProbetestPicker() {
  const SD = window.SD;
  const decks = Object.keys(SD.decks || {})
    .filter(id => deckMode(SD.decks[id]) === 'free' && (SD.decks[id].vocab || []).length > 0)
    .map(id => ({ id, name: SD.decks[id].name, n: SD.decks[id].vocab.length }));
  if (!decks.length) {
    window.esAlert({ icon: '📚', title: 'Noch keine Sammlungen',
      body: 'Für einen Probetest brauchst du mindestens eine Vokabelsammlung mit Wörtern.\n\nLeg unten unter „Vokabelsammlungen" eine Sammlung an und füge Wörter hinzu — dann kannst du sie hier für einen Test auswählen.' });
    return;
  }
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  const card = document.createElement('div');
  card.style.cssText = "background:#fff;border-radius:20px;padding:24px 20px;max-width:360px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.2);max-height:85vh;display:flex;flex-direction:column;";
  card.innerHTML =
    '<div style="font-size:2.2rem;text-align:center;margin-bottom:4px;">🎲</div>'
    + '<div style="font-family:\'Fredoka One\',cursive;font-size:1.2rem;color:var(--purple);text-align:center;margin-bottom:6px;">Probetest</div>'
    + '<p style="font-size:.85rem;color:#777;text-align:center;margin:0 0 14px;line-height:1.5;">Bis zu 2 Sammlungen wählen — gemischte Prüfung, ohne Speichern.</p>';
  const list = document.createElement('div');
  list.style.cssText = 'overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:16px;';
  const selected = new Set();

  const startBtn = document.createElement('button');
  startBtn.style.cssText = "font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 22px;border:none;border-radius:50px;cursor:pointer;background:linear-gradient(135deg,#5bc24a,#7ed957);color:#fff;box-shadow:0 4px 0 #3a9b45;";
  startBtn.textContent = 'Start';

  function refresh() {
    list.querySelectorAll('button').forEach(r => {
      const on = selected.has(r._deckId);
      const dim = !on && selected.size >= 2;
      r.style.borderColor = on ? 'var(--purple)' : '#eee';
      r.style.background  = on ? '#f6efff' : '#fafafa';
      r.style.opacity     = dim ? '.45' : '1';
      const ck = r.querySelector('.pt-check');
      ck.style.background  = on ? 'var(--purple)' : '#fff';
      ck.style.borderColor = on ? 'var(--purple)' : '#ccc';
      ck.textContent = on ? '✓' : '';
    });
    const none = selected.size === 0;
    startBtn.disabled = none;
    startBtn.style.opacity = none ? '.5' : '1';
    startBtn.style.cursor  = none ? 'default' : 'pointer';
  }

  decks.forEach(d => {
    const row = document.createElement('button');
    row.type = 'button';
    row._deckId = d.id;
    row.style.cssText = "display:flex;align-items:center;gap:11px;padding:12px 14px;border:2px solid #eee;border-radius:12px;background:#fafafa;cursor:pointer;font-family:'Nunito',sans-serif;text-align:left;transition:all .12s;";
    row.innerHTML =
      '<span class="pt-check" style="width:22px;height:22px;border-radius:6px;border:2px solid #ccc;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.85rem;color:#fff;"></span>'
      + '<span style="flex:1;min-width:0;"><span style="font-weight:700;color:#444;">' + window.escHtml(d.name) + '</span><br>'
      + '<span style="font-size:.75rem;color:#999;">📝 ' + d.n + ' Wörter</span></span>';
    row.addEventListener('click', () => {
      if (selected.has(d.id)) selected.delete(d.id);
      else { if (selected.size >= 2) return; selected.add(d.id); }
      refresh();
    });
    list.appendChild(row);
  });
  card.appendChild(list);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;';
  const cancel = document.createElement('button');
  cancel.style.cssText = "font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 22px;border:none;border-radius:50px;cursor:pointer;background:#eee;color:#333;";
  cancel.textContent = 'Abbrechen';
  cancel.addEventListener('click', () => overlay.remove());
  startBtn.addEventListener('click', () => {
    if (!selected.size) return;
    overlay.remove();
    startProbetest([...selected]);
  });
  btnRow.appendChild(cancel);
  btnRow.appendChild(startBtn);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  (document.body || document.documentElement).appendChild(overlay);
  refresh();
}

// UV-Tab (Gestaltwandler): Sternenpfad. Ein nach unten scrollbarer Nachthimmel;
// jedes Sternbild = gezeichnetes 6-Punkt-Muster (5 spielbare Disziplin-Sterne +
// 1 Komplett-Leuchtstern). Sterne leuchten golden auf, wenn gemeistert; der nächste
// spielbare pulsiert in seiner Disziplin-Farbe und wird angetippt (startConstellationStar).
//
// Echte Silhouetten. Die 5 Disziplin-Sterne sind so auf die Form-Ketten verteilt,
// dass Simple Past (Index 0→2→4) und Past Participle (1→3) je einer zusammenhängenden
// Linie des Bildes FOLGEN — keine Sterne werden diagonal übersprungen. Index 5 =
// Komplett-Stern. Jedes Muster hat daher die Kanten 0-2,2-4 (Past) und 1-3 (PP) plus
// die Kanten, die die Silhouette schließen. viewBox 0..100 × 0..72.
const CST_PATTERNS = [
  // Kleiner Wagen: Kasten (bl-tl-tr-br) + Deichsel zum Komplett-Stern.
  { pts: [[38,46],[56,44],[38,30],[74,34],[56,28],[90,20]], edges: [[0,2],[2,4],[4,1],[1,0],[1,3],[3,5]] },
  // Großer Wagen: größerer Kasten + Deichsel.
  { pts: [[16,44],[40,42],[16,28],[62,34],[40,26],[92,24]], edges: [[0,2],[2,4],[4,1],[1,0],[1,3],[3,5]] },
  // Kassiopeia: 5-Sterne-W — linke Hälfte Past, rechte Hälfte PP.
  { pts: [[12,28],[64,48],[28,48],[80,30],[46,28],[94,22]], edges: [[0,2],[2,4],[4,1],[1,3],[3,5]] },
  // Orion: linke Linie (Schulter-Gürtel-Fuß) Past, rechte Seite PP, Gürtel über den
  // Komplett-Stern in der Mitte.
  { pts: [[28,16],[72,16],[40,40],[70,60],[34,62],[54,42]], edges: [[0,2],[2,4],[1,3],[2,5],[5,1],[5,3]] },
  // Schwan (Nordkreuz): senkrechte Achse Past, Flügel PP, Komplett-Stern unten.
  { pts: [[50,10],[26,42],[50,28],[74,42],[50,44],[50,66]], edges: [[0,2],[2,4],[4,5],[1,4],[4,3]] },
  // Adler: Flügel-Chevron — linker Flügel Past, rechter Flügel PP, Körper = Komplett.
  { pts: [[20,42],[64,28],[36,28],[80,42],[50,18],[50,40]], edges: [[0,2],[2,4],[4,1],[1,3],[4,5]] },
  // Leier: Vega oben + Harfe — linke Seite Past, rechte PP, Komplett-Stern unten.
  { pts: [[44,12],[64,32],[28,32],[68,54],[36,54],[50,60]], edges: [[0,2],[2,4],[0,1],[1,3],[4,5],[5,3]] },
  // Cluster: Fünfeck-Ring mit Komplett-Stern im Zentrum — rechter Bogen Past, linker PP.
  { pts: [[50,12],[32,56],[74,28],[26,28],[68,56],[50,40]], edges: [[0,2],[2,4],[4,1],[1,3],[3,0],[0,5],[5,1]] },
];
function _cstPattern(idx) { return CST_PATTERNS[idx % CST_PATTERNS.length]; }

// Form-Themen: das Muster färbt sich um, je nachdem ob Simple Past oder Past
// Participle angezeigt wird (gleiche Farbsprache wie überall: Past = bernstein ⏱,
// PP = grün ✓).
const FORM_THEME = {
  past: { key: 'past', label: '⏱ Simple Past' },
  pp:   { key: 'pp',   label: '✓ Past Participle' },
};

// Sternbild für EINE Form (past|pp): die 3 Disziplin-Sterne dieser Form sind
// farbig + tippbar (auch schon gemeisterte → Wiederholung), die 3 Sterne der
// anderen Form sind blasse Geister-Punkte, der Komplett-Stern leuchtet golden,
// sobald alle sechs Disziplinen sitzen. Tippen wird zentral im Track behandelt
// (data-play), damit ein Wisch nicht versehentlich eine Runde startet.
// Fortschritts-Bogen um einen noch nicht fertigen Stern: dünner Track + farbiger
// Bogen, der den Anteil gemeisterter Wörter dieser Disziplin zeigt (oben startend).
function _progArc(x, y, pct, which) {
  const r = 6.3, circ = 2 * Math.PI * r;
  const len = Math.max(0.02, Math.min(1, pct)) * circ;
  return `<circle class="cst-prog-track" cx="${x}" cy="${y}" r="${r}" fill="none"/>`
    + `<circle class="cst-prog ${which}" cx="${x}" cy="${y}" r="${r}" fill="none"`
    + ` stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" transform="rotate(-90 ${x} ${y})"/>`;
}

function _cstFormSvg(m, which) {
  const pat = _cstPattern(m.c.idx), st = m.stars;
  const lines = pat.edges.map(([a, b]) => {
    const lit = st[a].lit && st[b].lit;
    const [x1, y1] = pat.pts[a], [x2, y2] = pat.pts[b];
    return `<line class="cst-line${lit ? ' lit' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  const stars = st.map((s, i) => {
    const [x, y] = pat.pts[i];
    if (s.done) {   // Komplett-Stern (beide Formen)
      return `<g class="cst-star complete${s.lit ? ' lit' : ''}">`
        + `<circle class="halo" cx="${x}" cy="${y}" r="8"/>`
        + `<circle class="core" cx="${x}" cy="${y}" r="4.4"/></g>`;
    }
    if (s.which !== which) {   // Sterne der anderen Form: blasser Geister-Punkt
      return `<g class="cst-star ghost"><circle class="core" cx="${x}" cy="${y}" r="2"/></g>`;
    }
    let cls = 'cst-star ' + which, play = '';
    if (s.lit)           { cls += ' lit';    play = `${m.c.idx}:${s.i}`; }
    else if (s.unlocked) { cls += ' play';   play = `${m.c.idx}:${s.i}`; }
    else                 { cls += ' locked'; }
    const on = play ? ` data-play="${play}"` : '';
    const prog = s.prog || { mastered: 0, total: 0 };
    const pct = prog.total ? prog.mastered / prog.total : 0;
    return `<g class="${cls}"${on}>`
      + `<circle class="halo" cx="${x}" cy="${y}" r="7.5"/>`
      + (!s.lit && pct > 0 ? _progArc(x, y, pct, which) : '')
      + `<circle class="ring" cx="${x}" cy="${y}" r="5.2"/>`
      + `<circle class="core" cx="${x}" cy="${y}" r="3.8"/>`
      + (s.lit ? `<text class="cst-chk" x="${x + 5.4}" y="${y - 4.6}" text-anchor="middle" dominant-baseline="central">✓</text>` : '')
      + `</g>`;
  }).join('');
  return `<svg class="cst-svg ${which}" viewBox="0 0 100 72" preserveAspectRatio="xMidYMid meet">${lines}${stars}</svg>`;
}

// Statuszeile unter einer Form-Seite: Sperre, „komplett" oder nächste Disziplin.
function _formFoot(m, which) {
  const stars = m.stars.filter((s) => s.which === which);
  const open = stars.some((s) => s.unlocked || s.lit);
  if (!open) return `<span class="foot-lock">🔒 erst das Sternbild davor</span>`;
  if (stars.every((s) => s.lit))
    return `<span class="foot-done">✓ Form komplett${m.last ? '' : ' · 🔓 nächstes Sternbild frei'}</span>`;
  const next = stars.find((s) => s.unlocked && !s.lit);
  if (!next) return '';
  const pct = next.prog && next.prog.total ? Math.round((next.prog.mastered / next.prog.total) * 100) : 0;
  return `${next.icon} ${next.name} · <b>${pct}%</b>`;
}

// Past/PP-Slider: das ganze Sternbild slidet zwischen Simple Past und Past
// Participle und färbt sich um. Auf jedem freigespielten Sternbild verfügbar.
function _cstSlider(m) {
  const idx = m.c.idx;
  const page = (which) =>
    `<div class="cst-page">${_cstFormSvg(m, which)}<div class="cst-page-foot">${_formFoot(m, which)}</div></div>`;
  // Aktuelle Form als Label direkt unter dem Namen (nur die gerade gezeigte) und
  // antippbare Punkte unten zum Wechseln. Beides aktualisiert _applyTrack beim
  // Sliden. Start: Simple Past (Slide-Index 1).
  return `<div class="cst-slider-wrap">
    <div class="cst-form-now past">${FORM_THEME.past.label}</div>
    <div class="cst-slider">
      <button class="cst-arrow" onclick="uvSlide(${idx},-1)" aria-label="andere Form">‹</button>
      <div class="cst-slider-view"><div class="cst-track" data-cst="${idx}" data-idx="1">
        ${page('pp')}${page('past')}${page('pp')}${page('past')}
      </div></div>
      <button class="cst-arrow" onclick="uvSlide(${idx},1)" aria-label="andere Form">›</button>
    </div>
    <div class="cst-dots">
      <button class="uv-dot active" onclick="uvSetForm(${idx},'past')" aria-label="Simple Past"></button>
      <button class="uv-dot" onclick="uvSetForm(${idx},'pp')" aria-label="Past Participle"></button>
    </div>
  </div>`;
}

function _cstCaption(m) {
  if (m.complete) return '🌟 Sternbild komplett';
  if (!m.unlocked) return '🔒 erst eine Form im Sternbild davor schaffen';
  const next = m.stars.find(s => s.unlocked && !s.lit && !s.done);
  if (!next) return '';
  return `nächster: ${next.icon} ${next.name} · ${next.form}`;
}

// Pro-Wort-Liste (Rückseite jeder Flip-Karte): Fortschritt getrennt nach
// Simple Past (⏱ x/3) und Past Participle (✓ x/3).
function _cstWords(m) {
  const words = constellationWords(m.c);
  const chips = words.map(w => {
    const pd = w.past.mastered >= w.past.total, ppd = w.pp.mastered >= w.pp.total;
    return `<span class="cst-word"><b>${window.escHtml(w.en)}</b>` +
      `<span class="w-form past${pd ? ' done' : ''}">⏱ ${w.past.mastered}/${w.past.total}</span>` +
      `<span class="w-form pp${ppd ? ' done' : ''}">✓ ${w.pp.mastered}/${w.pp.total}</span></span>`;
  }).join('');
  return `<div class="cst-words">${chips}</div>`;
}

// Flip-Karte: Vorderseite = Sternbild als Past/PP-Slider, Rückseite = Wörter mit
// Fortschritt. Jede Karte ist umdrehbar (auch gesperrte, zum Anschauen). Jedes
// freigespielte Sternbild hat den Slider (auch nicht-aktive), gesperrte zeigen
// nur das ausgegraute Muster.
function _cstBlock(m, isActive) {
  const col = m.complete ? '#ffd45e' : (m.unlocked ? '#fff' : '#8a82a8');
  // Aktiv setzen wie bei Decks: rein kosmetisch (Hervorhebung), das Spielen geht
  // jetzt auf jedem freigespielten Sternbild über den Slider.
  const activeCtrl = !m.unlocked ? ''
    : (isActive ? '<div class="cst-active-tag">● Aktiv</div>'
                : `<button class="cst-active-btn" onclick="setUvActive(${m.c.idx})">▶ Aktiv setzen</button>`);
  const body = m.unlocked
    ? _cstSlider(m)
    : `${_cstFormSvg(m, 'past')}<div class="cst-cap">${_cstCaption(m)}</div>`;
  const front = `<div class="cst-face cst-front">
    <div class="cst-name" style="color:${col};">${m.complete ? '🌟 ' : ''}${m.c.name} <span class="cst-cefr">${m.c.cefr}</span></div>
    ${body}
    ${activeCtrl}
    <button class="cst-flip-btn" onclick="uvFlip(this)">📖 Wörter</button>
  </div>`;
  const back = `<div class="cst-face cst-back">
    <div class="cst-back-title">${m.c.name} · Wörter</div>
    ${_cstWords(m)}
    <button class="cst-flip-btn ghost" onclick="uvFlip(this)">↩ zurück</button>
  </div>`;
  return `<div class="cst-flip cst-block${isActive ? ' current' : ''}${m.unlocked ? '' : ' locked'}">
    <div class="cst-flip-inner">${front}${back}</div>
  </div>`;
}


// Setzt den gesamten UV-Fortschritt zurück (alle Verb-Stats des irregular-Presets):
// lokal sofort, Cloud per deleteCloudPresetStats (kein Retry — wie resetDeckProgress).
async function _resetUvProgress() {
  const gps = window.SD && window.SD.globalPresetStats;
  const keys = (gps && gps.wordStats)
    ? Object.keys(gps.wordStats).filter((k) => k.includes('|' + IRREGULAR_PRESET_ID))
    : [];
  keys.forEach((k) => { delete gps.wordStats[k]; });
  if (gps && gps.categoryProgress) delete gps.categoryProgress[IRREGULAR_PRESET_ID];
  if (window.currentUser && keys.length) {
    try { await deleteCloudPresetStats(keys, [IRREGULAR_PRESET_ID], window.currentUser.id); }
    catch (e) { console.error('[uvReset] Cloud-Delete fehlgeschlagen:', e.message); }
  }
}

// Erstinitialisierung des Befüllen-Systems: GENAU EINMAL den alten UV-Fortschritt
// zurücksetzen und leer starten (SD.uvFills = []). Danach ist uvFills ein Array →
// Guard greift, kein erneuter Reset.
function _uvEnsureInit() {
  if (!window.SD || Array.isArray(window.SD.uvFills)) return;
  window.SD.uvFills = [];
  _resetUvProgress();                  // lokal sofort wirksam, Cloud async
  persist(window.SD);
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
}

// Ein Sternbild mit den gewählten Wörtern befüllen + speichern/syncen.
// Neuer Eintrag = {ens:[…], obj:'helm'} (Objekt-Wahl); alte Einträge (reine
// Arrays) bleiben gültig und behalten ihre Legacy-Waffen.
function _uvFill(ens, obj) {
  if (!window.SD || !Array.isArray(ens) || ens.length !== CONSTELLATION_SIZE) return;
  if (!Array.isArray(window.SD.uvFills)) window.SD.uvFills = [];
  window.SD.uvFills.push(obj ? { ens: ens.slice(), obj } : ens.slice());
  persist(window.SD);
  if (window.currentUser) { markDirty('profile'); commitDirty(); }
  renderStudentUV();
}

// Befüllen-Karte für das nächste, noch leere Sternbild.
function _cstFillCard() {
  const remaining = uvAvailableVerbs().length;
  return `<div class="cst-block cst-fill">
    <div class="cst-fill-star">✨</div>
    <div class="cst-fill-title">Neues Sternbild</div>
    <div class="cst-fill-sub">Wähle ${CONSTELLATION_SIZE} Wörter zum Üben · <b>${remaining}</b> noch frei</div>
    <button class="cst-fill-btn" onclick="uvOpenFill()">✨ Befüllen</button>
  </div>`;
}

// Popup „Neuer Auftrag" in ZWEI Schritten:
// 1) Objekt wählen (Waffe ODER Rüstungsteil, mit Vorteil-Info für die Kampagne)
// 2) genau 10 Wörter wählen — mit Zurück-Knopf zur Objekt-Wahl (Auswahl bleibt).
export function uvOpenFill() {
  const avail = uvAvailableVerbs();
  if (avail.length < CONSTELLATION_SIZE) return;
  const N = CONSTELLATION_SIZE;
  const overlay = document.createElement('div');
  overlay.className = 'uv-fill-overlay';
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  let chosenObj = null;
  const sel = new Set();

  function showObjectStep() {
    overlay.innerHTML = `<div class="uv-fill-card">
      <div class="uv-fill-head">
        <div class="uv-fill-title">⚒️ Was willst du schmieden?</div>
        <div class="uv-fill-hint">Entsteht in 🔩 Stahl & 🥇 Gold und hilft dir in der 🗺️ Kampagne.</div>
      </div>
      <div class="uv-fill-list">
        ${FORGE_OBJECTS.map((o) => `<button class="uv-obj-row${chosenObj === o.type ? ' sel' : ''}" data-obj="${o.type}">
          <span class="uv-obj-ic">${o.icon}</span>
          <span class="uv-obj-tx"><b>${o.name}</b><span class="uv-obj-perk">${objectPerkText(o)}</span></span>
          <span class="uv-obj-go">›</span>
        </button>`).join('')}
      </div>
      <div class="uv-fill-foot">
        <button class="uv-fill-cancel" id="uv-obj-cancel">Abbrechen</button>
      </div>
    </div>`;
    overlay.querySelector('#uv-obj-cancel').addEventListener('click', close);
    overlay.querySelectorAll('[data-obj]').forEach((btn) => {
      btn.addEventListener('click', () => { chosenObj = btn.dataset.obj; showWordStep(); });
    });
  }

  function showWordStep() {
    const ob = FORGE_OBJECTS.find((o) => o.type === chosenObj);
    overlay.innerHTML = `<div class="uv-fill-card">
      <div class="uv-fill-head">
        <div class="uv-fill-title">${ob ? ob.icon + ' ' + ob.name : '✨ Auftrag'} befüllen</div>
        <div class="uv-fill-hint">Wähle genau ${N} Wörter, die du üben willst.</div>
        <div class="uv-fill-count"><span id="uv-fill-n">${sel.size}</span>/${N}</div>
      </div>
      <div class="uv-fill-list">
        ${avail.map((v) => `<label class="uv-fill-row${sel.has(v.en) ? ' sel' : ''}" data-en="${window.escHtml(v.en)}">
          <input type="checkbox" class="uv-fill-cb"${sel.has(v.en) ? ' checked' : ''}/>
          <span class="uv-fill-de">${window.escHtml(v.de)}</span>
          <span class="uv-fill-en">${window.escHtml(v.en)}</span>
          <span class="uv-fill-cefr">${cefrOf(v)}</span>
        </label>`).join('')}
      </div>
      <div class="uv-fill-foot">
        <button class="uv-fill-cancel" id="uv-fill-back">← Objekt</button>
        <button class="uv-fill-ok" id="uv-fill-ok"${sel.size === N ? '' : ' disabled'}>Fertig</button>
      </div>
    </div>`;
    const nEl = overlay.querySelector('#uv-fill-n');
    const okBtn = overlay.querySelector('#uv-fill-ok');
    overlay.querySelector('#uv-fill-back').addEventListener('click', showObjectStep);
    overlay.querySelectorAll('.uv-fill-row').forEach((row) => {
      const cb = row.querySelector('.uv-fill-cb');
      const en = row.getAttribute('data-en');
      cb.addEventListener('change', () => {
        if (cb.checked && sel.size >= N) { cb.checked = false; return; }   // max N
        if (cb.checked) { sel.add(en); row.classList.add('sel'); }
        else { sel.delete(en); row.classList.remove('sel'); }
        nEl.textContent = String(sel.size);
        okBtn.disabled = sel.size !== N;
      });
    });
    okBtn.addEventListener('click', () => {
      if (sel.size !== N) return;
      close();
      _uvFill([...sel], chosenObj);
    });
  }

  showObjectStep();
}

// ── Schmiede (Gestaltwandler): ersetzt den Sternenpfad ──────────────────────
// Jede Gruppe = eine Schmiede-Station mit ZWEI Werkstücken desselben Typs:
// 🔩 Stahl = ⏱ Simple Past · 🥇 Gold = ✓ Past Participle. Die bestehende Engine
// (uvMap) liefert weiter die Disziplin-„Sterne" pro Form; sie werden hier nur als
// Schmiede-Schritte dargestellt: 🪨 Erz brechen (Erkennen) · 🔨 Hämmern (Schmieden)
// · 🔥 Härten (Rufen, nur Simple Past). Stat/Logik/Freischaltung UNVERÄNDERT.
// Optik bewusst schlicht (Platzhalter) — Feinschliff folgt in späterer Phase.
const FORGE_STEP = {
  vocab:     { icon: '🔍', name: 'Erkennen' },
  forms:     { icon: '🧩', name: 'Formen ordnen' },
  spelling:  { icon: '🔨', name: 'Schmieden' },
  letters:   { icon: '🔤', name: 'Buchstaben' },
  pronounce: { icon: '🗣️', name: 'Aussprache' },
};
const FORGE_MAT = {
  past: { label: '⏱ Simple Past', mat: 'Stahl' },
  pp:   { label: '✓ Past Participle', mat: 'Gold' },
};

// ── Waffen-Geometrie ─────────────────────────────────────────────────────────
// Jede Waffe = 5 SVG-Teile in Schmiede-Reihenfolge (unten→oben), passend zu den
// 5 Schritten der Form. `vb` = eng anliegende viewBox je Waffe, damit jede Form so
// GROSS wie möglich dargestellt wird (preserveAspectRatio meet füllt den Platz).
// Platzhalter-Silhouetten — du kannst die Pfade/vb durch echte Kunst ersetzen, die
// Zustands-Logik (built/next/ghost) trägt sich von selbst. Neue Typen: hier
// { vb, parts:[5] } ergänzen + Name in FORGE_OBJECTS.
const WEAPON_PARTS = {
  // 0 Knauf · 1 Griff · 2 Parier · 3 Klinge unten · 4 Klingenspitze
  schwert: { vb: '28 4 44 118', parts: [
    'M50 104 L58 112 L50 120 L42 112 Z',
    'M45 86 H55 V104 H45 Z',
    'M30 80 L36 76 H64 L70 80 L64 84 H36 Z',
    'M44 80 H56 L53 30 H47 Z',
    'M47 30 H53 L50 6 Z',
  ] },
  // Dolch: kürzer, breite Blattklinge
  dolch: { vb: '34 28 32 94', parts: [
    'M50 106 L57 113 L50 120 L43 113 Z',
    'M46 90 H54 V106 H46 Z',
    'M36 84 H64 V90 H36 Z',
    'M44 84 H56 L57 58 H43 Z',
    'M43 58 H57 L50 30 Z',
  ] },
  // Speer: langer Schaft (3) + Tülle + Blattspitze
  speer: { vb: '39 2 22 118', parts: [
    'M47 92 H53 V120 H47 Z',
    'M47 60 H53 V92 H47 Z',
    'M47 38 H53 V60 H47 Z',
    'M44 32 H56 L53 40 H47 Z',
    'M50 4 L59 26 L50 36 L41 26 Z',
  ] },
  // Streitaxt: Schaft (3) + Kopfkern + Doppelklinge
  axt: { vb: '20 32 60 90', parts: [
    'M47 92 H53 V120 H47 Z',
    'M47 60 H53 V92 H47 Z',
    'M47 36 H53 V60 H47 Z',
    'M40 34 H60 V54 H40 Z',
    'M40 34 L22 40 L22 50 L40 54 Z M60 34 L78 40 L78 50 L60 54 Z',
  ] },
  // Streithammer: Schaft (3) + Kopfkern + Kopfbacken
  hammer: { vb: '24 28 52 94', parts: [
    'M47 92 H53 V120 H47 Z',
    'M47 62 H53 V92 H47 Z',
    'M47 40 H53 V62 H47 Z',
    'M36 30 H64 V52 H36 Z',
    'M36 32 L26 36 V46 L36 50 Z M64 32 L74 36 V46 L64 50 Z',
  ] },
  // Zauberstab: Stab (3) + Fassung + Edelstein
  stab: { vb: '35 4 30 118', parts: [
    'M47 92 H53 V120 H47 Z',
    'M47 60 H53 V92 H47 Z',
    'M47 40 H53 V60 H47 Z',
    'M42 36 H58 L54 46 H46 Z',
    'M50 6 L63 24 L50 42 L37 24 Z',
  ] },
  // ── Rüstungsteile (Kampagnen-Ausrüstung) — Platzhalter-Silhouetten ──
  // Helm: Rand · linke Schale · rechte Schale · Visierschlitz · Kamm
  helm: { vb: '22 20 56 76', parts: [
    'M28 84 H72 V92 H28 Z',
    'M28 84 Q28 40 50 36 L50 84 Z',
    'M72 84 Q72 40 50 36 L50 84 Z',
    'M34 66 H66 V72 H34 Z',
    'M45 36 Q50 22 55 36 L55 42 H45 Z',
  ] },
  // Rüstung: Bauchplatte · linke Brust · rechte Brust · Schultern · Emblem
  ruestung: { vb: '20 32 60 72', parts: [
    'M34 84 H66 L62 100 H38 Z',
    'M30 48 L50 44 V84 H32 Z',
    'M70 48 L50 44 V84 H68 Z',
    'M24 46 L36 38 H64 L76 46 L70 54 H30 Z',
    'M50 56 L58 66 L50 78 L42 66 Z',
  ] },
  // Handschuhe: linke Stulpe · linke Hand · rechte Stulpe · rechte Hand · Knöchel
  handschuhe: { vb: '20 46 60 50', parts: [
    'M26 78 H44 V90 H26 Z',
    'M26 52 H44 V78 H26 Z',
    'M56 78 H74 V90 H56 Z',
    'M56 52 H74 V78 H56 Z',
    'M30 60 H40 V66 H30 Z M60 60 H70 V66 H60 Z',
  ] },
  // Stiefel: linker Fuß · linker Schaft · rechter Fuß · rechter Schaft · Borten
  stiefel: { vb: '18 36 64 62', parts: [
    'M24 80 H48 V92 H24 Z',
    'M28 42 H44 V80 H28 Z',
    'M52 80 H76 V92 H52 Z',
    'M56 42 H72 V80 H56 Z',
    'M28 42 H44 V48 H28 Z M56 42 H72 V48 H56 Z',
  ] },
  // Talisman: Kordel links · Kordel rechts · Fassung · Medaillon · Kernstein
  talisman: { vb: '26 14 48 86', parts: [
    'M50 18 Q30 26 34 50 L38 50 Q36 30 52 22 Z',
    'M50 18 Q70 26 66 50 L62 50 Q64 30 48 22 Z',
    'M44 50 H56 V58 H44 Z',
    'M50 56 L68 76 L50 96 L32 76 Z',
    'M50 66 L58 76 L50 86 L42 76 Z',
  ] },
  // Ring: Bandbogen unten · Band links · Band rechts · Fassung · Edelstein
  ring: { vb: '24 20 52 80', parts: [
    'M32 72 Q50 96 68 72 L62 68 Q50 84 38 68 Z',
    'M32 72 Q28 56 38 46 L44 52 Q36 60 38 68 Z',
    'M68 72 Q72 56 62 46 L56 52 Q64 60 62 68 Z',
    'M44 40 H56 L60 48 H40 Z',
    'M50 24 L60 38 L50 48 L40 38 Z',
  ] },
  // Gefährte: Körper · Kopf · Ohren · Schwanz · Augen
  gefaehrte: { vb: '20 22 62 68', parts: [
    'M34 62 Q50 50 66 62 Q70 82 50 86 Q30 82 34 62 Z',
    'M38 46 Q50 32 62 46 Q64 58 50 60 Q36 58 38 46 Z',
    'M40 40 L36 26 L48 36 Z M60 40 L64 26 L52 36 Z',
    'M66 70 Q80 66 78 52 L72 52 Q74 62 64 66 Z',
    'M44 48 h4 v4 h-4 Z M52 48 h4 v4 h-4 Z',
  ] },
};
WEAPON_PARTS._default = WEAPON_PARTS.schwert;

// Die Waffe als 5-teiliges SVG: gemeisterte Teile solide (built), das nächste zu
// schmiedende Teil pulsiert (next), der Rest ist transparent (ghost) — so erkennt
// man die Endform schon vorher. Teil-Index = Schritt-Reihenfolge (unten→oben).
function _forgeWeaponSvg(type, steps, nextI) {
  const w = WEAPON_PARTS[type] || WEAPON_PARTS._default;
  const paths = w.parts.map((d, i) => {
    const s = steps[i];
    const cls = (s && s.lit) ? 'wp built' : (i === nextI ? 'wp next' : 'wp ghost');
    return `<path class="${cls}" d="${d}"/>`;
  }).join('');
  return `<svg class="fw-weapon" viewBox="${w.vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${paths}</svg>`;
}

// Eine Waffe (Stahl-Past oder Gold-PP) groß als Mittelpunkt. KEINE Einzel-Schritte
// als Buttons — antippen startet eine gemischte Runde (startConstellationForm). Unter
// der Waffe ein Fortschrittsbalken für den AKTUELLEN Schritt (das gerade pulsierende
// Teil): Schritt-Name + % = Anteil der schon gemeisterten Verben dieses Schritts.
function _forgeItem(m, which) {
  const ob = forgeObject(m.c.idx, which), mt = FORGE_MAT[which];
  const steps = m.stars.filter((s) => s.which === which);
  const litN = steps.filter((s) => s.lit).length;
  const done = steps.length > 0 && litN === steps.length;
  const open = steps.some((s) => s.unlocked || s.lit);
  // Nächstes zu schmiedendes Teil = erster offener, noch nicht fertiger Schritt.
  const nextI = steps.findIndex((s) => s.unlocked && !s.lit);
  const state = done ? 'done' : (open ? 'active' : 'locked');
  const tap = open ? ` data-forge="${m.c.idx}:${which}"` : '';
  // Balken bezieht sich auf das aktuelle Teil: Disziplin-Name + % gemeisterter Verben.
  let label, pct, showPct = true;
  if (done) { label = `✓ ${ob.name} fertig`; pct = 100; showPct = false; }
  else if (nextI >= 0) {
    const s = steps[nextI], fs = FORGE_DISC[s.discipline] || { icon: '•', name: s.discipline };
    pct = s.prog && s.prog.total ? Math.min(100, Math.round((s.prog.score / s.prog.total) * 100)) : 0;
    label = `${fs.icon} ${fs.name}`;
  } else { label = '🔒 erst die Station davor'; pct = 0; showPct = false; }
  return `<div class="forge-weapon-wrap">
    <div class="fw-name">${mt.mat}-${ob.name}</div>
    <div class="forge-weapon ${which} ${state}"${tap} data-stage="${litN}" data-steps="${steps.length}">
      ${_forgeWeaponSvg(ob.type, steps, nextI)}
    </div>
    <div class="fw-step ${state}">
      <div class="fw-step-top">
        <span class="fw-step-name">${label}</span>
        ${showPct ? `<span class="fw-step-pct">${pct}%</span>` : ''}
      </div>
      <div class="fw-bar"><div class="fw-bar-fill ${which}" style="width:${pct}%"></div></div>
    </div>
  </div>`;
}

// Wortliste einer Station (aufklappbar) — getrennt Stahl (⏱) / Gold (✓).
function _forgeWords(m) {
  const chips = constellationWords(m.c).map((w) => {
    const pd = w.past.mastered >= w.past.total, ppd = w.pp.mastered >= w.pp.total;
    return `<span class="forge-word"><b>${window.escHtml(w.en)}</b>`
      + `<span class="fw-p${pd ? ' done' : ''}">⏱ ${w.past.mastered}/${w.past.total}</span>`
      + `<span class="fw-g${ppd ? ' done' : ''}">✓ ${w.pp.mastered}/${w.pp.total}</span></span>`;
  }).join('');
  return `<details class="forge-words"><summary>📖 Wörter anzeigen</summary><div class="fw-grid">${chips}</div></details>`;
}

// Slider: eine Zeitform pro Ansicht (Stahl-Past ↔ Gold-PP), wischen/Punkte/Pfeile.
// Unendlich in beide Richtungen über einen 3-Seiten-Track [PP, Past, PP], der nach
// jedem Wechsel wieder zentriert für die neue Form aufgebaut wird (_forgeFillTrack).
function _forgeSlider(m) {
  const idx = m.c.idx;
  const page = (which) => `<div class="cst-page">${_forgeItem(m, which)}</div>`;
  return `<div class="cst-slider-wrap">
    <div class="cst-form-now past">${FORM_THEME.past.label}</div>
    <div class="cst-slider">
      <button class="cst-arrow" onclick="uvSlide(${idx},-1)" aria-label="andere Form">‹</button>
      <div class="cst-slider-view"><div class="cst-track" data-cst="${idx}" data-form="0" style="transform:translateX(-100%)">
        ${page('pp')}${page('past')}${page('pp')}
      </div></div>
      <button class="cst-arrow" onclick="uvSlide(${idx},1)" aria-label="andere Form">›</button>
    </div>
    <div class="cst-dots">
      <button class="uv-dot active" onclick="uvSetForm(${idx},'past')" aria-label="Simple Past"></button>
      <button class="uv-dot" onclick="uvSetForm(${idx},'pp')" aria-label="Past Participle"></button>
    </div>
  </div>`;
}

// Eine Schmiede-Station (= Gruppe): freigeschaltet → Slider zwischen Stahl-Past
// und Gold-PP; gesperrt → eine statische Vorschau. Plus Aktiv-Steuerung + Wörter.
function _forgeStation(m) {
  const body = m.unlocked ? _forgeSlider(m) : _forgeItem(m, 'past');
  return `<div class="forge-station${m.unlocked ? '' : ' locked'}${m.complete ? ' complete' : ''}">
    <div class="forge-head">
      <span class="forge-title">⚒️ Auftrag ${m.c.idx + 1}${m.complete ? ' 🌟' : ''}</span>
    </div>
    ${body}
    ${_forgeWords(m)}
  </div>`;
}

// Auftrags-Karte fürs nächste leere Werkstück — frei verfügbar (kein Freispielen
// nötig), solange genug freie Verben da sind. So lassen sich alle Stationen vorab
// befüllen.
function _forgeFillCard() {
  const remaining = uvAvailableVerbs().length;
  return `<div class="forge-station forge-fill">
    <div class="forge-fill-ic">✨</div>
    <div class="forge-fill-title">Neuer Schmiede-Auftrag</div>
    <div class="forge-fill-sub">Wähle ${CONSTELLATION_SIZE} Verben zum Schmieden · <b>${remaining}</b> noch frei</div>
    <button class="forge-fill-btn" onclick="uvOpenFill()">✨ Werkstoff wählen</button>
  </div>`;
}

function renderStudentUV() {
  const host = document.getElementById('student-uv');
  if (!host) return;
  _uvEnsureInit();                       // beim ersten Mal: UV-Reset + leer starten
  const map = uvMap();
  const parts = map.map((m) => _forgeStation(m));
  if (uvAvailableVerbs().length >= CONSTELLATION_SIZE) parts.push(_forgeFillCard());

  const L = uvLernstand();
  host.style.textAlign = 'center';
  host.style.padding = '0';
  host.innerHTML = `<div class="forge">
    <div class="forge-top">
      <button class="forge-info" onclick="uvInfo()" aria-label="Info">i</button>
      <div class="forge-emoji">⚒️</div>
      <div class="forge-h1">Die Schmiede</div>
      <div class="forge-stand">🛠️ ${L.complete}/${L.total} Stationen · 🔨 ${L.totalLit}/${L.maxLit} Schritte</div>
    </div>
    ${parts.join('')}
  </div>`;
  initUvSliders();   // Slider-Wisch + Tap-auf-Schritt (data-play → Runde) binden
}

// Flip-Karte umdrehen (Vorderseite Sternbild ↔ Rückseite Wörter).
export function uvFlip(btn) {
  const f = btn && btn.closest('.cst-flip');
  if (f) f.classList.toggle('flipped');
}

// Unendlich-Slider (2 Formen) ohne Klon-Kanten: der Track zeigt IMMER 3 Seiten
// [andere, aktuelle, andere] und ist auf die Mitte zentriert. Ein Wisch/Pfeil in
// JEDE Richtung wechselt zur anderen Form; danach wird der Track für die neue Form
// wieder zentriert aufgebaut → in beide Richtungen unbegrenzt, robust auch schnell.
function _trackW(track) { return track.parentElement.offsetWidth; }
function _curForm(track) { return (+track.dataset.form || 0); }   // 0 = Past, 1 = PP
function _formWhich(f) { return f === 0 ? 'past' : 'pp'; }

// Track für die AKTUELLE Form neu aufbauen (3 Seiten, zentriert) + Chrome.
function _forgeFillTrack(track) {
  const m = uvMap().find((x) => x.c.idx === +track.dataset.cst);
  if (!m) return;
  const cur = _curForm(track), page = (w) => `<div class="cst-page">${_forgeItem(m, w)}</div>`;
  track.innerHTML = page(_formWhich(cur ? 0 : 1)) + page(_formWhich(cur)) + page(_formWhich(cur ? 0 : 1));
  _centerTrack(track, false);
  _updateSliderChrome(track);
}

// Auf die Mittel-Seite setzen (anim=false ohne Übergang, für Erst-/Re-Layout).
function _centerTrack(track, anim) {
  const w = _trackW(track);
  track.style.transition = anim ? '' : 'none';
  track.style.transform = `translateX(${-w}px)`;
  if (!anim) { void track.offsetWidth; track.style.transition = ''; }
}

// Punkte + Überschrift SOFORT für eine bestimmte Form (0/1) setzen — unabhängig
// von der Animation, damit das Chrome super reaktiv ist.
function _showChrome(track, form) {
  const wrap = track.closest('.cst-slider-wrap'); if (!wrap) return;
  const isPast = form === 0;
  const now = wrap.querySelector('.cst-form-now');
  if (now) {
    now.textContent = (isPast ? FORM_THEME.past : FORM_THEME.pp).label;
    now.classList.toggle('past', isPast); now.classList.toggle('pp', !isPast);
  }
  wrap.querySelectorAll('.uv-dot').forEach((d, i) => d.classList.toggle('active', i === form));
}
function _updateSliderChrome(track) { _showChrome(track, _curForm(track)); }

// Form als Datenquelle setzen + Chrome sofort aktualisieren.
function _setForm(track, f) { track.dataset.form = String(f); _showChrome(track, f); }

// Snap abschließen: NUR zentriert neu aufbauen (die Form wurde schon beim Commit
// gesetzt). Bumpt _gen → veraltete Finalizer werden entwertet.
function _finalizeSnap(track) {
  if (!track._pending) return;
  track._pending = null;
  track._gen = (track._gen || 0) + 1;
  _forgeFillTrack(track);
}

// Zur Nachbarseite animieren; targetForm wird SOFORT gesetzt (Chrome reaktiv), die
// Track-Neuzentrierung folgt nach der Transition (transitionend + Timeout-Fallback).
function _snapToggle(track, targetPx, targetForm) {
  _setForm(track, targetForm);
  track.style.transition = '';
  track.style.transform = `translateX(${targetPx}px)`;
  track._pending = {};
  const gen = (track._gen = (track._gen || 0) + 1);
  const fin = () => { track.removeEventListener('transitionend', onEnd); if (track._gen === gen) _finalizeSnap(track); };
  const onEnd = (e) => { if (e.propertyName === 'transform') fin(); };
  track.addEventListener('transitionend', onEnd);
  setTimeout(fin, 520);
}

function _snapBack(track) {   // unter Schwelle: glatt zur Mitte zurück (kein Toggle)
  track.style.transition = '';
  track.style.transform = `translateX(${-_trackW(track)}px)`;
  _showChrome(track, _curForm(track));   // Chrome zurück auf die aktuelle Form
}

// Pfeil/Tap: in beide Richtungen zur anderen Form (es gibt nur zwei).
export function uvSlide(idx, dir) {
  const track = document.querySelector(`.cst-track[data-cst="${idx}"]`);
  if (!track) return;
  if (track._pending) _finalizeSnap(track);
  const target = _curForm(track) ? 0 : 1;
  _centerTrack(track, false); void track.offsetWidth;
  _snapToggle(track, dir > 0 ? -2 * _trackW(track) : 0, target);
}

// Punkt: direkt auf eine Form. Schon dort → nur zentrieren, sonst animiert wechseln.
export function uvSetForm(idx, which) {
  const track = document.querySelector(`.cst-track[data-cst="${idx}"]`);
  if (!track) return;
  const want = which === 'past' ? 0 : 1;
  if (track._pending) _finalizeSnap(track);
  if (_curForm(track) === want) { _centerTrack(track, false); return; }
  _centerTrack(track, false); void track.offsetWidth;
  _snapToggle(track, -2 * _trackW(track), want);
}

// Info-Popup (ⓘ oben): erklärt den Sternenpfad — ersetzt den Dauer-Erklärtext.
export function uvInfo() {
  window.esAlert?.({
    icon: '⚒️',
    title: 'Die Schmiede',
    body: 'Jede Station schmiedet zwei Waffen:\n'
      + '🔩 Stahl = ⏱ Simple Past · 🥇 Gold = ✓ Past Participle.\n\n'
      + 'Jede Waffe hat 5 Teile aus drei Disziplinen:\n'
      + '🔍 Erkennen · 🔨 Schmieden · 🪄 Verzaubern (Aussprache).\n'
      + 'Verzaubern kommt erst in den späteren Teilen — erst kennen & schreiben.\n\n'
      + 'Tippe die Waffe → das aktuelle Teil wird geschmiedet (Aufgaben kommen '
      + 'zufällig). Ist EINE Waffe fertig, geht die nächste Station auf.\n\n'
      + 'Wische zwischen den beiden Waffen. „📖 Wörter" zeigt die Verbliste.',
  });
}

// Jeder Slider bekommt Finger-Swipe + Tap. Tap und Wisch werden über die Strecke
// getrennt: ein echter Wisch (track._moved) startet keine Runde, ein Tap auf die
// Waffe ([data-forge]) schon. Gewischt wird immer von der Mitte (3-Seiten-Track).
function initUvSliders() {
  document.querySelectorAll('.cst-track').forEach((track) => {
    if (!track.dataset.form) track.dataset.form = '0';
    _centerTrack(track, false);
    _updateSliderChrome(track);
    let startX = null, dx = 0;
    track.addEventListener('pointerdown', (e) => {
      if (track._pending) _finalizeSnap(track);   // laufenden Snap sofort abschließen
      _centerTrack(track, false);
      startX = e.clientX; dx = 0; track._moved = false;
      track.style.transition = 'none';
      track.setPointerCapture?.(e.pointerId);
    });
    track.addEventListener('pointermove', (e) => {
      if (startX === null) return;
      dx = e.clientX - startX;
      const w = _trackW(track), cur = _curForm(track);
      track.style.transform = `translateX(${-w + dx}px)`;
      // Chrome live: ab der Snap-Schwelle schon die andere Form zeigen.
      _showChrome(track, (Math.abs(dx) > w * 0.18) ? (cur ? 0 : 1) : cur);
    });
    const end = () => {
      if (startX === null) return;
      const w = _trackW(track), cur = _curForm(track), other = cur ? 0 : 1;
      if (Math.abs(dx) > 6) track._moved = true;
      startX = null;
      if (dx < -w * 0.18) _snapToggle(track, -2 * w, other);   // nach links → andere Form
      else if (dx > w * 0.18) _snapToggle(track, 0, other);    // nach rechts → andere Form
      else _snapBack(track);                                   // zu kurz → zurück zur Mitte
      dx = 0;
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('click', (e) => {
      if (track._moved) { track._moved = false; return; }   // war ein Wisch
      // Ganze Waffe antippen → gemischte Form-Runde (alle 5 Modi zufällig).
      const f = e.target.closest('[data-forge]');
      if (f) {
        const [ci, which] = f.getAttribute('data-forge').split(':');
        window.startConstellationForm(Number(ci), which);
        return;
      }
      // Einzel-Schritt (Alt-Pfad, falls noch verwendet).
      const g = e.target.closest('[data-play]');
      if (!g) return;
      const [ci, si] = g.getAttribute('data-play').split(':').map(Number);
      window.startConstellationStar(ci, si);
    });
  });
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
  window.isUV = false;   // UV-Runde verlassen → window.VOCAB wird gleich neu gespiegelt
  window.isProbetest = false;   // Probetest beendet → wieder normale Wertung
  hideFeedback();
  showScreen('menu-screen');
  document.getElementById('menu-player-name').textContent = 'Hallo, ' + window.SD.playerName + '! 👋';
  renderAvatarInto('menu-avatar', window.SD, { headOnly: true });
  document.getElementById('menu-highscore').textContent = window.SD.highscore;
  document.getElementById('menu-total').textContent = window.SD.totalPoints;
  updateTalerBadge();                          // Taler sofort aus lokalem Stand
  refreshClaimedTaler().catch(() => {});       // 100%-Teilabschnitte nachzählen (retroaktiv)
  const ft = document.getElementById('menu-footer'); if (ft) ft.style.display = 'flex';
  const mode = window.SD.activeMode || 'free';
  _applyModeActiveDeck(mode);   // aktives Deck des Modus sicherstellen (nach Cloud-Load 1:1)
  renderModeContent(mode);      // rendert die Decks des aktiven Modus
  refreshFriendBadge();         // roter Anfrage-Zähler über dem Profilkopf
}

// ────────────────────────────────────────────────
//  PROFILE SCREEN
// ────────────────────────────────────────────────
export function showProfile() {
  showScreen('profile-screen');
  renderFriendsSection();   // FREUNDE-Sektion (Suche, Anfragen, Liste) füllen
  const SD = window.SD;
  renderAvatarInto('prof-avatar', SD, { headOnly: true });
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

// Charakter-Anpassung öffnen/schließen.
function _setCharOnboarding(on) {
  const ids = { 'char-back-btn': !on, 'char-heading': !on, 'char-name-row': !on, 'char-onboard-done': on };
  for (const [id, show] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  }
}
export function showCharacter() {
  _setCharOnboarding(false);   // normaler Weg: Überschrift, Name, Zurück
  resetCharacterFeature();
  showScreen('character-screen');
  renderCharacter();
}
// Erst-Login: Charakter-Anpassung ohne Überschrift/Name/Zurück, mit „Los geht's".
export function showCharacterOnboarding() {
  _setCharOnboarding(true);
  resetCharacterFeature();
  showScreen('character-screen');
  renderCharacter();
}
export function finishCharacterOnboarding() {
  commitAvatar();   // gesammelte Avatar-Änderungen in die Cloud schreiben
  _setCharOnboarding(false);
  showMenu();
}
export function closeCharacter() {
  commitAvatar();   // gesammelte Avatar-Änderungen in die Cloud schreiben
  showProfile();
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
    const charEl = document.getElementById('character-screen');
    const profEl = document.getElementById('profile-screen');
    if (charEl && charEl.style.display !== 'none') renderCharacter();
    else if (profEl && profEl.style.display !== 'none') showProfile();
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

// Fortschritt eines Freundes (schreibgeschützt): fremden Stand temporär als window.SD
// setzen und die normale Fortschritt-Seite rendern. showScreen holt den eigenen Stand
// beim Verlassen zurück (auch bei Hardware-Zurück). Zurück-Button → Profil.
export async function showFriendStats(friendId) {
  const state = await friendProgress(friendId);
  if (!state) { window.esAlert({ icon: '⚠️', title: 'Nicht verfügbar', body: 'Der Fortschritt konnte nicht geladen werden.' }); return; }
  _friendSDBackup = window.SD;
  _statsFriendMode = true;
  window.SD = _friendState(state);
  await showStats();
}
export function closeFriendStats() {
  // Rückgabe des eigenen Stands übernimmt showScreen (via _statsFriendMode-Guard).
  showProfile();
}
function _friendState(s) {
  return {
    _version: 4,
    playerName: s.playerName || 'Freund',
    highscore: s.highscore || 0,
    totalPoints: s.totalPoints || 0,
    avatar: s.avatar || null,
    activeMode: 'free',
    activeDeckId: null,
    decks: s.decks || {},
    uvFills: Array.isArray(s.uvFills) ? s.uvFills : null,
    categoryProgress: {
      vocab:       { played: 0, correct: 0, bestStreak: 0 },
      spelling:    { played: 0, correct: 0, bestStreak: 0 },
      pronounce:   { played: 0, correct: 0, bestStreak: 0 },
      mixed_vocab: { played: 0, correct: 0, bestStreak: 0 },
    },
    wordStats: {},
    globalPresetStats: (s.globalPresetStats && typeof s.globalPresetStats === 'object') ? s.globalPresetStats : { wordStats: {}, categoryProgress: {} },
    probetests: Array.isArray(s.probetests) ? s.probetests : [],
  };
}

export async function showStats() {
  showScreen('stats-screen');
  const SD = window.SD;
  // Zurück-Ziel + Titel je nach eigenem/Freund-Fortschritt.
  const backBtn = document.getElementById('stats-back-btn');
  const heading = document.getElementById('stats-heading');
  if (backBtn) backBtn.setAttribute('onclick', _statsFriendMode ? 'closeFriendStats()' : 'showMenu()');
  if (heading) heading.textContent = _statsFriendMode ? ('📊 ' + (SD.playerName || 'Freund')) : '📊 Fortschritt';
  const pn = document.getElementById('profile-name');
  const pm = document.getElementById('profile-meta');
  if (pn) pn.textContent = SD.playerName || 'Spieler';
  if (pm) pm.textContent = '🏆 Highscore: ' + SD.highscore + ' · ⭐ ' + SD.totalPoints + ' Pkt gesamt';

  const host = document.getElementById('profile-decks-summary');
  if (!host) return;
  const allDecks = Object.values(SD.decks || {});
  const freeDecks = allDecks.filter(d => deckMode(d) === 'free');

  host.innerHTML = '<div style="font-size:.82rem;color:#999;text-align:center;padding:10px;">Lade Fortschritt…</div>';

  // Vorlagen-Namen (async) — für die „Aktive Vorlagen"-Kacheln der Vokabeln.
  const categories = await getPresetCategories();
  const catById = Object.fromEntries((categories || []).map(c => [c.id, c]));

  // Reihenfolge wie im Hauptmenü-Toggle: Kampagne · Vokabeln · Unregelmäßige.
  const campSection = _statSection('🗺️ Kampagne',
    '<div style="font-size:.82rem;color:#999;text-align:center;padding:14px;">Kommt bald!</div>');

  const vokabelnSection = _statSection('📚 Vokabeln',
    _activePresetsBlock(freeDecks, catById) + _customWordsBlock(freeDecks));

  const probetestSection = _statSection('🎲 Probetest', _probetestBlock());

  const unregelmSection = _statSection('⚒️ Unregelmäßige', _uvLernstandBlock());

  host.innerHTML = campSection + vokabelnSection + probetestSection + unregelmSection;
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

// Schülermodus: Unregelmäßige Verben (Schmiede) — Lernstand-Übersicht je Auftrag:
// pro Auftrag die ZWEI Waffen (🔩 Stahl = ⏱ Simple Past, 🥇 Gold = ✓ Past Participle)
// mit Schmiede-Fortschritt, darunter die angelegten Wörter — je Wort getrennt der
// %-Stand für Simple Past und Past Participle (beide zusammen = 100% des Wortes).
function _uvLernstandBlock() {
  const L = uvLernstand();
  const pct = L.maxLit > 0 ? Math.round((L.totalLit / L.maxLit) * 100) : 0;
  const PAST_COL = '#3a6ea8', PP_COL = '#caa04a';

  // Eine Waffe als Zeile: Name (Material-Gegenstand) + Schmiede-Balken + x/5.
  const weaponRow = (idx, which, litN, totalN) => {
    const mt = FORGE_MAT[which], ob = forgeObject(idx, which);
    const wp = totalN ? Math.round((litN / totalN) * 100) : 0;
    const color = which === 'past' ? PAST_COL : PP_COL;
    return `<div class="uv-weapon">
      <span class="uv-weapon-name">${ob.icon} ${mt.mat}-${ob.name} <span style="color:#aaa;font-weight:700;">${mt.label}</span></span>
      <div class="uv-weapon-bar"><div class="uv-weapon-fill" style="width:${wp}%;background:${color};"></div></div>
      <span class="uv-weapon-ct" style="color:${color};">${litN}/${totalN}</span>
    </div>`;
  };

  const rows = L.rows.map((r, i) => {
    const icon = r.complete ? '🌟' : (r.unlocked ? '⚒️' : '🔒');
    const col = r.complete ? '#2a8a4a' : (r.unlocked ? 'var(--text)' : '#b9b9b9');
    // Je angelegtem Wort: linke Hälfte = Simple Past, rechte Hälfte = Past Participle.
    const wordRows = (r.words || []).map(w => {
      const pPct = w.past.total ? Math.round((w.past.mastered / w.past.total) * 100) : 0;
      const gPct = w.pp.total ? Math.round((w.pp.mastered / w.pp.total) * 100) : 0;
      return `<div class="uvw">
        <span class="uvw-en">${window.escHtml(w.en)}</span>
        <div class="uvw-bars">
          <div class="uvw-half"><div class="uvw-fill" style="width:${pPct}%;background:${PAST_COL};"></div></div>
          <div class="uvw-half"><div class="uvw-fill" style="width:${gPct}%;background:${PP_COL};"></div></div>
        </div>
        <span class="uvw-pct">⏱ ${pPct}% · ✓ ${gPct}%</span>
      </div>`;
    }).join('');
    // Aktueller Auftrag (frei, aber noch nicht fertig) standardmäßig aufgeklappt.
    const open = (r.unlocked && !r.complete) ? ' open' : '';
    return `<details class="uv-cst"${open}>
      <summary style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:${col};">
        <span>${icon}</span>
        <span style="flex:1;font-weight:700;">Auftrag ${i + 1}</span>
        <span style="font-size:.7rem;color:#a06a00;font-weight:800;white-space:nowrap;">🔨 ${r.lit}/${r.total}</span>
        <span class="uv-cst-chev">▾</span>
      </summary>
      <div class="uv-cst-body">
        ${weaponRow(r.idx, 'past', r.pastLit, r.formTotal)}
        ${weaponRow(r.idx, 'pp', r.ppLit, r.formTotal)}
        <div class="uv-words-head">Angelegte Wörter</div>
        ${wordRows}
      </div>
    </details>`;
  }).join('');

  const played = L.totalLit > 0;
  return `
    <div style="margin-bottom:16px;">
      <h3 style="font-family:'Fredoka One',cursive;color:var(--purple);font-size:1rem;margin:0 0 4px;">⚒️ Die Schmiede · unregelmäßige Verben</h3>
      <div style="font-size:.74rem;color:#7a3aac;font-weight:700;margin-bottom:8px;">⚒️ ${L.complete}/${L.total} Aufträge fertig · 🔨 ${L.totalLit}/${L.maxLit} Schritte · ${pct}%</div>
      <div style="height:12px;background:#eee;border-radius:10px;overflow:hidden;margin-bottom:10px;">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--purple),var(--pink));border-radius:10px;"></div>
      </div>
      ${rows}
      ${played ? '' : '<div style="font-size:.78rem;color:#999;text-align:center;padding:8px;">Noch nicht geübt — leg im Tab „Unregelmäßige" einen Schmiede-Auftrag an.</div>'}
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
  // Einmalige Migration: Schüler-Vokabelsammlungen → „Vokabeln" (Freier Modus).
  // Geänderte Decks zurück in die Cloud schreiben, sonst kippt's beim Hard-Load.
  if (migrateDeckModes() && window.currentUser) commitDirty();
  persist(window.SD);
  syncMirrorFromActiveDeck();
}

function _finishLoginUI() {
  if (migrateStatKeys()) persist(window.SD);
  console.log('[handleLogin] SD bereit:', window.SD?.playerName, window.SD?.highscore);
  subscribeFriendRealtime();   // Freundschaftsanfragen live empfangen (WebSocket statt Polling)
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
  const tl = document.getElementById('menu-taler');       if (tl) tl.textContent = '·';
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
  // App-Öffnen landet immer auf dem Vokabeln-Tab (nicht dem zuletzt aktiven Modus).
  if (window.SD) window.SD.activeMode = 'free';
  showMenu();
  let last = null;
  try { last = localStorage.getItem('es_last_screen'); } catch(e) {}
  if (last === 'profile-screen') showProfile();
  else if (last === 'stats-screen') showStats();
}

export function handleLogout() {
  unsubscribeFriendRealtime();   // WebSocket schließen
  window.currentUser = null;
  // Schnell-Zustand zurücksetzen (SPA bleibt geladen) → kein Dark-Mode/AN nach Relogin.
  window.schnellByMode = { free: false, student: false, campaign: false };
  window._schnellBackup = {};
  window.isSchnellModus = false;
  try { document.body.classList.remove('schnell-active'); } catch (e) {}
  setCloudConfirmed(false);   // nächster Login muss den Cloud-Stand neu bestätigen
  clearStorage();             // entfernt auch es_sync_meta
  window.SD = freshData();
  syncMirrorFromActiveDeck();
  showScreen('auth-screen');
}
