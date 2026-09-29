// src/modules/minigame-truefalse.js
// Richtig oder falsch? — Minispiel der Kampagne (Phase 3).
// Wortpaare nacheinander beurteilen: deutsches Wort und eine englische Übersetzung
// nebeneinander — passt sie (✅ richtig) oder nicht (❌ falsch)? Ein Fehlurteil beendet
// die Welle NICHT: es kostet HP (onMiss), danach kommt das nächste Paar. Alle Paare
// durch = Welle gewonnen; verloren ist sie nur, wenn die Zeit ausgeht. Die Zeit läuft
// über die GANZE Welle, nicht je Paar — Tempo ist Teil der Aufgabe.
//
// Schnittstelle: startTrueFalse({host, pairs, timeLimitMs, onMiss, onResult}) → {destroy,
// pause, resume}. pairs = [{de, en, ok}] in Spielreihenfolge (ok = das Paar stimmt);
// onResult(success, timeLeftMs) wird genau einmal gerufen, onMiss bei JEDEM Fehlurteil.
// pause()/resume() frieren die Restzeit exakt ein.

import { playSfx } from './game.js';
import { iconHTML } from './pixel-icons.js';
import { aufgabeKarte, sekText } from './minigame-karte.js';

const LOCK_OK_MS = 220;    // kurze Sperre nach richtig — verhindert Doppel-Tipp
const LOCK_BAD_MS = 700;   // länger nach falsch: man soll das Paar noch sehen

// Aussehen in style.css (Fragment 7.9); eingespritzt wird nur, was die Knöpfe
// zum Spalten-Knopf macht.
let _styleDone = false;
function _ensureStyle() {
  if (_styleDone) return;
  _styleDone = true;
  const st = document.createElement('style');
  st.textContent = `
    .tf-btn { cursor:pointer; box-shadow:none; display:flex; flex-direction:column; align-items:center; }
    .tf-btn .tf-ico { font-size:0; line-height:1; display:flex; }
  `;
  document.head.appendChild(st);
}

export function startTrueFalse({ host, pairs, timeLimitMs, onMiss, onResult }) {
  _ensureStyle();
  let done = false, timer = null, pausedAt = null, idx = 0, locked = false;
  let endAt = Date.now() + timeLimitMs;
  const missed = [];   // Index der falsch beurteilten Paare (für die Punkte-Leiste)

  // Aufbau wie Fragment 7.9: Aufgabenkarte, darunter mittig Punkte, Paar, Knöpfe.
  host.innerHTML = aufgabeKarte({ art: 'richtig', frage: 'Passt das Paar?', zeitId: 'tf-bar', sekId: 'tf-secs' })
    + `<div class="mg-flaeche"><div class="tf-flaeche">
      <div id="tf-dots" class="tf-punkte"></div>
      <div id="tf-card" class="mg-wortkarte">
        <span id="tf-de" class="mg-wort-de"></span>
        <span class="mg-wort-strich">—</span>
        <span id="tf-en" class="mg-wort-en"></span>
      </div>
      <div class="tf-knoepfe">
        <button id="tf-no" class="tf-btn"><span class="tf-ico">${iconHTML('close', 28)}</span><span class="tf-lbl">falsch</span></button>
        <button id="tf-yes" class="tf-btn"><span class="tf-ico">${iconHTML('check', 28)}</span><span class="tf-lbl">richtig</span></button>
      </div>
    </div></div>`;

  const card = host.querySelector('#tf-card');
  const deEl = host.querySelector('#tf-de');
  const enEl = host.querySelector('#tf-en');
  const dots = host.querySelector('#tf-dots');

  function _show() {
    const p = pairs[idx];
    deEl.textContent = p.de;
    enEl.textContent = p.en;
    dots.innerHTML = pairs.map((_, i) =>
      `<span class="tf-dot${missed.includes(i) ? ' miss' : i < idx ? ' done' : i === idx ? ' now' : ''}"></span>`).join('');
  }

  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    host.querySelector('#tf-no').disabled = true;
    host.querySelector('#tf-yes').disabled = true;
    onResult(success, Math.max(0, endAt - Date.now()));
  }

  // Nach der Rückmeldung zum nächsten Paar — oder fertig, wenn keins mehr kommt.
  function _next(delay) {
    locked = true;
    setTimeout(() => {
      if (done) return;
      locked = false;
      card.style.background = '';
      idx++;
      if (idx >= pairs.length) _finish(true);
      else _show();
    }, delay);
  }

  function _judge(said) {
    if (done || locked) return;
    if (said === pairs[idx].ok) {
      try { playSfx('click'); } catch (e) {}
      card.style.background = 'var(--p-ok)';
      _next(LOCK_OK_MS);
      return;
    }
    // Fehlurteil: kostet HP, das Paar bleibt kurz rot stehen — dann geht es weiter.
    try { playSfx('wrong'); } catch (e) {}
    card.style.background = 'var(--p-falsch)';
    missed.push(idx);
    if (onMiss) onMiss();
    if (!done) _next(LOCK_BAD_MS);   // onMiss kann tödlich sein → Kampf schon vorbei
  }

  host.querySelector('#tf-no').onclick = () => _judge(false);
  host.querySelector('#tf-yes').onclick = () => _judge(true);
  _show();

  function _tick() {
    const remain = endAt - Date.now();
    const bar = host.querySelector('#tf-bar');
    const secs = host.querySelector('#tf-secs');
    if (bar) bar.style.width = Math.max(0, remain / timeLimitMs * 100) + '%';
    if (secs) secs.textContent = sekText(remain);
    if (remain <= 0) { try { playSfx('wrong'); } catch (e) {} _finish(false); }
  }
  timer = setInterval(_tick, 100);
  _tick();

  return {
    destroy() { done = true; if (timer) clearInterval(timer); },
    pause() { if (done || pausedAt) return; pausedAt = Date.now(); clearInterval(timer); timer = null; const s = host.querySelector('#tf-secs'); if (s) s.textContent = 'pausiert'; },
    resume() { if (done || pausedAt == null) return; endAt += Date.now() - pausedAt; pausedAt = null; timer = setInterval(_tick, 100); },
  };
}
