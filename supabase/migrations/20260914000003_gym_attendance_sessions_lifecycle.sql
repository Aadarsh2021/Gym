-- ============================================================================
-- FITBOOST: Gym Attendance Sessions Lifecycle (Check-in -> Active Session -> Check-out)
-- Migration: 20260914000003_gym_attendance_sessions_lifecycle.sql
-- ============================================================================

-- 1. GYM ATTENDANCE SESSIONS
-- Tracks complete member gym visits with check-in, live session state, check-out, and duration.
CREATE TABLE IF NOT EXISTS public.gym_attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    check_in_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    check_out_at TIMESTAMPTZ NULL,
    duration_seconds INT NULL,
    verification_method TEXT NOT NULL CHECK (verification_method IN ('qr_scan', 'gps_geofence', 'reception_manual')),
    checkout_method TEXT NULL CHECK (checkout_method IN ('qr_scan', 'gps_geofence', 'manual_button', 'reception_manual', 'auto_timeout')),
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_checkout_after_checkin CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

-- 2. ENFORCE SINGLE ACTIVE SESSION PER USER
-- A user cannot have more than one ACTIVE gym attendance session across any gym simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_single_active_attendance
ON public.gym_attendance_sessions (user_id)
WHERE status = 'active';

-- 3. QUERY PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_gym_status
ON public.gym_attendance_sessions(gym_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date
ON public.gym_attendance_sessions(user_id, check_in_at DESC);

-- 4. SERVER-SIDE DURATION CALCULATION TRIGGER
CREATE OR REPLACE FUNCTION public.fn_compute_attendance_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_out_at IS NOT NULL AND (NEW.duration_seconds IS NULL OR NEW.duration_seconds <= 0) THEN
        NEW.duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NEW.check_out_at - NEW.check_in_at))::INT);
    END IF;
    IF NEW.check_out_at IS NOT NULL AND NEW.status = 'active' THEN
        NEW.status := 'completed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_attendance_duration ON public.gym_attendance_sessions;
CREATE TRIGGER trg_compute_attendance_duration
BEFORE INSERT OR UPDATE ON public.gym_attendance_sessions
FOR EACH ROW
EXECUTE FUNCTION public.fn_compute_attendance_duration();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.gym_attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Member policies
DROP POLICY IF EXISTS "Members view their own attendance sessions" ON public.gym_attendance_sessions;
CREATE POLICY "Members view their own attendance sessions"
ON public.gym_attendance_sessions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members create their own check-in attendance session" ON public.gym_attendance_sessions;
CREATE POLICY "Members create their own check-in attendance session"
ON public.gym_attendance_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'active');

DROP POLICY IF EXISTS "Members check out their own attendance session" ON public.gym_attendance_sessions;
CREATE POLICY "Members check out their own attendance session"
ON public.gym_attendance_sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Gym Owner policies
DROP POLICY IF EXISTS "Owners view attendance for their gyms" ON public.gym_attendance_sessions;
CREATE POLICY "Owners view attendance for their gyms"
ON public.gym_attendance_sessions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.gyms
        WHERE gyms.id = gym_attendance_sessions.gym_id
        AND gyms.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Owners update attendance for their gyms" ON public.gym_attendance_sessions;
CREATE POLICY "Owners update attendance for their gyms"
ON public.gym_attendance_sessions FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.gyms
        WHERE gyms.id = gym_attendance_sessions.gym_id
        AND gyms.owner_id = auth.uid()
    )
);

-- 6. BACKWARD COMPATIBILITY CHECK-IN VIEW
-- Keeps legacy queries targeting gym_checkins working transparently
CREATE OR REPLACE VIEW public.gym_checkins AS
SELECT
    id,
    gym_id,
    user_id,
    verification_method,
    check_in_at AS checked_in_at
FROM public.gym_attendance_sessions;
