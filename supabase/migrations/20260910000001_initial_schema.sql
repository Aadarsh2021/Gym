-- ==============================================================================
-- FITNESS PLATFORM (PHASE 1) - INITIAL PRODUCTION DATABASE SCHEMA
-- Exactly 23 Application Tables with UUID Primary Keys, Foreign Keys & Constraints
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    unit_system TEXT DEFAULT 'metric' CHECK (unit_system IN ('metric', 'imperial')),
    timezone TEXT DEFAULT 'Asia/Kolkata' NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. FITNESS_PROFILES
CREATE TABLE IF NOT EXISTS public.fitness_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    age INT CHECK (age BETWEEN 13 AND 100),
    height_cm NUMERIC(5,2) CHECK (height_cm BETWEEN 50 AND 260),
    weight_kg NUMERIC(5,2) CHECK (weight_kg BETWEEN 25 AND 350),
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    goal TEXT NOT NULL CHECK (goal IN ('muscle_gain', 'fat_loss', 'maintenance', 'strength', 'endurance')),
    experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
    days_per_week INT NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
    workout_duration_minutes INT NOT NULL CHECK (workout_duration_minutes BETWEEN 15 AND 180),
    equipment TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    dietary_preference TEXT NOT NULL CHECK (dietary_preference IN ('vegetarian', 'vegan', 'eggetarian', 'non_vegetarian')),
    limitations TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. EXERCISES (Reference Catalog)
CREATE TABLE IF NOT EXISTS public.exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    primary_muscle TEXT NOT NULL,
    secondary_muscles TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    equipment_required TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    movement_pattern TEXT NOT NULL,
    instructions TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    is_system BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. WORKOUT_PLANS
CREATE TABLE IF NOT EXISTS public.workout_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    split_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. WORKOUT_PLAN_DAYS
CREATE TABLE IF NOT EXISTS public.workout_plan_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    name TEXT NOT NULL,
    target_muscle_groups TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. WORKOUT_PLAN_EXERCISES
CREATE TABLE IF NOT EXISTS public.workout_plan_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_day_id UUID NOT NULL REFERENCES public.workout_plan_days(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
    order_index INT NOT NULL,
    target_sets INT NOT NULL CHECK (target_sets > 0),
    target_reps_min INT NOT NULL CHECK (target_reps_min > 0),
    target_reps_max INT NOT NULL CHECK (target_reps_max >= target_reps_min),
    rest_seconds INT DEFAULT 90 NOT NULL CHECK (rest_seconds >= 0),
    is_core BOOLEAN DEFAULT TRUE NOT NULL
);

-- 7. WORKOUT_SESSIONS
CREATE TABLE IF NOT EXISTS public.workout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.workout_plans(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress' NOT NULL CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    idempotency_key TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_seconds INT DEFAULT 0 NOT NULL,
    session_rating TEXT CHECK (session_rating IN ('easy', 'normal', 'exhausting')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_session_idempotency UNIQUE (user_id, idempotency_key)
);

-- 8. WORKOUT_SESSION_EXERCISES
CREATE TABLE IF NOT EXISTS public.workout_session_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
    order_index INT NOT NULL,
    notes TEXT
);

-- 9. WORKOUT_SETS
CREATE TABLE IF NOT EXISTS public.workout_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_exercise_id UUID NOT NULL REFERENCES public.workout_session_exercises(id) ON DELETE CASCADE,
    set_index INT NOT NULL,
    weight_kg NUMERIC(6,2) NOT NULL CHECK (weight_kg >= 0),
    reps INT NOT NULL CHECK (reps >= 0),
    rpe NUMERIC(3,1) CHECK (rpe BETWEEN 1 AND 10),
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMPTZ
);

-- 10. PERSONAL_RECORDS
CREATE TABLE IF NOT EXISTS public.personal_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    weight_kg NUMERIC(6,2) NOT NULL,
    reps INT NOT NULL,
    estimated_one_rep_max NUMERIC(6,2) NOT NULL,
    achieved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    session_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
    CONSTRAINT uq_user_exercise_pr UNIQUE (user_id, exercise_id)
);

-- 11. PROGRESS_ENTRIES
CREATE TABLE IF NOT EXISTS public.progress_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL,
    weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 12. FOODS (Reference Nutrition Catalog)
CREATE TABLE IF NOT EXISTS public.foods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    serving_size TEXT NOT NULL,
    serving_unit TEXT NOT NULL,
    calories NUMERIC(6,1) NOT NULL,
    protein_g NUMERIC(5,1) NOT NULL,
    carbs_g NUMERIC(5,1) NOT NULL,
    fat_g NUMERIC(5,1) NOT NULL,
    dietary_type TEXT NOT NULL CHECK (dietary_type IN ('veg', 'non_veg', 'egg', 'vegan')),
    source TEXT NOT NULL,
    source_reference TEXT,
    is_verified BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 13. NUTRITION_PROFILES
CREATE TABLE IF NOT EXISTS public.nutrition_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bmr_calories INT NOT NULL,
    tdee_calories INT NOT NULL,
    target_calories INT NOT NULL,
    target_protein_g INT NOT NULL,
    target_carbs_g INT NOT NULL,
    target_fat_g INT NOT NULL,
    calculation_version TEXT DEFAULT 'v1.0' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 14. MEAL_PLANS
CREATE TABLE IF NOT EXISTS public.meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_calories INT NOT NULL,
    target_protein_g INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 15. MEAL_PLAN_ITEMS
CREATE TABLE IF NOT EXISTS public.meal_plan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
    food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
    servings NUMERIC(4,2) NOT NULL CHECK (servings > 0),
    calculated_calories NUMERIC(6,1) NOT NULL,
    calculated_protein_g NUMERIC(5,1) NOT NULL
);

-- 16. STREAKS
CREATE TABLE IF NOT EXISTS public.streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak INT DEFAULT 0 NOT NULL,
    longest_streak INT DEFAULT 0 NOT NULL,
    last_activity_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 17. STREAK_EVENTS
CREATE TABLE IF NOT EXISTS public.streak_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('workout_completed', 'rest_day', 'revive')),
    session_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_streak_daily_event UNIQUE (user_id, event_date, event_type)
);

-- 18. STREAK_REVIVES
CREATE TABLE IF NOT EXISTS public.streak_revives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    restored_streak INT NOT NULL
);

-- 19. ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_type)
);

-- 20. FITNESS_COINS (Append-Only Ledger)
CREATE TABLE IF NOT EXISTS public.fitness_coins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    source TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_coin_reward UNIQUE (user_id, source, reference_id)
);

-- 21. AI_CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Conversation with Guru Ji' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 22. AI_MESSAGES
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 23. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('workout_reminder', 'milestone', 'alarm')),
    scheduled_time TIME,
    scheduled_days INT[] DEFAULT '{1,2,3,4,5}'::INT[] NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- INDEXES FOR COMMONLY QUERIED LOOKUPS
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_status ON public.workout_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_completed ON public.workout_sessions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session_ex ON public.workout_sets(session_exercise_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_user_ex ON public.personal_records(user_id, exercise_id);
CREATE INDEX IF NOT EXISTS idx_fitness_coins_user_created ON public.fitness_coins(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streak_events_user_date ON public.streak_events(user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created ON public.ai_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_exercises_filter ON public.exercises(primary_muscle, equipment_required);
CREATE INDEX IF NOT EXISTS idx_foods_name ON public.foods(name);
