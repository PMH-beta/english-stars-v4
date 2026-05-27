-- ════════════════════════════════════════════════
--  ENGLISH STARS — DATENBANK-SCHEMA
-- ════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1) PROFILES (Spieler-Daten)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL DEFAULT '',
  highscore INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  active_deck_id UUID,
  active_mode TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration für bestehende DBs (einmalig im Supabase-Dashboard ausführen):
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_mode TEXT NOT NULL DEFAULT 'free';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────
-- 2) DECKS (Vokabelsammlungen)
-- ─────────────────────────────────────────────
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vocab JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  preset_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  presets_locked BOOLEAN NOT NULL DEFAULT false,
  last_exam JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own decks" ON decks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own decks" ON decks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON decks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own decks" ON decks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3) WORD_STATS (Lernfortschritt pro Wort)
-- ─────────────────────────────────────────────
CREATE TABLE word_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  stat_key TEXT NOT NULL,
  asked NUMERIC NOT NULL DEFAULT 0,
  correct NUMERIC NOT NULL DEFAULT 0,
  wrong NUMERIC NOT NULL DEFAULT 0,
  recent TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, deck_id, stat_key)
);

ALTER TABLE word_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stats" ON word_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON word_stats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON word_stats
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stats" ON word_stats
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4) EXAMS (Prüfungs-Historie)
-- ─────────────────────────────────────────────
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exams" ON exams
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exams" ON exams
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 5) AUTO-CREATE PROFILE bei Signup
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Google OAuth liefert full_name in raw_user_meta_data — als Startwert übernehmen.
  -- Passwort-User haben kein full_name → COALESCE gibt '' zurück.
  -- ON CONFLICT: idempotent, kein zweiter Row bei Identity-Linking.
  INSERT INTO public.profiles (id, player_name, highscore, total_points)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    0,
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- 5b) PRESET_CATEGORIES (Vorgefertigte Vokabelgruppen — zentral, alle Nutzer lesbar)
-- ─────────────────────────────────────────────
CREATE TABLE preset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  words JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE preset_categories ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten Nutzer dürfen lesen — nur Admin schreibt (über Dashboard/Service-Role)
CREATE POLICY "Authenticated users can read preset categories" ON preset_categories
  FOR SELECT TO authenticated USING (true);

-- Platzhalter-Kategorien (Wörter kommen später)
INSERT INTO preset_categories (name, slug, sort_order, words) VALUES
  ('Tiere',  'tiere',  10, '[]'::jsonb),
  ('Zahlen', 'zahlen', 20, '[]'::jsonb),
  ('Farben', 'farben', 30, '[]'::jsonb);

-- ─────────────────────────────────────────────
-- 6) INDEXES für Performance
-- ─────────────────────────────────────────────
CREATE INDEX idx_decks_user ON decks(user_id);
CREATE INDEX idx_word_stats_user_deck ON word_stats(user_id, deck_id);
CREATE INDEX idx_exams_user_deck ON exams(user_id, deck_id);

-- ─────────────────────────────────────────────
-- MIGRATIONS (nachträgliche Schema-Änderungen)
-- ─────────────────────────────────────────────
-- v4.0.75: presets_locked Flag pro Deck
ALTER TABLE decks ADD COLUMN IF NOT EXISTS presets_locked BOOLEAN NOT NULL DEFAULT false;