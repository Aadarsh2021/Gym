import { describe, it, expect, beforeEach } from 'vitest';
import { calculateMixedMealTotals, aggregateDuplicateMealItems } from '@/domain/mixed-meal-analyzer';
import { findMealReplacements } from '@/domain/meal-replacement';
import { nutritionService, FALLBACK_FOODS } from '@/services/nutrition.service';
import { FoodItem, MixedMealItem, PremiumMealGeneratorConfig } from '@/types/nutrition.types';

// In-memory localStorage mock for node test environment
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => {
    storage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    Object.keys(storage).forEach(k => delete storage[k]);
  },
};
(globalThis as any).localStorage = mockLocalStorage;

describe('Premium V1 Nutrition Suite: Mixed Meal Analysis & Meal Replacement', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const roti: FoodItem = FALLBACK_FOODS.find(f => f.name.includes('Roti'))!;
  const dal: FoodItem = FALLBACK_FOODS.find(f => f.name.includes('Cooked Dal'))!;
  const paneer: FoodItem = FALLBACK_FOODS.find(f => f.name === 'Paneer (Cottage Cheese)')!;
  const salad: FoodItem = FALLBACK_FOODS.find(f => f.name.includes('Green Salad'))!;

  // =========================================================================
  // 1. MIXED MEAL ANALYSIS TESTS
  // =========================================================================
  describe('Mixed Meal Analysis Engine', () => {
    it('analyzes standard multi-item Indian plate: 2 roti + dal + paneer + salad', () => {
      const items: MixedMealItem[] = [
        { id: '1', food: roti, servings: 2 }, // 2 * 85 = 170 kcal, 2 * 3.1 = 6.2g P, 35g C, 1g F, 5.6g fiber
        { id: '2', food: dal, servings: 1 },  // 140 kcal, 7.5g P, 18g C, 4.5g F, 3.5g fiber
        { id: '3', food: paneer, servings: 1 }, // 265 kcal, 18.3g P, 3.4g C, 20.8g F, 0g fiber
        { id: '4', food: salad, servings: 1 },  // 25 kcal, 1.0g P, 4.5g C, 0.2g F, 2.1g fiber
      ];

      const dailyTargets = { calories: 2000, proteinG: 140 };
      const result = calculateMixedMealTotals(items, dailyTargets);

      // Total Calories: 170 + 140 + 265 + 25 = 600 kcal
      expect(result.totalCalories).toBe(600);

      // Total Protein: 6.2 + 7.5 + 18.3 + 1.0 = 33.0g P
      expect(result.totalProteinG).toBe(33.0);

      // Total Carbs: 35.0 + 18.0 + 3.4 + 4.5 = 60.9g C
      expect(result.totalCarbsG).toBe(60.9);

      // Total Fat: 1.0 + 4.5 + 20.8 + 0.2 = 26.5g F
      expect(result.totalFatG).toBe(26.5);

      // Total Fiber: 5.6 + 3.5 + 0 + 2.1 = 11.2g
      expect(result.totalFiberG).toBe(11.2);

      expect(result.itemCount).toBe(4);
      expect(result.contributions.length).toBe(4);

      // Verify per-food percentage contributions
      const paneerContribution = result.contributions.find(c => c.foodName.includes('Paneer'))!;
      expect(paneerContribution.percentOfMealProtein).toBe(Math.round((18.3 / 33.0) * 100)); // ~55% of protein
      expect(paneerContribution.percentOfMealCalories).toBe(Math.round((265 / 600) * 100)); // ~44% of calories

      // Verify daily coverage calculations
      expect(result.dailyCoverage?.percentOfDailyCalories).toBe(Math.round((600 / 2000) * 100)); // 30%
      expect(result.dailyCoverage?.percentOfDailyProtein).toBe(Math.round((33.0 / 140) * 100)); // 24%
    });

    it('handles empty meal cleanly without NaN or division by zero', () => {
      const result = calculateMixedMealTotals([]);
      expect(result.totalCalories).toBe(0);
      expect(result.totalProteinG).toBe(0);
      expect(result.totalCarbsG).toBe(0);
      expect(result.totalFatG).toBe(0);
      expect(result.totalFiberG).toBe(0);
      expect(result.itemCount).toBe(0);
      expect(result.contributions).toEqual([]);
    });

    it('safely handles zero, negative, or NaN servings', () => {
      const items: MixedMealItem[] = [
        { id: '1', food: roti, servings: 0 },
        { id: '2', food: dal, servings: -2 },
        { id: '3', food: paneer, servings: NaN },
      ];

      const result = calculateMixedMealTotals(items);
      expect(result.totalCalories).toBe(0);
      expect(result.totalProteinG).toBe(0);
      expect(result.contributions.every(c => c.calories === 0)).toBe(true);
    });

    it('aggregates duplicate food items correctly', () => {
      const items: MixedMealItem[] = [
        { id: '1', food: roti, servings: 1.5 },
        { id: '2', food: dal, servings: 1.0 },
        { id: '3', food: roti, servings: 1.5 }, // Duplicate roti
      ];

      const aggregated = aggregateDuplicateMealItems(items);
      expect(aggregated.length).toBe(2);

      const rotiAgg = aggregated.find(i => i.food.id === roti.id)!;
      expect(rotiAgg.servings).toBe(3.0);
    });

    it('handles foods with missing/undefined fiber gracefully', () => {
      const foodWithoutFiber: FoodItem = {
        id: 'no-fib',
        name: 'Sugar Syrup',
        servingSize: '10',
        servingUnit: 'ml',
        calories: 50,
        proteinG: 0,
        carbsG: 13,
        fatG: 0,
        dietaryType: 'vegan',
        source: 'Custom',
        isVerified: false,
      };

      const result = calculateMixedMealTotals([{ id: '1', food: foodWithoutFiber, servings: 2 }]);
      expect(result.totalCalories).toBe(100);
      expect(result.totalFiberG).toBe(0);
    });
  });

  // =========================================================================
  // 2. MEAL REPLACEMENT ENGINE TESTS
  // =========================================================================
  describe('Meal Replacement Engine', () => {
    it('finds high-similarity protein replacements for standard Paneer', () => {
      // Target: 1 serving Paneer (265 kcal, 18.3g P)
      const replacements = findMealReplacements(paneer, 1.0, FALLBACK_FOODS, {
        dietaryPreference: 'veg',
      });

      expect(replacements.length).toBeGreaterThan(0);
      // Ensure target food is excluded
      expect(replacements.every(r => r.food.id !== paneer.id)).toBe(true);

      // Low-Fat Paneer should be top ranked due to high protein and lean profile
      const topSwap = replacements[0];
      expect(topSwap.similarityScore).toBeGreaterThan(60);
      expect(topSwap.recommendedServings).toBeGreaterThan(0);
      expect(topSwap.calculatedProteinG).toBeCloseTo(18.3, 0); // Within ~1g protein
    });

    it('respects dietary preferences (vegan filter excludes eggs and dairy)', () => {
      const chicken = FALLBACK_FOODS.find(f => f.name.includes('Chicken'))!;
      const replacements = findMealReplacements(chicken, 1.0, FALLBACK_FOODS, {
        dietaryPreference: 'vegan',
      });

      expect(replacements.length).toBeGreaterThan(0);
      expect(replacements.every(r => r.food.dietaryType === 'vegan')).toBe(true);

      // Soya chunks or Moong Dal should be available
      const soyaSwap = replacements.find(r => r.food.name.includes('Soya'));
      expect(soyaSwap).toBeDefined();
    });

    it('returns empty array when catalog is empty or invalid', () => {
      expect(findMealReplacements(paneer, 1.0, [])).toEqual([]);
    });

    it('produces deterministic similarity scores and recommended kitchen servings', () => {
      const replacements1 = findMealReplacements(paneer, 1.0, FALLBACK_FOODS);
      const replacements2 = findMealReplacements(paneer, 1.0, FALLBACK_FOODS);

      expect(replacements1[0].similarityScore).toBe(replacements2[0].similarityScore);
      expect(replacements1[0].recommendedServings).toBe(replacements2[0].recommendedServings);
      expect(replacements1[0].food.name).toBe(replacements2[0].food.name);
    });
  });

  // =========================================================================
  // 3. PREMIUM MEAL GENERATOR TESTS
  // =========================================================================
  describe('Premium Meal Generator (V1)', () => {
    it('generates a tailored 3-meal plan with exact slot distributions', async () => {
      const config: PremiumMealGeneratorConfig = {
        targetCalories: 2200,
        targetProteinG: 150,
        dietaryPreference: 'vegetarian',
        mealSlotCount: 3,
        focusGoal: 'hypertrophy',
      };

      const plan = await nutritionService.generatePremiumMealPlan('athlete-test-1', config);
      expect(plan).not.toBeNull();
      expect(plan?.planType).toBe('premium_generated');
      expect(plan?.name).toContain('3 Meals');

      const mealTypes = new Set(plan?.items.map(i => i.mealType));
      expect(mealTypes.has('breakfast')).toBe(true);
      expect(mealTypes.has('lunch')).toBe(true);
      expect(mealTypes.has('dinner')).toBe(true);
      expect(mealTypes.has('snack')).toBe(false); // 3 meals has no snack slot
    });

    it('generates a 5-meal plan with pre/post snack slots for athletic fuel', async () => {
      const config: PremiumMealGeneratorConfig = {
        targetCalories: 2600,
        targetProteinG: 180,
        dietaryPreference: 'non_veg',
        mealSlotCount: 5,
        focusGoal: 'hypertrophy',
      };

      const plan = await nutritionService.generatePremiumMealPlan('athlete-test-2', config);
      expect(plan).not.toBeNull();
      const snackItems = plan?.items.filter(i => i.mealType === 'snack');
      expect(snackItems?.length).toBeGreaterThanOrEqual(2);
    });

    it('swaps a plan item cleanly with swapPlanItem', async () => {
      const config: PremiumMealGeneratorConfig = {
        targetCalories: 2000,
        targetProteinG: 140,
        dietaryPreference: 'vegetarian',
        mealSlotCount: 4,
        focusGoal: 'balanced',
      };

      const initialPlan = await nutritionService.generatePremiumMealPlan('athlete-test-3', config);
      expect(initialPlan).not.toBeNull();

      const itemToSwap = initialPlan!.items[0];
      const replacementFood = FALLBACK_FOODS.find(f => f.id !== itemToSwap.foodId)!;

      const updatedPlan = await nutritionService.swapPlanItem(
        'athlete-test-3',
        initialPlan!,
        itemToSwap.foodId,
        {
          food: replacementFood,
          recommendedServings: 1.5,
        }
      );

      expect(updatedPlan).not.toBeNull();
      const swapped = updatedPlan!.items.find(i => i.foodId === replacementFood.id);
      expect(swapped).toBeDefined();
      expect(swapped?.servings).toBe(1.5);
    });
  });
});
