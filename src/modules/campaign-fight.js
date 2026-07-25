// src/modules/campaign-fight.js
// Kampf-Wrapper der Kampagne. Ein Knoten = Gegner mit HP; Wellen sind UNBEGRENZT —
// pro Welle ein Minispiel. Erfolg = Gegner erhält Waffenschaden, Misserfolg = Spieler
// verliert HP. Kampf endet bei Gegner-HP 0 (Sieg) oder Spieler-HP 0 (Tod → Run vorbei,
// Einsatz weg — Logik in campaign.js).
//
// Wellen-Mix: ⚔️ zieht zufällig aus Buchstabensturm / Meteoriten / Echo-Fang;
// 🌀 nur Verbform-Buchstabensturm (befüllte Sternbild-Verben, SD.uvFills);
// 👑 mischt alles. Meteoriten/Echo brauchen genug Wörter, Echo zusätzlich TTS —
// sonst fällt die Welle auf den Buchstabensturm zurück. Formen-Wellen geben der
// passenden Waffe +FORM_BONUS (Stahl = Past, Gold = PP).
//
// KEIN Mastery/EMA-Schreiben: eine Welle ist einmalig richtig oder falsch. EMA wird
// nur GELESEN — für die Wortauswahl (unsichere Wörter bevorzugt, weightedPickUnique)
// und den Zeitbonus (+25 % bei unsicheren Wörtern). Zwischenstand lebt in run.fight
// (reitet im profiles.campaign-jsonb mit) → Reload mitten im Kampf verliert nichts;
// nur das aktuelle Wort der Welle wird neu gezogen.

import { scaledEnemy, FORM_BONUS, TALISMAN_MULT, STORM_BASE_MS, STORM_PER_LETTER_MS, STORM_MISS_DMG, WEAK_TIME_BONUS, WEAK_EMA, METEOR_FALL_MS, METEOR_COUNT, ECHO_TIME_MS, ECHO_CHOICES, PERK_SPEER_BOSS, PERK_AXT_ELITE, PERK_HAMMER_MULT, PERK_BOGEN_FIGHT, POTION_HEAL, POTION_POWER, POTION_TIME_MS, POTION_TIME_WAVES, BOSS_WIN_TALER } from './campaign-balance.js';
import { startLetterstorm, stormTarget } from './minigame-letterstorm.js';
import { startMeteors } from './minigame-meteors.js';
import { startEcho } from './minigame-echo.js';
import { equippedWeapon, equipEffects, equippedGearMap, POTIONS } from './campaign-equipment.js';
import { enemySpriteSVG } from './pixel-enemies.js';
import { avatarSVG, ensureAvatar } from './avatar.js';
import { weightedPickUnique, playSfx } from './game.js';
import { effectivePct, statKeyFor } from './stats.js';
import { getConstellations } from './irregular-verbs.js';

const _TITLE = {
  fight:     '⚔️ Übung',
  irregular: '🌀 Unregelmäßige',
  boss:      '👑 Boss',
};

// Waffen-/Ausrüstungslogik lebt in campaign-equipment.js (equippedWeapon,
// equipEffects) — der Kampf liest sie nur.

// ── Verb-Pool: die selbst befüllten Sternbild-Verben (SD.uvFills) ────────────
function _verbPool() {
  const out = [];
  const seen = new Set();
  for (const c of getConstellations()) {
    for (const v of c.verbs) {
      if (seen.has(v.en)) continue;
      seen.add(v.en);
      out.push(v);
    }
  }
  return out;
}
// campaign.js nutzt das bei der Kartengenerierung: ohne Verben keine 🌀-Knoten.
export function verbsReady() { return _verbPool().length > 0; }

// ── Wortpool: alle eigenen Freier-Modus-Decks gemischt ───────────────────────
// Stats werden nur GELESEN: Vorlagen-Wörter aus globalPresetStats, manuelle aus dem
// jeweiligen Deck (SD.wordStats spiegelt nur das AKTIVE Deck → hier direkt ans Deck).
function _pool() {
  const out = [];
  const decks = window.SD?.decks || {};
  for (const id in decks) {
    const deck = decks[id];
    if ((deck.mode || 'free') !== 'free' || !deck.vocab?.length) continue;
    for (const v of deck.vocab) out.push({ de: v.de, en: v.en, _presetId: v._presetId || null, _deck: deck });
  }
  return out;
}
// Buchstabensturm = Schreib-Kompetenz → _sp-Stat.
function _statOf(item) {
  const key = statKeyFor(item.de, item.en, '_sp', item._presetId);
  return item._presetId ? window.SD?.globalPresetStats?.wordStats?.[key] : item._deck.wordStats?.[key];
}
export function fightPoolReady() { return _pool().length >= 1; }

// Zeitlimit: Grundzeit + Zuschlag pro Buchstabe ab dem 6.; unsichere Deck-Wörter
// (nie/kaum geübt oder EMA < 0.5) bekommen +25 %. Verb-Wellen nutzen nur die
// Buchstaben-Formel (kein Deck-Stat).
function _lettersMs(en) {
  const letters = stormTarget(en).replace(/ /g, '').length;
  return STORM_BASE_MS + Math.max(0, letters - 5) * STORM_PER_LETTER_MS;
}
function _timeLimit(item) {
  let ms = _lettersMs(item.en);
  const s = _statOf(item);
  const weak = !s || Math.floor(s.asked || 0) < 3 || effectivePct(s) < WEAK_EMA;
  if (weak) ms = Math.round(ms * (1 + WEAK_TIME_BONUS));
  return ms;
}

// Erste /-Alternative fürs Anzeigen/Sprechen (Meteoriten/Echo zeigen ganze Wörter).
function _displayEn(en) { return (en || '').split('/')[0].trim(); }

// n falsche Antworten aus dem Pool (einzigartig, ≠ richtige Antwort).
function _distractors(pool, correct, n) {
  const seen = new Set([correct]);
  const cands = [];
  for (const v of pool) {
    const w = _displayEn(v.en);
    if (seen.has(w)) continue;
    seen.add(w);
    cands.push(w);
  }
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  return cands.slice(0, n);
}

function _shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// ── Kampf-Lifecycle ──────────────────────────────────────────────────────────
let _ctx = null;   // { run, node, enemy, weapon, save, onEnd, mg, lastEn }

// onEnd(result): 'victory' | 'death' (auch bei bewusstem „Kampf verlassen") | null
// (interner Nicht-Fall, z. B. Wortpool beim Laden leer).
export function openFight({ run, node, save, onEnd, round }) {
  const enemy = scaledEnemy(node.type, round);
  if (!run.fight || run.fight.nodeId !== node.id) {
    // headUsed/guardsUsed = Zähler; shield/power/timeBoost = aktive Trank-Effekte.
    run.fight = { nodeId: node.id, type: node.type, enemyHp: enemy.hp, enemyHpMax: enemy.hp, wave: 1, headUsed: 0, guardsUsed: 0, shield: false, power: 0, timeBoost: 0 };
    save();
  }
  _ctx = { run, node, enemy, weapon: equippedWeapon(), eff: equipEffects(), save, onEnd, mg: null, lastEn: null, round };
  _renderOverlay();
  _startWave();
}

// ── Tränke im Kampf ──────────────────────────────────────────────────────────
function _renderPotions() {
  const el = _el('cf-potions');
  if (!el || !_ctx) return;
  const potions = _ctx.run.potions || [];
  el.innerHTML = potions.map((k, i) => POTIONS[k]
    ? `<button class="cf-potion" data-pi="${i}" title="${POTIONS[k].name}: ${POTIONS[k].desc}">${POTIONS[k].icon}</button>`
    : '').join('');
  el.querySelectorAll('[data-pi]').forEach(btn => { btn.onclick = () => _usePotion(+btn.dataset.pi); });
}

function _usePotion(i) {
  if (!_ctx) return;
  const { run, save } = _ctx;
  const f = run.fight;
  const key = (run.potions || [])[i];
  const p = POTIONS[key];
  if (!key || !p || !f) return;
  run.potions.splice(i, 1);
  // Wirkung als Popup über dem eigenen Character (wie Schaden über dem Gegner) —
  // beim Heiltrank die TATSÄCHLICH geheilte Menge (gedeckelt an hpMax).
  if (key === 'heal') {
    const before = run.hp;
    run.hp = Math.min(run.hpMax, run.hp + POTION_HEAL);
    _setBars();
    _damagePop('cf-hero', '+' + (run.hp - before), '#69db7c');
  } else {
    if (key === 'shield') f.shield = true;
    else if (key === 'power') f.power = (f.power || 0) + POTION_POWER;
    else if (key === 'time') f.timeBoost = (f.timeBoost || 0) + POTION_TIME_WAVES;
    _damagePop('cf-hero', `${p.icon} ${p.name}`, '#69db7c');
  }
  try { playSfx('streak'); } catch (e) {}
  save();
  _renderPotions();
}

function _el(id) { return document.getElementById(id); }

// Pixel-Himmel hinter dem Spielfeld (Art-Direction: freundliche Tag-Szene —
// heller Himmelverlauf, Sonne, Wolken). Der grüne Boden ist KEIN Teil dieser
// Szenerie mehr, sondern ein eigener durchgehender Bereich (.cf-ground-wrap,
// siehe _renderOverlay) — so gibt es keine Bruchkante zwischen Himmel-SVG
// und Boden mehr.
function _arenaScene() {
  const px = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  let s = '<rect x="0" y="0" width="128" height="72" fill="url(#cfSky)"/>';
  s += px(104, 8, 16, 8, '#ffe066') + px(106, 6, 12, 12, '#ffe066') + px(110, 4, 8, 16, '#ffe066')
    + px(108, 8, 8, 8, '#fff3bf');                                              // Sonne
  s += px(8, 8, 16, 4, '#ffffff') + px(4, 10, 24, 3, '#ffffff') + px(12, 6, 10, 3, '#ffffff');
  s += px(88, 4, 14, 3, '#ffffff') + px(84, 6, 22, 3, '#ffffff');               // Wolken (rechts, weg von der Wort-Karte)
  return `<svg viewBox="0 0 128 72" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;" aria-hidden="true">
    <defs><linearGradient id="cfSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8ecfff"/><stop offset="1" stop-color="#eaf6ff"/>
    </linearGradient></defs>${s}</svg>`;
}

// Kampf-Szene wie die ursprüngliche Kampagnen-Version: dunkler Violett-Verlauf,
// runder ✕-Knopf, Fredoka-Schrift, weiche Verlaufs-HP-Balken. NUR der Show-Teil
// oben ist Pixel-Art: die Landschafts-Arena mit Spieler (links) und Gegner (rechts).
function _renderOverlay() {
  _removeOverlay();
  const { run, node, enemy, weapon } = _ctx;
  const f = run.fight;
  const ov = document.createElement('div');
  ov.id = 'cf-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:8000;background:#bfe6ff;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;';
  ov.innerHTML = `
    <!-- Himmel als fullscreen-Hintergrund, hinter allem anderen. -->
    <div class="cf-scenery">${_arenaScene()}</div>
    <!-- Kopfzeile: schwebt als Pille über dem Himmel — bleibt wie gehabt. -->
    <div style="position:relative;z-index:3;display:flex;align-items:center;gap:10px;padding:14px 14px 0;flex-shrink:0;">
      <button id="cf-flee" title="Kampf verlassen (Fortschritt + Einsatz weg)" style="border:none;background:rgba(43,35,80,.6);color:#fff;border-radius:50%;width:38px;height:38px;font-size:1.1rem;cursor:pointer;flex-shrink:0;">✕</button>
      <div class="cf-pill" style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 16px;">
        <span style="font-family:'Fredoka One',cursive;color:#fff;font-size:1rem;">${_TITLE[node.type] || _TITLE.fight}</span>
        <span id="cf-wave" style="font-family:'Fredoka One',cursive;color:#ffd43b;font-size:.85rem;">Welle ${f.wave}</span>
      </div>
    </div>
    <!-- Kein Feedback-Text mehr: alle Ereignisse (Treffer/Heilung/Block) zeigen sich
         als Popup direkt über dem betroffenen Character (_damagePop). -->
    <!-- Spielfeld: die fliegenden/treibenden Elemente (Buchstaben/Meteore/Wörter),
         auf dem Himmel, direkt über den Figuren. Zentrierte Spalte (max-width), damit
         es auf breiten/Web-Bildschirmen nicht auseinandergezogen wirkt. -->
    <!-- z-index deutlich über dem Rasen (2): treibende Buchstaben/Meteore/Wörter dürfen
         nie hinter dem Boden-Bereich verschwinden, sonst sind sie nicht mehr antippbar. -->
    <div id="cf-stage" style="position:relative;z-index:5;flex:1;min-height:100px;width:100%;max-width:440px;margin:0 auto;padding:18px 14px 0;box-sizing:border-box;"></div>
    <!-- Boden-Bereich: enthält Figuren, Eingabefeld, Tränke, Leben. Der Rasen selbst
         (.cf-grass) ist NUR eine Hintergrund-Ebene ab Schulterhöhe der Figuren — die
         Figuren bleiben an ihrer normalen Position, Kopf/Schultern ragen in den Himmel. -->
    <div class="cf-ground-wrap">
      <div class="cf-grass"></div>
      <div class="cf-arena">
        <div class="cf-hero" id="cf-hero">${avatarSVG(ensureAvatar(window.SD), { gear: equippedGearMap() })}</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
          <div class="cf-enemy${node.type === 'boss' ? ' boss' : ''}" id="cf-enemy">${enemySpriteSVG(node.type)}</div>
          <div style="width:110px;">
            <div style="font-size:.72rem;font-weight:800;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.35);text-align:center;margin-bottom:2px;">${enemy.name}: <span id="cf-ehp">${f.enemyHp}</span>/${f.enemyHpMax}</div>
            <div style="height:9px;background:rgba(0,0,0,.18);border-radius:6px;overflow:hidden;"><div id="cf-ehpbar" style="height:100%;width:${f.enemyHp / f.enemyHpMax * 100}%;background:linear-gradient(90deg,#ff6b6b,#e03131);transition:width .4s;"></div></div>
          </div>
        </div>
      </div>
      <div id="cf-potions" style="position:relative;z-index:3;display:flex;gap:10px;justify-content:center;padding:10px 14px 0;min-height:10px;flex-shrink:0;"></div>
      <div style="position:relative;z-index:3;padding:10px 14px 12px;flex-shrink:0;display:flex;justify-content:center;">
        <div class="cf-pill" style="width:100%;max-width:320px;padding:9px 16px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.8rem;font-weight:800;color:#ffc9c9;margin-bottom:4px;">❤️ <span id="cf-php">${run.hp}</span> / ${run.hpMax}</div>
            <div style="height:12px;background:rgba(255,255,255,.2);border-radius:8px;overflow:hidden;"><div id="cf-phpbar" style="height:100%;width:${run.hp / run.hpMax * 100}%;background:linear-gradient(90deg,#ff6b6b,#e03131);transition:width .4s;"></div></div>
          </div>
          <div title="${weapon.name}" style="font-family:'Fredoka One',cursive;color:#fff;font-size:.9rem;background:rgba(255,255,255,.14);padding:8px 12px;border-radius:12px;flex-shrink:0;">${weapon.icon} ${weapon.dmg}</div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _el('cf-flee').onclick = () => {
    // Verlassen zählt wie Tod (verhindert Welle-neu-würfeln durch Fliehen+Fortsetzen) —
    // deshalb vorher fragen, mit demselben Blur-Hintergrund-Dialog wie „Aufgeben". Welle
    // pausiert währenddessen (Minispiel-Timer liefe sonst im Hintergrund weiter). Der
    // sichere Weg (Weiterkämpfen) ist der hervorgehobene ok-Button, nicht Verlassen.
    if (_ctx?.mg?.pause) _ctx.mg.pause();
    const leave = () => _close('death');
    if (window.esConfirm) {
      window.esConfirm({
        icon: '💀', title: 'Kampf verlassen?',
        body: 'Dein Fortschritt in diesem Kampf und dein Einsatz sind weg — genau wie bei einer Niederlage.',
        ok: 'Weiterkämpfen', cancel: 'Verlassen',
      }).then(stay => { if (stay) { if (_ctx?.mg?.resume) _ctx.mg.resume(); } else leave(); });
    } else leave();
  };
  _renderPotions();
}

function _setBars() {
  const { run } = _ctx;
  const f = run.fight;
  if (f) {
    const e = _el('cf-ehp'), eb = _el('cf-ehpbar');
    if (e) e.textContent = f.enemyHp;
    if (eb) eb.style.width = (f.enemyHp / f.enemyHpMax * 100) + '%';
  }
  const p = _el('cf-php'), pb = _el('cf-phpbar');
  if (p) p.textContent = run.hp;
  if (pb) pb.style.width = (run.hp / run.hpMax * 100) + '%';
}

// Gegner/Spieler blinken hart auf, wenn sie Schaden nehmen (kein Glow, nur Helligkeit).
function _hitFlash(id) {
  const el = _el(id);
  if (!el) return;
  el.classList.add('hit');
  setTimeout(() => el.classList.remove('hit'), 200);
}
// Kurze Kampf-Animation (attack = Ausfallschritt, shake = Wackeln) — Klasse
// neu triggern über Reflow, damit sie auch direkt hintereinander feuert.
function _anim(id, cls) {
  const el = _el(id);
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 500);
}

// Schadenszahl, die über dem Getroffenen aufsteigt und verblasst.
function _damagePop(overId, text, color) {
  const arena = document.querySelector('.cf-arena');
  const over = _el(overId);
  if (!arena || !over) return;
  const a = arena.getBoundingClientRect(), o = over.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'cf-dmg';
  s.textContent = text;
  s.style.color = color;
  s.style.left = (o.left - a.left + o.width / 2) + 'px';
  s.style.top = (o.top - a.top - 6) + 'px';
  arena.appendChild(s);
  setTimeout(() => s.remove(), 800);
}

// Schlag-Sequenz: Angreifer macht den Ausfallschritt, kurz darauf blinkt/wackelt
// das Ziel und die Schadenszahl steigt auf.
function _strike(attackerId, targetId, dmgText, color) {
  _anim(attackerId, 'attack');
  setTimeout(() => {
    _hitFlash(targetId);
    _anim(targetId, 'shake');
    _damagePop(targetId, dmgText, color);
  }, 160);
}

// Fehlklick im Buchstabensturm kostet jetzt auch direkt HP (zusätzlich zur
// Zeitstrafe aus minigame-letterstorm.js) — kann mitten in der Welle zum Tod führen;
// dann bricht der Kampf sofort ab statt erst am Wellenende.
function _onStormMiss() {
  if (!_ctx) return;
  const { run, save } = _ctx;
  run.hp = Math.max(0, run.hp - STORM_MISS_DMG);
  _setBars();
  _hitFlash('cf-hero');
  _damagePop('cf-hero', '−' + STORM_MISS_DMG, '#ff8787');
  save();
  if (run.hp <= 0) {
    if (_ctx.mg) _ctx.mg.destroy();
    _endScreen(false);
  }
}


// Deck-Wort EMA-gewichtet ziehen, direkte Wiederholung vermeiden.
function _pickItem(pool) {
  let item = weightedPickUnique(pool, _statOf, 1)[0];
  if (pool.length > 1 && _ctx.lastEn === item.en) {
    item = weightedPickUnique(pool.filter(v => v.en !== item.en), _statOf, 1)[0] || item;
  }
  _ctx.lastEn = item.en;
  return item;
}

function _startWave() {
  const { run, node } = _ctx;
  if (!run.fight) { _close(null); return; }
  const pool = _pool();
  const verbs = _verbPool();

  // Wellen-Typ wählen: 🌀 nur Verbformen; ⚔️ mischt Sturm/Meteoriten/Echo;
  // 👑 mischt alles. Fallbacks: zu wenig Wörter → kein Meteoriten/Echo; kein
  // TTS → kein Echo; 🌀 ohne befüllte Verben (alte Karte) → normale Wellen.
  let type;
  if (node.type === 'irregular' && verbs.length) {
    type = 'verbstorm';
  } else {
    if (!pool.length) { _close(null); return; }
    const types = ['storm'];
    if (pool.length >= METEOR_COUNT) types.push('meteors');
    if (window.speechSynthesis && pool.length >= 3) types.push('echo');
    if (node.type === 'boss' && verbs.length) types.push('verbstorm');
    type = types[Math.floor(Math.random() * types.length)];
  }

  const w = _el('cf-wave');
  if (w) w.textContent = 'Welle ' + run.fight.wave;
  const host = _el('cf-stage');
  _ctx.waveForm = null;

  // Ausrüstungs-Effekte: 🧤/🪄 Zeitbonus auf jedes Minispiel (Meteoriten fallen
  // langsamer), ⏳ Zeittrank für begrenzte Wellen, 🐾 Gefährte fängt Fehlgriffe
  // pro KAMPF im Buchstabensturm.
  const eff = _ctx.eff;
  const f = run.fight;
  let tBonus = eff.timeBonusMs || 0;
  if (f.timeBoost > 0) { tBonus += POTION_TIME_MS; f.timeBoost--; }
  const guards = Math.max(0, (eff.companionGuards || 0) - (f.guardsUsed || 0));
  const onGuardUsed = () => { f.guardsUsed = (f.guardsUsed || 0) + 1; _ctx.save(); };

  if (type === 'verbstorm') {
    // Verbform zusammensetzen: „go → Simple Past?" → w-e-n-t. Formen-Welle →
    // passende Waffe (Stahl=past / Gold=pp) bekommt FORM_BONUS.
    const v = verbs[Math.floor(Math.random() * verbs.length)];
    const which = Math.random() < 0.5 ? 'past' : 'pp';
    _ctx.waveForm = which;
    const target = which === 'past' ? v.past : v.pp;
    const label = which === 'past' ? 'Simple Past' : 'Past Participle';
    _ctx.mg = startLetterstorm({
      host, de: v.de, en: target,
      prompt: `🌀 ${v.en} → <span style="color:#a67c00;">${label}</span>?`,
      sub: `(${v.de})`,
      timeLimitMs: _lettersMs(target) + tBonus,
      guards, onGuardUsed, onMiss: _onStormMiss,
      onResult: _onWave,
    });
  } else if (type === 'meteors') {
    const item = _pickItem(pool);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, METEOR_COUNT - 1)]);
    _ctx.mg = startMeteors({ host, de: item.de, answer, choices, fallMs: METEOR_FALL_MS + tBonus, onResult: _onWave });
  } else if (type === 'echo') {
    const item = _pickItem(pool);
    const answer = _displayEn(item.en);
    const choices = _shuffle([answer, ..._distractors(pool, answer, ECHO_CHOICES - 1)]);
    _ctx.mg = startEcho({ host, answer, speakText: answer, choices, timeLimitMs: ECHO_TIME_MS + tBonus, onResult: _onWave });
  } else {
    const item = _pickItem(pool);
    _ctx.mg = startLetterstorm({ host, de: item.de, en: item.en, timeLimitMs: _timeLimit(item) + tBonus, guards, onGuardUsed, onMiss: _onStormMiss, onResult: _onWave });
  }
}

function _onWave(success) {
  if (!_ctx) return;
  const { run, node, enemy, weapon, eff, save } = _ctx;
  const f = run.fight;
  if (!f) return;
  if (success) {
    // Schaden: Waffe + Formen-Bonus (Stahl=past / Gold=pp) + Typ-Vorteil
    // (Speer vs Boss, Axt vs Elite, Hammer verdoppelt Welle 1) + 💪 Krafttrank;
    // 🧿 Talisman: ×1.5 an 🌀-Knoten.
    const bonus = _ctx.waveForm && weapon.which === _ctx.waveForm ? FORM_BONUS : 0;
    let dmg = weapon.dmg + bonus + (f.power || 0);
    if (weapon.type === 'speer' && node.type === 'boss') dmg += PERK_SPEER_BOSS;
    if (weapon.type === 'axt' && node.type === 'irregular') dmg += PERK_AXT_ELITE;
    if (weapon.type === 'bogen' && node.type === 'fight') dmg += PERK_BOGEN_FIGHT;
    const hammer = weapon.type === 'hammer' && f.wave === 1;
    if (hammer) dmg *= PERK_HAMMER_MULT;
    const tali = node.type === 'irregular' && eff.talisman;
    if (tali) dmg = Math.round(dmg * TALISMAN_MULT);
    f.enemyHp = Math.max(0, f.enemyHp - dmg);
    _setBars();
    // Alle Zusatz-Effekte (Formen-Bonus/Hammer/Talisman) direkt in die Schadenszahl,
    // die über dem Gegner aufsteigt — keine separate Text-Anzeige mehr nötig.
    _strike('cf-hero', 'cf-enemy', '−' + dmg + (bonus ? ' ✨' : '') + (hammer ? ' 🔨' : '') + (tali ? ' 🧿' : ''), '#c084fc');
    try { playSfx('correct'); } catch (e) {}
    if (f.enemyHp <= 0) { run.fight = null; save(); _endScreen(true); return; }
  } else if (f.shield) {
    // 🛡️ Schildtrank: wehrt genau eine verlorene Welle ab. Popup über dem eigenen
    // Character statt Text-Feedback — analog zu Schaden über dem Gegner.
    f.shield = false;
    _damagePop('cf-hero', '🛡️ Block!', '#69db7c');
    try { playSfx('click'); } catch (e) {}
  } else if (eff.dodge && Math.random() < eff.dodge) {
    // 🥾 Stiefel / 🗡️ Dolch: der verlorenen Welle ausgewichen — kein HP-Verlust.
    _damagePop('cf-hero', '🍃 Ausgewichen!', '#69db7c');
    try { playSfx('click'); } catch (e) {}
  } else if ((f.headUsed || 0) < (eff.headGuards || 0)) {
    // 🪖 Helm: wehrt verlorene Wellen ab (Anzahl je Stufe).
    f.headUsed = (f.headUsed || 0) + 1;
    _damagePop('cf-hero', '🪖 Block!', '#69db7c');
    try { playSfx('click'); } catch (e) {}
  } else {
    run.hp = Math.max(0, run.hp - enemy.dmg);
    _setBars();
    _strike('cf-enemy', 'cf-hero', '−' + enemy.dmg, '#ff8787');
    try { playSfx('wrong'); } catch (e) {}
    if (run.hp <= 0) { save(); _endScreen(false); return; }
  }
  f.wave++;
  save();
  setTimeout(() => { if (_ctx) _startWave(); }, 900);
}

// Konfetti-Regen beim Boss-Sieg — nutzt .confetti-wrap/.confetti-piece aus style.css
// (bisher ungenutzt vorbereitet), Farben/Größen/Timing kommen per Inline-Style dazu.
function _confettiBurst() {
  const wrap = document.createElement('div');
  wrap.className = 'confetti-wrap';
  const colors = ['#ffd43b', '#c084fc', '#69db7c', '#ff8787', '#4dabf7'];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + '%';
    p.style.width = p.style.height = (6 + Math.random() * 6) + 'px';
    p.style.background = colors[i % colors.length];
    p.style.borderRadius = Math.random() < 0.5 ? '50%' : '2px';
    p.style.animationDuration = (1.4 + Math.random() * 1.1) + 's';
    p.style.animationDelay = (Math.random() * 0.3) + 's';
    wrap.appendChild(p);
  }
  // An #cf-overlay hängen, nicht an <body>: der Kampf-Overlay liegt auf z-index:8000,
  // das gemeinsame .confetti-wrap nur auf 999 — an body würde es dahinter verschwinden.
  (_el('cf-overlay') || document.body).appendChild(wrap);
  setTimeout(() => wrap.remove(), 2600);
}

function _endScreen(victory) {
  const { node, round } = _ctx;
  const boss = node.type === 'boss';
  const bossWin = victory && boss;
  const stage = _el('cf-stage');
  if (victory) try { playSfx('end'); } catch (e) {}
  if (bossWin) {
    // Gegner-Sprite "zerplatzt" (siehe .cf-enemy.poof in style.css), dazu Konfetti.
    const enemyEl = _el('cf-enemy');
    if (enemyEl) enemyEl.classList.add('poof');
    _confettiBurst();
  }
  if (stage) stage.innerHTML = `<div style="display:flex;justify-content:center;padding:20px 16px;">
    <div style="background:#fff;border-radius:20px;padding:28px 24px;box-shadow:0 4px 14px rgba(0,0,0,.22);max-width:300px;text-align:center;">
      <div style="font-size:4rem;margin-bottom:12px;">${victory ? (boss ? '👑' : '🎉') : '💀'}</div>
      <div style="font-family:'Fredoka One',cursive;font-size:1.3rem;color:#333;margin-bottom:10px;">${bossWin ? `🐉 Boss Nr. ${round + 1} besiegt!` : victory ? 'Gewonnen!' : 'Besiegt …'}</div>
      <div style="font-size:.9rem;font-weight:700;color:#777;margin-bottom:${bossWin ? 14 : 22}px;line-height:1.5;">${victory
        ? (boss ? 'Du hast dich bis ganz nach oben gekämpft — der Lauf ist geschafft!' : 'Der Weg ist frei — wähle den nächsten Knoten.')
        : 'Deine HP sind auf 0 — der Lauf ist vorbei und der Einsatz (2 🪙) weg.'}</div>
      ${bossWin ? `<div class="bounce-in" style="font-family:'Fredoka One',cursive;font-size:1.15rem;color:#a67c00;background:#fff3bf;border-radius:12px;padding:8px 14px;margin-bottom:22px;display:inline-block;">+${BOSS_WIN_TALER} 🪙</div>` : ''}
      <button id="cf-endbtn" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:14px 28px;border:none;border-radius:14px;cursor:pointer;background:linear-gradient(135deg,#a86cdb,#c084fc);color:#fff;box-shadow:0 4px 0 #7d4bb0;">Weiter</button>
    </div>
  </div>`;
  const flee = _el('cf-flee');
  if (flee) flee.style.display = 'none';
  const btn = _el('cf-endbtn');
  if (btn) btn.onclick = () => _close(victory ? 'victory' : 'death');
}

function _close(result) {
  if (_ctx?.mg) _ctx.mg.destroy();
  const onEnd = _ctx?.onEnd;
  _ctx = null;
  _removeOverlay();
  if (onEnd) onEnd(result);
}

function _removeOverlay() { const ov = _el('cf-overlay'); if (ov) ov.remove(); }
