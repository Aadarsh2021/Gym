-- ============================================================================
-- FITBOOST: Member Attendance Summary RPC
-- Migration: 20260916000001_member_attendance_summary_rpc.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_member_attendance_summary(
    p_user_id UUID,
    p_month_start TIMESTAMPTZ,
    p_month_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_visits INT := 0;
    v_total_duration BIGINT := 0;
    v_avg_duration INT := 0;
    v_current_month_visits INT := 0;
BEGIN
    -- Authorization check: Caller must be the requested user or service role
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized attendance summary query';
    END IF;

    -- Aggregate all completed sessions for this user
    SELECT
        COUNT(*)::INT,
        COALESCE(SUM(duration_seconds), 0)::BIGINT,
        COALESCE(AVG(duration_seconds), 0)::INT
    INTO
        v_total_visits,
        v_total_duration,
        v_avg_duration
    FROM public.gym_attendance_sessions
    WHERE user_id = p_user_id
      AND status = 'completed';

    -- Aggregate completed visits in the specified month range
    SELECT
        COUNT(*)::INT
    INTO
        v_current_month_visits
    FROM public.gym_attendance_sessions
    WHERE user_id = p_user_id
      AND status = 'completed'
      AND check_in_at >= p_month_start
      AND check_in_at < p_month_end;

    RETURN jsonb_build_object(
        'totalVisits', v_total_visits,
        'totalDurationSeconds', v_total_duration,
        'avgDurationSeconds', v_avg_duration,
        'currentMonthVisits', v_current_month_visits
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_member_attendance_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
