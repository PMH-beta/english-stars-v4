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
import { aufgabeKarte, frageDE, steinHTML, flammeHTML, abzeichenHTML, funkenHTML, passeAufgabe, passend } from './minigame-karte.js';
import { richtigChip } from './minigame-letterstorm.js';

// Gefallen wird im Takt des Bildschirms (requestAnimationFrame), nicht mehr in
// 8-fps-Stufen: die Wörter sollen sich im Fallen gut lesen lassen (Wunsch des
// Nutzers, 08.10.2026). Die Fallzeit selbst ist unverändert.

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
  passeAufgabe(host);

  const sky = host.querySelector('#cf-sky');
  const skyH = Math.max(190, sky.clientHeight || 300);
  const TOP0 = -56;    // Start knapp über dem Himmel: Stein und Flamme gerade verdeckt
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
  // Jeder Meteor steht auf der Höhe, die zu „jetzt" gehört.
  function _setzen() {
    const t = Math.max(0, Date.now() - startAt);
    btns.forEach(b => {
      const top = Math.min(AUF, b._top0 + b._v * t);
      b.style.top = top + 'px';
      // Falsche fallen an der Linie durch (wie bisher unten aus dem Feld).
      if (!b._answer && top >= AUF) b.style.visibility = 'hidden';
    });
  }
  function _finish(success) {
    if (done) return;
    done = true;
    _halt();
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

  // Lange Wörter: ein Stein ist höchstens halb so breit wie der Himmel (Schrift
  // 16 → 13) und liegt immer ganz im Feld — die Mitte rückt dafür nach innen.
  const himmelW = sky.clientWidth;
  btns.forEach(b => {
    passend(b.querySelector('.mg-stein-flaeche'), himmelW / 2, [13]);
    const halb = b.offsetWidth / 2;
    const mitte = parseFloat(b.style.left) / 100 * himmelW;
    if (himmelW >= 2 * halb) b.style.left = Math.round(Math.min(himmelW - halb, Math.max(halb, mitte))) + 'px';
  });

  // Versatz (wie vor dem Update, jetzt immer): jeder Meteor startet zufällig ein Stück
  // höher, bis knapp die Hälfte der Himmelshöhe — gerechnet am Feld, damit es auf
  // kleinen Bildschirmen genauso wirkt wie auf großen. Zwei Meteore, die sich
  // waagerecht schneiden (lange Wörter), halten senkrecht mindestens ABSTAND; die
  // Prüfreihenfolge ist zufällig, damit kein Muster entsteht.
  const STREU = Math.round(skyH * 0.45);
  const ABSTAND = 70;   // Stein 46 + Flamme + Luft
  const breite = btns.map(b => ({ l: b.offsetLeft - b.offsetWidth / 2 - GAP, r: b.offsetLeft + b.offsetWidth / 2 + GAP }));
  const start = btns.map(() => null);
  _shuffle(btns.map((b, i) => i)).forEach(i => {
    const nah = start.filter((y, j) => y != null && breite[i].l < breite[j].r && breite[i].r > breite[j].l);
    let y = null;
    for (let k = 0; k < 24 && y == null; k++) {
      const t = TOP0 - Math.round(Math.random() * STREU);
      if (nah.every(o => Math.abs(o - t) >= ABSTAND)) y = t;
    }
    start[i] = y != null ? y : Math.min(...nah) - ABSTAND;
  });
  btns.forEach((b, i) => { b._top0 = start[i]; b.style.top = start[i] + 'px'; });
  // Alle fallen gleich schnell (sonst liefe der Versatz zu) — so schnell, dass der
  // richtige genau nach fallMs auf der Linie aufsetzt. Die Zeit der Welle hängt so
  // nicht mehr davon ab, wie weit oben er zufällig startet.
  const ans = btns.find(b => b._answer);
  const answerDur = fallMs;
  const v = (AUF - (ans ? ans._top0 : TOP0)) / fallMs;   // px pro ms
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
  function _lauf() { timer = requestAnimationFrame(() => { timer = null; if (done) return; _tick(); if (!done) _lauf(); }); }
  function _halt() { if (timer) cancelAnimationFrame(timer); timer = null; }
  _lauf();

  return {
    destroy() { done = true; _halt(); },
    pause() {
      if (done || pausedAt) return;
      pausedAt = Date.now();
      _halt();
      btns.forEach(b => { b.style.pointerEvents = 'none'; });
    },
    resume() {
      if (done || pausedAt == null) return;
      const d = Date.now() - pausedAt;
      startAt += d; endAt += d;
      pausedAt = null;
      btns.forEach(b => { b.style.pointerEvents = b._used ? 'none' : ''; });   // schon verglühte bleiben tot
      _lauf();
    },
  };
}
