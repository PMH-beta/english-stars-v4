// VERSION kommt aus dem ?v der Registrierungs-URL (pwa.js: register('sw.js?v='+APP_VERSION)).
// self.location enthält diesen Query → eine Quelle der Wahrheit (config.js APP_VERSION).
// Fallback nur, falls sw.js je ohne Query geladen wird.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'v4';
const CACHE = 'english-stars-' + VERSION;
const PRECACHE = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./favicon.png'];

self.addEventListener('install', e => {
  // cache:'reload' beim Precache → der neue SW holt Shell/index.html frisch vom Netz,
  // nicht aus dem HTTP-Cache des Browsers. Sonst koennte er beim Install eine stale
  // index.html in seinen eigenen Cache schreiben (relevant fuer den Offline-Fallback).
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))).catch(()=>{})
  ));
});

self.addEventListener('activate', e => {
  // Alle Caches außer der aktuellen Version löschen — purged u.a. den alten v3.35-Cache
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// Höre auf "skipWaiting"-Nachrichten von der Seite
self.addEventListener('message', e => {
  if (e.data && e.data.action === 'skipWaiting') self.skipWaiting();
});

// Cache-first geeignet für große/statische Assets, die sich pro Deploy NICHT ändern:
// Vosk-Modell (.tar.gz), Bilder, Fonts, Audio — plus alle Cross-Origin-Libs (CDN).
const CACHE_FIRST_RE = /\.(tar\.gz|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|eot|mp3|wav)$/i;

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Alte URL → neue URL umleiten
  if (url.pathname.endsWith('/english_stars_v2.html')) {
    e.respondWith(Response.redirect(url.pathname.replace('english_stars_v2.html','index.html'), 302));
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  // Network-first NUR für same-origin App-Code/Shell (HTML, JS, CSS, manifest, JSON):
  // damit Deploy-Updates online sofort ankommen — kein Boot-Cache-Wipe mehr nötig.
  // Cross-Origin (CDN-Libs) + große statische Assets bleiben cache-first.
  const networkFirst = sameOrigin && !CACHE_FIRST_RE.test(url.pathname);

  if (networkFirst) {
    // cache:'reload' umgeht den HTTP-Cache des Browsers für App-Code (HTML/JS/CSS) —
    // sonst liefert fetch() trotz "network-first" die HTTP-gecachte alte Datei und ein
    // normaler Reload bekommt erst nach Strg+Shift+R frischen Code. Die Antwort landet
    // weiterhin im SW-Cache (Offline-Fallback). Modell/Statik bleiben cache-first.
    e.respondWith(
      fetch(e.request, { cache: 'reload' }).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
        return r;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html') || caches.match('./')))
    );
    return;
  }

  // Cache-first für Rest (Modell, Bilder, Fonts, Audio, CDN). 200er werden persistent gecacht.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      if (r.ok && r.status === 200) {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
      }
      return r;
    }).catch(() => caches.match(e.request)))
  );
});
