-- ==============================================================================
-- Migration: Member Gym Memberships RLS & Idempotent Request Policies
-- Allows authenticated members to request, view, and reactivate their own gym memberships
-- ==============================================================================

-- 1. Ensure RLS is active on gym_memberships
ALTER TABLE public.gym_memberships ENABLE ROW LEVEL SECURITY;

-- 2. Allow authenticated users to insert their own membership request
-- Enforces auth.uid() = user_id so users cannot create memberships for others
DROP POLICY IF EXISTS "Users can insert their own memberships" ON public.gym_memberships;
CREATE POLICY "Users can insert their own memberships"
ON public.gym_memberships FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);

-- 3. Allow authenticated users to update their own inactive membership back to pending (reactivation)
DROP POLICY IF EXISTS "Users can update their own inactive memberships" ON public.gym_memberships;
CREATE POLICY "Users can update their own inactive memberships"
ON public.gym_memberships FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);
