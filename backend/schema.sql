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
  avatar JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration für bestehende DBs (einmalig im Supabase-Dashboard ausführen):
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_mode TEXT NOT NULL DEFAULT 'free';
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar JSONB;  -- {skin,build,hair,eyes,nose,mouth,ears} je 0..9

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
  sort_order INTEGER NOT NULL DEFAULT 0,
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
  -- player_name bleibt IMMER leer — auch bei Google-OAuth wird full_name NICHT
  -- übernommen. So durchläuft jedes NEUE Konto (E-Mail wie Google) die Namens-
  -- abfrage + Charakter-Anpassung im Onboarding.
  -- ON CONFLICT: idempotent, kein zweiter Row bei Identity-Linking.
  INSERT INTO public.profiles (id, player_name, highscore, total_points)
  VALUES (NEW.id, '', 0, 0)
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
-- v4.0.76: sort_order für manuelle Deck-Reihenfolge
ALTER TABLE decks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- v4.0.77: Globaler Vorlage-Fortschritt pro User
-- Wort-Stats für Vorlage-Wörter (deck-unabhängig, PK: user_id + stat_key)
CREATE TABLE IF NOT EXISTS preset_stats (
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_key   TEXT    NOT NULL,
  asked      NUMERIC NOT NULL DEFAULT 0,
  correct    NUMERIC NOT NULL DEFAULT 0,
  wrong      NUMERIC NOT NULL DEFAULT 0,
  recent     TEXT    NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, stat_key)
);
ALTER TABLE preset_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own preset stats"   ON preset_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preset stats"  ON preset_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preset stats"  ON preset_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own preset stats"  ON preset_stats FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_preset_stats_user ON preset_stats(user_id);
GRANT ALL ON preset_stats TO authenticated, anon, service_role;

-- Kategorie-Fortschritt pro Vorlage (played-Gate + bestStreak; PK: user_id + preset_id)
CREATE TABLE IF NOT EXISTS preset_category_progress (
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_id   UUID    NOT NULL REFERENCES preset_categories(id) ON DELETE CASCADE,
  played      INTEGER NOT NULL DEFAULT 0,
  correct     INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, preset_id)
);
ALTER TABLE preset_category_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own preset cat progress"   ON preset_category_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preset cat progress"  ON preset_category_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preset cat progress"  ON preset_category_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own preset cat progress"  ON preset_category_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_preset_cat_progress_user ON preset_category_progress(user_id);
GRANT ALL ON preset_category_progress TO authenticated, anon, service_role;

-- v4.0.80: deckPath — Exklusiver Sammlungs-Weg im Freien Modus
ALTER TABLE decks ADD COLUMN IF NOT EXISTS deck_path TEXT NOT NULL DEFAULT 'none';
UPDATE decks
SET deck_path = CASE
  WHEN jsonb_array_length(vocab) > 0
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(vocab) v WHERE NOT (v ? '_presetId'))
    THEN 'preset'
  WHEN jsonb_array_length(vocab) > 0
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(vocab) v WHERE v ? '_presetId')
    THEN 'custom'
  ELSE 'none'
END;

-- v4.0.241: Probetest-Verlauf (Misch-Test über bis zu 2 Sammlungen, deck-unabhängig
-- → kein deck_id-FK, hängt nur am User). Speichert die Sammlungs-Namen + Wortzahl.
CREATE TABLE IF NOT EXISTS probetests (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decks     JSONB   NOT NULL DEFAULT '[]'::jsonb,   -- [{ name, count }]
  grade     INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  percent   INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
  questions INTEGER NOT NULL DEFAULT 0,
  correct   INTEGER NOT NULL DEFAULT 0,
  taken_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE probetests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own probetests"  ON probetests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own probetests" ON probetests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own probetests" ON probetests FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_probetests_user ON probetests(user_id);
GRANT ALL ON probetests TO authenticated, anon, service_role;

-- v4.0.249: Onboarding auch für Google — Signup-Trigger übernimmt full_name NICHT
-- mehr, player_name startet immer leer. Wirkt nur für NEUE Signups; bestehende
-- Konten bleiben unberührt. Einmalig im Supabase-Dashboard ausführen:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, player_name, highscore, total_points)
  VALUES (NEW.id, '', 0, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────
-- v4.0.251: FREUNDE (Suche, Anfragen, Liste, Fortschritt eines Freundes)
-- Eine Freundschaft = EINE Zeile (das Paar) → gegenseitig. Schreiben nur über die
-- SECURITY-DEFINER-RPCs; direktes Lesen der eigenen Zeilen per RLS. Alles einmal im
-- Supabase-Dashboard ausführen.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addr ON friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_req  ON friendships(requester_id, status);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own friendships" ON friendships;
CREATE POLICY "read own friendships" ON friendships FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));

-- Suche: Namensteil ab 1 Zeichen, alphabetisch, max 20, mit Beziehungsstatus zu mir.
-- Rückgabe als jsonb-Array (Client bekommt direkt ein Array von Objekten).
CREATE OR REPLACE FUNCTION public.search_users(q text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(obj ORDER BY nm), '[]'::jsonb) FROM (
    SELECT p.player_name AS nm, jsonb_build_object(
      'id', p.id, 'player_name', p.player_name, 'avatar', p.avatar,
      'status', CASE WHEN f.status='accepted' THEN 'friends'
                     WHEN f.status='pending' AND f.requester_id=auth.uid() THEN 'outgoing'
                     WHEN f.status='pending' AND f.addressee_id=auth.uid() THEN 'incoming'
                     ELSE 'none' END) AS obj
    FROM profiles p
    LEFT JOIN friendships f
      ON ((f.requester_id=auth.uid() AND f.addressee_id=p.id)
       OR (f.addressee_id=auth.uid() AND f.requester_id=p.id)) AND f.status<>'declined'
    WHERE p.id<>auth.uid() AND btrim(q)<>'' AND p.player_name ILIKE btrim(q)||'%'
    ORDER BY p.player_name LIMIT 20
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', fid, 'player_name', nm, 'avatar', av) ORDER BY nm), '[]'::jsonb)
  FROM (
    SELECT p.id AS fid, p.player_name AS nm, p.avatar AS av
    FROM friendships f
    JOIN profiles p ON p.id = CASE WHEN f.requester_id=auth.uid() THEN f.addressee_id ELSE f.requester_id END
    WHERE f.status='accepted' AND auth.uid() IN (f.requester_id,f.addressee_id)
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.list_friend_requests()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'friendship_id', f.id, 'requester_id', f.requester_id,
    'player_name', p.player_name, 'avatar', p.avatar, 'created_at', f.created_at
  ) ORDER BY f.created_at DESC), '[]'::jsonb)
  FROM friendships f
  JOIN profiles p ON p.id=f.requester_id
  WHERE f.addressee_id=auth.uid() AND f.status='pending';
$$;

CREATE OR REPLACE FUNCTION public.friend_request_count()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM friendships WHERE addressee_id=auth.uid() AND status='pending';
$$;

-- Anfrage senden: Gegenanfrage vorhanden → automatisch Freunde; früher abgelehnt → neu.
CREATE OR REPLACE FUNCTION public.send_friend_request(target uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF target=auth.uid() THEN RAISE EXCEPTION 'self'; END IF;
  UPDATE friendships SET status='accepted', updated_at=now()
   WHERE requester_id=target AND addressee_id=auth.uid() AND status='pending';
  IF FOUND THEN RETURN 'accepted'; END IF;
  INSERT INTO friendships (requester_id,addressee_id,status) VALUES (auth.uid(),target,'pending')
  ON CONFLICT (requester_id,addressee_id) DO UPDATE SET status='pending', updated_at=now()
    WHERE friendships.status='declined';
  RETURN 'pending';
END; $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(fid uuid, accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE friendships SET status=CASE WHEN accept THEN 'accepted' ELSE 'declined' END, updated_at=now()
   WHERE id=fid AND addressee_id=auth.uid() AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
END; $$;

-- Freund entfernen / Anfrage zurückziehen — löscht die Paar-Zeile (beidseitig).
CREATE OR REPLACE FUNCTION public.remove_friend(other uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM friendships WHERE auth.uid() IN (requester_id,addressee_id)
    AND other IN (requester_id,addressee_id);
$$;

-- Fortschritt eines Freundes (nur bei akzeptierter Freundschaft) — Form wie cloudLoad,
-- damit die vorhandene Fortschritt-Seite ihn 1:1 rendern kann.
CREATE OR REPLACE FUNCTION public.get_friend_progress(friend uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM friendships WHERE status='accepted'
      AND friend IN (requester_id,addressee_id) AND auth.uid() IN (requester_id,addressee_id))
  THEN RAISE EXCEPTION 'not friends'; END IF;
  SELECT jsonb_build_object(
    'playerName',p.player_name,'avatar',p.avatar,'highscore',p.highscore,
    'totalPoints',p.total_points,'uvFills',p.uv_fills,
    'decks',COALESCE((SELECT jsonb_object_agg(d.id::text, jsonb_build_object(
        'id',d.id,'name',d.name,'vocab',d.vocab,'categoryProgress',d.category_progress,
        'presetCategories',d.preset_categories,'deckPath',d.deck_path,'mode',d.mode,
        'wordStats',COALESCE((SELECT jsonb_object_agg(ws.stat_key,jsonb_build_object(
            'asked',ws.asked,'correct',ws.correct,'wrong',ws.wrong,'recent',ws.recent))
          FROM word_stats ws WHERE ws.deck_id=d.id),'{}'::jsonb)))
      FROM decks d WHERE d.user_id=friend),'{}'::jsonb),
    'globalPresetStats',jsonb_build_object('wordStats',COALESCE((SELECT jsonb_object_agg(ps.stat_key,
        jsonb_build_object('asked',ps.asked,'correct',ps.correct,'wrong',ps.wrong,'recent',ps.recent))
      FROM preset_stats ps WHERE ps.user_id=friend),'{}'::jsonb),'categoryProgress','{}'::jsonb),
    'probetests',COALESCE((SELECT jsonb_agg(jsonb_build_object('decks',pt.decks,'grade',pt.grade,
        'percent',pt.percent,'questions',pt.questions,'correct',pt.correct,'date',pt.taken_at)
        ORDER BY pt.taken_at DESC) FROM probetests pt WHERE pt.user_id=friend),'[]'::jsonb))
  INTO result FROM profiles p WHERE p.id=friend;
  RETURN result;
END; $$;