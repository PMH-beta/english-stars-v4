// src/modules/dialog.js
import { flushPendingSync } from './sync.js';
// App-eigene Overlay-Dialoge als Ersatz für native alert/confirm/prompt.
// Optik wie die bestehenden Overlays (Sammlung löschen/zurücksetzen). Alle drei
// liegen auf z-index 9999 + position:fixed, damit der Android-Zurück-Button sie
// wie jedes andere Overlay schließt (_topOverlay in ui.js). Sie geben ein Promise
// zurück; Abbrechen oder Schließen löst KEINE Speicheraktion aus (resolve false/
// null bzw. der .then-Callback läuft nicht) — exakt wie das native Pendant.

const BACKDROP = 'position:fixed;inset:0;background:rgba(15,10,30,.55);backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
const CARD     = "background:#fff;border-radius:22px;padding:28px 22px;max-width:340px;width:100%;text-align:center;box-shadow:0 14px 44px rgba(20,10,50,.35);max-height:86vh;overflow-y:auto;";
const TITLE    = "font-family:'Fredoka One',cursive;font-size:1.25rem;margin-bottom:12px;";
const BODY     = "font-size:.9rem;color:#555;line-height:1.6;margin:0 0 20px;white-space:pre-line;";
const BTN      = "font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 22px;border:none;border-radius:50px;cursor:pointer;";
const BTN_CANCEL = BTN + 'background:#f0edf7;color:#555;';
const BTN_OK     = BTN + 'background:linear-gradient(135deg,#a86cdb,#c084fc);color:#fff;box-shadow:0 4px 0 #7a4ba8;';
const BTN_DANGER = BTN + 'background:linear-gradient(135deg,#e53935,#f44336);color:#fff;box-shadow:0 4px 0 #b71c1c;';
const INPUT  = "width:100%;box-sizing:border-box;font-family:'Nunito',sans-serif;font-size:1rem;padding:12px 14px;border:2px solid #e0d4f0;border-radius:12px;margin:0 0 18px;outline:none;";

// Grundgerüst: Backdrop + Karte mit optionalem Icon, Titel, Fließtext. Gibt die
// Knoten zurück, die Aufrufer-spezifischen Buttons/Inputs hängen sich dort ein.
function _scaffold(opts) {
  const overlay = document.createElement('div');
  overlay.style.cssText = BACKDROP;
  const card = document.createElement('div');
  card.style.cssText = CARD;
  if (opts.icon) {
    const ic = document.createElement('div');
    ic.style.cssText = 'font-size:2.5rem;margin-bottom:10px;';
    ic.textContent = opts.icon;
    card.appendChild(ic);
  }
  if (opts.title) {
    const t = document.createElement('div');
    t.style.cssText = TITLE + 'color:' + (opts.danger ? '#e53935' : 'var(--purple)') + ';';
    t.textContent = opts.title;
    card.appendChild(t);
  }
  if (opts.body) {
    const p = document.createElement('p');
    p.style.cssText = BODY;
    p.textContent = opts.body;
    card.appendChild(p);
  }
  overlay.appendChild(card);
  return { overlay, card };
}

function _btnRow() {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;justify-content:center;';
  return row;
}

function _mount(overlay) {
  (document.body || document.documentElement).appendChild(overlay);
}

// alert → Nachricht + OK. Promise resolved beim OK (für Aufrufer, die danach
// weiterlaufen sollen, z.B. „gemeistert" → Menü).
export function esAlert(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const { overlay, card } = _scaffold(opts);
    const row = _btnRow();
    const ok = document.createElement('button');
    ok.style.cssText = opts.danger ? BTN_DANGER : BTN_OK;
    ok.textContent = opts.ok || 'OK';
    ok.addEventListener('click', () => { overlay.remove(); resolve(); });
    row.appendChild(ok);
    card.appendChild(row);
    _mount(overlay);
    ok.focus();
  });
}

// confirm → Bestätigen/Abbrechen. Promise resolved true (OK) / false (Abbrechen).
export function esConfirm(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const { overlay, card } = _scaffold(opts);
    const row = _btnRow();
    const cancel = document.createElement('button');
    cancel.style.cssText = BTN_CANCEL;
    cancel.textContent = opts.cancel || 'Abbrechen';
    cancel.addEventListener('click', () => { overlay.remove(); resolve(false); });
    const ok = document.createElement('button');
    ok.style.cssText = opts.danger ? BTN_DANGER : BTN_OK;
    ok.textContent = opts.ok || 'OK';
    ok.addEventListener('click', () => { overlay.remove(); resolve(true); });
    row.appendChild(cancel);
    row.appendChild(ok);
    card.appendChild(row);
    _mount(overlay);
    ok.focus();
  });
}

// prompt → Texteingabe + Bestätigen/Abbrechen. Promise resolved den Roh-String
// (OK) bzw. null (Abbrechen) — exakt wie window.prompt. Aufrufer trimmen/prüfen
// selbst weiter (kein Speichern bei leer), damit die Datenkette identisch bleibt.
export function esPrompt(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const { overlay, card } = _scaffold(opts);
    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = INPUT;
    input.value = opts.value != null ? opts.value : '';
    if (opts.placeholder) input.placeholder = opts.placeholder;
    card.appendChild(input);
    const row = _btnRow();
    const cancel = document.createElement('button');
    cancel.style.cssText = BTN_CANCEL;
    cancel.textContent = opts.cancel || 'Abbrechen';
    const done = (val) => { overlay.remove(); resolve(val); };
    cancel.addEventListener('click', () => done(null));
    const ok = document.createElement('button');
    ok.style.cssText = BTN_OK;
    ok.textContent = opts.ok || 'OK';
    ok.addEventListener('click', () => done(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); done(input.value); }
      else if (e.key === 'Escape') { e.preventDefault(); done(null); }
    });
    row.appendChild(cancel);
    row.appendChild(ok);
    card.appendChild(row);
    _mount(overlay);
    input.focus(); input.select();
  });
}

// prompt mit ZWEI Feldern (z.B. Vokabel bearbeiten: Deutsch + Englisch). Resolved
// { de, en } (Roh-Strings, OK) bzw. null (Abbrechen) — wie esPrompt. Aufrufer
// trimmt/prüft selbst weiter (kein Speichern bei leer), Datenkette bleibt identisch.
export function esPrompt2(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const { overlay, card } = _scaffold(opts);
    function mkField(labelText, val) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'text-align:left;margin-bottom:14px;';
      const lab = document.createElement('div');
      lab.style.cssText = "font-family:'Nunito',sans-serif;font-weight:700;font-size:.8rem;color:#999;margin:0 0 5px 4px;";
      lab.textContent = labelText;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.style.cssText = INPUT + 'margin:0;';
      inp.value = val != null ? val : '';
      wrap.appendChild(lab); wrap.appendChild(inp);
      return { wrap, inp };
    }
    const f1 = mkField(opts.label1 || 'Deutsch', opts.value1);
    const f2 = mkField(opts.label2 || 'Englisch', opts.value2);
    card.appendChild(f1.wrap);
    card.appendChild(f2.wrap);
    const row = _btnRow();
    const cancel = document.createElement('button');
    cancel.style.cssText = BTN_CANCEL;
    cancel.textContent = opts.cancel || 'Abbrechen';
    const done = (val) => { overlay.remove(); resolve(val); };
    cancel.addEventListener('click', () => done(null));
    const ok = document.createElement('button');
    ok.style.cssText = BTN_OK;
    ok.textContent = opts.ok || 'OK';
    const submit = () => done({ de: f1.inp.value, en: f2.inp.value });
    ok.addEventListener('click', submit);
    const onKey = e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); done(null); }
    };
    f1.inp.addEventListener('keydown', onKey);
    f2.inp.addEventListener('keydown', onKey);
    row.appendChild(cancel);
    row.appendChild(ok);
    card.appendChild(row);
    _mount(overlay);
    f1.inp.focus(); f1.inp.select();
  });
}

// ────────────────────────────────────────────────
//  SPEICHER-INDIKATOR (dezenter Balken oben) + withSaving
// ────────────────────────────────────────────────
// Leichtgewichtig: kein Vollbild-Overlay, nur ein kleiner Pill-Balken oben mit
// Spinner. Im Timeout-/Fehlerfall wird daraus ein deutlicherer Toast
// ("Im Hintergrund gespeichert"). Speichervorgänge sind klein → kurz sichtbar.

let _savingEl = null;
function _ensureSavingStyle() {
  if (document.getElementById('es-saving-style')) return;
  const st = document.createElement('style');
  st.id = 'es-saving-style';
  st.textContent = '@keyframes es-spin{to{transform:rotate(360deg)}}';
  (document.head || document.documentElement).appendChild(st);
}

function esSavingShow(label) {
  _ensureSavingStyle();
  if (!_savingEl) {
    _savingEl = document.createElement('div');
    _savingEl.id = 'es-saving-bar';
    _savingEl.style.cssText = "position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:10001;display:flex;align-items:center;gap:9px;background:rgba(40,30,60,.92);color:#fff;font-family:'Fredoka One',cursive;font-size:.82rem;padding:8px 16px;border-radius:50px;box-shadow:0 4px 16px rgba(0,0,0,.28);pointer-events:none;opacity:0;transition:opacity .15s;max-width:90vw;";
    (document.body || document.documentElement).appendChild(_savingEl);
  }
  _savingEl.innerHTML = '<span style="width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:es-spin .7s linear infinite;"></span>'
    + '<span></span>';
  _savingEl.lastChild.textContent = label || 'Speichern…';
  void _savingEl.offsetWidth;
  _savingEl.style.opacity = '1';
}

function esSavingHide() {
  if (!_savingEl) return;
  _savingEl.style.opacity = '0';
}

/** Kurzer, deutlicherer Hinweis-Toast (z.B. Timeout-Fall). Auto-Hide. */
let _toastTimer = null;
export function esToast(msg, ms = 2200) {
  _ensureSavingStyle();
  let t = document.getElementById('es-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'es-toast';
    t.style.cssText = "position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:10002;background:rgba(40,30,60,.95);color:#fff;font-family:'Nunito',sans-serif;font-weight:700;font-size:.85rem;padding:9px 18px;border-radius:50px;box-shadow:0 4px 16px rgba(0,0,0,.3);pointer-events:none;opacity:0;transition:opacity .18s;max-width:90vw;text-align:center;";
    (document.body || document.documentElement).appendChild(t);
  }
  t.textContent = msg;
  void t.offsetWidth;
  t.style.opacity = '1';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.style.opacity = '0'; }, ms);
}

/**
 * DER eine Speicher-Wrapper: zeigt den "Speichern…"-Balken, wartet auf
 * Backend-Bestätigung, blendet aus. Bei Timeout/Fehler → Balken weg + Toast
 * "Im Hintergrund gespeichert"; saveFn läuft im Hintergrund weiter, der Aufrufer
 * wird NICHT blockiert (App hängt nie). Resolved nach min(saveFn, timeout).
 * saveFn ist verantwortlich für die Cloud-Writes.
 */
export function withSaving(saveFn, { label = 'Speichern…', timeoutMs = 5000 } = {}) {
  esSavingShow(label);
  const work = (async () => {
    try { await saveFn(); return 'ok'; }
    catch (e) { console.warn('[withSaving] fehlgeschlagen:', e?.message); return 'fail'; }
  })();
  return new Promise(resolve => {
    let done = false;
    const finish = (mode) => {
      if (done) return; done = true;
      esSavingHide();
      if (mode !== 'ok') esToast('Im Hintergrund gespeichert');
      resolve();
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    work.then(r => { clearTimeout(timer); finish(r); });
  });
}

/**
 * DER eine sichtbare Commit für „Änderung speichern" (Regel 2 & 3): schiebt die
 * pending-Marker bestätigt in die Cloud (über withSaving → Balken/Timeout).
 * Aufrufer macht vorher window.SD ändern + persist + markDirty(...).
 * EINE Stelle für „sichtbar + bestätigt speichern".
 */
export function commitDirty() {
  const uid = window.currentUser?.id;
  if (!uid) return Promise.resolve();
  return withSaving(async () => { await flushPendingSync(); });
}

// Auch global, damit Inline-/Legacy-Aufrufer sie ohne Import nutzen können.
if (typeof window !== 'undefined') {
  window.esAlert = esAlert;
  window.esConfirm = esConfirm;
  window.esPrompt = esPrompt;
  window.esPrompt2 = esPrompt2;
  window.esToast = esToast;
  window.withSaving = withSaving;
  window.commitDirty = commitDirty;
}
