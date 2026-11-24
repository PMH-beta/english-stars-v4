// src/modules/lernwoche.js
// LU-14 Wochenziel (24.11.2026, Entscheidungen des Nutzers):
// - Gezählt werden richtige Antworten überall (Runde, Probetest, Schmiede, Kampf).
// - Wochenziel = Summe Mo–So; das Kind wählt 60 / 100 / 150 (Standard 100).
//   Eine Änderung gilt ab der nächsten Woche, sobald in dieser schon gezählt wurde.
// - Ein Tag gilt ab 20 richtigen als „gearbeitet“ (Häkchen in der Wochenkarte).
// - Wochenziel geschafft → einmal 2 Taler je Woche. Keine Serie über Wochen.
// - Freunde sehen „diese Woche“ und „Wochenziel x-mal geschafft“.
//
// Speicher: SD.lernTage → eigene Spalte profiles.lern_tage (jsonb).
//   ziel:   Wahl des Kindes (60/100/150)
//   tage:   { 'JJJJ-MM-TT': richtige }  — nur die letzten 14 Tage
//   wochen: { 'JJJJ-MM-TT' (Montag): { z: Ziel der Woche, ok: 1 wenn geschafft } }
import { markDirty } from './sync.js';
import { persist } from './storage.js';
import { commitDirty } from './dialog.js';
import { iconHTML } from './pixel-icons.js';

export const WOCHEN_ZIELE = [60, 100, 150];
export const ZIEL_STANDARD = 100;
export const TAG_SCHWELLE = 20;
export const WOCHE_TALER = 2;
const TAGE_HALTEN = 14;
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ── Datum (immer lokale Zeit des Geräts) ──
function _tagKey(d) {
  const m = d.getMonth() + 1, t = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (t < 10 ? '0' : '') + t;
}
function _montag(d) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
const _istTagKey = (k) => /^\d{4}-\d\d-\d\d$/.test(k);
const _zahl = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
const _zielOk = (z) => WOCHEN_ZIELE.includes(Number(z)) ? Number(z) : ZIEL_STANDARD;

// Rohwert (Cloud, Freund, lokaler Speicher) → sauberer Stand. Fremde Werte werden
// dabei auf Zahlen und gültige Schlüssel gestutzt (Freund-Ansicht: kein HTML).
export function lernTageFrom(raw) {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const tage = {}, wochen = {};
  if (r.tage && typeof r.tage === 'object') {
    for (const k in r.tage) if (_istTagKey(k) && _zahl(r.tage[k])) tage[k] = Math.min(_zahl(r.tage[k]), 100000);
  }
  if (r.wochen && typeof r.wochen === 'object') {
    for (const k in r.wochen) {
      const w = r.wochen[k];
      if (!_istTagKey(k) || !w || typeof w !== 'object') continue;
      wochen[k] = { z: _zielOk(w.z) };
      if (w.ok) wochen[k].ok = 1;
    }
  }
  return { ziel: _zielOk(r.ziel), tage, wochen };
}

function _lt(sd) {
  if (!sd.lernTage || typeof sd.lernTage !== 'object') sd.lernTage = lernTageFrom(null);
  const lt = sd.lernTage;
  if (!lt.tage || typeof lt.tage !== 'object') lt.tage = {};
  if (!lt.wochen || typeof lt.wochen !== 'object') lt.wochen = {};
  lt.ziel = _zielOk(lt.ziel);
  return lt;
}

// Stand der Woche, in der `jetzt` liegt — für Banner, Wochenkarte, Rundenende und
// die Freund-Ansicht (dort mit seinem Stand).
export function wochenStand(sd = window.SD, jetzt = new Date()) {
  const lt = lernTageFrom(sd && sd.lernTage);
  const mo = _montag(jetzt), moKey = _tagKey(mo), heuteKey = _tagKey(jetzt);
  const w = lt.wochen[moKey];
  const ziel = w ? w.z : lt.ziel;
  const tage = [];
  let summe = 0, heuteIdx = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(mo); d.setDate(mo.getDate() + i);
    const k = _tagKey(d), n = lt.tage[k] || 0;
    if (k === heuteKey) heuteIdx = i;
    summe += n;
    tage.push({ kurz: WOCHENTAGE[i], n, gearbeitet: n >= TAG_SCHWELLE, heute: k === heuteKey, zukunft: k > heuteKey });
  }
  const geschafftGesamt = Object.values(lt.wochen).filter((x) => x.ok).length;
  return {
    summe, ziel, ok: !!(w && w.ok) || summe >= ziel,
    fehlt: Math.max(0, ziel - summe),
    restTage: 7 - heuteIdx,                  // inkl. heute (So = 1)
    tage, geschafftGesamt,
    zielNaechste: lt.ziel,                   // Wahl für kommende Wochen
    zielGesperrt: !!w,                       // diese Woche läuft schon mit festem Ziel
  };
}

// Richtige Antwort(en) zählen. Liefert true, wenn damit gerade das Wochenziel
// geschafft wurde (Taler sind dann schon gutgeschrieben).
let _frischGeschafft = false;
export function zaehleRichtig(n = 1) {
  const sd = window.SD;
  if (!sd || sd._tourDemo || sd._freundAnsicht) return false;
  n = _zahl(n);
  if (!n) return false;
  const lt = _lt(sd);
  const jetzt = new Date();
  const heute = _tagKey(jetzt);
  lt.tage[heute] = (lt.tage[heute] || 0) + n;
  // Alte Tage fallen raus, die Wochen bleiben (klein, zählen „geschafft gesamt“).
  const grenze = new Date(jetzt); grenze.setDate(grenze.getDate() - TAGE_HALTEN);
  const grenzKey = _tagKey(grenze);
  for (const k in lt.tage) if (k < grenzKey) delete lt.tage[k];
  const moKey = _tagKey(_montag(jetzt));
  if (!lt.wochen[moKey]) lt.wochen[moKey] = { z: lt.ziel };
  const w = lt.wochen[moKey];
  let neu = false;
  if (!w.ok && wochenStand(sd, jetzt).summe >= w.z) {
    w.ok = 1;
    neu = true;
    _frischGeschafft = true;
    if (!sd.campaign || typeof sd.campaign !== 'object') sd.campaign = { claimed: [], talerSpent: 0, run: null };
    sd.campaign.talerSpent = (Number(sd.campaign.talerSpent) || 0) - WOCHE_TALER;   // wie der Boss-Lohn
  }
  if (window.currentUser) markDirty('profile');
  return neu;
}
// Einmal abholen: „gerade geschafft“ fürs Rundenende bzw. den Menü-Hinweis.
export function frischGeschafftAbholen() {
  const f = _frischGeschafft;
  _frischGeschafft = false;
  return f;
}

export function setzeWochenZiel(z) {
  const sd = window.SD;
  if (!sd || sd._freundAnsicht || !WOCHEN_ZIELE.includes(z)) return;
  const lt = _lt(sd);
  if (lt.ziel === z) return;
  lt.ziel = z;
  try { persist(sd); } catch (e) {}
  if (window.currentUser) { markDirty('profile'); try { commitDirty(); } catch (e) {} }
}

// ── Anzeige ──
const _fmt = (n) => String(n);
const _richtige = (n) => n === 1 ? 'eine richtige Antwort' : n + ' richtige Antworten';

// Spielerbanner: „64/100“ bzw. Haken, wenn geschafft.
export function wochenBannerHTML(st = wochenStand()) {
  return iconHTML(st.ok ? 'check' : 'calendar', 14) + `<span>${st.ok ? 'Woche' : _fmt(st.summe) + '/' + _fmt(st.ziel)}</span>`;
}

// Erinnerung im Menü (Wunsch: „mein Wochenziel läuft ab“): ab Donnerstag, solange
// das Ziel offen ist. ✕ blendet sie für den Rest des Tages aus.
const HINWEIS_WEG = 'es_woche_hinweis_weg';
export function wochenHinweisText(st = wochenStand()) {
  if (st.ok || st.restTage > 4) return '';
  if (st.restTage === 1) return `Heute ist der letzte Tag: noch ${_richtige(st.fehlt)} bis zu deinem Wochenziel!`;
  return `Noch ${st.restTage} Tage: ${st.summe} von ${st.ziel} richtig. Mach gern weiter!`;
}
export function wochenHinweisWeg() {
  try { localStorage.setItem(HINWEIS_WEG, _tagKey(new Date())); } catch (e) {}
}
export function wochenHinweisAus() {
  try { return localStorage.getItem(HINWEIS_WEG) === _tagKey(new Date()); } catch (e) { return false; }
}

// Sieben Tagesfelder Mo–So (Wochenkarte, Fortschritt-Seite).
export function wochenTageHTML(st) {
  return `<div class="lw-tage">` + st.tage.map((t) => {
    const cls = 'lw-tag' + (t.gearbeitet ? ' is-ja' : '') + (t.heute ? ' is-heute' : '') + (t.zukunft ? ' is-zukunft' : '');
    return `<div class="${cls}"><span class="lw-tag-k">${t.gearbeitet ? iconHTML('check', 14) : ''}</span>`
      + `<span class="lw-tag-l">${t.kurz}</span></div>`;
  }).join('') + `</div>`;
}
export function wochenBalkenHTML(st) {
  const pct = Math.min(100, Math.round((st.summe / Math.max(1, st.ziel)) * 100));
  return `<div class="lw-balken"><i style="width:${pct}%"></i></div>`;
}

// Chip am Rundenende.
export function wochenChipHTML(st = wochenStand(), geradeGeschafft = false) {
  if (geradeGeschafft) {
    return `<span class="p-chip p-chip--icon p-chip--gold lw-chip">${iconHTML('coin', 14)}Wochenziel geschafft · +${WOCHE_TALER} Taler</span>`;
  }
  if (st.ok) return `<span class="p-chip p-chip--icon lw-chip">${iconHTML('check', 14)}Wochenziel geschafft</span>`;
  return `<span class="p-chip p-chip--icon lw-chip">${iconHTML('calendar', 14)}Woche ${st.summe} / ${st.ziel}</span>`;
}

// Wochenkarte (Tipp aufs Banner oder den Hinweis).
export function zeigeWochenkarte() {
  const st = wochenStand();
  const overlay = document.createElement('div');
  overlay.className = 'p-dlg-grund';
  const unter = st.ok
    ? `Geschafft! Die ${WOCHE_TALER} Taler hast du schon bekommen.`
    : `Noch ${_richtige(st.fehlt)} · ${st.restTage === 1 ? 'heute letzter Tag' : 'noch ' + st.restTage + ' Tage'}`;
  const zielKnoepfe = WOCHEN_ZIELE.map((z) =>
    `<button type="button" class="lw-ziel${z === st.zielNaechste ? ' is-an' : ''}" data-ziel="${z}">${z}</button>`).join('');
  overlay.innerHTML = `<div class="p-dlg-karte lw-karte" role="dialog" aria-label="Wochenziel">
      <div class="p-dlg-emblem p-ton-pfirsich">${iconHTML('calendar', 28)}</div>
      <div class="p-dlg-titel">Wochenziel</div>
      <div class="lw-zahl"><b>${st.summe}</b> von ${st.ziel} richtig</div>
      ${wochenBalkenHTML(st)}
      <div class="lw-unter">${unter}</div>
      ${wochenTageHTML(st)}
      <div class="lw-legende">${iconHTML('check', 14)}ab ${TAG_SCHWELLE} richtigen am Tag</div>
      <div class="lw-trenner"></div>
      <div class="lw-zeile"><span>Mein Ziel pro Woche</span><div class="lw-ziele">${zielKnoepfe}</div></div>
      <div class="lw-klein" id="lw-ziel-hinweis">${st.zielGesperrt && st.zielNaechste !== st.ziel ? 'Gilt ab nächster Woche.' : ''}</div>
      <div class="lw-zeile"><span>Wochenziel geschafft</span><b>${st.geschafftGesamt}×</b></div>
      <div class="lw-klein">Jede geschaffte Woche bringt ${WOCHE_TALER} Taler.</div>
      <div class="p-dlg-knoepfe"><button type="button" class="p-dlg-btn p-dlg-btn--ok" data-zu>OK</button></div>
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-zu]')) { overlay.remove(); return; }
    const b = e.target.closest('[data-ziel]');
    if (!b) return;
    const z = Number(b.dataset.ziel);
    setzeWochenZiel(z);
    overlay.querySelectorAll('[data-ziel]').forEach((x) => x.classList.toggle('is-an', x === b));
    const neu = wochenStand();
    const h = overlay.querySelector('#lw-ziel-hinweis');
    if (h) h.textContent = neu.zielGesperrt && z !== neu.ziel ? 'Gilt ab nächster Woche.' : '';
    if (!neu.zielGesperrt) {   // Woche hat noch nicht begonnen → Ziel gilt sofort
      const zahl = overlay.querySelector('.lw-zahl');
      if (zahl) zahl.innerHTML = `<b>${neu.summe}</b> von ${neu.ziel} richtig`;
      const bal = overlay.querySelector('.lw-balken');
      if (bal) bal.outerHTML = wochenBalkenHTML(neu);
    }
    try { window.renderWochenBanner?.(); } catch (e2) {}
  });
  (document.body || document.documentElement).appendChild(overlay);
  overlay.querySelector('[data-zu]')?.focus();
}
