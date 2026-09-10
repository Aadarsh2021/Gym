/**
 * Pure Deterministic Protein Requirement Calculations
 * Based on bodyweight (kg), training goals, and dietary context.
 */

import { FitnessGoal } from '@/types/user.types';

/**
 * Recommended protein intake range (g per kg of bodyweight) based on goal:
 * - Muscle Gain: 1.8 - 2.2 g/kg (Optimal hypertrophy stimulus)
 * - Fat Loss: 2.0 - 2.4 g/kg (Preserves lean mass in caloric deficit)
 * - Strength: 1.7 - 2.0 g/kg
 * - Maintenance / Endurance: 1.4 - 1.8 g/kg
 */
export function getProteinMultiplier(goal: FitnessGoal): { min: number; target: number; max: number } {
  switch (goal) {
    case 'muscle_gain':
      return { min: 1.8, target: 2.0, max: 2.2 };
    case 'fat_loss':
      return { min: 2.0, target: 2.2, max: 2.4 };
    case 'strength':
      return { min: 1.7, target: 1.85, max: 2.0 };
    case 'endurance':
    case 'maintenance':
    default:
      return { min: 1.4, target: 1.6, max: 1.8 };
  }
}

/**
 * Calculates daily target protein in grams.
 * Minimum physiological threshold: 45g (floor).
 */
export function calculateProteinTarget(weightKg: number, goal: FitnessGoal): number {
  if (weightKg <= 0) return 0;
  const { target } = getProteinMultiplier(goal);
  const calculated = Math.round(weightKg * target);
  return Math.max(45, calculated);
}

/**
 * Calculates balanced macronutrient split:
 * - Protein: calculated from bodyweight (4 kcal/g)
 * - Fat: 25% of total calories (9 kcal/g)
 * - Carbs: Remaining calories (4 kcal/g)
 */
export function calculateMacroSplit(targetCalories: number, targetProteinG: number): {
  proteinG: number;
  fatG: number;
  carbsG: number;
} {
  if (targetCalories <= 0 || targetProteinG <= 0) {
    return { proteinG: 0, fatG: 0, carbsG: 0 };
  }

  const proteinCalories = targetProteinG * 4;
  const fatCalories = targetCalories * 0.25;
  const fatG = Math.round(fatCalories / 9);

  const remainingCalories = Math.max(0, targetCalories - (proteinCalories + fatCalories));
  const carbsG = Math.round(remainingCalories / 4);

  return {
    proteinG: targetProteinG,
    fatG: Math.max(20, fatG),
    carbsG: Math.max(50, carbsG),
  };
}
