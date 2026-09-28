// src/modules/enemies.js
// Anbindung der Dungeon-Gegner an den Kampf. `pixel-enemies-dungeon.js` selbst
// bleibt unangetastet (Handoff-Regel 5) — hier steht nur, was die App davon
// braucht: einen Gegner je Knotentyp ziehen, seinen Namen holen und ihn in
// Kampf-Blickrichtung zeichnen.
//
// Warum eine eigene Zeichenfunktion: Das Modul exportiert mit dungeonEnemySVG()
// nur die VORDERANSICHT. Die Kampfansicht steht als Rohdaten in
// DUNGEON_ENEMIES_FACING_LEFT, ohne Renderer. Die Kodierung ist dieselbe:
// Zeichen = Index in ALPHA, folgende Zahl = Wiederholung, "." = transparent.
//
// Gewählt wird der Gegner einmal je Kampf (campaign-fight.js legt den Schlüssel
// in _ctx ab, nicht im Spielstand) — genau wie bisher, wo enemySpriteSVG(kind)
// bei jedem Aufbau der Kampfbühne neu gewürfelt hat.

import { ALPHA, DUNGEON_ENEMIES, DUNGEON_ENEMIES_FACING_LEFT, ENEMY_POOL } from './pixel-enemies-dungeon.js';

/**
 * Zufälliger Gegner-Schlüssel für einen Knotentyp.
 * @param {'fight'|'irregular'|'boss'} kind - derselbe Wert wie node.type
 * @returns {string} Schlüssel aus ENEMY_POOL (20 / 8 / 8 Gegner)
 */
export function pickEnemyKey(kind) {
  const pool = ENEMY_POOL[kind] || ENEMY_POOL.fight;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Anzeigename eines Gegners, z. B. „Moosschleim". Leer, wenn der Schlüssel unbekannt ist. */
export function enemyName(key) {
  const sp = DUNGEON_ENEMIES[key];
  return (sp && sp.name) || '';
}

// Lauflängen-kodiertes Sprite → SVG. Ohne preserveAspectRatio, damit das
// Seitenverhältnis erhalten bleibt: die Kampfansichten sind nicht alle quadratisch
// (z. B. Moosschleim 72 × 78), die Bühne ist es aber.
function spriteSVG(sp) {
  let rects = '';
  sp.r.forEach((row, y) => {
    let x = 0;
    row.replace(/(\D)(\d*)/g, (m, ch, n) => {
      const k = n ? +n : 1, i = ALPHA.indexOf(ch);
      if (i >= 0) rects += `<rect x="${x}" y="${y}" width="${k}" height="1" fill="${sp.p[i]}"/>`;
      x += k;
      return m;
    });
  });
  return `<svg viewBox="0 0 ${sp.w} ${sp.h}" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;" aria-hidden="true">${rects}</svg>`;
}

/** Gegner in Kampf-Blickrichtung: nach links gedreht, zum Helden. */
export function enemyBattleSVG(key) {
  const sp = DUNGEON_ENEMIES_FACING_LEFT[key];
  return sp ? spriteSVG(sp) : '';
}
