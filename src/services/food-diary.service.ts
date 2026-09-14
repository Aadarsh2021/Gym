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
