// src/modules/pwa.js
import { isIOS, isStandalone, APP_VERSION } from './config.js';

let _pwaPrompt = null;

function isMacSafari() {
  const ua = navigator.userAgent;
  return ua.indexOf('Mac') !== -1 && ua.indexOf('Safari') !== -1
    && ua.indexOf('Chrome') === -1 && !isIOS();
}

export function pwaInstall() {
  if (_pwaPrompt) {
    _pwaPrompt.prompt();
    _pwaPrompt.userChoice.then(() => {
      _pwaPrompt = null;
      window._pwaInstallReady = false;
      const b = document.getElementById('pwa-install-btn');
      if (b) b.style.display = 'none';
    });
    return;
  }
  if (isIOS()) {
    window.esAlert({ icon: '📲', title: 'Auf iPhone/iPad installieren', body: '1. Tippe unten in Safari auf das Teilen-Symbol ⬆️\n2. Wähle "Zum Home-Bildschirm"\n3. Tippe oben rechts auf "Hinzufügen"\n\nDie App erscheint dann wie eine normale App auf dem Home-Bildschirm.' });
  } else if (isMacSafari()) {
    window.esAlert({ icon: '📲', title: 'Auf Mac installieren (Safari)', body: '1. Menüleiste: "Datei"\n2. "Zum Dock hinzufügen..."\n3. "Hinzufügen" klicken\n\nDie App erscheint dann im Dock.' });
  } else {
    window.esAlert({ icon: '📲', title: 'Installieren', body: 'Auf Chrome/Edge: ein "Installieren"-Symbol erscheint in der Adressleiste.' });
  }
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

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaPrompt = e;
  window._pwaInstallReady = true;
  // showScreen() handles visibility — only show immediately if already on menu-screen
  const btn = document.getElementById('pwa-install-btn');
  if (btn && document.getElementById('menu-screen')?.style.display !== 'none') btn.style.display = 'flex';
});

// iOS/Mac-Safari: Install-Button trotzdem zeigen (kein beforeinstallprompt-Event)
window.addEventListener('load', () => {
  if (isStandalone()) return;
  if (isIOS() || isMacSafari()) {
    window._pwaInstallReady = true;
    const btn = document.getElementById('pwa-install-btn');
    if (btn && document.getElementById('menu-screen')?.style.display !== 'none') btn.style.display = 'flex';
  }
});
