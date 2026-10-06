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
import { aufgabeKarte, frageDE, steinHTML, flammeHTML, abzeichenHTML, funkenHTML } from './minigame-karte.js';
import { richtigChip } from './minigame-letterstorm.js';

// Gefallen wird in harten Stufen im gemeinsamen 8-fps-Takt (Handoff-Regel 6:
// keine CSS-Übergänge auf Sprites). Die Fallzeit selbst ist unverändert.
const TAKT = 125;

export function startMeteors({ host, de, answer, choices, prompt, fallMs, onMiss, onResult }) {
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + fallMs;

  // Aufbau wie F.1: Aufgabe ohne Zeitzeile (die Zeit ist der Fall), darunter der
  // Himmel. Die Meteore kommen unter dem Panel hervor und setzen unten auf der
  // gestrichelten Einschlaglinie auf (F.4).
  host.innerHTML = aufgabeKarte({ art: 'meteore', anweisung: prompt ? 'Fange die Form' : 'Fange die Übersetzung', frage: prompt || frageDE(de) })
    + `<div class="mg-flaeche">
      <div id="cf-sky" class="mg-feld mg-himmel"><div class="mg-einschlag"></div></div>
    </div>`;

  const sky = host.querySelector('#cf-sky');
  const skyH = Math.max(190, sky.clientHeight || 300);
  const TOP0 = -80;    // Startpunkt der untersten Stufe, oberhalb des Himmels
  const STEP = 115;    // Höhe einer Versatz-Stufe (größer als ein Meteor hoch ist)
  const GAP  = 8;      // Mindest-Luft je Seite zwischen zwei Meteoren nebeneinander
  // Aufsetzpunkt: der Stein (46 hoch) liegt mit der Unterkante 6 px unter dem
  // Feldrand auf der Linie (F.4: Oberkante 40 über der Linie).
  const AUF = skyH - 40;
  const _esc = (t) => (window.escHtml ? window.escHtml(String(t)) : String(t));
  // Zustand am Stein: richtig grün mit Haken und Funken, falsch rot mit Kreuz und
  // roten Funken (wackelt), verpasst rot mit Kreuz und großem Einschlag (F.2–F.4).
  function _markiere(btn, art) {
    btn.classList.add(art === 'richtig' ? 'is-richtig' : art === 'falsch' ? 'is-falsch' : 'is-verpasst', 'ist-oben');
    const stein = btn.querySelector('.mg-stein');
    if (!stein) return;
    stein.insertAdjacentHTML('beforeend', abzeichenHTML(art === 'richtig')
      + funkenHTML(art === 'falsch' ? 'rot' : 'gold', art === 'richtig' ? 1.1 : art === 'falsch' ? 0.8 : 1.5));
    const f = stein.querySelector('.mg-funken');
    if (art === 'verpasst' && f) f.style.top = '100%';
    if (art === 'falsch') { stein.dataset.a = '2'; stein.dataset.ui = 'wiggle'; }
    setTimeout(() => f?.remove(), 1000);
  }

  const _shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Bahnen mischen, damit der richtige Meteor nicht immer an derselben Stelle fällt.
  const lanes = _shuffle(choices.map((_, i) => i));

  const btns = [];
  let startAt = 0;   // Beginn des Falls; Pausen schieben ihn nach hinten
  // Jeder Meteor steht auf der Höhe, die zu „jetzt" gehört — in harten Stufen.
  function _setzen() {
    const t = Math.max(0, Date.now() - startAt);
    btns.forEach(b => {
      const top = Math.round(Math.min(AUF, b._top0 + b._v * t));
      b.style.top = top + 'px';
      // Falsche fallen an der Linie durch (wie bisher unten aus dem Feld).
      if (!b._answer && top >= AUF) b.style.visibility = 'hidden';
    });
  }
  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    btns.forEach(b => { b.style.pointerEvents = 'none'; });
    if (success) richtigChip(host, answer);
    else {
      const a = btns.find(b => b._answer);
      if (a && Date.now() >= endAt) { a.style.top = AUF + 'px'; _markiere(a, 'verpasst'); }
    }
    onResult(success, Math.max(0, endAt - Date.now()));
  }

  choices.forEach((word, i) => {
    const isAnswer = word === answer;
    const btn = document.createElement('button');
    btn._answer = isAnswer;
    btn.className = 'mg-meteor';
    btn.style.top = TOP0 + 'px';
    btn.style.left = `${10 + (lanes[i] + 0.5) / choices.length * 80}%`;
    // Brennender Stein (F.1): die Flamme flackert je Meteor versetzt.
    btn.innerHTML = flammeHTML([0, 14, 26, 7][i % 4]) + steinHTML(_esc(word), 'orange', 'mg-stein--meteor');
    btn.onclick = () => {
      if (done || btn._used) return;
      if (isAnswer) {
        try { playSfx('correct'); } catch (e) {}
        _markiere(btn, 'richtig');
        _finish(true);
      } else {
        // Falscher Meteor: ist raus und kostet HP — der Rest fällt weiter.
        btn._used = true;
        try { playSfx('wrong'); } catch (e) {}
        _markiere(btn, 'falsch');
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
    // Die Fallzeit des RICHTIGEN (durch den Versatz ggf. länger als fallMs) ist das
    // Zeitlimit der Welle — gerechnet wie bisher bis unter das Feld.
    const dur = Math.round(dist / baseDist * fallMs);
    b._top0 = top0;
    b.style.top = top0 + 'px';
    if (b._answer) answerDur = dur;
  });
  // Alle fallen exakt gleich schnell (sonst liefe der Versatz zu) — so schnell, dass
  // der richtige genau mit Ablauf der Zeit auf der Linie aufsetzt.
  const ans = btns.find(b => b._answer);
  const v = ans ? (AUF - ans._top0) / answerDur : (AUF - TOP0) / fallMs;   // px pro ms
  btns.forEach(b => { b._v = v; });
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
