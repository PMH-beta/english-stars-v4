// src/modules/minigame-letterstorm.js
// Buchstabensturm — Kern-Minispiel der Kampagne (Phase 1).
// Die Buchstaben des englischen Zielworts schweben driftend im Feld; das Kind tippt
// sie in der richtigen Reihenfolge an, getroffene füllen die Wortleiste unten.
// Falscher Buchstabe = Schütteln + Zeitstrafe. Zeit abgelaufen = Welle verloren.
// Touch-first, Drift über CSS-Transforms. KEIN Mastery/EMA-Schreiben — eine Welle
// ist einmalig richtig oder falsch.
//
// Schnittstelle: startLetterstorm({host, de, en, timeLimitMs, onResult}) → {destroy,
// pause, resume}. onResult(success, timeLeftMs) wird genau einmal gerufen. pause()/
// resume() frieren die Restzeit exakt ein (z. B. während eines Bestätigungs-Dialogs).

import { playSfx } from './game.js';
import { speakWord } from './speech.js';
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
    @keyframes cfShake { 0%,100% { translate: 0 0; } 25% { translate: -6px 0; } 75% { translate: 6px 0; } }
    .cf-tile { position:absolute; width:46px; height:46px; border-radius:12px; border:none;
      background:#fff; color:#333; font-family:'Fredoka One',cursive; font-size:1.35rem;
      box-shadow:0 3px 8px rgba(0,0,0,.25); cursor:pointer; padding:0; z-index:2;
      animation: cfDrift var(--dur) ease-in-out infinite alternate; transition: opacity .25s, scale .25s; }
    .cf-tile.cf-hit { opacity:0; scale:.3; pointer-events:none; }
    .cf-tile.cf-shake { background:#ffd6d6; }
    .cf-tile.cf-shake span { display:inline-block; animation: cfShake .3s ease; }
  `;
  document.head.appendChild(st);
}

// prompt (optional): eigener Kopf statt „🇩🇪 de" — für Verbform-Wellen
// („go → Simple Past?"); sub (optional): kleine Zusatzzeile darunter.
// guards (optional): so viele Fehlgriffe fängt der 🐾 Gefährte ab (keine Strafe);
// onGuardUsed wird je verbrauchtem Guard gerufen (Kampf merkt sich das pro Kampf).
export function startLetterstorm({ host, de, en, prompt, sub, timeLimitMs, guards = 0, onGuardUsed, onResult }) {
  ensureStormStyle();
  const target = stormTarget(en);
  const chars = target.split('');
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + timeLimitMs;

  // Leerzeichen (Mehrwort-Antworten) sind in der Leiste vorgegeben — kein Tile.
  const tappable = chars.map((ch, i) => ({ ch, i })).filter(x => x.ch !== ' ');
  const slotHtml = chars.map((ch, i) => ch === ' '
    ? '<span style="width:12px;"></span>'
    : `<span class="cf-slot" data-i="${i}" style="min-width:22px;border-bottom:3px solid rgba(255,255,255,.7);font-family:'Fredoka One',cursive;font-size:1.3rem;color:#fff;text-align:center;padding:0 2px;">&nbsp;</span>`).join('');

  host.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:${sub ? 2 : 8}px;">
      <div style="font-size:1.5rem;font-weight:800;color:#fff;">${prompt || `🇩🇪 ${de}`}</div>
      <button id="cf-speak" title="Wort anhören" style="border:none;background:rgba(255,255,255,.18);border-radius:50%;width:38px;height:38px;font-size:1.1rem;cursor:pointer;">🔊</button>
    </div>
    ${sub ? `<div style="text-align:center;font-size:.85rem;font-weight:700;color:rgba(255,255,255,.65);margin-bottom:8px;">${sub}</div>` : ''}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="flex:1;height:10px;background:rgba(255,255,255,.2);border-radius:6px;overflow:hidden;">
        <div id="cf-timebar" style="height:100%;width:100%;background:linear-gradient(90deg,#ffd43b,#f0a500);border-radius:6px;"></div>
      </div>
      <div id="cf-secs" style="font-family:'Fredoka One',cursive;color:#fff;font-size:.9rem;min-width:34px;text-align:right;"></div>
    </div>
    <div id="cf-field" style="position:relative;height:min(30dvh,230px);min-height:140px;border-radius:16px;background:rgba(255,255,255,.08);overflow:hidden;"></div>
    <div id="cf-slots" style="display:flex;justify-content:center;gap:6px;margin-top:12px;flex-wrap:wrap;">${slotHtml}</div>`;

  host.querySelector('#cf-speak').onclick = () => { try { speakWord(target); } catch (e) {} };

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
        const slot = host.querySelector(`.cf-slot[data-i="${nextIdx}"]`);
        if (slot) { slot.textContent = t.ch; slot.style.borderBottomColor = '#69db7c'; }
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
