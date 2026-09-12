-- FitSphere V1 Migration: Add plan_type column to profiles table for Premium entitlement
-- Default is 'free', strictly validating against ('free', 'premium')

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free'
  CHECK (plan_type IN ('free', 'premium'));

-- Comment for PostgREST documentation
COMMENT ON COLUMN public.profiles.plan_type IS 'FitSphere tier: free or premium. Drives feature entitlements.';
