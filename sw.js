const VERSION = 'v3.19';
const CACHE = 'english-stars-' + VERSION;
const PRECACHE = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// Höre auf "skipWaiting"-Nachrichten von der Seite
self.addEventListener('message', e => {
  if (e.data && e.data.action === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Alte URL → neue URL umleiten
  if (url.pathname.endsWith('/english_stars_v2.html')) {
    e.respondWith(Response.redirect(url.pathname.replace('english_stars_v2.html','index.html'), 302));
    return;
  }
  // Network-first für HTML & manifest (damit Updates ankommen)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.endsWith('manifest.json')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
        return r;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html') || caches.match('./')))
    );
    return;
  }
  // Cache-first für Rest
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
