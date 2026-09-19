// src/modules/supabase.js
// Supabase Client - zentrale Verbindung zur Datenbank/Auth
// Lokale Kopie statt CDN-Import (vendor/, erzeugt von scripts/vendor.mjs):
// esm.sh lieferte für "@2" einen Shim mit max-age=600, der auf die jeweils
// neueste 2.x zeigte und in 8 Einzel-Requests auffächerte. Nach einem Supabase-
// Release zeigten die Sub-Imports auf URLs, die nicht im Cache lagen — und weil
// dieser Import statisch im Startpfad hängt, scheiterte dann der GESAMTE
// Modulgraph: weißer Bildschirm offline. Same-Origin ist vorcachebar.
import { createClient } from '../../vendor/supabase-js.esm.js';

// Öffentliche Client-Keys (anon/publishable) — durch RLS geschützt, kein Secret
const SUPABASE_URL = 'https://bjjdofvvzlivyhvjdfyw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tt5pHbQG185R-H0RNbJ4zA_Nr2fnAmX';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Liest die gespeicherte Session direkt aus dem localStorage — Notnagel für den
 * Start, falls supabase.auth.getSession() über ein totes Netz hängen bleibt.
 * Ohne das landet ein offline gestartetes Kind auf dem Login-Screen, obwohl es
 * angemeldet ist. Schlüsselformat von supabase-js v2: sb-<projectRef>-auth-token.
 */
export function cachedSessionUser() {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    const raw = localStorage.getItem('sb-' + ref + '-auth-token');
    if (!raw) return null;
    return JSON.parse(raw)?.user ?? null;
  } catch(e) { return null; }
}

// Quick-Check ob Verbindung steht
export async function testConnection() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[supabase] Verbindungsfehler:', error.message);
    return false;
  }
  console.log('[supabase] Verbunden ✓ Session:', data.session ? 'aktiv' : 'keine');
  return true;
}