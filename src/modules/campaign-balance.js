// src/modules/campaign-balance.js
// Alle Balancing-Zahlen der Kampagne an einem Ort — nachjustieren ohne Logik anzufassen.

// Spieler-HP pro Run.
export const HP_MAX = 60;

// Boss-Sieg: Belohnung obendrauf (zusätzlich zum nächsten Lauf ohne Einsatz — siehe
// STAKE_COST/freeStart in campaign.js).
export const BOSS_WIN_TALER = 1;

// Gegner je Knotentyp. Wellen sind UNBEGRENZT — der Kampf endet erst bei Gegner-HP 0
// (Sieg) oder Spieler-HP 0 (Tod). hp steuert also die Kampflänge (18 HP ≈ 2–3 gewonnene
// Wellen je nach Waffe), dmg = Spieler-HP-Verlust pro verlorener Welle.
export const ENEMY = {
  fight:     { hp: 22, dmg: 9, icon: '👾', name: 'Wortgeist' },
  irregular: { hp: 36, dmg: 11, icon: '🌀', name: 'Gestaltwandler' },   // Phase 2
  boss:      { hp: 58, dmg: 16, icon: '🐉', name: 'Boss' },
};

// Schwierigkeit steigt mit jeder abgeschlossenen Runde (= Boss-Siege bisher, round=0
// in der allerersten Runde): +15 % HP/Schaden pro Runde.
export const ROUND_SCALE = 0.15;
export function scaledEnemy(type, round) {
  const base = ENEMY[type] || ENEMY.fight;
  const mult = 1 + ROUND_SCALE * Math.max(0, round || 0);
  return { ...base, hp: Math.round(base.hp * mult), dmg: Math.round(base.dmg * mult) };
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
export const TF_PAIRS = 3;
export const TF_TIME_MS = 17000;

// ── Wortauswahl im Kampf: Vorrat mit fester Grundzahl ──
// Der Kampf führt einen EIGENEN Lernstand je Wort (Stat-Suffix _cf) — getrennt von
// den Vokabel-Stats, ohne Einfluss auf Taler, Deck-Prozente oder Statistik-Seiten.
// Ein Wort gilt als „gelernt", wenn es CF_MIN_ASKED-mal dran war und sein EMA über
// CF_MASTER liegt.
// Im Vorrat stehen immer CF_POOL_OPEN OFFENE Wörter — ungefähr so viele, wie man
// beim Freischalten (2 Taler) selbst geübt hat. Zuerst zählen die eigenen Deck-Wörter;
// erst wenn die nicht reichen, füllen Vorlagen-Wörter auf. Wird ein Wort gelernt, wird
// sein Platz in derselben Reihenfolge nachbesetzt — eigene zuerst, Vorlagen nur als
// Auffüllung.
// Eigene Wörter kommen zudem erst in den Kampf, wenn sie im normalen Deck-Üben
// mindestens CF_SEEN_MIN-mal dran waren (in EINER der drei Arten) — der Kampf ist
// Wiederholung, keine Erstbegegnung. Neue Decks/Wörter rutschen dadurch auch mitten
// im Lauf nach, sobald sie zweimal dran waren.
export const CF_MIN_ASKED = 3;
export const CF_MASTER = 0.9;
export const CF_POOL_OPEN = 20;
export const CF_NO_REPEAT = 6;             // so viele zuletzt gezogene Wörter bleiben gesperrt
export const CF_SEEN_MIN = 2;
export const CF_LEARNED_WEIGHT = 0.35;     // gelernte Wörter: seltener, aber nie ganz weg
export const CF_OWN_SHARE = 0.2;           // jede 5. Welle garantiert ein eigenes Deck-Wort
// Wiederholungs-Anteil als FESTE Quote statt über das Gewicht: sonst wächst er mit der
// Zahl gelernter Wörter mit (bei 300 gelernten wären 75 % der Wellen Wiederholung).
export const CF_REVIEW_SHARE = 0.2;

// 🌀-Verben, Schritt 1: zuerst die EIGENEN, schon geübten Verben — die aus den
// Schmiede-Aufträgen und den Trainingsplatz-Decks. Genau wie bei den Wörtern ist
// der Kampf hier Wiederholung: eine Form zählt erst als „geübt", wenn sie in der
// Schmiede/im Training mindestens VERB_OWN_SEEN_MIN-mal dran war.
// Der Anteil sinkt pro Runde — danach übernimmt die Stufen-Glocke unten und die
// Wellen werden Runde für Runde schwerer (fremde und höhere Stufen).
export const VERB_OWN_SHARE_START = 0.85;
export const VERB_OWN_SHARE_PER_ROUND = 0.10;
export const VERB_OWN_SHARE_MIN = 0.30;
export const VERB_OWN_SEEN_MIN = 2;

// 🌀-Verben, Schritt 2: der Schwerpunkt der Stufe (tier 1–5) wandert pro abgeschlossener
// Runde nach oben. Bewusst als Glockenkurve statt als Schwelle — leichte Stufen bleiben
// immer möglich, die Steigerung ist stetig statt sprunghaft.
export const VERB_TIER_START = 1.0;
export const VERB_TIER_PER_ROUND = 0.45;
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
export const TALISMAN_MULT = 1.5;          // Waffenschaden ×1.5 an 🌀-Knoten
export const RING_POTION_BONUS = 1;        // 💍 je Ring: +1 Trank-Auswahl am 💎 (3→4→5)
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
