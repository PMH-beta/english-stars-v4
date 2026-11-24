// src/modules/minigame-echo.js
// Echo-Fang — Minispiel der Kampagne (Phase 2).
// 4–5 englische Wörter driften durchs Feld — das passende zur Frage antippen.
// Ein falscher Tipp beendet die Welle NICHT: der Chip ist raus, es kostet HP (onMiss),
// weitergesucht wird trotzdem. Verloren ist die Welle erst, wenn die Zeit abläuft.
// Ob TTS verfügbar ist, prüft der Kampf-Wrapper VOR der Wahl.
//
// Schnittstelle: startEcho({host, de, answer, speakText, choices, prompt, timeLimitMs,
// onMiss, onResult}) → {destroy, pause, resume}. choices enthält answer; onResult(success,
// timeLeftMs) genau einmal, onMiss bei JEDEM falschen Tipp. pause()/resume() frieren die
// Restzeit exakt ein. prompt (optional): Verbform-Welle der 🌀-Knoten statt de.
//
// K-9 (24.11.2026): Echo prüft jetzt Wissen. Die Frage zeigt das deutsche Wort (de)
// bzw. bei Verbformen „go → Simple Past" (prompt), vorgesprochen wird NICHTS — das
// gehörte Wort wäre die Lösung. Das „Echo" kommt nach der Welle: das richtige Wort
// wird einmal vorgesprochen (gewonnen wie verloren).

import { playSfx } from './game.js';
import { speakWord } from './speech.js';
import { ensureStormStyle, setDrift, richtigChip, loesungChip } from './minigame-letterstorm.js';
import { aufgabeKarte, frageDE, sekText, blasenBalken, abzeichenHTML, passeAufgabe, passend } from './minigame-karte.js';

export function startEcho({ host, de, answer, speakText, choices, prompt, timeLimitMs, onMiss, onResult }) {
  ensureStormStyle();   // cfDrift-Keyframes
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + timeLimitMs;

  // Aufbau wie Meteoriten (F.1): Frage = deutsches Wort bzw. Verbform, Zeitzeile,
  // darunter die treibenden Wörter (Blasen wie F.5).
  host.innerHTML = aufgabeKarte({ art: 'echo', anweisung: prompt ? 'Fange die Form' : 'Fange die Übersetzung',
    frage: prompt || frageDE(de), zeitId: 'cf-echobar', sekId: 'cf-echosecs' })
    + `<div class="mg-flaeche"><div id="cf-echofield" class="mg-feld mg-echo"></div></div>`;
  passeAufgabe(host);

  const speak = () => { try { speakWord(speakText || answer); } catch (e) {} };

  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    if (success) richtigChip(host, answer);
    else loesungChip(host, answer);
    speak();   // das Echo: jetzt erst hört man das Wort
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
