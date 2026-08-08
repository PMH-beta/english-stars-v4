// src/modules/minigame-truefalse.js
// Stimmt das? — Minispiel der Kampagne (Phase 3).
// Wortpaare nacheinander beurteilen: oben das deutsche Wort, darunter eine englische
// Übersetzung — passt sie (✅) oder nicht (❌)? Ein Fehlurteil beendet die Welle sofort
// (wie der falsche Meteorit), alle Paare richtig = Welle gewonnen. Die Zeit läuft über
// die GANZE Welle, nicht je Paar — Tempo ist Teil der Aufgabe.
//
// Schnittstelle: startTrueFalse({host, pairs, timeLimitMs, onResult}) → {destroy, pause,
// resume}. pairs = [{de, en, ok}] in Spielreihenfolge (ok = das Paar stimmt);
// onResult(success, timeLeftMs) wird genau einmal gerufen. pause()/resume() frieren die
// Restzeit exakt ein.

import { playSfx } from './game.js';

let _styleDone = false;
function _ensureStyle() {
  if (_styleDone) return;
  _styleDone = true;
  const st = document.createElement('style');
  st.textContent = `
    .tf-btn { border:none; border-radius:18px; width:88px; height:72px; font-size:2rem; cursor:pointer;
      background:#fff; box-shadow:0 4px 0 rgba(0,0,0,.18); transition:transform .12s, box-shadow .12s; }
    .tf-btn:active { transform:translateY(3px); box-shadow:0 1px 0 rgba(0,0,0,.18); }
    /* Punkte-Leiste: erledigte Paare voll, das laufende hervorgehoben, offene blass. */
    .tf-dot { width:10px; height:10px; border-radius:50%; background:rgba(255,255,255,.35); }
    .tf-dot.done { background:#69db7c; }
    .tf-dot.now { background:#ffd43b; transform:scale(1.35); }
  `;
  document.head.appendChild(st);
}

export function startTrueFalse({ host, pairs, timeLimitMs, onResult }) {
  _ensureStyle();
  let done = false, timer = null, pausedAt = null, idx = 0;
  let endAt = Date.now() + timeLimitMs;

  host.innerHTML = `
    <div style="display:flex;justify-content:center;margin-bottom:16px;">
      <div id="tf-card" style="background:#fff;border-radius:16px;padding:12px 22px 14px;box-shadow:0 3px 8px rgba(0,0,0,.2);
        text-align:center;min-width:min(260px,72vw);transition:background .2s;">
        <div id="tf-de" style="font-size:1.5rem;font-weight:800;color:#333;"></div>
        <div style="height:2px;background:#eee;margin:8px auto;width:60%;"></div>
        <div id="tf-en" style="font-family:'Fredoka One',cursive;font-size:1.5rem;color:#a86cdb;"></div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="flex:1;height:10px;background:rgba(43,35,80,.25);border-radius:6px;overflow:hidden;">
        <div id="tf-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#ffd43b,#f0a500);border-radius:6px;"></div>
      </div>
      <div id="tf-secs" style="font-family:'Fredoka One',cursive;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.4);font-size:.9rem;min-width:34px;text-align:right;"></div>
    </div>
    <div id="tf-dots" style="display:flex;justify-content:center;align-items:center;gap:8px;height:14px;margin-bottom:16px;"></div>
    <div style="display:flex;justify-content:center;gap:20px;">
      <button id="tf-no" class="tf-btn">❌</button>
      <button id="tf-yes" class="tf-btn">✅</button>
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
      `<span class="tf-dot${i < idx ? ' done' : i === idx ? ' now' : ''}"></span>`).join('');
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

  function _judge(said) {
    if (done) return;
    const p = pairs[idx];
    if (said !== p.ok) {
      // Fehlurteil: kurz rot zeigen, WELCHES Paar es war, dann ist die Welle vorbei.
      try { playSfx('wrong'); } catch (e) {}
      card.style.background = '#ffd6d6';
      _finish(false);
      return;
    }
    try { playSfx('click'); } catch (e) {}
    card.style.background = '#d3f9d8';
    setTimeout(() => { if (!done) card.style.background = '#fff'; }, 160);
    idx++;
    if (idx >= pairs.length) { _finish(true); return; }
    _show();
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
