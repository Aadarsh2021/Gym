-- ==============================================================================
-- FITNESS PLATFORM (PHASE 1) - FOOD DIARY ENTRIES SCHEMA
-- Migration: 20260912000001_create_food_diary_entries.sql
-- Enables daily meal tracking, macro aggregation, and Target vs Consumed auditing
-- ==============================================================================

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

-- Enable Row Level Security (RLS)
ALTER TABLE public.food_diary_entries ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: Users can only read their own logged diary entries
CREATE POLICY "Users can view own diary entries"
    ON public.food_diary_entries
    FOR SELECT
    USING (auth.uid() = user_id);

-- 2. INSERT Policy: Users can only insert entries for their own user_id
CREATE POLICY "Users can insert own diary entries"
    ON public.food_diary_entries
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE Policy: Users can only update their own entries
CREATE POLICY "Users can update own diary entries"
    ON public.food_diary_entries
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. DELETE Policy: Users can only delete their own entries
CREATE POLICY "Users can delete own diary entries"
    ON public.food_diary_entries
    FOR DELETE
    USING (auth.uid() = user_id);

-- Composite Index for fast daily querying and aggregation
CREATE INDEX IF NOT EXISTS idx_food_diary_user_date
    ON public.food_diary_entries(user_id, logged_date);
