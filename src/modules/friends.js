// src/modules/friends.js
// Freunde-System: Suche, Anfragen (annehmen/ablehnen), Freundesliste, Entfernen.
// Backend läuft komplett über Supabase-RPCs (SECURITY DEFINER, s. backend/schema.sql),
// da die profiles-RLS nur das eigene Profil freigibt. Eine Freundschaft = EINE Zeile
// (das Paar) → gegenseitig: wer addet/annimmt, steht bei beiden in der Liste; Entfernen
// löscht die Zeile → verschwindet bei beiden.

import { supabase } from './supabase.js';
import { renderAvatarInto } from './avatar.js';

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

// ── Style-Helfer ──
function _btn(bg, color = '#fff') {
  return `font-family:'Fredoka One',cursive;font-size:.72rem;padding:6px 10px;border:none;border-radius:50px;cursor:pointer;background:${bg};color:${color};white-space:nowrap;flex-shrink:0;`;
}
function _tag(color) {
  return `font-size:.72rem;font-weight:700;color:${color};background:rgba(0,0,0,.05);padding:5px 10px;border-radius:50px;white-space:nowrap;flex-shrink:0;`;
}
function _person(prefix, id, name, rightHtml, clickable) {
  const nameClick = clickable ? ` onclick="openFriendStats('${id}')" style="cursor:pointer;` : ' style="';
  return `<div style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid #f0f0f0;">
    <div id="${prefix}-av-${id}" ${clickable ? `onclick="openFriendStats('${id}')" style="cursor:pointer;` : 'style="'}width:40px;height:40px;flex-shrink:0;"></div>
    <div${nameClick}flex:1;min-width:0;font-family:'Fredoka One',cursive;color:var(--text);font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name)}</div>
    ${rightHtml}
  </div>`;
}
function _drawAvatar(prefix, id, avatar) {
  renderAvatarInto(`${prefix}-av-${id}`, { avatar }, { headOnly: true });
}

// ── Badge über dem Profilkopf (Startseite) ──
export async function refreshFriendBadge() {
  const el = document.getElementById('friend-badge');
  if (!el) return;
  if (!window.currentUser) { el.style.display = 'none'; return; }
  const n = await friendRequestCount();
  if (n > 0) { el.textContent = n > 99 ? '99+' : String(n); el.style.display = ''; }
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
function _scheduleLiveRefresh(payload) {
  console.log('[friends] realtime EVENT:', payload?.eventType, payload?.new || payload?.old);
  clearTimeout(_liveTimer);
  _liveTimer = setTimeout(() => { refreshFriendsLive().catch(() => {}); }, 400);
}

// Badge immer, offene Listen nur wenn die Freunde-Sektion sichtbar ist und gerade
// nicht gesucht wird (dann sind die Listen ohnehin ausgeblendet).
export async function refreshFriendsLive() {
  refreshFriendBadge();
  if (!document.getElementById('friend-list')) return;
  const inp = document.getElementById('friend-search');
  if (inp && inp.value.trim()) return;
  await Promise.all([_loadRequests(), _loadFriends(), _loadOutgoing()]);
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
    console.log('[friends] realtime token gesetzt:', !!session?.access_token);
  } catch (e) { console.warn('[friends] setAuth:', e?.message); }
  // Kein Filter nötig: die RLS-Policy liefert mir ohnehin nur meine eigenen Paar-Zeilen,
  // und refreshFriendsLive lädt sowieso alles neu. Eine Bindung = robuster.
  _rtChannel = supabase.channel('friendships-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, _scheduleLiveRefresh)
    .subscribe((status, err) => {
      console.log('[friends] realtime status:', status, 'uid:', uid, err?.message || '');
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
  if (!window.currentUser) {
    host.innerHTML = `<h3 style="color:var(--purple);margin-top:0">👥 Freunde</h3>
      <div style="font-size:.8rem;color:#999;font-weight:700;">Melde dich an, um Freunde hinzuzufügen.</div>`;
    return;
  }
  host.innerHTML = `
    <h3 style="color:var(--purple);margin-top:0">👥 Freunde</h3>
    <input id="friend-search" type="text" placeholder="🔍 Nach Namen suchen…" maxlength="20"
      oninput="onFriendSearchInput(this.value)" autocomplete="off"
      onkeydown="if(event.key==='Enter'){event.preventDefault();onFriendSearchEnter();}"
      style="width:100%;padding:10px 14px;border:2px solid #eee;border-radius:11px;font-size:.9rem;font-family:'Nunito',sans-serif;margin-bottom:10px;">
    <div id="friend-search-results" style="display:none;"></div>
    <div id="friend-list"></div>
    <div id="friend-requests" style="margin-top:14px;display:none;"></div>
    <div id="friend-outgoing" style="margin-top:14px;display:none;"></div>`;
  await Promise.all([_loadRequests(), _loadFriends(), _loadOutgoing()]);
  refreshFriendBadge();
}

async function _loadRequests() {
  const box = document.getElementById('friend-requests');
  if (!box) return;
  const reqs = await listRequests();
  if (!reqs.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
  box.style.display = '';
  box.innerHTML = `<div style="font-family:'Fredoka One',cursive;font-size:.9rem;color:var(--text);margin-bottom:6px;">Anfragen (${reqs.length})</div>`
    + reqs.map(r => _person('req', r.requester_id, r.player_name,
        `<button onclick="respondFriendRequest('${r.friendship_id}',true)" style="${_btn('#2a8a4a')}">✓ Annehmen</button>
         <button onclick="respondFriendRequest('${r.friendship_id}',false)" style="${_btn('#f0f0f0','#c0392b')}">✕</button>`,
        false)).join('');
  reqs.forEach(r => _drawAvatar('req', r.requester_id, r.avatar));
}

async function _loadFriends() {
  const box = document.getElementById('friend-list');
  if (!box) return;
  const friends = await listFriends();
  _friendsCache = friends;
  if (!friends.length) {
    box.innerHTML = `<div style="font-size:.82rem;color:#999;font-weight:700;text-align:center;padding:14px;">Noch keine Freunde — such oben jemanden und schick eine Anfrage!</div>`;
    return;
  }
  box.innerHTML = friends.map(f => _person('fl', f.id, f.player_name,
    `<button onclick="confirmRemoveFriend('${f.id}')" title="Freund entfernen" style="${_btn('#f0f0f0', '#c0392b')}">🗑️</button>`,
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
  box.innerHTML = `<div style="font-family:'Fredoka One',cursive;font-size:.9rem;color:var(--text);margin-bottom:6px;">Gesendet (${reqs.length})</div>`
    + reqs.map(r => _person('out', r.addressee_id, r.player_name,
        `<span style="${_tag('#999')}">⏳ Angefragt</span>
         <button onclick="cancelFriendRequest('${r.addressee_id}')" title="Anfrage zurückziehen" style="${_btn('#f0f0f0','#c0392b')}">✕</button>`,
        false)).join('');
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
  results.innerHTML = '<div style="font-size:.8rem;color:#999;text-align:center;padding:10px;">Suche…</div>';
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
    results.innerHTML = `<div style="font-size:.82rem;color:#999;text-align:center;padding:12px;">Niemand mit „${esc(q)}" gefunden.</div>`;
    return;
  }
  results.innerHTML = rows.map(r => {
    let right;
    if (r.status === 'friends')       right = `<span style="${_tag('#2a8a4a')}">✓ Freunde</span>`;
    else if (r.status === 'outgoing') right = `<span style="${_tag('#999')}">⏳ Angefragt</span>`;
    else if (r.status === 'incoming') right = `<button onclick="sendFriendRequest('${r.id}')" style="${_btn('#2a8a4a')}">✓ Annehmen</button>`;
    else                              right = `<button onclick="sendFriendRequest('${r.id}')" style="${_btn('var(--purple)')}">➕ Anfrage</button>`;
    return _person('res', r.id, r.player_name, right, false);
  }).join('');
  rows.forEach(r => _drawAvatar('res', r.id, r.avatar));
}

// ── Aktionen ──
export async function sendFriendRequest(id) {
  const { error } = await supabase.rpc('send_friend_request', { target: id });
  if (error) { window.esAlert?.({ icon: '⚠️', title: 'Fehler', body: 'Anfrage konnte nicht gesendet werden.' }); return; }
  _clearFriendSearch();   // nach Anfrage/Annehmen Suchleiste zurücksetzen
  await Promise.all([_loadRequests(), _loadFriends(), _loadOutgoing()]);
  refreshFriendBadge();
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
  await Promise.all([_loadRequests(), _loadFriends()]);
  refreshFriendBadge();
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
