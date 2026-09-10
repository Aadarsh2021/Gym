import { WorkoutSession } from '@/types/workout.types';
import { calculateOneRepMaxEpley as calculateOneRepMax } from './pr-calculator';

export interface WorkoutPerformanceSummary {
  totalVolumeKg: number;
  totalCompletedSets: number;
  totalReps: number;
  newPersonalRecords: Array<{
    exerciseId: string;
    exerciseName: string;
    weightKg: number;
    reps: number;
    estimated1RM: number;
  }>;
}

/**
 * Pure platform-independent calculation of workout volume tonnage and metrics.
 */
export function calculateWorkoutSummary(
  session: WorkoutSession,
  existingPrsMap: Record<string, number> = {} // exerciseId -> existing 1RM
): WorkoutPerformanceSummary {
  let totalVolumeKg = 0;
  let totalCompletedSets = 0;
  let totalReps = 0;
  const newPrs: WorkoutPerformanceSummary['newPersonalRecords'] = [];

  for (const exercise of session.exercises) {
    let bestEstimated1RMInSession = 0;
    let bestSet: { weightKg: number; reps: number } | null = null;

    for (const set of exercise.sets) {
      if (set.completed && set.weightKg > 0 && set.reps > 0) {
        totalVolumeKg += set.weightKg * set.reps;
        totalCompletedSets += 1;
        totalReps += set.reps;

        // Skip warmup sets when evaluating personal records
        if (set.setType !== 'warmup') {
          const estimated1RM = calculateOneRepMax(set.weightKg, set.reps);
          if (estimated1RM > bestEstimated1RMInSession) {
            bestEstimated1RMInSession = estimated1RM;
            bestSet = { weightKg: set.weightKg, reps: set.reps };
          }
        }
      }
    }

    // Compare against existing PR for this exercise
    const priorPr = existingPrsMap[exercise.exerciseId] || 0;
    if (bestEstimated1RMInSession > priorPr && bestSet) {
      newPrs.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        weightKg: bestSet.weightKg,
        reps: bestSet.reps,
        estimated1RM: bestEstimated1RMInSession,
      });
    }
  }

  return {
    totalVolumeKg: Math.round(totalVolumeKg),
    totalCompletedSets,
    totalReps,
    newPersonalRecords: newPrs,
  };
}
