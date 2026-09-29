// src/modules/minigame-echo.js
// Echo-Fang — Minispiel der Kampagne (Phase 2).
// Ein englisches Wort wird vorgesprochen (TTS, speech.js), 4–5 Wörter driften durchs
// Feld — das gehörte antippen. Ein falscher Tipp beendet die Welle NICHT: der Chip ist
// raus, es kostet HP (onMiss), weitergesucht wird trotzdem. Verloren ist die Welle erst,
// wenn die Zeit abläuft. Ob TTS verfügbar ist, prüft der Kampf-Wrapper VOR der Wahl.
//
// Schnittstelle: startEcho({host, answer, speakText, choices, timeLimitMs, onMiss,
// onResult}) → {destroy, pause, resume}. choices enthält answer; onResult(success,
// timeLeftMs) genau einmal, onMiss bei JEDEM falschen Tipp. pause()/resume() frieren die
// Restzeit exakt ein. prompt (optional): eigener Kopf statt „Welches Wort hörst du?" —
// für die Verbform-Wellen der 🌀-Knoten.

import { playSfx } from './game.js';
import { speakWord } from './speech.js';
import { ensureStormStyle, setDrift, richtigChip } from './minigame-letterstorm.js';
import { iconHTML } from './pixel-icons.js';
import { aufgabeKarte, sekText } from './minigame-karte.js';

export function startEcho({ host, answer, speakText, choices, prompt, timeLimitMs, onMiss, onResult }) {
  ensureStormStyle();   // cfDrift-Keyframes
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + timeLimitMs;

  // Aufbau wie Fragment 7.8 (7.12 für Verbformen): Aufgabenkarte mit rundem
  // Nochmal-Hören-Knopf, darunter die treibenden Wörter. Das Lautsprecher-
  // Symbol schlägt nur bei der Wortfrage (7.8), bei Verbformen steht es.
  const hoer = `<button id="cf-replay" class="mg-hoer" title="Nochmal anhören">${iconHTML('speaker', 28)}</button>`;
  host.innerHTML = aufgabeKarte({ art: 'echo', frage: prompt || 'Welches Wort hörst du?', zeitId: 'cf-echobar', sekId: 'cf-echosecs', rechts: hoer, pochen: !prompt })
    + `<div class="mg-flaeche"><div id="cf-echofield" class="mg-feld mg-echo"></div></div>`;

  const speak = () => { try { speakWord(speakText || answer); } catch (e) {} };
  host.querySelector('#cf-replay').onclick = speak;
  setTimeout(() => { if (!done) speak(); }, 400);

  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    if (success) richtigChip(host, answer);
    onResult(success, Math.max(0, endAt - Date.now()));
  }

  // Wort-Chips auf gemischtem Gitter platzieren, dann driften (wie Buchstabensturm).
  const field = host.querySelector('#cf-echofield');
  const cols = 2;
  const rows = Math.ceil(choices.length / cols);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }

  const cellW = field.clientWidth * 0.76 / cols;
  const cellH = field.clientHeight * 0.74 / rows;

  choices.forEach((word, k) => {
    const cell = cells[k];
    const btn = document.createElement('button');
    const x = (cell.c + 0.5) / cols * 76 + 12;
    const y = (cell.r + 0.5) / rows * 74 + 10;
    btn.className = 'mg-treiber';
    btn.style.cssText = `position:absolute;left:${x}%;top:${y}%;
      animation:cfDriftC var(--dur,9s) ease-in-out var(--del,0s) infinite;`;
    btn.textContent = word;
    btn.onclick = () => {
      if (done || btn._used) return;
      if (word === answer) {
        try { playSfx('correct'); } catch (e) {}
        btn.classList.add('is-richtig');
        _finish(true);
      } else {
        // Falsches Wort: Chip ist raus und kostet HP — die übrigen treiben weiter.
        btn._used = true;
        try { playSfx('wrong'); } catch (e) {}
        btn.classList.add('is-falsch');
        if (onMiss) onMiss();
      }
    };
    field.appendChild(btn);
    // Drift so weit, wie in der Zelle wirklich Platz ist — dafür muss der Chip schon im
    // DOM hängen (offsetWidth). Kurze Wörter schweben dadurch weit, lange Wort-Chips
    // weniger, sonst schieben sie sich übereinander und sind nicht mehr lesbar.
    setDrift(btn,
      Math.max(10, Math.min(40, (cellW - btn.offsetWidth) / 2 - 4)),
      Math.max(10, Math.min(34, (cellH - btn.offsetHeight) / 2 - 4)), 7, 12);
  });

  function _tick() {
    const remain = endAt - Date.now();
    const bar = host.querySelector('#cf-echobar');
    const secs = host.querySelector('#cf-echosecs');
    if (bar) bar.style.width = Math.max(0, remain / timeLimitMs * 100) + '%';
    if (secs) secs.textContent = sekText(remain);
    if (remain <= 0) { try { playSfx('wrong'); } catch (e) {} _finish(false); }
  }
  timer = setInterval(_tick, 100);
  _tick();

  return {
    destroy() { done = true; if (timer) clearInterval(timer); },
    pause() { if (done || pausedAt) return; pausedAt = Date.now(); clearInterval(timer); timer = null; const s = host.querySelector('#cf-echosecs'); if (s) s.textContent = 'pausiert'; },
    resume() { if (done || pausedAt == null) return; endAt += Date.now() - pausedAt; pausedAt = null; timer = setInterval(_tick, 100); },
  };
}
