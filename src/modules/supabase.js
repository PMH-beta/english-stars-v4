// src/modules/supabase.js
// Supabase Client - zentrale Verbindung zur Datenbank/Auth
// ESM-CDN-Import: kein Build-Schritt nötig, funktioniert direkt im Browser
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Öffentliche Client-Keys (anon/publishable) — durch RLS geschützt, kein Secret
const SUPABASE_URL = 'https://bjjdofvvzlivyhvjdfyw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tt5pHbQG185R-H0RNbJ4zA_Nr2fnAmX';

// keepalive-Semantik für kleine Schreib-Requests: damit ein Save, der beim
// App-Schließen/Verstecken (visibilitychange→hidden) noch unterwegs ist, NICHT
// abgebrochen wird, sondern den Seiten-Teardown überlebt. Nur für kleine Bodies
// (< 60 KB — keepalive-Limit liegt bei 64 KB; große word_stats-Batches bleiben
// normal, sonst würfe fetch). GET-Reads (kein Body) bleiben unverändert.
function esFetch(input, init = {}) {
  try {
    const body = init && init.body;
    const size = typeof body === 'string' ? body.length
      : (body && typeof body.byteLength === 'number') ? body.byteLength : 0;
    if (size > 0 && size < 60000) init = { ...init, keepalive: true };
  } catch (e) {}
  return fetch(input, init);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: esFetch },
});

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