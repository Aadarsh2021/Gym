# Database Architecture & Schema — Fitness Platform Phase 1

## 1. Schema Overview

The database uses **Supabase PostgreSQL** as the single source of truth. All user-owned data is isolated using PostgreSQL Row Level Security (RLS).

**Authoritative Table Count: Exactly 23 Application Tables**

---

## 2. Table Enumeration & Entity Relationships

### 1. Identity & Profiles
- **`profiles`**:
  - `id` (UUID, PK, references `auth.users.id` ON DELETE CASCADE)
  - `display_name` (TEXT)
  - `unit_system` (TEXT, CHECK IN ('metric', 'imperial'), default 'metric')
  - `timezone` (TEXT, default 'Asia/Kolkata')
  - `avatar_url` (TEXT)
  - `created_at` (TIMESTAMPTZ, default NOW())
  - `updated_at` (TIMESTAMPTZ, default NOW())
- **`fitness_profiles`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, UNIQUE, references `profiles(id)` ON DELETE CASCADE)
  - `age` (INT, CHECK (age BETWEEN 13 AND 100))
  - `height_cm` (NUMERIC(5,2), CHECK (height_cm BETWEEN 50 AND 260))
  - `weight_kg` (NUMERIC(5,2), CHECK (weight_kg BETWEEN 25 AND 350))
  - `gender` (TEXT, CHECK IN ('male', 'female', 'other'))
  - `goal` (TEXT, CHECK IN ('muscle_gain', 'fat_loss', 'maintenance', 'strength', 'endurance'))
  - `experience_level` (TEXT, CHECK IN ('beginner', 'intermediate', 'advanced'))
  - `days_per_week` (INT, CHECK (days_per_week BETWEEN 1 AND 7))
  - `workout_duration_minutes` (INT, CHECK (workout_duration_minutes BETWEEN 15 AND 180))
  - `equipment` (TEXT[], default '{}')
  - `dietary_preference` (TEXT, CHECK IN ('vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'))
  - `limitations` (TEXT[], default '{}')
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)

### 2. Exercise Catalog
- **`exercises`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `name` (TEXT, UNIQUE, NOT NULL)
  - `primary_muscle` (TEXT, NOT NULL)
  - `secondary_muscles` (TEXT[], default '{}')
  - `equipment_required` (TEXT, NOT NULL)
  - `difficulty` (TEXT, CHECK IN ('beginner', 'intermediate', 'advanced'))
  - `movement_pattern` (TEXT, NOT NULL)
  - `instructions` (TEXT[], default '{}')
  - `is_system` (BOOLEAN, default true)
  - `created_at` (TIMESTAMPTZ)

### 3. Workout Planning
- **`workout_plans`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `name` (TEXT, NOT NULL)
  - `description` (TEXT)
  - `split_type` (TEXT, NOT NULL)
  - `is_active` (BOOLEAN, default true)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **`workout_plan_days`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `plan_id` (UUID, NOT NULL, references `workout_plans(id)` ON DELETE CASCADE)
  - `day_number` (INT, NOT NULL)
  - `name` (TEXT, NOT NULL)
  - `target_muscle_groups` (TEXT[], default '{}')
  - `created_at` (TIMESTAMPTZ)
- **`workout_plan_exercises`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `plan_day_id` (UUID, NOT NULL, references `workout_plan_days(id)` ON DELETE CASCADE)
  - `exercise_id` (UUID, NOT NULL, references `exercises(id)` ON DELETE RESTRICT)
  - `order_index` (INT, NOT NULL)
  - `target_sets` (INT, NOT NULL)
  - `target_reps_min` (INT, NOT NULL)
  - `target_reps_max` (INT, NOT NULL)
  - `rest_seconds` (INT, default 90)
  - `is_core` (BOOLEAN, default true)

### 4. Active Tracking
- **`workout_sessions`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `plan_id` (UUID, references `workout_plans(id)` ON DELETE SET NULL)
  - `name` (TEXT, NOT NULL)
  - `status` (TEXT, CHECK IN ('in_progress', 'completed', 'cancelled'), default 'in_progress')
  - `idempotency_key` (TEXT)
  - `started_at` (TIMESTAMPTZ, default NOW())
  - `completed_at` (TIMESTAMPTZ)
  - `duration_seconds` (INT, default 0)
  - `session_rating` (TEXT, CHECK IN ('easy', 'normal', 'exhausting'))
  - `notes` (TEXT)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
  - CONSTRAINT `uq_session_idempotency` UNIQUE (`user_id`, `idempotency_key`)
- **`workout_session_exercises`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `session_id` (UUID, NOT NULL, references `workout_sessions(id)` ON DELETE CASCADE)
  - `exercise_id` (UUID, NOT NULL, references `exercises(id)` ON DELETE RESTRICT)
  - `order_index` (INT, NOT NULL)
  - `notes` (TEXT)
- **`workout_sets`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `session_exercise_id` (UUID, NOT NULL, references `workout_session_exercises(id)` ON DELETE CASCADE)
  - `set_index` (INT, NOT NULL)
  - `weight_kg` (NUMERIC(6,2), NOT NULL, CHECK (weight_kg >= 0))
  - `reps` (INT, NOT NULL, CHECK (reps >= 0))
  - `rpe` (NUMERIC(3,1), CHECK (rpe BETWEEN 1 AND 10))
  - `completed` (BOOLEAN, default false)
  - `completed_at` (TIMESTAMPTZ)

### 5. Performance & PRs
- **`personal_records`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `exercise_id` (UUID, NOT NULL, references `exercises(id)` ON DELETE CASCADE)
  - `weight_kg` (NUMERIC(6,2), NOT NULL)
  - `reps` (INT, NOT NULL)
  - `estimated_one_rep_max` (NUMERIC(6,2), NOT NULL)
  - `achieved_at` (TIMESTAMPTZ, default NOW())
  - `session_id` (UUID, references `workout_sessions(id)` ON DELETE SET NULL)
  - CONSTRAINT `uq_user_exercise_pr` UNIQUE (`user_id`, `exercise_id`)
- **`progress_entries`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `recorded_date` (DATE, NOT NULL)
  - `weight_kg` (NUMERIC(5,2), NOT NULL)
  - `notes` (TEXT)
  - `created_at` (TIMESTAMPTZ, default NOW())

### 6. Nutrition Engine
- **`foods`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `name` (TEXT, NOT NULL, UNIQUE)
  - `serving_size` (TEXT, NOT NULL)
  - `serving_unit` (TEXT, NOT NULL)
  - `calories` (NUMERIC(6,1), NOT NULL)
  - `protein_g` (NUMERIC(5,1), NOT NULL)
  - `carbs_g` (NUMERIC(5,1), NOT NULL)
  - `fat_g` (NUMERIC(5,1), NOT NULL)
  - `dietary_type` (TEXT, CHECK IN ('veg', 'non_veg', 'egg', 'vegan'))
  - `source` (TEXT, NOT NULL)
  - `source_reference` (TEXT)
  - `is_verified` (BOOLEAN, default true)
  - `created_at` (TIMESTAMPTZ)
- **`nutrition_profiles`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, UNIQUE, references `profiles(id)` ON DELETE CASCADE)
  - `bmr_calories` (INT, NOT NULL)
  - `tdee_calories` (INT, NOT NULL)
  - `target_calories` (INT, NOT NULL)
  - `target_protein_g` (INT, NOT NULL)
  - `target_carbs_g` (INT, NOT NULL)
  - `target_fat_g` (INT, NOT NULL)
  - `calculation_version` (TEXT, default 'v1.0')
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **`meal_plans`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `name` (TEXT, NOT NULL)
  - `target_calories` (INT, NOT NULL)
  - `target_protein_g` (INT, NOT NULL)
  - `is_active` (BOOLEAN, default true)
  - `created_at` (TIMESTAMPTZ)
- **`meal_plan_items`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `meal_plan_id` (UUID, NOT NULL, references `meal_plans(id)` ON DELETE CASCADE)
  - `food_id` (UUID, NOT NULL, references `foods(id)` ON DELETE RESTRICT)
  - `meal_type` (TEXT, CHECK IN ('breakfast', 'lunch', 'snack', 'dinner'))
  - `servings` (NUMERIC(4,2), NOT NULL)
  - `calculated_calories` (NUMERIC(6,1), NOT NULL)
  - `calculated_protein_g` (NUMERIC(5,1), NOT NULL)

### 7. Streaks & Gamification
- **`streaks`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, UNIQUE, references `profiles(id)` ON DELETE CASCADE)
  - `current_streak` (INT, default 0)
  - `longest_streak` (INT, default 0)
  - `last_activity_date` (DATE)
  - `updated_at` (TIMESTAMPTZ, default NOW())
- **`streak_events`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `event_date` (DATE, NOT NULL)
  - `event_type` (TEXT, CHECK IN ('workout_completed', 'rest_day', 'revive'))
  - `session_id` (UUID, references `workout_sessions(id)` ON DELETE SET NULL)
  - `created_at` (TIMESTAMPTZ, default NOW())
  - CONSTRAINT `uq_streak_daily_event` UNIQUE (`user_id`, `event_date`, `event_type`)
- **`streak_revives`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `used_at` (TIMESTAMPTZ, default NOW())
  - `restored_streak` (INT, NOT NULL)
- **`achievements`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `achievement_type` (TEXT, NOT NULL)
  - `unlocked_at` (TIMESTAMPTZ, default NOW())
  - CONSTRAINT `uq_user_achievement` UNIQUE (`user_id`, `achievement_type`)
- **`fitness_coins`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `amount` (INT, NOT NULL)
  - `source` (TEXT, NOT NULL)
  - `reference_id` (TEXT)
  - `created_at` (TIMESTAMPTZ, default NOW())
  - CONSTRAINT `uq_coin_reward` UNIQUE (`user_id`, `source`, `reference_id`)

### 8. AI Coach & Notifications
- **`ai_conversations`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `title` (TEXT, default 'Conversation with Guru Ji')
  - `created_at` (TIMESTAMPTZ, default NOW())
- **`ai_messages`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `conversation_id` (UUID, NOT NULL, references `ai_conversations(id)` ON DELETE CASCADE)
  - `role` (TEXT, CHECK IN ('user', 'assistant'))
  - `content` (TEXT, NOT NULL)
  - `created_at` (TIMESTAMPTZ, default NOW())
- **`notifications`**:
  - `id` (UUID, PK, default gen_random_uuid())
  - `user_id` (UUID, NOT NULL, references `profiles(id)` ON DELETE CASCADE)
  - `title` (TEXT, NOT NULL)
  - `message` (TEXT, NOT NULL)
  - `type` (TEXT, CHECK IN ('workout_reminder', 'milestone', 'alarm'))
  - `scheduled_time` (TIME)
  - `scheduled_days` (INT[], default '{1,2,3,4,5}')
  - `is_read` (BOOLEAN, default false)
  - `is_active` (BOOLEAN, default true)
  - `created_at` (TIMESTAMPTZ, default NOW())

---

## 3. Database Indexes

- `workout_sessions(user_id, status)`
- `workout_sessions(user_id, completed_at DESC)`
- `workout_sets(session_exercise_id)`
- `personal_records(user_id, exercise_id)`
- `fitness_coins(user_id, created_at DESC)`
- `streak_events(user_id, event_date DESC)`
- `ai_messages(conversation_id, created_at ASC)`
- `foods(name)`
- `exercises(primary_muscle, equipment_required)`
