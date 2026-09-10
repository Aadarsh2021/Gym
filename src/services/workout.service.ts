import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { WorkoutPlan, WorkoutSession, PersonalRecord } from '@/types/workout.types';
import { GeneratedPlan } from '@/domain/workout-generator';
import { logger } from '@/lib/logger';
import { clearActiveSessionDraft } from '@/utils/storage';

export const workoutService = {
  async getActivePlan(userId: string): Promise<WorkoutPlan | null> {
    if (!isSupabaseConfigured) {
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
        days: (plan.workout_plan_days || []).map((day: any) => ({
          id: day.id,
          planId: day.plan_id,
          dayNumber: day.day_number,
          name: day.name,
          targetMuscleGroups: day.target_muscle_groups || [],
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
    if (!isSupabaseConfigured) {
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

      // 3. Insert plan days & exercises
      const savedDays = [];
      for (const day of plan.days) {
        const { data: newDay } = await supabase
          .from('workout_plan_days')
          .insert({
            plan_id: newPlan.id,
            day_number: day.dayNumber,
            name: day.name,
            target_muscle_groups: day.targetMuscleGroups,
          })
          .select()
          .single();

        if (newDay) {
          const exInserts = day.exercises.map(ex => ({
            plan_day_id: newDay.id,
            exercise_id: ex.exerciseId,
            order_index: ex.orderIndex,
            target_sets: ex.targetSets,
            target_reps_min: ex.targetRepsMin,
            target_reps_max: ex.targetRepsMax,
            rest_seconds: ex.restSeconds,
            is_core: ex.isCore,
          }));

          await supabase.from('workout_plan_exercises').insert(exInserts);
          savedDays.push({ ...day, id: newDay.id, planId: newPlan.id });
        }
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
    sessionId: string,
    idempotencyKey: string,
    rating: 'easy' | 'normal' | 'exhausting',
    notes = ''
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    clearActiveSessionDraft();

    if (!isSupabaseConfigured) {
      // Local preview simulation
      return {
        success: true,
        data: {
          status: 'success',
          session_id: sessionId,
          streak_count: 1,
          coins_earned: 10,
          new_prs: [],
        },
      };
    }

    try {
      // Execute the atomic PostgreSQL RPC
      const { data, error } = await supabase.rpc('complete_workout_session', {
        p_session_id: sessionId,
        p_idempotency_key: idempotencyKey,
        p_session_rating: rating,
        p_notes: notes,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Workout finalization failed';
      return { success: false, error: message };
    }
  },

  async getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    if (!isSupabaseConfigured) {
      return [
        { id: 'pr-1', userId, exerciseId: 'ex-1', exerciseName: 'Barbell Bench Press', weightKg: 85, reps: 8, estimatedOneRepMax: 107.7, achievedAt: new Date().toISOString() },
        { id: 'pr-2', userId, exerciseId: 'ex-7', exerciseName: 'Barbell Back Squat', weightKg: 100, reps: 6, estimatedOneRepMax: 120, achievedAt: new Date().toISOString() },
      ];
    }

    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*, exercises(name)')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false });

      if (error || !data) return [];

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
    } catch {
      return [];
    }
  },

  async getWorkoutHistory(userId: string, limit = 20): Promise<WorkoutSession[]> {
    if (!isSupabaseConfigured) {
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

      if (error || !data) return [];

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
    } catch {
      return [];
    }
  },
};
