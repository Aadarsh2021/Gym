-- ==============================================================================
-- FITSPHERE V1 - CORE EXERCISE STREAK ENFORCEMENT & GYM ATTENDANCE
-- Migration: 20260913000004_enforce_core_exercise_streak.sql
-- Enforces that core/necessary exercises must have at least one completed set
-- for streak continuity and awards gym attendance audit records.
-- ==============================================================================

-- Add gym_verified column to workout_sessions if not exists
ALTER TABLE public.workout_sessions
ADD COLUMN IF NOT EXISTS gym_verified BOOLEAN DEFAULT FALSE;

-- Replace complete_workout_session with core completion parameter and streak check
CREATE OR REPLACE FUNCTION public.complete_workout_session(
    p_session_id UUID,
    p_idempotency_key TEXT,
    p_session_rating TEXT,
    p_notes TEXT,
    p_is_core_completed BOOLEAN DEFAULT TRUE,
    p_gym_verified BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_session RECORD;
    v_tz TEXT := 'Asia/Kolkata';
    v_today DATE;
    v_yesterday DATE;
    v_streak RECORD;
    v_new_streak INT := 1;
    v_streak_counted BOOLEAN := FALSE;
    v_coins_earned INT := 0;
    v_new_prs JSONB := '[]'::JSONB;
    v_pr RECORD;
    v_set RECORD;
    v_1rm NUMERIC(6,2);
BEGIN
    -- Step 1: Authentication Check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Step 2: Session Ownership & Row Lock
    SELECT * INTO v_session
    FROM public.workout_sessions
    WHERE id = p_session_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workout session not found or unauthorized' USING ERRCODE = '40400';
    END IF;

    -- Step 3: Database Idempotency Check
    IF v_session.status = 'completed' AND v_session.idempotency_key = p_idempotency_key THEN
        SELECT current_streak INTO v_new_streak FROM public.streaks WHERE user_id = v_user_id;
        RETURN jsonb_build_object(
            'status', 'already_completed',
            'session_id', v_session.id,
            'completed_at', v_session.completed_at,
            'streak_count', COALESCE(v_new_streak, 0),
            'streak_counted', FALSE
        );
    ELSIF v_session.status = 'completed' THEN
        RAISE EXCEPTION 'Workout session was already finalized with a different key' USING ERRCODE = '40900';
    END IF;

    -- Step 4: Finalize Session Record
    UPDATE public.workout_sessions
    SET status = 'completed',
        completed_at = NOW(),
        idempotency_key = p_idempotency_key,
        session_rating = p_session_rating,
        notes = p_notes,
        gym_verified = COALESCE(p_gym_verified, FALSE),
        updated_at = NOW()
    WHERE id = p_session_id;

    -- Step 5: Authoritative PR Calculations from workout_sets
    FOR v_set IN
        SELECT wse.exercise_id, ws.weight_kg, ws.reps
        FROM public.workout_sets ws
        JOIN public.workout_session_exercises wse ON wse.id = ws.session_exercise_id
        WHERE wse.session_id = p_session_id AND ws.completed = TRUE AND ws.weight_kg > 0 AND ws.reps > 0
    LOOP
        v_1rm := ROUND(v_set.weight_kg * (1.0 + (v_set.reps::NUMERIC / 30.0)), 2);

        SELECT * INTO v_pr
        FROM public.personal_records
        WHERE user_id = v_user_id AND exercise_id = v_set.exercise_id;

        IF NOT FOUND THEN
            INSERT INTO public.personal_records (user_id, exercise_id, weight_kg, reps, estimated_one_rep_max, session_id)
            VALUES (v_user_id, v_set.exercise_id, v_set.weight_kg, v_set.reps, v_1rm, p_session_id);

            v_new_prs := v_new_prs || jsonb_build_object(
                'exercise_id', v_set.exercise_id,
                'weight_kg', v_set.weight_kg,
                'reps', v_set.reps,
                'estimated_1rm', v_1rm
            );
        ELSIF v_1rm > v_pr.estimated_one_rep_max OR (v_1rm = v_pr.estimated_one_rep_max AND v_set.weight_kg > v_pr.weight_kg) THEN
            UPDATE public.personal_records
            SET weight_kg = v_set.weight_kg,
                reps = v_set.reps,
                estimated_one_rep_max = v_1rm,
                achieved_at = NOW(),
                session_id = p_session_id
            WHERE user_id = v_user_id AND exercise_id = v_set.exercise_id;

            v_new_prs := v_new_prs || jsonb_build_object(
                'exercise_id', v_set.exercise_id,
                'weight_kg', v_set.weight_kg,
                'reps', v_set.reps,
                'estimated_1rm', v_1rm
            );
        END IF;
    END LOOP;

    -- Step 6: Core Exercise Streak Eligibility
    -- Streaks only advance if core/necessary exercises were completed
    IF p_is_core_completed IS TRUE THEN
        SELECT timezone INTO v_tz FROM public.profiles WHERE id = v_user_id;
        IF v_tz IS NULL OR v_tz = '' THEN
            v_tz := 'Asia/Kolkata';
        END IF;

        v_today := (NOW() AT TIME ZONE v_tz)::DATE;
        v_yesterday := v_today - INTERVAL '1 day';

        -- Audit event entry
        INSERT INTO public.streak_events (user_id, event_date, event_type, session_id)
        VALUES (v_user_id, v_today, 'workout_completed', p_session_id)
        ON CONFLICT (user_id, event_date, event_type) DO NOTHING;

        -- Update Streaks Table
        SELECT * INTO v_streak FROM public.streaks WHERE user_id = v_user_id FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_activity_date)
            VALUES (v_user_id, 1, 1, v_today);
            v_new_streak := 1;
            v_streak_counted := TRUE;
        ELSE
            IF v_streak.last_activity_date = v_today THEN
                v_new_streak := v_streak.current_streak;
                v_streak_counted := TRUE;
            ELSIF v_streak.last_activity_date = v_yesterday THEN
                v_new_streak := v_streak.current_streak + 1;
                UPDATE public.streaks
                SET current_streak = v_new_streak,
                    longest_streak = GREATEST(longest_streak, v_new_streak),
                    last_activity_date = v_today,
                    updated_at = NOW()
                WHERE user_id = v_user_id;
                v_streak_counted := TRUE;
            ELSE
                v_new_streak := 1;
                UPDATE public.streaks
                SET current_streak = 1,
                    longest_streak = GREATEST(longest_streak, 1),
                    last_activity_date = v_today,
                    updated_at = NOW()
                WHERE user_id = v_user_id;
                v_streak_counted := TRUE;
            END IF;
        END IF;
    ELSE
        -- Core exercise not completed: streak is preserved as-is without incrementing
        SELECT current_streak INTO v_new_streak FROM public.streaks WHERE user_id = v_user_id;
        v_new_streak := COALESCE(v_new_streak, 0);
        v_streak_counted := FALSE;
    END IF;

    -- Step 7: Milestone Rewards & Coins
    IF v_new_streak >= 7 AND v_streak_counted THEN
        INSERT INTO public.achievements (user_id, achievement_type)
        VALUES (v_user_id, 'streak_7_days')
        ON CONFLICT (user_id, achievement_type) DO NOTHING;

        INSERT INTO public.fitness_coins (user_id, amount, source, reference_id)
        VALUES (v_user_id, 100, 'achievement', 'streak_7_days')
        ON CONFLICT (user_id, source, reference_id) DO NOTHING;

        IF FOUND THEN
            v_coins_earned := v_coins_earned + 100;
        END IF;
    END IF;

    -- Completion reward coins
    INSERT INTO public.fitness_coins (user_id, amount, source, reference_id)
    VALUES (v_user_id, 10, 'workout_completed', p_session_id::TEXT)
    ON CONFLICT (user_id, source, reference_id) DO NOTHING;

    IF FOUND THEN
        v_coins_earned := v_coins_earned + 10;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'session_id', p_session_id,
        'completed_at', NOW(),
        'streak_count', v_new_streak,
        'streak_counted', v_streak_counted,
        'core_completed', p_is_core_completed,
        'gym_verified', COALESCE(p_gym_verified, FALSE),
        'new_prs', v_new_prs,
        'coins_earned', v_coins_earned
    );
END;
$$;
