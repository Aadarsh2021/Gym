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
  planType?: 'standard' | 'premium_generated' | 'budget_generated';
  createdAt?: string;
  estimatedWeeklyCostInr?: number;
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

// ==================================================
// FREE V1: BUDGET-BASED MEAL PLANNING TYPES
// ==================================================

export type BudgetPeriod = 'weekly' | 'monthly';

export interface BudgetPlannerConfig {
  budgetInr: number;
  period: BudgetPeriod;
  targetCalories: number;
  targetProteinG: number;
  dietaryPreference: string;
  mealSlotCount?: 3 | 4 | 5;
}

export interface BudgetFeasibilityResult {
  isFeasible: boolean;
  budgetInr: number;
  period: BudgetPeriod;
  estimatedCostInr: number;
  remainingInr: number;
  conflictExplanation?: string;
  recommendedBudgetInr?: number;
  costSavingTips?: string[];
}

// ==================================================
// FREE V1: ADAPTIVE MEAL PLAN REASSESSMENT TYPES
// ==================================================

export interface AdaptiveReviewCalculation {
  isDue: boolean;
  planAgeDays: number;
  planAgeWeeks: number;
  planCreatedAt: string;
  previousWeightKg: number | null;
  currentWeightKg: number | null;
  weightDeltaKg: number;
  currentCalories: number;
  currentProteinG: number;
  recommendedCalories: number;
  recommendedProteinG: number;
  calorieDelta: number;
  proteinDelta: number;
  rationale: string;
}

// ==================================================
// FREE V1: FULL NUTRITION & MICRONUTRIENT TYPES
// ==================================================

export interface NutrientValue<T = number> {
  value: T;
  unit: 'g' | 'mg' | 'µg' | 'kcal' | '%';
  source: string;
}

export interface FoodMicronutrientProfile {
  foodId: string;
  foodName: string;
  servingRef: string;
  // Vitamins (Optional - undefined if not assayed by ICMR-NIN IFCT)
  vitaminA_ug?: number;
  vitaminB1_mg?: number;
  vitaminB2_mg?: number;
  vitaminB9_folate_ug?: number;
  vitaminB12_ug?: number;
  vitaminC_mg?: number;
  vitaminD_ug?: number;
  // Minerals (Optional - undefined if not assayed)
  calcium_mg?: number;
  iron_mg?: number;
  magnesium_mg?: number;
  zinc_mg?: number;
  potassium_mg?: number;
  phosphorus_mg?: number;
  sodium_mg?: number;
  // Amino Acids & Quality (Optional - undefined if not assayed)
  leucine_g?: number;
  bcaa_total_g?: number;
  proteinQualityGrade?: 'Complete' | 'Complementary High-Quality' | 'Plant Incomplete';
  isCompleteProtein?: boolean;
}

// ==================================================
// PREMIUM V1: 7-DAY WEEKLY MEAL PLANNING TYPES
// ==================================================

export interface WeeklyMealPlanItem {
  id: string;
  foodId: string;
  foodName: string;
  mealType: MealSlot;
  servings: number;
  calculatedCalories: number;
  calculatedProteinG: number;
  calculatedCarbsG?: number;
  calculatedFatG?: number;
  food?: FoodItem;
}

export interface WeeklyMealPlanDay {
  id: string;
  dayOfWeek: number; // 1 = Monday, 7 = Sunday
  dayName: string;   // 'Monday', 'Tuesday', ...
  targetCalories: number;
  targetProteinG: number;
  items: WeeklyMealPlanItem[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
}

export interface WeeklyMealPlan {
  id: string;
  userId: string;
  name: string;
  targetCalories: number;
  targetProteinG: number;
  isActive: boolean;
  createdAt: string;
  days: WeeklyMealPlanDay[];
  averageDailyCalories: number;
  averageDailyProteinG: number;
}


