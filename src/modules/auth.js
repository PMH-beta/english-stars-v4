// src/modules/auth.js
import { supabase } from './supabase.js';

const ERR_MAP = {
  'Invalid login credentials':  'E-Mail oder Passwort falsch.',
  'User already registered':    'Diese E-Mail ist bereits registriert.',
  'Email not confirmed':        'Bitte zuerst E-Mail bestätigen.',
  'Password should be at least 6 characters': 'Passwort muss mind. 6 Zeichen haben.',
  'Unable to validate email address: invalid format': 'Ungültige E-Mail-Adresse.',
  'signup disabled':            'Registrierung momentan deaktiviert.',
  'issued at future':           'Systemuhr nicht synchron. Bitte Datum/Uhrzeit prüfen.',
};

function mapErr(msg) {
  if (!msg) return 'Unbekannter Fehler.';
  for (const [key, val] of Object.entries(ERR_MAP)) {
    if (msg.includes(key)) return val;
  }
  return msg;
}

function _redirectTo() {
  // Gibt die korrekte App-URL zurück, z.B. https://pmh-beta.github.io/english-stars-v4/
  // Funktioniert sowohl auf GitHub Pages (mit Subpfad) als auch lokal (localhost:5173/)
  return window.location.origin + window.location.pathname.replace(/index\.html$/, '');
}

export async function signUp(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: _redirectTo() },
    });
    if (error) return { user: null, error: mapErr(error.message) };

    // Bei aktiviertem Email-Confirm gibt Supabase { user: null } zurück —
    // sowohl für neue als auch für bereits bestätigte Emails (Datenschutz: keine Enumeration).
    // Beide Fälle → pending_confirmation, User muss Postfach prüfen.
    if (!data.user) return { user: 'pending_confirmation', error: null };

    return { user: data.user, error: null };
  } catch(e) {
    return { user: null, error: 'Keine Verbindung. Bitte Internet prüfen.' };
  }
}

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    const emailNotConfirmed = !!error?.message?.includes('Email not confirmed');
    return {
      user: data?.user ?? null,
      error: error ? mapErr(error.message) : null,
      emailNotConfirmed,
    };
  } catch(e) {
    return { user: null, error: 'Keine Verbindung. Bitte Internet prüfen.', emailNotConfirmed: false };
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[auth] signOut:', error.message);
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup', email,
    options: { emailRedirectTo: _redirectTo() },
  });
  return error ? mapErr(error.message) : null;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
