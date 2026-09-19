-- ==============================================================================
-- FITBOOST MIGRATION: PHASE G7 — GYM OWNER OPERATIONS INTELLIGENCE DASHBOARD
-- 1. Adds max_capacity to gyms with validation constraint
-- 2. Adds composite index on gym_attendance_sessions for high-performance date range scans
-- 3. Implements single-roundtrip authoritative get_owner_dashboard_overview RPC
-- ==============================================================================

-- 1. FACILITY CAPACITY COLUMN
ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS max_capacity INT DEFAULT 100 NOT NULL CHECK (max_capacity > 0);

-- 2. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_gym_checkin 
ON public.gym_attendance_sessions(gym_id, check_in_at DESC);

-- 3. AUTHORITATIVE OPERATIONS INTELLIGENCE OVERVIEW RPC
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_overview(p_gym_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_gym RECORD;
    v_tz TEXT;
    v_today_start TIMESTAMPTZ;
    v_today_end TIMESTAMPTZ;
    v_seven_days_ago TIMESTAMPTZ;
    v_thirty_days_ago TIMESTAMPTZ;

    -- Live metrics
    v_current_occupancy INT := 0;
    v_occupancy_rate NUMERIC := 0.0;
    v_status TEXT := 'normal';

    -- Attendance metrics
    v_today_checkins INT := 0;
    v_today_completed_visits INT := 0;
    v_today_avg_duration_minutes NUMERIC := 0.0;
    v_peak_hours JSONB := '[]'::JSONB;

    -- Member metrics
    v_active_members_30d INT := 0;
    v_streak_members_count INT := 0;
    v_retention_health_percentage NUMERIC := 0.0;
    v_pending_memberships_count INT := 0;

    -- Engagement metrics
    v_active_challenges_count INT := 0;
    v_challenge_participants_count INT := 0;
    v_active_buddy_connections_count INT := 0;

    -- Safety metrics
    v_open_safety_incidents_count INT := 0;
    v_critical_safety_incidents_count INT := 0;
    v_active_safety_notices_count INT := 0;

    -- Moderation metrics
    v_unresolved_flags_count INT := 0;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    -- Verify caller owns this gym
    SELECT id, name, timezone, max_capacity
    INTO v_gym
    FROM public.gyms
    WHERE id = p_gym_id AND owner_id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Access denied: not gym owner' USING ERRCODE = '42501';
    END IF;

    v_tz := COALESCE(v_gym.timezone, 'Asia/Kolkata');

    -- Calculate facility-local time boundaries
    v_today_start := (date_trunc('day', timezone(v_tz, now())) AT TIME ZONE v_tz);
    v_today_end := v_today_start + interval '1 day';
    v_seven_days_ago := v_today_start - interval '6 days';
    v_thirty_days_ago := v_today_start - interval '29 days';

    -- 1. Live Occupancy
    SELECT COUNT(*)
    INTO v_current_occupancy
    FROM public.gym_attendance_sessions
    WHERE gym_id = p_gym_id
      AND status = 'active'
      AND check_out_at IS NULL;

    IF v_gym.max_capacity > 0 THEN
        v_occupancy_rate := LEAST(100.0, ROUND((v_current_occupancy::NUMERIC / v_gym.max_capacity::NUMERIC) * 100.0, 1));
    ELSE
        v_occupancy_rate := 0.0;
    END IF;

    IF v_occupancy_rate >= 100.0 THEN
        v_status := 'at_capacity';
    ELSIF v_occupancy_rate >= 80.0 THEN
        v_status := 'crowded';
    ELSE
        v_status := 'normal';
    END IF;

    -- 2. Today's Attendance
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE check_out_at IS NOT NULL),
        COALESCE(ROUND(AVG(duration_seconds) FILTER (WHERE check_out_at IS NOT NULL) / 60.0, 1), 0.0)
    INTO 
        v_today_checkins,
        v_today_completed_visits,
        v_today_avg_duration_minutes
    FROM public.gym_attendance_sessions
    WHERE gym_id = p_gym_id
      AND check_in_at >= v_today_start
      AND check_in_at < v_today_end;

    -- 3. Peak Hours Distribution (Last 7 Facility-Local Days, 24 buckets [0..23])
    WITH hours_series AS (
        SELECT generate_series(0, 23) AS h
    ),
    checkin_counts AS (
        SELECT 
            EXTRACT(HOUR FROM timezone(v_tz, check_in_at))::INT AS h,
            COUNT(*) AS cnt
        FROM public.gym_attendance_sessions
        WHERE gym_id = p_gym_id
          AND check_in_at >= v_seven_days_ago
          AND check_in_at < v_today_end
        GROUP BY 1
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'hour', hs.h,
            'checkins', COALESCE(cc.cnt, 0)
        ) ORDER BY hs.h
    )
    INTO v_peak_hours
    FROM hours_series hs
    LEFT JOIN checkin_counts cc ON hs.h = cc.h;

    -- 4. Member Metrics (30-day active, streak, pending)
    SELECT COUNT(DISTINCT m.user_id)
    INTO v_active_members_30d
    FROM public.gym_memberships m
    JOIN public.gym_attendance_sessions s 
      ON m.user_id = s.user_id AND m.gym_id = s.gym_id
    WHERE m.gym_id = p_gym_id
      AND m.status = 'active'
      AND s.check_in_at >= v_thirty_days_ago
      AND s.check_in_at < v_today_end;

    SELECT COUNT(*)
    INTO v_streak_members_count
    FROM public.gym_attendance_streaks
    WHERE gym_id = p_gym_id
      AND current_streak >= 3;

    IF v_active_members_30d > 0 THEN
        v_retention_health_percentage := LEAST(100.0, ROUND((v_streak_members_count::NUMERIC / v_active_members_30d::NUMERIC) * 100.0, 1));
    ELSE
        v_retention_health_percentage := 0.0;
    END IF;

    SELECT COUNT(*)
    INTO v_pending_memberships_count
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id
      AND status = 'pending';

    -- 5. Subsystem Engagement
    -- Challenges
    SELECT 
        COUNT(*),
        COALESCE((
            SELECT COUNT(DISTINCT p.user_id)
            FROM public.gym_challenge_participants p
            JOIN public.gym_challenges c ON p.challenge_id = c.id
            WHERE c.gym_id = p_gym_id
              AND c.status = 'active'
              AND p.status IN ('active', 'completed')
        ), 0)
    INTO 
        v_active_challenges_count,
        v_challenge_participants_count
    FROM public.gym_challenges
    WHERE gym_id = p_gym_id
      AND status = 'active';

    -- Buddy Connections
    SELECT COUNT(*)
    INTO v_active_buddy_connections_count
    FROM public.gym_buddy_connections
    WHERE gym_id = p_gym_id
      AND status = 'accepted';

    -- 6. Safety & SPS (G6)
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE severity = 'critical')
    INTO 
        v_open_safety_incidents_count,
        v_critical_safety_incidents_count
    FROM public.gym_safety_incidents
    WHERE gym_id = p_gym_id
      AND status IN ('reported', 'acknowledged', 'investigating', 'action_taken');

    SELECT COUNT(*)
    INTO v_active_safety_notices_count
    FROM public.gym_safety_notices
    WHERE gym_id = p_gym_id
      AND is_active = TRUE
      AND starts_at <= NOW()
      AND (expires_at IS NULL OR expires_at > NOW());

    -- 7. Community Moderation (G2)
    SELECT COUNT(*)
    INTO v_unresolved_flags_count
    FROM public.gym_post_reports
    WHERE gym_id = p_gym_id
      AND status = 'pending';

    -- Build and return single response object
    RETURN jsonb_build_object(
        'facility', jsonb_build_object(
            'gymId', v_gym.id,
            'gymName', v_gym.name,
            'timezone', v_tz,
            'maxCapacity', v_gym.max_capacity
        ),
        'live', jsonb_build_object(
            'occupancy', v_current_occupancy,
            'occupancyRate', v_occupancy_rate,
            'status', v_status
        ),
        'attendance', jsonb_build_object(
            'todayCheckins', v_today_checkins,
            'todayCompletedVisits', v_today_completed_visits,
            'todayAvgDurationMinutes', v_today_avg_duration_minutes,
            'peakHoursDistribution', COALESCE(v_peak_hours, '[]'::JSONB)
        ),
        'members', jsonb_build_object(
            'activeMembers30d', v_active_members_30d,
            'streakMembersCount', v_streak_members_count,
            'retentionHealthPercentage', v_retention_health_percentage,
            'pendingMembershipsCount', v_pending_memberships_count
        ),
        'engagement', jsonb_build_object(
            'activeChallengesCount', v_active_challenges_count,
            'challengeParticipantsCount', v_challenge_participants_count,
            'activeBuddyConnectionsCount', v_active_buddy_connections_count
        ),
        'safety', jsonb_build_object(
            'openSafetyIncidentsCount', v_open_safety_incidents_count,
            'criticalSafetyIncidentsCount', v_critical_safety_incidents_count,
            'activeSafetyNoticesCount', v_active_safety_notices_count
        ),
        'moderation', jsonb_build_object(
            'unresolvedFlagsCount', v_unresolved_flags_count
        )
    );
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.get_owner_dashboard_overview(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_owner_dashboard_overview(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_overview(UUID) TO authenticated;
