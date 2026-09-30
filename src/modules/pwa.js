// src/modules/pwa.js
import { isIOS, isStandalone, APP_VERSION } from './config.js';
import { iconHTML } from './pixel-icons.js';

let _pwaPrompt = null;

function isMacSafari() {
  const ua = navigator.userAgent;
  return ua.indexOf('Mac') !== -1 && ua.indexOf('Safari') !== -1
    && ua.indexOf('Chrome') === -1 && !isIOS();
}

// ── App installieren: 9.2 „Hol mich auf deinen Startbildschirm!" (F-20, F-61) ──
// Das Popup kommt im Browser jeden 3. Start (3., 6., 9. …), bis „Nicht mehr
// anzeigen" angehakt oder die App installiert ist. Zähler und Haken liegen nur
// auf diesem Gerät (localStorage, nicht in der Cloud). Dazu die Karte „App
// installieren" im Profil (pwaInstall). Inhalt je Gerät:
//   · iPhone/iPad: Anleitung Teilen → „Zum Home-Bildschirm" (Entwurf 9.2),
//   · bietet der Browser seinen Installations-Dialog an (Android, Chrome/Edge am
//     Computer): Knopf „Jetzt installieren",
//   · sonst die kurze Anleitung ⋮ → „App installieren" (Mac-Safari: Datei → Dock).
const START_SK = 'es_starts', AUS_SK = 'es_install_aus';
let _startZahl = 0;          // dieser Start im Browser (0 = installierte App)
let _hinweisGezeigt = false; // höchstens einmal je Start
let _popupNeu = null;        // offenes Popup neu zeichnen, wenn der Browser-Dialog nachkommt
try {
  if (!isStandalone()) {
    _startZahl = (parseInt(localStorage.getItem(START_SK) || '0', 10) || 0) + 1;
    localStorage.setItem(START_SK, String(_startZahl));
  }
} catch (e) {}

/** Nur im Browser gibt es etwas zu installieren (Karte im Profil). */
export const installMoeglich = () => !isStandalone();

/** Menü: jeden 3. Start das Popup, solange es nicht abbestellt ist. */
export function installHinweisEinmal() {
  if (_hinweisGezeigt || isStandalone() || _startZahl < 3 || _startZahl % 3 !== 0) return;
  try { if (localStorage.getItem(AUS_SK)) return; } catch (e) { return; }
  _hinweisGezeigt = true;
  _installPopup(true);
}

/** Profil „App installieren": Dialog des Browsers, sonst die Anleitung. */
export function pwaInstall() {
  if (_pwaPrompt) _browserDialog();
  else _installPopup(false);
}

function _browserDialog() {
  const p = _pwaPrompt;
  if (!p) return;
  p.prompt();
  p.userChoice.then(() => { _pwaPrompt = null; }).catch(() => {});
}

function _installPopup(automatisch) {
  const ov = document.createElement('div');
  ov.className = 'p-dlg-grund p-ih-grund';
  let aus = false;
  const schritte = (a, iconA, b) => `<div class="p-ih-schritte">
      <div class="p-ih-schritt"><span class="p-ih-nr">1</span><span class="p-ih-text">${a}</span>${iconA ? iconHTML(iconA, 14) : ''}</div>
      <div class="p-ih-schritt"><span class="p-ih-nr">2</span><span class="p-ih-text">${b}</span>${iconHTML('check', 14)}</div>
    </div>`;
  const zeichnen = () => {
    const dialog = !isIOS() && !!_pwaPrompt;
    const mitte = isIOS() ? schritte('Tippe unten auf Teilen', 'install', '„Zum Home-Bildschirm“')
      : dialog ? ''
        : isMacSafari() ? schritte('Menüleiste: „Datei“', null, '„Zum Dock hinzufügen …“')
          : schritte('Tippe oben rechts auf ⋮', null, '„App installieren“');
    ov.innerHTML = `<div class="p-dlg-karte p-ih-karte">
      <div class="p-ih-kopf"><img src="vondu-logo.svg" alt="Vondu" width="56" height="54" data-ui="bob" data-a="1">
        <div class="p-ih-titel">Hol mich auf deinen Startbildschirm!</div></div>
      ${mitte}
      ${automatisch ? `<button class="p-ih-aus${aus ? ' is-an' : ''}" aria-pressed="${aus}"><span class="p-ih-haken">${iconHTML('checkLight', 14)}</span>Nicht mehr anzeigen</button>` : ''}
      <div class="p-ih-knoepfe"><button class="p-ih-btn p-ih-btn--spaeter">Später</button><button class="p-ih-btn p-ih-btn--ok">${dialog ? 'Jetzt installieren' : 'Verstanden'}</button></div>
    </div>`;
    ov.querySelector('.p-ih-aus')?.addEventListener('click', () => { aus = !aus; zeichnen(); });
    ov.querySelector('.p-ih-btn--spaeter').addEventListener('click', () => schliessen(false));
    ov.querySelector('.p-ih-btn--ok').addEventListener('click', () => schliessen(dialog));
  };
  const schliessen = (installieren) => {
    if (aus) { try { localStorage.setItem(AUS_SK, '1'); } catch (e) {} }
    _popupNeu = null;
    ov.remove();
    if (installieren) _browserDialog();
  };
  zeichnen();
  _popupNeu = () => { if (ov.isConnected) zeichnen(); };
  document.body.appendChild(ov);
}

/**
 * Dauerhaften Speicher anfordern.
 *
 * Der Cache-Speicher ist sonst "best effort": wird der Platz auf dem Gerät knapp,
 * darf der Browser die komplette Origin wegräumen — also Vosk-Modell (41 MB),
 * vendor/vosk.js, Musik UND die vorgecachte App-Shell. Damit wäre die App offline
 * wieder tot, obwohl sie vorher online war. Genau das soll liegen bleiben.
 *
 * Chrome/Android gewährt das installierten PWAs in der Regel still, Safari ebenso
 * für Home-Screen-Apps. Ein "nein" ist folgenlos — dann verhält sich der Speicher
 * wie bisher. Firefox kann einen Dialog zeigen; deshalb erst nach dem Laden.
 */
async function requestPersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return;
    if (await navigator.storage.persisted()) {
      console.log('[Storage] bereits dauerhaft');
    } else {
      const granted = await navigator.storage.persist();
      console.log('[Storage] dauerhaft:', granted ? 'ja' : 'nein (bleibt best effort)');
    }
    // Zum Nachsehen, ob Modell und Shell wirklich liegen: erwartet ~47 MB+
    if (navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      console.log('[Storage] belegt:', Math.round((usage||0)/1048576) + ' MB von ' + Math.round((quota||0)/1048576) + ' MB');
    }
  } catch(e) { console.warn('[Storage] persist fehlgeschlagen:', e && e.message); }
}

// Service Worker registrieren
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    requestPersistentStorage();
    // Versions-Query koppelt den SW an APP_VERSION: pro Deploy ändert sich die
    // Script-URL → der Browser installiert einen neuen SW → activate/purge läuft
    // (sw.js leitet seinen CACHE-Namen aus genau diesem ?v ab). Eine Quelle der
    // Wahrheit (config.js), kein manuelles Synchronhalten zweier Nummern.
    navigator.serviceWorker.register('sw.js?v=' + APP_VERSION).then(reg => {
      try {
        const last = parseInt(localStorage.getItem('es_sw_lastcheck') || '0', 10);
        if (Date.now() - last > 24 * 3600 * 1000) {
          reg.update().catch(() => {});
          localStorage.setItem('es_sw_lastcheck', String(Date.now()));
        }
      } catch(e) {}
      // Bereits wartender SW (installiert, bevor dieser Tab den updatefound-Pfad sah):
      // updatefound feuert dann NICHT erneut → skipWaiting hier nachholen, sonst bleibt
      // der alte SW aktiv und der Auto-Reload greift nie. Nur bei echtem Update
      // (Controller vorhanden), nicht beim Erstinstall.
      if (reg.waiting && navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ action: 'skipWaiting' });
      }
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            newSW.postMessage({ action: 'skipWaiting' });
          }
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        // Nicht mitten in Nutzung neuladen (Spiel/Scan/Review) — Reload aufschieben,
        // showMenu() führt ihn beim nächsten Menübesuch aus.
        const busy = document.body.classList.contains('in-game')
          || ['scan-screen','review-screen'].some(id => {
               const el = document.getElementById(id);
               return el && el.style.display !== 'none';
             });
        if (busy) { window._pendingReload = true; return; }
        window.location.reload();
      });
    }).catch(e => console.warn('SW reg failed:', e));
  });
}

// Installations-Dialog des Browsers merken (Android, Chrome/Edge am Computer) —
// „Jetzt installieren" im Popup und „Installieren" im Profil lösen ihn aus.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaPrompt = e;
  if (_popupNeu) _popupNeu();   // offenes Popup bekommt den Knopf
});
