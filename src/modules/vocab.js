// src/modules/vocab.js
import { switchDeck, activeDeck, syncMirrorFromActiveDeck } from './decks.js';
import { showScreen } from './ui.js';
import { persist } from './storage.js';
import { markDirty, flushPendingSync } from './sync.js';
import { supabase } from './supabase.js';
import { effectivePct, statKeyFor } from './stats.js';
import { MAX_PRESET_CATEGORIES, MASTERY_MIN_ATTEMPTS, MASTERY_THRESHOLD } from './config.js';

// window._reviewItems: muss global sein damit inline onchange-Handler ("_reviewItems[i].de=...") funktionieren
window._reviewItems = [];
let _lastOCRText = '';

export function openVocabManager(deckId) {
  if (deckId) switchDeck(deckId);
  showScreen('scan-screen');
  _renderVmTabsForMode();
  const dn = document.getElementById('vm-deck-name');
  if (dn) dn.textContent = 'Sammlung: ' + activeDeck().name;
}

function _renderVmTabsForMode() {
  const mode = window.SD?.activeMode || 'free';
  const tabsEl = document.querySelector('.vm-tabs');
  if (!tabsEl) return;
  if (mode === 'free') {
    tabsEl.innerHTML = `
      <button class="vm-tab" data-tab="presets" onclick="vmTab('presets')">📦 Vorlagen</button>
      <button class="vm-tab" data-tab="add" onclick="vmTab('add')">➕ Hinzufügen</button>
      <button class="vm-tab" data-tab="paste" onclick="vmTab('paste')">📝 Text</button>
      <button class="vm-tab" data-tab="list" onclick="vmTab('list')">📋 Liste <span id="vm-count" class="vm-count">0</span></button>
    `;
    vmTab('presets');
  } else {
    tabsEl.innerHTML = `
      <button class="vm-tab" data-tab="list" onclick="vmTab('list')">📋 Liste <span id="vm-count" class="vm-count">0</span></button>
      <button class="vm-tab" data-tab="add" onclick="vmTab('add')">➕ Hinzufügen</button>
      <button class="vm-tab" data-tab="scan" onclick="vmTab('scan')">📷 Scan</button>
    `;
    vmTab('list');
  }
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
}

export function renderVocabList() {
  const listEl = document.getElementById('vm-list');
  const cntEl = document.getElementById('vm-count');
  if (!listEl) return;
  const search = (document.getElementById('vm-search')?.value || '').toLowerCase().trim();
  const deck = activeDeck();
  const manualVocab = deck.vocab.filter(v => !v._presetId);
  const items = manualVocab.filter(v => {
    if (!search) return true;
    return v.de.toLowerCase().includes(search) || v.en.toLowerCase().includes(search);
  });
  if (cntEl) cntEl.textContent = manualVocab.length;
  if (items.length === 0) {
    listEl.innerHTML = '<div class="vm-empty">' + (search ? 'Keine Treffer für "' + window.escHtml(search) + '"' : 'Noch keine Vokabeln. Füge welche hinzu! 👇') + '</div>';
    return;
  }
  listEl.innerHTML = items.map(v => {
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
  const deck = activeDeck();
  toAdd.forEach(i => {
    const v = { de: i.de.trim(), en: i.en.trim() };
    window.VOCAB.push(v);
    deck.vocab.push(v);
  });
  persist();
  if (window.currentUser) { markDirty('deck', deck.id); flushPendingSync().catch(() => {}); }
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

// Fortschritt einer Vorlage: null wenn Gate nicht erfüllt, sonst {mastered, total}.
// Gate: Vorlage muss aktiv sein UND das Deck muss mindestens einmal gespielt worden sein.
function _presetProgress(cat, deck) {
  if (!deck.presetCategories?.includes(cat.id)) return null;
  const hasPlayed = Object.values(deck.categoryProgress || {}).some(cp => (cp.played || 0) > 0);
  if (!hasPlayed) return null;
  const presetWords = deck.vocab.filter(v => v._presetId === cat.id);
  if (presetWords.length === 0) return null;
  const mastered = presetWords.filter(v => {
    const stat = deck.wordStats[statKeyFor(v.de, v.en, '_mc')];
    return stat && Math.floor(stat.asked || 0) >= MASTERY_MIN_ATTEMPTS && effectivePct(stat) >= MASTERY_THRESHOLD;
  }).length;
  return { mastered, total: presetWords.length };
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
  const deck = activeDeck();
  if (!deck) return;
  const activeSet = new Set(deck.presetCategories || []);
  const atLimit = activeSet.size >= MAX_PRESET_CATEGORIES;
  const locked = deck.presetsLocked || false;

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

  pane.innerHTML = headerNote + categories.map(cat => {
    const isOn = activeSet.has(cat.id);
    const disabled = locked || (!isOn && atLimit);
    const wordCount = Array.isArray(cat.words) ? cat.words.length : 0;
    const prog = _presetProgress(cat, deck);
    const progressLine = prog
      ? `<span style="font-size:.72rem;font-weight:700;color:#2a7a35;">✓ ${prog.mastered}/${prog.total} gemeistert</span>`
      : '';
    return `<div class="preset-row" style="${disabled ? 'opacity:.4;' : ''}">
      <div class="preset-info">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="preset-name">${window.escHtml(cat.name)}</span>
          ${_diffBadge(cat.difficulty)}
        </div>
        <span class="preset-count">${wordCount} Wörter</span>
        ${progressLine}
      </div>
      <button class="preset-toggle${isOn ? ' on' : ''}" onclick="${disabled ? '' : `togglePresetCategory('${cat.id}')`}" ${disabled ? 'disabled' : ''}>
        ${isOn ? 'AN ✓' : 'AUS'}
      </button>
    </div>`;
  }).join('');
}

export function togglePresetCategory(categoryId) {
  const deck = activeDeck();
  if (deck?.presetsLocked) return; // Sicherheits-Guard — Button ist bereits disabled
  if (!window.SD?.presetIntroSeen) {
    _showPresetIntroModal(() => _doTogglePresetCategory(categoryId));
    return;
  }
  _doTogglePresetCategory(categoryId);
}

export function vmBack() {
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

function _doTogglePresetCategory(categoryId) {
  const deck = activeDeck();
  if (!deck) return;
  if (!Array.isArray(deck.presetCategories)) deck.presetCategories = [];

  const cat = (_presetCache || []).find(c => c.id === categoryId);
  if (!cat) return;

  const isOn = deck.presetCategories.includes(categoryId);

  if (!isOn) {
    if (deck.presetCategories.length >= MAX_PRESET_CATEGORIES) return; // Sicherheits-Guard
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

  syncMirrorFromActiveDeck();
  persist();
  if (window.currentUser) { markDirty('deck', deck.id); flushPendingSync().catch(() => {}); }
  renderPresetsTab();
}
