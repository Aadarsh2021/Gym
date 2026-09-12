export type FoodDietaryType = 'veg' | 'non_veg' | 'egg' | 'vegan';
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface FoodItem {
  id: string;
  name: string;
  servingSize: string;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  dietaryType: FoodDietaryType;
  source: string;
  sourceReference?: string | null;
  isVerified: boolean;
}

export interface NutritionProfile {
  id: string;
  userId: string;
  bmrCalories: number;
  tdeeCalories: number;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  calculationVersion: string;
}

export interface MealPlanItem {
  id?: string;
  mealType: MealSlot;
  foodId: string;
  foodName: string;
  servings: number;
  servingSize: string;
  calculatedCalories: number;
  calculatedProteinG: number;
  calculatedCarbsG?: number;
  calculatedFatG?: number;
  calculatedFiberG?: number;
}

export interface MealPlan {
  id: string;
  userId: string;
  name: string;
  targetCalories: number;
  targetProteinG: number;
  isActive: boolean;
  items: MealPlanItem[];
  planType?: 'standard' | 'premium_generated';
}

export interface FoodDiaryEntry {
  id: string;
  userId: string;
  loggedDate: string; // YYYY-MM-DD
  mealType: MealSlot;
  foodId?: string | null;
  customFoodName?: string | null;
  foodName: string;
  servings: number;
  servingSize?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  createdAt?: string;
}

export interface DailyMacroTotals {
  date: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG?: number;
  entriesCount: number;
}

// ==================================================
// PREMIUM V1: MIXED MEAL ANALYSIS TYPES
// ==================================================

export interface MixedMealItem {
  id: string;
  food: FoodItem;
  servings: number;
}

export interface MixedMealContribution {
  foodId: string;
  foodName: string;
  servings: number;
  servingDisplay: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  percentOfMealCalories: number;
  percentOfMealProtein: number;
  percentOfMealCarbs: number;
  percentOfMealFat: number;
}

export interface MixedMealAnalysisResult {
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  itemCount: number;
  contributions: MixedMealContribution[];
  dailyCoverage?: {
    calorieTarget: number;
    proteinTarget: number;
    percentOfDailyCalories: number;
    percentOfDailyProtein: number;
  };
}

// ==================================================
// PREMIUM V1: MEAL REPLACEMENT TYPES
// ==================================================

export interface MealReplacementCandidate {
  food: FoodItem;
  recommendedServings: number;
  servingDisplay: string;
  calculatedCalories: number;
  calculatedProteinG: number;
  calculatedCarbsG: number;
  calculatedFatG: number;
  calorieDelta: number;
  proteinDelta: number;
  similarityScore: number; // 0 to 100%
  macroProfileMatch: 'high' | 'moderate' | 'alternative';
  rationale: string;
}

export interface MealReplacementOptions {
  dietaryPreference?: string;
  calorieTolerancePercent?: number; // e.g. 20 for ±20%
  prioritizeProtein?: boolean;
}

// ==================================================
// PREMIUM V1: MEAL GENERATOR CONFIG
// ==================================================

export type MealGeneratorFocusGoal = 'hypertrophy' | 'cutting' | 'budget_staples' | 'balanced';

export interface PremiumMealGeneratorConfig {
  targetCalories: number;
  targetProteinG: number;
  dietaryPreference: string;
  mealSlotCount: 3 | 4 | 5; // 3 = Breakfast/Lunch/Dinner, 4 = +Snack, 5 = +Pre/Post fuel
  focusGoal: MealGeneratorFocusGoal;
}

