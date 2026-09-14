-- ============================================================================
-- FITBOOST: Check-In Idempotency Rate Protection & Account Role Selection
-- Migration: 20260914000002_gym_checkin_idempotency_and_role_selection.sql
-- ============================================================================

-- 1. GYM CHECK-INS IDEMPOTENCY:
-- Add explicit checkin_date column and unique constraint to prevent duplicate
-- check-in spam for the same user, gym, and day.
ALTER TABLE public.gym_checkins
ADD COLUMN IF NOT EXISTS checkin_date DATE DEFAULT ((NOW() AT TIME ZONE 'Asia/Kolkata')::DATE) NOT NULL;

-- Drop previous constraint if it exists to allow idempotent re-runs
ALTER TABLE public.gym_checkins
DROP CONSTRAINT IF EXISTS uq_gym_user_daily_checkin;

ALTER TABLE public.gym_checkins
ADD CONSTRAINT uq_gym_user_daily_checkin UNIQUE (user_id, gym_id, checkin_date);

-- 2. ACCOUNT ROLE SELECTION TRACKING:
-- Add role_selected flag to profiles.
-- Existing users are backfilled to role_selected = TRUE to prevent re-prompting.
-- New users default to role_selected = FALSE until explicit role selection.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role_selected BOOLEAN DEFAULT FALSE NOT NULL;

-- Backfill existing profiles so existing users are never shown role selection
UPDATE public.profiles
SET role_selected = TRUE
WHERE role_selected = FALSE;

-- 3. ENSURE RLS POLICIES FOR ROLE SELECTION UPDATE
-- Authenticated users can update their own account_role and role_selected
DROP POLICY IF EXISTS "Users can update own profile role" ON public.profiles;
CREATE POLICY "Users can update own profile role"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id
    AND account_role IN ('member', 'gym_owner')
);
