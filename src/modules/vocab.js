// src/modules/vocab.js
import { switchDeck, activeDeck, syncMirrorFromActiveDeck, createDeck, deckProgress } from './decks.js';
import { showScreen } from './ui.js';
import { persist } from './storage.js';
import { markDirty, flushPendingSync } from './sync.js';
import { supabase } from './supabase.js';
import { presetWordsPct } from './stats.js';
import { MAX_PRESET_CATEGORIES } from './config.js';

function _vmDeck() { return window._draftDeck || activeDeck(); }

// window._reviewItems: muss global sein damit inline onchange-Handler ("_reviewItems[i].de=...") funktionieren
window._reviewItems = [];
let _lastOCRText = '';

export function openVocabManager(deckId) {
  if (deckId && !window._draftDeck) switchDeck(deckId);
  showScreen('scan-screen');
  const deck = _vmDeck();
  if (!deck) return;
  const dn = document.getElementById('vm-deck-name');
  if (dn) dn.textContent = window._draftDeck ? 'Neue Sammlung' : 'Sammlung: ' + deck.name;
  const ml = document.getElementById('vm-mastery-line');
  if (ml) {
    if (window._draftDeck || deck.vocab.length === 0) {
      ml.style.display = 'none';
    } else {
      const p = deckProgress(deck);
      ml.textContent = '⭐ ' + p.overallMastered + '/' + p.total + ' Wörter gemeistert';
      ml.style.display = '';
    }
  }
  const backArea = document.getElementById('vm-back-area');
  if (backArea) {
    backArea.innerHTML = window._draftDeck
      ? ''
      : '<button class="back-btn sticky" onclick="vmBack()" style="margin-bottom:14px;">← Zurück</button>';
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
        <button class="vm-tab" data-tab="presets" onclick="vmTab('presets')">📦 Vorlagen</button>
        <button class="vm-tab" data-tab="list" onclick="vmTab('list')">📋 Liste <span id="vm-count" class="vm-count">0</span></button>
      `;
      vmTab('presets');
    } else if (dp === 'custom') {
      tabsEl.innerHTML = `
        <button class="vm-tab" data-tab="add" onclick="vmTab('add')">➕ Hinzufügen</button>
        <button class="vm-tab" data-tab="paste" onclick="vmTab('paste')">📝 Text</button>
        <button class="vm-tab" data-tab="list" onclick="vmTab('list')">📋 Liste <span id="vm-count" class="vm-count">0</span></button>
      `;
      vmTab('add');
    } else {
      tabsEl.innerHTML = '';
    }
  } else {
    tabsEl.innerHTML = `
      <button class="vm-tab" data-tab="list" onclick="vmTab('list')">📋 Liste <span id="vm-count" class="vm-count">0</span></button>
      <button class="vm-tab" data-tab="add" onclick="vmTab('add')">➕ Hinzufügen</button>
      <button class="vm-tab" data-tab="scan" onclick="vmTab('scan')">📷 Scan</button>
    `;
    vmTab('list');
  }
  _updateVmCount();
  const actionArea = document.getElementById('vm-action-area');
  if (!actionArea) return;
  if (window._draftDeck) {
    actionArea.innerHTML = '';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;margin-bottom:12px;width:100%;';
    const abortBtn = document.createElement('button');
    abortBtn.className = 'back-btn';
    abortBtn.style.cssText = 'flex:1;';
    abortBtn.textContent = '✕ Abbrechen';
    abortBtn.addEventListener('click', () => { _abortDraft(); alert('Es wurde keine Sammlung angelegt.'); });
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'back-btn';
    confirmBtn.style.cssText = 'flex:1;background:linear-gradient(135deg,#3aaa5c,#4ecb71);color:#fff;border:none;box-shadow:0 3px 0 #2a8a4a;';
    confirmBtn.textContent = '✓ Bestätigen';
    confirmBtn.addEventListener('click', vmBack);
    row.appendChild(abortBtn);
    row.appendChild(confirmBtn);
    actionArea.appendChild(row);
  } else {
    actionArea.innerHTML = '';
  }
}

function _showPathChoiceDialog() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:26px 20px;max-width:360px;width:100%;box-shadow:0 8px 36px rgba(0,0,0,.2);">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:2rem;margin-bottom:8px;">📚</div>
        <div style="font-family:'Fredoka One',cursive;font-size:1.15rem;color:#2D2D2D;margin-bottom:5px;">Wie soll diese Sammlung aufgebaut werden?</div>
        <p style="font-size:.78rem;color:#bbb;margin:0;line-height:1.5;">Einmalige Wahl — kann später nicht mehr geändert werden</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
        <button id="_path-preset" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:none;border-radius:14px;cursor:pointer;background:linear-gradient(135deg,#a86cdb,#c084fc);color:#fff;text-align:left;font-family:'Nunito',sans-serif;width:100%;">
          <span style="font-size:1.5rem;flex-shrink:0;margin-top:1px;">📦</span>
          <div>
            <div style="font-family:'Fredoka One',cursive;font-size:.98rem;">Vorlage nutzen</div>
            <div style="font-size:.75rem;opacity:.88;margin-top:2px;line-height:1.4;">Fertige Wortgruppen auswählen und sofort starten</div>
          </div>
        </button>
        <button id="_path-custom" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:none;border-radius:14px;cursor:pointer;background:linear-gradient(135deg,#4D96FF,#7ab4ff);color:#fff;text-align:left;font-family:'Nunito',sans-serif;width:100%;">
          <span style="font-size:1.5rem;flex-shrink:0;margin-top:1px;">✏️</span>
          <div>
            <div style="font-family:'Fredoka One',cursive;font-size:.98rem;">Selbst zusammenstellen</div>
            <div style="font-size:.75rem;opacity:.88;margin-top:2px;line-height:1.4;">Wörter manuell eingeben oder per Text einfügen</div>
          </div>
        </button>
      </div>
      <button id="_path-cancel" style="display:block;width:100%;padding:10px;background:none;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:.85rem;color:#bbb;">Abbrechen</button>
    </div>
  `;
  document.body.appendChild(overlay);

  function _setPath(path) {
    overlay.remove();
    const deck = activeDeck();
    if (!deck) return;
    deck.deckPath = path;
    persist();
    if (window.currentUser) { markDirty('deck', deck.id); flushPendingSync().catch(() => {}); }
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
  ['list','add','scan','paste','presets'].forEach(name => {
    const el = document.getElementById('vm-pane-' + name);
    if (el) el.style.display = (name === tabName) ? 'block' : 'none';
  });
  if (tabName === 'list') renderVocabList();
  if (tabName === 'presets') renderPresetsTab();
  _updateVmCount();
}

function _updateVmCount() {
  const cntEl = document.getElementById('vm-count');
  if (!cntEl) return;
  const deck = _vmDeck();
  if (!deck) return;
  const isPresetPath = deck.deckPath === 'preset' && (window.SD?.activeMode || 'free') === 'free';
  cntEl.textContent = isPresetPath
    ? deck.vocab.length
    : deck.vocab.filter(v => !v._presetId).length;
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
      : isPresetPath ? 'Noch keine Vorlage aktiv. Wähle eine im 📦-Tab.' : 'Noch keine Vokabeln. Füge welche hinzu! 👇';
    listEl.innerHTML = '<div class="vm-empty">' + emptyMsg + '</div>';
    return;
  }
  listEl.innerHTML = items.map(v => {
    if (isPresetPath) {
      return `<div class="vm-row">
        <div class="vm-row-de">${window.escHtml(v.de)}</div>
        <div class="vm-row-arrow">→</div>
        <div class="vm-row-en">${window.escHtml(v.en)}</div>
      </div>`;
    }
    const realIdx = deck.vocab.indexOf(v);
    return `<div class="vm-row">
      <div class="vm-row-de">${window.escHtml(v.de)}</div>
      <div class="vm-row-arrow">→</div>
      <div class="vm-row-en">${window.escHtml(v.en)}</div>
      <button class="vm-row-del" onclick="vmDeleteWord(${realIdx})" title="Löschen">🗑️</button>
    </div>`;
  }).join('');
}

export function parsePastedText() {
  const ta = document.getElementById('paste-text');
  const text = (ta && ta.value || '').trim();
  if (!text) { alert('Bitte erst Text einfügen.'); return; }
  window._reviewItems = []; _lastOCRText = text;
  const items = parseVocabFromOCR(text);
  const existing = new Set(window.VOCAB.map(v => v.en.toLowerCase()));
  window._reviewItems = items.filter(i => i.de && i.en).map((i, idx) => ({
    id: idx, de: i.de.trim(), en: i.en.trim(),
    isDuplicate: existing.has(i.en.toLowerCase())
  }));
  if (window._reviewItems.length === 0) {
    alert('Keine Vokabeln im Text erkannt. Format: pro Zeile ein Vokabelpaar, getrennt durch 2+ Leerzeichen oder Tab.\n\nBeispiel:\ncafeteria   Cafeteria\nplace   Platz');
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

async function startScan(dataUrl, file) {
  const status = document.getElementById('scan-status');
  window._reviewItems = [];
  _lastOCRText = '';

  status.innerHTML = `<div class="scanning-overlay">
    <span class="analyzing-pill"><span class="dot-loader"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span> Bild wird vorbereitet...</span>
  </div>`;

  let imgInput = file;
  try {
    const blob = await _preprocessImage(dataUrl);
    if (blob) imgInput = blob;
  } catch(e) {}

  const pill = document.querySelector('.analyzing-pill');
  if (pill) pill.innerHTML = `<span class="dot-loader"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span> Text wird erkannt...`;

  let rawText = '';
  try {
    const result = await Tesseract.recognize(imgInput, 'eng+deu', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          const el = document.querySelector('.analyzing-pill');
          if (el) el.innerHTML = `<span class="dot-loader"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span> Texterkennung: ${pct}%`;
        }
      }
    });
    rawText = result.data.text;
  } catch(e) {
    status.innerHTML = `<div style="text-align:center;padding:16px;color:var(--red);font-weight:700;">❌ Texterkennung fehlgeschlagen: ${e.message}</div>`;
    return;
  }

  if (!rawText || rawText.trim().length < 5) {
    status.innerHTML = `<div style="text-align:center;padding:16px;color:var(--red);font-weight:700;">❌ Kein Text erkannt. Bitte ein klareres Foto versuchen.</div>`;
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
    status.innerHTML = `<div style="padding:12px">
      <div style="color:var(--red);font-weight:700;margin-bottom:8px;">❌ Keine Vokabeln automatisch erkannt.</div>
      <div style="color:#666;font-size:.85rem;margin-bottom:8px;">Tipps: Foto gerade halten, gute Beleuchtung, klare Schrift.</div>
      <details style="font-size:.78rem;color:#666;">
        <summary style="cursor:pointer;font-weight:700;color:var(--purple)">🔍 Erkannter Rohtext anzeigen</summary>
        <pre style="margin-top:6px;background:#f5f5f5;padding:8px;border-radius:8px;white-space:pre-wrap;font-size:.7rem;max-height:200px;overflow-y:auto">${(rawText || '').slice(0, 1500).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
      </details>
      <button onclick="_reviewItems=[];showReview()" style="margin-top:10px;font-family:'Fredoka One',cursive;font-size:.88rem;padding:8px 16px;background:var(--purple);color:white;border:none;border-radius:10px;cursor:pointer;">
        ✏️ Wörter manuell eingeben
      </button>
    </div>`;
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
    list.innerHTML = '<p style="text-align:center;color:#aaa;font-weight:700;">Keine Wörter – füge welche manuell hinzu!</p>';
    count.textContent = '';
    return;
  }
  list.innerHTML = window._reviewItems.map((item, i) => `
    <div class="review-item" id="ritem-${i}">
      <input value="${window.escHtml(item.de)}" placeholder="Deutsch" onchange="_reviewItems[${i}].de=this.value" ${item.isDuplicate ? 'style="color:#aaa"' : ''}>
      <span class="sep">→</span>
      <input value="${window.escHtml(item.en)}" placeholder="Englisch" onchange="_reviewItems[${i}].en=this.value" ${item.isDuplicate ? 'style="color:#aaa"' : ''}>
      ${item.isDuplicate ? '<span title="Bereits vorhanden" style="font-size:.75rem;color:#aaa;flex-shrink:0;">✓</span>' : ''}
      <button class="review-del" onclick="removeReviewItem(${i})" title="Entfernen">🗑️</button>
    </div>
  `).join('');
  const newCount = window._reviewItems.filter(i => !i.isDuplicate).length;
  const dupCount = window._reviewItems.filter(i => i.isDuplicate).length;
  count.textContent = `${window._reviewItems.length} Wörter erkannt · ${newCount} neu · ${dupCount} bereits vorhanden (grau)`;
}

export function removeReviewItem(i) {
  window._reviewItems.splice(i, 1);
  window._reviewItems = window._reviewItems.map((item, idx) => ({ ...item, id: idx }));
  renderReviewList();
}

export function addReviewItem() {
  const de = document.getElementById('add-de').value.trim();
  const en = document.getElementById('add-en').value.trim();
  if (!de || !en) {
    document.getElementById('add-de').style.borderColor = de ? '#e0e0e0' : 'var(--red)';
    document.getElementById('add-en').style.borderColor = en ? '#e0e0e0' : 'var(--red)';
    return;
  }
  document.getElementById('add-de').value = '';
  document.getElementById('add-en').value = '';
  document.getElementById('add-de').style.borderColor = '#e0e0e0';
  document.getElementById('add-en').style.borderColor = '#e0e0e0';
  const existing = new Set(window.VOCAB.map(v => v.en.toLowerCase()));
  window._reviewItems.push({ id: window._reviewItems.length, de, en, isDuplicate: existing.has(en.toLowerCase()) });
  renderReviewList();
  document.getElementById('review-list').lastElementChild?.scrollIntoView({ behavior: 'smooth' });
}

export function confirmAddVocab() {
  const toAdd = window._reviewItems.filter(i => i.de.trim() && i.en.trim() && !i.isDuplicate);
  if (toAdd.length === 0) {
    alert('Keine neuen Wörter zum Hinzufügen (alle bereits vorhanden oder leer).');
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
    if (window.currentUser) { markDirty('deck', deck.id); flushPendingSync().catch(() => {}); }
  }
  alert(`✅ ${toAdd.length} neue Vokabel${toAdd.length === 1 ? '' : 'n'} zur Lernliste hinzugefügt!`);
  window._reviewItems = [];
  openVocabManager();
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

// Globaler Fortschritt einer Vorlage — deck-unabhängig.
// Gibt null zurück wenn die Vorlage noch nie irgendwo gespielt wurde,
// sonst { mastered, total, pct }.
// Wörter kommen aus cat.words (Preset-Cache), nicht aus einem Deck.
function _presetProgress(cat, isActive = false) {
  const globalCp = window.SD?.globalPresetStats?.categoryProgress?.[cat.id];
  if (!isActive && !(globalCp?.played > 0)) return null;
  const words = Array.isArray(cat.words) ? cat.words : [];
  if (words.length === 0) return isActive ? { pct: 0 } : null;
  const ws = window.SD?.globalPresetStats?.wordStats || {};
  return { pct: presetWordsPct(words, ws) };
}

function _showPresetIntroModal(onDone) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 22px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-size:2.5rem;margin-bottom:10px;">📦</div>
      <div style="font-family:'Fredoka One',cursive;font-size:1.25rem;color:var(--purple);margin-bottom:12px;">Lernvorlagen</div>
      <p style="font-size:.88rem;color:#555;line-height:1.6;margin:0 0 20px;">
        Für den Anfang empfehlen wir 1 Vorlage. Wer auffrischen will, kann 2 nehmen. Mehr als 2 gleichzeitig sind nicht möglich.
      </p>
      <button id="_preset-intro-ok" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 32px;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;border:none;border-radius:50px;cursor:pointer;box-shadow:0 4px 0 #7a4ba8;">Verstanden</button>
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
  pane.innerHTML = '<div style="text-align:center;padding:24px;color:#aaa;font-weight:700;">Lade Vorlagen…</div>';
  const categories = await _loadPresetCategories();
  const deck = _vmDeck();
  if (!deck) return;
  const activeSet = new Set(deck.presetCategories || []);
  const atLimit = activeSet.size >= MAX_PRESET_CATEGORIES;
  const locked = deck.presetsLocked || false;
  const claimed = _getClaimedPresets();

  if (categories.length === 0) {
    pane.innerHTML = '<div style="text-align:center;padding:24px;color:#aaa;font-weight:700;">Noch keine Vorlagen verfügbar.</div>';
    return;
  }

  const _diffBadge = d => {
    const cfg = { leicht: ['#3aaa5c','leicht'], mittel: ['#e8920a','mittel'], schwer: ['#e03030','schwer'] };
    const [col, lbl] = cfg[d] || [];
    if (!col) return '';
    return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:.70rem;font-weight:700;color:${col};white-space:nowrap"><span style="width:7px;height:7px;border-radius:50%;background:${col};flex-shrink:0"></span>${lbl}</span>`;
  };

  let headerNote;
  if (locked) {
    headerNote = `<p style="font-size:.82rem;font-weight:700;color:#888;background:rgba(0,0,0,.04);padding:8px 12px;border-radius:10px;margin:0 0 14px;text-align:center;">🔒 Vorlagen-Auswahl gesperrt — fest verbunden mit dieser Sammlung</p>`;
  } else if (atLimit) {
    headerNote = `<p style="font-size:.82rem;font-weight:700;color:var(--purple);background:rgba(168,108,219,.08);padding:8px 12px;border-radius:10px;margin:0 0 14px;text-align:center;">✓ ${MAX_PRESET_CATEGORIES} Vorlagen aktiv — Limit erreicht</p>`;
  } else {
    headerNote = `<p style="font-size:.82rem;color:#888;margin:0 0 14px;line-height:1.5;">Vorgefertigte Wortgruppen ein- oder ausschalten.<br>Lernfortschritt bleibt beim Ausschalten erhalten.</p>`;
  }

  // Gesperrte Sammlung: aktive Vorlagen zuerst, inaktive dahinter
  const sortedCategories = locked
    ? [...categories.filter(c => activeSet.has(c.id)), ...categories.filter(c => !activeSet.has(c.id))]
    : categories;

  pane.innerHTML = headerNote + sortedCategories.map(cat => {
    const isOn = activeSet.has(cat.id);
    const isClaimed = !isOn && claimed.has(cat.id);
    // Button-Sperre: bei lock immer, Limit erreicht, oder in anderer Sammlung beansprucht
    const btnDisabled = locked || (!isOn && atLimit) || isClaimed;
    // Ausgrauung: inaktive bei lock, überlimit-inaktive, oder beansprucht
    const greyOut = (locked && !isOn) || (!locked && !isOn && atLimit) || isClaimed;
    const wordCount = Array.isArray(cat.words) ? cat.words.length : 0;
    const prog = _presetProgress(cat, isOn);
    const progressLine = prog !== null
      ? `<span style="font-size:.72rem;font-weight:700;color:${prog.pct > 0 ? '#7a3aac' : '#ccc'};">${prog.pct}%</span>`
      : '';
    let rowStyle = '';
    if (prog && prog.pct > 0) {
      rowStyle = 'background:linear-gradient(to right,rgba(168,108,219,.15) ' + prog.pct + '%,#fff ' + prog.pct + '%);';
    }
    if (greyOut) {
      rowStyle += 'opacity:.38;';
    } else if (isOn) {
      rowStyle += 'box-shadow:inset 0 0 0 2.5px #a86cdb;';
    }
    const btnLabel = isOn ? 'AN ✓' : (locked ? 'AUS' : 'Auswählen');
    return `<div class="preset-row" style="${rowStyle}">
      <div class="preset-info">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="preset-name">${window.escHtml(cat.name)}</span>
          ${_diffBadge(cat.difficulty)}
        </div>
        <span class="preset-count">${wordCount} Wörter</span>
        ${progressLine}
      </div>
      <button class="preset-toggle${isOn ? ' on' : ''}" onclick="${btnDisabled ? '' : `togglePresetCategory('${cat.id}')`}" ${btnDisabled ? 'disabled' : ''}>
        ${btnLabel}
      </button>
    </div>`;
  }).join('');
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 22px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-size:2.5rem;margin-bottom:10px;">🔒</div>
      <div style="font-family:'Fredoka One',cursive;font-size:1.25rem;color:var(--purple);margin-bottom:12px;">Sammlung sperren?</div>
      <p style="font-size:.88rem;color:#555;line-height:1.6;margin:0 0 20px;">
        Mit „Bestätigen" werden die aktiven Vorlagen fest mit dieser Sammlung verbunden. Danach können keine Vorlagen mehr gewechselt werden.
      </p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="_vmback-cancel" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 20px;background:#eee;color:#333;border:none;border-radius:50px;cursor:pointer;">Abbrechen</button>
        <button id="_vmback-ok" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 20px;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;border:none;border-radius:50px;cursor:pointer;box-shadow:0 4px 0 #7a4ba8;">Bestätigen</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#_vmback-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#_vmback-ok').addEventListener('click', () => {
    overlay.remove();
    deck.presetsLocked = true;
    syncMirrorFromActiveDeck();
    persist();
    if (window.currentUser) { markDirty('deck', deck.id); flushPendingSync().catch(() => {}); }
    showMenu();
  });
}

// ════════════════════════════════════════════════
//  NEUES DECK — DRAFT-FLOW
// ════════════════════════════════════════════════

export function newDeckFlow() {
  _showNewDeckPathDialog();
}

function _showNewDeckPathDialog() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:26px 20px;max-width:360px;width:100%;box-shadow:0 8px 36px rgba(0,0,0,.2);">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:2rem;margin-bottom:8px;">📚</div>
        <div style="font-family:'Fredoka One',cursive;font-size:1.15rem;color:#2D2D2D;margin-bottom:5px;">Wie soll diese Sammlung aufgebaut werden?</div>
        <p style="font-size:.78rem;color:#bbb;margin:0;line-height:1.5;">Einmalige Wahl — kann später nicht mehr geändert werden</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
        <button id="_ndp-preset" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:none;border-radius:14px;cursor:pointer;background:linear-gradient(135deg,#a86cdb,#c084fc);color:#fff;text-align:left;font-family:'Nunito',sans-serif;width:100%;">
          <span style="font-size:1.5rem;flex-shrink:0;margin-top:1px;">📦</span>
          <div>
            <div style="font-family:'Fredoka One',cursive;font-size:.98rem;">Vorlage nutzen</div>
            <div style="font-size:.75rem;opacity:.88;margin-top:2px;line-height:1.4;">Fertige Wortgruppen auswählen und sofort starten</div>
          </div>
        </button>
        <button id="_ndp-custom" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:none;border-radius:14px;cursor:pointer;background:linear-gradient(135deg,#4D96FF,#7ab4ff);color:#fff;text-align:left;font-family:'Nunito',sans-serif;width:100%;">
          <span style="font-size:1.5rem;flex-shrink:0;margin-top:1px;">✏️</span>
          <div>
            <div style="font-family:'Fredoka One',cursive;font-size:.98rem;">Selbst zusammenstellen</div>
            <div style="font-size:.75rem;opacity:.88;margin-top:2px;line-height:1.4;">Wörter manuell eingeben oder per Text einfügen</div>
          </div>
        </button>
      </div>
      <button id="_ndp-cancel" style="display:block;width:100%;padding:10px;background:none;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:.85rem;color:#bbb;">Abbrechen</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#_ndp-preset').addEventListener('click', () => {
    overlay.remove();
    window._draftDeck = { id: '_draft', name: 'Neue Sammlung', vocab: [], presetCategories: [], deckPath: 'preset', presetsLocked: false };
    window.VOCAB = window._draftDeck.vocab;
    openVocabManager();
  });
  overlay.querySelector('#_ndp-custom').addEventListener('click', () => {
    overlay.remove();
    window._draftDeck = { id: '_draft', name: 'Neue Sammlung', vocab: [], presetCategories: [], deckPath: 'custom', presetsLocked: false };
    window.VOCAB = window._draftDeck.vocab;
    openVocabManager();
  });
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
  const id = createDeck(name);
  const deck = window.SD.decks[id];
  // Spread-copy: window.VOCAB points to draft.vocab's same array; syncMirrorFromActiveDeck
  // would call window.VOCAB.length=0 and wipe deck.vocab if they shared the reference.
  deck.vocab = [...draft.vocab];
  deck.presetCategories = [...draft.presetCategories];
  deck.deckPath = draft.deckPath;
  deck.presetsLocked = draft.presetsLocked;
  delete window._draftDeck;
  switchDeck(id); // calls syncMirrorFromActiveDeck + persist
  if (window.currentUser) { markDirty('deck', id); flushPendingSync().catch(() => {}); }
  showMenu();
}

function _showDraftLockDialog(draft) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 22px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-size:2.5rem;margin-bottom:10px;">🔒</div>
      <div style="font-family:'Fredoka One',cursive;font-size:1.25rem;color:var(--purple);margin-bottom:12px;">Sammlung abschließen?</div>
      <p style="font-size:.88rem;color:#555;line-height:1.6;margin:0 0 20px;">
        Die gewählten Vorlagen werden fest mit dieser neuen Sammlung verbunden. Danach können keine Vorlagen mehr gewechselt werden.
      </p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="_dld-cancel" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 20px;background:#eee;color:#333;border:none;border-radius:50px;cursor:pointer;">Weiter wählen</button>
        <button id="_dld-ok" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 20px;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;border:none;border-radius:50px;cursor:pointer;box-shadow:0 4px 0 #7a4ba8;">Bestätigen</button>
      </div>
    </div>
  `;
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 22px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-size:2.5rem;margin-bottom:10px;">📝</div>
      <div style="font-family:'Fredoka One',cursive;font-size:1.25rem;color:var(--purple);margin-bottom:12px;">Name der Sammlung</div>
      <input id="_cnd-name" type="text" placeholder="z.B. Schule Klasse 3" style="width:100%;padding:12px 16px;border:2px solid #e0e0e0;border-radius:12px;font-family:'Nunito',sans-serif;font-size:1rem;box-sizing:border-box;margin-bottom:18px;" maxlength="50">
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="_cnd-cancel" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 20px;background:#eee;color:#333;border:none;border-radius:50px;cursor:pointer;">Weiter bearbeiten</button>
        <button id="_cnd-ok" style="font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 20px;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;border:none;border-radius:50px;cursor:pointer;box-shadow:0 4px 0 #7a4ba8;">Fertig</button>
      </div>
    </div>
  `;
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
    if (window.currentUser) { markDirty('deck', deck.id); flushPendingSync().catch(() => {}); }
  }
  renderPresetsTab();
  _updateVmCount();
}
