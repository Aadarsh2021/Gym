-- ==============================================================================
-- FITSPHERE V1 - WORKOUT QUALITY SCORE (AUTHORITATIVE ENGINE)
-- Migration: 20260919000003_workout_quality_score.sql
-- Adds quality_score column to workout_sessions and implements authoritative
-- Candidate C scoring formula in complete_workout_session RPC with server-verified
-- core completion and anti-tampering guards.
-- ==============================================================================

-- 1. Add quality_score column to workout_sessions
ALTER TABLE public.workout_sessions
ADD COLUMN IF NOT EXISTS quality_score INT
CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100));

-- 2. Create Protected-Column Trigger Function to Guard quality_score
-- A normal (NOT SECURITY DEFINER) trigger function that allows quality_score
-- mutations ONLY when CURRENT_USER equals the table owner (e.g. inside the
-- complete_workout_session SECURITY DEFINER RPC). Normal authenticated clients
-- attempting to mutate quality_score directly are blocked with 42501.
CREATE OR REPLACE FUNCTION public.guard_workout_quality_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_table_owner TEXT;
BEGIN
    -- Only evaluate when quality_score is being changed
    IF NEW.quality_score IS DISTINCT FROM OLD.quality_score THEN
        -- Dynamic owner resolution of public.workout_sessions
        SELECT pg_get_userbyid(relowner) INTO v_table_owner
        FROM pg_class
        WHERE oid = 'public.workout_sessions'::regclass;

        IF CURRENT_USER <> v_table_owner THEN
            RAISE EXCEPTION 'quality_score is server-authoritative and cannot be directly modified by clients'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Attach BEFORE UPDATE OF quality_score Trigger
DROP TRIGGER IF EXISTS trg_guard_workout_quality_score ON public.workout_sessions;
CREATE TRIGGER trg_guard_workout_quality_score
    BEFORE UPDATE OF quality_score ON public.workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_workout_quality_score();

-- 4. Update complete_workout_session RPC with Authoritative Quality Score
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

    -- Quality Score Variables
    v_valid_sets INT := 0;
    v_duration_seconds INT := 0;
    v_plan_core_count INT := 0;
    v_server_core_completed BOOLEAN := FALSE;
    v_volume_pts INT := 0;
    v_core_pts INT := 0;
    v_cadence_pts INT := 0;
    v_effort_pts INT := 0;
    v_pr_pts INT := 0;
    v_pr_count INT := 0;
    v_milestone_pts INT := 0;
    v_quality_score INT := 0;
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
            'streak_counted', FALSE,
            'quality_score', v_session.quality_score
        );
    ELSIF v_session.status = 'completed' THEN
        RAISE EXCEPTION 'Workout session was already finalized with a different key' USING ERRCODE = '40900';
    END IF;

    -- Step 4: Authoritative PR Calculations from workout_sets + PR History Logging
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
            -- First PR ever for this exercise
            INSERT INTO public.personal_records (user_id, exercise_id, weight_kg, reps, estimated_one_rep_max, session_id)
            VALUES (v_user_id, v_set.exercise_id, v_set.weight_kg, v_set.reps, v_1rm, p_session_id);

            -- Additive C10: Persist to append-only pr_history
            INSERT INTO public.pr_history (user_id, exercise_id, weight_kg, reps, estimated_one_rep_max, session_id, achieved_at)
            VALUES (v_user_id, v_set.exercise_id, v_set.weight_kg, v_set.reps, v_1rm, p_session_id, NOW());

            v_new_prs := v_new_prs || jsonb_build_object(
                'exercise_id', v_set.exercise_id,
                'weight_kg', v_set.weight_kg,
                'reps', v_set.reps,
                'estimated_1rm', v_1rm
            );
        ELSIF v_1rm > v_pr.estimated_one_rep_max OR (v_1rm = v_pr.estimated_one_rep_max AND v_set.weight_kg > v_pr.weight_kg) THEN
            -- New PR breaks previous record
            UPDATE public.personal_records
            SET weight_kg = v_set.weight_kg,
                reps = v_set.reps,
                estimated_one_rep_max = v_1rm,
                achieved_at = NOW(),
                session_id = p_session_id
            WHERE user_id = v_user_id AND exercise_id = v_set.exercise_id;

            -- Additive C10: Persist to append-only pr_history
            INSERT INTO public.pr_history (user_id, exercise_id, weight_kg, reps, estimated_one_rep_max, session_id, achieved_at)
            VALUES (v_user_id, v_set.exercise_id, v_set.weight_kg, v_set.reps, v_1rm, p_session_id, NOW());

            v_new_prs := v_new_prs || jsonb_build_object(
                'exercise_id', v_set.exercise_id,
                'weight_kg', v_set.weight_kg,
                'reps', v_set.reps,
                'estimated_1rm', v_1rm
            );
        END IF;
    END LOOP;

    -- Step 5: Authoritative Workout Quality Score Calculation (Candidate C Formula)
    -- ValidSets count: server count of completed working sets with weight > 0 and reps > 0
    SELECT COUNT(*) INTO v_valid_sets
    FROM public.workout_sets ws
    JOIN public.workout_session_exercises wse ON wse.id = ws.session_exercise_id
    WHERE wse.session_id = p_session_id
      AND ws.completed = TRUE
      AND ws.weight_kg > 0
      AND ws.reps > 0;

    IF v_valid_sets = 0 THEN
        v_quality_score := 0;
    ELSE
        -- 1. Volume Points (0, 15, 25, 35, 40)
        IF v_valid_sets >= 12 THEN
            v_volume_pts := 40;
        ELSIF v_valid_sets >= 8 THEN
            v_volume_pts := 35;
        ELSIF v_valid_sets >= 4 THEN
            v_volume_pts := 25;
        ELSE
            v_volume_pts := 15;
        END IF;

        -- 2. Core Focus Points (0, 10, 25)
        -- Authoritative database derivation: NEVER trust client p_is_core_completed for score
        IF v_session.plan_id IS NOT NULL THEN
            SELECT COUNT(*) INTO v_plan_core_count
            FROM public.workout_plan_exercises wpe
            JOIN public.workout_plan_days wpd ON wpd.id = wpe.plan_day_id
            WHERE wpd.plan_id = v_session.plan_id AND wpe.is_core = TRUE;

            IF v_plan_core_count > 0 THEN
                SELECT EXISTS (
                    SELECT 1
                    FROM public.workout_sets ws
                    JOIN public.workout_session_exercises wse ON wse.id = ws.session_exercise_id
                    JOIN public.workout_plan_exercises wpe ON wpe.exercise_id = wse.exercise_id
                    JOIN public.workout_plan_days wpd ON wpd.id = wpe.plan_day_id
                    WHERE wse.session_id = p_session_id
                      AND wpd.plan_id = v_session.plan_id
                      AND wpe.is_core = TRUE
                      AND ws.completed = TRUE
                      AND ws.weight_kg > 0
                      AND ws.reps > 0
                ) INTO v_server_core_completed;
            ELSE
                v_server_core_completed := (v_valid_sets > 0);
            END IF;
        ELSE
            -- Freestyle workout without plan: valid completed sets satisfy core focus
            v_server_core_completed := (v_valid_sets > 0);
        END IF;

        IF v_server_core_completed THEN
            v_core_pts := 25;
        ELSIF v_valid_sets >= 4 THEN
            v_core_pts := 10;
        ELSE
            v_core_pts := 0;
        END IF;

        -- 3. Session Cadence Points (0, 5, 10, 15, 20)
        v_duration_seconds := COALESCE(v_session.duration_seconds, 0);
        IF v_duration_seconds <= 0 AND v_session.started_at IS NOT NULL THEN
            v_duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_session.started_at))::INT);
        END IF;

        IF v_duration_seconds < 300 THEN
            v_cadence_pts := 0;
        ELSIF v_duration_seconds < 600 THEN
            v_cadence_pts := 5;
        ELSIF v_duration_seconds < 900 THEN
            v_cadence_pts := 10;
        ELSIF v_duration_seconds < 1200 THEN
            v_cadence_pts := 15;
        ELSIF v_duration_seconds <= 4500 THEN
            v_cadence_pts := 20;
        ELSIF v_duration_seconds <= 7200 THEN
            v_cadence_pts := 15;
        ELSE
            v_cadence_pts := 5;
        END IF;

        -- 4. Milestone Points: Effort (0, 2, 5, 7) + PR (0, 5, 8), capped at 15
        IF p_session_rating = 'exhausting' THEN
            v_effort_pts := 7;
        ELSIF p_session_rating = 'normal' THEN
            v_effort_pts := 5;
        ELSIF p_session_rating = 'easy' THEN
            v_effort_pts := 2;
        ELSE
            v_effort_pts := 0;
        END IF;

        v_pr_count := jsonb_array_length(v_new_prs);
        IF v_pr_count >= 2 THEN
            v_pr_pts := 8;
        ELSIF v_pr_count = 1 THEN
            v_pr_pts := 5;
        ELSE
            v_pr_pts := 0;
        END IF;

        v_milestone_pts := LEAST(15, v_effort_pts + v_pr_pts);

        -- Final Score: Capped at 100
        v_quality_score := LEAST(100, v_volume_pts + v_core_pts + v_cadence_pts + v_milestone_pts);
    END IF;

    -- Step 6: Finalize Session Record with Persisted Quality Score
    UPDATE public.workout_sessions
    SET status = 'completed',
        completed_at = NOW(),
        idempotency_key = p_idempotency_key,
        session_rating = p_session_rating,
        notes = p_notes,
        gym_verified = COALESCE(p_gym_verified, FALSE),
        quality_score = v_quality_score,
        updated_at = NOW()
    WHERE id = p_session_id;

    -- Step 7: Core Exercise Streak Eligibility
    -- Existing C1-C9 behavior preserved: p_is_core_completed maintained for streak qualification
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

    -- Step 8: Milestone Rewards & Coins
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
        'coins_earned', v_coins_earned,
        'quality_score', v_quality_score
    );
END;
$$;
