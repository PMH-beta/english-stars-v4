// src/modules/lernwoche.js
// LU-14 Wochenziel (24.11.2026, Entscheidungen des Nutzers):
// - Gezählt werden richtige Antworten überall (Runde, Probetest, Schmiede, Kampf).
// - Wochenziel = Summe einer Woche; das Kind wählt 60 / 100 / 150 (Standard 100).
//   Eine Änderung gilt ab der nächsten Woche, sobald in dieser schon gezählt wurde.
// - 25.11.2026 (Nutzer): Eine Woche beginnt mit dem ersten richtigen Wort und dauert
//   7 Tage. Danach beginnt die nächste erst wieder mit dem nächsten Wort. Alte Stände
//   (Wochen ab Montag) passen ohne Umbau: ihr Schlüssel ist einfach ihr Starttag.
// - Ein Tag gilt ab 20 richtigen als „gearbeitet“ (Häkchen in der Wochenkarte).
// - Wochenziel geschafft → einmal 2 Taler je Woche. Keine Serie über Wochen.
// - Freunde sehen „diese Woche“ und „Wochenziel x-mal geschafft“ (jeder seine eigene Woche).
//
// Speicher: SD.lernTage → eigene Spalte profiles.lern_tage (jsonb).
//   ziel:   Wahl des Kindes (60/100/150)
//   tage:   { 'JJJJ-MM-TT': richtige }  — nur die letzten 14 Tage
//   wochen: { 'JJJJ-MM-TT' (Starttag): { z: Ziel der Woche, ok: 1 wenn geschafft } }
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
const _ausKey = (k) => { const [j, m, t] = k.split('-').map(Number); return new Date(j, m - 1, t); };
const _vorTagen = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);
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

// Laufende Woche = Starttag, dessen 7 Tage heute einschließen. Gibt es (nach
// Spielen auf zwei Geräten) zwei solche Starts, zählt der frühere. null = gerade
// läuft keine Woche, die nächste beginnt mit dem nächsten richtigen Wort.
function _laufendeWoche(lt, jetzt) {
  const heute = _tagKey(jetzt), von = _tagKey(_vorTagen(jetzt, 6));
  const keys = Object.keys(lt.wochen).filter((k) => k >= von && k <= heute).sort();
  return keys.length ? keys[0] : null;
}

// Stand der laufenden Woche — für Menüleiste, Wochenkarte, Rundenende und die
// Freund-Ansicht (dort mit seinem Stand). Läuft keine, zeigt er die 7 Tage ab heute.
export function wochenStand(sd = window.SD, jetzt = new Date()) {
  const lt = lernTageFrom(sd && sd.lernTage);
  const heuteKey = _tagKey(jetzt);
  const startKey = _laufendeWoche(lt, jetzt);
  const w = startKey ? lt.wochen[startKey] : null;
  const start = startKey ? _ausKey(startKey) : _vorTagen(jetzt, 0);
  const ziel = w ? w.z : lt.ziel;
  const tage = [];
  let summe = 0, heuteIdx = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = _tagKey(d), n = w ? (lt.tage[k] || 0) : 0;
    if (k === heuteKey) heuteIdx = i;
    summe += n;
    tage.push({ kurz: WOCHENTAGE[(d.getDay() + 6) % 7], n, gearbeitet: n >= TAG_SCHWELLE, heute: k === heuteKey, zukunft: k > heuteKey });
  }
  const geschafftGesamt = Object.values(lt.wochen).filter((x) => x.ok).length;
  // LU-16: die Woche davor. Nur zeigen, wenn ihre Tage noch ganz gespeichert sind
  // (14 Tage); lag eine längere Pause dazwischen, sind sie schon weg.
  const vorKey = Object.keys(lt.wochen).filter((k) => k < (startKey || heuteKey)).sort().pop() || null;
  let letzte = 0, letzteDaten = false;
  if (vorKey && vorKey >= _tagKey(_vorTagen(jetzt, TAGE_HALTEN))) {
    letzteDaten = true;
    const vs = _ausKey(vorKey);
    for (let i = 0; i < 7; i++) {
      const d = new Date(vs); d.setDate(vs.getDate() + i);
      const k = _tagKey(d);
      if (startKey && k >= startKey) break;
      letzte += lt.tage[k] || 0;
    }
  }
  const vw = vorKey ? lt.wochen[vorKey] : null;
  return {
    letzte, letzteDaten, letzteOk: !!(vw && vw.ok),
    laeuft: !!w,                             // false = startet mit dem nächsten Wort
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
  let startKey = _laufendeWoche(lt, jetzt);
  if (!startKey) { startKey = heute; lt.wochen[startKey] = { z: lt.ziel }; }   // neue Woche ab jetzt
  const w = lt.wochen[startKey];
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

// Feste Leiste im Menü unter dem Spielerbanner (25.11.2026, Nutzer): immer da,
// Tipp öffnet die Wochenkarte. Ab dem 4. Tag der Woche (Wunsch: „mein Wochenziel
// läuft ab“) steht dort die Erinnerung, solange das Ziel offen ist.
export function wochenHinweisText(st = wochenStand()) {
  if (!st.laeuft || st.ok || st.restTage > 4) return '';
  if (st.restTage === 1) return `Heute ist der letzte Tag: noch ${_richtige(st.fehlt)} bis zu deinem Wochenziel!`;
  return `Noch ${st.restTage} Tage: ${st.summe} von ${st.ziel} richtig. Mach gern weiter!`;
}
export function wochenLeisteHTML(st = wochenStand()) {
  const erinnerung = wochenHinweisText(st);
  const text = st.ok ? 'Wochenziel geschafft!'
    : !st.laeuft ? 'Wochenziel: Deine Woche startet mit dem nächsten richtigen Wort.'
    : erinnerung || `Wochenziel: ${_fmt(st.summe)} von ${_fmt(st.ziel)} richtig`;
  return `<div class="lw-hinweis lw-leiste${erinnerung ? ' is-erinnerung' : ''}" role="button" tabindex="0" aria-label="Wochenziel öffnen"`
    + ` onclick="zeigeWochenkarte()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();zeigeWochenkarte();}">`
    + iconHTML(st.ok ? 'check' : 'calendar', 28)
    + `<span class="lw-hinweis-text">${text}${st.laeuft ? wochenBalkenHTML(st) : ''}</span></div>`;
}

// Sieben Tagesfelder ab dem Starttag der Woche (Wochenkarte, Fortschritt-Seite).
// mitZahl (LU-16, Fortschritt): unter jedem Tag die richtigen Antworten des Tages.
export function wochenTageHTML(st, mitZahl = false) {
  return `<div class="lw-tage">` + st.tage.map((t) => {
    const cls = 'lw-tag' + (t.gearbeitet ? ' is-ja' : '') + (t.heute ? ' is-heute' : '') + (t.zukunft ? ' is-zukunft' : '');
    return `<div class="${cls}"><span class="lw-tag-k">${t.gearbeitet ? iconHTML('check', 14) : ''}</span>`
      + `<span class="lw-tag-l">${t.kurz}</span>`
      + (mitZahl ? `<span class="lw-tag-n">${t.zukunft ? '' : Number(t.n) || 0}</span>` : '') + `</div>`;
  }).join('') + `</div>`;
}
// LU-16: „Letzte Woche: 85 richtig · geschafft“ — leer, solange es keine Vorwoche gibt.
export function wochenLetzteHTML(st) {
  if (!st.letzteDaten) return '';
  return `<div class="lw-unter lw-letzte">Letzte Woche: ${Number(st.letzte) || 0} richtig${st.letzteOk ? ' · geschafft' : ''}</div>`;
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
    : !st.laeuft ? 'Deine Woche startet mit dem nächsten richtigen Wort und dauert 7 Tage.'
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
