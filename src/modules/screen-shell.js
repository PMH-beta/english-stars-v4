// src/modules/screen-shell.js
// Grundton eines Screens setzen — Pastell-Redesign.
//
// Die Spezifikation erlaubt pro Screen genau EINEN Grundton. Er steckt in der
// Klasse .p-ton-<name>, die --p-ton setzt; Screen-Hintergrund, aktiver Tab und
// Akzent-Button lesen daraus (siehe style.css, Abschnitt Bausteine).
//
// Drei Dinge müssen dabei zusammen passieren, darum diese Funktion statt einem
// classList-Wechsel an jeder Stelle:
//   1. <body> bekommt den Ton, damit die Farbe den ganzen Bildschirm füllt —
//      der Body-Hintergrund färbt die Canvas-Fläche und damit auch die Bereiche
//      hinter Notch und Home-Leiste.
//   2. Der Screen selbst bekommt ihn, damit Tabs und Akzent-Buttons darin
//      denselben Ton erben.
//   3. <meta name="theme-color"> wird nachgezogen. Das ist der Hebel, mit dem
//      Android die Statusleiste und iOS ab 15 den Bereich um Uhrzeit und Akku
//      einfärbt — sonst bliebe oben ein fremdfarbener Streifen stehen.
//
// Der Farbwert wird aus der CSS-Variable gelesen, nicht hier noch einmal
// hingeschrieben: die Tokens in :root bleiben die einzige Quelle. Gelesen wird
// die Variable und nicht der berechnete Hintergrund — der liefert während der
// 0,25-s-Blende einen Zwischenwert.

export const GRUNDTOENE = ['lila', 'mint', 'amber', 'rosa', 'blau', 'pfirsich'];

function tonHex(ton) {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--p-' + ton);
  return v.trim();
}

function setThemeColor(hex) {
  if (!hex) return;
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
  m.setAttribute('content', hex);
}

// ton: einer aus GRUNDTOENE. el: das .p-screen-Element des Screens (optional).
export function setGrundton(ton, el) {
  if (!GRUNDTOENE.includes(ton)) { console.warn('[screen-shell] unbekannter Grundton "' + ton + '"'); return; }
  for (const ziel of [document.body, el]) {
    if (!ziel) continue;
    GRUNDTOENE.forEach(t => ziel.classList.remove('p-ton-' + t));
    ziel.classList.add('p-ton-' + ton);
  }
  document.body.classList.add('p-app');
  setThemeColor(tonHex(ton));
}

// Zurück auf das alte Layout — für Screens, die noch nicht umgestellt sind.
export function clearGrundton() {
  GRUNDTOENE.forEach(t => document.body.classList.remove('p-ton-' + t));
  document.body.classList.remove('p-app');
  setThemeColor('#a86cdb');   // Theme-Color der Alt-Oberfläche
}
