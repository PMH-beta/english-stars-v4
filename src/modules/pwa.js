// src/modules/pwa.js
import { isIOS, isStandalone } from './config.js';

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
      const b = document.getElementById('pwa-install-btn');
      if (b) b.style.display = 'none';
    });
    return;
  }
  if (isIOS()) {
    alert('📲 App auf iPhone/iPad installieren:\n\n1. Tippe unten in Safari auf das Teilen-Symbol ⬆️\n2. Wähle "Zum Home-Bildschirm"\n3. Tippe oben rechts auf "Hinzufügen"\n\nDie App erscheint dann wie eine normale App auf dem Home-Bildschirm.');
  } else if (isMacSafari()) {
    alert('📲 App auf Mac installieren (Safari):\n\n1. Menüleiste: "Datei"\n2. "Zum Dock hinzufügen..."\n3. "Hinzufügen" klicken\n\nDie App erscheint dann im Dock.');
  } else {
    alert('Auf Chrome/Edge: ein "Installieren"-Symbol erscheint in der Adressleiste.');
  }
}

// Service Worker registrieren
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      try {
        const last = parseInt(localStorage.getItem('es_sw_lastcheck') || '0', 10);
        if (Date.now() - last > 24 * 3600 * 1000) {
          reg.update().catch(() => {});
          localStorage.setItem('es_sw_lastcheck', String(Date.now()));
        }
      } catch(e) {}
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
        window.location.reload();
      });
    }).catch(e => console.warn('SW reg failed:', e));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'flex';
});

// iOS/Mac-Safari: Install-Button trotzdem zeigen (kein beforeinstallprompt-Event)
window.addEventListener('load', () => {
  if (isStandalone()) return;
  if (isIOS() || isMacSafari()) {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'flex';
  }
});
