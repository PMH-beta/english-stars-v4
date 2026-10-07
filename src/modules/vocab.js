// src/modules/vocab.js
import { switchDeck, activeDeck, syncMirrorFromActiveDeck, createDeck, presetProgressPct } from './decks.js';
import { showScreen, wordStatus } from './ui.js';
import { persist } from './storage.js';
import { markDirty } from './sync.js';
import { commitDirty } from './dialog.js';
import { supabase } from './supabase.js';
import { effectivePct, statKeyFor, wortScore, spellingStand, SP_TEILE } from './stats.js';
import { MAX_PRESET_CATEGORIES } from './config.js';
import { iconHTML } from './pixel-icons.js';
import { ensureTesseract } from './lazyload.js';

function _vmDeck() { return window._draftDeck || activeDeck(); }

// Sammlungsname + kompakter „Umbenennen"-Button direkt darunter (Custom-Decks, 3.3)
function _deckNameWithRename(name) {
  return '<div>Sammlung: ' + window.escHtml(name) + '</div>' +
    '<button class="vm-rename-btn" onclick="vmRenameActiveDeck()">' + iconHTML('pencil', 14) + 'Umbenennen</button>';
}

// Titel im Kopf: „Vokabeln verwalten" mit Buch, die Statistik-Seiten ohne Symbol.
function _vmTitel(text, mitSymbol) {
  const title = document.getElementById('vm-title');
  if (title) title.textContent = text;
  const ic = document.getElementById('vm-title-icon');
  if (ic) ic.style.display = mitSymbol ? '' : 'none';
}

export function vmRenameActiveDeck() {
  const id = window.SD?.activeDeckId;
  if (!id || !window.SD.decks[id]) return;
  window.esPrompt({ icon: '✏️', title: 'Sammlung umbenennen', value: window.SD.decks[id].name, ok: 'Speichern' }).then(name => {
    if (!name || !name.trim()) return;
    window.renameDeck(id, name.trim());
    const dn = document.getElementById('vm-deck-name');
    if (dn) dn.innerHTML = _deckNameWithRename(name.trim());
    window.renderDecks();
  });
}

// window._reviewItems: muss global sein damit inline onchange-Handler ("_reviewItems[i].de=...") funktionieren
window._reviewItems = [];
let _lastOCRText = '';

export function openVocabManager(deckId) {
  if (deckId && !window._draftDeck) switchDeck(deckId);
  showScreen('scan-screen');
  const deck = _vmDeck();
  if (!deck) return;
  _vmTitel('Vokabeln verwalten', true);
  const dn = document.getElementById('vm-deck-name');
  if (dn) {
    if (window._draftDeck) dn.textContent = 'Sammlung: Neue Sammlung';
    else if (deck.deckPath === 'custom') dn.innerHTML = _deckNameWithRename(deck.name);
    else dn.textContent = 'Sammlung: ' + deck.name;
  }
  const backArea = document.getElementById('vm-back-area');
  if (backArea) {
    // In einer neuen, noch nicht bestätigten Sammlung wirkt Zurück wie
    // „Abbrechen" (F-44, Fragment 3.2) — mit derselben Rückfrage.
    backArea.innerHTML = '<button class="p-back" onclick="' + (window._draftDeck ? 'confirmAbortDraft()' : 'vmBack()')
      + '"><canvas data-icon="back" width="14" height="14" style="width:28px;height:28px;image-rendering:pixelated;flex:none"></canvas></button>';
  }
  if (window.SD?.activeMode === 'free' && (!deck.deckPath || deck.deckPath === 'none')) {
    if (!window._draftDeck) _showPathChoiceDialog();
  } else {
    _renderVmTabsForMode();
  }
}

function _renderVmTabsForMode() {
  const mode = window.SD?.activeMode || 'free';
  const tabsEl = document.querySelector('.vm-tabs');
  if (!tabsEl) return;
  if (mode === 'free') {
    const dp = _vmDeck()?.deckPath || 'none';
    if (dp === 'preset') {
      tabsEl.innerHTML = `
        <button class="vm-tab" data-tab="presets" onclick="vmTab('presets')">Vorlagen</button>
        <button class="vm-tab" data-tab="list" onclick="vmTab('list')">Liste<span id="vm-count" class="vm-count">0</span></button>
        <button class="vm-tab" data-tab="deck-stats" onclick="vmTab('deck-stats')">Statistik</button>
      `;
      vmTab('presets');
    } else if (dp === 'custom') {
      tabsEl.innerHTML = `
        <button class="vm-tab" data-tab="add" onclick="vmTab('add')">Hinzufügen</button>
        <button class="vm-tab" data-tab="paste" onclick="vmTab('paste')">Text</button>
        <button class="vm-tab" data-tab="scan" onclick="vmTab('scan')">Scan</button>
        <button class="vm-tab" data-tab="list" onclick="vmTab('list')">Liste<span id="vm-count" class="vm-count">0</span></button>
      `;
      vmTab('add');
    } else {
      tabsEl.innerHTML = '';
    }
  } else {
    // Schülermodus: nur Custom-Decks. Scan-Tab zwischen „Text" und „Liste".
    tabsEl.innerHTML = `
      <button class="vm-tab" data-tab="add" onclick="vmTab('add')">Hinzufügen</button>
      <button class="vm-tab" data-tab="paste" onclick="vmTab('paste')">Text</button>
      <button class="vm-tab" data-tab="scan" onclick="vmTab('scan')">Scan</button>
      <button class="vm-tab" data-tab="list" onclick="vmTab('list')">Liste<span id="vm-count" class="vm-count">0</span></button>
    `;
    vmTab('add');
  }
  _updateVmCount();
  // Umbenennen sitzt direkt unter dem Sammlungsnamen (siehe openVocabManager).
  const actionArea = document.getElementById('vm-action-area');
  if (actionArea) actionArea.innerHTML = '';
  // Draft-Buttons (Abbrechen/Bestätigen) liegen UNTEN, damit der Inhalt (Liste,
  // Hinzufügen, Vorlagen) immer erreichbar bleibt.
  const bottomArea = document.getElementById('vm-bottom-area');
  if (!bottomArea) return;
  if (!window._draftDeck) { bottomArea.innerHTML = ''; return; }
  bottomArea.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'vm-bottom-bar';
  // Knöpfe nach 3.2: „Abbrechen" hell mit Kreuz, „Bestätigen" in Tinte.
  const abortBtn = document.createElement('button');
  abortBtn.className = 'vm-abbrechen';
  abortBtn.innerHTML = iconHTML('close', 14) + 'Abbrechen';
  abortBtn.addEventListener('click', () => confirmAbortDraft());
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'vm-confirm';
  confirmBtn.id = 'vm-draft-confirm';
  confirmBtn.textContent = 'Bestätigen';
  confirmBtn.addEventListener('click', () => {
    const d = _vmDeck();
    if (!d || (d.vocab?.length || 0) < 1) {
      window.esAlert({ icon: 'ℹ️', title: 'Noch nichts drin',
        body: d?.deckPath === 'preset'
          ? 'Bitte wähle zuerst mindestens 1 Vorlage aus.'
          : 'Bitte füge zuerst mindestens 1 Wort hinzu.' });
      return;
    }
    vmBack();
  });
  row.appendChild(abortBtn);
  row.appendChild(confirmBtn);
  bottomArea.appendChild(row);
  _syncDraftConfirm();
}

// Bestätigen-Button im Draft ausgrauen, solange noch kein Wort/Vorlage drin ist.
// Bleibt klickbar (kein disabled-Attribut) → der Klick zeigt dann den Hinweis.
function _syncDraftConfirm() {
  const btn = document.getElementById('vm-draft-confirm');
  if (!btn) return;
  const d = _vmDeck();
  const ready = !!d && (d.vocab?.length || 0) >= 1;
  btn.classList.toggle('is-disabled', !ready);
}

// „Abbrechen" / Android-Zurück im Draft: erst nachfragen, dann verwerfen.
export function confirmAbortDraft() {
  if (!window._draftDeck) return;
  window.esConfirm({
    icon: '🤔', title: 'Wirklich abbrechen?',
    body: 'Die neue Sammlung wird verworfen und nicht gespeichert.',
    ok: 'Ja, abbrechen', cancel: 'Weiter bearbeiten', danger: true,
  }).then(ok => { if (ok) _abortDraft(); });
}

// Dialog „Wie soll diese Sammlung aufgebaut werden?" (Fragment 2.8). Zwei Aufrufer
// mit eigenen Knopf-IDs: der Pfad-Dialog im Verwalten und der beim Neuanlegen.
function _pfadDialog(praefix) {
  const overlay = document.createElement('div');
  overlay.className = 'p-dlg-grund p-pfad-grund';
  overlay.innerHTML = `
    <div class="p-dlg-karte p-pfad-karte">
      <div class="p-pfad-symbol">${iconHTML('book', 42)}</div>
      <div class="p-pfad-titel">Wie soll diese Sammlung aufgebaut werden?</div>
      <div class="p-pfad-sub">Einmalige Wahl — kann später nicht mehr geändert werden</div>
      <button id="${praefix}-preset" class="p-leerwahl-karte">
        <span class="p-leerwahl-kachel p-ton-pfirsich">${iconHTML('box', 28)}</span>
        <span class="p-wachs">
          <span class="p-leerwahl-name">Vorlage nutzen</span>
          <span class="p-leerwahl-sub">Fertige Wortgruppen auswählen und sofort starten</span>
        </span>
      </button>
      <button id="${praefix}-custom" class="p-leerwahl-karte">
        <span class="p-leerwahl-kachel p-ton-blau">${iconHTML('pencil', 28)}</span>
        <span class="p-wachs">
          <span class="p-leerwahl-name">Selbst zusammenstellen</span>
          <span class="p-leerwahl-sub">Wörter manuell eingeben oder per Text einfügen</span>
        </span>
      </button>
      <button id="${praefix}-cancel" class="p-pfad-abbrechen">Abbrechen</button>
    </div>
  `;
  return overlay;
}

function _showPathChoiceDialog() {
  const overlay = _pfadDialog('_path');
  document.body.appendChild(overlay);

  function _setPath(path) {
    overlay.remove();
    const deck = activeDeck();
    if (!deck) return;
    deck.deckPath = path;
    persist();
    if (window.currentUser) { markDirty('deck', deck.id); commitDirty(); }
    _renderVmTabsForMode();
  }
  overlay.querySelector('#_path-preset').addEventListener('click', () => _setPath('preset'));
  overlay.querySelector('#_path-custom').addEventListener('click', () => _setPath('custom'));
  overlay.querySelector('#_path-cancel').addEventListener('click', () => { overlay.remove(); showMenu(); });
}

export function vmTab(tabName) {
  document.querySelectorAll('.vm-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  ['list','add','scan','paste','presets','deck-stats'].forEach(name => {
    const el = document.getElementById('vm-pane-' + name);
    if (el) el.style.display = (name === tabName) ? 'block' : 'none';
  });
  if (tabName === 'list') renderVocabList();
  if (tabName === 'presets') renderPresetsTab();
  if (tabName === 'deck-stats') _renderDeckStatsPane();
  _updateVmCount();
}

// Die drei Wort-Tabellen (Vokabeln/Rechtschreibung/Aussprache) als HTML.
// Geteilt von Custom-Deck-Statistik (_renderDeckStatsPane) und Vorlagen-Deck-
// Statistik (openPresetDeckStats).
// Aussehen nach 3.7: Kicker mit Symbol, darunter eine Karte mit Kopfzeile und
// einer Zeile je Wort; „Stand" als farbiger Chip, „R / F" = richtig / falsch.
const _STAND_TON = { 'ws-green': 'var(--p-ok)', 'ws-yellow': 'var(--p-gold)', 'ws-red': 'var(--p-falsch)', 'ws-gray': 'var(--p-inaktiv)' };
function _wordTablesHtml(deck) {
  const vocab = deck.vocab || [];
  const presetWs = window.SD?.globalPresetStats?.wordStats || {};
  // Rechtschreibung (F-71): Stand = geschaffte Aufgaben „n/3", R / F über alle drei.
  function spStat(ws, v) {
    const sum = { asked: 0, correct: 0, wrong: 0 };
    for (const suf of SP_TEILE) {
      const s = ws[statKeyFor(v.de, v.en, suf, v._presetId || null)];
      if (s) { sum.asked += s.asked || 0; sum.correct += s.correct || 0; sum.wrong += s.wrong || 0; }
    }
    const stand = spellingStand(ws, v, v._presetId || null);
    const cls = stand.fertig ? 'ws-green' : stand.geschafft ? 'ws-yellow' : sum.asked ? 'ws-red' : 'ws-gray';
    return { s: sum.asked || stand.fertig ? sum : null, st: { cls, label: stand.geschafft + '/3' } };
  }
  function makeTable(suf, icon, title) {
    const rows = vocab.map(v => {
      const ws = v._presetId ? presetWs : deck.wordStats;
      const sp = suf === '_sp' ? spStat(ws, v) : null;
      const s = sp ? sp.s : ws[statKeyFor(v.de, v.en, suf, v._presetId || null)];
      const st = sp ? sp.st : wordStatus(s, 3);
      const gefragt = !!(s && (s.asked || sp));
      // Im Entwurf ist nur der grüne Chip ein inline-flex (Zeile 3 px höher).
      const stand = !gefragt
        ? '<span class="vm-st-leer">–</span>'
        : `<span class="vm-st-chip${st.cls === 'ws-green' ? ' vm-st-chip--ok' : ''}" style="background:${_STAND_TON[st.cls]}">${st.label}</span>`;
      const rf = gefragt
        ? `<span class="vm-st-rf">${Math.floor(s.correct || 0)} / ${Math.floor(s.wrong || 0)}</span>`
        : '<span class="vm-st-rf is-leer">– / –</span>';
      return `<div class="vm-st-zeile"><span class="vm-st-de">${window.escHtml(v.de)}</span><span class="vm-st-en">${window.escHtml(v.en)}</span><span>${stand}</span>${rf}</div>`;
    }).join('');
    return `<div class="vm-st-kicker">${iconHTML(icon, 14)}<div>${title}</div></div>
<div class="vm-st-karte"><div class="vm-st-kopf"><span>Deutsch</span><span>Englisch</span><span>Stand</span><span>R / F</span></div>${rows}</div>`;
  }
  return makeTable('_mc', 'book', 'Vokabeln') + makeTable('_sp', 'pencil', 'Rechtschreibung') + makeTable('_pr', 'mic', 'Aussprache');
}

function _renderDeckStatsPane() {
  const pane = document.getElementById('vm-pane-deck-stats');
  if (!pane) return;
  const deck = _vmDeck();
  if (!deck) { pane.innerHTML = '<div class="vm-empty">Keine Sammlung ausgewählt.</div>'; return; }
  if (!(deck.vocab || []).length) { pane.innerHTML = '<div class="vm-empty">Noch keine Wörter.</div>'; return; }
  pane.innerHTML = _wordTablesHtml(deck);
}

// BEREICH 1 — Vorlagen-Deck-Statistik: tablos, eine durchgehende Ansicht.
// Oben aktive Vorlagen-Kacheln (Balken+%), darunter die drei Wort-Tabellen.
export async function openPresetDeckStats(deckId) {
  if (deckId) switchDeck(deckId);
  showScreen('scan-screen');
  const deck = activeDeck();
  if (!deck) return;
  _vmTitel('Statistik', false);
  const dn = document.getElementById('vm-deck-name');
  if (dn) dn.textContent = 'Statistik: ' + deck.name;
  const ba = document.getElementById('vm-back-area');
  if (ba) ba.innerHTML = '<button class="p-back" onclick="vmBack()"><canvas data-icon="back" width="14" height="14" style="width:28px;height:28px;image-rendering:pixelated;flex:none"></canvas></button>';
  const tabsEl = document.querySelector('.vm-tabs');
  if (tabsEl) tabsEl.innerHTML = '';
  const aa = document.getElementById('vm-action-area');
  if (aa) aa.innerHTML = '';
  const ba2 = document.getElementById('vm-bottom-area');
  if (ba2) ba2.innerHTML = '';
  ['list','add','scan','paste','presets'].forEach(name => {
    const el = document.getElementById('vm-pane-' + name);
    if (el) el.style.display = 'none';
  });
  const pane = document.getElementById('vm-pane-deck-stats');
  if (!pane) return;
  pane.style.display = 'block';
  pane.innerHTML = '<div class="vm-empty">Lade Statistik…</div>';

  const categories = await _loadPresetCategories();
  const catById = Object.fromEntries(categories.map(c => [c.id, c]));
  const activeIds = deck.presetCategories || [];

  // Je aktive Vorlage eine Übersichtskarte wie in 5.5: Name, Wörter, Prozent, Balken.
  let tilesHtml = '';
  if (activeIds.length) {
    tilesHtml = '<div class="vm-gesamt-liste">' + activeIds.map(pid => {
      const cat = catById[pid];
      const name = cat ? cat.name : 'Vorlage';
      const wordCount = deck.vocab.filter(v => v._presetId === pid).length;
      const pct = presetProgressPct(deck, pid);
      return `<div class="vm-gesamt">
        <div class="vm-gesamt-kopf">
          <div class="p-wachs"><div class="vm-gesamt-name">${window.escHtml(name)}</div><div class="vm-gesamt-sub">${wordCount} Wörter</div></div>
          <div class="vm-gesamt-pct">${pct}%</div>
        </div>
        <div class="p-balken vm-gesamt-balken"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('') + '</div>';
  }

  const tablesHtml = (deck.vocab || []).length
    ? _wordTablesHtml(deck)
    : '<div class="vm-empty">Noch keine Wörter.</div>';

  pane.innerHTML = tilesHtml + tablesHtml;
}

function _updateVmCount() {
  _syncDraftConfirm();
  const cntEl = document.getElementById('vm-count');
  if (!cntEl) return;
  const deck = _vmDeck();
  if (!deck) return;
  const isPresetPath = deck.deckPath === 'preset' && (window.SD?.activeMode || 'free') === 'free';
  cntEl.textContent = isPresetPath
    ? deck.vocab.length
    : deck.vocab.filter(v => !v._presetId).length;
}

// Lernstand eines einzelnen Wortes in Prozent — Mittel ueber die drei
// Uebungsarten, dieselbe Rechnung wie in deckProgress.
function _wortStand(deck, v) {
  const presetWs = window.SD?.globalPresetStats?.wordStats || {};
  const ws = v._presetId ? presetWs : deck.wordStats;
  let summe = 0;
  for (const suffix of ['_mc', '_sp', '_pr']) {
    if (suffix === '_sp') { summe += wortScore(ws, v, '_sp', v._presetId || null).score; continue; }
    const st = ws[statKeyFor(v.de, v.en, suffix, v._presetId || null)];
    if (st && st.asked) summe += effectivePct(st);
  }
  return Math.round(summe / 3 * 100);
}

export function renderVocabList() {
  const listEl = document.getElementById('vm-list');
  if (!listEl) return;
  const search = (document.getElementById('vm-search')?.value || '').toLowerCase().trim();
  const deck = _vmDeck();
  const isPresetPath = deck.deckPath === 'preset' && (window.SD?.activeMode || 'free') === 'free';
  const vocabToShow = isPresetPath ? deck.vocab : deck.vocab.filter(v => !v._presetId);
  const items = vocabToShow.filter(v => {
    if (!search) return true;
    return v.de.toLowerCase().includes(search) || v.en.toLowerCase().includes(search);
  });
  _updateVmCount();
  if (items.length === 0) {
    const emptyMsg = search
      ? 'Keine Treffer für "' + window.escHtml(search) + '"'
      : isPresetPath ? 'Noch keine Vorlage aktiv. Wähle eine im Vorlagen-Tab.' : 'Noch keine Vokabeln. Füge welche hinzu.';
    listEl.innerHTML = '<div class="vm-empty">' + emptyMsg + '</div>';
    return;
  }
  listEl.innerHTML = items.map(v => {
    const pct = _wortStand(deck, v);
    // Balkenfarbe nach Lernstand wie in 3.1: sicher mint, auf dem Weg gold, wenig rosa.
    const farbe = pct >= 80 ? 'var(--p-ok)' : pct >= 30 ? 'var(--p-gold)' : 'var(--p-falsch)';
    const stand = `<div class="vm-row-stand">
        <div class="p-balken" style="width:60px"><i style="width:${pct}%;background:${farbe}"></i></div>
        <span class="vm-row-pct">${pct}%</span>
      </div>`;
    const woerter = `<div class="vm-row-wort">
        <div class="vm-row-en">${window.escHtml(v.en)}</div>
        <div class="vm-row-de">${window.escHtml(v.de)}</div>
      </div>`;
    if (isPresetPath) return `<div class="vm-row">${woerter}${stand}</div>`;
    const realIdx = deck.vocab.indexOf(v);
    return `<div class="vm-row">${woerter}${stand}
      <button class="vm-row-edit" onclick="vmEditWord(${realIdx})" title="Bearbeiten">${iconHTML('pencil', 14)}</button>
      <button class="vm-row-del" onclick="vmDeleteWord(${realIdx})" title="Löschen">${iconHTML('trash', 14)}</button>
    </div>`;
  }).join('');
}

export function parsePastedText() {
  const ta = document.getElementById('paste-text');
  const text = (ta && ta.value || '').trim();
  if (!text) { window.esAlert({ icon: '⚠️', title: 'Kein Text', body: 'Bitte erst Text einfügen.' }); return; }
  window._reviewItems = []; _lastOCRText = text;
  const items = parseVocabFromOCR(text);
  const existing = new Set(window.VOCAB.map(v => v.en.toLowerCase()));
  window._reviewItems = items.filter(i => i.de && i.en).map((i, idx) => ({
    id: idx, de: i.de.trim(), en: i.en.trim(),
    isDuplicate: existing.has(i.en.toLowerCase())
  }));
  if (window._reviewItems.length === 0) {
    window.esAlert({ icon: '🤔', title: 'Nichts erkannt', body: 'Keine Vokabeln im Text erkannt. Format: pro Zeile ein Vokabelpaar, getrennt durch 2+ Leerzeichen oder Tab.\n\nBeispiel:\ncafeteria   Cafeteria\nplace   Platz' });
    return;
  }
  showReview();
}

export function onScanFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const preview = document.getElementById('scan-preview');
  const reader = new FileReader();
  reader.onload = e => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    startScan(e.target.result, file);
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// Zustandszeile unter der Scan-Fläche (3.4): gelbe Pille mit drei Punkten,
// solange es läuft; rosa Pille mit Kreuz bei einem Fehler.
const _SCAN_PUNKTE = { a: [1, .55, .25], b: [.25, 1, .55] };
function _scanLaeuft(text, muster, wartet) {
  const punkte = _SCAN_PUNKTE[muster].map(o => `<span style="opacity:${o}"></span>`).join('');
  const dots = wartet ? '<span class="scan-dots" data-ui="dots">…</span>' : '';
  return `<div class="scan-zustand"><span class="scan-punkte">${punkte}</span><span>${text}${dots}</span></div>`;
}
function _scanFehler(text) {
  return `<div class="scan-zustand scan-zustand--fehler"><span class="scan-kreuz">${iconHTML('close', 14)}</span><span>${text}</span></div>`;
}

async function startScan(dataUrl, file) {
  const status = document.getElementById('scan-status');
  window._reviewItems = [];
  _lastOCRText = '';

  status.innerHTML = _scanLaeuft('Bild wird vorbereitet', 'a', true);

  let imgInput = file;
  try {
    const blob = await _preprocessImage(dataUrl);
    if (blob) imgInput = blob;
  } catch(e) {}

  status.innerHTML = _scanLaeuft('Text wird erkannt', 'b', true);

  let rawText = '';
  try {
    // OCR-Library erst hier laden (vorher blockierte sie jeden App-Start)
    await ensureTesseract();
    const result = await Tesseract.recognize(imgInput, 'eng+deu', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          status.innerHTML = _scanLaeuft(`Texterkennung: ${pct} %`, 'b', false);
        }
      }
    });
    rawText = result.data.text;
  } catch(e) {
    console.warn('[scan] Texterkennung fehlgeschlagen:', e?.message);
    status.innerHTML = _scanFehler('Texterkennung fehlgeschlagen');
    return;
  }

  if (!rawText || rawText.trim().length < 5) {
    status.innerHTML = _scanFehler('Kein Text erkannt. Bitte ein klareres Foto versuchen.');
    return;
  }

  const items = parseVocabFromOCR(rawText);
  const existing = new Set(window.VOCAB.map(v => v.en.toLowerCase()));
  window._reviewItems = items.filter(i => i.de && i.en).map((i, idx) => ({
    id: idx, de: i.de.trim(), en: i.en.trim(),
    isDuplicate: existing.has(i.en.toLowerCase())
  }));
  _lastOCRText = rawText;
  if (items.length === 0) {
    status.innerHTML = _scanFehler('Keine Vokabeln automatisch erkannt.') + `
      <div class="scan-tipp">Tipps: Foto gerade halten, gute Beleuchtung, klare Schrift.</div>
      <details class="scan-roh">
        <summary>${iconHTML('lupe', 14)}Erkannter Rohtext anzeigen</summary>
        <pre>${(rawText || '').slice(0, 1500).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
      </details>
      <button onclick="_reviewItems=[];showReview()" class="scan-manuell">${iconHTML('pencil', 14)}Wörter manuell eingeben</button>`;
    return;
  }
  status.innerHTML = '';
  showReview();
}

function _preprocessImage(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const maxW = 2000, scale = Math.min(1, maxW / img.width);
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const data = ctx.getImageData(0, 0, c.width, c.height), d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
          let v;
          if (g < 100) v = Math.max(0, g * 0.55);
          else if (g > 175) v = Math.min(255, g * 1.18);
          else v = g;
          d[i] = d[i+1] = d[i+2] = v;
        }
        ctx.putImageData(data, 0, 0);
        c.toBlob(b => resolve(b || null), 'image/png');
      } catch(e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function parseVocabFromOCR(rawText) {
  const deChars = /[äöüÄÖÜßẞ]/;

  function clean(s) {
    return s
      .replace(/\s*[\[|({]\s*[^\]\|)}]{1,40}[\]|)}]\s*/g, ' ')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/^[•·\-\*~«»"""'„_—–]+\s*/, '')
      .replace(/[•·~«»"""'„_]+/g, ' ')
      .replace(/[;,/].*$/, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s*\d+\s*/, '')
      .replace(/[\.:]+$/, '')
      .replace(/^[—–\-]+\s*/, '')
      .trim();
  }
  function isEnglishLike(s) {
    if (!s || deChars.test(s)) return false;
    return /^[a-zA-Z][a-zA-Z'\s\-]*$/.test(s) && s.length >= 2 && s.length <= 30;
  }
  function looksGerman(s) {
    if (!s) return false;
    if (deChars.test(s)) return true;
    if (/^[A-ZÄÖÜ][a-zäöüß]/.test(s)) return true;
    if (/\b(der|die|das|ein|eine|nicht|sich|werden|haben|sein|machen|in der|am|im|auf|bei|zu|von|mit|für|sprechen|kaufen|reden|essen|mag|gefällt|gefallt|viel)\b/i.test(s)) return true;
    if (/\w(ung|heit|keit|schaft|tum|chen|lein)\b/i.test(s)) return true;
    return false;
  }

  const pairs = [];
  for (let line of rawText.split('\n')) {
    line = line.trim();
    if (!line || line.length < 3) continue;
    if (/^\d+$/.test(line)) continue;
    if (!/[a-zA-ZäöüÄÖÜß]/.test(line)) continue;
    line = line.replace(/\bp\.?\s*\d+\s*/gi, ' ').trim();

    let s = line.replace(/\s*[\[|({]\s*[^\]\|)}]{1,40}[\]|)}]\s*/g, '\t');
    s = s.replace(/[\[|]\s*['ːə:ɪæɑɔʊʃʒθðŋʌɛɒʔ`_a-z\.\s]{1,30}/g, '\t');
    s = s.replace(/\s{2,}/g, '\t');

    let parts = s.split('\t').map(p => p.trim()).filter(p => p);
    if (parts.length < 2 && line.length >= 5) {
      const m = line.match(/^([a-zA-Z][a-zA-Z'\s\-]+?)\s+(.+)$/);
      if (m) parts = [m[1].trim(), m[2].trim()];
      else continue;
    }
    if (parts.length < 2) continue;

    let enPart = clean(parts[0]);
    let dePart = clean(parts.slice(1).join(' '));

    if (!isEnglishLike(enPart) && isEnglishLike(dePart) && (deChars.test(enPart) || looksGerman(enPart))) {
      [enPart, dePart] = [dePart, enPart];
    }
    if (!enPart || !dePart) continue;
    if (enPart.length < 2 || dePart.length < 2) continue;
    if (enPart.split(/\s+/).length > 5 || dePart.split(/\s+/).length > 6) continue;
    if (/^\d+$/.test(enPart) || /^\d+$/.test(dePart)) continue;
    if (!isEnglishLike(enPart)) {
      const c2 = enPart.replace(/[^a-zA-Z'\s\-]/g, '').replace(/\s{2,}/g, ' ').trim();
      if (c2 && isEnglishLike(c2)) enPart = c2;
      else continue;
    }
    pairs.push({ en: enPart, de: dePart });
  }

  const seen = new Set();
  return pairs.filter(p => {
    const k = p.en.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

export function showReview() {
  showScreen('review-screen');
  renderReviewList();
}

export function renderReviewList() {
  const list = document.getElementById('review-list');
  const count = document.getElementById('review-count');
  if (window._reviewItems.length === 0) {
    list.innerHTML = '<div class="vm-empty">Keine Wörter – füge welche manuell hinzu!</div>';
    count.textContent = '';
    return;
  }
  // Zeilen als Karten wie in 3.6; die Felder bleiben direkt bearbeitbar (F-39).
  list.innerHTML = window._reviewItems.map((item, i) => `
    <div class="review-item${item.isDuplicate ? ' is-doppelt' : ''}" id="ritem-${i}">
      <input value="${window.escHtml(item.de)}" placeholder="Deutsch" onchange="_reviewItems[${i}].de=this.value">
      <span class="sep">→</span>
      <input value="${window.escHtml(item.en)}" placeholder="Englisch" onchange="_reviewItems[${i}].en=this.value">
      ${item.isDuplicate ? `<span class="review-doppelt" title="Bereits vorhanden">${iconHTML('check', 14)}</span>` : ''}
      <button class="review-del" onclick="removeReviewItem(${i})" title="Entfernen">${iconHTML('trash', 14)}</button>
    </div>
  `).join('');
  // Kopfzeile kurz wie 3.6 (F-42); bereits vorhandene Wörter bleiben grau.
  count.textContent = `${window._reviewItems.length} erkannt`;
}

export function removeReviewItem(i) {
  window._reviewItems.splice(i, 1);
  window._reviewItems = window._reviewItems.map((item, idx) => ({ ...item, id: idx }));
  renderReviewList();
}

// „+ Wort manuell ergänzen" (3.6, F-41): hängt eine leere Zeile an und setzt
// den Cursor ins erste Feld. Vorher gab es hier keine Felder — nach einem
// Fehlscan führte „Wörter manuell eingeben" auf eine leere Liste.
export function addReviewItem() {
  window._reviewItems.push({ id: window._reviewItems.length, de: '', en: '', isDuplicate: false });
  renderReviewList();
  const row = document.getElementById('review-list').lastElementChild;
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row?.querySelector('input')?.focus();
}

// „Neu scannen" (3.6, F-40): die noch nicht gespeicherte Liste verwerfen, zurück
// in den Scan-Reiter und gleich die Kamera öffnen (in derselben Geste).
export function rescanReview() {
  window._reviewItems = [];
  showScreen('scan-screen');
  vmTab('scan');
  document.getElementById('scan-file')?.click();
}

export function confirmAddVocab() {
  // Bereits vorhandene Wörter kommen nicht doppelt hinein — auch nicht aus
  // einer von Hand ergänzten Zeile (die wird erst beim Hinzufügen geprüft).
  const vorhanden = new Set(window.VOCAB.map(v => v.en.toLowerCase()));
  const toAdd = window._reviewItems.filter(i => i.de.trim() && i.en.trim() && !i.isDuplicate
    && !vorhanden.has(i.en.trim().toLowerCase()));
  if (toAdd.length === 0) {
    window.esAlert({ icon: 'ℹ️', title: 'Nichts hinzuzufügen', body: 'Keine neuen Wörter zum Hinzufügen (alle bereits vorhanden oder leer).' });
    return;
  }
  const deck = _vmDeck();
  toAdd.forEach(i => {
    const v = { de: i.de.trim(), en: i.en.trim() };
    // In draft mode window.VOCAB IS deck.vocab — skip double-push
    if (!window._draftDeck) window.VOCAB.push(v);
    deck.vocab.push(v);
  });
  if (!window._draftDeck) {
    persist();
    if (window.currentUser) { markDirty('deck', deck.id); commitDirty(); }
  }
  window.esAlert({ icon: '✅', title: 'Hinzugefügt', body: `${toAdd.length} neue Vokabel${toAdd.length === 1 ? '' : 'n'} zur Lernliste hinzugefügt!` }).then(() => {
    window._reviewItems = [];
    openVocabManager();
  });
}

// ════════════════════════════════════════════════
//  PRESET CATEGORIES
// ════════════════════════════════════════════════
let _presetCache = null;
let _presetLoading = false;

async function _loadPresetCategories() {
  if (_presetCache !== null) return _presetCache; // null = noch nie geladen; [] = geladen aber leer
  if (_presetLoading) {
    while (_presetLoading) await new Promise(r => setTimeout(r, 80));
    return _presetCache || [];
  }
  _presetLoading = true;
  try {
    console.log('[presets] Lade Kategorien aus Supabase...');
    const { data, error } = await supabase
      .from('preset_categories')
      .select('id, name, slug, sort_order, words, difficulty')
      .order('sort_order');
    console.log('[presets] data:', JSON.stringify(data), 'error:', error);
    if (error) throw error;
    _presetCache = data || [];
    console.log('[presets] gecacht:', _presetCache.length, 'Kategorien');
  } catch(e) {
    console.warn('[presets] Laden fehlgeschlagen:', e.message);
    _presetCache = null; // Bei Fehler nicht cachen → nächster Tab-Click versucht es erneut
  }
  _presetLoading = false;
  return _presetCache || [];
}

// Öffentlicher Zugriff auf die (gecachten) Vorlagen-Kategorien — für Aggregationen
// außerhalb dieses Moduls (z.B. Fortschritt-Seite, Vorlagen-Namen-Lookup).
export async function getPresetCategories() {
  return _loadPresetCategories();
}

// Globaler Fortschritt einer Vorlage — deck-unabhängig.
// Gibt null zurück wenn die Vorlage noch nie irgendwo gespielt wurde,
// sonst { mastered, total, pct }.
// Wörter kommen aus cat.words (Preset-Cache), nicht aus einem Deck.
function _presetProgress(cat, isActive = false) {
  const globalCp = window.SD?.globalPresetStats?.categoryProgress?.[cat.id];
  if (!isActive && !(globalCp?.played > 0)) return null;
  const deck = _vmDeck();
  const words = (deck?.vocab || []).filter(v => v._presetId === cat.id);
  if (words.length === 0) return isActive ? { pct: 0 } : null;
  const ws = window.SD?.globalPresetStats?.wordStats || {};
  let totalScore = 0;
  for (const suf of ['_mc', '_sp', '_pr']) {
    for (const v of words) totalScore += wortScore(ws, v, suf, v._presetId).score;
  }
  const pct = words.length > 0 ? Math.min(100, Math.round((totalScore / 3 / words.length) * 100)) : 0;
  return { pct };
}

// Fortschrittsbalken für Vorlagen, die in einem anderen Deck aktiv sind.
// Nutzt cat.words (DB-Quelle, identisch mit dem was in das andere Deck übernommen wurde).
function _claimedBarPct(cat) {
  const words = Array.isArray(cat.words) ? cat.words : [];
  if (!words.length) return 0;
  const ws = window.SD?.globalPresetStats?.wordStats || {};
  let totalScore = 0;
  for (const suf of ['_mc', '_sp', '_pr']) {
    for (const v of words) totalScore += wortScore(ws, v, suf, cat.id).score;
  }
  return words.length > 0 ? Math.min(100, Math.round((totalScore / 3 / words.length) * 100)) : 0;
}

function _showPresetIntroModal(onDone) {
  // Aussehen nach Fragment 2.9: Truhe 4×, große Überschrift, Knopf über die Breite.
  const overlay = document.createElement('div');
  overlay.className = 'p-dlg-grund p-lv-grund';
  overlay.innerHTML = `
    <div class="p-dlg-karte p-lv-karte">
      <div class="p-pfad-symbol">${iconHTML('box', 56)}</div>
      <div class="p-lv-titel">Lernvorlagen</div>
      <div class="p-lv-text">Für den Anfang empfehlen wir 1 Vorlage. Wer auffrischen will, kann ${MAX_PRESET_CATEGORIES} nehmen. Mehr als ${MAX_PRESET_CATEGORIES} gleichzeitig sind nicht möglich.</div>
      <button id="_preset-intro-ok" class="p-lv-ok">Verstanden</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#_preset-intro-ok').addEventListener('click', () => {
    overlay.remove();
    if (window.SD) window.SD.presetIntroSeen = true;
    if (typeof window.persist === 'function') window.persist(window.SD);
    onDone();
  });
}

export async function renderPresetsTab() {
  const pane = document.getElementById('vm-pane-presets');
  if (!pane) return;
  pane.innerHTML = '<div class="vm-empty">Lade Vorlagen…</div>';
  const categories = await _loadPresetCategories();
  const deck = _vmDeck();
  if (!deck) return;
  const activeSet = new Set(deck.presetCategories || []);
  const atLimit = activeSet.size >= MAX_PRESET_CATEGORIES;
  const locked = deck.presetsLocked || false;
  const claimed = _getClaimedPresets();

  if (categories.length === 0) {
    pane.innerHTML = '<div class="vm-empty">Noch keine Vorlagen verfügbar.</div>';
    return;
  }

  // Aussehen nach 3.2: Stufe als farbiger Chip, rechts AN/AUS, aktive Vorlage
  // hell mit Balken darunter.
  const _DIFF_TON = { leicht: 'var(--p-ok)', mittel: 'var(--p-pfirsich)', schwer: 'var(--p-falsch)' };
  const _diffBadge = d => _DIFF_TON[d]
    ? `<span class="vm-vl-stufe" style="background:${_DIFF_TON[d]}">${d}</span>` : '';

  let headerNote;
  if (locked) {
    headerNote = `<div class="vm-vl-text vm-vl-text--hinweis">${iconHTML('lock', 14)}Vorlagen-Auswahl gesperrt — fest verbunden mit dieser Sammlung</div>`;
  } else if (atLimit) {
    headerNote = `<div class="vm-vl-text vm-vl-text--hinweis">${iconHTML('check', 14)}${MAX_PRESET_CATEGORIES} Vorlagen aktiv — Limit erreicht</div>`;
  } else {
    headerNote = `<div class="vm-vl-text">Vorgefertigte Wortgruppen ein- oder ausschalten. Lernfortschritt bleibt beim Ausschalten erhalten.</div>`;
  }
  headerNote += `<div class="vm-vl-kopf"><div class="vm-vl-kicker">${categories.length} Wortgruppen</div>
    <span class="vm-vl-zahl">${activeSet.size} von ${MAX_PRESET_CATEGORIES} an</span></div>`;

  // Gesperrte Sammlung: aktive Vorlagen zuerst, inaktive dahinter
  const sortedCategories = locked
    ? [...categories.filter(c => activeSet.has(c.id)), ...categories.filter(c => !activeSet.has(c.id))]
    : categories;

  pane.innerHTML = headerNote + '<div class="vm-vl-liste">' + sortedCategories.map(cat => {
    const isOn = activeSet.has(cat.id);
    const isClaimed = !isOn && claimed.has(cat.id);
    const wordCount = Array.isArray(cat.words) ? cat.words.length : 0;

    // Karte klickbar: aktiv+nicht gesperrt (deaktivieren) ODER inaktiv+nicht claimed+nicht am Limit+nicht gesperrt (aktivieren)
    const isSelectableCard = !locked && !isOn && !isClaimed && !atLimit;
    const isClickableCard = isOn ? !locked : isSelectableCard;
    // Ausgrauung: inaktiv + (gesperrt ODER claimed ODER Limit erreicht)
    const greyOut = !isOn && (locked || isClaimed || atLimit);

    // Fortschritt: aktive Vorlage → deck.vocab-gefiltert; claimed → cat.words-Näherung
    const ownProg = _presetProgress(cat, isOn);
    const ownPct = ownProg?.pct ?? 0;
    const barPct = isOn ? ownPct : (isClaimed ? _claimedBarPct(cat) : 0);

    const kls = 'vm-vl-zeile' + (isOn ? ' is-an' : '') + (greyOut ? ' is-grau' : '') + (isClickableCard ? ' is-klickbar' : '');
    const rowClick = isClickableCard ? `onclick="togglePresetCategory('${cat.id}')"` : '';
    // AUS ist nur Anzeige — getippt wird die ganze Karte (wie bisher).
    const btnHtml = isOn
      ? `<button class="vm-vl-schalter is-an" ${locked ? 'disabled' : `onclick="event.stopPropagation();togglePresetCategory('${cat.id}')"`}>${iconHTML('check', 14)}AN</button>`
      : '<span class="vm-vl-schalter">AUS</span>';
    const balken = (isOn || barPct > 0)
      ? `<div class="p-balken p-balken--mittel vm-vl-balken"><i style="width:${barPct}%"></i></div>` : '';

    return `<div class="${kls}" ${rowClick}>
      <div class="vm-vl-reihe">
        <div class="vm-vl-wort">
          <div class="vm-vl-name">${window.escHtml(cat.name)}</div>
          <div class="vm-vl-anzahl">${wordCount} Wörter</div>
        </div>
        ${_diffBadge(cat.difficulty)}
        ${btnHtml}
      </div>
      ${balken}
    </div>`;
  }).join('') + '</div>';
}

export function togglePresetCategory(categoryId) {
  const deck = _vmDeck();
  if (deck?.presetsLocked) return; // Sicherheits-Guard — Button ist bereits disabled
  if (!window.SD?.presetIntroSeen && !window._draftDeck) {
    _showPresetIntroModal(() => _doTogglePresetCategory(categoryId));
    return;
  }
  _doTogglePresetCategory(categoryId);
}

export function vmBack() {
  if (window._draftDeck) { _handleDraftBack(); return; }
  const deck = activeDeck();
  const hasActivePresets = (deck?.presetCategories?.length || 0) > 0;
  // Keine aktiven Vorlagen, oder bereits gesperrt → direkt weg
  if (!hasActivePresets || deck.presetsLocked) { showMenu(); return; }
  // Erste Bestätigung: erklärt den dauerhaften Lock
  const overlay = document.createElement('div');
  overlay.className = 'p-dlg-grund';
  overlay.innerHTML = _dlgHtml({
    icon: 'lock', titel: 'Sammlung sperren?',
    text: 'Mit „Bestätigen" werden die aktiven Vorlagen fest mit dieser Sammlung verbunden. Danach können keine Vorlagen mehr gewechselt werden.',
    abId: '_vmback-cancel', ab: 'Abbrechen', okId: '_vmback-ok', ok: 'Bestätigen',
  });
  document.body.appendChild(overlay);
  overlay.querySelector('#_vmback-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#_vmback-ok').addEventListener('click', () => {
    overlay.remove();
    deck.presetsLocked = true;
    syncMirrorFromActiveDeck();
    persist();
    if (window.currentUser) { markDirty('deck', deck.id); commitDirty(); }
    showMenu();
  });
}

// ════════════════════════════════════════════════
//  NEUES DECK — DRAFT-FLOW
// ════════════════════════════════════════════════

export function newDeckFlow(mode = 'free') {
  if (mode === 'student') {
    // Schülermodus: keine Vorlagen → direkt Custom-Draft, kein Pfad-Dialog.
    window._draftDeck = { id: '_draft', name: 'Neue Sammlung', vocab: [], presetCategories: [], deckPath: 'custom', presetsLocked: false, mode: 'student' };
    window.VOCAB = window._draftDeck.vocab;
    openVocabManager();
    return;
  }
  _showNewDeckPathDialog();
}

// Direkter Einstieg in die zwei Sammlungs-Wege (genutzt vom Pfad-Dialog UND vom
// Auswahl-Leerzustand im Vokabeln-Tab).
export function newDeckPreset() {
  window._draftDeck = { id: '_draft', name: 'Neue Sammlung', vocab: [], presetCategories: [], deckPath: 'preset', presetsLocked: false, mode: 'free' };
  window.VOCAB = window._draftDeck.vocab;
  openVocabManager();
}
export function newDeckCustom() {
  window._draftDeck = { id: '_draft', name: 'Neue Sammlung', vocab: [], presetCategories: [], deckPath: 'custom', presetsLocked: false, mode: 'free' };
  window.VOCAB = window._draftDeck.vocab;
  openVocabManager();
}

function _showNewDeckPathDialog() {
  const overlay = _pfadDialog('_ndp');
  document.body.appendChild(overlay);
  overlay.querySelector('#_ndp-preset').addEventListener('click', () => { overlay.remove(); newDeckPreset(); });
  overlay.querySelector('#_ndp-custom').addEventListener('click', () => { overlay.remove(); newDeckCustom(); });
  overlay.querySelector('#_ndp-cancel').addEventListener('click', () => overlay.remove());
}

function _getClaimedPresets() {
  const claimed = new Map(); // presetId → deckName
  const currentDeckId = window._draftDeck ? null : window.SD?.activeDeckId;
  for (const deck of Object.values(window.SD?.decks || {})) {
    if (!deck.presetsLocked) continue;
    if (deck.id === currentDeckId) continue;
    for (const pid of (deck.presetCategories || [])) {
      claimed.set(pid, deck.name);
    }
  }
  return claimed;
}

function _handleDraftBack() {
  const draft = window._draftDeck;
  if (!draft) return;
  if (draft.deckPath === 'preset') {
    if (!draft.presetCategories.length) { _abortDraft(); return; }
    _showDraftLockDialog(draft);
  } else {
    if (!draft.vocab.length) { _abortDraft(); return; }
    _showCustomNameDialog(draft);
  }
}

function _abortDraft() {
  delete window._draftDeck;
  syncMirrorFromActiveDeck(); // restores window.VOCAB to active deck
  showMenu();
}

function _confirmDraftDeck(draft, name) {
  const id = createDeck(name, draft.mode || 'free');
  const deck = window.SD.decks[id];
  // Spread-copy: window.VOCAB points to draft.vocab's same array; syncMirrorFromActiveDeck
  // would call window.VOCAB.length=0 and wipe deck.vocab if they shared the reference.
  deck.vocab = [...draft.vocab];
  deck.presetCategories = [...draft.presetCategories];
  deck.deckPath = draft.deckPath;
  deck.presetsLocked = draft.presetsLocked;
  delete window._draftDeck;
  switchDeck(id); // calls syncMirrorFromActiveDeck + persist
  if (window.currentUser) { markDirty('deck', id); commitDirty(); }
  showMenu();
}

// Dialog-Gerüst wie esConfirm in dialog.js (Emblem, Titel, Vondu-Kasten,
// Knöpfe) für die drei Dialoge dieses Moduls mit eigenen Knopf-IDs.
function _dlgHtml({ icon, titel, text, feld = '', abId, ab, okId, ok }) {
  const vondu = text ? `<div class="p-dlg-vondu"><img src="vondu-logo.svg" alt="Vondu" width="48" height="46" data-ui="bob" data-a="1"><div class="p-dlg-text">${text}</div></div>` : '';
  return `<div class="p-dlg-karte">
    <div class="p-dlg-emblem p-ton-lila">${iconHTML(icon, 28)}</div>
    <div class="p-dlg-titel">${titel}</div>
    ${vondu}${feld}
    <div class="p-dlg-knoepfe"><button id="${abId}" class="p-dlg-btn p-dlg-btn--ab">${ab}</button><button id="${okId}" class="p-dlg-btn p-dlg-btn--ok">${ok}</button></div>
  </div>`;
}

function _showDraftLockDialog(draft) {
  const overlay = document.createElement('div');
  overlay.className = 'p-dlg-grund';
  overlay.innerHTML = _dlgHtml({
    icon: 'lock', titel: 'Sammlung abschließen?',
    text: 'Die gewählten Vorlagen werden fest mit dieser neuen Sammlung verbunden. Danach können keine Vorlagen mehr gewechselt werden.',
    abId: '_dld-cancel', ab: 'Weiter wählen', okId: '_dld-ok', ok: 'Bestätigen',
  });
  document.body.appendChild(overlay);
  overlay.querySelector('#_dld-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#_dld-ok').addEventListener('click', () => {
    overlay.remove();
    draft.presetsLocked = true;
    const cats = (_presetCache || []).filter(c => draft.presetCategories.includes(c.id));
    const name = cats.map(c => c.name).join(' + ') || 'Neue Sammlung';
    _confirmDraftDeck(draft, name);
  });
}

function _showCustomNameDialog(draft) {
  const overlay = document.createElement('div');
  overlay.className = 'p-dlg-grund';
  overlay.innerHTML = _dlgHtml({
    icon: 'pencil', titel: 'Name der Sammlung',
    feld: '<input id="_cnd-name" type="text" class="p-dlg-feld" placeholder="z.B. Schule Klasse 3" maxlength="50">',
    abId: '_cnd-cancel', ab: 'Weiter bearbeiten', okId: '_cnd-ok', ok: 'Fertig',
  });
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#_cnd-name');
  input.focus();
  overlay.querySelector('#_cnd-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#_cnd-ok').addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) { input.style.borderColor = 'var(--red)'; return; }
    overlay.remove();
    _confirmDraftDeck(draft, name);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#_cnd-ok').click(); });
}

function _doTogglePresetCategory(categoryId) {
  const deck = _vmDeck();
  if (!deck) return;
  if (!Array.isArray(deck.presetCategories)) deck.presetCategories = [];

  const cat = (_presetCache || []).find(c => c.id === categoryId);
  if (!cat) return;

  const isOn = deck.presetCategories.includes(categoryId);

  if (!isOn) {
    if (deck.presetCategories.length >= MAX_PRESET_CATEGORIES) return; // Sicherheits-Guard
    // Beanspruchte Vorlage nicht aktivieren
    if (_getClaimedPresets().has(categoryId)) return;
    // Ein: Wörter der Kategorie ins Deck aufnehmen (Duplikate überspringen)
    const existingEn = new Set(deck.vocab.map(v => v.en.toLowerCase()));
    for (const w of (cat.words || [])) {
      if (!existingEn.has(w.en.toLowerCase())) {
        deck.vocab.push({ de: w.de, en: w.en, _presetId: categoryId });
        existingEn.add(w.en.toLowerCase());
      }
    }
    deck.presetCategories.push(categoryId);
  } else {
    // Aus: nur Wörter mit _presetId dieser Kategorie entfernen; wordStats bleiben erhalten
    deck.vocab = deck.vocab.filter(v => v._presetId !== categoryId);
    deck.presetCategories = deck.presetCategories.filter(id => id !== categoryId);
  }

  syncMirrorFromActiveDeck(); // no-op in draft mode (guarded)
  if (!window._draftDeck) {
    persist();
    if (window.currentUser) { markDirty('deck', deck.id); commitDirty(); }
  }
  renderPresetsTab();
  _updateVmCount();
}
