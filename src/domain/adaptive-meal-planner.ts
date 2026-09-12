import { AdaptiveReviewCalculation } from '@/types/nutrition.types';
export type { AdaptiveReviewCalculation };


export interface AdaptivePlannerProfile {
  age?: number;
  gender?: 'male' | 'female';
  heightCm?: number;
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  fitnessGoal?: 'fat_loss' | 'muscle_gain' | 'maintenance' | 'strength';
}

export interface AdaptiveReviewInput {
  planCreatedAt: string;
  currentCalories: number;
  currentProteinG: number;
  previousWeightKg: number | null;
  currentWeightKg: number | null;
  profile?: AdaptivePlannerProfile;
  reviewWindowDays?: number; // default 14 days (2 weeks)
  now?: Date;
}

/**
 * Calculates deterministic review window and adaptive nutritional adjustments.
 * Triggered when a plan is >= 14 days old (2 to 3-week adaptive review window).
 */
export function calculateAdaptiveMealReview(
  input: AdaptiveReviewInput
): AdaptiveReviewCalculation {
  const {
    planCreatedAt,
    currentCalories,
    currentProteinG,
    previousWeightKg,
    currentWeightKg,
    profile = {},
    reviewWindowDays = 14,
    now = new Date(),
  } = input;

  const planDate = new Date(planCreatedAt);
  const diffMs = Math.max(0, now.getTime() - planDate.getTime());
  const planAgeDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const planAgeWeeks = Math.floor(planAgeDays / 7);

  const isDue = planAgeDays >= reviewWindowDays;

  // Weight delta
  const prevW = previousWeightKg ?? currentWeightKg ?? 70;
  const currW = currentWeightKg ?? previousWeightKg ?? 70;
  const weightDeltaKg = Math.round((currW - prevW) * 10) / 10;

  // Base profile characteristics (with standard fallback)
  const age = profile.age || 25;
  const gender = profile.gender || 'male';
  const heightCm = profile.heightCm || 172;
  const goal = profile.fitnessGoal || 'fat_loss';

  // Mifflin-St Jeor Equation with updated weight
  const s = gender === 'male' ? 5 : -161;
  const bmr = 10 * currW + 6.25 * heightCm - 5 * age + s;

  // Activity multipliers
  const activityMap: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
  };
  const multiplier = activityMap[profile.activityLevel || 'moderately_active'] || 1.45;
  const tdee = Math.round(bmr * multiplier);

  // Goal caloric adjustments
  let targetCalories = tdee;
  if (goal === 'fat_loss') {
    targetCalories = Math.max(1300, tdee - 450);
  } else if (goal === 'muscle_gain' || goal === 'strength') {
    targetCalories = Math.round(tdee + 350);
  } else {
    targetCalories = Math.round(tdee);
  }

  // Protein targets based on current weight & goal
  let proteinFactor = 2.0; // g/kg baseline athletic
  if (goal === 'fat_loss') proteinFactor = 2.1; // protect lean mass in deficit
  if (goal === 'muscle_gain') proteinFactor = 2.0;
  const targetProteinG = Math.round(currW * proteinFactor);

  // Calorie & Protein deltas
  const calorieDelta = targetCalories - currentCalories;
  const proteinDelta = targetProteinG - currentProteinG;

  // Generate deterministic rationale
  let rationale = '';
  if (weightDeltaKg < -0.8 && goal === 'fat_loss') {
    rationale = `Excellent progress! You dropped ${Math.abs(weightDeltaKg)} kg over the past ${planAgeWeeks || 2} weeks. Your calorie target has been slightly recalibrated to prevent metabolic adaptation while maintaining steady fat loss.`;
  } else if (weightDeltaKg >= 0 && goal === 'fat_loss') {
    rationale = `Weight remained steady (${weightDeltaKg > 0 ? '+' : ''}${weightDeltaKg} kg) over ${planAgeDays} days. A modest deficit calibration is recommended to reignite fat oxidation.`;
  } else if (weightDeltaKg > 0.8 && (goal === 'muscle_gain' || goal === 'strength')) {
    rationale = `Great hypertrophy trajectory! You gained +${weightDeltaKg} kg. Protein and calories have been updated to support your increased working weight and recovery.`;
  } else {
    rationale = `Plan has been active for ${planAgeDays} days (${planAgeWeeks} weeks). Targets recalculated based on your current weight of ${currW} kg.`;
  }

  return {
    isDue,
    planAgeDays,
    planAgeWeeks,
    planCreatedAt,
    previousWeightKg,
    currentWeightKg,
    weightDeltaKg,
    currentCalories,
    currentProteinG,
    recommendedCalories: targetCalories,
    recommendedProteinG: targetProteinG,
    calorieDelta,
    proteinDelta,
    rationale,
  };
}
