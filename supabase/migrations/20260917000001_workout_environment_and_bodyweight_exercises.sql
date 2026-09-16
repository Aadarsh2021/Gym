-- ==============================================================================
-- FITSPHERE V1 - PHASE C8: ACCOUNT & WORKOUT ENVIRONMENT ARCHITECTURE
-- Migration: 20260917000001_workout_environment_and_bodyweight_exercises.sql
-- Enables:
-- 1. Persistent workout_environment column on public.fitness_profiles
-- 2. Check constraint enforcing the 4-environment model
-- 3. Foundational bodyweight exercise catalog expansion
-- ==============================================================================

-- 1. WORKOUT ENVIRONMENT COLUMN & CONSTRAINT ON FITNESS_PROFILES
ALTER TABLE public.fitness_profiles
ADD COLUMN IF NOT EXISTS workout_environment TEXT;

-- Drop check constraint if already exists to ensure idempotency
ALTER TABLE public.fitness_profiles
DROP CONSTRAINT IF EXISTS chk_fitness_profiles_workout_environment;

ALTER TABLE public.fitness_profiles
ADD CONSTRAINT chk_fitness_profiles_workout_environment
CHECK (
    workout_environment IS NULL OR
    workout_environment IN ('home_equipped', 'home_bodyweight', 'external_gym', 'connected_gym')
);

-- Index for performance when querying or filtering by environment
CREATE INDEX IF NOT EXISTS idx_fitness_profiles_workout_environment
ON public.fitness_profiles (workout_environment);

-- 2. FOUNDATIONAL BODYWEIGHT EXERCISE CATALOG EXPANSION
-- Adds high-quality bodyweight movements across Back, Shoulders, Arms, and Legs
-- to ensure home_bodyweight athletes receive safe, biomechanically sound routines.
INSERT INTO public.exercises (
    name,
    primary_muscle,
    secondary_muscles,
    equipment_required,
    difficulty,
    movement_pattern,
    instructions,
    is_system
)
VALUES
    (
        'Inverted Bodyweight Row',
        'Back',
        ARRAY['Biceps', 'Forearms', 'Rear Delts'],
        'Bodyweight',
        'beginner',
        'Horizontal Pull',
        ARRAY[
            'Position body under a secure horizontal bar or sturdy table edge.',
            'Grip with hands shoulder-width apart, keeping body in a straight plank.',
            'Pull chest upward toward the anchor point by retracting scapulae.',
            'Lower body with control under eccentric tension.'
        ],
        TRUE
    ),
    (
        'Doorframe Row',
        'Back',
        ARRAY['Biceps', 'Forearms'],
        'Bodyweight',
        'beginner',
        'Horizontal Pull',
        ARRAY[
            'Stand facing a sturdy doorframe or vertical pillar.',
            'Grasp the frame firmly at chest height with one or both hands.',
            'Lean backward until arms are extended, bracing core and glutes.',
            'Pull chest toward the frame squeezing the lat and upper back, then lower smoothly.'
        ],
        TRUE
    ),
    (
        'Superman',
        'Back',
        ARRAY['Glutes', 'Hamstrings', 'Lower Back'],
        'Bodyweight',
        'beginner',
        'Hinge / Extension',
        ARRAY[
            'Lie prone on the floor with arms extended overhead and legs straight.',
            'Simultaneously lift chest, arms, and thighs off the floor.',
            'Hold the peak isometric contraction for 2 to 3 seconds.',
            'Lower slowly to starting position without losing tension.'
        ],
        TRUE
    ),
    (
        'Pike Push-Up',
        'Shoulders',
        ARRAY['Triceps', 'Upper Chest', 'Core'],
        'Bodyweight',
        'intermediate',
        'Vertical Push',
        ARRAY[
            'Start in a push-up position, then walk feet forward until hips are elevated in an inverted V shape.',
            'Lower crown of head diagonally forward between your hands.',
            'Press through palms forcefully to lockout, maintaining pike hip angle throughout.'
        ],
        TRUE
    ),
    (
        'Chair/Bench Dips',
        'Triceps',
        ARRAY['Chest', 'Front Delts'],
        'Bodyweight',
        'beginner',
        'Vertical Push',
        ARRAY[
            'Place palms on the front edge of a stable bench or chair behind your back.',
            'Extend legs forward with heels on the floor.',
            'Lower hips downward by bending elbows until upper arms are parallel to floor.',
            'Press upward through palms to lockout, engaging triceps.'
        ],
        TRUE
    ),
    (
        'Diamond Push-Up',
        'Triceps',
        ARRAY['Chest', 'Front Delts'],
        'Bodyweight',
        'intermediate',
        'Horizontal Push',
        ARRAY[
            'Assume standard push-up position, bringing index fingers and thumbs together under the center of chest.',
            'Keep elbows tucked close to ribcage as you lower chest toward your hands.',
            'Press back up explosively to full extension.'
        ],
        TRUE
    ),
    (
        'Bodyweight Squat',
        'Legs',
        ARRAY['Glutes', 'Calves', 'Core'],
        'Bodyweight',
        'beginner',
        'Squat',
        ARRAY[
            'Stand upright with feet shoulder-width apart, toes angled slightly out.',
            'Brace core, send hips backward, and bend knees until hip crease dips parallel to knees.',
            'Drive through mid-foot to stand, squeezing glutes at the top.'
        ],
        TRUE
    ),
    (
        'Glute Bridge',
        'Legs',
        ARRAY['Hamstrings', 'Lower Back'],
        'Bodyweight',
        'beginner',
        'Hinge',
        ARRAY[
            'Lie on back with knees bent at 90 degrees and feet planted flat on floor.',
            'Drive through heels to lift hips until thighs, hips, and torso form a straight line.',
            'Squeeze glutes firmly at top for 2 seconds before lowering under control.'
        ],
        TRUE
    ),
    (
        'Reverse Lunge',
        'Legs',
        ARRAY['Glutes', 'Hamstrings', 'Core'],
        'Bodyweight',
        'beginner',
        'Lunge',
        ARRAY[
            'Stand tall with feet hip-width apart.',
            'Step backward with one leg and lower back knee until it hovers just above floor.',
            'Keep front shin nearly vertical and torso upright.',
            'Push through front heel to return to starting position, then switch sides.'
        ],
        TRUE
    )
ON CONFLICT (name) DO NOTHING;
