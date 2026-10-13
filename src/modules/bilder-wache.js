// src/modules/bilder-wache.js
// Handys verwerfen im Hintergrund manchmal den Inhalt gemalter Bilder (<canvas>):
// Danach fehlten Pixel-Symbole und die Figur, bis die App neu startete (Nutzer
// 13.10.2026). Beim Zurückkommen werden Stichproben geprüft; sind sie leer, wird
// alles neu gemalt. Bilder als <img> (Daten-URL: Brustbild, Werkstücke,
// Gegenstände) sind nicht betroffen. Chrome meldet den Verlust zusätzlich direkt
// am Canvas (contextrestored — der Inhalt ist danach leer).

import { iconsVerloren, iconsNeuMalen } from './pixel-icons.js';
import { buehnenVerloren, buehnenVerwerfen, paintStages } from './hero.js';

let _geplant = false;
function _neuMalen() {
  _geplant = false;
  iconsNeuMalen();
  buehnenVerwerfen();   // der Takt baut die Figuren beim nächsten Bild neu
  paintStages();        // Bild 0 auch ohne Takt („Bewegung reduzieren“)
}
function _bald() {
  if (_geplant) return;
  _geplant = true;
  requestAnimationFrame(_neuMalen);
}
function _pruefen() {
  let weg;
  try { weg = iconsVerloren() || buehnenVerloren(); } catch (e) { weg = true; }
  if (weg) _bald();
}

export function startBilderWache() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    requestAnimationFrame(_pruefen);
    setTimeout(_pruefen, 1000);   // falls das Handy erst nach dem Aufwachen verwirft
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) requestAnimationFrame(_pruefen); });
  document.addEventListener('contextrestored', _bald, true);
}
