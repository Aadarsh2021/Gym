-- ==============================================================================
-- FITBOOST MIGRATION: PHASE G1 — GYM RETENTION FOUNDATION
-- 1. Adds timezone to gyms for facility-local calendar day calculations
-- 2. Creates gym_attendance_streaks (strictly separated from personal streaks)
-- 3. Creates gym_announcements with pinned priority & member RLS
-- 4. Creates gym_rewards & gym_reward_redemptions with atomic claim/redeem RPCs
-- 5. Implements record_verified_gym_checkin atomic RPC (server-authoritative streak)
-- ==============================================================================

-- 1. FACILITY TIMEZONE ON GYMS
ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata' NOT NULL;

-- 2. GYM ATTENDANCE STREAKS TABLE
-- Derived streak state from authoritative gym_attendance_sessions.
-- Keyed uniquely per (user_id, gym_id).
CREATE TABLE IF NOT EXISTS public.gym_attendance_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    current_streak INT DEFAULT 1 NOT NULL CHECK (current_streak >= 0),
    longest_streak INT DEFAULT 1 NOT NULL CHECK (longest_streak >= current_streak),
    last_visit_date DATE NOT NULL,
    total_visit_days INT DEFAULT 1 NOT NULL CHECK (total_visit_days >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_gym_user_attendance_streak UNIQUE (user_id, gym_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_attendance_streaks_gym_user
ON public.gym_attendance_streaks (gym_id, user_id);

-- Enable RLS on gym_attendance_streaks
ALTER TABLE public.gym_attendance_streaks ENABLE ROW LEVEL SECURITY;

-- Member can view their own gym streak
DROP POLICY IF EXISTS "Members can view their own gym streak" ON public.gym_attendance_streaks;
CREATE POLICY "Members can view their own gym streak"
ON public.gym_attendance_streaks FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Gym owner can view streaks for their members
DROP POLICY IF EXISTS "Owners can view streaks for their gym" ON public.gym_attendance_streaks;
CREATE POLICY "Owners can view streaks for their gym"
ON public.gym_attendance_streaks FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_attendance_streaks.gym_id
          AND g.owner_id = auth.uid()
    )
);

-- Deny direct client mutations on streaks (must be server/RPC authoritative)
REVOKE INSERT, UPDATE, DELETE ON public.gym_attendance_streaks FROM authenticated, anon;


-- 3. FACILITY ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.gym_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
    status TEXT DEFAULT 'published' NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gym_announcements_feed
ON public.gym_announcements (gym_id, status, is_pinned DESC, priority DESC, created_at DESC);

ALTER TABLE public.gym_announcements ENABLE ROW LEVEL SECURITY;

-- Owner policies: full CRUD for gyms they own
DROP POLICY IF EXISTS "Owners manage announcements for their gyms" ON public.gym_announcements;
CREATE POLICY "Owners manage announcements for their gyms"
ON public.gym_announcements FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_announcements.gym_id
          AND g.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_announcements.gym_id
          AND g.owner_id = auth.uid()
    )
);

-- Member policy: active members can view published, non-expired announcements
DROP POLICY IF EXISTS "Active members view announcements for their gym" ON public.gym_announcements;
CREATE POLICY "Active members view announcements for their gym"
ON public.gym_announcements FOR SELECT
TO authenticated
USING (
    status = 'published'
    AND (expires_at IS NULL OR expires_at > NOW())
    AND EXISTS (
        SELECT 1 FROM public.gym_memberships gm
        WHERE gm.gym_id = gym_announcements.gym_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
    )
);


-- 4. GYM REWARDS & MILESTONE PERKS
CREATE TABLE IF NOT EXISTS public.gym_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    required_visits INT NOT NULL CHECK (required_visits > 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_gym_reward_milestone UNIQUE (gym_id, required_visits)
);

CREATE INDEX IF NOT EXISTS idx_gym_rewards_gym_active
ON public.gym_rewards (gym_id, is_active, required_visits ASC);

ALTER TABLE public.gym_rewards ENABLE ROW LEVEL SECURITY;

-- Owner manages rewards for their own gyms
DROP POLICY IF EXISTS "Owners manage rewards for their gyms" ON public.gym_rewards;
CREATE POLICY "Owners manage rewards for their gyms"
ON public.gym_rewards FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_rewards.gym_id
          AND g.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_rewards.gym_id
          AND g.owner_id = auth.uid()
    )
);

-- Active members can view rewards configured for their gym
DROP POLICY IF EXISTS "Active members view rewards for their gym" ON public.gym_rewards;
CREATE POLICY "Active members view rewards for their gym"
ON public.gym_rewards FOR SELECT
TO authenticated
USING (
    is_active = TRUE
    AND EXISTS (
        SELECT 1 FROM public.gym_memberships gm
        WHERE gm.gym_id = gym_rewards.gym_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
    )
);


-- 5. GYM REWARD REDEMPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.gym_reward_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reward_id UUID NOT NULL REFERENCES public.gym_rewards(id) ON DELETE RESTRICT,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'claimed' NOT NULL CHECK (status IN ('claimed', 'redeemed', 'expired')),
    redemption_code TEXT UNIQUE NOT NULL,
    claimed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_reward_user_redemption UNIQUE (reward_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_reward_redemptions_user
ON public.gym_reward_redemptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_gym_reward_redemptions_gym
ON public.gym_reward_redemptions (gym_id, status);

ALTER TABLE public.gym_reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Members view their own redemptions
DROP POLICY IF EXISTS "Members view their own redemptions" ON public.gym_reward_redemptions;
CREATE POLICY "Members view their own redemptions"
ON public.gym_reward_redemptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Owners view redemptions for their gym
DROP POLICY IF EXISTS "Owners view redemptions for their gym" ON public.gym_reward_redemptions;
CREATE POLICY "Owners view redemptions for their gym"
ON public.gym_reward_redemptions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_reward_redemptions.gym_id
          AND g.owner_id = auth.uid()
    )
);

-- Deny direct client INSERT/UPDATE/DELETE on redemptions
-- Mutations must execute strictly via claim_gym_reward and redeem_gym_reward RPCs
REVOKE INSERT, UPDATE, DELETE ON public.gym_reward_redemptions FROM authenticated, anon;


-- 6. AUTHORITATIVE STORED PROCEDURES (SECURITY DEFINER)

-- 6A. AUTHORITATIVE CHECK-IN & STREAK COMPUTATION
-- Performs atomic check-in into gym_attendance_sessions and updates gym_attendance_streaks
CREATE OR REPLACE FUNCTION public.record_verified_gym_checkin(
    p_gym_id UUID,
    p_verification_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_gym RECORD;
    v_tz TEXT := 'Asia/Kolkata';
    v_membership RECORD;
    v_session RECORD;
    v_visit_date DATE;
    v_yesterday DATE;
    v_streak RECORD;
    v_new_streak INT := 1;
    v_longest_streak INT := 1;
    v_total_visit_days INT := 1;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Verify verification method
    IF p_verification_method NOT IN ('qr_scan', 'gps_geofence', 'reception_manual') THEN
        RAISE EXCEPTION 'Invalid verification method' USING ERRCODE = '40001';
    END IF;

    -- 3. Verify active membership
    SELECT * INTO v_membership
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND user_id = v_caller_id;

    IF NOT FOUND OR v_membership.status <> 'active' THEN
        RAISE EXCEPTION 'Active membership required for check-in' USING ERRCODE = '40300';
    END IF;

    -- 4. Check for existing active session across all facilities (single active session constraint)
    SELECT * INTO v_session
    FROM public.gym_attendance_sessions
    WHERE user_id = v_caller_id AND status = 'active';

    IF FOUND THEN
        RAISE EXCEPTION 'Active attendance session already in progress' USING ERRCODE = '40901';
    END IF;

    -- 5. Fetch gym and timezone
    SELECT * INTO v_gym FROM public.gyms WHERE id = p_gym_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gym not found' USING ERRCODE = '40400';
    END IF;

    IF v_gym.timezone IS NOT NULL AND v_gym.timezone <> '' THEN
        v_tz := v_gym.timezone;
    END IF;

    v_visit_date := (NOW() AT TIME ZONE v_tz)::DATE;
    v_yesterday := v_visit_date - INTERVAL '1 day';

    -- 6. Insert attendance session
    INSERT INTO public.gym_attendance_sessions (
        gym_id,
        user_id,
        verification_method,
        status,
        check_in_at
    )
    VALUES (
        p_gym_id,
        v_caller_id,
        p_verification_method,
        'active',
        NOW()
    )
    RETURNING * INTO v_session;

    -- 7. Update gym attendance streak with row lock
    SELECT * INTO v_streak
    FROM public.gym_attendance_streaks
    WHERE gym_id = p_gym_id AND user_id = v_caller_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- First ever visit to this gym
        INSERT INTO public.gym_attendance_streaks (
            user_id,
            gym_id,
            current_streak,
            longest_streak,
            last_visit_date,
            total_visit_days
        )
        VALUES (
            v_caller_id,
            p_gym_id,
            1,
            1,
            v_visit_date,
            1
        )
        RETURNING * INTO v_streak;
    ELSE
        IF v_streak.last_visit_date = v_visit_date THEN
            -- Same-day multiple visit: IDEMPOTENT, 0 extra streak or total_visit_days
            v_new_streak := v_streak.current_streak;
            v_longest_streak := v_streak.longest_streak;
            v_total_visit_days := v_streak.total_visit_days;
        ELSIF v_streak.last_visit_date = v_yesterday THEN
            -- Consecutive facility-local calendar day visit: increment streak
            v_new_streak := v_streak.current_streak + 1;
            v_longest_streak := GREATEST(v_streak.longest_streak, v_new_streak);
            v_total_visit_days := v_streak.total_visit_days + 1;

            UPDATE public.gym_attendance_streaks
            SET current_streak = v_new_streak,
                longest_streak = v_longest_streak,
                last_visit_date = v_visit_date,
                total_visit_days = v_total_visit_days,
                updated_at = NOW()
            WHERE id = v_streak.id;
        ELSE
            -- Missed calendar day: reset streak to 1
            v_new_streak := 1;
            v_longest_streak := v_streak.longest_streak;
            v_total_visit_days := v_streak.total_visit_days + 1;

            UPDATE public.gym_attendance_streaks
            SET current_streak = 1,
                last_visit_date = v_visit_date,
                total_visit_days = v_total_visit_days,
                updated_at = NOW()
            WHERE id = v_streak.id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'session_id', v_session.id,
        'gym_id', p_gym_id,
        'check_in_at', v_session.check_in_at,
        'current_streak', v_new_streak,
        'longest_streak', v_longest_streak,
        'total_visit_days', v_total_visit_days
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_verified_gym_checkin(UUID, TEXT) TO authenticated;


-- 6B. AUTHORITATIVE REWARD CLAIM RPC
-- Transactionally checks authoritative unique attendance days, validates active membership, and issues redemption code.
CREATE OR REPLACE FUNCTION public.claim_gym_reward(
    p_reward_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_reward RECORD;
    v_gym RECORD;
    v_membership RECORD;
    v_existing_redemption RECORD;
    v_unique_visit_days INT := 0;
    v_tz TEXT := 'Asia/Kolkata';
    v_code TEXT;
    v_redemption RECORD;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Fetch reward with row lock
    SELECT * INTO v_reward
    FROM public.gym_rewards
    WHERE id = p_reward_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reward not found' USING ERRCODE = '40400';
    END IF;

    IF v_reward.is_active = FALSE THEN
        RAISE EXCEPTION 'Reward is currently inactive' USING ERRCODE = '40002';
    END IF;

    -- 3. Verify caller has active membership at the reward's facility
    SELECT * INTO v_membership
    FROM public.gym_memberships
    WHERE gym_id = v_reward.gym_id AND user_id = v_caller_id;

    IF NOT FOUND OR v_membership.status <> 'active' THEN
        RAISE EXCEPTION 'Active gym membership required to claim reward' USING ERRCODE = '40300';
    END IF;

    -- 4. Check if already claimed by this member
    SELECT * INTO v_existing_redemption
    FROM public.gym_reward_redemptions
    WHERE reward_id = p_reward_id AND user_id = v_caller_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'already_claimed',
            'redemption', row_to_json(v_existing_redemption)
        );
    END IF;

    -- 5. Calculate authoritative unique attendance days from gym_attendance_sessions
    SELECT * INTO v_gym FROM public.gyms WHERE id = v_reward.gym_id;
    IF v_gym.timezone IS NOT NULL AND v_gym.timezone <> '' THEN
        v_tz := v_gym.timezone;
    END IF;

    SELECT COUNT(DISTINCT (check_in_at AT TIME ZONE v_tz)::DATE)::INT
    INTO v_unique_visit_days
    FROM public.gym_attendance_sessions
    WHERE gym_id = v_reward.gym_id
      AND user_id = v_caller_id
      AND status IN ('active', 'completed');

    IF v_unique_visit_days < v_reward.required_visits THEN
        RAISE EXCEPTION 'Insufficient unique attendance days (% of % required)', v_unique_visit_days, v_reward.required_visits USING ERRCODE = '40003';
    END IF;

    -- 6. Generate human-verifiable unique code: FB-REW-XXXXXX (6 random uppercase chars/digits)
    v_code := 'FB-REW-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));

    -- 7. Insert redemption record
    INSERT INTO public.gym_reward_redemptions (
        reward_id,
        gym_id,
        user_id,
        status,
        redemption_code,
        claimed_at
    )
    VALUES (
        p_reward_id,
        v_reward.gym_id,
        v_caller_id,
        'claimed',
        v_code,
        NOW()
    )
    RETURNING * INTO v_redemption;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'claimed',
        'redemption', jsonb_build_object(
            'id', v_redemption.id,
            'reward_id', v_redemption.reward_id,
            'gym_id', v_redemption.gym_id,
            'user_id', v_redemption.user_id,
            'status', v_redemption.status,
            'redemption_code', v_redemption.redemption_code,
            'claimed_at', v_redemption.claimed_at
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_gym_reward(UUID) TO authenticated;


-- 6C. AUTHORITATIVE DESK REDEMPTION RPC
-- Validates caller ownership of gym and transitions status from 'claimed' to 'redeemed'
CREATE OR REPLACE FUNCTION public.redeem_gym_reward(
    p_redemption_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_redemption RECORD;
    v_gym RECORD;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Fetch redemption with row lock
    SELECT * INTO v_redemption
    FROM public.gym_reward_redemptions
    WHERE id = p_redemption_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Redemption record not found' USING ERRCODE = '40400';
    END IF;

    -- 3. Verify caller is the owner of the facility
    SELECT * INTO v_gym
    FROM public.gyms
    WHERE id = v_redemption.gym_id AND owner_id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the facility owner' USING ERRCODE = '40300';
    END IF;

    -- 4. Check status
    IF v_redemption.status = 'redeemed' THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'already_redeemed',
            'redeemed_at', v_redemption.redeemed_at
        );
    END IF;

    IF v_redemption.status <> 'claimed' THEN
        RAISE EXCEPTION 'Redemption is in invalid status: %', v_redemption.status USING ERRCODE = '40004';
    END IF;

    -- 5. Finalize redemption
    UPDATE public.gym_reward_redemptions
    SET status = 'redeemed',
        redeemed_at = NOW()
    WHERE id = p_redemption_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'redeemed',
        'redeemed_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_gym_reward(UUID) TO authenticated;
