-- Phase C8: Visual Exercise Guides Migration
-- Adds schema columns for video/image demonstrations, thumbnails, and concise structured cues.

ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS demo_video_url TEXT;

ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS demo_image_url TEXT;

ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS instruction_steps TEXT[] DEFAULT '{}'::TEXT[] NOT NULL;

ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS common_mistakes TEXT[] DEFAULT '{}'::TEXT[] NOT NULL;

COMMENT ON COLUMN public.exercises.demo_video_url IS 'Short, looped demonstration video URL (MP4/WebM)';
COMMENT ON COLUMN public.exercises.demo_image_url IS 'High-quality instructional motion demonstration or diagram URL';
COMMENT ON COLUMN public.exercises.thumbnail_url IS 'Preview poster or frame for lazy loading';
COMMENT ON COLUMN public.exercises.instruction_steps IS 'Concise 3-4 bullet execution steps (Setup, Movement, Breathing)';
COMMENT ON COLUMN public.exercises.common_mistakes IS 'Concise high-risk errors to avoid during movement execution';
