-- ==============================================================================
-- FITSPHERE V1 - 7-DAY ROTATING MEAL SCHEDULE SCHEMA
-- Migration: 20260913000003_create_weekly_meal_plans.sql
-- Enables multi-day weekly meal plans, daily macro targets, and meal breakdowns
-- ==============================================================================

-- 1. Weekly Meal Plans table
CREATE TABLE IF NOT EXISTS public.weekly_meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_calories INTEGER NOT NULL CHECK (target_calories > 0),
    target_protein_g NUMERIC(5,1) NOT NULL CHECK (target_protein_g > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Weekly Meal Plan Days table (Monday to Sunday)
CREATE TABLE IF NOT EXISTS public.weekly_meal_plan_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weekly_meal_plan_id UUID NOT NULL REFERENCES public.weekly_meal_plans(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
    day_name TEXT NOT NULL,
    target_calories INTEGER NOT NULL CHECK (target_calories > 0),
    target_protein_g NUMERIC(5,1) NOT NULL CHECK (target_protein_g > 0),
    total_calories INTEGER NOT NULL DEFAULT 0,
    total_protein_g NUMERIC(5,1) NOT NULL DEFAULT 0,
    total_carbs_g NUMERIC(5,1) NOT NULL DEFAULT 0,
    total_fat_g NUMERIC(5,1) NOT NULL DEFAULT 0,
    CONSTRAINT uq_weekly_meal_plan_day UNIQUE (weekly_meal_plan_id, day_of_week)
);

-- 3. Weekly Meal Plan Items table
CREATE TABLE IF NOT EXISTS public.weekly_meal_plan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weekly_meal_plan_day_id UUID NOT NULL REFERENCES public.weekly_meal_plan_days(id) ON DELETE CASCADE,
    food_id TEXT NOT NULL,
    food_name TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
    servings NUMERIC(4,2) NOT NULL CHECK (servings > 0),
    calculated_calories INTEGER NOT NULL CHECK (calculated_calories >= 0),
    calculated_protein_g NUMERIC(5,1) NOT NULL CHECK (calculated_protein_g >= 0),
    calculated_carbs_g NUMERIC(5,1) NOT NULL DEFAULT 0,
    calculated_fat_g NUMERIC(5,1) NOT NULL DEFAULT 0
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.weekly_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_meal_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_meal_plan_items ENABLE ROW LEVEL SECURITY;

-- Policies for weekly_meal_plans
CREATE POLICY "Users can view own weekly meal plans"
    ON public.weekly_meal_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly meal plans"
    ON public.weekly_meal_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly meal plans"
    ON public.weekly_meal_plans FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly meal plans"
    ON public.weekly_meal_plans FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for weekly_meal_plan_days
CREATE POLICY "Users can view own weekly meal plan days"
    ON public.weekly_meal_plan_days FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.weekly_meal_plans wmp
        WHERE wmp.id = weekly_meal_plan_days.weekly_meal_plan_id
        AND wmp.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own weekly meal plan days"
    ON public.weekly_meal_plan_days FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.weekly_meal_plans wmp
        WHERE wmp.id = weekly_meal_plan_days.weekly_meal_plan_id
        AND wmp.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own weekly meal plan days"
    ON public.weekly_meal_plan_days FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.weekly_meal_plans wmp
        WHERE wmp.id = weekly_meal_plan_days.weekly_meal_plan_id
        AND wmp.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.weekly_meal_plans wmp
        WHERE wmp.id = weekly_meal_plan_days.weekly_meal_plan_id
        AND wmp.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own weekly meal plan days"
    ON public.weekly_meal_plan_days FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.weekly_meal_plans wmp
        WHERE wmp.id = weekly_meal_plan_days.weekly_meal_plan_id
        AND wmp.user_id = auth.uid()
    ));

-- Policies for weekly_meal_plan_items
CREATE POLICY "Users can view own weekly meal plan items"
    ON public.weekly_meal_plan_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.weekly_meal_plan_days wmpd
        JOIN public.weekly_meal_plans wmp ON wmp.id = wmpd.weekly_meal_plan_id
        WHERE wmpd.id = weekly_meal_plan_items.weekly_meal_plan_day_id
        AND wmp.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own weekly meal plan items"
    ON public.weekly_meal_plan_items FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.weekly_meal_plan_days wmpd
        JOIN public.weekly_meal_plans wmp ON wmp.id = wmpd.weekly_meal_plan_id
        WHERE wmpd.id = weekly_meal_plan_items.weekly_meal_plan_day_id
        AND wmp.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own weekly meal plan items"
    ON public.weekly_meal_plan_items FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.weekly_meal_plan_days wmpd
        JOIN public.weekly_meal_plans wmp ON wmp.id = wmpd.weekly_meal_plan_id
        WHERE wmpd.id = weekly_meal_plan_items.weekly_meal_plan_day_id
        AND wmp.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.weekly_meal_plan_days wmpd
        JOIN public.weekly_meal_plans wmp ON wmp.id = wmpd.weekly_meal_plan_id
        WHERE wmpd.id = weekly_meal_plan_items.weekly_meal_plan_day_id
        AND wmp.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own weekly meal plan items"
    ON public.weekly_meal_plan_items FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.weekly_meal_plan_days wmpd
        JOIN public.weekly_meal_plans wmp ON wmp.id = wmpd.weekly_meal_plan_id
        WHERE wmpd.id = weekly_meal_plan_items.weekly_meal_plan_day_id
        AND wmp.user_id = auth.uid()
    ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plans_user ON public.weekly_meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_days_plan ON public.weekly_meal_plan_days(weekly_meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_items_day ON public.weekly_meal_plan_items(weekly_meal_plan_day_id);
