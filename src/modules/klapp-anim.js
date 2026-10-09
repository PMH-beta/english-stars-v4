// src/modules/klapp-anim.js
// Auf- und Zuklappen weich (Wunsch des Nutzers 09.10.2026): Sammlungen, Probetest,
// Trainingsplatz, Trainings-Decks und Klappkarten (<details>) wachsen und
// schrumpfen, statt zu springen. Was darunter liegt, rutscht mit — minimal
// verzögert wie eine Ziehharmonika (höchstens STUFEN Stufen, je höchstens
// MAX_VERSATZ px), und immer so, dass sich nichts überdeckt.
// Die Listen werden weiter per innerHTML neu gezeichnet: gemessen wird vorher und
// nachher, die Karten werden über ihre Reihenfolge zugeordnet. Bei „Bewegung
// reduzieren“ springt alles wie bisher.

const DAUER = 260;          // ms
const VERZUG = 12;          // ms je Stufe
const STUFEN = 3;
const MAX_VERSATZ = 8;      // px je Stufe
const sanft = (x) => 1 - Math.pow(1 - x, 3);
const ruhig = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let _lauf = null;

// Blöcke, die im Fluss nach der Karte kommen: erst ihre Geschwister, dann die der
// Eltern … bis zum Screen — in Dokument-Reihenfolge. Die Stufe steigt nur an, so
// überdeckt nie ein Block den davor.
function _folgende(karte) {
  const out = [];
  for (let e = karte; e && e !== document.body; e = e.parentElement) {
    for (let s = e.nextElementSibling; s; s = s.nextElementSibling) {
      const cs = getComputedStyle(s);
      if (cs.display === 'none' || cs.position === 'fixed' || cs.position === 'absolute') continue;
      out.push(s);
    }
    if (e.classList.contains('p-screen')) break;
  }
  return out;
}

// liste: [{ k: Element, h0, h1 }]. danach läuft am Ende, bevor die feste Höhe fällt.
function _animiere(liste, danach) {
  const einzeln = liste.length === 1 ? liste[0] : null;
  const folgende = einzeln ? _folgende(einzeln.k) : [];
  const dh = einzeln ? einzeln.h1 - einzeln.h0 : 0;
  const weg = (t) => dh * sanft(Math.max(0, Math.min(1, t / DAUER)));
  for (const x of liste) { x.k.style.height = x.h0 + 'px'; x.k.style.overflow = 'hidden'; }
  const t0 = performance.now();
  const ende = DAUER + (folgende.length ? STUFEN * VERZUG : 0);
  let raf = 0;
  const fertig = () => {
    cancelAnimationFrame(raf);
    _lauf = null;
    if (danach) danach();
    for (const x of liste) { x.k.style.height = ''; x.k.style.overflow = ''; }
    for (const s of folgende) s.style.translate = '';
  };
  const bild = (jetzt) => {
    const t = jetzt - t0;
    for (const x of liste) x.k.style.height = (x.h0 + (x.h1 - x.h0) * sanft(Math.min(1, t / DAUER))) + 'px';
    folgende.forEach((s, i) => {
      const k = Math.min(i + 1, STUFEN);
      // Auf: was darunter liegt, eilt leicht voraus; zu: es kommt leicht verzögert nach.
      const v = (dh > 0 ? weg(t + k * VERZUG) : weg(t - k * VERZUG)) - weg(t);
      const c = Math.max(-MAX_VERSATZ * k, Math.min(MAX_VERSATZ * k, v));
      s.style.translate = Math.abs(c) < 0.5 ? '' : `0 ${c.toFixed(1)}px`;
    });
    if (t < ende) raf = requestAnimationFrame(bild); else fertig();
  };
  raf = requestAnimationFrame(bild);
  _lauf = { fertig };
}

// Umbau mit weichem Übergang. sel trifft die Karten, die dabei auf- oder zugehen
// können (vorher und nachher gleich viele). Eine laufende Animation wird erst fertig.
export function weichUmbauen(sel, umbau) {
  if (_lauf) _lauf.fertig();
  if (ruhig()) { umbau(); return; }
  const vorher = [...document.querySelectorAll(sel)].map((k) => k.getBoundingClientRect().height);
  umbau();
  const karten = [...document.querySelectorAll(sel)];
  if (!vorher.length || karten.length !== vorher.length) return;
  const geaendert = karten.map((k, i) => ({ k, h0: vorher[i], h1: k.getBoundingClientRect().height }))
    .filter((x) => Math.abs(x.h1 - x.h0) >= 1);
  if (geaendert.length) _animiere(geaendert);
}

// Klappkarten (<details>, z. B. Fortschritt-Seite, „Wörter anzeigen“): der Browser
// schaltet sie sonst hart um. Beim Zuklappen bleibt der Inhalt sichtbar, bis die
// Karte zu ist.
export function startKlappAnim() {
  document.addEventListener('click', (e) => {
    const sum = e.target.closest?.('summary');
    const det = sum?.parentElement;
    if (!det || det.tagName !== 'DETAILS' || e.defaultPrevented || ruhig()) return;
    e.preventDefault();
    if (_lauf) _lauf.fertig();
    const h0 = det.getBoundingClientRect().height;
    det.open = !det.open;
    const h1 = det.getBoundingClientRect().height;
    if (det.open) { _animiere([{ k: det, h0, h1 }]); return; }
    det.open = true;
    _animiere([{ k: det, h0, h1 }], () => { det.open = false; });
  });
}
