// src/modules/dialog.js
// App-eigene Overlay-Dialoge als Ersatz für native alert/confirm/prompt.
// Optik wie die bestehenden Overlays (Sammlung löschen/zurücksetzen). Alle drei
// liegen auf z-index 9999 + position:fixed, damit der Android-Zurück-Button sie
// wie jedes andere Overlay schließt (_topOverlay in ui.js). Sie geben ein Promise
// zurück; Abbrechen oder Schließen löst KEINE Speicheraktion aus (resolve false/
// null bzw. der .then-Callback läuft nicht) — exakt wie das native Pendant.

const BACKDROP = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
const CARD     = "background:#fff;border-radius:20px;padding:28px 22px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);";
const TITLE    = "font-family:'Fredoka One',cursive;font-size:1.25rem;margin-bottom:12px;";
const BODY     = "font-size:.9rem;color:#555;line-height:1.6;margin:0 0 20px;white-space:pre-line;";
const BTN      = "font-family:'Fredoka One',cursive;font-size:1rem;padding:12px 22px;border:none;border-radius:50px;cursor:pointer;";
const BTN_CANCEL = BTN + 'background:#eee;color:#333;';
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

// Auch global, damit Inline-/Legacy-Aufrufer sie ohne Import nutzen können.
if (typeof window !== 'undefined') {
  window.esAlert = esAlert;
  window.esConfirm = esConfirm;
  window.esPrompt = esPrompt;
}
