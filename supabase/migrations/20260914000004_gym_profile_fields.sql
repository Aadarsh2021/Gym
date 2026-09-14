-- ==============================================================================
-- FITBOOST MIGRATION: GYM PROFILE EXTENSIONS & FACILITY METADATA
-- Adds facility contact, operational hours, schedule, state, pincode, and branding
-- ==============================================================================

ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS contact_number TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS opening_time TEXT,
ADD COLUMN IF NOT EXISTS closing_time TEXT,
ADD COLUMN IF NOT EXISTS weekly_schedule JSONB,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Index on slug for rapid lookup and uniqueness checks
CREATE INDEX IF NOT EXISTS idx_gyms_slug ON public.gyms(slug);
-- Index on owner_id for isolated multi-tenant owner dashboard queries
CREATE INDEX IF NOT EXISTS idx_gyms_owner_id ON public.gyms(owner_id);
