-- ==============================================================================
-- FITSPHERE V1 - PHASE C7: OWNER DASHBOARD & FACILITY SYNCHRONIZATION
-- Migration: 20260916000002_owner_member_roster_and_profiles_rls.sql
-- Enables:
-- 1. Targeted RLS on public.profiles for gym owners to view member identity
-- 2. Authoritative stored function for owner-side membership status mutations
-- 3. Optimized composite indexes for owner attendance floor & roster queries
-- ==============================================================================

-- 1. TARGETED PROFILES RLS POLICY FOR GYM OWNERS
-- Allows gym owners to SELECT public identity (display_name, avatar_url)
-- exclusively for users associated with their owned gyms via membership or attendance.
DROP POLICY IF EXISTS "Gym owners can view profiles of their members and visitors" ON public.profiles;

CREATE POLICY "Gym owners can view profiles of their members and visitors"
ON public.profiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gym_memberships gm
        JOIN public.gyms g ON g.id = gm.gym_id
        WHERE gm.user_id = profiles.id AND g.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.gym_attendance_sessions gas
        JOIN public.gyms g ON g.id = gas.gym_id
        WHERE gas.user_id = profiles.id AND g.owner_id = auth.uid()
    )
);

-- 2. AUTHORITATIVE MEMBERSHIP STATUS TRANSITION FUNCTION (RPC)
-- Enforces:
-- - Caller must be the authenticated owner of the facility
-- - Immutable user_id and gym_id
-- - Allowed state machine transitions:
--     pending -> active
--     active  -> frozen
--     frozen  -> active
--     active  -> inactive
--     frozen  -> inactive
CREATE OR REPLACE FUNCTION public.update_gym_membership_status(
    p_membership_id UUID,
    p_target_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_membership RECORD;
    v_gym RECORD;
    v_allowed BOOLEAN := FALSE;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Fetch membership record with row lock
    SELECT * INTO v_membership
    FROM public.gym_memberships
    WHERE id = p_membership_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership not found' USING ERRCODE = '40400';
    END IF;

    -- 3. Verify caller owns the facility
    SELECT * INTO v_gym
    FROM public.gyms
    WHERE id = v_membership.gym_id AND owner_id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this facility' USING ERRCODE = '42501';
    END IF;

    -- 4. Validate state machine transition
    IF v_membership.status = 'pending' AND p_target_status = 'active' THEN
        v_allowed := TRUE;
    ELSIF v_membership.status = 'active' AND p_target_status = 'frozen' THEN
        v_allowed := TRUE;
    ELSIF v_membership.status = 'frozen' AND p_target_status = 'active' THEN
        v_allowed := TRUE;
    ELSIF v_membership.status = 'active' AND p_target_status = 'inactive' THEN
        v_allowed := TRUE;
    ELSIF v_membership.status = 'frozen' AND p_target_status = 'inactive' THEN
        v_allowed := TRUE;
    ELSIF v_membership.status = p_target_status THEN
        -- No-op transition is benign
        v_allowed := TRUE;
    END IF;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Invalid membership status transition from % to %', v_membership.status, p_target_status
            USING ERRCODE = '22023';
    END IF;

    -- 5. Authoritatively update status
    UPDATE public.gym_memberships
    SET status = p_target_status,
        joined_at = CASE 
            WHEN v_membership.status = 'pending' AND p_target_status = 'active' AND v_membership.joined_at IS NULL 
            THEN NOW() 
            ELSE joined_at 
        END
    WHERE id = p_membership_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'membership_id', p_membership_id,
        'gym_id', v_membership.gym_id,
        'user_id', v_membership.user_id,
        'status', p_target_status
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.update_gym_membership_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gym_membership_status(UUID, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_gym_membership_status(UUID, TEXT) FROM anon, public;

-- 3. OPTIMIZED COMPOSITE INDEXES
-- Index for owner active floor queries and recent check-ins
CREATE INDEX IF NOT EXISTS idx_gym_attendance_sessions_owner_floor
ON public.gym_attendance_sessions (gym_id, status, check_in_at DESC);

-- Index for owner member roster queries by status and joined_at
CREATE INDEX IF NOT EXISTS idx_gym_memberships_owner_roster
ON public.gym_memberships (gym_id, status, joined_at DESC);
