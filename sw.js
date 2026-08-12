// VERSION kommt aus dem ?v der Registrierungs-URL (pwa.js: register('sw.js?v='+APP_VERSION)).
// self.location enthält diesen Query → eine Quelle der Wahrheit (config.js APP_VERSION).
// Fallback nur, falls sw.js je ohne Query geladen wird.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'v4';
const CACHE = 'english-stars-' + VERSION;

// ── Zweiter, NICHT versionierter Cache für die großen Brocken ──
// Vosk-Modell (41 MB), vosk.js (5,6 MB) und die Musik hingen bisher im
// versionierten Cache — und activate() löscht bei jedem APP_VERSION-Bump alles
// außer der aktuellen Version. Damit hat JEDER Deploy dem Kind rund 47 MB
// erneutes Herunterladen aufgezwungen: genau das, was nach dem ersten
// Online-Start eigentlich liegen bleiben soll. Diese Dateien sind zudem über
// ihren Dateinamen versioniert (vosk-model-small-en-us-0.15.tar.gz), ändern sich
// also nicht stillschweigend.
// ACHTUNG: Wird vendor/vosk.js je neu gevendort, muss STATIC_CACHE umbenannt
// werden — sonst bleibt die alte Kopie ewig liegen.
const STATIC_CACHE = 'english-stars-static-v1';
const STATIC_RE = /\/(models|music)\/|\/vendor\/vosk\.js$/;

// ── App-Shell ──
// ALLES was zum Starten nötig ist. Vorher standen hier nur HTML/Manifest/Icons und
// KEINE Zeile App-Code — offline war damit Glückssache: es funktionierte nur, wenn
// jede der 30+ Moduldateien vorher zufällig schon einmal online geladen worden war.
// Neue Module hier ergänzen. Nicht gelistete Dateien landen weiterhin nach dem
// ersten erfolgreichen Laden im Cache, sind aber eben nicht garantiert da.
// BEWUSST NICHT hier: vendor/vosk.js (5,6 MB), models/ (41 MB), music/*.mp3 — die
// würden bei jedem Versionssprung neu gezogen. Sie kommen cache-first bei Bedarf.
const PRECACHE = [
  './', './index.html', './manifest.json', './tracks.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './favicon.png',
  './src/style.css', './src/main.js',
  './vendor/supabase-js.esm.js',
  './src/modules/audio.js', './src/modules/auth.js', './src/modules/avatar.js',
  './src/modules/campaign-balance.js', './src/modules/campaign-equipment.js',
  './src/modules/campaign-fight.js', './src/modules/campaign.js', './src/modules/config.js',
  './src/modules/decks.js', './src/modules/default-decks.js', './src/modules/dialog.js',
  './src/modules/friends.js', './src/modules/game.js', './src/modules/irregular-game.js',
  './src/modules/irregular-verbs.js', './src/modules/lazyload.js',
  './src/modules/minigame-echo.js', './src/modules/minigame-letterstorm.js',
  './src/modules/minigame-meteors.js', './src/modules/minigame-truefalse.js',
  './src/modules/pixel-enemies.js', './src/modules/pixel-items.js', './src/modules/pwa.js',
  './src/modules/speech.js', './src/modules/startup.js', './src/modules/stats.js',
  './src/modules/storage.js', './src/modules/supabase.js', './src/modules/sync.js',
  './src/modules/ui.js', './src/modules/vocab.js',
];

self.addEventListener('install', e => {
  // cache:'reload' beim Precache → der neue SW holt die Shell frisch vom Netz,
  // nicht aus dem HTTP-Cache des Browsers. Sonst könnte er beim Install eine stale
  // Datei in seinen eigenen Cache schreiben.
  //
  // Einzeln statt addAll(): addAll ist ATOMAR — eine einzige fehlende Datei hätte
  // den kompletten Precache verworfen, und das bisherige .catch(()=>{}) hat genau
  // das stillschweigend geschluckt. Jetzt fehlt im Zweifel eine Datei statt aller.
  e.waitUntil(caches.open(CACHE).then(async c => {
    const results = await Promise.allSettled(PRECACHE.map(async u => {
      // 'no-cache' statt 'reload': beides fragt beim Server nach (keine stale Datei
      // im Precache), aber 'no-cache' erlaubt ein 304. Mit 'reload' lud der neue SW
      // bei JEDEM Versionssprung alle 42 Dateien komplett neu — obwohl die Seite sie
      // Sekunden vorher schon geholt hatte. Gemessen: jede Shell-Datei zweimal.
      const r = await fetch(new Request(u, { cache: 'no-cache' }));
      if (!r.ok) throw new Error(u + ' → HTTP ' + r.status);
      return c.put(u, r);
    }));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      console.warn('[SW] Precache unvollständig (' + failed.length + '/' + PRECACHE.length + '):',
        failed.map(f => f.reason && f.reason.message));
    } else {
      console.log('[SW] Precache vollständig:', PRECACHE.length, 'Dateien —', CACHE);
    }
  }));
});

self.addEventListener('activate', e => {
  // Alte Versions-Caches löschen — purged u.a. den alten v3.35-Cache.
  // STATIC_CACHE bleibt bewusst stehen: dort liegen Vosk-Modell, vosk.js und
  // Musik, die nicht an APP_VERSION hängen und nach dem ersten Online-Start
  // liegen bleiben sollen (sonst 47 MB Nachschlag bei jedem Deploy).
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(k => k !== CACHE && k !== STATIC_CACHE)
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Höre auf "skipWaiting"-Nachrichten von der Seite
self.addEventListener('message', e => {
  if (e.data && e.data.action === 'skipWaiting') self.skipWaiting();
});

// Cache-first geeignet für große/statische Assets, die sich pro Deploy NICHT ändern:
// Vosk-Modell (.tar.gz), Bilder, Fonts, Audio — plus alle Cross-Origin-Libs (CDN).
const CACHE_FIRST_RE = /\.(tar\.gz|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|eot|mp3|wav)$/i;
// vendor/ ebenfalls cache-first: gevendorte Libs ändern sich nur, wenn
// scripts/vendor.mjs neu läuft — und dann hebt der APP_VERSION-Bump ohnehin den
// Cache-Namen, wodurch activate() den alten Stand komplett wegräumt.
const VENDOR_RE = /\/vendor\//;

// Deckel fürs Netz: online kommt ein frischer Deploy weiterhin sofort an, aber ein
// totes oder zähes Netz kostet nie mehr als das. Vorher gab es KEINEN Timeout —
// offline hing jeder einzelne Request am Netzwerk-Stack, bei 30+ Dateien pro Start.
const NET_TIMEOUT = 2500;

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Supabase-API (Auth/REST/Realtime) NIEMALS cachen — immer frisch vom Netz.
  // Sonst landet jeder GET (profiles/decks/word_stats …) im cache-first-Zweig
  // (cross-origin) und der SW liefert beim normalen Reload veraltete Daten zurück
  // (nur Hard-Reload umging das). Writes (POST/PATCH) sind ohnehin GET-gefiltert.
  // cache:'no-store' → auch der HTTP-Cache wird umgangen. Offline → fetch schlägt
  // fehl → cloudLoad 'failed' → lokaler Cache (window.SD) greift als Fallback.
  if (url.hostname.endsWith('.supabase.co')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  // Alte URL → neue URL umleiten
  if (url.pathname.endsWith('/english_stars_v2.html')) {
    e.respondWith(Response.redirect(url.pathname.replace('english_stars_v2.html','index.html'), 302));
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  // Network-first NUR für same-origin App-Code/Shell (HTML, JS, CSS, manifest, JSON):
  // damit Deploy-Updates online sofort ankommen — kein Boot-Cache-Wipe mehr nötig.
  // Cross-Origin (CDN-Libs), vendor/ + große statische Assets bleiben cache-first.
  const networkFirst = sameOrigin && !CACHE_FIRST_RE.test(url.pathname) && !VENDOR_RE.test(url.pathname);

  if (networkFirst) {
    e.respondWith(appCodeResponse(e.request));
    return;
  }

  // Cache-first für Rest (Modell, Bilder, Fonts, Audio, vendor/, CDN).
  // Große versionsunabhängige Dateien landen im STATIC_CACHE, der Deploys überlebt.
  e.respondWith(staticResponse(e.request, STATIC_RE.test(url.pathname) ? STATIC_CACHE : CACHE));
});

async function staticResponse(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const r = await fetch(request);
    if (r.ok && r.status === 200) {
      const clone = r.clone();
      caches.open(cacheName).then(c => c.put(request, clone)).catch(()=>{});
    }
    return r;
  } catch(e) {
    const fallback = await caches.match(request);
    if (fallback) return fallback;
    return Response.error();
  }
}

/**
 * App-Code: Netz zuerst, aber mit Zeitlimit und verlässlichem Cache-Fallback.
 *
 * cache:'no-cache' statt des früheren 'reload': beides erzwingt die Rückfrage beim
 * Server (ein frischer Deploy ist also weiterhin sofort da), aber 'no-cache' erlaubt
 * eine 304-Antwort — der Inhalt wird nur bei echter Änderung neu übertragen.
 * 'reload' lud JEDE Datei bei JEDEM Start komplett neu: 30+ Volldownloads pro
 * App-Start, auf Mobilfunk der Hauptgrund für die lange Startzeit.
 */
async function appCodeResponse(request) {
  const cache = await caches.open(CACHE);

  // Läuft unabhängig vom Timeout weiter und aktualisiert den Cache, auch wenn wir
  // unten schon aus dem Cache geantwortet haben → der nächste Start ist dann frisch.
  const net = fetch(request, { cache: 'no-cache' }).then(r => {
    if (r && r.ok) cache.put(request, r.clone()).catch(()=>{});
    return r;
  });
  net.catch(()=>{});   // keine unhandled rejection, wenn der Timeout zuerst greift

  try {
    const r = await Promise.race([
      net,
      new Promise((_, rej) => setTimeout(() => rej(new Error('sw-timeout')), NET_TIMEOUT)),
    ]);
    if (r && r.ok) return r;
    // 404/500: ein brauchbarer Cache-Eintrag ist besser als eine Fehlerseite
    const fallback = await cache.match(request);
    return fallback || r;
  } catch(e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Navigation ohne passenden Eintrag → App-Shell ausliefern.
    // (Vorher stand hier `r || caches.match(...) || caches.match(...)` — caches.match
    // liefert ein PROMISE, das ist immer truthy, der letzte Zweig war toter Code und
    // im Fehlerfall ging `undefined` an respondWith → Ladefehler statt Fallback.)
    if (request.mode === 'navigate') {
      const shell = (await cache.match('./index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    return Response.error();
  }
}
