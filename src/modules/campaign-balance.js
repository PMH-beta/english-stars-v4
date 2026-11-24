// src/modules/campaign-balance.js
// Alle Balancing-Zahlen der Kampagne an einem Ort — nachjustieren ohne Logik anzufassen.

// Spieler-HP pro Run.
export const HP_MAX = 60;

// Boss-Sieg: Belohnung obendrauf (zusätzlich zum nächsten Lauf ohne Einsatz — siehe
// STAKE_COST/freeStart in campaign.js).
export const BOSS_WIN_TALER = 1;

// Gegner je Knotentyp. Wellen sind UNBEGRENZT — der Kampf endet erst bei Gegner-HP 0
// (Sieg) oder Spieler-HP 0 (Tod). hp steuert also die Kampflänge, dmg = Spieler-HP-
// Verlust pro verlorener Welle. Seit 09.10.2026 (F-79) 30 % weniger Leben (vorher
// 22/36/58): mit der Faust 4/7/11 gewonnene Wellen in Runde 1 statt 6/9/15. Die
// Unregelmäßigen (Spirale) sind seitdem so stark wie normale Gegner — stärker ist
// nur der Boss (Wunsch des Nutzers, vorher 25/11).
export const ENEMY = {
  fight:     { hp: 15, dmg: 9, icon: '👾', name: 'Wortgeist' },
  irregular: { hp: 15, dmg: 9, icon: '🌀', name: 'Gestaltwandler' },   // Phase 2
  boss:      { hp: 41, dmg: 16, icon: '🐉', name: 'Boss' },
};

// Schwierigkeit steigt mit jeder abgeschlossenen Runde (= Boss-Siege bisher, round=0
// in der allerersten Runde): +15 % Schaden, aber nur +8 % Leben pro Runde (F-79) —
// spätere Runden werden gefährlicher, die Kämpfe aber kaum länger.
export const ROUND_SCALE = 0.15;
export const ROUND_SCALE_HP = 0.08;

// Zeit je Runde (F-102, 15.10.2026; hebt F-83 „bleibt gleich“ auf): mit jeder
// abgeschlossenen Runde 5 % weniger Grundzeit in jedem Minispiel, höchstens 40 %
// weniger (ab Runde 9 bleibt es bei 60 %). Zeitboni (Handschuhe, Stab, Zeittrank)
// kommen danach unverändert obendrauf.
export const ROUND_TIME_STEP = 0.05;
export const ROUND_TIME_MIN = 0.6;
export function roundTimeFactor(round) {
  return Math.max(ROUND_TIME_MIN, 1 - ROUND_TIME_STEP * Math.max(0, round || 0));
}
export function scaledEnemy(type, round) {
  const base = ENEMY[type] || ENEMY.fight;
  const r = Math.max(0, round || 0);
  return { ...base, hp: Math.round(base.hp * (1 + ROUND_SCALE_HP * r)), dmg: Math.round(base.dmg * (1 + ROUND_SCALE * r)) };
}

// Waffenschaden pro gewonnener Welle: ohne Schmiede-Waffe kämpft die Faust;
// mit Waffe = WEAPON_BASE_DMG + fertige Teile (1–5 → 4–8). „Verzaubert" (alle
// 5 Teile inkl. Verzaubern-Slot) ist damit automatisch die 8er-Stufe.
// Gold (= Past Participle) ist das wertvollere Material: +2 Grundschaden.
export const FIST_DMG = 4;
export const WEAPON_BASE_DMG = 3;
export const WEAPON_GOLD_BONUS = 2;

// Formen-Bonus (nur 🌀/👑, dort gibt es Formen-Wellen): Stahl-Waffe (= Simple Past)
// +2 Schaden auf Past-Wellen, Gold-Waffe (= Past Participle) +2 auf PP-Wellen.
export const FORM_BONUS = 2;

// 🔥 Rastplatz: Heilung (auf hpMax gedeckelt).
export const REST_HEAL = 15;

// Buchstabensturm (Minispiel).
export const STORM_BASE_MS = 20000;        // Grundzeit
export const STORM_PER_LETTER_MS = 2000;   // +2 s je Buchstabe ab dem 6.
export const STORM_PENALTY_MS = 2000;      // Zeitstrafe bei falschem Buchstaben
// HP-Verlust je Fehlgriff — gilt in JEDEM Minispiel (falscher Buchstabe, falscher
// Meteor, falsches Echo-Wort, Fehlurteil): ein Fehler beendet die Welle nicht mehr,
// er kostet Leben und das Minispiel läuft weiter.
export const STORM_MISS_DMG = 6;
export const WEAK_TIME_BONUS = 0.25;       // +25 % Zeit bei unsicheren Wörtern
export const WEAK_EMA = 0.5;               // „unsicher" = EMA darunter (oder <3 Versuche)

// Wort-Meteoriten (Minispiel).
export const METEOR_FALL_MS = 9000;        // Fallzeit des richtigen Meteoriten
export const METEOR_COUNT = 4;             // 1 richtig + 3 falsch

// Echo-Fang (Minispiel).
export const ECHO_TIME_MS = 15000;
export const ECHO_CHOICES = 5;             // 1 richtig + 4 falsch

// Stimmt das? (Minispiel): mehrere Wortpaare hintereinander beurteilen. Ein Fehl-
// urteil beendet die Welle sofort — die Zeit gilt für ALLE Paare zusammen.
// 22 s seit 09.10.2026 (F-81, vorher 17 s — man musste sich zu sehr beeilen).
export const TF_PAIRS = 3;
export const TF_TIME_MS = 22000;

// ── Wortauswahl im Kampf: drei Töpfe + Fälligkeit (LU-04, Konzept 19.11.) ──
// Der Kampf führt einen EIGENEN Lernstand je Wort (Stat-Suffix _cf) — getrennt von
// den Vokabel-Stats, ohne Einfluss auf Taler, Deck-Prozente oder Statistik-Seiten.
// Ein Wort gilt als „gelernt", wenn es CF_MIN_ASKED-mal dran war und sein EMA über
// CF_MASTER liegt.
// Eigene Wörter kommen erst in den Kampf, wenn sie im normalen Deck-Üben mindestens
// CF_SEEN_MIN-mal dran waren (in EINER der Arten) — der Kampf ist Wiederholung.
export const CF_MIN_ASKED = 3;
export const CF_MASTER = 0.9;
export const CF_NO_REPEAT = 6;             // so viele zuletzt gezogene Wörter bleiben gesperrt
export const CF_SEEN_MIN = 2;
export const CF_LEARNED_WEIGHT = 0.35;     // gelernte Wörter: seltener, aber nie ganz weg

// Drei Töpfe je Art. Wörter: A = selbst angelegte Deck-Wörter, B = übernommene und
// geübte Vorlagen-Wörter, C = Vorlagen, die das Kind noch nie genutzt hat. Verben:
// A = in Schmiede/Training geübt, B = schon im Kampf dran, C = noch nie dran.
// Anteil je Welle nach Runde (Runde 1 = erste Karte); ein leerer Topf gibt seinen
// Anteil an die anderen ab.
export const CF_TOPF_MIX = [
  { bis: 3,        a: 0.70, b: 0.20, c: 0.10 },
  { bis: 9,        a: 0.60, b: 0.25, c: 0.15 },
  { bis: Infinity, a: 0.50, b: 0.30, c: 0.20 },
];
// Spannungsbogen je Karte: im ersten Drittel der Reihen kommt nur die Hälfte von C
// (der Rest geht an A), im letzten Drittel bekommt C 10 % von A, und Fälliges und
// Schwaches wiegt dort CF_BOGEN_SPAET_W-fach.
export const CF_BOGEN_FRUEH_C = 0.5;
export const CF_BOGEN_SPAET_C = 0.10;
export const CF_BOGEN_SPAET_W = 1.5;
// Topf C (Wörter): leichte Sammlungen immer, mittlere ab Runde 4, schwere ab Runde 10.
// Höchstens CF_NEU_OFFEN angefangene, noch nicht gelernte neue Wörter gleichzeitig —
// erst wenn eins sitzt, kommt ein weiteres neues dazu.
export const CF_NEU_MITTEL_AB = 4;
export const CF_NEU_SCHWER_AB = 10;
export const CF_NEU_OFFEN = 12;
// Fälligkeit: Abstand bis zum nächsten Mal im Kampf, je Stufe (box). Richtig an einem
// neuen Tag → eine Stufe höher, falsch → zurück auf Stufe 0 (1 Tag).
export const CF_ABSTAND = [1, 3, 7, 14, 30];
export const CF_W_FAELLIG = 3;             // fällig oder noch nie im Kampf dran: hoch
export const CF_W_NICHT_FAELLIG = 0.15;    // gerade im Kampf dran, noch nicht fällig: sehr niedrig
export const CF_W_GEUEBT = 3;              // in den letzten CF_GEUEBT_TAGE Tagen geübt, im Kampf seitdem nicht dran: wie fällig × 3
export const CF_GEUEBT_TAGE = 2;

// 🌀-Verben: eine Form zählt erst als „geübt" (Topf A), wenn sie in der Schmiede/im
// Training mindestens VERB_OWN_SEEN_MIN-mal dran war. Topf C: höchstens eine Stufe
// über dem höchsten geübten Verb; der Schwerpunkt der Stufe wandert bis Runde
// VERB_BOGEN_BIS von 1 auf 5 (Glocke — leichte Stufen bleiben immer möglich).
export const VERB_OWN_SEEN_MIN = 2;
export const VERB_BOGEN_BIS = 16;
export const VERB_TIER_SPREAD = 1.6;       // Breite der Glocke (größer = flacher)
export const VERB_TIER_FLOOR = 0.08;       // Mindestgewicht: leichte Stufen fallen nie ganz weg
export const VERB_FILLED_BONUS = 1.6;      // selbst befüllte Sternbild-Verben bevorzugt

// ── Ausrüstung (alles wird in der Schmiede gebaut) ──
// Rüstungs-Wirkung nach MATERIAL (stahl = Past-Form, gold = PP-Form) plus
// verzaubert-Bonus OBENDRAUF (alle 5 Teile fertig) — so ist Gold auf jeder
// Stufe besser als Stahl (z. B. Helm: Stahl 1, Gold 2).
export const EQUIP_EFFECT = {
  head: { stahl: 1, gold: 2, verzaubert: 0 },            // abgewehrte Wellen pro Kampf
  body: { stahl: 3, gold: 6, verzaubert: 3 },            // max. HP
  arms: { stahl: 2000, gold: 3000, verzaubert: 2000 },   // Zeitbonus je Minispiel (ms)
  legs: { stahl: 0.08, gold: 0.14, verzaubert: 0.06 },   // Ausweich-Chance
};
export const TALISMAN_MULT = 1.5;          // Waffenschaden ×1.5 an 🌀-Knoten (Silber-Talisman)
export const TALISMAN_MULT_GOLD = 1.75;    // Sonnen-Talisman ×1.75 — Gold wirkt stärker (F-100)
export const RING_POTION_BONUS = 1;        // 💍 Silber-Ring: +1 Trank-Auswahl am 💎 (3→4)
export const RING_POTION_BONUS_GOLD = 2;   // Kronenring: +2 (3→5, F-100)
// 🐾 gefangene Fehlgriffe pro Kampf — nach Material (Gold besser als Stahl).
export const COMPANION_GUARDS = { stahl: 1, gold: 2 };

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
