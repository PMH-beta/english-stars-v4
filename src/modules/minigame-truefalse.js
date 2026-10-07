// src/modules/minigame-truefalse.js
// Richtig oder falsch? — Minispiel der Kampagne (Phase 3).
// Wortpaare nacheinander beurteilen: deutsches Wort und eine englische Übersetzung
// nebeneinander — passt sie (✅ richtig) oder nicht (❌ falsch)? Ein Fehlurteil beendet
// die Welle NICHT: es kostet HP (onMiss), danach kommt das nächste Paar. Alle Paare
// durch = Welle fertig (der Held greift schon je richtigem Paar an, siehe
// campaign-fight.js); verloren ist sie nur, wenn die Zeit ausgeht. Die Zeit läuft
// über die GANZE Welle, nicht je Paar — Tempo ist Teil der Aufgabe.
//
// Schnittstelle: startTrueFalse({host, pairs, timeLimitMs, onMiss, onRight, onResult}) →
// {destroy, pause, resume}. pairs = [{de, en, ok}] in Spielreihenfolge (ok = das Paar
// stimmt); onResult(success, timeLeftMs, offen) wird genau einmal gerufen (offen =
// noch nicht beurteilte Paare), onMiss bei JEDEM Fehlurteil, onRight bei jedem richtigen.
// pause()/resume() frieren die Restzeit exakt ein.

import { playSfx } from './game.js';
import { iconHTML } from './pixel-icons.js';
import { aufgabeKarte, sekText, steinHTML, passend, innenBreite } from './minigame-karte.js';

const LOCK_OK_MS = 220;    // kurze Sperre nach richtig — verhindert Doppel-Tipp
const LOCK_BAD_MS = 700;   // länger nach falsch: man soll das Paar noch sehen

// Wort im Papier-Stein: lange Wörter werden kleiner statt über den Rand zu laufen
// (wie die Lücken-Kacheln in 5.10) — 28 → 24 → 20 → 16 px. Platz hat ein Stein die
// halbe Breite des Paares ohne das „?" in der Mitte; gemessen wird am Paar, weil
// der Stein selbst mit dem Wort mitwachsen würde. Reicht selbst 16 nicht, bricht
// das Wort als letzter Ausweg in 20 px um — mit Silbentrennung der Sprache.
function _passend(el, paar, mitte) {
  el.classList.remove('tf-umbruch');
  const stein = el.closest('.mg-stein-flaeche');
  const innen = stein ? stein.offsetWidth - innenBreite(stein) : 0;
  const frei = (paar.clientWidth - mitte.offsetWidth - 16) / 2 - innen - 4;
  if (!passend(el, frei, [24, 20, 16])) { el.style.fontSize = ''; el.classList.add('tf-umbruch'); }
}

export function startTrueFalse({ host, pairs, timeLimitMs, onMiss, onRight, onResult }) {
  let done = false, timer = null, pausedAt = null, idx = 0, locked = false;
  let endAt = Date.now() + timeLimitMs;
  const urteil = [];   // je Paar true/false, sobald beurteilt (für die Kästchen)

  // Aufbau wie F.6: Aufgabe oben mit einem Kästchen je Paar der Welle (F-64),
  // im Feld das Paar als zwei Papier-Steine mit pulsierendem „?" dazwischen,
  // darunter Richtig (grün) und Falsch (rot) untereinander — nebeneinander
  // verbindet man sonst die Seite des Knopfs mit dem Wort darüber. Die Frage
  // steht nur einmal da („Passt das Paar?" fällt weg, sagt dasselbe).
  const wort = (sprache, id) => `<span class="tf-wort"><span class="tf-wort-sprache">${sprache}</span><span id="${id}" class="tf-wort-text" lang="${sprache.toLowerCase()}"></span></span>`;
  const knopf = (icon, text) => `<span class="tf-symbol">${iconHTML(icon, 14)}</span>${text}`;
  host.innerHTML = aufgabeKarte({ art: 'richtig', anweisung: '', frage: 'Richtig oder falsch?', text: true,
    rechts: '<span id="tf-dots" class="tf-kaestchen"></span>', zeitId: 'tf-bar', sekId: 'tf-secs' })
    + `<div class="mg-flaeche"><div class="tf-flaeche">
      <i class="tf-luft" style="flex:55 1 0"></i>
      <div id="tf-card" class="tf-paar">
        <div data-ui="bob" data-a="1.5">${steinHTML(wort('DE', 'tf-de'), 'papier', 'mg-stein--paar')}</div>
        <span id="tf-zeichen" class="tf-frage" data-ui="pulse" data-a="6">?</span>
        <div data-ui="bob" data-a="1.5" data-d="2">${steinHTML(wort('EN', 'tf-en'), 'papier', 'mg-stein--paar')}</div>
      </div>
      <i class="tf-luft" style="flex:56 1 0"></i>
      <div class="tf-knoepfe">
        <button id="tf-yes" class="tf-btn">${steinHTML(knopf('check', 'Richtig'), 'gruen', 'mg-stein--knopf')}</button>
        <button id="tf-no" class="tf-btn">${steinHTML(knopf('close', 'Falsch'), 'rot', 'mg-stein--knopf')}</button>
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
    _passend(deEl, card, zeichen);
    _passend(enEl, card, zeichen);
    _kaestchen();
  }

  // Kästchen je Paar (F.6): grün = richtig beurteilt, rot = falsch, Papier = offen.
  function _kaestchen() {
    dots.innerHTML = pairs.map((_, i) =>
      `<span class="tf-k${urteil[i] === false ? ' miss' : urteil[i] ? ' done' : ''}"></span>`).join('');
  }

  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    host.querySelector('#tf-no').disabled = true;
    host.querySelector('#tf-yes').disabled = true;
    onResult(success, Math.max(0, endAt - Date.now()), pairs.length - urteil.filter((u) => u != null).length);
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
      urteil[idx] = true;
      _kaestchen();
      _faerben(true);
      if (onRight) onRight();
      _next(LOCK_OK_MS);
      return;
    }
    // Fehlurteil: kostet HP, das Paar bleibt kurz rot stehen — dann geht es weiter.
    try { playSfx('wrong'); } catch (e) {}
    _faerben(false);
    urteil[idx] = false;
    _kaestchen();
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
