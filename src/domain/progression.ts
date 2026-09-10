import { WorkoutSet } from '@/types/workout.types';

export interface ProgressionEvaluationInput {
  exerciseName: string;
  primaryMuscle: string;
  targetRepsMin: number;
  targetRepsMax: number;
  currentSets: WorkoutSet[];
  previousPerformance?: {
    weightKg: number;
    reps: number;
    rpe?: number;
  };
}

export type ProgressionAction = 'increase_load' | 'consolidate' | 'reduce_load' | 'in_progress';

export interface ProgressionRecommendation {
  action: ProgressionAction;
  suggestedIncrementKg?: number;
  cue: string;
  reason: string;
}

/**
 * Pure deterministic progressive overload cue generator.
 * Evaluates working sets only (filters out warm-up, drop, and failure sets).
 * Generates advice cues ONLY without mutating actual weights.
 */
export function evaluateProgression(
  input: ProgressionEvaluationInput
): ProgressionRecommendation {
  const { primaryMuscle, targetRepsMin, targetRepsMax, currentSets } = input;

  // STRICT RULE: Only consider completed working sets ('normal' or undefined).
  // Warm-up, drop, and failure sets must NOT be counted as double-progression evidence.
  const workingSets = currentSets.filter(
    set => set.completed && (!set.setType || set.setType === 'normal')
  );

  // If no working sets have been completed yet
  if (workingSets.length === 0) {
    return {
      action: 'in_progress',
      cue: `Target: ${targetRepsMin}–${targetRepsMax} reps per working set. Maintain strict control.`,
      reason: 'No completed working sets logged yet.',
    };
  }

  // Calculate average reps and check if all working sets hit the top of the rep range
  const allHitMaxReps = workingSets.every(set => set.reps >= targetRepsMax);
  const anyBelowMinReps = workingSets.some(set => set.reps < targetRepsMin);

  // Check RPE across working sets
  const recordedRpes = workingSets
    .map(s => s.rpe)
    .filter((rpe): rpe is number => typeof rpe === 'number' && rpe > 0);
  const avgRpe = recordedRpes.length > 0
    ? recordedRpes.reduce((sum, r) => sum + r, 0) / recordedRpes.length
    : 8;

  // Lower body exercises typically progress in 5 kg increments, upper body in 2.5 kg
  const isLowerBody = ['legs', 'quads', 'hamstrings', 'glutes', 'calves'].includes(
    primaryMuscle.toLowerCase()
  );
  const recommendedIncrement = isLowerBody ? 5 : 2.5;

  // Case 1: Excessive strain / technique breakdown (High RPE >= 9.5 and missed reps)
  if (avgRpe >= 9.5 && anyBelowMinReps) {
    return {
      action: 'reduce_load',
      cue: 'Consider reducing load by 5-10% to preserve clean movement tempo.',
      reason: 'High perceived exertion (RPE ≥ 9.5) combined with falling short of target reps.',
    };
  }

  // Case 2: Hit top of target rep range with controlled RPE (<= 8.5)
  if (allHitMaxReps && avgRpe <= 8.5) {
    return {
      action: 'increase_load',
      suggestedIncrementKg: recommendedIncrement,
      cue: `Ready to try +${recommendedIncrement} kg next session. You hit ${targetRepsMax} reps cleanly on all working sets!`,
      reason: `Completed all working sets at or above target ${targetRepsMax} reps with controlled RPE (avg ${avgRpe.toFixed(1)}).`,
    };
  }

  // Case 3: Hit top reps but high RPE (9 - 9.5)
  if (allHitMaxReps && avgRpe > 8.5) {
    return {
      action: 'consolidate',
      cue: 'Keep the same load next session and consolidate form before increasing weight.',
      reason: `Target reps achieved, but exertion was near failure (RPE ${avgRpe.toFixed(1)}).`,
    };
  }

  // Case 4: Working within target rep bracket (e.g. 8-10 reps)
  if (!anyBelowMinReps) {
    return {
      action: 'consolidate',
      cue: `Solid progress! Aim to add 1-2 more reps across sets before adding load.`,
      reason: `Working sets fell within the ${targetRepsMin}–${targetRepsMax} rep range.`,
    };
  }

  // Case 5: Fell short of minimum reps
  return {
    action: 'consolidate',
    cue: `Focus on hitting at least ${targetRepsMin} clean reps on every working set before progressing.`,
    reason: `Some sets were below target minimum (${targetRepsMin} reps).`,
  };
}
