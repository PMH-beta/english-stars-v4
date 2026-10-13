// src/modules/klapp-anim.js
// Auf- und Zuklappen weich (Wunsch des Nutzers 09.10.2026): Sammlungen, Probetest,
// Trainingsplatz, Trainings-Decks und Klappkarten (<details>) wachsen und
// schrumpfen, statt zu springen. Seit 13.10.2026 (Wunsch des Nutzers) wie eine
// Maske: der Inhalt steht still, die Karte zieht sich darüber auf und zu — auch
// beim Zuklappen bleibt er stehen, bis die Karte zu ist. Was darunter liegt,
// rutscht ohne Versatz mit und verwischt dabei senkrecht (unschaerfe.js); die
// frühere Ziehharmonika (versetzter Nachlauf) ist raus.
// Die Listen werden weiter per innerHTML neu gezeichnet: gemessen wird vorher und
// nachher, die Karten werden über ihre Reihenfolge zugeordnet. Bei „Bewegung
// reduzieren“ springt alles wie bisher.

import { verfolge, loescheUnschaerfe } from './unschaerfe.js';

// Seit 10.10.2026 (Wunsch des Nutzers: „langsam – schnell – langsam“, vorher war
// es manchmal zu schnell) ease-in-out statt ease-out und 400 statt 260 ms;
// seit 13.10.2026 300 ms (Bedienung „ein Tick schneller“, dazu Bewegungsunschärfe).
const DAUER = 300;          // ms
const sanft = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);   // easeInOutCubic
const UNSCHAERFE_MAX = 4;   // senkrecht schwächer als bei den Schiebern: hier ziehen ganze Listen mit
const ruhig = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let _lauf = null;

// Blöcke, die im Fluss nach der Karte kommen: erst ihre Geschwister, dann die der
// Eltern … bis zum Screen — in Dokument-Reihenfolge.
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

// Die angetippte Karte bleibt auf dem Bildschirm stehen (Wunsch des Nutzers
// 10.10.2026): Geht darüber gleichzeitig eine andere Karte zu, rutschte sie sonst
// mit nach oben, im Test bis aus dem Bild. Ausgeglichen wird nur, was das Layout
// verschiebt — gemessen in Seitenkoordinaten, eigenes Scrollen bleibt unberührt.
// sel trifft die Karte nach dem Neuzeichnen, obenVorher ist ihre Lage davor.
function _halter(sel, obenVorher) {
  const el = sel && document.querySelector(sel);
  if (!el || obenVorher == null) return null;
  let seite = obenVorher, rest = 0;   // rest: was der Browser beim Runden auf ganze Pixel liegen ließ
  return () => {
    const jetzt = el.getBoundingClientRect().top + window.scrollY;
    const soll = jetzt - seite + rest;
    seite = jetzt;
    const y0 = window.scrollY;
    if (Math.abs(soll) >= 0.5) window.scrollBy(0, soll);
    const r = soll - (window.scrollY - y0);
    rest = Math.abs(r) < 1 ? r : 0;      // am Seitenanfang/-ende geht es nicht weiter: nichts aufstauen
  };
}

// Solange eine Karte wächst oder schrumpft, verschiebt der Browser den Scroll nicht
// selbst (Scroll-Anker) — das übernimmt _halter, sonst ruckt es doppelt.
const _anker = (an) => { for (const e of [document.documentElement, document.body]) e.style.overflowAnchor = an ? '' : 'none'; };

// liste: [{ k: Element, h0, h1 }] in Dokument-Reihenfolge. danach läuft am Ende,
// bevor die feste Höhe fällt.
function _animiere(liste, danach, halten) {
  // Alles nach der ersten Karte kann sich bewegen; was sich wirklich bewegt (auch
  // durch den Scroll-Ausgleich), verwischt — gemessen, nicht gerechnet.
  const folgende = liste.length ? _folgende(liste[0].k) : [];
  _anker(false);
  for (const x of liste) { x.k.style.height = x.h0 + 'px'; x.k.style.overflow = 'hidden'; }
  if (halten) halten();
  for (const s of folgende) verfolge(s, 'y', DAUER + 60, UNSCHAERFE_MAX);
  const t0 = performance.now();
  let raf = 0;
  const fertig = () => {
    cancelAnimationFrame(raf);
    _lauf = null;
    if (danach) danach();
    for (const x of liste) { x.k.style.height = ''; x.k.style.overflow = ''; }
    for (const s of folgende) loescheUnschaerfe(s);
    if (halten) halten();
    _anker(true);
  };
  const bild = (jetzt) => {
    const t = jetzt - t0;
    for (const x of liste) x.k.style.height = (x.h0 + (x.h1 - x.h0) * sanft(Math.min(1, t / DAUER))) + 'px';
    if (halten) halten();
    if (t < DAUER) raf = requestAnimationFrame(bild); else fertig();
  };
  raf = requestAnimationFrame(bild);
  _lauf = { fertig };
}

// Zugehende Karte wie eine Maske: die Liste ist schon neu gezeichnet, der Inhalt
// der offenen Karte also weg. Bis sie zu ist, stehen ihre alten Inhaltsblöcke
// (was der neue Stand nicht mehr hat, erkannt an der ersten Klasse) wieder darin
// und die Karte schließt sich darüber — vorher verschwand erst alles, dann
// klappte eine leere Karte zu. Die geliehenen Blöcke sind solange nicht bedienbar.
function _altenInhaltLeihen(geaendert) {
  const geliehen = [];
  for (const x of geaendert) {
    if (x.h1 >= x.h0 || !x.alt || x.alt === x.k) continue;
    const da = new Set([...x.k.children].map((c) => c.classList[0]));
    for (const c of [...x.alt.children]) {
      if (da.has(c.classList[0])) continue;
      c.inert = true;
      x.k.appendChild(c);
      geliehen.push(c);
    }
  }
  return geliehen;
}

// Umbau mit weichem Übergang. sel trifft die Karten, die dabei auf- oder zugehen
// können (vorher und nachher gleich viele). halte (optional) trifft die angetippte
// Karte, die an ihrer Stelle bleibt. Eine laufende Animation wird erst fertig.
export function weichUmbauen(sel, umbau, halte) {
  if (_lauf) _lauf.fertig();
  const fest = halte && document.querySelector(halte);
  const obenVorher = fest ? fest.getBoundingClientRect().top + window.scrollY : null;
  if (ruhig()) { umbau(); _halter(halte, obenVorher)?.(); return; }
  const alt = [...document.querySelectorAll(sel)];
  const vorher = alt.map((k) => k.getBoundingClientRect().height);
  umbau();
  const karten = [...document.querySelectorAll(sel)];
  if (!vorher.length || karten.length !== vorher.length) { _halter(halte, obenVorher)?.(); return; }
  const geaendert = karten.map((k, i) => ({ k, h0: vorher[i], h1: k.getBoundingClientRect().height, alt: alt[i] }))
    .filter((x) => Math.abs(x.h1 - x.h0) >= 1);
  const geliehen = _altenInhaltLeihen(geaendert);
  const halten = _halter(halte, obenVorher);
  if (geaendert.length) _animiere(geaendert, () => geliehen.forEach((c) => c.remove()), halten); else halten?.();
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
