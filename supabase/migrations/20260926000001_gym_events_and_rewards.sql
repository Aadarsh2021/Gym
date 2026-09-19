-- ==============================================================================
-- FITBOOST MIGRATION: GYM EVENTS, RSVP & FITNESS COIN REWARD SHOP
-- Migration: 20260926000001_gym_events_and_rewards.sql
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GYM EVENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title VARCHAR(140) NOT NULL CHECK (char_length(trim(title)) >= 3),
    description TEXT CHECK (description IS NULL OR char_length(trim(description)) <= 3000),
    event_type TEXT NOT NULL CHECK (event_type IN ('workshop', 'bootcamp', 'class', 'competition', 'social')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    capacity INT CHECK (capacity IS NULL OR capacity > 0),
    location_text TEXT CHECK (location_text IS NULL OR char_length(trim(location_text)) <= 140),
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_event_time_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_gym_events_gym_status 
ON public.gym_events(gym_id, status, starts_at ASC);

ALTER TABLE public.gym_events ENABLE ROW LEVEL SECURITY;

-- RLS: Gym Owner full access; Active members view published events
DROP POLICY IF EXISTS "Active members and owners view gym events" ON public.gym_events;
CREATE POLICY "Active members and owners view gym events"
ON public.gym_events FOR SELECT
TO authenticated
USING (
    -- Gym owner can see all events for their facility
    EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_events.gym_id AND g.owner_id = auth.uid()
    )
    -- Active gym members can see published/completed events
    OR (
        status IN ('published', 'completed')
        AND EXISTS (
            SELECT 1 FROM public.gym_memberships m
            WHERE m.gym_id = gym_events.gym_id 
              AND m.user_id = auth.uid() 
              AND m.status = 'active'
        )
    )
);

-- Deny direct client INSERT/UPDATE/DELETE on events (must route via RPCs)
DROP POLICY IF EXISTS "Deny direct insert on gym events" ON public.gym_events;
CREATE POLICY "Deny direct insert on gym events"
ON public.gym_events FOR INSERT TO authenticated WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct update on gym events" ON public.gym_events;
CREATE POLICY "Deny direct update on gym events"
ON public.gym_events FOR UPDATE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "Deny direct delete on gym events" ON public.gym_events;
CREATE POLICY "Deny direct delete on gym events"
ON public.gym_events FOR DELETE TO authenticated USING (FALSE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GYM EVENT RSVPS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.gym_events(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'attending' NOT NULL CHECK (status IN ('attending', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_event_user_rsvp UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_event_rsvps_event_status 
ON public.gym_event_rsvps(event_id, status);

CREATE INDEX IF NOT EXISTS idx_gym_event_rsvps_user 
ON public.gym_event_rsvps(user_id, status);

ALTER TABLE public.gym_event_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS: User can view their own RSVPs; Gym owner can view RSVPs for their gym's events
DROP POLICY IF EXISTS "Users and owners view RSVPs" ON public.gym_event_rsvps;
CREATE POLICY "Users and owners view RSVPs"
ON public.gym_event_rsvps FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_event_rsvps.gym_id AND g.owner_id = auth.uid()
    )
);

-- Deny direct client mutation on RSVPs (must route via atomic rsvp_gym_event RPC)
DROP POLICY IF EXISTS "Deny direct insert on rsvps" ON public.gym_event_rsvps;
CREATE POLICY "Deny direct insert on rsvps"
ON public.gym_event_rsvps FOR INSERT TO authenticated WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct update on rsvps" ON public.gym_event_rsvps;
CREATE POLICY "Deny direct update on rsvps"
ON public.gym_event_rsvps FOR UPDATE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "Deny direct delete on rsvps" ON public.gym_event_rsvps;
CREATE POLICY "Deny direct delete on rsvps"
ON public.gym_event_rsvps FOR DELETE TO authenticated USING (FALSE);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FITNESS REWARD CATALOG & REDEMPTIONS (GENERAL FITNESS COINS SHOP)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fitness_reward_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(120) NOT NULL CHECK (char_length(trim(title)) >= 3),
    description TEXT NOT NULL CHECK (char_length(trim(description)) >= 5),
    category TEXT NOT NULL CHECK (category IN ('digital_badge', 'partner_perk', 'app_feature', 'swag_discount')),
    coin_cost INT NOT NULL CHECK (coin_cost > 0),
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fitness_reward_catalog_active 
ON public.fitness_reward_catalog(is_active, coin_cost ASC);

ALTER TABLE public.fitness_reward_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view active reward catalog" ON public.fitness_reward_catalog;
CREATE POLICY "Anyone authenticated can view active reward catalog"
ON public.fitness_reward_catalog FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- Deny direct client mutations on reward catalog
DROP POLICY IF EXISTS "Deny direct insert on reward catalog" ON public.fitness_reward_catalog;
CREATE POLICY "Deny direct insert on reward catalog"
ON public.fitness_reward_catalog FOR INSERT TO authenticated WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct update on reward catalog" ON public.fitness_reward_catalog;
CREATE POLICY "Deny direct update on reward catalog"
ON public.fitness_reward_catalog FOR UPDATE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "Deny direct delete on reward catalog" ON public.fitness_reward_catalog;
CREATE POLICY "Deny direct delete on reward catalog"
ON public.fitness_reward_catalog FOR DELETE TO authenticated USING (FALSE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FITNESS REWARD REDEMPTIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fitness_reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.fitness_reward_catalog(id) ON DELETE RESTRICT,
    coin_spent INT NOT NULL CHECK (coin_spent > 0),
    redemption_code TEXT NOT NULL,
    status TEXT DEFAULT 'completed' NOT NULL CHECK (status IN ('completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fitness_reward_redemptions_user 
ON public.fitness_reward_redemptions(user_id, created_at DESC);

ALTER TABLE public.fitness_reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reward redemptions" ON public.fitness_reward_redemptions;
CREATE POLICY "Users can view their own reward redemptions"
ON public.fitness_reward_redemptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Deny direct client mutations on redemptions (must route via redeem_fitness_reward RPC)
DROP POLICY IF EXISTS "Deny direct insert on redemptions" ON public.fitness_reward_redemptions;
CREATE POLICY "Deny direct insert on redemptions"
ON public.fitness_reward_redemptions FOR INSERT TO authenticated WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct update on redemptions" ON public.fitness_reward_redemptions;
CREATE POLICY "Deny direct update on redemptions"
ON public.fitness_reward_redemptions FOR UPDATE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "Deny direct delete on redemptions" ON public.fitness_reward_redemptions;
CREATE POLICY "Deny direct delete on redemptions"
ON public.fitness_reward_redemptions FOR DELETE TO authenticated USING (FALSE);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ATOMIC RPC: RSVP TO GYM EVENT (WITH CONCURRENCY & CAPACITY LOCK)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rsvp_gym_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_current_count INT;
    v_rsvp_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    -- Lock event row for update to ensure capacity check is race-free
    SELECT * INTO v_event
    FROM public.gym_events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found' USING ERRCODE = '40400';
    END IF;

    IF v_event.status != 'published' THEN
        RAISE EXCEPTION 'Cannot RSVP to an event that is not published' USING ERRCODE = '40001';
    END IF;

    IF v_event.ends_at <= NOW() THEN
        RAISE EXCEPTION 'Cannot RSVP to a past event' USING ERRCODE = '40002';
    END IF;

    -- Verify caller is an active member of this facility
    IF NOT EXISTS (
        SELECT 1 FROM public.gym_memberships
        WHERE gym_id = v_event.gym_id 
          AND user_id = v_user_id 
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Must be an active member of this gym to RSVP' USING ERRCODE = '42501';
    END IF;

    -- Check capacity under concurrency lock
    SELECT COUNT(*) INTO v_current_count
    FROM public.gym_event_rsvps
    WHERE event_id = p_event_id AND status = 'attending';

    -- Check if user is already attending (idempotent)
    IF EXISTS (
        SELECT 1 FROM public.gym_event_rsvps
        WHERE event_id = p_event_id AND user_id = v_user_id AND status = 'attending'
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Already RSVPed for this event',
            'eventId', p_event_id,
            'attendeeCount', v_current_count,
            'capacity', v_event.capacity
        );
    END IF;

    -- Check if capacity reached
    IF v_event.capacity IS NOT NULL AND v_current_count >= v_event.capacity THEN
        RAISE EXCEPTION 'EVENT_AT_CAPACITY: This event has reached maximum capacity' USING ERRCODE = '40003';
    END IF;

    -- Insert or update RSVP
    INSERT INTO public.gym_event_rsvps (event_id, gym_id, user_id, status, updated_at)
    VALUES (p_event_id, v_event.gym_id, v_user_id, 'attending', NOW())
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET status = 'attending', updated_at = NOW()
    RETURNING id INTO v_rsvp_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'RSVP confirmed',
        'eventId', p_event_id,
        'rsvpId', v_rsvp_id,
        'attendeeCount', v_current_count + 1,
        'capacity', v_event.capacity
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ATOMIC RPC: CANCEL GYM EVENT RSVP
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_gym_event_rsvp(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_current_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    UPDATE public.gym_event_rsvps
    SET status = 'cancelled', updated_at = NOW()
    WHERE event_id = p_event_id AND user_id = v_user_id AND status = 'attending';

    SELECT COUNT(*) INTO v_current_count
    FROM public.gym_event_rsvps
    WHERE event_id = p_event_id AND status = 'attending';

    RETURN jsonb_build_object(
        'success', true,
        'message', 'RSVP cancelled',
        'eventId', p_event_id,
        'attendeeCount', v_current_count
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ATOMIC RPC: CREATE GYM EVENT (OWNER-ONLY)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_gym_event(
    p_gym_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_event_type TEXT,
    p_starts_at TIMESTAMPTZ,
    p_ends_at TIMESTAMPTZ,
    p_capacity INT DEFAULT NULL,
    p_location_text TEXT DEFAULT NULL,
    p_publish_immediately BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_event_id UUID;
    v_status TEXT := 'draft';
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    -- Verify caller owns the gym
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = p_gym_id AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Access denied: not gym owner' USING ERRCODE = '42501';
    END IF;

    IF p_ends_at <= p_starts_at THEN
        RAISE EXCEPTION 'Event end time must be after start time' USING ERRCODE = '40004';
    END IF;

    IF p_capacity IS NOT NULL AND p_capacity <= 0 THEN
        RAISE EXCEPTION 'Event capacity must be greater than zero' USING ERRCODE = '40005';
    END IF;

    IF p_publish_immediately THEN
        v_status := 'published';
    END IF;

    INSERT INTO public.gym_events (
        gym_id, created_by, title, description, event_type, starts_at, ends_at, capacity, location_text, status
    )
    VALUES (
        p_gym_id, v_caller_id, trim(p_title), trim(p_description), p_event_type, p_starts_at, p_ends_at, p_capacity, trim(p_location_text), v_status
    )
    RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'eventId', v_event_id,
        'status', v_status
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ATOMIC RPC: UPDATE GYM EVENT STATUS (OWNER-ONLY)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_gym_event_status(
    p_event_id UUID,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_event RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF p_status NOT IN ('draft', 'published', 'cancelled', 'completed') THEN
        RAISE EXCEPTION 'Invalid event status' USING ERRCODE = '40006';
    END IF;

    SELECT * INTO v_event
    FROM public.gym_events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found' USING ERRCODE = '40400';
    END IF;

    -- Verify caller owns the facility
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = v_event.gym_id AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Access denied: not gym owner' USING ERRCODE = '42501';
    END IF;

    UPDATE public.gym_events
    SET status = p_status, updated_at = NOW()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'eventId', p_event_id,
        'status', p_status
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ATOMIC RPC: GET GYM EVENT ATTENDEES ROSTER (OWNER-ONLY)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gym_event_attendees(p_event_id UUID)
RETURNS TABLE (
    rsvp_id UUID,
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    rsvp_status TEXT,
    rsvp_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_gym_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT gym_id INTO v_gym_id
    FROM public.gym_events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found' USING ERRCODE = '40400';
    END IF;

    -- Verify caller owns this facility
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = v_gym_id AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Access denied: not gym owner' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT 
        r.id AS rsvp_id,
        r.user_id,
        COALESCE(p.display_name, 'Athlete') AS display_name,
        p.avatar_url,
        r.status AS rsvp_status,
        r.created_at AS rsvp_created_at
    FROM public.gym_event_rsvps r
    JOIN public.profiles p ON r.user_id = p.id
    WHERE r.event_id = p_event_id
    ORDER BY r.created_at ASC;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. ATOMIC RPC: REDEEM FITNESS REWARD (GENERAL FITNESS COINS SHOP)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_fitness_reward(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_reward RECORD;
    v_balance INT := 0;
    v_redemption_id UUID;
    v_code TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    -- Lock reward catalog row for update
    SELECT * INTO v_reward
    FROM public.fitness_reward_catalog
    WHERE id = p_reward_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reward not found' USING ERRCODE = '40400';
    END IF;

    IF NOT v_reward.is_active THEN
        RAISE EXCEPTION 'This reward is currently inactive' USING ERRCODE = '40007';
    END IF;

    -- Calculate current authoritative coin balance
    SELECT COALESCE(SUM(amount), 0) INTO v_balance
    FROM public.fitness_coins
    WHERE user_id = v_user_id;

    IF v_balance < v_reward.coin_cost THEN
        RAISE EXCEPTION 'INSUFFICIENT_COINS: Required % coins, but balance is %', v_reward.coin_cost, v_balance 
            USING ERRCODE = '40008';
    END IF;

    -- Generate unique voucher code
    v_code := 'FIT-' || upper(substring(gen_random_uuid()::text from 1 for 4)) || '-' || upper(substring(gen_random_uuid()::text from 5 for 4));

    -- Insert redemption record
    INSERT INTO public.fitness_reward_redemptions (
        user_id, reward_id, coin_spent, redemption_code, status
    )
    VALUES (
        v_user_id, p_reward_id, v_reward.coin_cost, v_code, 'completed'
    )
    RETURNING id INTO v_redemption_id;

    -- Debit balance atomically into public.fitness_coins ledger
    INSERT INTO public.fitness_coins (
        user_id, amount, source, reference_id
    )
    VALUES (
        v_user_id, -v_reward.coin_cost, 'reward_redemption', v_redemption_id::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Reward successfully redeemed!',
        'redemptionId', v_redemption_id,
        'redemptionCode', v_code,
        'rewardTitle', v_reward.title,
        'coinSpent', v_reward.coin_cost,
        'remainingBalance', v_balance - v_reward.coin_cost
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RPC: GET FITNESS COIN BALANCE & LIFETIME SUMMARY
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_fitness_coin_balance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_balance INT := 0;
    v_earned INT := 0;
    v_spent INT := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT 
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN amount < 0 THEN abs(amount) ELSE 0 END), 0)
    INTO v_balance, v_earned, v_spent
    FROM public.fitness_coins
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
        'balance', v_balance,
        'lifetimeEarned', v_earned,
        'lifetimeSpent', v_spent
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. SEED INITIAL SOFTWARE REWARD CATALOG
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.fitness_reward_catalog (title, description, category, coin_cost, image_url, is_active)
VALUES
    ('FitSphere Century Club Badge', 'Exclusive gold badge on your athlete profile celebrating 100+ lifetime workouts logged.', 'digital_badge', 100, NULL, TRUE),
    ('15% Off GymWear Partner Pass', 'Redeemable partner voucher discount code for premium gym gear, straps, and wraps.', 'partner_perk', 250, NULL, TRUE),
    ('Premium 7-Day Workout Booster', 'Unlock all premium motivation alarms, coach notes, and high-intensity workout styles for 7 days.', 'app_feature', 500, NULL, TRUE),
    ('Golden PR Trophy Badge', 'Prestigious trophy badge displayed on your gym community feed posts and buddy profile.', 'digital_badge', 1000, NULL, TRUE)
ON CONFLICT DO NOTHING;

-- Permissions
REVOKE ALL ON FUNCTION public.rsvp_gym_event(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_gym_event(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_gym_event_rsvp(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_gym_event_rsvp(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.create_gym_event(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gym_event(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.update_gym_event_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_gym_event_status(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_gym_event_attendees(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gym_event_attendees(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_fitness_reward(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_fitness_reward(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_fitness_coin_balance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fitness_coin_balance() TO authenticated;
