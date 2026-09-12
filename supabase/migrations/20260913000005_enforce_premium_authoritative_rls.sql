-- ==============================================================================
-- FITSPHERE V1 - SERVER-AUTHORITATIVE PREMIUM RLS & MACHINE-READABLE SCHEMA
-- Migration: 20260913000005_enforce_premium_authoritative_rls.sql
-- ==============================================================================

-- 0. PREREQUISITES: PROFILES PLAN_TYPE & 7-DAY ROTATING SCHEDULE TABLES
-- Ensure public.profiles has plan_type column with default 'free'
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_plan_type'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT chk_profiles_plan_type
            CHECK (plan_type IN ('free', 'premium'));
    END IF;
END $$;

COMMENT ON COLUMN public.profiles.plan_type IS 'FitSphere tier: free or premium. Drives feature entitlements.';

-- Ensure 7-day rotating schedule tables exist
CREATE TABLE IF NOT EXISTS public.weekly_meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_calories INTEGER NOT NULL CHECK (target_calories > 0),
    target_protein_g NUMERIC(5,1) NOT NULL CHECK (target_protein_g > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

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

ALTER TABLE public.weekly_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_meal_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_meal_plan_items ENABLE ROW LEVEL SECURITY;

-- 1. SAFE AUTHORIZATION HELPER
-- SECURITY DEFINER with fixed search_path, zero client-supplied parameters
-- Checks caller's authoritative plan_type directly via auth.uid()
CREATE OR REPLACE FUNCTION public.is_current_user_premium()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND plan_type = 'premium'
    );
$$;

-- Restrict execution
REVOKE EXECUTE ON FUNCTION public.is_current_user_premium() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_premium() TO authenticated, anon;

COMMENT ON FUNCTION public.is_current_user_premium() IS 'Authoritative check whether the calling session user possesses active Premium entitlement.';

-- 2. SCHEMA ADDITIONS FOR MACHINE-READABLE ENFORCEMENT
-- Explicit machine-readable boundaries replace any string/name heuristics

-- 2A. meal_plans.plan_kind ('standard', 'budget', 'replacement_derived')
ALTER TABLE public.meal_plans
    ADD COLUMN IF NOT EXISTS plan_kind TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_meal_plans_plan_kind'
    ) THEN
        ALTER TABLE public.meal_plans
            ADD CONSTRAINT chk_meal_plans_plan_kind
            CHECK (plan_kind IN ('standard', 'budget', 'replacement_derived'));
    END IF;
END $$;

-- 2B. meal_plan_items.is_replacement
ALTER TABLE public.meal_plan_items
    ADD COLUMN IF NOT EXISTS is_replacement BOOLEAN NOT NULL DEFAULT FALSE;

-- 2C. notifications.notification_style ('basic', 'gentle', 'motivational', 'tough_love')
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS notification_style TEXT NOT NULL DEFAULT 'basic';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_notifications_style'
    ) THEN
        ALTER TABLE public.notifications
            ADD CONSTRAINT chk_notifications_style
            CHECK (notification_style IN ('basic', 'gentle', 'motivational', 'tough_love'));
    END IF;
END $$;

-- 3. ENFORCE PREMIUM ON 7-DAY ROTATING MEAL SCHEDULE (weekly_meal_plans*)
-- Free users cannot insert or update 7-day weekly meal plans or their child days/items

-- 3A. weekly_meal_plans
DROP POLICY IF EXISTS "Users can insert own weekly meal plans" ON public.weekly_meal_plans;
CREATE POLICY "Users can insert own weekly meal plans"
    ON public.weekly_meal_plans FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND public.is_current_user_premium()
    );

DROP POLICY IF EXISTS "Users can update own weekly meal plans" ON public.weekly_meal_plans;
CREATE POLICY "Users can update own weekly meal plans"
    ON public.weekly_meal_plans FOR UPDATE
    USING (
        auth.uid() = user_id
        AND public.is_current_user_premium()
    )
    WITH CHECK (
        auth.uid() = user_id
        AND public.is_current_user_premium()
    );

DROP POLICY IF EXISTS "Users can view own weekly meal plans" ON public.weekly_meal_plans;
CREATE POLICY "Users can view own weekly meal plans"
    ON public.weekly_meal_plans FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own weekly meal plans" ON public.weekly_meal_plans;
CREATE POLICY "Users can delete own weekly meal plans"
    ON public.weekly_meal_plans FOR DELETE
    USING (auth.uid() = user_id);

-- 3B. weekly_meal_plan_days (Indirect child)
DROP POLICY IF EXISTS "Users can insert own weekly meal plan days" ON public.weekly_meal_plan_days;
CREATE POLICY "Users can insert own weekly meal plan days"
    ON public.weekly_meal_plan_days FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.weekly_meal_plans wmp
            WHERE wmp.id = weekly_meal_plan_days.weekly_meal_plan_id
              AND wmp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    );

DROP POLICY IF EXISTS "Users can update own weekly meal plan days" ON public.weekly_meal_plan_days;
CREATE POLICY "Users can update own weekly meal plan days"
    ON public.weekly_meal_plan_days FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.weekly_meal_plans wmp
            WHERE wmp.id = weekly_meal_plan_days.weekly_meal_plan_id
              AND wmp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.weekly_meal_plans wmp
            WHERE wmp.id = weekly_meal_plan_days.weekly_meal_plan_id
              AND wmp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    );

-- 3C. weekly_meal_plan_items (Indirect child)
DROP POLICY IF EXISTS "Users can insert own weekly meal plan items" ON public.weekly_meal_plan_items;
CREATE POLICY "Users can insert own weekly meal plan items"
    ON public.weekly_meal_plan_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.weekly_meal_plan_days wmpd
            JOIN public.weekly_meal_plans wmp ON wmp.id = wmpd.weekly_meal_plan_id
            WHERE wmpd.id = weekly_meal_plan_items.weekly_meal_plan_day_id
              AND wmp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    );

DROP POLICY IF EXISTS "Users can update own weekly meal plan items" ON public.weekly_meal_plan_items;
CREATE POLICY "Users can update own weekly meal plan items"
    ON public.weekly_meal_plan_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.weekly_meal_plan_days wmpd
            JOIN public.weekly_meal_plans wmp ON wmp.id = wmpd.weekly_meal_plan_id
            WHERE wmpd.id = weekly_meal_plan_items.weekly_meal_plan_day_id
              AND wmp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.weekly_meal_plan_days wmpd
            JOIN public.weekly_meal_plans wmp ON wmp.id = wmpd.weekly_meal_plan_id
            WHERE wmpd.id = weekly_meal_plan_items.weekly_meal_plan_day_id
              AND wmp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    );

-- 4. ENFORCE PREMIUM ON MEAL_PLANS (Machine-Readable plan_kind)
-- Completely eliminates name/string matching.
-- Standard meal plans (plan_kind = 'standard') are open to all users.
-- Budget plans (plan_kind = 'budget') and replacement-derived plans (plan_kind = 'replacement_derived') require Premium.
DROP POLICY IF EXISTS "Users can manage own meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can insert own meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can update own meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can view own meal plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can delete own meal plans" ON public.meal_plans;

CREATE POLICY "Users can view own meal plans"
    ON public.meal_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal plans"
    ON public.meal_plans FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            plan_kind = 'standard'
            OR public.is_current_user_premium()
        )
    );

CREATE POLICY "Users can update own meal plans"
    ON public.meal_plans FOR UPDATE
    USING (
        auth.uid() = user_id
        AND (
            plan_kind = 'standard'
            OR public.is_current_user_premium()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND (
            plan_kind = 'standard'
            OR public.is_current_user_premium()
        )
    );

CREATE POLICY "Users can delete own meal plans"
    ON public.meal_plans FOR DELETE
    USING (auth.uid() = user_id);

-- 5. ENFORCE PREMIUM ON MEAL_PLAN_ITEMS (Item Mutations & Replacements)
-- Direct PATCH/UPDATE of meal_plan_items is restricted to Premium users.
-- Direct DELETE of individual items is restricted to Premium users (plan deletion cascades automatically).
-- INSERT of new items into a standard plan is open to Free users; replacement items require Premium.
DROP POLICY IF EXISTS "Users can manage own meal plan items" ON public.meal_plan_items;
DROP POLICY IF EXISTS "Users can view own meal plan items" ON public.meal_plan_items;
DROP POLICY IF EXISTS "Users can insert own meal plan items" ON public.meal_plan_items;
DROP POLICY IF EXISTS "Users can update own meal plan items" ON public.meal_plan_items;
DROP POLICY IF EXISTS "Users can delete own meal plan items" ON public.meal_plan_items;

CREATE POLICY "Users can view own meal plan items"
    ON public.meal_plan_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.meal_plans mp
            WHERE mp.id = meal_plan_items.meal_plan_id
              AND mp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own meal plan items"
    ON public.meal_plan_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.meal_plans mp
            WHERE mp.id = meal_plan_items.meal_plan_id
              AND mp.user_id = auth.uid()
              AND (
                  (mp.plan_kind = 'standard' AND meal_plan_items.is_replacement = FALSE)
                  OR public.is_current_user_premium()
              )
        )
    );

CREATE POLICY "Users can update own meal plan items"
    ON public.meal_plan_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.meal_plans mp
            WHERE mp.id = meal_plan_items.meal_plan_id
              AND mp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.meal_plans mp
            WHERE mp.id = meal_plan_items.meal_plan_id
              AND mp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    );

CREATE POLICY "Users can delete own meal plan items"
    ON public.meal_plan_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.meal_plans mp
            WHERE mp.id = meal_plan_items.meal_plan_id
              AND mp.user_id = auth.uid()
        )
        AND public.is_current_user_premium()
    );

-- Dedicated Secure RPC for Premium Meal Item Replacement
CREATE OR REPLACE FUNCTION public.replace_meal_plan_item(
    p_item_id UUID,
    p_new_food_id UUID,
    p_servings NUMERIC,
    p_calculated_calories NUMERIC,
    p_calculated_protein_g NUMERIC
)
RETURNS public.meal_plan_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_plan_id UUID;
    v_updated_row public.meal_plan_items;
BEGIN
    -- Authoritative entitlement check
    IF NOT public.is_current_user_premium() THEN
        RAISE EXCEPTION 'PREMIUM_REQUIRED: Meal replacement requires an active Premium plan.';
    END IF;

    -- Verify ownership via parent plan and session auth.uid()
    SELECT mpi.meal_plan_id INTO v_plan_id
    FROM public.meal_plan_items mpi
    JOIN public.meal_plans mp ON mp.id = mpi.meal_plan_id
    WHERE mpi.id = p_item_id
      AND mp.user_id = auth.uid();

    IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND_OR_FORBIDDEN: Target meal item not found or not owned by session.';
    END IF;

    -- Perform replacement mutation
    UPDATE public.meal_plan_items
    SET food_id = p_new_food_id,
        servings = p_servings,
        calculated_calories = p_calculated_calories,
        calculated_protein_g = p_calculated_protein_g,
        is_replacement = TRUE
    WHERE id = p_item_id
    RETURNING * INTO v_updated_row;

    -- Mark parent meal plan as replacement-derived
    UPDATE public.meal_plans
    SET plan_kind = 'replacement_derived'
    WHERE id = v_plan_id;

    RETURN v_updated_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_meal_plan_item FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_meal_plan_item TO authenticated, anon;

-- 6. ENFORCE PREMIUM ON NOTIFICATIONS (Machine-Readable notification_style)
-- Standard reminders ('basic') are open to all users.
-- Premium motivational and tough-love alarm styles require active Premium subscription.
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            notification_style = 'basic'
            OR public.is_current_user_premium()
        )
    );

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (
        auth.uid() = user_id
        AND (
            notification_style = 'basic'
            OR public.is_current_user_premium()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND (
            notification_style = 'basic'
            OR public.is_current_user_premium()
        )
    );

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);
