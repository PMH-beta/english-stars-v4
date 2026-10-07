// src/modules/minigame-letterstorm.js
// Buchstabensturm — Kern-Minispiel der Kampagne (Phase 1).
// Die Buchstaben des englischen Zielworts schweben driftend im Feld; das Kind tippt
// sie in der richtigen Reihenfolge an, getroffene füllen die Wortleiste unten.
// Falscher Buchstabe = Schütteln + Zeitstrafe. Zeit abgelaufen = Welle verloren.
// Touch-first, Drift über CSS-Transforms. KEIN Mastery/EMA-Schreiben — eine Welle
// ist einmalig richtig oder falsch.
//
// Schnittstelle: startLetterstorm({host, de, en, timeLimitMs, onResult}) →
// {destroy, pause, resume}. host bekommt Prompt/Timer/Wortleiste/Spielfeld — die
// Wortleiste (zeigt die bereits getroffenen Buchstaben) sitzt direkt unter der
// Zeitanzeige, darunter erst das Spielfeld mit den treibenden Buchstaben-Kacheln.
// onResult(success, timeLeftMs) wird genau einmal gerufen. pause()/resume() frieren
// die Restzeit exakt ein (z. B. während eines Bestätigungs-Dialogs). onMiss (optional)
// wird bei JEDEM falschen Buchstaben gerufen (nicht nur einmal pro Welle) — der
// Aufrufer entscheidet, was ein Fehlklick zusätzlich zur Zeitstrafe kostet.

import { playSfx } from './game.js';
import { STORM_PENALTY_MS } from './campaign-balance.js';
import { aufgabeKarte, frageDE, sekText, steinHTML, passeAufgabe, innenBreite } from './minigame-karte.js';
import { iconHTML } from './pixel-icons.js';

// Wackeln bei einem falschen Buchstaben (Übersicht 9.7): 8 Bilder im 8-fps-Takt,
// harte Stufen, keine CSS-Übergänge. Bei „Bewegung reduzieren" nur die Farbe.
const WACKELN = [0, -4, 4, -3, 3, -2, 2, 0];
export function wackeln(el, fertig) {
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;
  const t = setInterval(() => {
    if (!still) el.style.translate = WACKELN[i] + 'px 0';
    if (++i >= WACKELN.length) { clearInterval(t); el.style.translate = ''; if (fertig) fertig(); }
  }, 125);
}

/** „✓ Richtig · horse" unten in der Spielfläche (7.6). */
export function richtigChip(host, wort) {
  const feld = host.querySelector('.mg-flaeche');
  if (!feld) return;
  const d = document.createElement('div');
  d.className = 'mg-richtig';
  d.innerHTML = `<span>${iconHTML('check', 14)}Richtig · ${window.escHtml ? window.escHtml(wort) : wort}</span>`;
  feld.appendChild(d);
}

// Zielwort fürs Tippen: erste /-Alternative, führendes „to " weg (wie submitType).
export function stormTarget(en) {
  return (en || '').split('/')[0].trim().toLowerCase().replace(/^to /, '');
}

// Style wird auch von Echo-Fang genutzt (cfDrift-Keyframes) → exportiert.
let _styleDone = false;
export function ensureStormStyle() {
  if (_styleDone) return;
  _styleDone = true;
  const st = document.createElement('style');
  st.textContent = `
    /* Drift: vier Wegpunkte je Kachel (--x1/--y1 … --x4/--y4, gesetzt von setDrift) statt
       eines Hin und Her auf einer Geraden — jede Kachel wandert dadurch eine eigene
       Schleife. 0 % und 100 % sind derselbe Punkt, damit die Schleife ohne Sprung
       durchläuft; „alternate" wäre hier falsch (liefe die Schleife rückwärts wieder ab). */
    @keyframes cfDrift {
      0%,100% { transform: translate(var(--x4), var(--y4)); }
      25%     { transform: translate(var(--x1), var(--y1)); }
      50%     { transform: translate(var(--x2), var(--y2)); }
      75%     { transform: translate(var(--x3), var(--y3)); }
    }
    /* Zentrierte Variante für Elemente, die per transform:translate(-50%,-50%) auf
       ihrem Ankerpunkt sitzen (z. B. Echo-Fang-Chips) — eine Animation auf transform
       überschreibt sonst jeden inline gesetzten transform-Wert komplett, darum muss die
       Zentrierung HIER mit eingebacken sein statt separat gesetzt zu werden. */
    @keyframes cfDriftC {
      0%,100% { transform: translate(calc(-50% + var(--x4)), calc(-50% + var(--y4))); }
      25%     { transform: translate(calc(-50% + var(--x1)), calc(-50% + var(--y1))); }
      50%     { transform: translate(calc(-50% + var(--x2)), calc(-50% + var(--y2))); }
      75%     { transform: translate(calc(-50% + var(--x3)), calc(-50% + var(--y3))); }
    }
    /* Nur die Mechanik steht hier (Lage, Drift). Das Aussehen von Stein und
       Wortleiste kommt aus style.css (F.7) — eingespritzte Regeln stünden später
       im Dokument und überstimmten es sonst. */
    .cf-tile { position:absolute; cursor:pointer; padding:0; z-index:2;
      display:flex; align-items:center; justify-content:center;
      animation: cfDrift var(--dur,12s) ease-in-out var(--del,0s) infinite; }
    .cf-tile.cf-hit { visibility:hidden; pointer-events:none; }
    .cf-slot { display:inline-flex; align-items:center; justify-content:center; color:var(--p-ink); }
  `;
  document.head.appendChild(st);
}

// Drift-Wegpunkte einer Kachel/eines Chips setzen (auch von Echo-Fang genutzt): vier
// Punkte reihum auf zufälligen Winkeln, Auslenkung 55–100 % von rx/ry. Vorher war es EIN
// zufälliger Wert in ±22px — im Mittel also nur 11px, und viele Kacheln landeten nahe 0
// und standen praktisch still. Zufällige Dauer + negativer Delay entkoppeln die Kacheln
// voneinander, damit sie nicht im Gleichtakt schwingen.
export function setDrift(el, rx, ry, durMin = 9, durMax = 15) {
  let a = Math.random() * Math.PI * 2;
  for (let i = 1; i <= 4; i++) {
    a += Math.PI / 2 + (Math.random() - 0.5) * 1.1;   // grob im Kreis herum, aber unregelmäßig
    const f = 0.55 + Math.random() * 0.45;
    el.style.setProperty('--x' + i, Math.round(Math.cos(a) * rx * f) + 'px');
    el.style.setProperty('--y' + i, Math.round(Math.sin(a) * ry * f) + 'px');
  }
  el.style.setProperty('--dur', (durMin + Math.random() * (durMax - durMin)).toFixed(1) + 's');
  el.style.setProperty('--del', (-Math.random() * 12).toFixed(1) + 's');
}

// prompt (optional): eigener Kopf statt „🇩🇪 de" — für Verbform-Wellen
// („go → Simple Past?").
// guards (optional): so viele Fehlgriffe fängt der 🐾 Gefährte ab (keine Strafe);
// onGuardUsed wird je verbrauchtem Guard gerufen (Kampf merkt sich das pro Kampf).
export function startLetterstorm({ host, de, en, prompt, timeLimitMs, guards = 0, onGuardUsed, onMiss, onResult }) {
  ensureStormStyle();
  const target = stormTarget(en);
  const chars = target.split('');
  let done = false, timer = null, pausedAt = null;
  let endAt = Date.now() + timeLimitMs;

  // Leerzeichen (Mehrwort-Antworten) sind in der Leiste vorgegeben — kein Tile.
  const tappable = chars.map((ch, i) => ({ ch, i })).filter(x => x.ch !== ' ');
  // Wortleiste: jedes Wort als eigene Gruppe — umgebrochen wird nur zwischen den
  // Wörtern, nie mitten im Wort.
  const woerter = target.split(' ');
  let pos = 0;
  const slotHtml = woerter.map((w) => {
    const html = '<span class="mg-slot-wort">'
      + w.split('').map((_, k) => `<span class="cf-slot" data-i="${pos + k}"></span>`).join('') + '</span>';
    pos += w.length + 1;
    return html;
  }).join('');

  // Aufbau wie F.7/F.8: die Wortleiste liegt im Panel zwischen Frage und Zeit,
  // darunter das Spielfeld mit den Buchstaben.
  host.innerHTML = aufgabeKarte({ art: 'sturm', anweisung: prompt ? 'Bilde die Form' : 'Schreibe auf Englisch',
    frage: prompt || frageDE(de), zeitId: 'cf-timebar', sekId: 'cf-secs',
    mitte: `<div id="cf-slots" class="mg-slots">${slotHtml}</div>` })
    + `<div class="mg-flaeche"><div id="cf-field" class="mg-feld"></div></div>`;
  passeAufgabe(host);
  // Lange Wörter: die Felder werden schmaler (42 → höchstens 16 px), bis das längste
  // Wort in eine Zeile der Leiste passt; die Schrift folgt in den Stufen 28/20/16.
  const leiste = host.querySelector('#cf-slots');
  const laengstes = Math.max(...woerter.map((w) => w.length));
  const feldW = Math.max(16, Math.min(42, Math.floor((innenBreite(leiste) - (laengstes - 1) * 6) / laengstes)));
  if (leiste && feldW < 42) {
    leiste.style.setProperty('--slot', feldW + 'px');
    leiste.style.setProperty('--slot-schrift', (feldW >= 34 ? 28 : feldW >= 26 ? 20 : 16) + 'px');
  }

  // Tiles auf gemischtem Gitter platzieren (kein Anfangs-Überlappen), dann driften.
  const field = host.querySelector('#cf-field');
  const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(tappable.length))));
  const rows = Math.max(1, Math.ceil(tappable.length / cols));
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }

  // Drift-Radius an die Gitterdichte koppeln: bei engem Gitter (langes Wort) kleiner,
  // damit sich Kacheln nicht dauerhaft verdecken. Die +8 lassen leichtes Überlappen zu,
  // die Untergrenze sorgt dafür, dass auch im engsten Gitter sichtbar Bewegung bleibt.
  const cellW = field.clientWidth * 0.84 / cols;
  const cellH = field.clientHeight * 0.74 / rows;
  const driftX = Math.max(16, Math.min(30, (cellW - 62) / 2 + 8));
  const driftY = Math.max(14, Math.min(26, (cellH - 62) / 2 + 8));

  let nextIdx = 0;   // nächster erwarteter Index in chars (Leerzeichen überspringen)
  const advance = () => { nextIdx++; while (nextIdx < chars.length && chars[nextIdx] === ' ') nextIdx++; };
  // Das Feld, das als Nächstes dran ist, steht hell-gold mit Tintenstrich (F.7).
  const markDran = () => {
    host.querySelectorAll('.cf-slot.cf-dran').forEach(s => s.classList.remove('cf-dran'));
    host.querySelector(`.cf-slot[data-i="${nextIdx}"]`)?.classList.add('cf-dran');
  };
  let gefuellt = 0;  // Zahl der getroffenen Buchstaben (Versatz fürs Wippen)

  function _finish(success) {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    if (success) {
      // Gelöst (7.6): die ganze Leiste wird mint und steht still, darunter
      // „Richtig · Wort".
      host.querySelectorAll('.cf-slot').forEach(s => { s.classList.remove('cf-dran'); s.classList.add('cf-ok'); delete s.dataset.ui; s.style.transform = ''; });
      richtigChip(host, target);
    }
    onResult(success, Math.max(0, endAt - Date.now()));
  }

  // Neigung der Runensteine wie in F.7/F.8 (−6°, 4°, −3°, −5°, 5°), reihum.
  const DREH = [-6, 4, -3, -5, 5];
  tappable.forEach((t, k) => {
    const cell = cells[k];
    const btn = document.createElement('button');
    btn.className = 'cf-tile';
    btn.innerHTML = steinHTML(t.ch, 'lila', 'mg-stein--rune');
    btn.style.setProperty('--dreh', DREH[k % DREH.length] + 'deg');
    const x = (cell.c + 0.5) / cols * 84 + 8;    // % innerhalb des Felds, mit Rand
    const y = (cell.r + 0.5) / rows * 74 + 10;
    btn.style.left = `calc(${x}% - 31px)`;
    btn.style.top = `calc(${y}% - 31px)`;
    setDrift(btn, driftX, driftY);
    btn.onclick = () => {
      if (done || btn.classList.contains('cf-hit')) return;
      if (t.ch === chars[nextIdx]) {
        // Richtig: Tile ist weg, Slot füllt sich und wippt (7.4, je 3 Takte
        // versetzt). Bei doppelten Buchstaben gilt JEDES passende Tile (w-e-e-k:
        // jedes „e" zählt fürs nächste „e").
        btn.classList.add('cf-hit');
        const slot = host.querySelector(`.cf-slot[data-i="${nextIdx}"]`);
        if (slot) {
          slot.textContent = t.ch; slot.classList.add('cf-filled');
          slot.dataset.a = '1.5'; slot.dataset.d = String((gefuellt++ * 3) % 12); slot.dataset.ui = 'bob';
        }
        advance();
        markDran();
        try { playSfx('click'); } catch (e) {}
        if (nextIdx >= chars.length) _finish(true);
      } else if (guards > 0) {
        // 🐾 Gefährte fängt den Fehlgriff ab — kein Fehler, keine Zeitstrafe.
        // Die Meldung zeigt der Kampf über der Figur (Fragment 6.8, N41).
        guards--;
        if (onGuardUsed) try { onGuardUsed(); } catch (e) {}
        try { playSfx('click'); } catch (e) {}
      } else {
        // Falsch (7.5): Stein rot, wackelt in 8 harten Stufen.
        try { playSfx('wrong'); } catch (e) {}
        btn.classList.add('cf-shake');
        wackeln(btn, () => btn.classList.remove('cf-shake'));
        endAt -= STORM_PENALTY_MS;
        const bar = host.querySelector('#cf-timebar');
        if (bar) { bar.style.background = 'var(--p-falsch-stark)'; setTimeout(() => { bar.style.background = ''; }, 350); }
        if (onMiss) onMiss();
      }
    };
    field.appendChild(btn);
  });
  markDran();

  function _tick() {
    const remain = endAt - Date.now();
    const bar = host.querySelector('#cf-timebar');
    const secs = host.querySelector('#cf-secs');
    if (bar) bar.style.width = Math.max(0, remain / timeLimitMs * 100) + '%';
    if (secs) secs.textContent = sekText(remain);
    if (remain <= 0) _finish(false);
  }
  timer = setInterval(_tick, 100);
  _tick();

  return {
    destroy() { done = true; if (timer) clearInterval(timer); },
    // Pausiert (7.14): statt der Sekunden steht „pausiert".
    pause() { if (done || pausedAt) return; pausedAt = Date.now(); clearInterval(timer); timer = null; const s = host.querySelector('#cf-secs'); if (s) s.textContent = 'pausiert'; },
    resume() { if (done || pausedAt == null) return; endAt += Date.now() - pausedAt; pausedAt = null; timer = setInterval(_tick, 100); },
  };
}
