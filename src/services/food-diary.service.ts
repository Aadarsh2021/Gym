import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { FoodDiaryEntry, DailyMacroTotals, MealSlot } from '@/types/nutrition.types';

export const foodDiaryService = {
  /**
   * Fetch all logged entries for a user on a specific date (YYYY-MM-DD)
   */
  async getDiaryEntries(userId: string, dateStr: string): Promise<FoodDiaryEntry[]> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`food_diary_${userId}_${dateStr}`);
      return stored ? JSON.parse(stored) : [];
    }

    try {
      const { data, error } = await supabase
        .from('food_diary_entries')
        .select(`
          id,
          user_id,
          logged_date,
          meal_type,
          food_id,
          custom_food_name,
          servings,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          created_at,
          foods (
            name,
            serving_size,
            serving_unit
          )
        `)
        .eq('user_id', userId)
        .eq('logged_date', dateStr)
        .order('created_at', { ascending: true });

      if (error || !data) {
        const stored = localStorage.getItem(`food_diary_${userId}_${dateStr}`);
        return stored ? JSON.parse(stored) : [];
      }

      return data.map((row: any) => {
        const resolvedName = row.custom_food_name || row.foods?.name || 'Food Item';
        const resolvedServing = row.foods ? `${row.foods.serving_size} ${row.foods.serving_unit}` : `${row.servings} serving`;

        return {
          id: row.id,
          userId: row.user_id,
          loggedDate: row.logged_date,
          mealType: row.meal_type as MealSlot,
          foodId: row.food_id,
          customFoodName: row.custom_food_name,
          foodName: resolvedName,
          servings: parseFloat(row.servings),
          servingSize: resolvedServing,
          calories: parseFloat(row.calories),
          proteinG: parseFloat(row.protein_g),
          carbsG: parseFloat(row.carbs_g || 0),
          fatG: parseFloat(row.fat_g || 0),
          createdAt: row.created_at,
        };
      });
    } catch {
      const stored = localStorage.getItem(`food_diary_${userId}_${dateStr}`);
      return stored ? JSON.parse(stored) : [];
    }
  },

  /**
   * Log a new food diary entry
   */
  async logFoodEntry(
    entry: Omit<FoodDiaryEntry, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; entry?: FoodDiaryEntry; error?: string }> {
    if (!isSupabaseConfigured) {
      const newId = 'entry-' + Math.random().toString(36).substring(2, 9);
      const newEntry: FoodDiaryEntry = {
        ...entry,
        id: newId,
        createdAt: new Date().toISOString(),
      };
      const existing = await this.getDiaryEntries(entry.userId, entry.loggedDate);
      existing.push(newEntry);
      localStorage.setItem(`food_diary_${entry.userId}_${entry.loggedDate}`, JSON.stringify(existing));
      return { success: true, entry: newEntry };
    }

    try {
      const { data, error } = await supabase
        .from('food_diary_entries')
        .insert({
          user_id: entry.userId,
          logged_date: entry.loggedDate,
          meal_type: entry.mealType,
          food_id: entry.foodId || null,
          custom_food_name: entry.customFoodName || entry.foodName || 'Custom Food',
          servings: entry.servings,
          calories: entry.calories,
          protein_g: entry.proteinG,
          carbs_g: entry.carbsG || 0,
          fat_g: entry.fatG || 0,
        })
        .select()
        .single();

      if (error || !data) {
        // Fallback to local storage
        const newId = 'entry-' + Math.random().toString(36).substring(2, 9);
        const newEntry: FoodDiaryEntry = {
          ...entry,
          id: newId,
          createdAt: new Date().toISOString(),
        };
        const existing = await this.getDiaryEntries(entry.userId, entry.loggedDate);
        existing.push(newEntry);
        localStorage.setItem(`food_diary_${entry.userId}_${entry.loggedDate}`, JSON.stringify(existing));
        return { success: true, entry: newEntry };
      }

      const created: FoodDiaryEntry = {
        id: data.id,
        userId: data.user_id,
        loggedDate: data.logged_date,
        mealType: data.meal_type as MealSlot,
        foodId: data.food_id,
        customFoodName: data.custom_food_name,
        foodName: data.custom_food_name || entry.foodName,
        servings: parseFloat(data.servings),
        calories: parseFloat(data.calories),
        proteinG: parseFloat(data.protein_g),
        carbsG: parseFloat(data.carbs_g),
        fatG: parseFloat(data.fat_g),
        createdAt: data.created_at,
      };

      return { success: true, entry: created };
    } catch {
      // Offline fallback
      const newId = 'entry-' + Math.random().toString(36).substring(2, 9);
      const newEntry: FoodDiaryEntry = {
        ...entry,
        id: newId,
        createdAt: new Date().toISOString(),
      };
      const existing = await this.getDiaryEntries(entry.userId, entry.loggedDate);
      existing.push(newEntry);
      localStorage.setItem(`food_diary_${entry.userId}_${entry.loggedDate}`, JSON.stringify(existing));
      return { success: true, entry: newEntry };
    }
  },

  /**
   * Delete a food entry
   */
  async deleteFoodEntry(userId: string, entryId: string, loggedDate?: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      if (loggedDate) {
        const existing = await this.getDiaryEntries(userId, loggedDate);
        const filtered = existing.filter(e => e.id !== entryId);
        localStorage.setItem(`food_diary_${userId}_${loggedDate}`, JSON.stringify(filtered));
      }
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('food_diary_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId);

      if (error && loggedDate) {
        const existing = await this.getDiaryEntries(userId, loggedDate);
        const filtered = existing.filter(e => e.id !== entryId);
        localStorage.setItem(`food_diary_${userId}_${loggedDate}`, JSON.stringify(filtered));
      }
      return { success: true };
    } catch {
      if (loggedDate) {
        const existing = await this.getDiaryEntries(userId, loggedDate);
        const filtered = existing.filter(e => e.id !== entryId);
        localStorage.setItem(`food_diary_${userId}_${loggedDate}`, JSON.stringify(filtered));
      }
      return { success: true };
    }
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
