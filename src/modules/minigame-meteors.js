// src/modules/minigame-meteors.js
// Wort-Meteoriten — Minispiel der Kampagne (Phase 2).
// 3–4 Meteoriten mit englischen Wörtern fallen von oben; nur einer ist die richtige
// Übersetzung des angezeigten deutschen Worts. Richtigen antippen = Erfolg; falscher
// Tipp oder Einschlag (der richtige erreicht den Boden) = Welle verloren.
//
// Schnittstelle: startMeteors({host, de, answer, choices, fallMs, onResult}) → {destroy,
// pause, resume}. choices enthält answer; onResult(success, timeLeftMs) wird genau einmal
// gerufen. pause()/resume() frieren auch den Fall (CSS-Transition, läuft unabhängig vom
// JS-Timer) exakt an der aktuellen Stelle ein.

import { playSfx } from './game.js';

export function startMeteors({ host, de, answer, choices, fallMs, onResult }) {
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + fallMs;

  host.innerHTML = `
    <div style="display:flex;justify-content:center;margin-bottom:16px;">
      <div style="text-align:center;background:#fff;border-radius:16px;padding:8px 20px 10px;box-shadow:0 3px 8px rgba(0,0,0,.2);">
        <div style="font-size:1.5rem;font-weight:800;color:#333;">🇩🇪 ${de}</div>
        <div style="font-size:.8rem;font-weight:700;color:#777;margin-top:2px;">☄️ Fang die richtige Übersetzung!</div>
      </div>
    </div>
    <!-- Maske statt Hardcut: Meteore faden am oberen/unteren Rand des Himmels weich
         ein bzw. aus, statt abrupt zu erscheinen/verschwinden. -->
    <div id="cf-sky" style="position:relative;height:min(42dvh,360px);min-height:190px;overflow:hidden;
      mask-image:linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%);
      -webkit-mask-image:linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%);"></div>`;

  const sky = host.querySelector('#cf-sky');
  const skyH = 300;
  const TOP0 = -80;    // Startpunkt der untersten Stufe, oberhalb des Himmels
  const STEP = 115;    // Höhe einer Versatz-Stufe (größer als ein Meteor hoch ist)
  const GAP  = 8;      // Mindest-Luft je Seite zwischen zwei Meteoren nebeneinander

  const _shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Bahnen mischen, damit der richtige Meteor nicht immer an derselben Stelle fällt.
  const lanes = _shuffle(choices.map((_, i) => i));

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
    btn._answer = isAnswer;
    btn.style.cssText = `position:absolute;top:${TOP0}px;left:${10 + (lanes[i] + 0.5) / choices.length * 80}%;
      transform:translateX(-50%);border:none;background:transparent;cursor:pointer;padding:6px;z-index:2;`;
    btn.innerHTML = `<div style="font-size:2.2rem;line-height:1;">☄️</div>
      <div style="background:#fff;color:#333;font-family:'Fredoka One',cursive;font-size:1.1rem;padding:7px 14px;border-radius:14px;box-shadow:0 3px 8px rgba(0,0,0,.25);margin-top:2px;white-space:nowrap;">${word}</div>`;
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

  // Überlappung auflösen: ein langes Wort ist breiter als seine Bahn, nebeneinander auf
  // gleicher Höhe verdecken sich die Meteore dann gegenseitig. Deshalb hier die ECHTEN
  // Chip-Breiten messen (die Buttons hängen schon im DOM) und nur die Meteore, die sich
  // wirklich schneiden, eine Stufe höher starten lassen — kurze Wörter passen nebenein-
  // ander und bleiben auf einer Höhe. Damit daraus kein lesbares Muster wird, ist die
  // Prüfreihenfolge zufällig und die belegten Stufen werden am Ende durchgetauscht:
  // welcher Meteor oben ansetzt, hängt so weder an der Bahn noch an der Antwort.
  const levels = new Array(btns.length).fill(0);
  const taken = [];   // taken[stufe] = schon belegte x-Bereiche auf dieser Stufe
  _shuffle(btns.map((b, i) => i)).forEach(i => {
    const r = btns[i].getBoundingClientRect();
    const box = { l: r.left - GAP, r: r.right + GAP };
    let lv = 0;
    while ((taken[lv] || []).some(o => box.l < o.r && box.r > o.l)) lv++;
    (taken[lv] = taken[lv] || []).push(box);
    levels[i] = lv;
  });
  const perm = _shuffle(taken.map((_, k) => k));   // Kollisionsfreiheit hängt nur daran,
                                                   // WER sich eine Stufe teilt — nicht an deren Höhe
  const baseDist = skyH + 10 - TOP0;
  btns.forEach((b, i) => {
    // Streuung obendrauf, damit die Meteore nicht auf exakt zwei Höhen einrasten; sie
    // bleibt klar unter STEP, damit zwei Stufen sich nie berühren.
    const top0 = TOP0 - perm[levels[i]] * STEP - Math.round(Math.random() * 16);
    const dist = skyH + 10 - top0;
    b.style.top = top0 + 'px';   // noch ohne transition → springt, animiert nicht
    // Alle fallen exakt gleich schnell; unterschiedliche Fallzeiten würden den Versatz
    // während des Fallens wieder zulaufen lassen. Die Fallzeit des RICHTIGEN (durch den
    // Versatz ggf. länger als fallMs) ist das Zeitlimit der Welle.
    const dur = Math.round(dist / baseDist * fallMs);
    b.style.transition = `top ${dur}ms linear`;
    b._v = dist / dur;           // px pro ms — hält die Geschwindigkeit über eine Pause hinweg
    if (b._answer) endAt = Date.now() + dur;
  });

  // Fall starten (nach Layout-Tick, damit die Transition greift). Kein JS-Fade nötig —
  // die Maske auf #cf-sky blendet Meteore am Rand automatisch weich ein/aus.
  setTimeout(() => { if (!done) btns.forEach(b => { b.style.top = (skyH + 10) + 'px'; }); }, 60);

  // Einschlag des richtigen Meteoriten = Welle verloren.
  function _tick() {
    if (Date.now() >= endAt) {
      try { playSfx('wrong'); } catch (e) {}
      _finish(false);
    }
  }
  timer = setInterval(_tick, 100);

  return {
    destroy() { done = true; if (timer) clearInterval(timer); },
    pause() {
      if (done || pausedAt) return;
      pausedAt = Date.now();
      if (timer) { clearInterval(timer); timer = null; }
      _freeze();   // hält auch den Fall an, der sonst per CSS-Transition weiterliefe
    },
    resume() {
      if (done || pausedAt == null) return;
      endAt += Date.now() - pausedAt;
      pausedAt = null;
      // Jeder Meteor bekommt SEINE Restzeit (aus eigener Position + eigener Geschwindig-
      // keit) — eine gemeinsame Restzeit würde den Höhenversatz nach einer Pause zunichte
      // machen und die Meteore wieder auf gleiche Höhe zusammenlaufen lassen.
      btns.forEach(b => {
        const ms = Math.max(0, (skyH + 10 - (parseFloat(b.style.top) || 0)) / b._v);
        b.style.pointerEvents = '';
        b.style.transition = `top ${Math.round(ms)}ms linear`;
      });
      setTimeout(() => { if (!done) btns.forEach(b => { b.style.top = (skyH + 10) + 'px'; }); }, 60);
      timer = setInterval(_tick, 100);
    },
  };
}
