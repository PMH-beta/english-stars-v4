// src/modules/campaign-balance.js
// Alle Balancing-Zahlen der Kampagne an einem Ort — nachjustieren ohne Logik anzufassen.

// Spieler-HP pro Run.
export const HP_MAX = 60;

// Gegner je Knotentyp. Wellen sind UNBEGRENZT — der Kampf endet erst bei Gegner-HP 0
// (Sieg) oder Spieler-HP 0 (Tod). hp steuert also die Kampflänge (18 HP ≈ 2–3 gewonnene
// Wellen je nach Waffe), dmg = Spieler-HP-Verlust pro verlorener Welle.
export const ENEMY = {
  fight:     { hp: 18, dmg: 5, icon: '👾', name: 'Wortgeist' },
  irregular: { hp: 30, dmg: 5, icon: '🌀', name: 'Gestaltwandler' },   // Phase 2
  boss:      { hp: 48, dmg: 8, icon: '🐉', name: 'Boss' },
};

// Waffenschaden pro gewonnener Welle: ohne Schmiede-Waffe kämpft die Faust;
// mit Waffe = WEAPON_BASE_DMG + fertige Teile (1–5 → 6–10). „Verzaubert" (alle
// 5 Teile inkl. Verzaubern-Slot) ist damit automatisch die 10er-Stufe.
export const FIST_DMG = 4;
export const WEAPON_BASE_DMG = 5;

// Formen-Bonus (nur 🌀/👑, dort gibt es Formen-Wellen): Stahl-Waffe (= Simple Past)
// +2 Schaden auf Past-Wellen, Gold-Waffe (= Past Participle) +2 auf PP-Wellen.
export const FORM_BONUS = 2;

// 🔥 Rastplatz: Heilung (auf hpMax gedeckelt).
export const REST_HEAL = 15;

// Buchstabensturm (Minispiel).
export const STORM_BASE_MS = 20000;        // Grundzeit
export const STORM_PER_LETTER_MS = 2000;   // +2 s je Buchstabe ab dem 6.
export const STORM_PENALTY_MS = 2000;      // Zeitstrafe bei falschem Buchstaben
export const WEAK_TIME_BONUS = 0.25;       // +25 % Zeit bei unsicheren Wörtern
export const WEAK_EMA = 0.5;               // „unsicher" = EMA darunter (oder <3 Versuche)

// Wort-Meteoriten (Minispiel).
export const METEOR_FALL_MS = 9000;        // Fallzeit des richtigen Meteoriten
export const METEOR_COUNT = 4;             // 1 richtig + 3 falsch

// Echo-Fang (Minispiel).
export const ECHO_TIME_MS = 15000;
export const ECHO_CHOICES = 5;             // 1 richtig + 4 falsch

// ── Ausrüstung (alles wird in der Schmiede gebaut) ──
// Rüstungs-Stufe: Stahl (Past-Form) / Gold (PP-Form); „Verzaubert" = alle 5 Teile
// fertig (inkl. Verzaubern-Slot). Effekte pro Stufe:
export const EQUIP_EFFECT = {
  head: { stahl: 1, gold: 1, verzaubert: 2 },            // abgewehrte Wellen pro Kampf
  body: { stahl: 5, gold: 10, verzaubert: 15 },          // max. HP
  arms: { stahl: 2000, gold: 3000, verzaubert: 5000 },   // Zeitbonus je Minispiel (ms)
  legs: { stahl: 0.10, gold: 0.20, verzaubert: 0.30 },   // Ausweich-Chance
};
export const TALISMAN_MULT = 1.5;          // Waffenschaden ×1.5 an 🌀-Knoten
export const RING_POTION_BONUS = 1;        // 💍 je Ring: +1 Trank-Auswahl am 💎 (3→4→5)
export const COMPANION_GUARDS = 1;         // 🐾 gefangene Fehlgriffe pro Kampf

// Waffen-Typ-Vorteile (Objekt-Wahl in der Schmiede zeigt den Text an).
export const WEAPON_PERK = {
  schwert: { text: '+1 Schaden' },
  dolch:   { text: '+10 % Ausweichen' },
  speer:   { text: '+2 Schaden gegen Bosse' },
  axt:     { text: '+2 Schaden gegen 🌀-Elite' },
  hammer:  { text: 'Erste Welle: doppelter Schaden' },
  stab:    { text: '+3 s Zeit pro Minispiel' },
  bogen:        { text: '+2 Schaden gegen 👾 Wortgeister' },
  streitkolben: { text: 'wehrt 1 verlorene Welle pro Kampf ab' },
};
export const PERK_SCHWERT_DMG = 1;
export const PERK_DOLCH_DODGE = 0.10;
export const PERK_SPEER_BOSS = 2;
export const PERK_AXT_ELITE = 2;
export const PERK_HAMMER_MULT = 2;
export const PERK_STAB_MS = 3000;
export const PERK_BOGEN_FIGHT = 2;
export const PERK_KOLBEN_GUARD = 1;

// ── Tränke (💎 Schatz: 3 zufällige zur Wahl, run-gebunden, im Kampf spielbar) ──
export const POTION_CHOICES = 3;
export const POTION_HEAL = 20;             // ❤️ sofort
export const POTION_POWER = 3;             // 💪 +Schaden für den Rest des Kampfes
export const POTION_TIME_MS = 5000;        // ⏳ Zeitbonus …
export const POTION_TIME_WAVES = 3;        // … für so viele Wellen
