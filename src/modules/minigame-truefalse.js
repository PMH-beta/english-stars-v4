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
import { aufgabeKarte, sekText, steinHTML } from './minigame-karte.js';

const LOCK_OK_MS = 220;    // kurze Sperre nach richtig — verhindert Doppel-Tipp
const LOCK_BAD_MS = 700;   // länger nach falsch: man soll das Paar noch sehen

// Wort im Papier-Stein: lange Wörter werden kleiner statt über den Rand zu laufen
// (wie die Lücken-Kacheln in 5.10) — 28 → 24 → 20 → 16 px.
function _passend(el) {
  el.style.fontSize = '';
  const flaeche = el.closest('.mg-stein-flaeche');
  for (const px of [24, 20, 16]) {
    if (!flaeche || flaeche.scrollWidth <= flaeche.clientWidth) return;
    el.style.fontSize = px + 'px';
  }
}

export function startTrueFalse({ host, pairs, timeLimitMs, onMiss, onResult }) {
  let done = false, timer = null, pausedAt = null, idx = 0, locked = false;
  let endAt = Date.now() + timeLimitMs;
  const missed = [];   // Index der falsch beurteilten Paare (für die Punkte-Leiste)

  // Aufbau wie F.6: Aufgabe oben, im Feld das Paar als zwei Papier-Steine mit
  // pulsierendem „?" dazwischen, darunter Falsch (rot) und Richtig (grün). Die
  // Punkte für die Paare der Welle bleiben (F-64 offen).
  const wort = (sprache, id) => `<span class="tf-wort"><span class="tf-wort-sprache">${sprache}</span><span id="${id}" class="tf-wort-text"></span></span>`;
  const knopf = (icon, text) => `<span class="tf-symbol">${iconHTML(icon, 14)}</span>${text}`;
  host.innerHTML = aufgabeKarte({ art: 'richtig', anweisung: 'Richtig oder falsch?', frage: 'Passt das Paar?', text: true, zeitId: 'tf-bar', sekId: 'tf-secs' })
    + `<div class="mg-flaeche"><div class="tf-flaeche">
      <div id="tf-dots" class="tf-punkte"></div>
      <i class="tf-luft" style="flex:55 1 0"></i>
      <div id="tf-card" class="tf-paar">
        <div data-ui="bob" data-a="1.5">${steinHTML(wort('DE', 'tf-de'), 'papier', 'mg-stein--paar')}</div>
        <span id="tf-zeichen" class="tf-frage" data-ui="pulse" data-a="6">?</span>
        <div data-ui="bob" data-a="1.5" data-d="2">${steinHTML(wort('EN', 'tf-en'), 'papier', 'mg-stein--paar')}</div>
      </div>
      <i class="tf-luft" style="flex:56 1 0"></i>
      <div class="tf-knoepfe">
        <button id="tf-no" class="tf-btn">${steinHTML(knopf('close', 'Falsch'), 'rot', 'mg-stein--knopf')}</button>
        <button id="tf-yes" class="tf-btn">${steinHTML(knopf('check', 'Richtig'), 'gruen', 'mg-stein--knopf')}</button>
      </div>
      <i class="tf-luft" style="flex:90 1 0"></i>
    </div></div>`;

  const card = host.querySelector('#tf-card');
  const deEl = host.querySelector('#tf-de');
  const enEl = host.querySelector('#tf-en');
  const dots = host.querySelector('#tf-dots');
  const zeichen = host.querySelector('#tf-zeichen');

  // Antwort sichtbar machen (E.5/E.6): beide Steine grün bzw. rot, statt „?" ein
  // Haken bzw. Kreuz. null = zurück zur Frage.
  function _faerben(ok) {
    card.classList.toggle('is-richtig', ok === true);
    card.classList.toggle('is-falsch', ok === false);
    zeichen.classList.toggle('ist-ok', ok === true);
    zeichen.classList.toggle('ist-falsch', ok === false);
    if (ok == null) { zeichen.textContent = '?'; zeichen.dataset.ui = 'pulse'; }
    else { zeichen.innerHTML = iconHTML(ok ? 'check' : 'close', 14); delete zeichen.dataset.ui; zeichen.style.transform = ''; }
  }

  function _show() {
    const p = pairs[idx];
    deEl.textContent = p.de;
    enEl.textContent = p.en;
    _passend(deEl);
    _passend(enEl);
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
      _faerben(null);
      idx++;
      if (idx >= pairs.length) _finish(true);
      else _show();
    }, delay);
  }

  function _judge(said) {
    if (done || locked) return;
    if (said === pairs[idx].ok) {
      try { playSfx('click'); } catch (e) {}
      _faerben(true);
      _next(LOCK_OK_MS);
      return;
    }
    // Fehlurteil: kostet HP, das Paar bleibt kurz rot stehen — dann geht es weiter.
    try { playSfx('wrong'); } catch (e) {}
    _faerben(false);
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
