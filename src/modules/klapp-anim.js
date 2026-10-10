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

// liste: [{ k: Element, h0, h1 }]. danach läuft am Ende, bevor die feste Höhe fällt.
function _animiere(liste, danach, halten) {
  const einzeln = liste.length === 1 ? liste[0] : null;
  const folgende = einzeln ? _folgende(einzeln.k) : [];
  const dh = einzeln ? einzeln.h1 - einzeln.h0 : 0;
  const weg = (t) => dh * sanft(Math.max(0, Math.min(1, t / DAUER)));
  _anker(false);
  for (const x of liste) { x.k.style.height = x.h0 + 'px'; x.k.style.overflow = 'hidden'; }
  if (halten) halten();
  const t0 = performance.now();
  const ende = DAUER + (folgende.length ? STUFEN * VERZUG : 0);
  let raf = 0;
  const fertig = () => {
    cancelAnimationFrame(raf);
    _lauf = null;
    if (danach) danach();
    for (const x of liste) { x.k.style.height = ''; x.k.style.overflow = ''; }
    for (const s of folgende) s.style.translate = '';
    if (halten) halten();
    _anker(true);
  };
  const bild = (jetzt) => {
    const t = jetzt - t0;
    for (const x of liste) x.k.style.height = (x.h0 + (x.h1 - x.h0) * sanft(Math.min(1, t / DAUER))) + 'px';
    if (halten) halten();
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
// können (vorher und nachher gleich viele). halte (optional) trifft die angetippte
// Karte, die an ihrer Stelle bleibt. Eine laufende Animation wird erst fertig.
export function weichUmbauen(sel, umbau, halte) {
  if (_lauf) _lauf.fertig();
  const fest = halte && document.querySelector(halte);
  const obenVorher = fest ? fest.getBoundingClientRect().top + window.scrollY : null;
  if (ruhig()) { umbau(); _halter(halte, obenVorher)?.(); return; }
  const vorher = [...document.querySelectorAll(sel)].map((k) => k.getBoundingClientRect().height);
  umbau();
  const halten = _halter(halte, obenVorher);
  const karten = [...document.querySelectorAll(sel)];
  if (!vorher.length || karten.length !== vorher.length) { halten?.(); return; }
  const geaendert = karten.map((k, i) => ({ k, h0: vorher[i], h1: k.getBoundingClientRect().height }))
    .filter((x) => Math.abs(x.h1 - x.h0) >= 1);
  if (geaendert.length) _animiere(geaendert, null, halten); else halten?.();
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
