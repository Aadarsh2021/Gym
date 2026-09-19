-- ==============================================================================
-- FITSPHERE V1 - DAILY MISSIONS & RETENTION ENGINE
-- Migration: 20260919000002_daily_missions.sql
-- Implements context-aware daily mission assignment, authoritative PostgreSQL
-- verification, 12-hour grace period claiming, and 15 Fitness Coin rewards.
-- ==============================================================================

-- 1. Create public.daily_missions table
CREATE TABLE IF NOT EXISTS public.daily_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mission_date DATE NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    mission_type TEXT NOT NULL CHECK (
        mission_type IN (
            'complete_workout',
            'hit_protein',
            'maintain_streak'
        )
    ),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_value NUMERIC,
    coin_reward INT NOT NULL DEFAULT 15,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_missions_user_date UNIQUE(user_id, mission_date)
);

-- 2. Enable Row Level Security
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Authenticated owner SELECT only.
-- Direct client INSERT/UPDATE/DELETE is strictly forbidden; mutations only via SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "Users can view own daily missions" ON public.daily_missions;
CREATE POLICY "Users can view own daily missions"
    ON public.daily_missions FOR SELECT
    USING (user_id = auth.uid());

-- 4. Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date
    ON public.daily_missions(user_id, mission_date DESC);

-- 5. RPC: get_or_create_daily_mission()
-- Context-aware, deterministic daily mission assignment and progress inspection.
CREATE OR REPLACE FUNCTION public.get_or_create_daily_mission()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_tz TEXT := 'Asia/Kolkata';
    v_now_local TIMESTAMP;
    v_today_date DATE;
    v_mission RECORD;
    v_plan RECORD;
    v_total_days INT := 0;
    v_dow INT;
    v_is_training_day BOOLEAN := FALSE;
    v_is_rest_day BOOLEAN := FALSE;
    v_is_no_plan BOOLEAN := FALSE;
    v_nutr RECORD;
    v_has_nutrition BOOLEAN := FALSE;
    v_hash INT;
    v_type TEXT;
    v_title TEXT;
    v_desc TEXT;
    v_target NUMERIC := 1;
    v_progress NUMERIC := 0;
    v_is_claimable BOOLEAN := FALSE;
    v_is_expired BOOLEAN := FALSE;
    v_consumed_protein NUMERIC := 0;
BEGIN
    -- 1. Authentication Check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Authoritative Timezone & Local Date Derivation
    SELECT timezone INTO v_tz FROM public.profiles WHERE id = v_user_id;
    IF v_tz IS NULL OR v_tz = '' THEN
        v_tz := 'Asia/Kolkata';
    END IF;

    v_now_local := (NOW() AT TIME ZONE v_tz);
    v_today_date := v_now_local::DATE;

    -- 3. Check for existing assigned mission today
    SELECT * INTO v_mission
    FROM public.daily_missions
    WHERE user_id = v_user_id AND mission_date = v_today_date;

    IF NOT FOUND THEN
        -- Context Evaluation: Plan / Training vs Rest Day
        SELECT * INTO v_plan
        FROM public.workout_plans
        WHERE user_id = v_user_id AND is_active = TRUE
        LIMIT 1;

        IF FOUND THEN
            SELECT COUNT(*) INTO v_total_days
            FROM public.workout_plan_days
            WHERE plan_id = v_plan.id;

            IF v_total_days > 0 THEN
                v_dow := EXTRACT(DOW FROM v_today_date)::INT; -- 0=Sun, 1=Mon, ..., 6=Sat
                IF v_total_days = 1 AND v_dow IN (1, 3, 5) THEN
                    v_is_training_day := TRUE;
                ELSIF v_total_days = 2 AND v_dow IN (1, 4) THEN
                    v_is_training_day := TRUE;
                ELSIF v_total_days = 3 AND v_dow IN (1, 3, 5) THEN
                    v_is_training_day := TRUE;
                ELSIF v_total_days = 4 AND v_dow IN (1, 2, 4, 5) THEN
                    v_is_training_day := TRUE;
                ELSIF v_total_days = 5 AND v_dow IN (1, 2, 3, 5, 6) THEN
                    v_is_training_day := TRUE;
                ELSIF v_total_days >= 6 AND v_dow IN (1, 2, 3, 4, 5, 6) THEN
                    v_is_training_day := TRUE;
                ELSE
                    v_is_rest_day := TRUE;
                END IF;
            ELSE
                v_is_no_plan := TRUE;
            END IF;
        ELSE
            v_is_no_plan := TRUE;
        END IF;

        -- Check if user explicitly logged a rest day for today
        IF EXISTS (
            SELECT 1 FROM public.streak_events
            WHERE user_id = v_user_id AND event_date = v_today_date AND event_type = 'rest_day'
        ) THEN
            v_is_training_day := FALSE;
            v_is_rest_day := TRUE;
        END IF;

        -- Context Evaluation: Nutrition Profile Check
        SELECT * INTO v_nutr
        FROM public.nutrition_profiles
        WHERE user_id = v_user_id
        LIMIT 1;

        IF FOUND AND v_nutr.target_protein_g IS NOT NULL AND v_nutr.target_protein_g > 0 THEN
            v_has_nutrition := TRUE;
        END IF;

        -- Deterministic Branching Hash based on user_id + mission_date
        v_hash := abs(('x' || substr(md5(v_user_id::TEXT || ':' || v_today_date::TEXT), 1, 8))::bit(32)::INT) % 100;

        -- Context Branching Decision Matrix
        IF v_is_training_day THEN
            IF v_has_nutrition THEN
                IF v_hash < 60 THEN
                    v_type := 'complete_workout';
                ELSE
                    v_type := 'hit_protein';
                END IF;
            ELSE
                v_type := 'complete_workout';
            END IF;
        ELSIF v_is_rest_day THEN
            -- Rest day: NEVER complete_workout
            IF v_has_nutrition THEN
                IF v_hash < 50 THEN
                    v_type := 'maintain_streak';
                ELSE
                    v_type := 'hit_protein';
                END IF;
            ELSE
                v_type := 'maintain_streak';
            END IF;
        ELSE
            -- No plan / freestyle
            IF v_has_nutrition THEN
                IF v_hash < 50 THEN
                    v_type := 'complete_workout';
                ELSE
                    v_type := 'maintain_streak';
                END IF;
            ELSE
                v_type := 'maintain_streak';
            END IF;
        END IF;

        -- Configure Mission Titles and Targets
        IF v_type = 'complete_workout' THEN
            v_title := 'Complete Daily Workout';
            v_desc := 'Log and complete a full training session today.';
            v_target := 1;
        ELSIF v_type = 'hit_protein' THEN
            v_title := 'Hit Daily Protein Target';
            v_desc := 'Log at least ' || v_nutr.target_protein_g || 'g of protein in your food diary today.';
            v_target := v_nutr.target_protein_g;
        ELSE -- maintain_streak
            v_title := 'Maintain Consistency Streak';
            v_desc := 'Keep your streak alive today by completing a workout or logging a rest day.';
            v_target := 1;
        END IF;

        -- Persist Immutable Mission Row with ON CONFLICT Protection
        INSERT INTO public.daily_missions (
            user_id,
            mission_date,
            timezone,
            mission_type,
            title,
            description,
            target_value,
            coin_reward
        )
        VALUES (
            v_user_id,
            v_today_date,
            v_tz,
            v_type,
            v_title,
            v_desc,
            v_target,
            15
        )
        ON CONFLICT (user_id, mission_date) DO NOTHING;

        -- Re-select assigned mission
        SELECT * INTO v_mission
        FROM public.daily_missions
        WHERE user_id = v_user_id AND mission_date = v_today_date;
    END IF;

    -- Evaluate Current Proof Progress on mission_date
    IF v_mission.mission_type = 'complete_workout' THEN
        SELECT COUNT(*) INTO v_progress
        FROM public.workout_sessions s
        WHERE s.user_id = v_user_id
          AND s.status = 'completed'
          AND (s.completed_at AT TIME ZONE v_mission.timezone)::DATE = v_mission.mission_date;
    ELSIF v_mission.mission_type = 'hit_protein' THEN
        SELECT COALESCE(SUM(protein_g), 0) INTO v_consumed_protein
        FROM public.food_diary_entries
        WHERE user_id = v_user_id AND logged_date = v_mission.mission_date;
        v_progress := v_consumed_protein;
    ELSIF v_mission.mission_type = 'maintain_streak' THEN
        SELECT COUNT(*) INTO v_progress
        FROM public.streak_events
        WHERE user_id = v_user_id AND event_date = v_mission.mission_date;
    END IF;

    -- Evaluate Expiry and Claimability (Grace period: until D+1 12:00 local time)
    v_is_claimable := (v_progress >= v_mission.target_value AND NOT v_mission.is_completed);

    IF (NOW() AT TIME ZONE v_mission.timezone) >= ((v_mission.mission_date + INTERVAL '1 day')::DATE + TIME '12:00:00') THEN
        v_is_expired := TRUE;
        v_is_claimable := FALSE;
    END IF;

    RETURN jsonb_build_object(
        'id', v_mission.id,
        'user_id', v_mission.user_id,
        'mission_date', v_mission.mission_date,
        'timezone', v_mission.timezone,
        'mission_type', v_mission.mission_type,
        'title', v_mission.title,
        'description', v_mission.description,
        'target_value', v_mission.target_value,
        'coin_reward', v_mission.coin_reward,
        'is_completed', v_mission.is_completed,
        'completed_at', v_mission.completed_at,
        'progress_value', v_progress,
        'is_claimable', v_is_claimable,
        'is_expired', v_is_expired,
        'created_at', v_mission.created_at
    );
END;
$$;

-- 6. RPC: claim_daily_mission(p_idempotency_key TEXT, p_mission_id UUID)
-- Atomic reward verification transaction with authoritative proof check,
-- 12-hour grace period verification, and idempotent 15 Fitness Coin reward.
CREATE OR REPLACE FUNCTION public.claim_daily_mission(
    p_idempotency_key TEXT,
    p_mission_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_tz TEXT := 'Asia/Kolkata';
    v_now_local TIMESTAMP;
    v_today_date DATE;
    v_mission RECORD;
    v_consumed_protein NUMERIC := 0;
    v_proof_valid BOOLEAN := FALSE;
    v_coins_awarded INT := 0;
BEGIN
    -- Step 1: Authentication Check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Step 2: Determine local time and date
    SELECT timezone INTO v_tz FROM public.profiles WHERE id = v_user_id;
    IF v_tz IS NULL OR v_tz = '' THEN
        v_tz := 'Asia/Kolkata';
    END IF;

    v_now_local := (NOW() AT TIME ZONE v_tz);
    v_today_date := v_now_local::DATE;

    -- Step 3: Locate Eligible Mission with Row Lock (FOR UPDATE)
    IF p_mission_id IS NOT NULL THEN
        SELECT * INTO v_mission
        FROM public.daily_missions
        WHERE id = p_mission_id AND user_id = v_user_id
        FOR UPDATE;
    ELSE
        -- Find latest eligible mission (today or yesterday within grace period)
        SELECT * INTO v_mission
        FROM public.daily_missions
        WHERE user_id = v_user_id
          AND (
              mission_date = v_today_date
              OR (
                  mission_date = (v_today_date - INTERVAL '1 day')::DATE
                  AND (NOW() AT TIME ZONE timezone) < ((mission_date + INTERVAL '1 day')::DATE + TIME '12:00:00')
              )
          )
        ORDER BY mission_date DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No eligible daily mission found' USING ERRCODE = '40400';
    END IF;

    -- Step 4: Idempotency Check
    IF v_mission.is_completed = TRUE AND v_mission.idempotency_key = p_idempotency_key THEN
        RETURN jsonb_build_object(
            'status', 'already_claimed',
            'mission_id', v_mission.id,
            'mission_type', v_mission.mission_type,
            'completed_at', v_mission.completed_at,
            'coins_awarded', 0
        );
    ELSIF v_mission.is_completed = TRUE THEN
        RAISE EXCEPTION 'Daily mission has already been claimed' USING ERRCODE = '40900';
    END IF;

    -- Step 5: Expiry & Grace Period Enforcement
    -- A mission belongs to mission_date D.
    -- If achieved during D, it may be claimed until D+1 12:00 local time (established at assignment).
    IF (NOW() AT TIME ZONE v_mission.timezone) >= ((v_mission.mission_date + INTERVAL '1 day')::DATE + TIME '12:00:00') THEN
        RAISE EXCEPTION 'Daily mission has expired and cannot be claimed' USING ERRCODE = '40300';
    END IF;

    -- Step 6: Server-Authoritative Proof Verification on mission_date
    IF v_mission.mission_type = 'complete_workout' THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.workout_sessions s
            WHERE s.user_id = v_user_id
              AND s.status = 'completed'
              AND (s.completed_at AT TIME ZONE v_mission.timezone)::DATE = v_mission.mission_date
        ) INTO v_proof_valid;

    ELSIF v_mission.mission_type = 'hit_protein' THEN
        SELECT COALESCE(SUM(protein_g), 0) INTO v_consumed_protein
        FROM public.food_diary_entries
        WHERE user_id = v_user_id AND logged_date = v_mission.mission_date;

        v_proof_valid := (v_consumed_protein >= v_mission.target_value);

    ELSIF v_mission.mission_type = 'maintain_streak' THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.streak_events
            WHERE user_id = v_user_id AND event_date = v_mission.mission_date
        ) INTO v_proof_valid;
    END IF;

    IF NOT v_proof_valid THEN
        RAISE EXCEPTION 'Authoritative proof not satisfied for daily mission on date %', v_mission.mission_date
            USING ERRCODE = '40001';
    END IF;

    -- Step 7: Mark Mission Completed
    UPDATE public.daily_missions
    SET is_completed = TRUE,
        completed_at = NOW(),
        idempotency_key = p_idempotency_key
    WHERE id = v_mission.id;

    -- Step 8: Award Exactly 15 Fitness Coins (Append-Only Ledger)
    INSERT INTO public.fitness_coins (
        user_id,
        amount,
        source,
        reference_id
    )
    VALUES (
        v_user_id,
        15,
        'daily_mission',
        v_mission.id::TEXT
    )
    ON CONFLICT (user_id, source, reference_id) DO NOTHING;

    IF FOUND THEN
        v_coins_awarded := 15;
    END IF;

    -- Step 9: Return Authoritative Result
    RETURN jsonb_build_object(
        'status', 'success',
        'mission_id', v_mission.id,
        'mission_date', v_mission.mission_date,
        'mission_type', v_mission.mission_type,
        'coins_awarded', v_coins_awarded,
        'completed_at', NOW()
    );
END;
$$;
