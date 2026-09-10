/**
 * Pure Deterministic Calorie & Energy Expenditure Calculations
 * Formulas: Mifflin-St Jeor Equation for BMR with activity multiplier for TDEE.
 */

export interface BMRInputs {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: 'male' | 'female' | 'other';
}

/**
 * Calculates Basal Metabolic Rate (BMR) using Mifflin-St Jeor formula.
 * Men: BMR = (10 * weight in kg) + (6.25 * height in cm) - (5 * age) + 5
 * Women: BMR = (10 * weight in kg) + (6.25 * height in cm) - (5 * age) - 161
 */
export function calculateBMR(inputs: BMRInputs): number {
  const { weightKg, heightCm, age, gender } = inputs;

  if (weightKg <= 0 || heightCm <= 0 || age <= 0) {
    return 0;
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'female') {
    return Math.round(base - 161);
  }
  // Default to male / gender-neutral offset (+5)
  return Math.round(base + 5);
}

/**
 * Activity multiplier based on training frequency per week
 */
export function getActivityMultiplier(daysPerWeek: number): number {
  if (daysPerWeek <= 0) return 1.2;      // Sedentary
  if (daysPerWeek <= 2) return 1.375;    // Light (1-2 days)
  if (daysPerWeek <= 4) return 1.55;     // Moderate (3-4 days)
  if (daysPerWeek <= 6) return 1.725;    // Very active (5-6 days)
  return 1.9;                            // Extremely active (7 days)
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE)
 */
export function calculateTDEE(bmr: number, daysPerWeek: number): number {
  if (bmr <= 0) return 0;
  const multiplier = getActivityMultiplier(daysPerWeek);
  return Math.round(bmr * multiplier);
}

export type CalorieGoal = 'fat_loss' | 'muscle_gain' | 'maintenance' | 'strength' | 'endurance';

/**
 * Calculates target daily calories based on fitness goal:
 * - Fat loss: ~20% deficit (capped between 300 - 500 kcal deficit)
 * - Muscle gain: ~10-15% surplus (approx +250 - 400 kcal)
 * - Maintenance / Strength / Endurance: TDEE
 */
export function calculateCalorieTarget(tdee: number, goal: CalorieGoal): number {
  if (tdee <= 0) return 0;

  switch (goal) {
    case 'fat_loss': {
      const deficit = Math.min(500, Math.max(300, Math.round(tdee * 0.2)));
      return Math.max(1200, tdee - deficit); // Ensure safe floor
    }
    case 'muscle_gain': {
      const surplus = Math.min(450, Math.max(250, Math.round(tdee * 0.12)));
      return tdee + surplus;
    }
    case 'strength':
    case 'endurance':
    case 'maintenance':
    default:
      return tdee;
  }
}
