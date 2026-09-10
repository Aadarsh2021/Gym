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
}

export interface MealPlan {
  id: string;
  userId: string;
  name: string;
  targetCalories: number;
  targetProteinG: number;
  isActive: boolean;
  items: MealPlanItem[];
}
