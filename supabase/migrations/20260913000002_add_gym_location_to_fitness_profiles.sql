-- FitSphere V1 Migration: Add Gym Location Verification columns to fitness_profiles table
-- Soft optional GPS verification for athlete training facility check-in

ALTER TABLE public.fitness_profiles
  ADD COLUMN IF NOT EXISTS gym_latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS gym_longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS gym_radius_meters INT DEFAULT 200
    CHECK (gym_radius_meters IN (50, 100, 200, 500));

COMMENT ON COLUMN public.fitness_profiles.gym_latitude IS 'Latitude of athlete primary gym/training facility.';
COMMENT ON COLUMN public.fitness_profiles.gym_longitude IS 'Longitude of athlete primary gym/training facility.';
COMMENT ON COLUMN public.fitness_profiles.gym_radius_meters IS 'Geofence radius in meters for gym verification check-in (50m, 100m, 200m, 500m).';
