import { WorkoutPlanDay, WorkoutPlanExercise } from '@/types/workout.types';
import { WorkoutEnvironment } from '@/types/user.types';
import { isExerciseCompatible, isExerciseLimitationSafe } from './exercise-compatibility';

export type WorkoutTimeMode = 20 | 30 | 45 | 60;

export interface TimeModeOptions {
  workoutEnvironment?: WorkoutEnvironment | null;
  availableEquipment?: string[];
  limitations?: string[];
}

export interface TimeBudgetedWorkoutResult {
  success: boolean;
  planDay: WorkoutPlanDay;
  targetDurationMinutes: number;
  totalExercises: number;
  totalSets: number;
  error?: string;
}

/**
 * Normalizes input duration to one of the supported Time Modes: 20, 30, 45, or 60 (Full).
 * If invalid, unspecified, or >= 60, defaults safely to 60 (Full Plan).
 */
export function normalizeTimeMode(durationMinutes?: number | string | null): WorkoutTimeMode {
  const parsed = typeof durationMinutes === 'string' ? parseInt(durationMinutes, 10) : Number(durationMinutes);
  if (isNaN(parsed) || parsed <= 0) return 60;
  if (parsed <= 25) return 20;
  if (parsed <= 35) return 30;
  if (parsed <= 50) return 45;
  return 60;
}

/**
 * Compresses a scheduled workout plan day to fit a specific target time duration.
 *
 * Rules:
 * - 20 minutes: 1–2 exercises, capped at 2 sets each (strict core compound focus).
 * - 30 minutes: 2–3 exercises, 2–3 sets each.
 * - 45 minutes: 3–4 exercises, 3 sets each.
 * - 60+ minutes (Full): Full plan prescription without truncation.
 *
 * Constraints (C8 Preservation):
 * - Preserves environment compatibility (home_bodyweight, home_equipped, external_gym, connected_gym).
 * - Preserves declared equipment match.
 * - Preserves joint limitation / injury safety.
 * - ZERO arbitrary catalog fallback: if 0 exercises remain after filtering, returns a safe failure.
 */
export function compressWorkoutForDuration(
  fullPlanDay: WorkoutPlanDay,
  targetDurationMinutes: number = 60,
  options: TimeModeOptions = {}
): TimeBudgetedWorkoutResult {
  const normalizedDuration = normalizeTimeMode(targetDurationMinutes);

  // 1. Filter exercises strictly against C8 environment, equipment, and limitation rules
  const compatibleExercises = (fullPlanDay.exercises || []).filter(wpe => {
    const exRef = wpe.exercise || {
      name: '',
      equipmentRequired: '',
    };

    if (options.workoutEnvironment !== undefined || options.availableEquipment !== undefined) {
      if (!isExerciseCompatible(exRef, options.workoutEnvironment, options.availableEquipment || [])) {
        return false;
      }
    }

    if (options.limitations && options.limitations.length > 0) {
      if (!isExerciseLimitationSafe(exRef, options.limitations)) {
        return false;
      }
    }

    return true;
  });

  // CORRECTION 1: If zero compatible exercises exist, return safe failure state WITHOUT arbitrary fallback
  if (compatibleExercises.length === 0) {
    return {
      success: false,
      planDay: {
        ...fullPlanDay,
        exercises: [],
      },
      targetDurationMinutes: normalizedDuration,
      totalExercises: 0,
      totalSets: 0,
      error: 'No compatible exercises available matching the environment and safety constraints for this routine.',
    };
  }

  // 2. If Full Plan (60m+), return full compatible routine
  if (normalizedDuration === 60) {
    const totalSets = compatibleExercises.reduce((sum, e) => sum + (e.targetSets || 3), 0);
    return {
      success: true,
      planDay: {
        ...fullPlanDay,
        exercises: compatibleExercises.map((ex, idx) => ({
          ...ex,
          orderIndex: idx + 1,
        })),
      },
      targetDurationMinutes: 60,
      totalExercises: compatibleExercises.length,
      totalSets,
    };
  }

  // 3. Sort prioritized: Core compound exercises first, preserving original relative order
  const coreExercises = compatibleExercises.filter(e => e.isCore);
  const secondaryExercises = compatibleExercises.filter(e => !e.isCore);
  const prioritizedPool = [...coreExercises, ...secondaryExercises];

  // 4. Determine exercise count and set limits by duration
  let maxExercises = 2;
  let maxSetsPerExercise = 2;
  let labelPrefix = '⚡ Express 20m';

  switch (normalizedDuration) {
    case 20:
      maxExercises = 2;
      maxSetsPerExercise = 2;
      labelPrefix = '⚡ 20m Express';
      break;
    case 30:
      maxExercises = 3;
      maxSetsPerExercise = 3;
      labelPrefix = '⚡ 30m Time Crunch';
      break;
    case 45:
      maxExercises = 4;
      maxSetsPerExercise = 3;
      labelPrefix = '⚡ 45m Focused';
      break;
  }

  const selectedExercises = prioritizedPool.slice(0, Math.min(prioritizedPool.length, maxExercises));

  const compressedExercises: WorkoutPlanExercise[] = selectedExercises.map((ex, idx) => {
    // For 30m mode, set count can taper (e.g. 3 sets for 1st-2nd, 2 sets for 3rd)
    let setsForThisEx = Math.min(ex.targetSets || 3, maxSetsPerExercise);
    if (normalizedDuration === 30 && idx >= 2) {
      setsForThisEx = Math.min(setsForThisEx, 2);
    }

    return {
      ...ex,
      orderIndex: idx + 1,
      targetSets: setsForThisEx,
    };
  });

  const totalSets = compressedExercises.reduce((sum, e) => sum + e.targetSets, 0);

  return {
    success: true,
    planDay: {
      ...fullPlanDay,
      name: `${labelPrefix}: ${fullPlanDay.name}`,
      exercises: compressedExercises,
    },
    targetDurationMinutes: normalizedDuration,
    totalExercises: compressedExercises.length,
    totalSets,
  };
}

/**
 * Backwards-compatible convenience wrapper for short sessions.
 */
export function generateQuickSession(
  fullPlanDay: WorkoutPlanDay,
  targetDurationMinutes: number = 15
): WorkoutPlanDay {
  const result = compressWorkoutForDuration(fullPlanDay, targetDurationMinutes);
  return result.planDay;
}
