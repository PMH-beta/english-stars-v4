// src/modules/tour.js
// App-Tour 1.11–1.15 (F-14): fünf Schritte mit Vondu auf einem neutralen
// Demo-Stand. Sie kommt genau einmal nach der Charakter-Erstellung eines neuen
// Spielstands (campaign.tourSeen === false, gesetzt in finishCharacterOnboarding)
// und jederzeit über „App-Tour ansehen" im Profil (8.1). Beenden UND Überspringen
// setzen tourSeen: true. Ältere Spielstände haben das Feld nicht und gelten als
// „gesehen" — sie sehen die Tour nicht von selbst.
//
// Demo-Stand (START-HERE „App-Tour"): Name „Vondu", Standardfigur, 0 Kronen,
// 0 Taler, keine Sammlungen — nur Schritt 2 zeigt die Sammlung „Tiere", die in
// Schritt 1 entstehen würde. Gezeichnet wird er mit renderMenuDemo (ui.js):
// window.SD zeigt nur während des synchronen Zeichnens auf den Demo-Stand,
// Speichern und Sync sind so lange gesperrt. Der echte Stand wird dabei weder
// angezeigt noch verändert; am Ende zeichnet showMenu/showProfile ihn neu.

import { VONDU_FRAMES, decodeSprite, itemPartsImage } from './pixel-world-fine.js';
import { atemBilderHTML, paintStages } from './hero.js';
import { iconHTML } from './pixel-icons.js';
import { defaultAvatar } from './avatar.js';
import { DEFAULT_DECKS } from './default-decks.js';
import { CONSTELLATION_SIZE, FORGE_OBJECTS } from './irregular-verbs.js';
import { SLOTS_PER_FORM } from './irregular-game.js';
import { objectPerkText, ohneEmoji } from './campaign-equipment.js';
import { UNLOCK_NEED } from './campaign.js';
import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { renderMenuDemo, showMenu, showProfile } from './ui.js';

const DEMO_DECK = 'tour_tiere';
// Beispiel in Schritt 3: Speer in Stahl, zwei Teile fertig, das dritte glüht.
const BEISPIEL = { type: 'speer', mat: 'past', zustand: 'bbngg', fertig: 2 };

const SCHRITTE = [
  {
    tab: 'free', box: 'unten', titel: 'Hi, ich bin Vondu!',
    text: () => `In ${SCHRITTE.length} kurzen Schritten zeig ich dir alles. Zuerst brauchst du Wörter: Nimm eine fertige Vorlage und leg sofort los – oder bau dir eine eigene Sammlung. Tippen, einfügen oder einfach scannen.`,
    // Beide Startwege gemeinsam markiert (eigene Fläche um die Gruppe).
    ziel: () => _gruppe([...document.querySelectorAll('#decks-container .p-leerwahl-karte')], 'tv-gruppe--start'),
  },
  {
    tab: 'free', box: 'oben', titel: 'Taler sammeln', sammlung: true,
    text: () => 'Jede Sammlung hat drei Übungsarten. Bringst du eine davon auf 100 %, springt ein Taler raus – bis zu drei pro Sammlung. Die setzt du gleich in der Kampagne ein.',
    // Kopf mit „0/3 Taler", Balken und die drei Übungsarten mit „+1 Taler".
    ziel: () => {
      const karte = document.querySelector(`#decks-container [data-deck-id="${DEMO_DECK}"]`);
      if (!karte) return null;
      const teile = ['.p-sammlung-kopf', '.p-balken', '.p-modi'].map((s) => karte.querySelector(':scope > ' + s)).filter(Boolean);
      return _gruppe(teile, 'tv-gruppe--karte');
    },
  },
  {
    tab: 'student', box: 'unten', eng: true, titel: 'Die Schmiede', beispiel: true,
    text: () => `Hier werden aus Verben Waffen: Wähl ein Objekt, befüll es mit ${CONSTELLATION_SIZE} unregelmäßigen Verben und üb sie.`,
    // Schmiede-Kopf: Titel + Stationen · Schritte · Noch frei.
    ziel: () => _markiere(document.querySelector('#student-uv .forge-top'), 'tv-gruppe--schmiede'),
  },
  {
    tab: 'campaign', box: 'oben', titel: 'Kampagne & Kampf',
    text: () => `Hier kämpfst du dich mit deinen Wörtern bis zum Boss. Sobald ${UNLOCK_NEED} Übungsarten auf 100 % sind, ist die Kampagne frei – dann setzt du Taler ein und los geht’s.`,
    ziel: () => _markiere(document.querySelector('#mode-campaign .p-kstart'), ''),
  },
  {
    tab: 'free', box: 'unten', titel: 'Dein Profil',
    text: () => 'Tipp oben auf dein Bild: Dort passt du deinen Charakter an, legst Ausrüstung an und findest Freunde. Und mich samt Tour findest du dort jederzeit wieder.',
    ziel: () => _markiere(document.querySelector('#menu-screen .p-banner'), ''),
  },
];
export const TOUR_SCHRITTE = SCHRITTE.length;

let _lauf = null;   // { schritt, herkunft: 'start' | 'profil', dunkel, box, ziel, gruppe }

export const tourLaeuft = () => !!_lauf;

/** Tour starten: 'start' nach der Charakter-Erstellung, 'profil' aus 8.1. */
export function tourStarten(herkunft = 'profil') {
  if (_lauf) return;
  _lauf = { schritt: 0, herkunft, dunkel: null, box: null, ziel: null, gruppe: null };
  document.body.classList.add('tour-aktiv');
  const menu = document.getElementById('menu-screen');
  if (menu) menu.inert = true;   // nichts im Menü antippen oder anspringen
  const dunkel = document.createElement('div');
  dunkel.className = 'tv-dunkel';
  const box = document.createElement('div');
  box.className = 'tv-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  document.body.appendChild(dunkel);
  document.body.appendChild(box);
  _lauf.dunkel = dunkel;
  _lauf.box = box;
  _zeige();
}

/** „App-Tour ansehen" → Starten (8.1). Am Ende zurück ins Profil. */
export function tourAnsehen() { tourStarten('profil'); }

/** Zurück-Taste während der Tour: einen Schritt zurück (im ersten Schritt nichts). */
export function tourZurueck() {
  if (!_lauf || _lauf.schritt === 0) return;
  _lauf.schritt--;
  _zeige();
}

function _weiter() {
  if (!_lauf) return;
  if (_lauf.schritt < SCHRITTE.length - 1) { _lauf.schritt++; _zeige(); }
  else _ende();
}

/** Tour-Ebene abräumen, ohne etwas zu speichern — auch wenn ein anderer Screen
 *  übernimmt (z. B. abgelaufene Anmeldung). Das Menü zeichnet showMenu neu. */
export function tourAbbrechen() {
  if (!_lauf) return;
  _ziel_loesen();
  _muenze(false);
  _lauf.dunkel.remove();
  _lauf.box.remove();
  _lauf = null;
  document.body.classList.remove('tour-aktiv');
  const menu = document.getElementById('menu-screen');
  if (menu) menu.inert = false;
}

// Beenden und Überspringen: tourSeen speichern, echten Stand wieder zeichnen.
function _ende() {
  if (!_lauf) return;
  const herkunft = _lauf.herkunft;
  tourAbbrechen();
  const sd = window.SD;
  if (sd) {
    if (!sd.campaign || typeof sd.campaign !== 'object') sd.campaign = { claimed: [], talerSpent: 0, run: null };
    if (sd.campaign.tourSeen !== true) {
      sd.campaign.tourSeen = true;
      persist(sd);
      if (window.currentUser) markDirty('profile');
    }
  }
  // Der Demo-Stand hatte den Schnellmodus abgeschaltet — echten Zustand spiegeln.
  try { window.syncSchnellForMode?.(sd?.activeMode || 'free'); } catch (e) {}
  if (herkunft === 'profil') showProfile(); else showMenu();
}

// ── Demo-Stand ──────────────────────────────────────────────────────────────
function _demoStand(schritt) {
  const leer = () => ({ played: 0, correct: 0, bestStreak: 0 });
  const decks = {};
  if (schritt.sammlung) {
    // Die Sammlung, die in Schritt 1 entstehen würde: Vorlage „Tiere", alles 0 %.
    const tiere = DEFAULT_DECKS.find((d) => d.name === 'Tiere') || DEFAULT_DECKS[0];
    decks[DEMO_DECK] = {
      _tourDemo: true,
      id: DEMO_DECK, name: tiere.name, createdAt: Date.now(),
      vocab: tiere.vocab.map((v) => ({ de: v.de, en: v.en })),
      wordStats: {}, categoryProgress: { vocab: leer(), spelling: leer(), pronounce: leer(), mixed_vocab: leer() },
      presetCategories: [], presetsLocked: false, deckPath: 'preset', mode: 'free', sortOrder: 10,
    };
  }
  return {
    _tourDemo: true,
    _version: 4,
    playerName: 'Vondu', highscore: 0, totalPoints: 0,
    avatar: defaultAvatar(),
    activeMode: schritt.tab, presetIntroSeen: true,
    activeDeckId: null, activeDeckByMode: {},
    decks,
    categoryProgress: { vocab: leer(), spelling: leer(), pronounce: leer(), mixed_vocab: leer() },
    wordStats: {},
    globalPresetStats: { wordStats: {}, categoryProgress: {} },
    probetests: [],
    uvFills: [],
    campaign: { claimed: [], talerSpent: 0, run: null, equipment: {}, bossWins: 0, round: 0, stats: {}, freeStart: false, carryPotions: null, runLen: 0, tourSeen: true },
  };
}

// ── Ein Schritt ─────────────────────────────────────────────────────────────
function _zeige() {
  const i = _lauf.schritt, s = SCHRITTE[i];
  _ziel_loesen();
  renderMenuDemo(_demoStand(s), s.tab, s.sammlung ? DEMO_DECK : null);
  if (s.sammlung) {
    // Die Demo-Sammlung ist gerade erst entstanden (1.12: „Heute · 12 Wörter").
    const datum = document.querySelector(`#decks-container [data-deck-id="${DEMO_DECK}"] .p-sammlung-datum`);
    if (datum) datum.textContent = 'Heute · ';
  }
  _muenze(i === 1);   // 1.12: die Münze im Banner dreht sich
  _lauf.ziel = s.ziel();
  _baueBox(i, s);
  _platziere();
}

// Mehrere Geschwister als markierte Gruppe: eigene Fläche um die Elemente.
function _gruppe(els, cls) {
  if (!els.length) return null;
  const g = document.createElement('div');
  g.className = 'tv-gruppe ' + cls;
  els[0].before(g);
  els.forEach((el) => g.appendChild(el));
  _lauf.gruppe = g;
  return _markiere(g, '');
}
function _markiere(el, cls) {
  if (!el) return null;
  el.classList.add('tv-ziel');
  if (cls) el.classList.add(cls);
  return el;
}
function _ziel_loesen() {
  const g = _lauf.gruppe;
  if (g && g.isConnected) { g.replaceWith(...g.childNodes); }
  _lauf.gruppe = null;
  document.querySelectorAll('.tv-ziel').forEach((el) => el.classList.remove('tv-ziel', 'tv-gruppe--schmiede'));
  _lauf.ziel = null;
}

// Taler-Münze im Banner (1.12: data-ui="flip", 24 Takte).
function _muenze(an) {
  const cv = document.getElementById('menu-taler')?.previousElementSibling;
  if (!cv || cv.tagName !== 'CANVAS') return;
  if (an) { cv.dataset.c = '24'; cv.dataset.d = '0'; cv.dataset.ui = 'flip'; }
  else if (cv.dataset.ui === 'flip') { delete cv.dataset.ui; delete cv.dataset.c; delete cv.dataset.d; cv.style.transform = ''; }
}

// Dialog-Box im Spiel-Stil (START-HERE „App-Tour"): Vondu steht auf der Box,
// Namensschild und Fortschrittsleiste auf der Oberkante, unten die Knöpfe.
function _baueBox(i, s) {
  const box = _lauf.box, letzter = i === SCHRITTE.length - 1;
  box.className = 'tv-box tv-box--' + s.box + (s.eng ? ' tv-box--eng' : '');
  const leiste = SCHRITTE.map((_, k) => `<span class="${k < i ? 'is-fertig' : k === i ? 'is-jetzt' : ''}"></span>`).join('');
  box.innerHTML = `
    <div class="tv-vondu">${atemBilderHTML('vondu', () => VONDU_FRAMES.map(decodeSprite), 2)}</div>
    <div class="tv-schild">VONDU</div>
    <div class="tv-leiste">${leiste}</div>
    <div class="tv-titel">${s.titel}</div>
    <div class="tv-text">${s.text()}</div>
    ${s.beispiel ? _beispielHTML() : ''}
    <div class="tv-knoepfe">
      ${letzter ? '' : '<button class="tv-skip">Überspringen</button>'}
      <span class="p-wachs"></span>
      ${i > 0 ? '<button class="tv-zurueck" aria-label="Zurück">‹</button>' : ''}
      <button class="tv-weiter">${letzter ? 'Los geht’s!' : 'Weiter'}<span class="tv-nudge">›</span></button>
    </div>`;
  box.querySelector('.tv-skip')?.addEventListener('click', _ende);
  box.querySelector('.tv-zurueck')?.addEventListener('click', tourZurueck);
  box.querySelector('.tv-weiter').addEventListener('click', _weiter);
  paintStages(box);   // Bild 0 sofort (und bei reduzierter Bewegung dauerhaft)
}

// Schritt 3: Speer im Zustand „bbngg" (4 fps) neben Fortschritt und Satz,
// darunter die beiden Materialien.
function _beispielHTML() {
  const b = BEISPIEL;
  const ob = FORGE_OBJECTS.find((o) => o.type === b.type);
  const pct = Math.round(b.fertig / SLOTS_PER_FORM * 100);
  const bild = atemBilderHTML('tv:' + b.type + ':' + b.zustand,
    () => [0, 1, 2, 3].map((f) => itemPartsImage(b.type, b.mat, b.zustand, f)), 3);
  return `<div class="tv-beispiel">
      <div class="tv-beispiel-bild">${bild}</div>
      <div class="tv-beispiel-rechts">
        <div class="tv-beispiel-kopf"><span class="tv-beispiel-label">${iconHTML('hammer', 14)}Schmieden</span><span class="tv-beispiel-pct">${pct}%</span></div>
        <div class="tv-beispiel-balken"><i style="width:${pct}%"></i></div>
        <div class="tv-beispiel-satz">Jeder geschaffte Schritt schmiedet ein Teil. Nach ${SLOTS_PER_FORM} Teilen ist der ${ob.name} fertig – angelegt macht er <strong>${ohneEmoji(objectPerkText(ob))}</strong>.</div>
      </div>
    </div>
    <div class="tv-chips"><span class="p-chip tv-chip--stahl">Stahl · Simple Past</span><span class="p-chip tv-chip--gold">Gold · Past Participle</span></div>`;
}

// Das markierte Element soll frei zwischen Box und Bildschirmrand stehen. Auf dem
// Referenzgerät (874 px) passt alles ohne Scrollen; auf kleineren Handys rückt
// die Seite so weit wie nötig nach, ohne den Anfang unter die Box zu schieben.
function _platziere() {
  window.scrollTo(0, 0);
  const ziel = _lauf.ziel, box = _lauf.box;
  if (!ziel) return;
  const LUFT = 12;
  const vh = window.innerHeight;
  const b = box.getBoundingClientRect(), z = ziel.getBoundingClientRect();
  const oben = box.classList.contains('tv-box--oben');
  const frei0 = oben ? b.bottom + LUFT : LUFT;
  const frei1 = oben ? vh - LUFT : b.top - LUFT;
  if (z.bottom <= frei1) return;
  const dy = Math.min(z.bottom - frei1, z.top - frei0);
  if (dy > 0) window.scrollTo(0, dy);
}
