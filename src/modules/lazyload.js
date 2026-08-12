// src/modules/lazyload.js
// Klassische Libraries erst bei Bedarf nachladen statt beim App-Start.
// Vorher hingen tesseract.js und vosk.js als parser-blockierende <script>-Tags
// am Ende von index.html: der Browser musste BEIDE laden (vosk allein 5,6 MB),
// bevor src/main.js überhaupt anlief — bei jedem Start, online wie offline.
// Offline scheiterten sie zwangsläufig, und weil sie den Parser blockieren,
// wartete die App erst den Netzwerk-Timeout ab, bevor irgendetwas passierte.

const _pending = new Map();

/** Lädt ein klassisches Script genau einmal. Parallele Aufrufe teilen das Promise. */
export function loadScriptOnce(url) {
  if (_pending.has(url)) return _pending.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    // CORS-Modus erzwingen: ohne crossOrigin ist ein Cross-Origin-Script ein
    // no-cors-Request und liefert eine opaque Response (status 0). Die kann der
    // Service Worker nicht cachen — genau daran scheiterten tesseract/vosk bisher.
    if (new URL(url, document.baseURI).origin !== location.origin) s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => {
      _pending.delete(url);        // Retry beim nächsten Versuch erlauben
      reject(new Error('Script nicht ladbar: ' + url));
    };
    document.head.appendChild(s);
  });
  _pending.set(url, p);
  return p;
}

/**
 * Vosk (Offline-Spracherkennung). Liegt lokal unter vendor/ und bringt sein WASM
 * inline mit — funktioniert damit auch ohne Netz, passend zum Modell in models/.
 */
export function ensureVosk() {
  if (typeof window.Vosk !== 'undefined') return Promise.resolve();
  return loadScriptOnce(new URL('vendor/vosk.js', document.baseURI).href);
}

/**
 * Tesseract (OCR fürs Vokabel-Scannen). Bleibt bewusst am CDN: Worker, Core-WASM
 * und die Sprachdaten holt die Library zur Laufzeit ohnehin von dort — eine lokale
 * Kopie der 66-KB-Hülle würde das Scannen nicht offline-fähig machen.
 */
export function ensureTesseract() {
  if (typeof window.Tesseract !== 'undefined') return Promise.resolve();
  return loadScriptOnce('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
}
