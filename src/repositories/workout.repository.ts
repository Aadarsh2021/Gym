import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { WorkoutSession, WorkoutPlan, PersonalRecord } from '@/types/workout.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CompleteWorkoutRpcParams {
  sessionId: string;
  idempotencyKey: string;
  rating: 'easy' | 'normal' | 'exhausting';
  notes?: string;
  isCoreCompleted: boolean;
  gymVerified: boolean;
}

export class WorkoutRepository {
  /**
   * Fetches completed workout history with all exercises and sets joined.
   * Resolves P0 Issue: previously returned empty exercises array.
   */
  async fetchWorkoutHistory(userId: string, limit = 20): Promise<WorkoutSession[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`workout_history_${userId}`);
      if (raw && typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.slice(0, limit);
        } catch {
          // ignore
        }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          id,
          user_id,
          plan_id,
          name,
          status,
          started_at,
          completed_at,
          duration_seconds,
          session_rating,
          notes,
          gym_id,
          gym_verified,
          workout_session_exercises (
            id,
            exercise_id,
            order_index,
            notes,
            exercises (id, name, primary_muscle),
            workout_sets (
              id,
              set_index,
              weight_kg,
              reps,
              rpe,
              completed,
              completed_at
            )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('WorkoutRepository: Error fetching workout history', { error });
        return [];
      }
      if (!data || data.length === 0) {
        return [];
      }

      return data.map((s: any) => {
        const rawExercises = s.workout_session_exercises || [];
        // Sort exercises by order_index
        rawExercises.sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

        const exercises = rawExercises.map((se: any) => {
          const rawSets = se.workout_sets || [];
          rawSets.sort((a: any, b: any) => (a.set_index ?? 0) - (b.set_index ?? 0));

          return {
            id: se.id,
            exerciseId: se.exercise_id,
            exerciseName: se.exercises?.name || 'Exercise',
            targetSets: rawSets.length || 3,
            targetRepsMin: 8,
            targetRepsMax: 12,
            restSeconds: 90,
            isCore: true,
            notes: se.notes || undefined,
            sets: rawSets.map((set: any) => ({
              id: set.id,
              setIndex: set.set_index,
              weightKg: Number(set.weight_kg) || 0,
              reps: Number(set.reps) || 0,
              rpe: set.rpe ? Number(set.rpe) : undefined,
              completed: Boolean(set.completed),
              completedAt: set.completed_at || undefined,
            })),
          };
        });

        return {
          id: s.id,
          userId: s.user_id,
          planId: s.plan_id,
          name: s.name,
          status: s.status,
          startedAt: s.started_at,
          completedAt: s.completed_at,
          durationSeconds: s.duration_seconds || 0,
          sessionRating: s.session_rating as any,
          notes: s.notes || undefined,
          gymId: s.gym_id || undefined,
          gymVerified: Boolean(s.gym_verified),
          exercises,
        };
      });
    } catch (err) {
      logger.error('WorkoutRepository: Exception in fetchWorkoutHistory', { err });
      return [];
    }
  }

  /**
   * Persists active or completed workout session and sets.
   */
  async saveWorkoutSession(session: WorkoutSession): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(session.userId)) {
      return { success: true };
    }

    try {
      const dbSessionId = UUID_REGEX.test(session.id) ? session.id : crypto.randomUUID();
      const planId = session.planId && UUID_REGEX.test(session.planId) ? session.planId : null;

      // Upsert workout_session
      const { error: sessionError } = await supabase.from('workout_sessions').upsert({
        id: dbSessionId,
        user_id: session.userId,
        plan_id: planId,
        name: session.name || 'Workout Session',
        status: session.status,
        started_at: session.startedAt || new Date().toISOString(),
        completed_at: session.completedAt || null,
        duration_seconds: session.durationSeconds || 0,
        session_rating: session.sessionRating || null,
        notes: session.notes || null,
        gym_id: session.gymId && UUID_REGEX.test(session.gymId) ? session.gymId : null,
        gym_verified: Boolean(session.gymVerified),
      });

      if (sessionError) {
        logger.error('WorkoutRepository: Error saving workout session', { sessionError });
        return { success: false, error: sessionError.message };
      }

      // Upsert exercises & sets
      if (session.exercises && session.exercises.length > 0) {
        for (const [index, ex] of session.exercises.entries()) {
          const sessionExerciseId = ex.id && UUID_REGEX.test(ex.id) ? ex.id : crypto.randomUUID();
          
          await supabase.from('workout_session_exercises').upsert({
            id: sessionExerciseId,
            session_id: dbSessionId,
            exercise_id: ex.exerciseId,
            order_index: index,
            notes: ex.notes || null,
          });

          if (ex.sets && ex.sets.length > 0) {
            const setsToInsert = ex.sets.map(s => ({
              id: s.id && UUID_REGEX.test(s.id) ? s.id : crypto.randomUUID(),
              session_exercise_id: sessionExerciseId,
              set_index: s.setIndex,
              weight_kg: Number(s.weightKg) || 0,
              reps: Number(s.reps) || 0,
              rpe: s.rpe ? Number(s.rpe) : null,
              completed: Boolean(s.completed),
              completed_at: s.completedAt || null,
            }));
            await supabase.from('workout_sets').upsert(setsToInsert);
          }
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown database error';
      logger.error('WorkoutRepository: Exception in saveWorkoutSession', { err });
      return { success: false, error: msg };
    }
  }

  /**
   * Invokes the atomic complete_workout_session RPC.
   */
  async completeWorkoutSessionRpc(
    params: CompleteWorkoutRpcParams
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: true, data: { status: 'mock_completed' } };
    }

    try {
      const { data, error } = await supabase.rpc('complete_workout_session', {
        p_session_id: params.sessionId,
        p_idempotency_key: params.idempotencyKey,
        p_session_rating: params.rating,
        p_notes: params.notes || '',
        p_is_core_completed: params.isCoreCompleted,
        p_gym_verified: params.gymVerified,
      });

      if (error) {
        logger.error('WorkoutRepository: complete_workout_session RPC error', { error });
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to invoke completion RPC';
      return { success: false, error: msg };
    }
  }

  /**
   * Fetches active workout plan for a user.
   */
  async fetchActivePlan(userId: string): Promise<WorkoutPlan | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`workout_plan_${userId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planError || !plan) return null;

      const { data: days, error: daysError } = await supabase
        .from('workout_plan_days')
        .select('*, workout_plan_exercises(*, exercises(*))')
        .eq('plan_id', plan.id)
        .order('day_number', { ascending: true });

      if (daysError || !days) return null;

      return {
        id: plan.id,
        userId: plan.user_id,
        name: plan.name,
        description: plan.description || '',
        splitType: plan.split_type as any,
        isActive: plan.is_active,
        createdAt: plan.created_at,
        days: days.map(d => ({
          id: d.id,
          planId: d.plan_id,
          dayNumber: d.day_number,
          name: d.name,
          targetMuscleGroups: d.target_muscle_groups || [],
          exercises: (d.workout_plan_exercises || []).map((pe: any) => ({
            id: pe.id,
            exerciseId: pe.exercise_id,
            exerciseName: pe.exercises?.name || 'Exercise',
            orderIndex: pe.order_index,
            targetSets: pe.target_sets,
            targetRepsMin: pe.target_reps_min,
            targetRepsMax: pe.target_reps_max,
            restSeconds: pe.rest_seconds,
            isCore: pe.is_core,
          })),
        })),
      };
    } catch (err) {
      logger.error('WorkoutRepository: Error fetching active plan', { err });
      return null;
    }
  }

  /**
   * Fetches personal records for a user.
   */
  async fetchPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`personal_records_${userId}`);
      if (raw && typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* ignore */ }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*, exercises(name)')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false });

      if (error || !data) return [];

      return data.map(r => ({
        id: r.id,
        userId: r.user_id,
        exerciseId: r.exercise_id,
        exerciseName: (r.exercises as any)?.name || 'Exercise',
        weightKg: Number(r.weight_kg),
        reps: r.reps,
        estimatedOneRepMax: Number(r.estimated_one_rep_max),
        achievedAt: r.achieved_at,
      }));
    } catch (err) {
      logger.error('WorkoutRepository: Error fetching PRs', { err });
      return [];
    }
  }
}

export const workoutRepository = new WorkoutRepository();
