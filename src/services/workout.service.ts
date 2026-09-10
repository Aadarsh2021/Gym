import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { WorkoutPlan, WorkoutSession, PersonalRecord } from '@/types/workout.types';
import { GeneratedPlan } from '@/domain/workout-generator';
import { logger } from '@/lib/logger';
import { clearActiveSessionDraft } from '@/utils/storage';
import { calculateWorkoutSummary } from '@/domain/workout-tonnage';
import { getDayScheduledDays } from '@/domain/scheduled-workout';

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
      const mockPlan: WorkoutPlan = {
        id: 'plan-' + Date.now(),
        userId,
        name: plan.name,
        description: plan.description,
        splitType: plan.splitType,
        isActive: true,
        days: plan.days,
      };
      localStorage.setItem(`active_workout_plan_${userId}`, JSON.stringify(mockPlan));
      return mockPlan;
    }

    try {
      // 1. Deactivate current active plans
      await supabase.from('workout_plans').update({ is_active: false }).eq('user_id', userId);

      // 2. Insert new workout plan
      const { data: newPlan, error: planError } = await supabase
        .from('workout_plans')
        .insert({
          user_id: userId,
          name: plan.name,
          description: plan.description,
          split_type: plan.splitType,
          is_active: true,
        })
        .select()
        .single();

      if (planError || !newPlan) throw planError;

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

      // 3. Insert plan days & exercises
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
          logger.error('Error inserting workout plan day', { dayError });
          continue;
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
            logger.error('Error inserting workout plan exercises', { exError });
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

      // Update streak in localStorage
      let currentStreak = 1;
      try {
        const rawStreak = localStorage.getItem(`streak_${userId}`);
        const currentStreakData = rawStreak
          ? JSON.parse(rawStreak)
          : { currentStreak: 3, longestStreak: 7, lastActivityDate: null };
        const todayStr = new Date().toISOString().split('T')[0];
        if (currentStreakData.lastActivityDate !== todayStr) {
          currentStreakData.currentStreak += 1;
          currentStreakData.longestStreak = Math.max(
            currentStreakData.longestStreak,
            currentStreakData.currentStreak
          );
          currentStreakData.lastActivityDate = todayStr;
          localStorage.setItem(`streak_${userId}`, JSON.stringify(currentStreakData));
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
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      try {
        const raw = localStorage.getItem(`workout_history_${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, limit);
        }
      } catch {
        // ignore
      }
      return [
        {
          id: 'mock-session-1',
          userId,
          name: 'Chest & Triceps Hypertrophy',
          status: 'completed',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date().toISOString(),
          durationSeconds: 2700,
          sessionRating: 'normal',
          notes: 'Great pump today, hit PR on Incline Press.',
          exercises: [],
        },
      ];
    }

    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching workout history from Supabase', { error });
        return [];
      }
      if (!data || data.length === 0) {
        return [];
      }

      return data.map(s => ({
        id: s.id,
        userId: s.user_id,
        planId: s.plan_id,
        name: s.name,
        status: s.status,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        durationSeconds: s.duration_seconds,
        sessionRating: s.session_rating as any,
        notes: s.notes || undefined,
        exercises: [],
      }));
    } catch (err) {
      logger.error('Exception in getWorkoutHistory', { err });
      return [];
    }
  },

  /**
   * Fetches the previous completed performance (last working set weight/reps/rpe)
   * for an exercise to enable progressive overload cues in the tracker.
   */
  async getPreviousPerformance(
    userId: string,
    exerciseId: string
  ): Promise<{ weightKg: number; reps: number; rpe?: number } | null> {
    const map = await this.getPreviousPerformanceMap(userId);
    return map[exerciseId] || null;
  },

  /**
   * Fetches a map of all previous exercise performances for the user.
   */
  async getPreviousPerformanceMap(
    userId: string
  ): Promise<Record<string, { weightKg: number; reps: number; rpe?: number }>> {
    // Curated realistic defaults for demonstration / initial sessions
    const fallbackMap: Record<string, { weightKg: number; reps: number; rpe?: number }> = {
      'ex-bench-press': { weightKg: 80, reps: 8, rpe: 8 },
      'ex-1': { weightKg: 80, reps: 8, rpe: 8 },
      'ex-db-bench-press': { weightKg: 30, reps: 10, rpe: 8 },
      'ex-incline-db-press': { weightKg: 28, reps: 10, rpe: 8.5 },
      'ex-2': { weightKg: 28, reps: 10, rpe: 8.5 },
      'ex-deadlift': { weightKg: 135, reps: 5, rpe: 9 },
      'ex-4': { weightKg: 135, reps: 5, rpe: 9 },
      'ex-squat': { weightKg: 100, reps: 6, rpe: 8.5 },
      'ex-7': { weightKg: 100, reps: 6, rpe: 8.5 },
      'ex-overhead-press': { weightKg: 50, reps: 8, rpe: 8 },
      'ex-9': { weightKg: 50, reps: 8, rpe: 8 },
      'ex-barbell-row': { weightKg: 70, reps: 8, rpe: 8 },
      'ex-5': { weightKg: 70, reps: 8, rpe: 8 },
      'ex-lat-pulldown': { weightKg: 65, reps: 10, rpe: 7.5 },
      'ex-6': { weightKg: 65, reps: 10, rpe: 7.5 },
      'ex-seated-cable-row': { weightKg: 60, reps: 10, rpe: 8 },
      'ex-lateral-raise': { weightKg: 10, reps: 12, rpe: 8.5 },
      'ex-10': { weightKg: 10, reps: 12, rpe: 8.5 },
      'ex-goblet-squat': { weightKg: 28, reps: 10, rpe: 7.5 },
      'ex-8': { weightKg: 28, reps: 10, rpe: 7.5 },
      'ex-barbell-curl': { weightKg: 30, reps: 10, rpe: 8 },
      'ex-11': { weightKg: 30, reps: 10, rpe: 8 },
      'ex-tricep-pushdown': { weightKg: 25, reps: 12, rpe: 8 },
      'ex-12': { weightKg: 25, reps: 12, rpe: 8 },
    };

    // Overlay user's actual completed workout history
    try {
      const history = await this.getWorkoutHistory(userId, 10);
      for (const sess of history) {
        if (sess.exercises) {
          for (const ex of sess.exercises) {
            const workingSets = ex.sets?.filter(s => s.completed && s.weightKg > 0);
            if (workingSets && workingSets.length > 0) {
              const lastSet = workingSets[workingSets.length - 1];
              fallbackMap[ex.exerciseId] = {
                weightKg: lastSet.weightKg,
                reps: lastSet.reps,
                rpe: lastSet.rpe,
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }

    if (!isSupabaseConfigured) {
      return fallbackMap;
    }

    try {
      const { data, error } = await supabase
        .from('workout_session_exercises')
        .select(`
          exercise_id,
          workout_sets (weight_kg, reps, rpe, completed),
          workout_sessions!inner (user_id, status, completed_at)
        `)
        .eq('workout_sessions.user_id', userId)
        .eq('workout_sessions.status', 'completed')
        .order('workout_sessions(completed_at)', { ascending: false });

      if (error || !data) return fallbackMap;

      const map = { ...fallbackMap };
      for (const row of data as any[]) {
        if (!map[row.exercise_id] && row.workout_sets && row.workout_sets.length > 0) {
          const validSets = row.workout_sets.filter((s: any) => s.completed);
          if (validSets.length > 0) {
            const lastSet = validSets[validSets.length - 1];
            map[row.exercise_id] = {
              weightKg: Number(lastSet.weight_kg),
              reps: lastSet.reps,
              rpe: lastSet.rpe ? Number(lastSet.rpe) : undefined,
            };
          }
        }
      }
      return map;
    } catch {
      return fallbackMap;
    }
  },
};
