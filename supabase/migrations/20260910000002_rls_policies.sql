-- ==============================================================================
-- FITNESS PLATFORM (PHASE 1) - ROW LEVEL SECURITY (RLS) POLICIES
-- Enables RLS on all 23 application tables and defines direct/indirect ownership rules.
-- ==============================================================================

-- 1. ENABLE RLS ON ALL 23 TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plan_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_revives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. REFERENCE CATALOG POLICIES (Public Read, Protected Write)
-- ==============================================================================
CREATE POLICY "Public read for system exercises"
    ON public.exercises FOR SELECT
    USING (is_system = TRUE);

CREATE POLICY "Public read for verified foods"
    ON public.foods FOR SELECT
    USING (is_verified = TRUE);

-- ==============================================================================
-- 3. DIRECT USER OWNERSHIP POLICIES
-- ==============================================================================

-- profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- fitness_profiles
CREATE POLICY "Users can view own fitness profile"
    ON public.fitness_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own fitness profile"
    ON public.fitness_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own fitness profile"
    ON public.fitness_profiles FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- workout_plans
CREATE POLICY "Users can view own workout plans"
    ON public.workout_plans FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workout plans"
    ON public.workout_plans FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workout plans"
    ON public.workout_plans FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own workout plans"
    ON public.workout_plans FOR DELETE
    USING (user_id = auth.uid());

-- workout_sessions
CREATE POLICY "Users can view own workout sessions"
    ON public.workout_sessions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workout sessions"
    ON public.workout_sessions FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workout sessions"
    ON public.workout_sessions FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- personal_records
CREATE POLICY "Users can view own personal records"
    ON public.personal_records FOR SELECT
    USING (user_id = auth.uid());

-- progress_entries
CREATE POLICY "Users can view own progress entries"
    ON public.progress_entries FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own progress entries"
    ON public.progress_entries FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own progress entries"
    ON public.progress_entries FOR DELETE
    USING (user_id = auth.uid());

-- nutrition_profiles
CREATE POLICY "Users can view own nutrition profile"
    ON public.nutrition_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own nutrition profile"
    ON public.nutrition_profiles FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- meal_plans
CREATE POLICY "Users can manage own meal plans"
    ON public.meal_plans FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- streaks & events
CREATE POLICY "Users can view own streak"
    ON public.streaks FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can view own streak events"
    ON public.streak_events FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can view own streak revives"
    ON public.streak_revives FOR SELECT
    USING (user_id = auth.uid());

-- achievements
CREATE POLICY "Users can view own achievements"
    ON public.achievements FOR SELECT
    USING (user_id = auth.uid());

-- fitness_coins (APPEND-ONLY LEDGER: Users can SELECT only, NO direct UPDATE/DELETE)
CREATE POLICY "Users can view own coin ledger"
    ON public.fitness_coins FOR SELECT
    USING (user_id = auth.uid());

-- ai_conversations
CREATE POLICY "Users can manage own AI conversations"
    ON public.ai_conversations FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- notifications
CREATE POLICY "Users can manage own notifications"
    ON public.notifications FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- 4. INDIRECT OWNERSHIP POLICIES (Via Parent Relationships)
-- ==============================================================================

-- workout_plan_days (Indirect via workout_plans.user_id)
CREATE POLICY "Users can manage own workout plan days"
    ON public.workout_plan_days FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workout_plans wp
        WHERE wp.id = workout_plan_days.plan_id AND wp.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.workout_plans wp
        WHERE wp.id = workout_plan_days.plan_id AND wp.user_id = auth.uid()
    ));

-- workout_plan_exercises (Indirect via workout_plan_days -> workout_plans.user_id)
CREATE POLICY "Users can manage own workout plan exercises"
    ON public.workout_plan_exercises FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workout_plan_days wpd
        JOIN public.workout_plans wp ON wp.id = wpd.plan_id
        WHERE wpd.id = workout_plan_exercises.plan_day_id AND wp.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.workout_plan_days wpd
        JOIN public.workout_plans wp ON wp.id = wpd.plan_id
        WHERE wpd.id = workout_plan_exercises.plan_day_id AND wp.user_id = auth.uid()
    ));

-- workout_session_exercises (Indirect via workout_sessions.user_id)
CREATE POLICY "Users can manage own workout session exercises"
    ON public.workout_session_exercises FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workout_sessions ws
        WHERE ws.id = workout_session_exercises.session_id AND ws.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.workout_sessions ws
        WHERE ws.id = workout_session_exercises.session_id AND ws.user_id = auth.uid()
    ));

-- workout_sets (Indirect via workout_session_exercises -> workout_sessions.user_id)
CREATE POLICY "Users can manage own workout sets"
    ON public.workout_sets FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workout_session_exercises wse
        JOIN public.workout_sessions ws ON ws.id = wse.session_id
        WHERE wse.id = workout_sets.session_exercise_id AND ws.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.workout_session_exercises wse
        JOIN public.workout_sessions ws ON ws.id = wse.session_id
        WHERE wse.id = workout_sets.session_exercise_id AND ws.user_id = auth.uid()
    ));

-- meal_plan_items (Indirect via meal_plans.user_id)
CREATE POLICY "Users can manage own meal plan items"
    ON public.meal_plan_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.meal_plans mp
        WHERE mp.id = meal_plan_items.meal_plan_id AND mp.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.meal_plans mp
        WHERE mp.id = meal_plan_items.meal_plan_id AND mp.user_id = auth.uid()
    ));

-- ai_messages (Indirect via ai_conversations.user_id)
CREATE POLICY "Users can manage own AI messages"
    ON public.ai_messages FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.ai_conversations ac
        WHERE ac.id = ai_messages.conversation_id AND ac.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.ai_conversations ac
        WHERE ac.id = ai_messages.conversation_id AND ac.user_id = auth.uid()
    ));
