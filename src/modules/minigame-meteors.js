// src/modules/minigame-meteors.js
// Wort-Meteoriten — Minispiel der Kampagne (Phase 2).
// 3–4 Meteoriten mit englischen Wörtern fallen von oben; nur einer ist die richtige
// Übersetzung des angezeigten deutschen Worts. Richtigen antippen = Erfolg. Ein falscher
// Tipp beendet die Welle NICHT: der Meteor verglüht, es kostet HP (onMiss) und die
// übrigen fallen weiter. Verloren ist die Welle erst, wenn der richtige einschlägt.
//
// Schnittstelle: startMeteors({host, de, answer, choices, fallMs, onMiss, onResult}) →
// {destroy, pause, resume}. choices enthält answer; onResult(success, timeLeftMs) wird
// genau einmal gerufen, onMiss bei JEDEM falschen Tipp. pause()/resume() frieren auch den
// Fall exakt an der aktuellen Stelle ein (er hängt am selben Takt wie die Restzeit).
// prompt (optional): eigener Kopf statt „🇩🇪 de" — für die Verbform-Wellen der 🌀-Knoten.

import { playSfx } from './game.js';
import { aufgabeKarte, frageDE } from './minigame-karte.js';
import { meteorHTML } from './pixel-icons.js';
import { richtigChip } from './minigame-letterstorm.js';

// Gefallen wird in harten Stufen im gemeinsamen 8-fps-Takt (Handoff-Regel 6:
// keine CSS-Übergänge auf Sprites). Die Fallzeit selbst ist unverändert.
const TAKT = 125;

export function startMeteors({ host, de, answer, choices, prompt, fallMs, onMiss, onResult }) {
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + fallMs;

  // Aufbau wie Fragment 7.7: Aufgabenkarte ohne Zeitbalken (die Zeit ist der
  // Fall), darunter der Himmel. Die Maske blendet Meteore an den Rändern aus.
  host.innerHTML = aufgabeKarte({ art: 'meteore', frage: prompt || frageDE(de) })
    + `<div class="mg-flaeche">
      <div id="cf-sky" class="mg-feld" style="
        mask-image:linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%);
        -webkit-mask-image:linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%);"></div>
    </div>`;

  const sky = host.querySelector('#cf-sky');
  const skyH = Math.max(190, sky.clientHeight || 300);
  const TOP0 = -80;    // Startpunkt der untersten Stufe, oberhalb des Himmels
  const STEP = 115;    // Höhe einer Versatz-Stufe (größer als ein Meteor hoch ist)
  const GAP  = 8;      // Mindest-Luft je Seite zwischen zwei Meteoren nebeneinander

  const _shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Bahnen mischen, damit der richtige Meteor nicht immer an derselben Stelle fällt.
  const lanes = _shuffle(choices.map((_, i) => i));

  const btns = [];
  let startAt = 0;   // Beginn des Falls; Pausen schieben ihn nach hinten
  // Jeder Meteor steht auf der Höhe, die zu „jetzt" gehört — in harten Stufen.
  function _setzen() {
    const t = Math.max(0, Date.now() - startAt);
    btns.forEach(b => { b.style.top = Math.round(Math.min(skyH + 10, b._top0 + b._v * t)) + 'px'; });
  }
  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    btns.forEach(b => { b.style.pointerEvents = 'none'; });
    if (success) richtigChip(host, answer);
    onResult(success, Math.max(0, endAt - Date.now()));
  }

  choices.forEach((word, i) => {
    const isAnswer = word === answer;
    const btn = document.createElement('button');
    btn._answer = isAnswer;
    btn.className = 'mg-meteor';
    btn.style.top = TOP0 + 'px';
    btn.style.left = `${10 + (lanes[i] + 0.5) / choices.length * 80}%`;
    // Meteor 3× über dem Wort (Fragment 7.7).
    btn.innerHTML = meteorHTML(42, 'margin:0 auto') + `<div class="mg-treiber">${word}</div>`;
    btn.onclick = () => {
      if (done || btn._used) return;
      if (isAnswer) {
        try { playSfx('correct'); } catch (e) {}
        btn.lastElementChild.classList.add('is-richtig');
        _finish(true);
      } else {
        // Falscher Meteor: ist raus und kostet HP — der Rest fällt weiter.
        btn._used = true;
        try { playSfx('wrong'); } catch (e) {}
        btn.lastElementChild.classList.add('is-falsch');
        btn.style.pointerEvents = 'none';
        if (onMiss) onMiss();
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
  let answerDur = fallMs;
  btns.forEach((b, i) => {
    // Streuung obendrauf, damit die Meteore nicht auf exakt zwei Höhen einrasten; sie
    // bleibt klar unter STEP, damit zwei Stufen sich nie berühren.
    const top0 = TOP0 - perm[levels[i]] * STEP - Math.round(Math.random() * 16);
    const dist = skyH + 10 - top0;
    // Alle fallen exakt gleich schnell; unterschiedliche Fallzeiten würden den Versatz
    // während des Fallens wieder zulaufen lassen. Die Fallzeit des RICHTIGEN (durch den
    // Versatz ggf. länger als fallMs) ist das Zeitlimit der Welle.
    const dur = Math.round(dist / baseDist * fallMs);
    b._top0 = top0;
    b._v = dist / dur;   // px pro ms
    b.style.top = top0 + 'px';
    if (b._answer) answerDur = dur;
  });
  startAt = Date.now() + 60;
  endAt = startAt + answerDur;

  // Einschlag des richtigen Meteoriten = Welle verloren.
  function _tick() {
    _setzen();
    if (Date.now() >= endAt) {
      try { playSfx('wrong'); } catch (e) {}
      _finish(false);
    }
  }
  timer = setInterval(_tick, TAKT);

  return {
    destroy() { done = true; if (timer) clearInterval(timer); },
    pause() {
      if (done || pausedAt) return;
      pausedAt = Date.now();
      if (timer) { clearInterval(timer); timer = null; }
      btns.forEach(b => { b.style.pointerEvents = 'none'; });
    },
    resume() {
      if (done || pausedAt == null) return;
      const d = Date.now() - pausedAt;
      startAt += d; endAt += d;
      pausedAt = null;
      btns.forEach(b => { b.style.pointerEvents = b._used ? 'none' : ''; });   // schon verglühte bleiben tot
      timer = setInterval(_tick, TAKT);
    },
  };
}
