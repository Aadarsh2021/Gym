-- ==============================================================================
-- FITNESS PLATFORM (PHASE 1) - FUNCTIONS, RPCS & TRIGGERS
-- Implements complete_workout_session, use_streak_revive, and handle_new_user
-- ==============================================================================

-- 1. TRIGGER FUNCTION: Automatically initialize profile and streak for new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Provision Profile
    INSERT INTO public.profiles (id, display_name, timezone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'Asia/Kolkata')
    )
    ON CONFLICT (id) DO NOTHING;

    -- Provision Initial Streak Counter
    INSERT INTO public.streaks (user_id, current_streak, longest_streak)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. PRIVILEGED RPC: Complete Workout Session (Atomic, Server-Authoritative & Idempotent)
CREATE OR REPLACE FUNCTION public.complete_workout_session(
    p_session_id UUID,
    p_idempotency_key TEXT,
    p_session_rating TEXT,
    p_notes TEXT
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
    v_coins_earned INT := 0;
    v_new_prs JSONB := '[]'::JSONB;
    v_pr RECORD;
    v_set RECORD;
    v_1rm NUMERIC(6,2);
    v_total_completed_workouts INT;
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
        -- Safe idempotent replay: return current authoritative state
        SELECT current_streak INTO v_new_streak FROM public.streaks WHERE user_id = v_user_id;
        RETURN jsonb_build_object(
            'status', 'already_completed',
            'session_id', v_session.id,
            'completed_at', v_session.completed_at,
            'streak_count', COALESCE(v_new_streak, 0)
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
        updated_at = NOW()
    WHERE id = p_session_id;

    -- Step 5: Authoritative PR Calculations from workout_sets
    -- Epley 1RM formula: Weight * (1 + Reps / 30.0)
    FOR v_set IN
        SELECT wse.exercise_id, ws.weight_kg, ws.reps
        FROM public.workout_sets ws
        JOIN public.workout_session_exercises wse ON wse.id = ws.session_exercise_id
        WHERE wse.session_id = p_session_id AND ws.completed = TRUE AND ws.weight_kg > 0 AND ws.reps > 0
    LOOP
        v_1rm := ROUND(v_set.weight_kg * (1.0 + (v_set.reps::NUMERIC / 30.0)), 2);

        -- Check existing PR
        SELECT * INTO v_pr
        FROM public.personal_records
        WHERE user_id = v_user_id AND exercise_id = v_set.exercise_id;

        IF NOT FOUND THEN
            -- First PR for this exercise
            INSERT INTO public.personal_records (user_id, exercise_id, weight_kg, reps, estimated_one_rep_max, session_id)
            VALUES (v_user_id, v_set.exercise_id, v_set.weight_kg, v_set.reps, v_1rm, p_session_id);

            v_new_prs := v_new_prs || jsonb_build_object(
                'exercise_id', v_set.exercise_id,
                'weight_kg', v_set.weight_kg,
                'reps', v_set.reps,
                'estimated_1rm', v_1rm
            );
        ELSIF v_1rm > v_pr.estimated_one_rep_max OR (v_1rm = v_pr.estimated_one_rep_max AND v_set.weight_kg > v_pr.weight_kg) THEN
            -- New Higher PR
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

    -- Step 6: Timezone-Aware Streak Evaluation
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
    ELSE
        IF v_streak.last_activity_date = v_today THEN
            -- Already counted today
            v_new_streak := v_streak.current_streak;
        ELSIF v_streak.last_activity_date = v_yesterday THEN
            -- Consecutive day increment
            v_new_streak := v_streak.current_streak + 1;
            UPDATE public.streaks
            SET current_streak = v_new_streak,
                longest_streak = GREATEST(longest_streak, v_new_streak),
                last_activity_date = v_today,
                updated_at = NOW()
            WHERE user_id = v_user_id;
        ELSE
            -- Streak reset
            v_new_streak := 1;
            UPDATE public.streaks
            SET current_streak = 1,
                longest_streak = GREATEST(longest_streak, 1),
                last_activity_date = v_today,
                updated_at = NOW()
            WHERE user_id = v_user_id;
        END IF;
    END IF;

    -- Step 7: Milestone & Coin Rewards (Authoritative Ledger)
    SELECT COUNT(*) INTO v_total_completed_workouts
    FROM public.workout_sessions
    WHERE user_id = v_user_id AND status = 'completed';

    -- First workout completed reward (50 coins)
    IF v_total_completed_workouts = 1 THEN
        INSERT INTO public.achievements (user_id, achievement_type)
        VALUES (v_user_id, 'first_workout')
        ON CONFLICT (user_id, achievement_type) DO NOTHING;

        INSERT INTO public.fitness_coins (user_id, amount, source, reference_id)
        VALUES (v_user_id, 50, 'achievement', 'first_workout')
        ON CONFLICT (user_id, source, reference_id) DO NOTHING;

        v_coins_earned := v_coins_earned + 50;
    END IF;

    -- 7-Day Streak Milestone Reward (100 coins)
    IF v_new_streak >= 7 THEN
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

    -- Standard completion reward (10 coins)
    INSERT INTO public.fitness_coins (user_id, amount, source, reference_id)
    VALUES (v_user_id, 10, 'workout_completed', p_session_id::TEXT)
    ON CONFLICT (user_id, source, reference_id) DO NOTHING;

    IF FOUND THEN
        v_coins_earned := v_coins_earned + 10;
    END IF;

    -- Return Authoritative Result
    RETURN jsonb_build_object(
        'status', 'success',
        'session_id', p_session_id,
        'completed_at', NOW(),
        'streak_count', v_new_streak,
        'new_prs', v_new_prs,
        'coins_earned', v_coins_earned
    );
END;
$$;

-- 3. PRIVILEGED RPC: Use Streak Revive (Quota Enforced)
CREATE OR REPLACE FUNCTION public.use_streak_revive(p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_revives_used_this_month INT;
    v_streak RECORD;
    v_tz TEXT := 'Asia/Kolkata';
    v_today DATE;
    v_restored_streak INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Check Monthly Quota (Max 3 free revives per calendar month)
    SELECT COUNT(*) INTO v_revives_used_this_month
    FROM public.streak_revives
    WHERE user_id = v_user_id
      AND DATE_TRUNC('month', used_at) = DATE_TRUNC('month', NOW());

    IF v_revives_used_this_month >= 3 THEN
        RAISE EXCEPTION 'Monthly revive limit reached (3 per month)' USING ERRCODE = '42901';
    END IF;

    SELECT timezone INTO v_tz FROM public.profiles WHERE id = v_user_id;
    IF v_tz IS NULL THEN v_tz := 'Asia/Kolkata'; END IF;
    v_today := (NOW() AT TIME ZONE v_tz)::DATE;

    SELECT * INTO v_streak FROM public.streaks WHERE user_id = v_user_id FOR UPDATE;
    v_restored_streak := GREATEST(COALESCE(v_streak.longest_streak, 1), 1);

    -- Restore streak
    UPDATE public.streaks
    SET current_streak = v_restored_streak,
        last_activity_date = v_today,
        updated_at = NOW()
    WHERE user_id = v_user_id;

    -- Record audit log
    INSERT INTO public.streak_revives (user_id, restored_streak)
    VALUES (v_user_id, v_restored_streak);

    INSERT INTO public.streak_events (user_id, event_date, event_type)
    VALUES (v_user_id, v_today, 'revive')
    ON CONFLICT (user_id, event_date, event_type) DO NOTHING;

    RETURN jsonb_build_object(
        'status', 'success',
        'current_streak', v_restored_streak,
        'revives_remaining_this_month', 2 - v_revives_used_this_month
    );
END;
$$;
