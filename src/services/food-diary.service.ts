import { FoodDiaryEntry, DailyMacroTotals } from '@/types/nutrition.types';
import { nutritionRepository } from '@/repositories/nutrition.repository';

export const foodDiaryService = {
  /**
   * Fetch all logged entries for a user on a specific date (YYYY-MM-DD)
   */
  async getDiaryEntries(userId: string, dateStr: string): Promise<FoodDiaryEntry[]> {
    return nutritionRepository.fetchFoodDiaryEntries(userId, dateStr);
  },

  /**
   * Log a new food diary entry
   */
  async logFoodEntry(
    entry: Omit<FoodDiaryEntry, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; entry?: FoodDiaryEntry; error?: string }> {
    return nutritionRepository.insertFoodDiaryEntry(entry);
  },

  /**
   * Delete a food entry
   */
  async deleteFoodEntry(userId: string, entryId: string, loggedDate?: string): Promise<{ success: boolean; error?: string }> {
    const targetDate = loggedDate || new Date().toISOString().split('T')[0];
    return nutritionRepository.deleteFoodDiaryEntry(userId, entryId, targetDate);
  },

  /**
   * Update an existing food diary entry with authoritative macro recalculation
   * Client submits ONLY newServings and entry identity.
   */
  async updateFoodEntry(
    userId: string,
    entryId: string,
    newServings: number,
    currentEntry: FoodDiaryEntry
  ): Promise<{ success: boolean; entry?: FoodDiaryEntry; error?: string }> {
    // 1. Validation: 0.1 <= servings <= 20
    if (
      typeof newServings !== 'number' ||
      !Number.isFinite(newServings) ||
      Number.isNaN(newServings) ||
      newServings < 0.1 ||
      newServings > 20
    ) {
      return {
        success: false,
        error: 'Serving quantity must be a valid number between 0.1 and 20.',
      };
    }

    // 2. Authoritative Macro Recalculation:
    // Determine 1-serving base macros.
    let baseCalories = currentEntry.calories / (currentEntry.servings || 1);
    let baseProtein = currentEntry.proteinG / (currentEntry.servings || 1);
    let baseCarbs = currentEntry.carbsG / (currentEntry.servings || 1);
    let baseFat = currentEntry.fatG / (currentEntry.servings || 1);

    if (currentEntry.foodId) {
      const foods = await nutritionRepository.fetchFoods();
      const canonicalFood = foods.find(f => f.id === currentEntry.foodId);
      if (canonicalFood) {
        baseCalories = canonicalFood.calories;
        baseProtein = canonicalFood.proteinG;
        baseCarbs = canonicalFood.carbsG;
        baseFat = canonicalFood.fatG;
      }
    }

    const calculatedCalories = Math.round(baseCalories * newServings);
    const calculatedProteinG = Math.round(baseProtein * newServings * 10) / 10;
    const calculatedCarbsG = Math.round(baseCarbs * newServings * 10) / 10;
    const calculatedFatG = Math.round(baseFat * newServings * 10) / 10;

    return nutritionRepository.updateFoodDiaryEntry(userId, entryId, currentEntry.loggedDate, {
      servings: newServings,
      calories: calculatedCalories,
      proteinG: calculatedProteinG,
      carbsG: calculatedCarbsG,
      fatG: calculatedFatG,
    });
  },

  /**
   * Computes aggregate macronutrient totals for a given date
   */
  async getDailyMacroTotals(userId: string, dateStr: string): Promise<DailyMacroTotals> {
    const entries = await this.getDiaryEntries(userId, dateStr);

    const totals = entries.reduce(
      (acc, curr) => ({
        totalCalories: acc.totalCalories + curr.calories,
        totalProteinG: acc.totalProteinG + curr.proteinG,
        totalCarbsG: acc.totalCarbsG + curr.carbsG,
        totalFatG: acc.totalFatG + curr.fatG,
        entriesCount: acc.entriesCount + 1,
      }),
      {
        totalCalories: 0,
        totalProteinG: 0,
        totalCarbsG: 0,
        totalFatG: 0,
        entriesCount: 0,
      }
    );

    return {
      date: dateStr,
      totalCalories: Math.round(totals.totalCalories),
      totalProteinG: Math.round(totals.totalProteinG * 10) / 10,
      totalCarbsG: Math.round(totals.totalCarbsG * 10) / 10,
      totalFatG: Math.round(totals.totalFatG * 10) / 10,
      entriesCount: totals.entriesCount,
    };
  },
};
