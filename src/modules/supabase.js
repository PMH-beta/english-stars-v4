// src/modules/supabase.js
// Supabase Client - zentrale Verbindung zur Datenbank/Auth
// ESM-CDN-Import: kein Build-Schritt nötig, funktioniert direkt im Browser
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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