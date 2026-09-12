-- ==============================================================================
-- FITNESS PLATFORM (PHASE 1) - PROFILES RLS INSERT POLICY & RECOVERY MIGRATION
-- Migration: 20260912000002_fix_profiles_rls_and_backfill.sql
-- Fixes:
-- 1. Adds missing INSERT RLS policy on public.profiles for authenticated users (auth.uid() = id).
-- 2. Backfills missing profiles and initial streaks for existing auth users.
-- 3. Ensures food_diary_entries schema and RLS policies are active.
-- ==============================================================================

-- 1. PROFILES INSERT POLICY
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles FOR INSERT
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- 2. BACKFILL PROFILES FOR EXISTING AUTH USERS
INSERT INTO public.profiles (id, display_name, timezone, avatar_url)
SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Athlete'),
    COALESCE(u.raw_user_meta_data->>'timezone', 'Asia/Kolkata'),
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture', NULL)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. BACKFILL INITIAL STREAKS FOR EXISTING AUTH USERS
INSERT INTO public.streaks (user_id, current_streak, longest_streak)
SELECT
    u.id,
    0,
    0
FROM auth.users u
LEFT JOIN public.streaks s ON s.user_id = u.id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 4. ENSURE FOOD DIARY ENTRIES SCHEMA (IDEMPOTENT)
CREATE TABLE IF NOT EXISTS public.food_diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    logged_date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
    food_id UUID REFERENCES public.foods(id) ON DELETE SET NULL,
    custom_food_name TEXT,
    servings NUMERIC(4,2) NOT NULL CHECK (servings > 0),
    calories NUMERIC(6,1) NOT NULL CHECK (calories >= 0),
    protein_g NUMERIC(5,1) NOT NULL CHECK (protein_g >= 0),
    carbs_g NUMERIC(5,1) DEFAULT 0 NOT NULL CHECK (carbs_g >= 0),
    fat_g NUMERIC(5,1) DEFAULT 0 NOT NULL CHECK (fat_g >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_food_ref CHECK (food_id IS NOT NULL OR (custom_food_name IS NOT NULL AND length(trim(custom_food_name)) > 0))
);

ALTER TABLE public.food_diary_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'food_diary_entries' AND policyname = 'Users can view own diary entries'
  ) THEN
    CREATE POLICY "Users can view own diary entries"
      ON public.food_diary_entries FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'food_diary_entries' AND policyname = 'Users can insert own diary entries'
  ) THEN
    CREATE POLICY "Users can insert own diary entries"
      ON public.food_diary_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'food_diary_entries' AND policyname = 'Users can update own diary entries'
  ) THEN
    CREATE POLICY "Users can update own diary entries"
      ON public.food_diary_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'food_diary_entries' AND policyname = 'Users can delete own diary entries'
  ) THEN
    CREATE POLICY "Users can delete own diary entries"
      ON public.food_diary_entries FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_food_diary_user_date
    ON public.food_diary_entries(user_id, logged_date);
