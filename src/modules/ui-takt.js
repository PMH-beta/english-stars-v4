// src/modules/ui-takt.js
// Gemeinsamer 8-fps-Takt (125 ms) für die UI-Animationen des Pastell-Handoffs.
// Alles mit data-ui="…" (Flamme, Punkte, Wackeln, Wippen …) bewegt sich darüber
// in harten Stufen. ui-anim.js selbst bleibt unverändert (Regel 5) — hier steht
// nur die Anbindung: Icon-Engine für "swap", der Takt, der Sofort-Start.
//
// Sofort-Start: Der Animator sucht seine Elemente nur alle 16 Takte (2 s) neu.
// Was zur Laufzeit dazukommt (Dialog, gehaltene Karte, neu gezeichnete Liste),
// bewegte sich sonst erst bis zu 2 s später. Deshalb bekommt jeder neue Teilbaum
// mit data-ui für 17 Takte einen eigenen Animator, bis der große ihn gefunden
// hat. Beide rechnen mit demselben Takt t, liefern also dieselben Werte.
// prefers-reduced-motion behandelt ui-anim.js selbst: dann bewegt sich nichts.

import { createUiAnimator } from './ui-anim.js';
import { drawIcon } from './pixel-icons.js';

const TAKT_MS = 125;
const icon = (ctx, name, w, h) => drawIcon(ctx, name, w, h);

let _t = 0;
let _timer = null;
let _haupt = null;
const _neu = new Map();   // Wurzel → { ui, bis }

function _sofort(root) {
  if (!root) return;
  _neu.set(root, { ui: createUiAnimator({ icon, root }), bis: _t + 17 });
}

function _tick() {
  const t = _t++;
  _haupt.tick(t);
  for (const [root, e] of _neu) {
    if (!root.isConnected || t >= e.bis) { _neu.delete(root); continue; }
    e.ui.tick(t);
  }
}

export function startUiTakt() {
  if (_timer) return;
  _haupt = createUiAnimator({ icon });
  _timer = setInterval(_tick, TAKT_MS);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes') { _sofort(m.target.parentElement); continue; }
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches('[data-ui]') || n.querySelector('[data-ui]')) _sofort(n.parentElement || n);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ui'] });
}
