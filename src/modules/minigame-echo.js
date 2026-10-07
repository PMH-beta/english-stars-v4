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
// Restzeit exakt ein. verb (optional): Verbform-Welle der 🌀-Knoten — die Frage heißt
// dann „Welche Form hörst du?" und zeigt das Verb vor dem Hörbild (F.10).

import { playSfx } from './game.js';
import { speakWord } from './speech.js';
import { ensureStormStyle, setDrift, richtigChip } from './minigame-letterstorm.js';
import { iconHTML } from './pixel-icons.js';
import { aufgabeKarte, frageHoeren, sekText, blasenBalken, abzeichenHTML, passeAufgabe, passend } from './minigame-karte.js';

export function startEcho({ host, answer, speakText, choices, verb, timeLimitMs, onMiss, onResult }) {
  ensureStormStyle();   // cfDrift-Keyframes
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + timeLimitMs;

  // Aufbau wie F.5 (F.10 für Verbformen): an der Stelle der Kachel der runde
  // Hör-Knopf mit zwei Ringen und schlagendem Lautsprecher, als Frage das Hörbild,
  // darunter die treibenden Wörter.
  const hoer = `<span class="mg-hoer-platz"><span class="mg-hoer-ring" data-ui="ring" data-a="12" data-c="12"></span>`
    + `<span class="mg-hoer-ring" data-ui="ring" data-a="12" data-c="12" data-d="6"></span>`
    + `<button id="cf-replay" class="mg-hoer" title="Nochmal anhören">${iconHTML('speaker', 28).replace('<canvas ', '<canvas data-ui="beat" data-c="8" data-a="2" ')}</button></span>`;
  host.innerHTML = aufgabeKarte({ art: 'echo', anweisung: verb ? 'Welche Form hörst du?' : 'Welches Wort hörst du?',
    frage: frageHoeren(verb || ''), kachel: hoer, zeitId: 'cf-echobar', sekId: 'cf-echosecs' })
    + `<div class="mg-flaeche"><div id="cf-echofield" class="mg-feld mg-echo"></div></div>`;
  passeAufgabe(host);

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
  // Grenze fürs Überlappen (08.10.2026): zwei Blasen dürfen sich auch beim Treiben
  // höchstens zu 20 % verdecken. Erst werden alle Blasen gebaut und gemessen
  // (lange Wörter Schrift 16 → 13), dann entscheidet die breiteste: passt sie
  // zweimal nebeneinander, zwei Spalten, sonst eine. Treiben nur so weit, wie die
  // Grenze erlaubt.
  const field = host.querySelector('#cf-echofield');
  const feldB = field.clientWidth * 0.76, feldH = field.clientHeight * 0.74;
  const blasen = choices.map((word) => {
    const btn = document.createElement('button');
    // Blase wie F.5: blau mit Glanzpunkten und Mini-Hörbild; treibt wie bisher.
    btn.className = 'mg-blase';
    btn.style.animation = 'cfDriftC var(--dur,9s) ease-in-out var(--del,0s) infinite';
    btn.innerHTML = blasenBalken + '<span></span>';
    btn.lastElementChild.textContent = word;
    btn.onclick = () => {
      if (done || btn._used) return;
      if (word === answer) {
        try { playSfx('correct'); } catch (e) {}
        btn.classList.add('is-richtig');
        btn.insertAdjacentHTML('beforeend', abzeichenHTML(true));
        _finish(true);
      } else {
        // Falsches Wort: Blase ist raus (rot mit Kreuz) und kostet HP — die
        // übrigen treiben weiter.
        btn._used = true;
        try { playSfx('wrong'); } catch (e) {}
        btn.classList.add('is-falsch');
        btn.insertAdjacentHTML('beforeend', abzeichenHTML(false));
        if (onMiss) onMiss();
      }
    };
    field.appendChild(btn);
    const wortEl = btn.lastElementChild;
    passend(wortEl, feldB / 2 - 8 - (btn.offsetWidth - wortEl.offsetWidth), [13]);
    return btn;
  });

  const MIN_DRIFT = 6;
  const maxB = Math.max(...blasen.map((b) => b.offsetWidth));
  const cols = 0.8 * maxB + 2 * MIN_DRIFT <= feldB / 2 ? 2 : 1;
  const rows = Math.ceil(choices.length / cols);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const cellW = feldB / cols;
  const cellH = feldH / rows;

  blasen.forEach((btn, k) => {
    const cell = cells[k];
    const x = (cell.c + 0.5) / cols * 76 + 12;
    const y = (cell.r + 0.5) / rows * 74 + 10;
    const driftX = Math.max(0, Math.min(40, (cellW - 0.8 * maxB) / 2));
    const driftY = Math.max(0, Math.min(34, (cellH - 0.8 * btn.offsetHeight) / 2));
    // Mitte so weit nach innen, dass die Blase auch beim Treiben ganz im Feld liegt.
    const halb = btn.offsetWidth / 2 + driftX;
    const mitte = field.clientWidth >= 2 * halb
      ? Math.min(field.clientWidth - halb, Math.max(halb, x / 100 * field.clientWidth))
      : field.clientWidth / 2;
    btn.style.left = Math.round(mitte) + 'px';
    btn.style.top = y + '%';
    setDrift(btn, driftX, driftY, 7, 12);
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
