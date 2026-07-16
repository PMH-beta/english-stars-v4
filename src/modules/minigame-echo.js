// src/modules/minigame-echo.js
// Echo-Fang — Minispiel der Kampagne (Phase 2).
// Ein englisches Wort wird vorgesprochen (TTS, speech.js), 4–5 Wörter driften durchs
// Feld — das gehörte antippen. Falscher Tipp oder Zeit abgelaufen = Welle verloren.
// Ob TTS verfügbar ist, prüft der Kampf-Wrapper VOR der Wellen-Wahl.
//
// Schnittstelle: startEcho({host, answer, speakText, choices, timeLimitMs, onResult})
// → {destroy}. choices enthält answer; onResult(success, timeLeftMs) genau einmal.

import { playSfx } from './game.js';
import { speakWord } from './speech.js';
import { ensureStormStyle } from './minigame-letterstorm.js';

export function startEcho({ host, answer, speakText, choices, timeLimitMs, onResult }) {
  ensureStormStyle();   // cfDrift-Keyframes
  let done = false, timer = null;
  const endAt = Date.now() + timeLimitMs;

  host.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:2px;">
      <div style="font-size:1.3rem;font-weight:800;color:#fff;">👂 Welches Wort hörst du?</div>
      <button id="cf-replay" title="Nochmal anhören" style="border:none;background:rgba(255,255,255,.18);border-radius:50%;width:44px;height:44px;font-size:1.3rem;cursor:pointer;">🔊</button>
    </div>
    <div style="text-align:center;font-size:.85rem;font-weight:700;color:rgba(255,255,255,.65);margin-bottom:8px;">Tippe das gehörte Wort an</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="flex:1;height:10px;background:rgba(255,255,255,.2);border-radius:6px;overflow:hidden;">
        <div id="cf-echobar" style="height:100%;width:100%;background:linear-gradient(90deg,#ffd43b,#f0a500);border-radius:6px;"></div>
      </div>
      <div id="cf-echosecs" style="font-family:'Fredoka One',cursive;color:#fff;font-size:.9rem;min-width:34px;text-align:right;"></div>
    </div>
    <div id="cf-echofield" style="position:relative;height:min(30dvh,230px);min-height:140px;border-radius:16px;background:rgba(255,255,255,.08);overflow:hidden;"></div>`;

  const speak = () => { try { speakWord(speakText || answer); } catch (e) {} };
  host.querySelector('#cf-replay').onclick = speak;
  setTimeout(() => { if (!done) speak(); }, 400);

  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    onResult(success, Math.max(0, endAt - Date.now()));
  }

  // Wort-Chips auf gemischtem Gitter platzieren, dann driften (wie Buchstabensturm).
  const field = host.querySelector('#cf-echofield');
  const cols = 2;
  const rows = Math.ceil(choices.length / cols);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }

  choices.forEach((word, k) => {
    const cell = cells[k];
    const btn = document.createElement('button');
    const x = (cell.c + 0.5) / cols * 76 + 12;
    const y = (cell.r + 0.5) / rows * 74 + 10;
    btn.style.cssText = `position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);
      border:none;background:#fff;color:#333;font-family:'Fredoka One',cursive;font-size:1rem;
      padding:10px 16px;border-radius:14px;box-shadow:0 3px 8px rgba(0,0,0,.25);cursor:pointer;
      white-space:nowrap;z-index:2;animation:cfDrift ${(2.4 + Math.random() * 2).toFixed(2)}s ease-in-out infinite alternate;
      --dx:${(Math.random() * 36 - 18).toFixed(0)}px;--dy:${(Math.random() * 30 - 15).toFixed(0)}px;`;
    btn.textContent = word;
    btn.onclick = () => {
      if (done) return;
      if (word === answer) {
        try { playSfx('correct'); } catch (e) {}
        btn.style.background = '#d3f9d8';
        _finish(true);
      } else {
        try { playSfx('wrong'); } catch (e) {}
        btn.style.background = '#ffd6d6';
        _finish(false);
      }
    };
    field.appendChild(btn);
  });

  timer = setInterval(() => {
    const remain = endAt - Date.now();
    const bar = host.querySelector('#cf-echobar');
    const secs = host.querySelector('#cf-echosecs');
    if (bar) bar.style.width = Math.max(0, remain / timeLimitMs * 100) + '%';
    if (secs) secs.textContent = Math.max(0, Math.ceil(remain / 1000)) + 's';
    if (remain <= 0) { try { playSfx('wrong'); } catch (e) {} _finish(false); }
  }, 100);

  return { destroy() { done = true; if (timer) clearInterval(timer); } };
}
