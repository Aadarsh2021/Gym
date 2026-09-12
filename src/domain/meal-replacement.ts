import {
  FoodItem,
  MealReplacementCandidate,
  MealReplacementOptions,
} from '@/types/nutrition.types';

/**
 * Evaluates food catalog to find macro-equivalent replacement candidates
 * based on nutritional similarity, protein match, calorie tolerance, and dietary preference.
 */
export function findMealReplacements(
  targetFood: FoodItem,
  targetServings = 1.0,
  catalog: FoodItem[],
  options: MealReplacementOptions = {}
): MealReplacementCandidate[] {
  if (!targetFood || !catalog || catalog.length === 0) {
    return [];
  }

  const validTargetServings = Math.max(0.25, isNaN(targetServings) ? 1.0 : targetServings);
  const targetCalories = Math.round(targetFood.calories * validTargetServings);
  const targetProtein = Math.round(targetFood.proteinG * validTargetServings * 10) / 10;
  const tolerancePercent = options.calorieTolerancePercent ?? 35;
  const dietaryPref = options.dietaryPreference || 'all';

  // Filter compatible candidates
  const candidates = catalog.filter(f => {
    // Cannot replace with itself
    if (f.id === targetFood.id) return false;

    // Dietary filtering
    if (dietaryPref === 'vegan' && f.dietaryType !== 'vegan') return false;
    if (dietaryPref === 'veg' && f.dietaryType !== 'veg' && f.dietaryType !== 'vegan') return false;
    if (dietaryPref === 'egg' && f.dietaryType !== 'veg' && f.dietaryType !== 'vegan' && f.dietaryType !== 'egg') return false;

    return true;
  });

  const results: MealReplacementCandidate[] = [];

  for (const food of candidates) {
    // Calculate required serving to match the dominant macro (protein if protein-rich, else calories)
    let calculatedServing = 1.0;

    if (targetProtein >= 5 && food.proteinG >= 3) {
      // Primary protein source replacement: match target protein
      calculatedServing = targetProtein / food.proteinG;
    } else if (targetCalories > 0 && food.calories > 0) {
      // Carbohydrate / general fuel source replacement: match target calories
      calculatedServing = targetCalories / food.calories;
    }

    // Round to practical kitchen fraction (0.25 steps, e.g. 0.75, 1.0, 1.25, 1.5, max 3.5)
    const recommendedServings = Math.max(0.25, Math.min(3.5, Math.round(calculatedServing * 4) / 4));

    const calculatedCalories = Math.round(food.calories * recommendedServings);
    const calculatedProteinG = Math.round(food.proteinG * recommendedServings * 10) / 10;
    const calculatedCarbsG = Math.round(food.carbsG * recommendedServings * 10) / 10;
    const calculatedFatG = Math.round(food.fatG * recommendedServings * 10) / 10;

    const calorieDelta = Math.abs(calculatedCalories - targetCalories);
    const proteinDelta = Math.round(Math.abs(calculatedProteinG - targetProtein) * 10) / 10;

    const calErrorPct = targetCalories > 0 ? (calorieDelta / targetCalories) * 100 : 0;
    const proErrorPct = targetProtein > 0 ? (proteinDelta / targetProtein) * 100 : 0;

    // Discard candidates that deviate drastically from calorie tolerance (> 2x tolerance)
    if (calErrorPct > tolerancePercent * 2) {
      continue;
    }

    // Similarity Score: 55% weight on protein alignment, 45% weight on calorie alignment
    const proScore = Math.max(0, 1 - proErrorPct / 100) * 55;
    const calScore = Math.max(0, 1 - calErrorPct / 100) * 45;
    const similarityScore = Math.min(100, Math.round(proScore + calScore));

    // Determine macro match class
    let macroProfileMatch: 'high' | 'moderate' | 'alternative' = 'moderate';
    if (similarityScore >= 80) {
      macroProfileMatch = 'high';
    } else if (similarityScore < 60) {
      macroProfileMatch = 'alternative';
    }

    // Generate informative rationale
    let rationale = `Provides ${calculatedProteinG}g protein and ${calculatedCalories} kcal.`;
    if (targetFood.fatG > 10 && food.fatG < 5) {
      rationale = `Leaner swap: matches protein with ${Math.round(targetFood.fatG - calculatedFatG)}g less fat.`;
    } else if (food.fiberG && food.fiberG > 4 && (!targetFood.fiberG || targetFood.fiberG < 2)) {
      rationale = `High-fiber swap: adds ${food.fiberG}g gut-friendly dietary fiber.`;
    } else if (food.dietaryType === 'vegan' && targetFood.dietaryType !== 'vegan') {
      rationale = `100% plant-based macro equivalent.`;
    } else if (proteinDelta <= 1.5 && calorieDelta <= 30) {
      rationale = `Near-perfect macro substitute (within ${proteinDelta}g protein).`;
    }

    results.push({
      food,
      recommendedServings,
      servingDisplay: `${recommendedServings}x (${food.servingSize} ${food.servingUnit})`,
      calculatedCalories,
      calculatedProteinG,
      calculatedCarbsG,
      calculatedFatG,
      calorieDelta,
      proteinDelta,
      similarityScore,
      macroProfileMatch,
      rationale,
    });
  }

  // Sort by highest similarity score first
  return results.sort((a, b) => b.similarityScore - a.similarityScore);
}
