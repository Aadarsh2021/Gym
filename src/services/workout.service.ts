import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { WorkoutPlan, WorkoutSession, PersonalRecord } from '@/types/workout.types';
import { GeneratedPlan } from '@/domain/workout-generator';
import { logger } from '@/lib/logger';
import { clearActiveSessionDraft } from '@/utils/storage';
import { calculateWorkoutSummary } from '@/domain/workout-tonnage';
import { getDayScheduledDays } from '@/domain/scheduled-workout';
import { hasCompletedCoreExercise } from '@/domain/streak-calculator';
import { ensureUserProfile } from '@/services/profile.service';
import { workoutRepository } from '@/repositories/workout.repository';

export const workoutService = {
  async getActivePlan(userId: string): Promise<WorkoutPlan | null> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = localStorage.getItem(`active_workout_plan_${userId}`);
      return stored ? JSON.parse(stored) : null;
    }

    try {
      const { data: plan, error } = await supabase
        .from('workout_plans')
        .select(`
          *,
          workout_plan_days (
            *,
            workout_plan_exercises (
              *,
              exercises (*)
            )
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !plan) return null;

      // Transform relational payload
      return {
        id: plan.id,
        userId: plan.user_id,
        name: plan.name,
        description: plan.description || '',
        splitType: plan.split_type,
        isActive: plan.is_active,
        days: (plan.workout_plan_days || []).map((day: any, idx: number) => ({
          id: day.id,
          planId: day.plan_id,
          dayNumber: day.day_number,
          name: day.name,
          targetMuscleGroups: day.target_muscle_groups || [],
          scheduledDaysOfWeek: day.scheduled_days_of_week || getDayScheduledDays(day, (plan.workout_plan_days || []).length, idx),
          exercises: (day.workout_plan_exercises || []).map((wpe: any) => ({
            id: wpe.id,
            planDayId: wpe.plan_day_id,
            exerciseId: wpe.exercise_id,
            orderIndex: wpe.order_index,
            targetSets: wpe.target_sets,
            targetRepsMin: wpe.target_reps_min,
            targetRepsMax: wpe.target_reps_max,
            restSeconds: wpe.rest_seconds,
            isCore: wpe.is_core,
            exercise: wpe.exercises
              ? {
                  id: wpe.exercises.id,
                  name: wpe.exercises.name,
                  primaryMuscle: wpe.exercises.primary_muscle,
                  secondaryMuscles: wpe.exercises.secondary_muscles || [],
                  equipmentRequired: wpe.exercises.equipment_required,
                  difficulty: wpe.exercises.difficulty,
                  movementPattern: wpe.exercises.movement_pattern,
                  instructions: wpe.exercises.instructions || [],
                  isSystem: wpe.exercises.is_system,
                }
              : undefined,
          })),
        })),
      };
    } catch (err) {
      logger.error('Error fetching active workout plan', { err });
      return null;
    }
  },

  async saveGeneratedPlan(userId: string, plan: GeneratedPlan): Promise<WorkoutPlan | null> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const localPlan: WorkoutPlan = {
        id: 'plan-' + Date.now(),
        userId,
        name: plan.name,
        description: plan.description,
        splitType: plan.splitType,
        isActive: true,
        days: plan.days,
      };
      localStorage.setItem(`active_workout_plan_${userId}`, JSON.stringify(localPlan));
      return localPlan;
    }

    try {
      // 1. Authoritative authenticated user verification
      const { data: { session } } = await supabase.auth.getSession();
      const authenticatedUserId = session?.user?.id;
      if (!authenticatedUserId || authenticatedUserId !== userId) {
        logger.error('Unauthorized plan save attempt or mismatched user ID');
        return null;
      }

      // 2. Ensure authoritative parent row exists in public.profiles
      const profileReady = await ensureUserProfile(authenticatedUserId);
      if (!profileReady) {
        logger.error('Failed to ensure user profile for workout plan save');
        return null;
      }

      // 3. Idempotency check (Scenario B & F):
      // If the user already has an active workout plan with the exact same name, split_type, and day count:
      const { data: existingActive } = await supabase
        .from('workout_plans')
        .select(`
          id, user_id, name, description, split_type, is_active, created_at,
          workout_plan_days (
            id, plan_id, day_number, name, target_muscle_groups,
            workout_plan_exercises (
              id, plan_day_id, exercise_id, order_index, target_sets, target_reps_min, target_reps_max, rest_seconds, is_core,
              exercises (*)
            )
          )
        `)
        .eq('user_id', authenticatedUserId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (
        existingActive &&
        existingActive.name === plan.name &&
        existingActive.split_type === plan.splitType &&
        existingActive.workout_plan_days &&
        existingActive.workout_plan_days.length === plan.days.length
      ) {
        logger.info('Idempotent workout plan save: reusing identical active plan', { planId: existingActive.id });
        return {
          id: existingActive.id,
          userId: existingActive.user_id,
          name: existingActive.name,
          description: existingActive.description,
          splitType: existingActive.split_type,
          isActive: existingActive.is_active,
          days: (existingActive.workout_plan_days || []).map((d: any) => ({
            id: d.id,
            planId: d.plan_id,
            dayNumber: d.day_number,
            name: d.name,
            targetMuscleGroups: d.target_muscle_groups,
            exercises: (d.workout_plan_exercises || []).map((e: any) => ({
              id: e.id,
              planDayId: e.plan_day_id,
              exerciseId: e.exercise_id,
              orderIndex: e.order_index,
              targetSets: e.target_sets,
              targetRepsMin: e.target_reps_min,
              targetRepsMax: e.target_reps_max,
              restSeconds: e.rest_seconds,
              isCore: e.is_core,
              exercise: e.exercises,
            })),
          })),
        };
      }

      // 4. Scenario C / Regeneration: Deactivate previous active plans
      await supabase
        .from('workout_plans')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', authenticatedUserId)
        .eq('is_active', true);

      // 5. Insert new workout plan with is_active = true
      const { data: newPlan, error: planError } = await supabase
        .from('workout_plans')
        .insert({
          user_id: authenticatedUserId,
          name: plan.name,
          description: plan.description,
          split_type: plan.splitType,
          is_active: true,
        })
        .select()
        .single();

      if (planError || !newPlan) {
        logger.error('Error creating workout plan row', { planError });
        return null;
      }

      // Fetch system exercises to map any non-UUID or draft exercise IDs to valid database UUIDs
      const { data: catalogExercises } = await supabase
        .from('exercises')
        .select('id, name')
        .eq('is_system', true);

      const exerciseMapByName = new Map<string, string>();
      const validExerciseIds = new Set<string>();
      (catalogExercises || []).forEach(e => {
        exerciseMapByName.set(e.name.toLowerCase().trim(), e.id);
        validExerciseIds.add(e.id);
      });
      const defaultFallbackId = catalogExercises?.[0]?.id;

      // 6. Insert plan days & exercises with rollback on failure
      const savedDays = [];
      for (const day of plan.days) {
        const { data: newDay, error: dayError } = await supabase
          .from('workout_plan_days')
          .insert({
            plan_id: newPlan.id,
            day_number: day.dayNumber,
            name: day.name,
            target_muscle_groups: day.targetMuscleGroups,
          })
          .select()
          .single();

        if (dayError || !newDay) {
          logger.error('Error inserting workout plan day, rolling back partial plan', { dayError, planId: newPlan.id });
          await supabase.from('workout_plans').delete().eq('id', newPlan.id);
          return null;
        }

        const exInserts = day.exercises.map(ex => {
          let resolvedId = ex.exerciseId;
          if (!validExerciseIds.has(resolvedId)) {
            const exName = (ex.exercise?.name || '').toLowerCase().trim();
            resolvedId = exerciseMapByName.get(exName) || defaultFallbackId || ex.exerciseId;
          }

          return {
            plan_day_id: newDay.id,
            exercise_id: resolvedId,
            order_index: ex.orderIndex,
            target_sets: ex.targetSets,
            target_reps_min: ex.targetRepsMin,
            target_reps_max: ex.targetRepsMax,
            rest_seconds: ex.restSeconds,
            is_core: ex.isCore,
          };
        });

        if (exInserts.length > 0) {
          const { error: exError } = await supabase.from('workout_plan_exercises').insert(exInserts);
          if (exError) {
            logger.error('Error inserting workout plan exercises, rolling back partial plan', { exError, planId: newPlan.id });
            await supabase.from('workout_plans').delete().eq('id', newPlan.id);
            return null;
          }
        }
        savedDays.push({ ...day, id: newDay.id, planId: newPlan.id });
      }

      return {
        id: newPlan.id,
        userId: newPlan.user_id,
        name: newPlan.name,
        description: newPlan.description,
        splitType: newPlan.split_type,
        isActive: newPlan.is_active,
        days: savedDays,
      };
    } catch (err) {
      logger.error('Error saving generated workout plan', { err });
      return null;
    }
  },

  async finishWorkoutSession(
    sessionOrId: WorkoutSession | string,
    idempotencyKey: string,
    rating: 'easy' | 'normal' | 'exhausting',
    notes = '',
    fullSession?: WorkoutSession
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    clearActiveSessionDraft();

    const session: WorkoutSession | undefined =
      typeof sessionOrId === 'object' ? sessionOrId : fullSession;
    const rawSessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;

    // Determine whether core/necessary exercise requirement was fulfilled
    const isCoreCompleted = session ? hasCompletedCoreExercise(session) : true;

    // Helper for local storage persistence and mock offline resilience
    const persistLocally = async () => {
      const userId = session?.userId || 'guest-user';
      const existingRecords = await this.getPersonalRecords(userId);
      const existingPrsMap: Record<string, number> = {};
      existingRecords.forEach(r => {
        existingPrsMap[r.exerciseId] = r.estimatedOneRepMax;
      });

      const summary = session
        ? calculateWorkoutSummary(session, existingPrsMap)
        : { totalVolumeKg: 0, totalSets: 0, totalReps: 0, newPersonalRecords: [] };

      // Update PRs in localStorage
      if (summary.newPersonalRecords.length > 0) {
        const updatedRecords = [...existingRecords];
        for (const pr of summary.newPersonalRecords) {
          const idx = updatedRecords.findIndex(r => r.exerciseId === pr.exerciseId);
          const newRec: PersonalRecord = {
            id: `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userId,
            exerciseId: pr.exerciseId,
            exerciseName: pr.exerciseName,
            weightKg: pr.weightKg,
            reps: pr.reps,
            estimatedOneRepMax: pr.estimated1RM,
            achievedAt: new Date().toISOString(),
          };
          if (idx >= 0) {
            updatedRecords[idx] = newRec;
          } else {
            updatedRecords.push(newRec);
          }
        }
        try {
          localStorage.setItem(`personal_records_${userId}`, JSON.stringify(updatedRecords));
        } catch {
          // ignore
        }
      }

      // Update streak in localStorage ONLY if core/necessary exercises were completed
      let currentStreak = 1;
      let streakCounted = false;
      try {
        const rawStreak = localStorage.getItem(`streak_${userId}`);
        const currentStreakData = rawStreak
          ? JSON.parse(rawStreak)
          : { currentStreak: 3, longestStreak: 7, lastActivityDate: null };
        const todayStr = new Date().toISOString().split('T')[0];

        if (isCoreCompleted) {
          if (currentStreakData.lastActivityDate !== todayStr) {
            currentStreakData.currentStreak += 1;
            currentStreakData.longestStreak = Math.max(
              currentStreakData.longestStreak,
              currentStreakData.currentStreak
            );
            currentStreakData.lastActivityDate = todayStr;
            localStorage.setItem(`streak_${userId}`, JSON.stringify(currentStreakData));
          }
          streakCounted = true;
        }
        currentStreak = currentStreakData.currentStreak;
      } catch {
        // ignore
      }

      // Update coins in localStorage
      const coinsEarned = 15;
      try {
        const rawCoins = localStorage.getItem(`coin_balance_${userId}`);
        const currentCoins = rawCoins ? parseInt(rawCoins, 10) : 160;
        localStorage.setItem(`coin_balance_${userId}`, String(currentCoins + coinsEarned));
      } catch {
        // ignore
      }

      // Persist completed workout in history so scheduler and history immediately reflect completion
      if (session) {
        const completedSession: WorkoutSession = {
          ...session,
          status: 'completed',
          completedAt: new Date().toISOString(),
          sessionRating: rating,
          notes: notes || session.notes,
          gymVerified: Boolean(session.gymVerified),
        };

        try {
          const historyRaw = localStorage.getItem(`workout_history_${userId}`);
          let history: WorkoutSession[] = [];
          if (historyRaw) {
            try {
              history = JSON.parse(historyRaw);
            } catch {
              history = [];
            }
          }
          history = [completedSession, ...history.filter(s => s.id !== completedSession.id)];
          localStorage.setItem(`workout_history_${userId}`, JSON.stringify(history));
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        data: {
          status: 'success',
          session_id: rawSessionId,
          streak_count: currentStreak,
          streak_counted: streakCounted,
          core_completed: isCoreCompleted,
          gym_verified: Boolean(session?.gymVerified),
          coins_earned: coinsEarned,
          new_prs: summary.newPersonalRecords,
        },
      };
    };

    if (!isSupabaseConfigured || !session) {
      return persistLocally();
    }

    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData?.session?.user) {
        return persistLocally();
      }

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const dbSessionId = (rawSessionId && UUID_REGEX.test(rawSessionId)) ? rawSessionId : crypto.randomUUID();

      // Ensure session record exists
      const { data: existingSession } = await supabase
        .from('workout_sessions')
        .select('id, status, idempotency_key')
        .eq('id', dbSessionId)
        .maybeSingle();

      if (!existingSession) {
        const planId = session.planId && UUID_REGEX.test(session.planId) ? session.planId : null;
        await supabase.from('workout_sessions').insert({
          id: dbSessionId,
          user_id: session.userId,
          plan_id: planId,
          name: session.name || 'Workout Session',
          status: 'in_progress',
          started_at: session.startedAt || new Date().toISOString(),
          duration_seconds: session.durationSeconds || 0,
          idempotency_key: idempotencyKey,
          gym_verified: Boolean(session.gymVerified),
        });

        // Insert session exercises and sets
        if (session.exercises && session.exercises.length > 0) {
          for (const ex of session.exercises) {
            const sessionExerciseId = crypto.randomUUID();
            await supabase.from('workout_session_exercises').insert({
              id: sessionExerciseId,
              session_id: dbSessionId,
              exercise_id: ex.exerciseId,
              order_index: ex.orderIndex,
              notes: ex.notes || null,
            });

            const setsToInsert = (ex.sets || []).map(s => ({
              session_exercise_id: sessionExerciseId,
              set_index: s.setIndex,
              weight_kg: Number(s.weightKg) || 0,
              reps: Number(s.reps) || 0,
              rpe: s.rpe ? Number(s.rpe) : null,
              completed: Boolean(s.completed),
            }));

            if (setsToInsert.length > 0) {
              await supabase.from('workout_sets').insert(setsToInsert);
            }
          }
        }
      }

      // Execute atomic PostgreSQL RPC
      const { data, error } = await supabase.rpc('complete_workout_session', {
        p_session_id: dbSessionId,
        p_idempotency_key: idempotencyKey,
        p_session_rating: rating,
        p_notes: notes,
        p_is_core_completed: isCoreCompleted,
        p_gym_verified: Boolean(session?.gymVerified),
      });

      if (error) {
        logger.error('Supabase complete_workout_session RPC error', { error });
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: unknown) {
      logger.error('Supabase exception in finishWorkoutSession', { err });
      const message = err instanceof Error ? err.message : 'Failed to finalize workout session';
      return { success: false, error: message };
    }
  },

  async getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      try {
        const raw = localStorage.getItem(`personal_records_${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
      return [
        { id: 'pr-1', userId, exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', weightKg: 85, reps: 8, estimatedOneRepMax: 107.7, achievedAt: new Date().toISOString() },
        { id: 'pr-2', userId, exerciseId: 'ex-squat', exerciseName: 'Barbell Back Squat', weightKg: 100, reps: 6, estimatedOneRepMax: 120, achievedAt: new Date().toISOString() },
      ];
    }

    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*, exercises(name)')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false });

      if (error) {
        logger.error('Error fetching personal records from Supabase', { error });
        return [];
      }
      if (!data || data.length === 0) {
        return [];
      }

      return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        exerciseId: d.exercise_id,
        exerciseName: d.exercises?.name || 'Exercise',
        weightKg: Number(d.weight_kg),
        reps: d.reps,
        estimatedOneRepMax: Number(d.estimated_one_rep_max),
        achievedAt: d.achieved_at,
      }));
    } catch (err) {
      logger.error('Exception in getPersonalRecords', { err });
      return [];
    }
  },

  async getWorkoutHistory(userId: string, limit = 20): Promise<WorkoutSession[]> {
    return workoutRepository.fetchWorkoutHistory(userId, limit);
  },

  /**
   * Persists an active or completed workout session and sets.
   */
  async saveWorkoutSession(session: WorkoutSession): Promise<{ success: boolean; error?: string }> {
    return workoutRepository.saveWorkoutSession(session);
  },

  /**
   * Fetches the active in-progress session for the user from Supabase, if one exists.
   */
  async getActiveSession(userId: string): Promise<WorkoutSession | null> {
    return workoutRepository.fetchActiveSession(userId);
  },

  /**
   * Cancels a stale or abandoned in-progress session.
   */
  async cancelActiveSession(sessionId: string, userId: string): Promise<void> {
    return workoutRepository.cancelActiveSession(sessionId, userId);
  },

  /**
   * Fetches the previous completed performance (last working set weight/reps/rpe)
   * for an exercise from genuine completed sessions.
   * Returns null if no prior performance exists. Never fabricates values.
   */
  async getPreviousPerformance(
    userId: string,
    exerciseId: string
  ): Promise<{ weightKg: number; reps: number; rpe?: number } | null> {
    const map = await this.getPreviousPerformanceMap(userId);
    return map[exerciseId] || null;
  },

  /**
   * Fetches a map of genuine previous exercise performances for the user.
   * Evaluates completed sessions ordered by completed_at DESC.
   * Does NOT fabricate values; unlogged movements simply have no entry.
   */
  async getPreviousPerformanceMap(
    userId: string
  ): Promise<Record<string, { weightKg: number; reps: number; rpe?: number }>> {
    const map: Record<string, { weightKg: number; reps: number; rpe?: number }> = {};

    try {
      const history = await this.getWorkoutHistory(userId, 20);
      for (const sess of history) {
        if (!sess.exercises || sess.status !== 'completed') continue;
        for (const ex of sess.exercises) {
          // If already captured from a more recent completed session, skip
          if (map[ex.exerciseId]) continue;

          const completedSets = ex.sets?.filter(s => s.completed) || [];
          if (completedSets.length > 0) {
            const lastSet = completedSets[completedSets.length - 1];
            map[ex.exerciseId] = {
              weightKg: Number(lastSet.weightKg) || 0,
              reps: Number(lastSet.reps) || 0,
              rpe: lastSet.rpe ? Number(lastSet.rpe) : undefined,
            };
          }
        }
      }
      return map;
    } catch (err) {
      logger.warn('Failed to load authentic previous performance map', { err });
      return {};
    }
  },
};
