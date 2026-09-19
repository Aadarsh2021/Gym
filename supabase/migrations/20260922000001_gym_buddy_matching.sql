-- ==============================================================================
-- FITBOOST MIGRATION: PHASE G3 -- DYNAMIC GYM BUDDY MATCHING
-- G3 FINAL HARDENING v2:
-- 1. Creates gym_buddy_preferences with schedule and opt-in settings
-- 2. Creates gym_buddy_connections with partial unique lifecycle history retention
-- 3. Creates gym_buddy_dismissals with 14-day expiry and cyclic upsert
-- 4. Creates gym_buddy_blocks as global user-to-user safety mechanism
-- 5. Creates gym_buddy_reports for facility owner conduct moderation
-- 6. Enables RLS: gym_buddy_preferences direct INSERT/UPDATE/DELETE DENIED; SELECT self-only allowed
-- 7. Implements 100-point deterministic candidate discovery and lifecycle RPCs
--    Profile row locks always acquired in LEAST/GREATEST UUID order (deadlock prevention)
--    30-day decline cooldown enforced in candidate exclusion
--    Symmetric gender filter: both parties must satisfy each other preferred_gender_filter
-- ==============================================================================

-- 1. GYM BUDDY PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.gym_buddy_preferences (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    is_opted_in BOOLEAN DEFAULT FALSE NOT NULL,
    preferred_training_time TEXT DEFAULT 'evening' NOT NULL
        CHECK (preferred_training_time IN ('early_morning', 'morning', 'afternoon', 'evening', 'night')),
    preferred_training_days INT[] DEFAULT '{1,2,3,4,5}' NOT NULL,
    preferred_gender_filter TEXT DEFAULT 'any' NOT NULL
        CHECK (preferred_gender_filter IN ('any', 'same_gender')),
    bio_note TEXT CHECK (bio_note IS NULL OR char_length(trim(bio_note)) <= 160),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, gym_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_buddy_prefs_lookup
ON public.gym_buddy_preferences (gym_id, is_opted_in);

ALTER TABLE public.gym_buddy_preferences ENABLE ROW LEVEL SECURITY;


-- 2. GYM BUDDY CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.gym_buddy_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' NOT NULL
        CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'ended')),
    compatibility_score INT CHECK (compatibility_score BETWEEN 0 AND 100),
    match_reasons JSONB DEFAULT '[]'::JSONB NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    accepted_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    blocked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_canonical_user_order CHECK (user_a_id < user_b_id),
    CONSTRAINT chk_requester_is_participant CHECK (requester_id = user_a_id OR requester_id = user_b_id)
);

-- PARTIAL UNIQUE INDEX: Exactly ONE active or pending relationship allowed per pair per gym.
-- Historical rows (declined, cancelled, ended) are retained for auditability.
CREATE UNIQUE INDEX IF NOT EXISTS uq_buddy_connection_active
ON public.gym_buddy_connections (gym_id, user_a_id, user_b_id)
WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_buddy_conn_user_a ON public.gym_buddy_connections (user_a_id, status);
CREATE INDEX IF NOT EXISTS idx_buddy_conn_user_b ON public.gym_buddy_connections (user_b_id, status);
CREATE INDEX IF NOT EXISTS idx_buddy_conn_gym ON public.gym_buddy_connections (gym_id, status);
CREATE INDEX IF NOT EXISTS idx_buddy_conn_history ON public.gym_buddy_connections (gym_id, user_a_id, user_b_id, created_at DESC);

ALTER TABLE public.gym_buddy_connections ENABLE ROW LEVEL SECURITY;


-- 3. GYM BUDDY DISMISSALS TABLE
CREATE TABLE IF NOT EXISTS public.gym_buddy_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dismissed_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days') NOT NULL,
    CONSTRAINT uq_buddy_dismissal UNIQUE (user_id, dismissed_user_id, gym_id),
    CONSTRAINT chk_no_self_dismissal CHECK (user_id != dismissed_user_id)
);

CREATE INDEX IF NOT EXISTS idx_buddy_dismissals_active
ON public.gym_buddy_dismissals (user_id, gym_id, expires_at);

ALTER TABLE public.gym_buddy_dismissals ENABLE ROW LEVEL SECURITY;


-- 4. GYM BUDDY BLOCKS TABLE (Global User-to-User Safety -- No gym_id)
CREATE TABLE IF NOT EXISTS public.gym_buddy_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_no_self_block CHECK (blocker_id != blocked_id),
    CONSTRAINT uq_buddy_block_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_buddy_blocks_blocker ON public.gym_buddy_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_buddy_blocks_blocked ON public.gym_buddy_blocks (blocked_id);

ALTER TABLE public.gym_buddy_blocks ENABLE ROW LEVEL SECURITY;


-- 5. GYM BUDDY REPORTS TABLE (Facility Owner Conduct Moderation)
CREATE TABLE IF NOT EXISTS public.gym_buddy_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('harassment', 'inappropriate_behavior', 'unsolicited_contact', 'impersonation', 'spam', 'safety_concern', 'other')),
    details TEXT CHECK (details IS NULL OR char_length(trim(details)) <= 500),
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_no_self_report CHECK (reporter_id != reported_id),
    CONSTRAINT uq_buddy_report_once UNIQUE (reporter_id, reported_id, gym_id)
);

CREATE INDEX IF NOT EXISTS idx_buddy_reports_gym ON public.gym_buddy_reports (gym_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buddy_reports_reporter ON public.gym_buddy_reports (reporter_id);

ALTER TABLE public.gym_buddy_reports ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- 6A. GYM BUDDY PREFERENCES
-- HARDENING: Direct client INSERT/UPDATE/DELETE are DENIED on gym_buddy_preferences.
-- All mutations MUST route through set_gym_buddy_opt_in RPC because opt-out has
-- a mandatory atomic side-effect: cancel all pending outgoing requests.
-- Allowing direct UPDATE would bypass that invariant.

DROP POLICY IF EXISTS "Members manage own buddy preferences" ON public.gym_buddy_preferences;

DROP POLICY IF EXISTS "Members read own buddy preferences" ON public.gym_buddy_preferences;
CREATE POLICY "Members read own buddy preferences"
ON public.gym_buddy_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Active peers view opted in buddy preferences" ON public.gym_buddy_preferences;
CREATE POLICY "Active peers view opted in buddy preferences"
ON public.gym_buddy_preferences FOR SELECT
TO authenticated
USING (
    is_opted_in = TRUE
    AND EXISTS (
        SELECT 1 FROM public.gym_memberships m
        WHERE m.gym_id = gym_buddy_preferences.gym_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
    )
);

DROP POLICY IF EXISTS "Deny direct client insert on preferences" ON public.gym_buddy_preferences;
CREATE POLICY "Deny direct client insert on preferences"
ON public.gym_buddy_preferences FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on preferences" ON public.gym_buddy_preferences;
CREATE POLICY "Deny direct client update on preferences"
ON public.gym_buddy_preferences FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client delete on preferences" ON public.gym_buddy_preferences;
CREATE POLICY "Deny direct client delete on preferences"
ON public.gym_buddy_preferences FOR DELETE
TO authenticated
USING (FALSE);


-- 6B. GYM BUDDY CONNECTIONS (Participant-Only)
DROP POLICY IF EXISTS "Participants view own buddy connections" ON public.gym_buddy_connections;
CREATE POLICY "Participants view own buddy connections"
ON public.gym_buddy_connections FOR SELECT
TO authenticated
USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

DROP POLICY IF EXISTS "Deny direct client insert on connections" ON public.gym_buddy_connections;
CREATE POLICY "Deny direct client insert on connections"
ON public.gym_buddy_connections FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on connections" ON public.gym_buddy_connections;
CREATE POLICY "Deny direct client update on connections"
ON public.gym_buddy_connections FOR UPDATE
TO authenticated
USING (FALSE);

-- 6C. GYM BUDDY DISMISSALS
DROP POLICY IF EXISTS "Members manage own dismissals" ON public.gym_buddy_dismissals;
CREATE POLICY "Members manage own dismissals"
ON public.gym_buddy_dismissals FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6D. GYM BUDDY BLOCKS
DROP POLICY IF EXISTS "Blockers view own blocks" ON public.gym_buddy_blocks;
CREATE POLICY "Blockers view own blocks"
ON public.gym_buddy_blocks FOR SELECT
TO authenticated
USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Blockers insert own blocks" ON public.gym_buddy_blocks;
CREATE POLICY "Blockers insert own blocks"
ON public.gym_buddy_blocks FOR INSERT
TO authenticated
WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Blockers delete own blocks" ON public.gym_buddy_blocks;
CREATE POLICY "Blockers delete own blocks"
ON public.gym_buddy_blocks FOR DELETE
TO authenticated
USING (blocker_id = auth.uid());

-- 6E. GYM BUDDY REPORTS
DROP POLICY IF EXISTS "Reporters view own filed reports" ON public.gym_buddy_reports;
CREATE POLICY "Reporters view own filed reports"
ON public.gym_buddy_reports FOR SELECT
TO authenticated
USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Reporters create reports" ON public.gym_buddy_reports;
CREATE POLICY "Reporters create reports"
ON public.gym_buddy_reports FOR INSERT
TO authenticated
WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.gym_memberships m
        WHERE m.gym_id = gym_buddy_reports.gym_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
    )
);

DROP POLICY IF EXISTS "Facility owners view facility buddy reports" ON public.gym_buddy_reports;
CREATE POLICY "Facility owners view facility buddy reports"
ON public.gym_buddy_reports FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_buddy_reports.gym_id
          AND g.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Facility owners update report status" ON public.gym_buddy_reports;
CREATE POLICY "Facility owners update report status"
ON public.gym_buddy_reports FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_buddy_reports.gym_id
          AND g.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_buddy_reports.gym_id
          AND g.owner_id = auth.uid()
    )
);


-- ==============================================================================
-- 7. AUTHORITATIVE STORED PROCEDURES (RPCs)
-- ==============================================================================

-- 7A. CANDIDATE DISCOVERY RPC
-- 30-day exclude window for declined connections
-- 14-day exclude window for dismissals
-- Symmetric gender filter: BOTH participants must satisfy EACH OTHER's gender filter
CREATE OR REPLACE FUNCTION public.get_gym_buddy_candidates(
    p_gym_id UUID,
    p_limit INT DEFAULT 15,
    p_cursor_score INT DEFAULT NULL,
    p_cursor_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_opted_in BOOLEAN;
    v_caller_role TEXT;
    v_caller_membership TEXT;
    v_caller_gender TEXT;
    v_caller_gender_filter TEXT;
    v_caller_time TEXT;
    v_caller_days INT[];
    v_caller_goal TEXT;
    v_caller_exp TEXT;
    v_caller_duration INT;
    v_caller_freq INT;
    v_candidates JSONB;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT status INTO v_caller_membership
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND user_id = v_caller_id;

    IF v_caller_membership IS NULL OR v_caller_membership != 'active' THEN
        RAISE EXCEPTION 'Active membership at this gym is required';
    END IF;

    SELECT account_role INTO v_caller_role
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role = 'gym_owner' THEN
        RAISE EXCEPTION 'Gym owners cannot participate in member buddy matching';
    END IF;

    SELECT is_opted_in, preferred_training_time, preferred_training_days, preferred_gender_filter
    INTO v_caller_opted_in, v_caller_time, v_caller_days, v_caller_gender_filter
    FROM public.gym_buddy_preferences
    WHERE user_id = v_caller_id AND gym_id = p_gym_id;

    IF v_caller_opted_in IS NOT TRUE THEN
        RETURN jsonb_build_object('opted_in', false, 'candidates', '[]'::jsonb);
    END IF;

    SELECT goal, experience_level, workout_duration_minutes, days_per_week, gender
    INTO v_caller_goal, v_caller_exp, v_caller_duration, v_caller_freq, v_caller_gender
    FROM public.fitness_profiles
    WHERE user_id = v_caller_id;

    WITH peer_candidates AS (
        SELECT
            p.user_id,
            pr.display_name,
            pr.avatar_url,
            p.preferred_training_time,
            p.preferred_training_days,
            p.bio_note,
            p.preferred_gender_filter AS peer_gender_filter,
            fp.goal,
            fp.experience_level,
            fp.workout_duration_minutes,
            fp.days_per_week,
            fp.gender,
            (
                (CASE
                    WHEN p.preferred_training_time = v_caller_time THEN 18
                    WHEN (p.preferred_training_time = 'early_morning' AND v_caller_time = 'morning') OR
                         (p.preferred_training_time = 'morning' AND v_caller_time = 'early_morning') OR
                         (p.preferred_training_time = 'morning' AND v_caller_time = 'afternoon') OR
                         (p.preferred_training_time = 'afternoon' AND v_caller_time = 'morning') OR
                         (p.preferred_training_time = 'afternoon' AND v_caller_time = 'evening') OR
                         (p.preferred_training_time = 'evening' AND v_caller_time = 'afternoon') OR
                         (p.preferred_training_time = 'evening' AND v_caller_time = 'night') OR
                         (p.preferred_training_time = 'night' AND v_caller_time = 'evening') THEN 9
                    ELSE 0
                END)
                +
                ROUND(12.0 * COALESCE(
                    (SELECT COUNT(*)::NUMERIC
                     FROM unnest(p.preferred_training_days) d1
                     WHERE d1 = ANY(v_caller_days)) /
                    NULLIF((SELECT COUNT(DISTINCT d2)::NUMERIC
                            FROM unnest(array_cat(p.preferred_training_days, v_caller_days)) d2), 0),
                    0.0
                ))
                +
                (CASE
                    WHEN fp.goal = v_caller_goal THEN 25
                    WHEN (fp.goal = 'muscle_gain' AND v_caller_goal = 'strength') OR
                         (fp.goal = 'strength' AND v_caller_goal = 'muscle_gain') OR
                         (fp.goal = 'fat_loss' AND v_caller_goal = 'endurance') OR
                         (fp.goal = 'endurance' AND v_caller_goal = 'fat_loss') OR
                         (fp.goal = 'maintenance' AND v_caller_goal IN ('muscle_gain', 'fat_loss')) OR
                         (v_caller_goal = 'maintenance' AND fp.goal IN ('muscle_gain', 'fat_loss')) THEN 18
                    ELSE 8
                END)
                +
                (CASE
                    WHEN fp.experience_level = v_caller_exp THEN 20
                    WHEN (fp.experience_level = 'beginner' AND v_caller_exp = 'intermediate') OR
                         (fp.experience_level = 'intermediate' AND v_caller_exp = 'beginner') OR
                         (fp.experience_level = 'intermediate' AND v_caller_exp = 'advanced') OR
                         (fp.experience_level = 'advanced' AND v_caller_exp = 'intermediate') THEN 12
                    ELSE 4
                END)
                +
                (CASE
                    WHEN ABS(fp.workout_duration_minutes - v_caller_duration) <= 15 THEN 15
                    WHEN ABS(fp.workout_duration_minutes - v_caller_duration) <= 30 THEN 10
                    WHEN ABS(fp.workout_duration_minutes - v_caller_duration) <= 45 THEN 5
                    ELSE 0
                END)
                +
                (CASE
                    WHEN ABS(fp.days_per_week - v_caller_freq) = 0 THEN 10
                    WHEN ABS(fp.days_per_week - v_caller_freq) = 1 THEN 7
                    WHEN ABS(fp.days_per_week - v_caller_freq) = 2 THEN 4
                    ELSE 0
                END)
            )::INT AS score,
            (SELECT COUNT(*) FROM unnest(p.preferred_training_days) d3 WHERE d3 = ANY(v_caller_days)) AS days_overlap_count
        FROM public.gym_buddy_preferences p
        JOIN public.profiles pr ON pr.id = p.user_id
        JOIN public.fitness_profiles fp ON fp.user_id = p.user_id
        JOIN public.gym_memberships gm ON gm.user_id = p.user_id AND gm.gym_id = p_gym_id
        WHERE p.gym_id = p_gym_id
          AND p.user_id != v_caller_id
          AND p.is_opted_in = TRUE
          AND gm.status = 'active'
          AND pr.account_role = 'member'
          AND NOT EXISTS (
              SELECT 1 FROM public.gym_buddy_blocks b
              WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.user_id)
                 OR (b.blocker_id = p.user_id AND b.blocked_id = v_caller_id)
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.gym_buddy_connections c
              WHERE c.gym_id = p_gym_id
                AND c.user_a_id = LEAST(v_caller_id, p.user_id)
                AND c.user_b_id = GREATEST(v_caller_id, p.user_id)
                AND c.status IN ('pending', 'accepted')
          )
          -- Dismissal: 14-day window
          AND NOT EXISTS (
              SELECT 1 FROM public.gym_buddy_dismissals d
              WHERE d.user_id = v_caller_id
                AND d.dismissed_user_id = p.user_id
                AND d.gym_id = p_gym_id
                AND d.expires_at > NOW()
          )
          -- HARDENING: Declined cooldown is 30 days (not 7)
          AND NOT EXISTS (
              SELECT 1 FROM public.gym_buddy_connections dc
              WHERE dc.gym_id = p_gym_id
                AND dc.user_a_id = LEAST(v_caller_id, p.user_id)
                AND dc.user_b_id = GREATEST(v_caller_id, p.user_id)
                AND dc.status = 'declined'
                AND dc.updated_at > (NOW() - INTERVAL '30 days')
          )
          -- HARDENING: Symmetric gender filter
          -- Caller's filter must allow the peer:
          AND (
              v_caller_gender_filter = 'any' OR
              (v_caller_gender_filter = 'same_gender' AND fp.gender = v_caller_gender)
          )
          -- Peer's filter must allow the caller:
          AND (
              p.preferred_gender_filter = 'any' OR
              (p.preferred_gender_filter = 'same_gender' AND v_caller_gender = fp.gender)
          )
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'userId', c.user_id,
            'displayName', c.display_name,
            'avatarUrl', c.avatar_url,
            'preferredTrainingTime', c.preferred_training_time,
            'preferredTrainingDays', c.preferred_training_days,
            'bioNote', c.bio_note,
            'goal', c.goal,
            'experienceLevel', c.experience_level,
            'workoutDurationMinutes', c.workout_duration_minutes,
            'daysPerWeek', c.days_per_week,
            'compatibilityScore', c.score,
            'matchReasons', jsonb_build_array(
                CASE WHEN c.goal = v_caller_goal THEN jsonb_build_object('type', 'goal', 'label', 'Same Goal: ' || c.goal) ELSE NULL END,
                CASE WHEN c.preferred_training_time = v_caller_time THEN jsonb_build_object('type', 'time', 'label', 'Same Schedule: ' || c.preferred_training_time) ELSE NULL END,
                CASE WHEN c.days_overlap_count > 0 THEN jsonb_build_object('type', 'days', 'label', c.days_overlap_count || ' Overlapping Days') ELSE NULL END,
                CASE WHEN c.experience_level = v_caller_exp THEN jsonb_build_object('type', 'experience', 'label', 'Same Level: ' || c.experience_level) ELSE NULL END,
                CASE WHEN ABS(c.workout_duration_minutes - v_caller_duration) <= 15 THEN jsonb_build_object('type', 'duration', 'label', 'Similar Duration: ~' || c.workout_duration_minutes || 'm') ELSE NULL END
            ) - 'null'
        )
    ) INTO v_candidates
    FROM (
        SELECT * FROM peer_candidates
        WHERE score >= 40
          AND (
              p_cursor_score IS NULL OR
              score < p_cursor_score OR
              (score = p_cursor_score AND user_id > p_cursor_user_id)
          )
        ORDER BY score DESC, days_overlap_count DESC, user_id ASC
        LIMIT LEAST(p_limit, 20)
    ) c;

    RETURN jsonb_build_object(
        'opted_in', true,
        'candidates', COALESCE(v_candidates, '[]'::jsonb)
    );
END;
$$;


-- 7B. SEND GYM BUDDY REQUEST RPC
-- Profile row lock acquired BEFORE counting pending/active buddies.
-- Prevents concurrent same-caller sends from both completing when quota = max-1.
CREATE OR REPLACE FUNCTION public.send_gym_buddy_request(
    p_gym_id UUID,
    p_target_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_user_a UUID;
    v_user_b UUID;
    v_caller_plan TEXT;
    v_pending_count INT;
    v_active_count INT;
    v_caller_membership TEXT;
    v_target_membership TEXT;
    v_target_opted_in BOOLEAN;
    v_new_connection_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF v_caller_id = p_target_user_id THEN
        RAISE EXCEPTION 'Cannot send buddy request to self';
    END IF;

    SELECT status INTO v_caller_membership
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND user_id = v_caller_id;

    IF v_caller_membership IS NULL OR v_caller_membership != 'active' THEN
        RAISE EXCEPTION 'Caller does not have an active membership at this gym';
    END IF;

    SELECT status INTO v_target_membership
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND user_id = p_target_user_id;

    IF v_target_membership IS NULL OR v_target_membership != 'active' THEN
        RAISE EXCEPTION 'Target athlete does not have an active membership at this gym';
    END IF;

    SELECT is_opted_in INTO v_target_opted_in
    FROM public.gym_buddy_preferences
    WHERE user_id = p_target_user_id AND gym_id = p_gym_id;

    IF v_target_opted_in IS NOT TRUE THEN
        RAISE EXCEPTION 'Target athlete has not opted in to buddy matching';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.gym_buddy_blocks
        WHERE (blocker_id = v_caller_id AND blocked_id = p_target_user_id)
           OR (blocker_id = p_target_user_id AND blocked_id = v_caller_id)
    ) THEN
        RAISE EXCEPTION 'Interaction blocked';
    END IF;

    -- HARDENING: Lock caller profile FOR UPDATE before quota evaluation.
    -- Concurrent calls by the same user serialize here.
    SELECT plan_type INTO v_caller_plan
    FROM public.profiles
    WHERE id = v_caller_id
    FOR UPDATE;

    SELECT COUNT(*) INTO v_pending_count
    FROM public.gym_buddy_connections
    WHERE requester_id = v_caller_id AND status = 'pending';

    IF v_pending_count >= 5 THEN
        RAISE EXCEPTION 'PENDING_LIMIT_REACHED: Maximum 5 pending requests allowed';
    END IF;

    IF v_caller_plan = 'free' THEN
        SELECT COUNT(*) INTO v_active_count
        FROM public.gym_buddy_connections
        WHERE (user_a_id = v_caller_id OR user_b_id = v_caller_id)
          AND status = 'accepted';

        IF v_active_count >= 3 THEN
            RAISE EXCEPTION 'FREE_TIER_LIMIT_REACHED: Free tier is limited to 3 active gym buddies';
        END IF;
    END IF;

    v_user_a := LEAST(v_caller_id, p_target_user_id);
    v_user_b := GREATEST(v_caller_id, p_target_user_id);

    IF EXISTS (
        SELECT 1 FROM public.gym_buddy_connections
        WHERE gym_id = p_gym_id
          AND user_a_id = v_user_a
          AND user_b_id = v_user_b
          AND status IN ('pending', 'accepted')
    ) THEN
        RAISE EXCEPTION 'An active or pending connection already exists for this pair';
    END IF;

    INSERT INTO public.gym_buddy_connections (
        gym_id, user_a_id, user_b_id, requester_id, status, requested_at
    )
    VALUES (
        p_gym_id, v_user_a, v_user_b, v_caller_id, 'pending', NOW()
    )
    RETURNING id INTO v_new_connection_id;

    RETURN v_new_connection_id;
END;
$$;


-- 7C. RESPOND TO GYM BUDDY REQUEST RPC (Accept / Decline)
-- HARDENING: Both profile rows locked in LEAST/GREATEST UUID order to prevent deadlocks.
CREATE OR REPLACE FUNCTION public.respond_gym_buddy_request(
    p_connection_id UUID,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_conn RECORD;
    v_receiver_plan TEXT;
    v_requester_plan TEXT;
    v_receiver_active_count INT;
    v_requester_active_count INT;
    v_lock_first UUID;
    v_lock_second UUID;
    v_lock_first_plan TEXT;
    v_lock_second_plan TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_action NOT IN ('accept', 'decline') THEN
        RAISE EXCEPTION 'Invalid action: must be accept or decline';
    END IF;

    SELECT * INTO v_conn
    FROM public.gym_buddy_connections
    WHERE id = p_connection_id
    FOR UPDATE;

    IF v_conn IS NULL THEN
        RAISE EXCEPTION 'Connection request not found';
    END IF;

    IF v_conn.status != 'pending' THEN
        RAISE EXCEPTION 'Connection request is not in pending status';
    END IF;

    IF v_conn.requester_id = v_caller_id OR (v_conn.user_a_id != v_caller_id AND v_conn.user_b_id != v_caller_id) THEN
        RAISE EXCEPTION 'Only the recipient of a buddy request may respond to it';
    END IF;

    IF p_action = 'decline' THEN
        UPDATE public.gym_buddy_connections
        SET status = 'declined',
            ended_at = NOW(),
            updated_at = NOW()
        WHERE id = p_connection_id;
        RETURN TRUE;
    END IF;

    -- HARDENING: Lock BOTH profile rows in deterministic UUID order.
    -- Always lock LEAST(caller, requester) first, then GREATEST.
    -- Prevents deadlock when two concurrent transactions lock the same pair in opposite order.
    v_lock_first  := LEAST(v_caller_id, v_conn.requester_id);
    v_lock_second := GREATEST(v_caller_id, v_conn.requester_id);

    SELECT plan_type INTO v_lock_first_plan
    FROM public.profiles WHERE id = v_lock_first FOR UPDATE;

    SELECT plan_type INTO v_lock_second_plan
    FROM public.profiles WHERE id = v_lock_second FOR UPDATE;

    IF v_lock_first = v_caller_id THEN
        v_receiver_plan  := v_lock_first_plan;
        v_requester_plan := v_lock_second_plan;
    ELSE
        v_requester_plan := v_lock_first_plan;
        v_receiver_plan  := v_lock_second_plan;
    END IF;

    IF v_receiver_plan = 'free' THEN
        SELECT COUNT(*) INTO v_receiver_active_count
        FROM public.gym_buddy_connections
        WHERE (user_a_id = v_caller_id OR user_b_id = v_caller_id)
          AND status = 'accepted';

        IF v_receiver_active_count >= 3 THEN
            RAISE EXCEPTION 'FREE_TIER_LIMIT_REACHED: Free tier is limited to 3 active gym buddies';
        END IF;
    END IF;

    IF v_requester_plan = 'free' THEN
        SELECT COUNT(*) INTO v_requester_active_count
        FROM public.gym_buddy_connections
        WHERE (user_a_id = v_conn.requester_id OR user_b_id = v_conn.requester_id)
          AND status = 'accepted';

        IF v_requester_active_count >= 3 THEN
            RAISE EXCEPTION 'FREE_TIER_LIMIT_REACHED: Requester has reached the free tier limit of 3 active gym buddies';
        END IF;
    END IF;

    UPDATE public.gym_buddy_connections
    SET status = 'accepted',
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_connection_id;

    RETURN TRUE;
END;
$$;


-- 7D. CANCEL GYM BUDDY REQUEST RPC
CREATE OR REPLACE FUNCTION public.cancel_gym_buddy_request(
    p_connection_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_conn RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_conn
    FROM public.gym_buddy_connections
    WHERE id = p_connection_id
    FOR UPDATE;

    IF v_conn IS NULL THEN
        RAISE EXCEPTION 'Connection not found';
    END IF;

    IF v_conn.requester_id != v_caller_id THEN
        RAISE EXCEPTION 'Only the sender can cancel a pending request';
    END IF;

    IF v_conn.status != 'pending' THEN
        RAISE EXCEPTION 'Only pending requests can be cancelled';
    END IF;

    UPDATE public.gym_buddy_connections
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_connection_id;

    RETURN TRUE;
END;
$$;


-- 7E. UNMATCH GYM BUDDY RPC
CREATE OR REPLACE FUNCTION public.unmatch_gym_buddy(
    p_connection_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_conn RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_conn
    FROM public.gym_buddy_connections
    WHERE id = p_connection_id
    FOR UPDATE;

    IF v_conn IS NULL THEN
        RAISE EXCEPTION 'Connection not found';
    END IF;

    IF v_conn.user_a_id != v_caller_id AND v_conn.user_b_id != v_caller_id THEN
        RAISE EXCEPTION 'Only active participants can unmatch';
    END IF;

    IF v_conn.status != 'accepted' THEN
        RAISE EXCEPTION 'Only accepted buddy relationships can be unmatched';
    END IF;

    UPDATE public.gym_buddy_connections
    SET status = 'ended',
        ended_at = NOW(),
        updated_at = NOW()
    WHERE id = p_connection_id;

    RETURN TRUE;
END;
$$;


-- 7F. GLOBAL BLOCK GYM BUDDY RPC
CREATE OR REPLACE FUNCTION public.block_gym_buddy(
    p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF v_caller_id = p_target_user_id THEN
        RAISE EXCEPTION 'Cannot block self';
    END IF;

    INSERT INTO public.gym_buddy_blocks (blocker_id, blocked_id)
    VALUES (v_caller_id, p_target_user_id)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

    UPDATE public.gym_buddy_connections
    SET status = 'ended',
        ended_at = NOW(),
        blocked_by = v_caller_id,
        updated_at = NOW()
    WHERE (user_a_id = LEAST(v_caller_id, p_target_user_id) AND user_b_id = GREATEST(v_caller_id, p_target_user_id))
      AND status IN ('pending', 'accepted');

    RETURN TRUE;
END;
$$;


-- 7G. UNBLOCK GYM BUDDY RPC
CREATE OR REPLACE FUNCTION public.unblock_gym_buddy(
    p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    DELETE FROM public.gym_buddy_blocks
    WHERE blocker_id = v_caller_id AND blocked_id = p_target_user_id;

    RETURN TRUE;
END;
$$;


-- 7H. DISMISS GYM BUDDY CANDIDATE RPC (Cyclic 14-day Upsert)
CREATE OR REPLACE FUNCTION public.dismiss_gym_buddy(
    p_gym_id UUID,
    p_dismissed_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF v_caller_id = p_dismissed_user_id THEN
        RAISE EXCEPTION 'Cannot dismiss self';
    END IF;

    INSERT INTO public.gym_buddy_dismissals (
        user_id, dismissed_user_id, gym_id, dismissed_at, expires_at
    )
    VALUES (
        v_caller_id, p_dismissed_user_id, p_gym_id, NOW(), NOW() + INTERVAL '14 days'
    )
    ON CONFLICT (user_id, dismissed_user_id, gym_id)
    DO UPDATE SET
        dismissed_at = NOW(),
        expires_at = NOW() + INTERVAL '14 days';

    RETURN TRUE;
END;
$$;


-- 7I. REPORT GYM BUDDY RPC
CREATE OR REPLACE FUNCTION public.report_gym_buddy(
    p_gym_id UUID,
    p_reported_user_id UUID,
    p_reason TEXT,
    p_details TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_report_id UUID;
    v_caller_membership TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF v_caller_id = p_reported_user_id THEN
        RAISE EXCEPTION 'Cannot report self';
    END IF;

    SELECT status INTO v_caller_membership
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND user_id = v_caller_id;

    IF v_caller_membership IS NULL OR v_caller_membership != 'active' THEN
        RAISE EXCEPTION 'Active membership at this gym is required to report';
    END IF;

    INSERT INTO public.gym_buddy_reports (
        gym_id, reporter_id, reported_id, reason, details
    )
    VALUES (
        p_gym_id, v_caller_id, p_reported_user_id, p_reason, p_details
    )
    RETURNING id INTO v_report_id;

    RETURN v_report_id;
END;
$$;


-- 7J. SET GYM BUDDY OPT-IN RPC
-- ONLY authoritative path for mutating gym_buddy_preferences.
-- Opt-out atomically cancels all pending outgoing requests while leaving accepted relationships intact.
-- Direct client INSERT/UPDATE/DELETE on gym_buddy_preferences is RLS-denied.
CREATE OR REPLACE FUNCTION public.set_gym_buddy_opt_in(
    p_gym_id UUID,
    p_opt_in BOOLEAN,
    p_preferred_training_time TEXT DEFAULT NULL,
    p_preferred_training_days INT[] DEFAULT NULL,
    p_preferred_gender_filter TEXT DEFAULT NULL,
    p_bio_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_membership TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT status INTO v_caller_membership
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND user_id = v_caller_id;

    IF v_caller_membership IS NULL OR v_caller_membership != 'active' THEN
        RAISE EXCEPTION 'Active membership at this gym is required';
    END IF;

    IF p_preferred_training_time IS NOT NULL AND
       p_preferred_training_time NOT IN ('early_morning', 'morning', 'afternoon', 'evening', 'night') THEN
        RAISE EXCEPTION 'Invalid training time window';
    END IF;

    IF p_preferred_gender_filter IS NOT NULL AND
       p_preferred_gender_filter NOT IN ('any', 'same_gender') THEN
        RAISE EXCEPTION 'Invalid gender filter value';
    END IF;

    IF p_bio_note IS NOT NULL AND char_length(trim(p_bio_note)) > 160 THEN
        RAISE EXCEPTION 'Bio note cannot exceed 160 characters';
    END IF;

    INSERT INTO public.gym_buddy_preferences (
        user_id, gym_id, is_opted_in,
        preferred_training_time, preferred_training_days,
        preferred_gender_filter, bio_note
    )
    VALUES (
        v_caller_id, p_gym_id, p_opt_in,
        COALESCE(p_preferred_training_time, 'evening'),
        COALESCE(p_preferred_training_days, '{1,2,3,4,5}'::INT[]),
        COALESCE(p_preferred_gender_filter, 'any'),
        NULLIF(trim(COALESCE(p_bio_note, '')), '')
    )
    ON CONFLICT (user_id, gym_id)
    DO UPDATE SET
        is_opted_in = p_opt_in,
        preferred_training_time = COALESCE(p_preferred_training_time, gym_buddy_preferences.preferred_training_time),
        preferred_training_days = COALESCE(p_preferred_training_days, gym_buddy_preferences.preferred_training_days),
        preferred_gender_filter = COALESCE(p_preferred_gender_filter, gym_buddy_preferences.preferred_gender_filter),
        bio_note = CASE
            WHEN p_bio_note IS NOT NULL THEN NULLIF(trim(p_bio_note), '')
            ELSE gym_buddy_preferences.bio_note
        END,
        updated_at = NOW();

    -- ATOMIC SIDE-EFFECT: Opting out cancels ALL pending OUTGOING requests across all gyms.
    -- Accepted buddy relationships are intentionally preserved (unmatch/block are separate).
    IF p_opt_in IS FALSE THEN
        UPDATE public.gym_buddy_connections
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE requester_id = v_caller_id
          AND status = 'pending';
    END IF;

    RETURN TRUE;
END;
$$;
