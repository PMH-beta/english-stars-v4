// src/modules/minigame-meteors.js
// Wort-Meteoriten — Minispiel der Kampagne (Phase 2).
// 3–4 Meteoriten mit englischen Wörtern fallen von oben; nur einer ist die richtige
// Übersetzung des angezeigten deutschen Worts. Richtigen antippen = Erfolg; falscher
// Tipp oder Einschlag (der richtige erreicht den Boden) = Welle verloren.
//
// Schnittstelle: startMeteors({host, de, answer, choices, fallMs, onResult}) → {destroy}.
// choices enthält answer; onResult(success, timeLeftMs) wird genau einmal gerufen.

import { playSfx } from './game.js';

export function startMeteors({ host, de, answer, choices, fallMs, onResult }) {
  let done = false, timer = null;
  const endAt = Date.now() + fallMs;

  host.innerHTML = `
    <div style="text-align:center;margin-bottom:2px;">
      <div style="font-size:1.5rem;font-weight:800;color:#fff;">🇩🇪 ${de}</div>
      <div style="font-size:.85rem;font-weight:700;color:rgba(255,255,255,.65);margin:2px 0 8px;">☄️ Fang die richtige Übersetzung!</div>
    </div>
    <div id="cf-sky" style="position:relative;height:min(34dvh,270px);min-height:160px;border-radius:16px;background:rgba(255,255,255,.08);overflow:hidden;"></div>`;

  const sky = host.querySelector('#cf-sky');
  const skyH = 300;

  // Bahnen mischen, damit der richtige Meteor nicht immer an derselben Stelle fällt.
  const lanes = choices.map((_, i) => i);
  for (let i = lanes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lanes[i], lanes[j]] = [lanes[j], lanes[i]]; }

  const btns = [];
  function _freeze() {
    btns.forEach(b => {
      const top = b.getBoundingClientRect().top - sky.getBoundingClientRect().top;
      b.style.transition = 'none';
      b.style.top = top + 'px';
      b.style.pointerEvents = 'none';
    });
  }
  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    _freeze();
    onResult(success, Math.max(0, endAt - Date.now()));
  }

  choices.forEach((word, i) => {
    const isAnswer = word === answer;
    const btn = document.createElement('button');
    btn.style.cssText = `position:absolute;top:-80px;left:${(lanes[i] + 0.5) / choices.length * 100}%;
      transform:translateX(-50%);border:none;background:transparent;cursor:pointer;padding:6px;z-index:2;`;
    btn.innerHTML = `<div style="font-size:1.7rem;line-height:1;">☄️</div>
      <div style="background:#fff;color:#333;font-family:'Fredoka One',cursive;font-size:.95rem;padding:6px 12px;border-radius:12px;box-shadow:0 3px 8px rgba(0,0,0,.25);margin-top:2px;white-space:nowrap;">${word}</div>`;
    // Falsche Meteoriten fallen leicht unterschiedlich schnell (nur Optik) —
    // die Fallzeit des RICHTIGEN ist das Zeitlimit der Welle.
    const dur = isAnswer ? fallMs : Math.round(fallMs * (0.9 + Math.random() * 0.25));
    btn.style.transition = `top ${dur}ms linear`;
    btn.onclick = () => {
      if (done) return;
      if (isAnswer) {
        try { playSfx('correct'); } catch (e) {}
        btn.firstElementChild.textContent = '💥';
        _finish(true);
      } else {
        try { playSfx('wrong'); } catch (e) {}
        btn.lastElementChild.style.background = '#ffd6d6';
        _finish(false);
      }
    };
    sky.appendChild(btn);
    btns.push(btn);
  });

  // Fall starten (nach Layout-Tick, damit die Transition greift).
  setTimeout(() => { if (!done) btns.forEach(b => { b.style.top = (skyH + 10) + 'px'; }); }, 60);

  // Einschlag des richtigen Meteoriten = Welle verloren.
  timer = setInterval(() => {
    if (Date.now() >= endAt) {
      try { playSfx('wrong'); } catch (e) {}
      _finish(false);
    }
  }, 100);

  return { destroy() { done = true; if (timer) clearInterval(timer); } };
}
