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

const LOCK_OK_MS = 220;    // kurze Sperre nach richtig — verhindert Doppel-Tipp
const LOCK_BAD_MS = 700;   // länger nach falsch: man soll das Paar noch sehen

let _styleDone = false;
function _ensureStyle() {
  if (_styleDone) return;
  _styleDone = true;
  const st = document.createElement('style');
  st.textContent = `
    .tf-btn { border:none; border-radius:18px; min-width:104px; padding:10px 14px 12px; cursor:pointer;
      background:#fff; box-shadow:0 4px 0 rgba(0,0,0,.18); transition:transform .12s, box-shadow .12s;
      display:flex; flex-direction:column; align-items:center; gap:2px; }
    .tf-btn:active { transform:translateY(3px); box-shadow:0 1px 0 rgba(0,0,0,.18); }
    .tf-btn .tf-ico { font-size:1.9rem; line-height:1; }
    .tf-btn .tf-lbl { font-family:'Fredoka One',cursive; font-size:.9rem; color:#333; }
    /* Punkte-Leiste: erledigte Paare voll, das laufende hervorgehoben, offene blass. */
    .tf-dot { width:10px; height:10px; border-radius:50%; background:rgba(255,255,255,.35); }
    .tf-dot.done { background:#69db7c; }
    .tf-dot.miss { background:#ff8787; }
    .tf-dot.now { background:#ffd43b; transform:scale(1.35); }
  `;
  document.head.appendChild(st);
}

export function startTrueFalse({ host, pairs, timeLimitMs, onMiss, onResult }) {
  _ensureStyle();
  let done = false, timer = null, pausedAt = null, idx = 0, locked = false;
  let endAt = Date.now() + timeLimitMs;
  const missed = [];   // Index der falsch beurteilten Paare (für die Punkte-Leiste)

  host.innerHTML = `
    <div style="display:flex;justify-content:center;margin-bottom:16px;">
      <div style="background:#fff;border-radius:16px;padding:8px 20px 10px;box-shadow:0 3px 8px rgba(0,0,0,.2);text-align:center;">
        <div style="font-size:1.5rem;font-weight:800;color:#333;">Richtig oder falsch?</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="flex:1;height:10px;background:rgba(43,35,80,.25);border-radius:6px;overflow:hidden;">
        <div id="tf-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#ffd43b,#f0a500);border-radius:6px;"></div>
      </div>
      <div id="tf-secs" style="font-family:'Fredoka One',cursive;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.4);font-size:.9rem;min-width:34px;text-align:right;"></div>
    </div>
    <div id="tf-dots" style="display:flex;justify-content:center;align-items:center;gap:8px;height:14px;margin-bottom:18px;"></div>
    <div style="display:flex;justify-content:center;margin-bottom:20px;">
      <div id="tf-card" style="background:#fff;border-radius:16px;padding:14px 20px;box-shadow:0 3px 8px rgba(0,0,0,.2);
        transition:background .2s;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;">
        <span id="tf-de" style="font-size:1.35rem;font-weight:800;color:#333;"></span>
        <span style="font-size:1.1rem;color:#bbb;">—</span>
        <span id="tf-en" style="font-family:'Fredoka One',cursive;font-size:1.35rem;color:#a86cdb;"></span>
      </div>
    </div>
    <div style="display:flex;justify-content:center;gap:20px;">
      <button id="tf-no" class="tf-btn"><span class="tf-ico">❌</span><span class="tf-lbl">falsch</span></button>
      <button id="tf-yes" class="tf-btn"><span class="tf-ico">✅</span><span class="tf-lbl">richtig</span></button>
    </div>`;

  const card = host.querySelector('#tf-card');
  const deEl = host.querySelector('#tf-de');
  const enEl = host.querySelector('#tf-en');
  const dots = host.querySelector('#tf-dots');

  function _show() {
    const p = pairs[idx];
    deEl.textContent = '🇩🇪 ' + p.de;
    enEl.textContent = p.en;
    dots.innerHTML = pairs.map((_, i) =>
      `<span class="tf-dot${missed.includes(i) ? ' miss' : i < idx ? ' done' : i === idx ? ' now' : ''}"></span>`).join('');
    // Karte poppt bei jedem Paar kurz auf — ohne das merkt man den Wechsel nicht,
    // weil sich nur der Text ändert.
    card.classList.remove('bounce-in');
    void card.offsetWidth;
    card.classList.add('bounce-in');
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
      card.style.background = '#fff';
      idx++;
      if (idx >= pairs.length) _finish(true);
      else _show();
    }, delay);
  }

  function _judge(said) {
    if (done || locked) return;
    if (said === pairs[idx].ok) {
      try { playSfx('click'); } catch (e) {}
      card.style.background = '#d3f9d8';
      _next(LOCK_OK_MS);
      return;
    }
    // Fehlurteil: kostet HP, das Paar bleibt kurz rot stehen — dann geht es weiter.
    try { playSfx('wrong'); } catch (e) {}
    card.style.background = '#ffd6d6';
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
    if (secs) secs.textContent = Math.max(0, Math.ceil(remain / 1000)) + 's';
    if (remain <= 0) { try { playSfx('wrong'); } catch (e) {} _finish(false); }
  }
  timer = setInterval(_tick, 100);

  return {
    destroy() { done = true; if (timer) clearInterval(timer); },
    pause() { if (done || pausedAt) return; pausedAt = Date.now(); clearInterval(timer); timer = null; },
    resume() { if (done || pausedAt == null) return; endAt += Date.now() - pausedAt; pausedAt = null; timer = setInterval(_tick, 100); },
  };
}
