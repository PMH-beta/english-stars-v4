// src/modules/campaign-feuer.js
// Feuerprobe am Lagerfeuer (LU-03, 24.11.2026): das Geschicklichkeitsspiel
// „Funken-Takt" und der Bonus, den es bis zum Ende der Karte gibt.
//
// Spiel: Funken steigen im Takt (FUNKEN_TAKT) aus dem Lagerfeuer. Tippt das Kind,
// während ein Funke die goldene Linie kreuzt (± FUNKEN_FENSTER_MS), ist er getroffen.
// Mind. FUNKEN_ZIEL von FUNKEN_ANZAHL = bestanden. Bewegung über requestAnimationFrame
// mit einer eigenen Uhr (je Bild höchstens 50 ms weiter) — ist die App kurz im
// Hintergrund, springen die Funken nicht.
// Bonus: run.feuer = { art: 'staerke'|'schutz'|'zeit', wert } — liegt im Lauf, endet
// also mit der Karte (Boss-Sieg oder Niederlage setzen c.run = null).

import { FUNKEN_ANZAHL, FUNKEN_STEIG_MS, FUNKEN_FENSTER_MS, FUNKEN_TAKT, FEUER_BONUS, feuerMult } from './campaign-balance.js';
import { iconHTML } from './pixel-icons.js';
import { playSfx } from './game.js';

export const FEUER_ARTEN = {
  staerke: { icon: 'sword',     name: 'Stärke', text: (w) => `+${w} Schaden` },
  schutz:  { icon: 'shield',    name: 'Schutz', text: (w) => `−${w} Schaden vom Gegner` },
  zeit:    { icon: 'hourglass', name: 'Zeit',   text: (w) => `+${w / 1000} s je Welle` },
};

// Wirkung im Kampf (campaign-fight.js): Schaden des Helden, Schaden des Gegners, Zeit.
export function feuerBonus(run) {
  const out = { staerke: 0, schutz: 0, zeitMs: 0 };
  const f = run?.feuer;
  if (!f || !FEUER_ARTEN[f.art]) return out;
  const w = Math.max(0, Number(f.wert) || 0);
  if (f.art === 'staerke') out.staerke = w;
  else if (f.art === 'schutz') out.schutz = w;
  else out.zeitMs = w;
  return out;
}

// Art zufällig, Höhe nach Runde (1-basiert, wie „Runde N" auf der Karte).
export function feuerWuerfeln(runde) {
  const arten = Object.keys(FEUER_ARTEN);
  const art = arten[Math.floor(Math.random() * arten.length)];
  const m = feuerMult(runde);
  const wert = (art === 'staerke' ? FEUER_BONUS.staerke : art === 'schutz' ? FEUER_BONUS.schutz : FEUER_BONUS.zeitMs) * m;
  return { art, wert };
}

// Chip „Icon + Wirkung" für Karte und Ergebnis.
export function feuerChip(feuer, cls = 'rest-chip') {
  const a = feuer && FEUER_ARTEN[feuer.art];
  if (!a) return '';
  return `<span class="${cls}">${iconHTML(a.icon, 14)}${a.text(feuer.wert)}</span>`;
}

// ── Funken-Takt ──────────────────────────────────────────────────────────────
// ov = Rastplatz-Overlay (#camp-rest) mit #rest-feuer; die goldene Linie liegt
// mittig zwischen Unterkante der Karte (.rest-karte) und Flamme.
// onWertung(i, treffer) nach jedem Funken, onEnde(treffer) am Schluss.
export function startFunkenTakt(ov, { onWertung, onEnde }) {
  const feuer = ov.querySelector('#rest-feuer');
  const karte = ov.querySelector('.rest-karte');
  const oR = ov.getBoundingClientRect();
  const fR = feuer.getBoundingClientRect();
  const x0 = Math.round(fR.left + fR.width / 2 - oR.left);
  const y0 = Math.round(fR.top + fR.height * 0.3 - oR.top);
  const kU = karte ? Math.round(karte.getBoundingClientRect().bottom - oR.top) : 120;
  const yL = Math.round(Math.min(y0 - 150, Math.max(kU + 36, (kU + y0) / 2)));
  const weg = y0 - yL;

  const lage = document.createElement('div');
  lage.className = 'funken-lage';
  lage.innerHTML = `<div class="funken-linie" style="top:${yL}px"></div>`;
  ov.appendChild(lage);

  const funken = FUNKEN_TAKT.slice(0, FUNKEN_ANZAHL).map((start) => ({
    start, linie: start + FUNKEN_STEIG_MS, dx: Math.round(Math.random() * 24 - 12),
    el: null, urteil: null,
  }));
  let t = -700, last = performance.now(), raf = null, ende = false, treffer = 0;

  const werte = (f, ok) => {
    f.urteil = ok ? 'ja' : 'nein';
    if (ok) treffer++;
    const i = funken.indexOf(f);
    if (f.el) {
      if (ok) {
        // Treffer: Funke blitzt doppelt so groß auf (28 px, gleicher Mittelpunkt).
        f.el.innerHTML = iconHTML('star', 28);
        f.el.style.transform = `translate(${f.x - 14}px, ${f.y - 14}px)`;
        const el = f.el; f.el = null;
        setTimeout(() => el.remove(), 250);
      } else { f.el.remove(); f.el = null; }
    }
    try { playSfx(ok ? 'correct' : 'click'); } catch (e) {}
    onWertung?.(i, ok);
  };

  const tippen = (ev) => {
    if (ende || t < 0) return;
    if (ev && ev.type === 'keydown' && ev.code !== 'Space') return;
    let best = null, bestAbst = Infinity;
    for (const f of funken) {
      if (f.urteil) continue;
      const a = Math.abs(t - f.linie);
      if (a < bestAbst) { best = f; bestAbst = a; }
    }
    if (!best) return;
    if (bestAbst <= FUNKEN_FENSTER_MS) werte(best, true);
    else if (bestAbst <= 400) werte(best, false);   // daneben getippt kostet den Funken
  };

  const bild = () => {
    if (!ov.isConnected) { stopp(); return; }   // Overlay von außen geschlossen
    const jetzt = performance.now();
    t += Math.min(50, jetzt - last);
    last = jetzt;
    for (const f of funken) {
      if (!f.urteil && t > f.linie + FUNKEN_FENSTER_MS) werte(f, false);
      if (f.urteil || t < f.start) continue;
      if (!f.el) {
        f.el = document.createElement('div');
        f.el.className = 'funke';
        f.el.innerHTML = iconHTML('star', 14);
        lage.appendChild(f.el);
      }
      f.x = x0 + f.dx;
      f.y = Math.round(y0 - (t - f.start) / FUNKEN_STEIG_MS * weg);
      f.el.style.transform = `translate(${f.x - 7}px, ${f.y - 7}px)`;
    }
    const letzte = funken[funken.length - 1].linie + FUNKEN_FENSTER_MS + 500;
    if (funken.every((f) => f.urteil) && t > letzte) { stopp(); onEnde?.(treffer); return; }
    raf = requestAnimationFrame(bild);
  };

  const stopp = () => {
    ende = true;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    ov.removeEventListener('pointerdown', tippen);
    document.removeEventListener('keydown', tippen);
    lage.remove();
  };

  ov.addEventListener('pointerdown', tippen);
  document.addEventListener('keydown', tippen);
  raf = requestAnimationFrame(bild);
  return { stopp };
}
