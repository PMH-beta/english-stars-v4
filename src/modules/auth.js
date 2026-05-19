// src/modules/auth.js
import { supabase } from './supabase.js';

const ERR_MAP = {
  'Invalid login credentials':  'E-Mail oder Passwort falsch.',
  'User already registered':    'Diese E-Mail ist bereits registriert.',
  'Email not confirmed':        'Bitte zuerst E-Mail bestätigen.',
  'Password should be at least 6 characters': 'Passwort muss mind. 6 Zeichen haben.',
  'Unable to validate email address: invalid format': 'Ungültige E-Mail-Adresse.',
  'signup disabled':            'Registrierung momentan deaktiviert.',
};

function mapErr(msg) {
  if (!msg) return 'Unbekannter Fehler.';
  for (const [key, val] of Object.entries(ERR_MAP)) {
    if (msg.includes(key)) return val;
  }
  return msg;
}

export async function signUp(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { user: data?.user ?? null, error: error ? mapErr(error.message) : null };
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
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  return error ? mapErr(error.message) : null;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
