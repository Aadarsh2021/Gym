-- ==============================================================================
-- FITBOOST MIGRATION: SHARED BACKEND, MULTI-ROLE & GYM FOUNDATION
-- 1. Separates account_role ('member', 'gym_owner', 'platform_admin') from subscriptions ('free', 'premium')
-- 2. Creates dedicated subscriptions table with multi-provider support
-- 3. Creates gyms, gym_memberships, and gym_checkins
-- 4. Makes workout_sessions.gym_id nullable to support Home, Non-Integrated, and Integrated Trainees
-- 5. Configures authoritative RLS policies for new entities
-- ==============================================================================

-- 1. PROFILES ENHANCEMENT: Account Roles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_role TEXT DEFAULT 'member' NOT NULL CHECK (account_role IN ('member', 'gym_owner', 'platform_admin'));

-- 2. DEDICATED SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_type TEXT DEFAULT 'free' NOT NULL CHECK (plan_type IN ('free', 'premium')),
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
    provider TEXT DEFAULT 'manual' NOT NULL CHECK (provider IN ('stripe', 'apple_iap', 'google_play', 'manual')),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Backfill subscriptions from existing profiles.plan_type
INSERT INTO public.subscriptions (user_id, plan_type, status, provider)
SELECT id, COALESCE(plan_type, 'free'), 'active', 'manual'
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Synchronize subscriptions -> profiles.plan_type trigger
CREATE OR REPLACE FUNCTION public.sync_subscription_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET plan_type = NEW.plan_type,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_subscription_to_profile ON public.subscriptions;
CREATE TRIGGER tr_sync_subscription_to_profile
AFTER INSERT OR UPDATE OF plan_type ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_subscription_to_profile();

-- 3. GYMS (Physical training centers)
CREATE TABLE IF NOT EXISTS public.gyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    radius_meters INT DEFAULT 200 NOT NULL CHECK (radius_meters > 0),
    qr_code_hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. GYM MEMBERSHIPS (Independent of account identity)
CREATE TABLE IF NOT EXISTS public.gym_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'frozen', 'pending')),
    membership_type TEXT DEFAULT 'monthly' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ,
    CONSTRAINT uq_gym_user_membership UNIQUE (gym_id, user_id)
);

-- 5. GYM CHECK-INS (Audit verification logs)
CREATE TABLE IF NOT EXISTS public.gym_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    verification_method TEXT NOT NULL CHECK (verification_method IN ('qr_scan', 'gps_geofence', 'reception_manual')),
    checked_in_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. WORKOUT SESSIONS: Nullable gym_id for Home vs Gym distinction
ALTER TABLE public.workout_sessions
ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_checkins ENABLE ROW LEVEL SECURITY;

-- Subscriptions RLS
DROP POLICY IF EXISTS "Users can read their own subscription" ON public.subscriptions;
CREATE POLICY "Users can read their own subscription"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Gyms RLS
DROP POLICY IF EXISTS "Anyone authenticated can view gyms" ON public.gyms;
CREATE POLICY "Anyone authenticated can view gyms"
ON public.gyms FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Gym owners can manage their gyms" ON public.gyms;
CREATE POLICY "Gym owners can manage their gyms"
ON public.gyms FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Gym Memberships RLS
DROP POLICY IF EXISTS "Users view their own memberships" ON public.gym_memberships;
CREATE POLICY "Users view their own memberships"
ON public.gym_memberships FOR SELECT
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.gyms
        WHERE gyms.id = gym_memberships.gym_id AND gyms.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Gym owners manage memberships for their gym" ON public.gym_memberships;
CREATE POLICY "Gym owners manage memberships for their gym"
ON public.gym_memberships FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.gyms
        WHERE gyms.id = gym_memberships.gym_id AND gyms.owner_id = auth.uid()
    )
);

-- Gym Check-ins RLS
DROP POLICY IF EXISTS "Users view and insert their own check-ins" ON public.gym_checkins;
CREATE POLICY "Users view and insert their own check-ins"
ON public.gym_checkins FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users and gym owners can view check-ins"
ON public.gym_checkins FOR SELECT
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.gyms
        WHERE gyms.id = gym_checkins.gym_id AND gyms.owner_id = auth.uid()
    )
);

-- 8. INDEXES FOR MULTI-TENANCY & PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_gyms_owner ON public.gyms(owner_id);
CREATE INDEX IF NOT EXISTS idx_gym_memberships_user ON public.gym_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_memberships_gym ON public.gym_memberships(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_user_date ON public.gym_checkins(user_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_gym_date ON public.gym_checkins(gym_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_gym ON public.workout_sessions(gym_id);
