-- ==============================================================================
-- FITBOOST MIGRATION: COMBINED PHASE G4 + G5
-- 1. G4 Personal 1:1 Buddy Chat (gym_chat_messages)
-- 2. G5-A Gym Challenges (gym_challenges, gym_challenge_participants, gym_challenge_progress_events)
-- 3. G5-B Gym Leaderboard (get_gym_challenge_leaderboard RPC)
-- ==============================================================================

-- ==============================================================================
-- PART 1: G4 PERSONAL 1:1 BUDDY CHAT
-- ==============================================================================

-- 1. GYM CHAT MESSAGES
-- Strictly anchored to accepted gym_buddy_connections.id
CREATE TABLE IF NOT EXISTS public.gym_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.gym_buddy_connections(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) >= 1 AND char_length(content) <= 2000),
    read_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Performance & Pagination Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conn_created
ON public.gym_chat_messages (connection_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
ON public.gym_chat_messages (connection_id, read_at)
WHERE read_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_rate
ON public.gym_chat_messages (sender_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.gym_chat_messages ENABLE ROW LEVEL SECURITY;

-- 2. CHAT RLS POLICIES
-- A. SELECT: Participants of the underlying gym_buddy_connection only
DROP POLICY IF EXISTS "Participants view conversation messages" ON public.gym_chat_messages;
CREATE POLICY "Participants view conversation messages"
ON public.gym_chat_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gym_buddy_connections c
        WHERE c.id = gym_chat_messages.connection_id
          AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
);

-- B. INSERT: Denied directly via client; all creation must route through authoritative send_gym_chat_message RPC
DROP POLICY IF EXISTS "Deny direct client insert on chat messages" ON public.gym_chat_messages;
CREATE POLICY "Deny direct client insert on chat messages"
ON public.gym_chat_messages FOR INSERT
TO authenticated
WITH CHECK (FALSE);

-- C. UPDATE: Denied directly via client; message editing, soft-delete, and read receipts must route through authoritative RPCs
DROP POLICY IF EXISTS "Participants update chat messages" ON public.gym_chat_messages;
DROP POLICY IF EXISTS "Deny direct client update on chat messages" ON public.gym_chat_messages;
CREATE POLICY "Deny direct client update on chat messages"
ON public.gym_chat_messages FOR UPDATE
TO authenticated
USING (FALSE);

-- D. DELETE: Denied directly (soft delete via deleted_at only)
DROP POLICY IF EXISTS "Deny direct client delete on chat messages" ON public.gym_chat_messages;
CREATE POLICY "Deny direct client delete on chat messages"
ON public.gym_chat_messages FOR DELETE
TO authenticated
USING (FALSE);


-- 3. CHAT RPC: send_gym_chat_message
CREATE OR REPLACE FUNCTION public.send_gym_chat_message(
    p_connection_id UUID,
    p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_conn RECORD;
    v_peer_id UUID;
    v_recent_count INT;
    v_sanitized_content TEXT;
    v_message RECORD;
BEGIN
    -- 1. Authentication Check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Validate Content
    v_sanitized_content := trim(p_content);
    IF v_sanitized_content IS NULL OR char_length(v_sanitized_content) = 0 THEN
        RAISE EXCEPTION 'Message content cannot be empty' USING ERRCODE = '40001';
    END IF;
    IF char_length(v_sanitized_content) > 2000 THEN
        RAISE EXCEPTION 'Message exceeds 2000 character limit' USING ERRCODE = '40002';
    END IF;

    -- 3. Fetch Connection & Validate Participant
    SELECT * INTO v_conn
    FROM public.gym_buddy_connections
    WHERE id = p_connection_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connection not found' USING ERRCODE = '40401';
    END IF;

    IF v_conn.user_a_id != v_caller_id AND v_conn.user_b_id != v_caller_id THEN
        RAISE EXCEPTION 'Unauthorized: You are not a participant in this connection' USING ERRCODE = '40301';
    END IF;

    -- 4. Validate Connection Status
    IF v_conn.status != 'accepted' THEN
        RAISE EXCEPTION 'Cannot send message: Connection is not active (status: %)', v_conn.status USING ERRCODE = '40003';
    END IF;

    -- 5. Determine Peer ID
    IF v_conn.user_a_id = v_caller_id THEN
        v_peer_id := v_conn.user_b_id;
    ELSE
        v_peer_id := v_conn.user_a_id;
    END IF;

    -- 6. Check Global Blocks
    IF EXISTS (
        SELECT 1 FROM public.gym_buddy_blocks
        WHERE (blocker_id = v_caller_id AND blocked_id = v_peer_id)
           OR (blocker_id = v_peer_id AND blocked_id = v_caller_id)
    ) THEN
        RAISE EXCEPTION 'Cannot send message: User is blocked' USING ERRCODE = '40302';
    END IF;

    -- 7. Rate Limiting: Max 30 messages in the last 60 seconds
    SELECT COUNT(*) INTO v_recent_count
    FROM public.gym_chat_messages
    WHERE sender_id = v_caller_id
      AND created_at > (NOW() - INTERVAL '60 seconds');

    IF v_recent_count >= 30 THEN
        RAISE EXCEPTION 'Rate limit exceeded: Please wait before sending more messages' USING ERRCODE = '42900';
    END IF;

    -- 8. Insert Message
    INSERT INTO public.gym_chat_messages (
        connection_id,
        sender_id,
        content
    )
    VALUES (
        p_connection_id,
        v_caller_id,
        v_sanitized_content
    )
    RETURNING * INTO v_message;

    RETURN jsonb_build_object(
        'id', v_message.id,
        'connection_id', v_message.connection_id,
        'sender_id', v_message.sender_id,
        'content', v_message.content,
        'read_at', v_message.read_at,
        'edited_at', v_message.edited_at,
        'deleted_at', v_message.deleted_at,
        'created_at', v_message.created_at,
        'updated_at', v_message.updated_at
    );
END;
$$;


-- 4. CHAT RPC: mark_gym_chat_read
CREATE OR REPLACE FUNCTION public.mark_gym_chat_read(
    p_connection_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_updated_count INT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Validate caller is participant
    IF NOT EXISTS (
        SELECT 1 FROM public.gym_buddy_connections
        WHERE id = p_connection_id
          AND (user_a_id = v_caller_id OR user_b_id = v_caller_id)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You are not a participant in this connection' USING ERRCODE = '40301';
    END IF;

    -- Mark all unread incoming messages as read
    UPDATE public.gym_chat_messages
    SET read_at = NOW(),
        updated_at = NOW()
    WHERE connection_id = p_connection_id
      AND sender_id != v_caller_id
      AND read_at IS NULL
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;


-- 5. CHAT RPC: edit_gym_chat_message
CREATE OR REPLACE FUNCTION public.edit_gym_chat_message(
    p_message_id UUID,
    p_new_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_sanitized_content TEXT;
    v_message RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    v_sanitized_content := trim(p_new_content);
    IF v_sanitized_content IS NULL OR char_length(v_sanitized_content) = 0 THEN
        RAISE EXCEPTION 'Message content cannot be empty' USING ERRCODE = '40001';
    END IF;
    IF char_length(v_sanitized_content) > 2000 THEN
        RAISE EXCEPTION 'Message exceeds 2000 character limit' USING ERRCODE = '40002';
    END IF;

    SELECT * INTO v_message
    FROM public.gym_chat_messages
    WHERE id = p_message_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found' USING ERRCODE = '40401';
    END IF;

    IF v_message.sender_id != v_caller_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only edit your own messages' USING ERRCODE = '40301';
    END IF;

    IF v_message.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot edit a deleted message' USING ERRCODE = '40004';
    END IF;

    UPDATE public.gym_chat_messages
    SET content = v_sanitized_content,
        edited_at = NOW(),
        updated_at = NOW()
    WHERE id = p_message_id
    RETURNING * INTO v_message;

    RETURN jsonb_build_object(
        'id', v_message.id,
        'connection_id', v_message.connection_id,
        'sender_id', v_message.sender_id,
        'content', v_message.content,
        'read_at', v_message.read_at,
        'edited_at', v_message.edited_at,
        'deleted_at', v_message.deleted_at,
        'created_at', v_message.created_at,
        'updated_at', v_message.updated_at
    );
END;
$$;


-- 6. CHAT RPC: delete_gym_chat_message (soft delete)
CREATE OR REPLACE FUNCTION public.delete_gym_chat_message(
    p_message_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_message RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    SELECT * INTO v_message
    FROM public.gym_chat_messages
    WHERE id = p_message_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found' USING ERRCODE = '40401';
    END IF;

    IF v_message.sender_id != v_caller_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own messages' USING ERRCODE = '40301';
    END IF;

    UPDATE public.gym_chat_messages
    SET deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_message_id;

    RETURN TRUE;
END;
$$;


-- ==============================================================================
-- PART 2: G5-A GYM CHALLENGES
-- ==============================================================================

-- 1. GYM CHALLENGES TABLE
CREATE TABLE IF NOT EXISTS public.gym_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL CHECK (char_length(trim(title)) >= 3),
    description TEXT CHECK (description IS NULL OR char_length(trim(description)) <= 2000),
    challenge_type TEXT NOT NULL CHECK (challenge_type IN ('attendance_count', 'workout_count', 'workout_volume', 'attendance_streak')),
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'published', 'active', 'completed', 'archived')),
    target_value NUMERIC(12,2) NOT NULL CHECK (target_value > 0),
    scoring_unit TEXT NOT NULL CHECK (scoring_unit IN ('days', 'workouts', 'kg', 'streak_days')),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    reward_badge_name VARCHAR(60),
    reward_coins INT DEFAULT 0 CHECK (reward_coins >= 0),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_challenge_date_window CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_gym_challenges_gym_status
ON public.gym_challenges (gym_id, status, start_at DESC);

ALTER TABLE public.gym_challenges ENABLE ROW LEVEL SECURITY;

-- 2. CHALLENGES RLS
-- A. SELECT: Active members of the gym and the gym owner
DROP POLICY IF EXISTS "Members and owners view gym challenges" ON public.gym_challenges;
CREATE POLICY "Members and owners view gym challenges"
ON public.gym_challenges FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gym_memberships m
        WHERE m.gym_id = gym_challenges.gym_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
    )
    OR EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_challenges.gym_id
          AND g.owner_id = auth.uid()
    )
);

-- B. Direct client INSERT/UPDATE/DELETE: Denied unconditionally
-- All challenge lifecycle transitions and deletions must route through authoritative RPCs:
-- create_gym_challenge, publish_gym_challenge, update_gym_challenge_status, delete_gym_challenge_draft
DROP POLICY IF EXISTS "Facility owners manage gym challenges" ON public.gym_challenges;
DROP POLICY IF EXISTS "Deny direct client insert on challenges" ON public.gym_challenges;
CREATE POLICY "Deny direct client insert on challenges"
ON public.gym_challenges FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on challenges" ON public.gym_challenges;
CREATE POLICY "Deny direct client update on challenges"
ON public.gym_challenges FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client delete on challenges" ON public.gym_challenges;
CREATE POLICY "Deny direct client delete on challenges"
ON public.gym_challenges FOR DELETE
TO authenticated
USING (FALSE);


-- 3. GYM CHALLENGE PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.gym_challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.gym_challenges(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'withdrawn')),
    current_score NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (current_score >= 0),
    target_achieved_at TIMESTAMPTZ,
    last_progress_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_challenge_participant UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_ranking
ON public.gym_challenge_participants (challenge_id, current_score DESC, target_achieved_at ASC NULLS LAST, last_progress_at ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_user
ON public.gym_challenge_participants (user_id, status);

ALTER TABLE public.gym_challenge_participants ENABLE ROW LEVEL SECURITY;

-- 4. CHALLENGE PARTICIPANTS RLS
DROP POLICY IF EXISTS "Members and owners view participants" ON public.gym_challenge_participants;
CREATE POLICY "Members and owners view participants"
ON public.gym_challenge_participants FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gym_memberships m
        WHERE m.gym_id = gym_challenge_participants.gym_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
    )
    OR EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_challenge_participants.gym_id
          AND g.owner_id = auth.uid()
    )
);

-- Deny direct client mutation of participant scores
DROP POLICY IF EXISTS "Deny direct client insert on participants" ON public.gym_challenge_participants;
CREATE POLICY "Deny direct client insert on participants"
ON public.gym_challenge_participants FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on participants" ON public.gym_challenge_participants;
CREATE POLICY "Deny direct client update on participants"
ON public.gym_challenge_participants FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client delete on participants" ON public.gym_challenge_participants;
CREATE POLICY "Deny direct client delete on participants"
ON public.gym_challenge_participants FOR DELETE
TO authenticated
USING (FALSE);


-- 5. ANTI-CHEAT PROGRESS EVENTS LEDGER
CREATE TABLE IF NOT EXISTS public.gym_challenge_progress_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.gym_challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('attendance_session', 'workout_session')),
    source_id UUID NOT NULL,
    metric_value NUMERIC(12,2) NOT NULL CHECK (metric_value > 0),
    event_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_challenge_source_event UNIQUE (challenge_id, user_id, source_type, source_id)
);

-- Partial unique index: strictly enforce 1 attendance event per facility-local calendar day per member
CREATE UNIQUE INDEX IF NOT EXISTS uq_challenge_daily_attendance
ON public.gym_challenge_progress_events (challenge_id, user_id, event_date)
WHERE source_type = 'attendance_session';

CREATE INDEX IF NOT EXISTS idx_challenge_events_lookup
ON public.gym_challenge_progress_events (challenge_id, user_id, event_date);

ALTER TABLE public.gym_challenge_progress_events ENABLE ROW LEVEL SECURITY;

-- Completely deny direct client mutations on progress events ledger
DROP POLICY IF EXISTS "Deny direct client mutations on progress events" ON public.gym_challenge_progress_events;
CREATE POLICY "Deny direct client mutations on progress events"
ON public.gym_challenge_progress_events FOR ALL
TO authenticated
USING (FALSE)
WITH CHECK (FALSE);


-- 6. CHALLENGE RPC: create_gym_challenge
CREATE OR REPLACE FUNCTION public.create_gym_challenge(
    p_gym_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_challenge_type TEXT,
    p_target_value NUMERIC,
    p_scoring_unit TEXT,
    p_start_at TIMESTAMPTZ,
    p_end_at TIMESTAMPTZ,
    p_reward_badge_name TEXT DEFAULT NULL,
    p_reward_coins INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_challenge RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Validate caller is gym owner
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = p_gym_id AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the facility owner can create challenges' USING ERRCODE = '40301';
    END IF;

    -- Validate dates
    IF p_end_at <= p_start_at THEN
        RAISE EXCEPTION 'Challenge end date must be after start date' USING ERRCODE = '40005';
    END IF;

    -- Validate target value
    IF p_target_value <= 0 THEN
        RAISE EXCEPTION 'Target value must be strictly positive' USING ERRCODE = '40006';
    END IF;

    INSERT INTO public.gym_challenges (
        gym_id,
        title,
        description,
        challenge_type,
        target_value,
        scoring_unit,
        start_at,
        end_at,
        reward_badge_name,
        reward_coins,
        created_by,
        status
    )
    VALUES (
        p_gym_id,
        trim(p_title),
        trim(p_description),
        p_challenge_type,
        p_target_value,
        p_scoring_unit,
        p_start_at,
        p_end_at,
        p_reward_badge_name,
        GREATEST(0, COALESCE(p_reward_coins, 0)),
        v_caller_id,
        'draft'
    )
    RETURNING * INTO v_challenge;

    RETURN to_jsonb(v_challenge);
END;
$$;


-- 7. CHALLENGE RPC: publish_gym_challenge
CREATE OR REPLACE FUNCTION public.publish_gym_challenge(
    p_challenge_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_challenge RECORD;
    v_new_status TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    SELECT * INTO v_challenge
    FROM public.gym_challenges
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found' USING ERRCODE = '40401';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = v_challenge.gym_id AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the facility owner can publish challenges' USING ERRCODE = '40301';
    END IF;

    IF v_challenge.status != 'draft' THEN
        RAISE EXCEPTION 'Only draft challenges can be published (current: %)', v_challenge.status USING ERRCODE = '40007';
    END IF;

    IF v_challenge.start_at <= NOW() THEN
        v_new_status := 'active';
    ELSE
        v_new_status := 'published';
    END IF;

    UPDATE public.gym_challenges
    SET status = v_new_status,
        updated_at = NOW()
    WHERE id = p_challenge_id
    RETURNING * INTO v_challenge;

    RETURN to_jsonb(v_challenge);
END;
$$;


-- 8. CHALLENGE RPC: update_gym_challenge_status (Authoritative Lifecycle State Machine)
CREATE OR REPLACE FUNCTION public.update_gym_challenge_status(
    p_challenge_id UUID,
    p_target_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_challenge RECORD;
    v_valid_transition BOOLEAN := FALSE;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    SELECT * INTO v_challenge
    FROM public.gym_challenges
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found' USING ERRCODE = '40401';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = v_challenge.gym_id AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the facility owner can manage challenge lifecycle' USING ERRCODE = '40301';
    END IF;

    -- Authoritative state machine transitions:
    -- draft -> published, active
    -- published -> active
    -- active -> completed
    -- completed -> archived
    IF v_challenge.status = 'draft' AND p_target_status IN ('published', 'active') THEN
        v_valid_transition := TRUE;
    ELSIF v_challenge.status = 'published' AND p_target_status = 'active' THEN
        v_valid_transition := TRUE;
    ELSIF v_challenge.status = 'active' AND p_target_status = 'completed' THEN
        v_valid_transition := TRUE;
    ELSIF v_challenge.status = 'completed' AND p_target_status = 'archived' THEN
        v_valid_transition := TRUE;
    END IF;

    IF NOT v_valid_transition THEN
        RAISE EXCEPTION 'Invalid challenge lifecycle transition from % to %', v_challenge.status, p_target_status USING ERRCODE = '40009';
    END IF;

    UPDATE public.gym_challenges
    SET status = p_target_status,
        updated_at = NOW()
    WHERE id = p_challenge_id
    RETURNING * INTO v_challenge;

    RETURN to_jsonb(v_challenge);
END;
$$;


-- 9. CHALLENGE RPC: delete_gym_challenge_draft (Owner Draft Purge Only)
CREATE OR REPLACE FUNCTION public.delete_gym_challenge_draft(
    p_challenge_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_challenge RECORD;
    v_part_count INT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    SELECT * INTO v_challenge
    FROM public.gym_challenges
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found' USING ERRCODE = '40401';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = v_challenge.gym_id AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the facility owner can delete challenges' USING ERRCODE = '40301';
    END IF;

    IF v_challenge.status != 'draft' THEN
        RAISE EXCEPTION 'Cannot delete challenge once published or active (status: %). Archive it instead.', v_challenge.status USING ERRCODE = '40010';
    END IF;

    SELECT COUNT(*) INTO v_part_count
    FROM public.gym_challenge_participants
    WHERE challenge_id = p_challenge_id;

    IF v_part_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete challenge with enrolled participants' USING ERRCODE = '40011';
    END IF;

    DELETE FROM public.gym_challenges WHERE id = p_challenge_id;
    RETURN TRUE;
END;
$$;


-- 10. CHALLENGE RPC: join_gym_challenge
CREATE OR REPLACE FUNCTION public.join_gym_challenge(
    p_challenge_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_challenge RECORD;
    v_participant RECORD;
    v_is_owner BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    SELECT * INTO v_challenge
    FROM public.gym_challenges
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found' USING ERRCODE = '40401';
    END IF;

    -- Check if owner is trying to join as a member
    SELECT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = v_challenge.gym_id AND owner_id = v_caller_id
    ) INTO v_is_owner;

    IF v_is_owner THEN
        RAISE EXCEPTION 'Facility owners cannot join member challenges' USING ERRCODE = '40302';
    END IF;

    -- Validate active membership at this gym
    IF NOT EXISTS (
        SELECT 1 FROM public.gym_memberships
        WHERE gym_id = v_challenge.gym_id
          AND user_id = v_caller_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Active membership at this gym is required to join challenges' USING ERRCODE = '40303';
    END IF;

    -- Validate challenge status
    IF v_challenge.status NOT IN ('published', 'active') OR v_challenge.end_at <= NOW() THEN
        RAISE EXCEPTION 'Challenge is not open for registration' USING ERRCODE = '40008';
    END IF;

    -- Insert participant (or return existing if already joined)
    INSERT INTO public.gym_challenge_participants (
        challenge_id,
        gym_id,
        user_id,
        status,
        current_score,
        joined_at
    )
    VALUES (
        p_challenge_id,
        v_challenge.gym_id,
        v_caller_id,
        'active',
        0,
        NOW()
    )
    ON CONFLICT (challenge_id, user_id) DO UPDATE
    SET status = 'active',
        updated_at = NOW()
    RETURNING * INTO v_participant;

    -- Trigger initial progress sync
    PERFORM public.sync_member_challenge_progress(p_challenge_id, v_caller_id);

    -- Refetch participant with any synced score
    SELECT * INTO v_participant
    FROM public.gym_challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = v_caller_id;

    RETURN to_jsonb(v_participant);
END;
$$;


-- 9. CHALLENGE RPC: sync_member_challenge_progress (Authoritative Anti-Cheat Progress Calculation)
CREATE OR REPLACE FUNCTION public.sync_member_challenge_progress(
    p_challenge_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_target_user UUID;
    v_challenge RECORD;
    v_part RECORD;
    v_sess RECORD;
    v_w_sess RECORD;
    v_gym_tz TEXT := 'Asia/Kolkata';
    v_is_owner BOOLEAN := FALSE;
    v_metric NUMERIC(12,2);
    v_total_score NUMERIC(12,2) := 0;
    v_achieved_at TIMESTAMPTZ := NULL;
    v_last_prog TIMESTAMPTZ := NULL;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    SELECT * INTO v_challenge
    FROM public.gym_challenges
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found' USING ERRCODE = '40401';
    END IF;

    -- IDOR Gate: Normal members can only synchronize their own challenge progress
    IF p_user_id IS NOT NULL AND p_user_id != v_caller_id THEN
        SELECT EXISTS (
            SELECT 1 FROM public.gyms
            WHERE id = v_challenge.gym_id AND owner_id = v_caller_id
        ) INTO v_is_owner;

        IF NOT v_is_owner THEN
            RAISE EXCEPTION 'Unauthorized: Members can only synchronize their own challenge progress' USING ERRCODE = '40304';
        END IF;
        v_target_user := p_user_id;
    ELSE
        v_target_user := v_caller_id;
    END IF;

    -- Fetch facility timezone for canonical calendar-day resolution
    SELECT COALESCE(timezone, 'Asia/Kolkata') INTO v_gym_tz
    FROM public.gyms
    WHERE id = v_challenge.gym_id;

    SELECT * INTO v_part
    FROM public.gym_challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = v_target_user
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_enrolled');
    END IF;

    -- TYPE 1: ATTENDANCE COUNT (Days)
    -- G1 Canonical attendance rule: Multiple visits on the same facility-local calendar day = ONE attendance day
    IF v_challenge.challenge_type = 'attendance_count' THEN
        FOR v_sess IN
            SELECT 
                MIN(s.id::text)::uuid as session_id,
                ((s.check_in_at AT TIME ZONE COALESCE(v_gym_tz, 'Asia/Kolkata'))::DATE) as sess_date
            FROM public.gym_attendance_sessions s
            WHERE s.gym_id = v_challenge.gym_id
              AND s.user_id = v_target_user
              AND s.status = 'completed'
              AND s.check_in_at >= v_challenge.start_at
              AND s.check_in_at <= v_challenge.end_at
            GROUP BY ((s.check_in_at AT TIME ZONE COALESCE(v_gym_tz, 'Asia/Kolkata'))::DATE)
            ORDER BY sess_date ASC
        LOOP
            INSERT INTO public.gym_challenge_progress_events (
                challenge_id,
                user_id,
                source_type,
                source_id,
                metric_value,
                event_date
            )
            VALUES (
                p_challenge_id,
                v_target_user,
                'attendance_session',
                v_sess.session_id,
                1,
                v_sess.sess_date
            )
            ON CONFLICT DO NOTHING;
        END LOOP;

        SELECT COALESCE(SUM(metric_value), 0), MAX(created_at)
        INTO v_total_score, v_last_prog
        FROM public.gym_challenge_progress_events
        WHERE challenge_id = p_challenge_id AND user_id = v_target_user;

    -- TYPE 2: WORKOUT COUNT
    ELSIF v_challenge.challenge_type = 'workout_count' THEN
        FOR v_w_sess IN
            SELECT id, completed_at::DATE as sess_date, completed_at
            FROM public.workout_sessions
            WHERE user_id = v_target_user
              AND status = 'completed'
              AND completed_at >= v_challenge.start_at
              AND completed_at <= v_challenge.end_at
            ORDER BY completed_at ASC
        LOOP
            INSERT INTO public.gym_challenge_progress_events (
                challenge_id,
                user_id,
                source_type,
                source_id,
                metric_value,
                event_date
            )
            VALUES (
                p_challenge_id,
                v_target_user,
                'workout_session',
                v_w_sess.id,
                1,
                v_w_sess.sess_date
            )
            ON CONFLICT (challenge_id, user_id, source_type, source_id) DO NOTHING;
        END LOOP;

        SELECT COALESCE(SUM(metric_value), 0), MAX(created_at)
        INTO v_total_score, v_last_prog
        FROM public.gym_challenge_progress_events
        WHERE challenge_id = p_challenge_id AND user_id = v_target_user;

    -- TYPE 3: WORKOUT VOLUME (kg)
    ELSIF v_challenge.challenge_type = 'workout_volume' THEN
        FOR v_w_sess IN
            SELECT ws.id, ws.completed_at::DATE as sess_date, ws.completed_at,
                   COALESCE(SUM(w_set.weight_kg * w_set.reps), 0) as sess_volume
            FROM public.workout_sessions ws
            JOIN public.workout_session_exercises wse ON wse.session_id = ws.id
            JOIN public.workout_sets w_set ON w_set.session_exercise_id = wse.id
            WHERE ws.user_id = v_target_user
              AND ws.status = 'completed'
              AND w_set.completed = TRUE
              AND w_set.weight_kg > 0
              AND w_set.reps > 0
              AND ws.completed_at >= v_challenge.start_at
              AND ws.completed_at <= v_challenge.end_at
            GROUP BY ws.id, ws.completed_at
            ORDER BY ws.completed_at ASC
        LOOP
            IF v_w_sess.sess_volume > 0 THEN
                INSERT INTO public.gym_challenge_progress_events (
                    challenge_id,
                    user_id,
                    source_type,
                    source_id,
                    metric_value,
                    event_date
                )
                VALUES (
                    p_challenge_id,
                    v_target_user,
                    'workout_session',
                    v_w_sess.id,
                    v_w_sess.sess_volume,
                    v_w_sess.sess_date
                )
                ON CONFLICT (challenge_id, user_id, source_type, source_id) DO NOTHING;
            END IF;
        END LOOP;

        SELECT COALESCE(SUM(metric_value), 0), MAX(created_at)
        INTO v_total_score, v_last_prog
        FROM public.gym_challenge_progress_events
        WHERE challenge_id = p_challenge_id AND user_id = v_target_user;

    -- TYPE 4: ATTENDANCE STREAK
    ELSIF v_challenge.challenge_type = 'attendance_streak' THEN
        SELECT COALESCE(current_streak, 0) INTO v_total_score
        FROM public.gym_attendance_streaks
        WHERE gym_id = v_challenge.gym_id AND user_id = v_target_user;
        v_last_prog := NOW();
    END IF;

    -- Check if target completed
    IF v_total_score >= v_challenge.target_value AND v_part.target_achieved_at IS NULL THEN
        v_achieved_at := NOW();
    ELSE
        v_achieved_at := v_part.target_achieved_at;
    END IF;

    -- Update participant record
    UPDATE public.gym_challenge_participants
    SET current_score = v_total_score,
        target_achieved_at = v_achieved_at,
        last_progress_at = COALESCE(v_last_prog, last_progress_at),
        status = CASE WHEN v_total_score >= v_challenge.target_value THEN 'completed' ELSE 'active' END,
        updated_at = NOW()
    WHERE challenge_id = p_challenge_id AND user_id = v_target_user
    RETURNING * INTO v_part;

    RETURN jsonb_build_object(
        'challenge_id', p_challenge_id,
        'user_id', v_target_user,
        'current_score', v_part.current_score,
        'target_value', v_challenge.target_value,
        'is_completed', (v_part.status = 'completed'),
        'target_achieved_at', v_part.target_achieved_at
    );
END;
$$;


-- ==============================================================================
-- PART 3: G5-B GYM LEADERBOARD RPC
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_gym_challenge_leaderboard(
    p_challenge_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    rank BIGINT,
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    current_score NUMERIC,
    target_value NUMERIC,
    scoring_unit TEXT,
    progress_percentage NUMERIC,
    is_completed BOOLEAN,
    target_achieved_at TIMESTAMPTZ,
    last_progress_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_challenge RECORD;
    v_bounded_limit INT;
    v_bounded_offset INT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    SELECT * INTO v_challenge
    FROM public.gym_challenges
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found' USING ERRCODE = '40401';
    END IF;

    -- Check caller is active gym member or owner
    IF NOT EXISTS (
        SELECT 1 FROM public.gym_memberships m
        WHERE m.gym_id = v_challenge.gym_id
          AND m.user_id = v_caller_id
          AND m.status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = v_challenge.gym_id
          AND g.owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You must be an active member or owner of this facility' USING ERRCODE = '40301';
    END IF;

    v_bounded_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
    v_bounded_offset := GREATEST(0, COALESCE(p_offset, 0));

    RETURN QUERY
    WITH ranked AS (
        SELECT
            DENSE_RANK() OVER (
                ORDER BY cp.current_score DESC,
                         cp.target_achieved_at ASC NULLS LAST,
                         cp.last_progress_at ASC NULLS LAST,
                         cp.user_id ASC
            ) AS computed_rank,
            cp.user_id AS p_user_id,
            COALESCE(p.display_name, 'Athlete') AS p_display_name,
            p.avatar_url AS p_avatar_url,
            cp.current_score AS p_current_score,
            v_challenge.target_value AS p_target_value,
            v_challenge.scoring_unit AS p_scoring_unit,
            LEAST(100.0, ROUND((cp.current_score / v_challenge.target_value) * 100.0, 1)) AS p_progress_percentage,
            (cp.status = 'completed') AS p_is_completed,
            cp.target_achieved_at AS p_target_achieved_at,
            cp.last_progress_at AS p_last_progress_at
        FROM public.gym_challenge_participants cp
        LEFT JOIN public.profiles p ON p.id = cp.user_id
        WHERE cp.challenge_id = p_challenge_id
    )
    SELECT
        computed_rank,
        p_user_id,
        p_display_name,
        p_avatar_url,
        p_current_score,
        p_target_value,
        p_scoring_unit,
        p_progress_percentage,
        p_is_completed,
        p_target_achieved_at,
        p_last_progress_at
    FROM ranked
    ORDER BY computed_rank ASC, p_user_id ASC
    LIMIT v_bounded_limit
    OFFSET v_bounded_offset;
END;
$$;
