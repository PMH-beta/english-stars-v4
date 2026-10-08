// src/modules/friends.js
// Freunde-System: Suche, Anfragen (annehmen/ablehnen), Freundesliste, Entfernen.
// Backend läuft komplett über Supabase-RPCs (SECURITY DEFINER, s. backend/schema.sql),
// da die profiles-RLS nur das eigene Profil freigibt. Eine Freundschaft = EINE Zeile
// (das Paar) → gegenseitig: wer addet/annimmt, steht bei beiden in der Liste; Entfernen
// löscht die Zeile → verschwindet bei beiden.

import { supabase } from './supabase.js';
import { renderAvatarInto } from './avatar.js';
import { iconHTML } from './pixel-icons.js';

const esc = (s) => (window.escHtml ? window.escHtml(s) : (s || ''));
let _searchTimer = null;
let _friendsCache = [];

// ── RPC-Wrapper ──
export async function searchUsers(q) {
  const { data, error } = await supabase.rpc('search_users', { q });
  if (error) { console.warn('[friends] search:', error.message); return []; }
  return data || [];
}
async function listFriends() {
  const { data, error } = await supabase.rpc('list_friends');
  if (error) { console.warn('[friends] list_friends:', error.message); return []; }
  return data || [];
}
async function listRequests() {
  const { data, error } = await supabase.rpc('list_friend_requests');
  if (error) { console.warn('[friends] list_requests:', error.message); return []; }
  return data || [];
}
async function listOutgoing() {
  const { data, error } = await supabase.rpc('list_outgoing_requests');
  if (error) { console.warn('[friends] list_outgoing:', error.message); return []; }
  return data || [];
}
export async function friendRequestCount() {
  const { data, error } = await supabase.rpc('friend_request_count');
  if (error) return 0;
  return Number(data) || 0;
}
export async function friendProgress(friendId) {
  const { data, error } = await supabase.rpc('get_friend_progress', { friend: friendId });
  if (error) { console.warn('[friends] progress:', error.message); return null; }
  return data || null;
}

// ── Bausteine nach 8.1 ──
// Knoepfe (Anfrage Flieder, Annehmen Mint) und Marken (Angefragt mit Sanduhr,
// Freunde mit Haken). Entfernen / Ablehnen / Zurueckziehen zeigt der Entwurf
// nicht — sie bleiben als kleine Symbol-Knoepfe in derselben Bauweise.
const _knopf = (ton, text, onclick) =>
  `<button class="fr-knopf fr-knopf--${ton}" onclick="${onclick}">${text}</button>`;
const _symbolKnopf = (icon, onclick, title) =>
  `<button class="fr-knopf fr-knopf--symbol" onclick="${onclick}" title="${title}">${iconHTML(icon, 14)}</button>`;
const _MARKE_ANGEFRAGT = `<span class="fr-marke">${iconHTML('hourglass', 14).replace('<canvas ', '<canvas data-ui="turn180" data-c="16" ')}Angefragt</span>`;
const _MARKE_FREUNDE = `<span class="fr-marke fr-marke--mint">${iconHTML('check', 14)}Freunde</span>`;

// Zeile: Brustbild, Name, darunter optional der Stand („hat dich angefragt“),
// rechts Knopf oder Marke. Bei Freunden öffnet die ganze Zeile den Fortschritt
// und sinkt als Ganzes ein (Wunsch des Nutzers, 08.10.2026 — vorher nur Bild und
// unterstrichener Name); die Knöpfe rechts bleiben eigene Knöpfe.
function _person(prefix, id, name, rightHtml, clickable, sub = '') {
  const klick = clickable ? ` onclick="if(!event.target.closest('button'))openFriendStats('${id}')"` : '';
  return `<div class="fr-zeile${clickable ? ' is-link' : ''}"${klick}>
    <div class="fr-bild"><div id="${prefix}-av-${id}" class="fr-bust"></div></div>
    <div class="fr-text"><div class="fr-name">${esc(name)}</div>${sub ? `<div class="fr-sub">${sub}</div>` : ''}</div>
    ${rightHtml}
  </div>`;
}
function _drawAvatar(prefix, id, avatar) {
  renderAvatarInto(`${prefix}-av-${id}`, { avatar }, { bust: true, scale: 1 });
}

// ── Badge über dem Profilkopf (Startseite) ──
// n === null → Zahl selbst holen (eigener RPC). Wer die Anfragen ohnehin gerade
// geladen hat, reicht die Anzahl durch und spart den zusätzlichen Roundtrip:
// die Freunde-Sektion machte bisher VIER Abfragen für drei Listen.
export async function refreshFriendBadge(n = null) {
  const el = document.getElementById('friend-badge');
  if (!el) return;
  if (!window.currentUser) { el.style.display = 'none'; return; }
  const count = (n === null) ? await friendRequestCount() : n;
  if (count > 0) { el.textContent = count > 99 ? '99+' : String(count); el.style.display = ''; }
  else el.style.display = 'none';
}

// ── REALTIME ──
// Statt Polling hält eine WebSocket-Subscription pro eingeloggtem User die eigenen
// friendships-Zeilen live: eingehende Anfragen (addressee = ich) und Statuswechsel
// meiner gesendeten Anfragen (requester = ich). Die DB pusht nur bei echter Änderung
// → im Leerlauf keine Abfragen. RLS-gefiltert (s. schema.sql). Idempotent.
let _rtChannel = null;
let _liveTimer = null;

// Mehrere Events (z.B. Annehmen = ein UPDATE) zu einem Refresh bündeln.
function _scheduleLiveRefresh() {
  clearTimeout(_liveTimer);
  _liveTimer = setTimeout(() => { refreshFriendsLive().catch(() => {}); }, 400);
}

// Badge immer, offene Listen nur wenn die Freunde-Sektion sichtbar ist und gerade
// nicht gesucht wird (dann sind die Listen ohnehin ausgeblendet).
export async function refreshFriendsLive() {
  const inp = document.getElementById('friend-search');
  const listsVisible = !!document.getElementById('friend-list') && !(inp && inp.value.trim());
  if (!listsVisible) { refreshFriendBadge(); return; }   // nur die Zahl nötig
  const [nReq] = await Promise.all([_loadRequests(), _loadFriends(), _loadOutgoing()]);
  refreshFriendBadge(nReq);
}

export async function subscribeFriendRealtime() {
  const uid = window.currentUser?.id;
  if (!uid) return;
  unsubscribeFriendRealtime();
  // WICHTIG: Realtime muss den User-JWT kennen, sonst greift die RLS-Policy nicht und
  // es kommen gar keine Events an. setAuth ist async → awaiten, sonst kann der Token
  // erst nach subscribe() ankommen und alle Events werden weggefiltert.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
  } catch (e) { console.warn('[friends] setAuth:', e?.message); }
  // Kein Filter nötig: die RLS-Policy liefert mir ohnehin nur meine eigenen Paar-Zeilen,
  // und refreshFriendsLive lädt sowieso alles neu. Eine Bindung = robuster.
  _rtChannel = supabase.channel('friendships-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, _scheduleLiveRefresh)
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[friends] realtime', status, err?.message || '');
    });
}

export function unsubscribeFriendRealtime() {
  if (!_rtChannel) return;
  supabase.removeChannel(_rtChannel);
  _rtChannel = null;
  clearTimeout(_liveTimer);
}

// ── FREUNDE-Sektion auf der Profilseite ──
export async function renderFriendsSection() {
  const host = document.getElementById('prof-friends-section');
  if (!host) return;
  const kopf = `<div class="fr-kopf">${iconHTML('friends', 14)}<span>Freunde</span></div>`;
  if (!window.currentUser) {
    host.innerHTML = kopf + '<div class="fr-hinweis">Melde dich an, um Freunde hinzuzufügen.</div>';
    return;
  }
  host.innerHTML = kopf + `
    <label class="fr-suche">${iconHTML('lupe', 14)}<input id="friend-search" type="text" placeholder="Nach Namen suchen…" maxlength="20"
      oninput="onFriendSearchInput(this.value)" autocomplete="off"
      onkeydown="if(event.key==='Enter'){event.preventDefault();onFriendSearchEnter();}"></label>
    <div id="friend-search-results" class="fr-liste" style="display:none;"></div>
    <div id="friend-list" class="fr-liste"><div class="fr-hinweis">Freunde werden geladen…</div></div>
    <div id="friend-requests" style="display:none;"></div>
    <div id="friend-outgoing" style="display:none;"></div>`;
  // Drei Listen, drei parallele Abfragen — das Badge kommt aus dem Ergebnis der
  // Anfragen-Liste statt aus einer vierten Abfrage.
  const [nReq] = await Promise.all([_loadRequests(), _loadFriends(), _loadOutgoing()]);
  refreshFriendBadge(nReq);
}

// Gibt die Anzahl offener Anfragen zurück — damit der Aufrufer das Badge setzen
// kann, ohne die Zahl ein zweites Mal beim Server zu holen.
async function _loadRequests() {
  const box = document.getElementById('friend-requests');
  if (!box) return 0;
  const reqs = await listRequests();
  if (!reqs.length) { box.innerHTML = ''; box.style.display = 'none'; return 0; }
  box.style.display = '';
  box.innerHTML = `<div class="fr-kicker">Anfragen (${reqs.length})</div><div class="fr-liste">`
    + reqs.map(r => _person('req', r.requester_id, r.player_name,
        _knopf('mint', 'Annehmen', `respondFriendRequest('${r.friendship_id}',true)`)
        + _symbolKnopf('close', `respondFriendRequest('${r.friendship_id}',false)`, 'Anfrage ablehnen'),
        false, 'hat dich angefragt')).join('') + '</div>';
  reqs.forEach(r => _drawAvatar('req', r.requester_id, r.avatar));
  return reqs.length;
}

async function _loadFriends() {
  const box = document.getElementById('friend-list');
  if (!box) return;
  const friends = await listFriends();
  _friendsCache = friends;
  if (!friends.length) {
    box.innerHTML = `<div class="fr-leer">Noch keine Freunde — such oben jemanden und schick eine Anfrage!</div>`;
    return;
  }
  box.innerHTML = friends.map(f => _person('fl', f.id, f.player_name,
    _symbolKnopf('trash', `confirmRemoveFriend('${f.id}')`, 'Freund entfernen'),
    true)).join('');
  friends.forEach(f => _drawAvatar('fl', f.id, f.avatar));
}

// Von mir gesendete, noch offene Anfragen. Eigene Liste, nicht klickbar (kein Profil einsehbar
// bevor angenommen). Zurückziehen löscht die Paar-Zeile (remove_friend, gilt auch für pending).
async function _loadOutgoing() {
  const box = document.getElementById('friend-outgoing');
  if (!box) return;
  const reqs = await listOutgoing();
  if (!reqs.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
  box.style.display = '';
  box.innerHTML = `<div class="fr-kicker">Gesendet (${reqs.length})</div><div class="fr-liste">`
    + reqs.map(r => _person('out', r.addressee_id, r.player_name,
        _MARKE_ANGEFRAGT + _symbolKnopf('close', `cancelFriendRequest('${r.addressee_id}')`, 'Anfrage zurückziehen'),
        false)).join('') + '</div>';
  reqs.forEach(r => _drawAvatar('out', r.addressee_id, r.avatar));
}

// Suche: ab 1 Zeichen; Freundesliste wird währenddessen ausgeblendet (nicht überladen).
export function onFriendSearchInput(val) {
  const q = (val || '').trim();
  const list = document.getElementById('friend-list');
  const requests = document.getElementById('friend-requests');
  const outgoing = document.getElementById('friend-outgoing');
  const results = document.getElementById('friend-search-results');
  if (!results) return;
  if (!q) {
    results.style.display = 'none';
    results.innerHTML = '';
    if (list) list.style.display = '';
    if (requests && requests.innerHTML) requests.style.display = '';
    if (outgoing && outgoing.innerHTML) outgoing.style.display = '';
    return;
  }
  if (list) list.style.display = 'none';
  if (requests) requests.style.display = 'none';
  if (outgoing) outgoing.style.display = 'none';
  results.style.display = '';
  results.innerHTML = '<div class="fr-hinweis">Suche…</div>';
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(async () => {
    const rows = await searchUsers(q);
    _renderSearchResults(rows, q);
  }, 250);
}

// Suchfeld leeren und zurück zur Listenansicht (nach Anfrage/Annehmen/Enter).
function _clearFriendSearch() {
  const inp = document.getElementById('friend-search');
  if (inp) inp.value = '';
  onFriendSearchInput('');
}
export function onFriendSearchEnter() {
  _clearFriendSearch();
  const inp = document.getElementById('friend-search');
  if (inp) inp.blur();
}

function _renderSearchResults(rows, q) {
  const results = document.getElementById('friend-search-results');
  if (!results) return;
  if (!rows.length) {
    results.innerHTML = `<div class="fr-leer">Niemand mit „${esc(q)}“ gefunden</div>`;
    return;
  }
  results.innerHTML = rows.map(r => {
    let right, sub = '';
    if (r.status === 'friends')       { right = _MARKE_FREUNDE; sub = 'schon befreundet'; }
    else if (r.status === 'outgoing') right = _MARKE_ANGEFRAGT;
    else if (r.status === 'incoming') { right = _knopf('mint', 'Annehmen', `sendFriendRequest('${r.id}')`); sub = 'hat dich angefragt'; }
    else                              right = _knopf('lila', 'Anfrage', `sendFriendRequest('${r.id}')`);
    return _person('res', r.id, r.player_name, right, false, sub);
  }).join('');
  rows.forEach(r => _drawAvatar('res', r.id, r.avatar));
}

// ── Aktionen ──
export async function sendFriendRequest(id) {
  const { error } = await supabase.rpc('send_friend_request', { target: id });
  if (error) { window.esAlert?.({ icon: '⚠️', title: 'Fehler', body: 'Anfrage konnte nicht gesendet werden.' }); return; }
  _clearFriendSearch();   // nach Anfrage/Annehmen Suchleiste zurücksetzen
  const [nReq] = await Promise.all([_loadRequests(), _loadFriends(), _loadOutgoing()]);
  refreshFriendBadge(nReq);
}

// Gesendete Anfrage zurückziehen (löscht die pending-Zeile beidseitig).
export async function cancelFriendRequest(id) {
  const { error } = await supabase.rpc('remove_friend', { other: id });
  if (error) { window.esAlert?.({ icon: '⚠️', title: 'Fehler', body: 'Konnte nicht zurückgezogen werden.' }); return; }
  const inp = document.getElementById('friend-search');
  const q = inp && inp.value.trim();
  if (q) { const rows = await searchUsers(q); _renderSearchResults(rows, q); }
  await _loadOutgoing();
}

export async function respondFriendRequest(fid, accept) {
  const { error } = await supabase.rpc('respond_friend_request', { fid, accept });
  if (error) { window.esAlert?.({ icon: '⚠️', title: 'Fehler', body: 'Aktion fehlgeschlagen.' }); return; }
  const [nReq] = await Promise.all([_loadRequests(), _loadFriends()]);
  refreshFriendBadge(nReq);
}

export async function confirmRemoveFriend(id) {
  const name = (_friendsCache.find(f => f.id === id) || {}).player_name || 'Freund';
  const ok = await window.esConfirm({
    icon: '🗑️', title: 'Freund entfernen?',
    body: `„${name}" wird bei euch beiden aus der Freundesliste entfernt.`,
    ok: 'Entfernen', cancel: 'Abbrechen', danger: true,
  });
  if (!ok) return;
  const { error } = await supabase.rpc('remove_friend', { other: id });
  if (error) { window.esAlert?.({ icon: '⚠️', title: 'Fehler', body: 'Konnte nicht entfernt werden.' }); return; }
  await _loadFriends();
}

export function openFriendStats(id) {
  if (window.showFriendStats) window.showFriendStats(id);
}
