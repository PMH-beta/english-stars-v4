// src/modules/minigame-letterstorm.js
// Buchstabensturm — Kern-Minispiel der Kampagne (Phase 1).
// Die Buchstaben des englischen Zielworts schweben driftend im Feld; das Kind tippt
// sie in der richtigen Reihenfolge an, getroffene füllen die Wortleiste unten.
// Falscher Buchstabe = Schütteln + Zeitstrafe. Zeit abgelaufen = Welle verloren.
// Touch-first, Drift über CSS-Transforms. KEIN Mastery/EMA-Schreiben — eine Welle
// ist einmalig richtig oder falsch.
//
// Schnittstelle: startLetterstorm({host, inputHost, de, en, timeLimitMs, onResult}) →
// {destroy, pause, resume}. host bekommt Prompt/Timer/Spielfeld (treibende Buchstaben),
// inputHost bekommt NUR die Wortleiste (zeigt die bereits getroffenen Buchstaben) —
// getrennt, weil die Kampf-Ansicht das Eingabefeld unter den Figuren zeigt, das
// Spielfeld aber darüber. Fehlt inputHost, landet die Leiste im host (Fallback).
// onResult(success, timeLeftMs) wird genau einmal gerufen. pause()/resume() frieren
// die Restzeit exakt ein (z. B. während eines Bestätigungs-Dialogs). onMiss (optional)
// wird bei JEDEM falschen Buchstaben gerufen (nicht nur einmal pro Welle) — der
// Aufrufer entscheidet, was ein Fehlklick zusätzlich zur Zeitstrafe kostet.

import { playSfx } from './game.js';
import { STORM_PENALTY_MS } from './campaign-balance.js';

// Zielwort fürs Tippen: erste /-Alternative, führendes „to " weg (wie submitType).
export function stormTarget(en) {
  return (en || '').split('/')[0].trim().toLowerCase().replace(/^to /, '');
}

// Style wird auch von Echo-Fang genutzt (cfDrift-Keyframes) → exportiert.
let _styleDone = false;
export function ensureStormStyle() {
  if (_styleDone) return;
  _styleDone = true;
  const st = document.createElement('style');
  st.textContent = `
    @keyframes cfDrift { from { transform: translate(0,0); } to { transform: translate(var(--dx), var(--dy)); } }
    /* Zentrierte Variante für Elemente, die per transform:translate(-50%,-50%) auf
       ihrem Ankerpunkt sitzen (z. B. Echo-Fang-Chips) — eine Animation auf transform
       überschreibt sonst jeden inline gesetzten transform-Wert komplett, darum muss die
       Zentrierung HIER mit eingebacken sein statt separat gesetzt zu werden. */
    @keyframes cfDriftC { from { transform: translate(-50%,-50%); } to { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))); } }
    @keyframes cfShake { 0%,100% { translate: 0 0; } 25% { translate: -6px 0; } 75% { translate: 6px 0; } }
    .cf-tile { position:absolute; width:58px; height:58px; border-radius:14px; border:none;
      background:#fff; color:#333; font-family:'Fredoka One',cursive; font-size:1.6rem;
      box-shadow:0 3px 8px rgba(0,0,0,.25); cursor:pointer; padding:0; z-index:2;
      animation: cfDrift var(--dur) ease-in-out infinite alternate; transition: opacity .25s, scale .25s; }
    .cf-tile.cf-hit { opacity:0; scale:.3; pointer-events:none; }
    .cf-tile.cf-shake { background:#ffd6d6; }
    .cf-tile.cf-shake span { display:inline-block; animation: cfShake .3s ease; }
    /* Eingabefeld-Kacheln (Wortleiste): gleiche Kachel-Sprache wie die tippbaren
       Buchstaben im Spielfeld — leer = angedeutete Kachel, getroffen = feste weiße Kachel. */
    .cf-slot { display:inline-flex; align-items:center; justify-content:center; min-width:30px; height:36px;
      border-radius:10px; border:2px dashed rgba(255,255,255,.6); background:rgba(255,255,255,.12);
      font-family:'Fredoka One',cursive; font-size:1.15rem; color:#fff; padding:0 4px; box-sizing:border-box;
      transition:background .2s, border-color .2s; }
    .cf-slot.cf-filled { border:2px solid transparent; background:#fff; color:#333; box-shadow:0 2px 6px rgba(0,0,0,.2); }
  `;
  document.head.appendChild(st);
}

// prompt (optional): eigener Kopf statt „🇩🇪 de" — für Verbform-Wellen
// („go → Simple Past?"); sub (optional): kleine Zusatzzeile darunter.
// guards (optional): so viele Fehlgriffe fängt der 🐾 Gefährte ab (keine Strafe);
// onGuardUsed wird je verbrauchtem Guard gerufen (Kampf merkt sich das pro Kampf).
export function startLetterstorm({ host, inputHost, de, en, prompt, sub, timeLimitMs, guards = 0, onGuardUsed, onMiss, onResult }) {
  ensureStormStyle();
  const target = stormTarget(en);
  const chars = target.split('');
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + timeLimitMs;
  const slotsRoot = inputHost || host;

  // Leerzeichen (Mehrwort-Antworten) sind in der Leiste vorgegeben — kein Tile.
  const tappable = chars.map((ch, i) => ({ ch, i })).filter(x => x.ch !== ' ');
  const slotHtml = chars.map((ch, i) => ch === ' '
    ? '<span style="width:12px;"></span>'
    : `<span class="cf-slot" data-i="${i}"></span>`).join('');

  host.innerHTML = `
    <div style="display:flex;justify-content:center;margin-bottom:16px;">
      <div style="background:#fff;border-radius:16px;padding:8px 20px 10px;box-shadow:0 3px 8px rgba(0,0,0,.2);text-align:center;">
        <div style="font-size:1.5rem;font-weight:800;color:#333;">${prompt || `🇩🇪 ${de}`}</div>
        ${sub ? `<div style="font-size:.8rem;font-weight:700;color:#777;margin-top:2px;">${sub}</div>` : ''}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="flex:1;height:10px;background:rgba(43,35,80,.25);border-radius:6px;overflow:hidden;">
        <div id="cf-timebar" style="height:100%;width:100%;background:linear-gradient(90deg,#ffd43b,#f0a500);border-radius:6px;"></div>
      </div>
      <div id="cf-secs" style="font-family:'Fredoka One',cursive;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.4);font-size:.9rem;min-width:34px;text-align:right;"></div>
    </div>
    <div id="cf-field" style="position:relative;height:min(38dvh,320px);min-height:170px;overflow:hidden;"></div>`;
  slotsRoot.innerHTML = `<div id="cf-slots" style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;padding:10px 0;">${slotHtml}</div>`;

  // Tiles auf gemischtem Gitter platzieren (kein Anfangs-Überlappen), dann driften.
  const field = host.querySelector('#cf-field');
  const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(tappable.length))));
  const rows = Math.max(1, Math.ceil(tappable.length / cols));
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }

  let nextIdx = 0;   // nächster erwarteter Index in chars (Leerzeichen überspringen)
  const advance = () => { nextIdx++; while (nextIdx < chars.length && chars[nextIdx] === ' ') nextIdx++; };

  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    onResult(success, Math.max(0, endAt - Date.now()));
  }

  tappable.forEach((t, k) => {
    const cell = cells[k];
    const btn = document.createElement('button');
    btn.className = 'cf-tile';
    btn.innerHTML = `<span>${t.ch}</span>`;
    const x = (cell.c + 0.5) / cols * 84 + 8;    // % innerhalb des Felds, mit Rand
    const y = (cell.r + 0.5) / rows * 74 + 10;
    btn.style.left = `calc(${x}% - 23px)`;
    btn.style.top = `calc(${y}% - 23px)`;
    btn.style.setProperty('--dx', (Math.random() * 44 - 22).toFixed(0) + 'px');
    btn.style.setProperty('--dy', (Math.random() * 36 - 18).toFixed(0) + 'px');
    btn.style.setProperty('--dur', (2.2 + Math.random() * 2).toFixed(2) + 's');
    btn.onclick = () => {
      if (done || btn.classList.contains('cf-hit')) return;
      if (t.ch === chars[nextIdx]) {
        // Richtig: Tile poppt weg, Slot füllt sich. Bei doppelten Buchstaben gilt
        // JEDES passende Tile (w-e-e-k: jedes „e" zählt fürs nächste „e").
        btn.classList.add('cf-hit');
        const slot = slotsRoot.querySelector(`.cf-slot[data-i="${nextIdx}"]`);
        if (slot) { slot.textContent = t.ch; slot.classList.add('cf-filled'); }
        advance();
        try { playSfx('click'); } catch (e) {}
        if (nextIdx >= chars.length) _finish(true);
      } else if (guards > 0) {
        // 🐾 Gefährte fängt den Fehlgriff ab — kein Fehler, keine Zeitstrafe.
        guards--;
        if (onGuardUsed) try { onGuardUsed(); } catch (e) {}
        try { playSfx('click'); } catch (e) {}
        const note = document.createElement('div');
        note.textContent = '🐾 Gefährte hilft!';
        note.style.cssText = 'position:absolute;left:50%;top:8px;transform:translateX(-50%);font-family:\'Fredoka One\',cursive;font-size:.85rem;color:#69db7c;z-index:3;';
        field.appendChild(note);
        setTimeout(() => note.remove(), 1000);
      } else {
        try { playSfx('wrong'); } catch (e) {}
        btn.classList.add('cf-shake');
        setTimeout(() => btn.classList.remove('cf-shake'), 350);
        endAt -= STORM_PENALTY_MS;
        const bar = host.querySelector('#cf-timebar');
        if (bar) { bar.style.background = '#e03131'; setTimeout(() => { bar.style.background = 'linear-gradient(90deg,#ffd43b,#f0a500)'; }, 350); }
        if (onMiss) onMiss();
      }
    };
    field.appendChild(btn);
  });

  function _tick() {
    const remain = endAt - Date.now();
    const bar = host.querySelector('#cf-timebar');
    const secs = host.querySelector('#cf-secs');
    if (bar) bar.style.width = Math.max(0, remain / timeLimitMs * 100) + '%';
    if (secs) secs.textContent = Math.max(0, Math.ceil(remain / 1000)) + 's';
    if (remain <= 0) _finish(false);
  }
  timer = setInterval(_tick, 100);

  return {
    destroy() { done = true; if (timer) clearInterval(timer); },
    pause() { if (done || pausedAt) return; pausedAt = Date.now(); clearInterval(timer); timer = null; },
    resume() { if (done || pausedAt == null) return; endAt += Date.now() - pausedAt; pausedAt = null; timer = setInterval(_tick, 100); },
  };
}
