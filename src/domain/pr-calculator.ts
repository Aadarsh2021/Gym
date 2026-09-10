/**
 * Pure Deterministic 1RM and PR Calculation Engine
 * Formulas: Epley and Brzycki equations for estimated 1-Rep Max.
 */

/**
 * Calculates Estimated 1-Rep Max using the Epley formula:
 * 1RM = weight * (1 + reps / 30)
 * Note: If reps === 1, 1RM equals the weight lifted.
 */
export function calculateOneRepMaxEpley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Number(weightKg.toFixed(1));
  const estimated = weightKg * (1 + reps / 30.0);
  return Number(estimated.toFixed(1));
}

/**
 * Calculates Estimated 1-Rep Max using the Brzycki formula:
 * 1RM = weight * (36 / (37 - reps))
 * Valid for reps between 1 and 10.
 */
export function calculateOneRepMaxBrzycki(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Number(weightKg.toFixed(1));
  if (reps >= 37) return Number(weightKg.toFixed(1)); // Guard against division by zero/negative
  const estimated = weightKg * (36.0 / (37.0 - reps));
  return Number(estimated.toFixed(1));
}

export interface PRCheckResult {
  isNewWeightPR: boolean;
  isNewRepPR: boolean;
  isNew1RMPR: boolean;
  newEstimated1RM: number;
}

/**
 * Checks if a set performance beats the existing Personal Record
 */
export function checkPersonalRecord(
  newWeightKg: number,
  newReps: number,
  existingPR?: { weightKg: number; reps: number; estimatedOneRepMax: number } | null
): PRCheckResult {
  const new1RM = calculateOneRepMaxEpley(newWeightKg, newReps);

  if (!existingPR) {
    return {
      isNewWeightPR: newWeightKg > 0,
      isNewRepPR: newReps > 0,
      isNew1RMPR: new1RM > 0,
      newEstimated1RM: new1RM,
    };
  }

  const isNewWeightPR = newWeightKg > existingPR.weightKg;
  const isNewRepPR = newWeightKg >= existingPR.weightKg && newReps > existingPR.reps;
  const isNew1RMPR = new1RM > existingPR.estimatedOneRepMax;

  return {
    isNewWeightPR,
    isNewRepPR,
    isNew1RMPR,
    newEstimated1RM: new1RM,
  };
}
