import {
  MixedMealItem,
  MixedMealContribution,
  MixedMealAnalysisResult,
} from '@/types/nutrition.types';

export interface DailyTargetsInput {
  calories: number;
  proteinG: number;
}

/**
 * Aggregates duplicate items if desired by food ID, combining servings safely
 */
export function aggregateDuplicateMealItems(items: MixedMealItem[]): MixedMealItem[] {
  const map = new Map<string, MixedMealItem>();

  for (const item of items) {
    if (!item.food || !item.food.id) continue;
    const existing = map.get(item.food.id);
    const validServings = Math.max(0, isNaN(item.servings) ? 0 : item.servings);

    if (existing) {
      existing.servings = Math.round((existing.servings + validServings) * 100) / 100;
    } else {
      map.set(item.food.id, {
        id: item.id || `item-${item.food.id}`,
        food: item.food,
        servings: validServings,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Calculates combined mixed-meal nutrition deterministically
 * Supports multi-item composition (e.g., 2 roti + dal + paneer + salad)
 */
export function calculateMixedMealTotals(
  items: MixedMealItem[],
  dailyTargets?: DailyTargetsInput
): MixedMealAnalysisResult {
  if (!items || items.length === 0) {
    return {
      totalCalories: 0,
      totalProteinG: 0,
      totalCarbsG: 0,
      totalFatG: 0,
      totalFiberG: 0,
      itemCount: 0,
      contributions: [],
      dailyCoverage: dailyTargets
        ? {
            calorieTarget: dailyTargets.calories,
            proteinTarget: dailyTargets.proteinG,
            percentOfDailyCalories: 0,
            percentOfDailyProtein: 0,
          }
        : undefined,
    };
  }

  // Pre-calculate individual item values
  const rawContributions = items.map(it => {
    const servings = Math.max(0, isNaN(it.servings) ? 0 : it.servings);
    const cal = Math.round((it.food.calories || 0) * servings);
    const pro = Math.round((it.food.proteinG || 0) * servings * 10) / 10;
    const carb = Math.round((it.food.carbsG || 0) * servings * 10) / 10;
    const fat = Math.round((it.food.fatG || 0) * servings * 10) / 10;
    const fiber = Math.round((it.food.fiberG || 0) * servings * 10) / 10;

    return {
      foodId: it.food.id,
      foodName: it.food.name,
      servings,
      servingDisplay: `${servings}x (${it.food.servingSize || '100'} ${it.food.servingUnit || 'g'})`,
      calories: cal,
      proteinG: pro,
      carbsG: carb,
      fatG: fat,
      fiberG: fiber,
    };
  });

  const totalCalories = rawContributions.reduce((acc, c) => acc + c.calories, 0);
  const totalProteinG = Math.round(rawContributions.reduce((acc, c) => acc + c.proteinG, 0) * 10) / 10;
  const totalCarbsG = Math.round(rawContributions.reduce((acc, c) => acc + c.carbsG, 0) * 10) / 10;
  const totalFatG = Math.round(rawContributions.reduce((acc, c) => acc + c.fatG, 0) * 10) / 10;
  const totalFiberG = Math.round(rawContributions.reduce((acc, c) => acc + c.fiberG, 0) * 10) / 10;

  const contributions: MixedMealContribution[] = rawContributions.map(c => ({
    ...c,
    percentOfMealCalories: totalCalories > 0 ? Math.round((c.calories / totalCalories) * 100) : 0,
    percentOfMealProtein: totalProteinG > 0 ? Math.round((c.proteinG / totalProteinG) * 100) : 0,
    percentOfMealCarbs: totalCarbsG > 0 ? Math.round((c.carbsG / totalCarbsG) * 100) : 0,
    percentOfMealFat: totalFatG > 0 ? Math.round((c.fatG / totalFatG) * 100) : 0,
  }));

  let dailyCoverage;
  if (dailyTargets && dailyTargets.calories > 0 && dailyTargets.proteinG > 0) {
    dailyCoverage = {
      calorieTarget: dailyTargets.calories,
      proteinTarget: dailyTargets.proteinG,
      percentOfDailyCalories: Math.round((totalCalories / dailyTargets.calories) * 100),
      percentOfDailyProtein: Math.round((totalProteinG / dailyTargets.proteinG) * 100),
    };
  }

  return {
    totalCalories,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    totalFiberG,
    itemCount: items.length,
    contributions,
    dailyCoverage,
  };
}
