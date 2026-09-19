import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  FoodItem,
  NutritionProfile,
  MealPlan,
  FoodDiaryEntry,
  MealSlot,
  WeeklyMealPlan,
  WeeklyMealPlanDay,
  WeeklyMealPlanItem,
} from '@/types/nutrition.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const FALLBACK_FOODS: FoodItem[] = [
  { id: 'f-1', name: 'Paneer (Cottage Cheese)', servingSize: '100', servingUnit: 'g', calories: 265, proteinG: 18.3, carbsG: 3.4, fatG: 20.8, fiberG: 0, dietaryType: 'veg', source: 'ICMR-NIN Indian Food Composition Tables (IFCT)', sourceReference: 'Dairy D004', isVerified: true },
  { id: 'f-2', name: 'Low-Fat Paneer', servingSize: '100', servingUnit: 'g', calories: 160, proteinG: 24.0, carbsG: 4.0, fatG: 5.0, fiberG: 0, dietaryType: 'veg', source: 'ICMR-NIN IFCT', sourceReference: 'Dairy D005', isVerified: true },
  { id: 'f-3', name: 'Soya Chunks (Raw / Uncooked)', servingSize: '100', servingUnit: 'g', calories: 345, proteinG: 52.0, carbsG: 33.0, fatG: 0.5, fiberG: 13.0, dietaryType: 'vegan', source: 'ICMR-NIN IFCT', sourceReference: 'Legumes L042', isVerified: true },
  { id: 'f-4', name: 'Boiled Whole Egg', servingSize: '1', servingUnit: 'piece (50g)', calories: 74, proteinG: 6.3, carbsG: 0.4, fatG: 5.0, fiberG: 0, dietaryType: 'egg', source: 'ICMR-NIN IFCT', sourceReference: 'Poultry P001', isVerified: true },
  { id: 'f-5', name: 'Chicken Breast (Skinless, Raw)', servingSize: '100', servingUnit: 'g', calories: 120, proteinG: 22.5, carbsG: 0.0, fatG: 2.6, fiberG: 0, dietaryType: 'non_veg', source: 'ICMR-NIN IFCT', sourceReference: 'Poultry P012', isVerified: true },
  { id: 'f-6', name: 'Moong Dal (Raw)', servingSize: '100', servingUnit: 'g', calories: 348, proteinG: 24.0, carbsG: 60.0, fatG: 1.2, fiberG: 16.0, dietaryType: 'veg', source: 'ICMR-NIN IFCT', sourceReference: 'Pulses P020', isVerified: true },
  { id: 'f-7', name: 'Cooked Dal (Standard Tadka)', servingSize: '1', servingUnit: 'katori (150g)', calories: 140, proteinG: 7.5, carbsG: 18.0, fatG: 4.5, fiberG: 3.5, dietaryType: 'veg', source: 'ICMR-NIN Cooked Composite Reference', sourceReference: 'Standard', isVerified: true },
  { id: 'f-8', name: 'Roti / Chapati (Whole Wheat, No Oil)', servingSize: '1', servingUnit: 'medium (35g)', calories: 85, proteinG: 3.1, carbsG: 17.5, fatG: 0.5, fiberG: 2.8, dietaryType: 'veg', source: 'ICMR-NIN IFCT', sourceReference: 'Cereal C002', isVerified: true },
  { id: 'f-9', name: 'Curd / Dahi (Plain Whole Milk)', servingSize: '100', servingUnit: 'g', calories: 98, proteinG: 4.3, carbsG: 5.0, fatG: 6.5, fiberG: 0, dietaryType: 'veg', source: 'ICMR-NIN IFCT', sourceReference: 'Dairy D002', isVerified: true },
  { id: 'f-10', name: 'Rolled Oats (Raw)', servingSize: '50', servingUnit: 'g', calories: 190, proteinG: 6.8, carbsG: 33.0, fatG: 3.5, fiberG: 5.0, dietaryType: 'vegan', source: 'ICMR-NIN IFCT', sourceReference: 'Cereals C030', isVerified: true },
  { id: 'f-11', name: 'Whey Protein Concentrate (80%)', servingSize: '30', servingUnit: 'g (1 scoop)', calories: 120, proteinG: 24.0, carbsG: 2.0, fatG: 1.5, fiberG: 0.5, dietaryType: 'veg', source: 'Standard Nutritional Analysis Certificate', sourceReference: 'Supplements', isVerified: true },
  { id: 'f-12', name: 'Green Salad (Cucumber, Tomato, Onion)', servingSize: '1', servingUnit: 'plate (100g)', calories: 25, proteinG: 1.0, carbsG: 4.5, fatG: 0.2, fiberG: 2.1, dietaryType: 'vegan', source: 'ICMR-NIN IFCT', sourceReference: 'Vegetables V015', isVerified: true },
  { id: 'f-13', name: 'Cooked White Rice', servingSize: '1', servingUnit: 'katori (150g)', calories: 195, proteinG: 4.1, carbsG: 43.5, fatG: 0.4, fiberG: 0.6, dietaryType: 'vegan', source: 'ICMR-NIN IFCT', sourceReference: 'Cereals C008', isVerified: true },
  { id: 'f-14', name: 'Sattu (Roasted Chana Flour)', servingSize: '50', servingUnit: 'g', calories: 190, proteinG: 12.8, carbsG: 30.0, fatG: 2.6, fiberG: 8.5, dietaryType: 'vegan', source: 'ICMR-NIN IFCT', sourceReference: 'Pulses P005', isVerified: true },
];

export class NutritionRepository {
  // ── 1. Food Catalog ────────────────────────────────────────────────────────
  async fetchFoods(search = '', dietaryType = 'all'): Promise<FoodItem[]> {
    if (!isSupabaseConfigured) {
      return FALLBACK_FOODS.filter(f => {
        const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
        const matchesType = dietaryType === 'all' || f.dietaryType === dietaryType;
        return matchesSearch && matchesType;
      });
    }

    try {
      let query = supabase.from('foods').select('*').eq('is_verified', true);
      if (search) query = query.ilike('name', `%${search}%`);
      if (dietaryType !== 'all') query = query.eq('dietary_type', dietaryType);

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map(d => ({
        id: d.id,
        name: d.name,
        servingSize: d.serving_size,
        servingUnit: d.serving_unit,
        calories: Number(d.calories),
        proteinG: Number(d.protein_g),
        carbsG: Number(d.carbs_g),
        fatG: Number(d.fat_g),
        dietaryType: d.dietary_type,
        source: d.source,
        sourceReference: d.source_reference,
        isVerified: d.is_verified,
      }));
    } catch {
      return [];
    }
  }

  // ── 2. Nutrition Profiles ──────────────────────────────────────────────────
  async fetchNutritionProfile(userId: string): Promise<NutritionProfile | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`nutrition_profile_${userId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('nutrition_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        bmrCalories: data.bmr_calories,
        tdeeCalories: data.tdee_calories,
        targetCalories: data.target_calories,
        targetProteinG: data.target_protein_g,
        targetCarbsG: data.target_carbs_g,
        targetFatG: data.target_fat_g,
        calculationVersion: data.calculation_version,
      };
    } catch {
      return null;
    }
  }

  async upsertNutritionProfile(profile: Omit<NutritionProfile, 'id'>): Promise<boolean> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(profile.userId)) {
      platform.storage.setItem(
        `nutrition_profile_${profile.userId}`,
        JSON.stringify({ ...profile, id: 'np-1' })
      );
      return true;
    }

    try {
      const { error } = await supabase.from('nutrition_profiles').upsert({
        user_id: profile.userId,
        bmr_calories: profile.bmrCalories,
        tdee_calories: profile.tdeeCalories,
        target_calories: profile.targetCalories,
        target_protein_g: profile.targetProteinG,
        target_carbs_g: profile.targetCarbsG,
        target_fat_g: profile.targetFatG,
        calculation_version: profile.calculationVersion,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) {
        logger.error('NutritionRepository: Error saving nutrition profile', { error });
        return false;
      }

      platform.storage.setItem(
        `nutrition_profile_${profile.userId}`,
        JSON.stringify({ ...profile, id: 'np-1' })
      );
      return true;
    } catch (err) {
      logger.error('NutritionRepository: Exception saving nutrition profile', { err });
      return false;
    }
  }

  // ── 3. Meal Plans ──────────────────────────────────────────────────────────
  async fetchActiveMealPlan(userId: string): Promise<MealPlan | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`meal_plan_${userId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data: plan, error } = await supabase
        .from('meal_plans')
        .select('*, meal_plan_items(*, foods(name, serving_size, serving_unit))')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !plan) {
        const stored = platform.storage.getItem(`meal_plan_${userId}`);
        if (stored && typeof stored === 'string') {
          try { return JSON.parse(stored); } catch { /* ignore */ }
        }
        return null;
      }

      const stored = platform.storage.getItem(`meal_plan_${userId}`);
      const cached = stored && typeof stored === 'string' ? JSON.parse(stored) : null;

      return {
        id: plan.id,
        userId: plan.user_id,
        name: plan.name,
        targetCalories: plan.target_calories,
        targetProteinG: plan.target_protein_g,
        isActive: plan.is_active,
        createdAt: plan.created_at || (cached?.createdAt),
        planType:
          plan.plan_kind === 'budget'
            ? 'budget_generated'
            : plan.plan_kind === 'replacement_derived'
            ? 'replacement_derived'
            : cached?.planType || 'standard',
        estimatedWeeklyCostInr: cached?.estimatedWeeklyCostInr,
        items: (plan.meal_plan_items || []).map((item: any) => ({
          id: item.id,
          mealType: item.meal_type,
          foodId: item.food_id,
          foodName: item.foods?.name || 'Food Item',
          servings: Number(item.servings),
          servingSize: `${item.foods?.serving_size || '100'} ${item.foods?.serving_unit || 'g'}`,
          calculatedCalories: Number(item.calculated_calories),
          calculatedProteinG: Number(item.calculated_protein_g),
        })),
      };
    } catch {
      const stored = platform.storage.getItem(`meal_plan_${userId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return null;
    }
  }

  async saveMealPlan(plan: Omit<MealPlan, 'id'>): Promise<MealPlan | null> {
    const nowIso = new Date().toISOString();
    const fallbackPlan: MealPlan = {
      ...plan,
      id: 'plan-' + Math.random().toString(36).substring(2, 9),
      createdAt: plan.createdAt || nowIso,
    };

    if (!isSupabaseConfigured || !UUID_REGEX.test(plan.userId)) {
      platform.storage.setItem(`meal_plan_${plan.userId}`, JSON.stringify(fallbackPlan));
      return fallbackPlan;
    }

    try {
      const planKind: 'standard' | 'budget' | 'replacement_derived' =
        plan.planType === 'budget_generated'
          ? 'budget'
          : plan.planType === 'replacement_derived'
          ? 'replacement_derived'
          : 'standard';

      // 1. Deactivate old plans for user
      await supabase
        .from('meal_plans')
        .update({ is_active: false })
        .eq('user_id', plan.userId);

      // 2. Insert new active plan
      const { data: createdPlan, error: planError } = await supabase
        .from('meal_plans')
        .insert({
          user_id: plan.userId,
          name: plan.name,
          target_calories: Math.round(plan.targetCalories),
          target_protein_g: Math.round(plan.targetProteinG),
          is_active: true,
          plan_kind: planKind,
        })
        .select()
        .single();

      if (planError || !createdPlan) {
        platform.storage.setItem(`meal_plan_${plan.userId}`, JSON.stringify(fallbackPlan));
        return fallbackPlan;
      }

      // 3. Insert items
      const itemsToInsert = plan.items.map(item => ({
        meal_plan_id: createdPlan.id,
        food_id: item.foodId,
        meal_type: item.mealType,
        servings: item.servings,
        calculated_calories: Math.round(item.calculatedCalories),
        calculated_protein_g: Math.round(item.calculatedProteinG * 10) / 10,
        is_replacement: (item as any).isReplacement || false,
      }));

      await supabase.from('meal_plan_items').insert(itemsToInsert);

      const fullSavedPlan: MealPlan = {
        id: createdPlan.id,
        userId: createdPlan.user_id,
        name: createdPlan.name,
        targetCalories: createdPlan.target_calories,
        targetProteinG: createdPlan.target_protein_g,
        isActive: createdPlan.is_active,
        createdAt: createdPlan.created_at || nowIso,
        planType: plan.planType || 'standard',
        estimatedWeeklyCostInr: plan.estimatedWeeklyCostInr,
        items: plan.items,
      };

      platform.storage.setItem(`meal_plan_${plan.userId}`, JSON.stringify(fullSavedPlan));
      return fullSavedPlan;
    } catch {
      platform.storage.setItem(`meal_plan_${plan.userId}`, JSON.stringify(fallbackPlan));
      return fallbackPlan;
    }
  }

  async replaceMealPlanItemRpc(
    itemId: string,
    newFoodId: string,
    servings: number,
    calculatedCalories: number,
    calculatedProteinG: number
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { data, error } = await supabase.rpc('replace_meal_plan_item', {
        p_item_id: itemId,
        p_new_food_id: newFoodId,
        p_servings: servings,
        p_calculated_calories: calculatedCalories,
        p_calculated_protein_g: calculatedProteinG,
      });
      return !error && !!data;
    } catch {
      return false;
    }
  }

  // ── 4. Food Diary ──────────────────────────────────────────────────────────
  async fetchFoodDiaryEntries(userId: string, dateStr: string): Promise<FoodDiaryEntry[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`food_diary_${userId}_${dateStr}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return [];
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
        const stored = platform.storage.getItem(`food_diary_${userId}_${dateStr}`);
        if (stored && typeof stored === 'string') {
          try { return JSON.parse(stored); } catch { /* ignore */ }
        }
        return [];
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
    } catch (err) {
      logger.error('NutritionRepository: Error fetching food diary entries', { err });
      const stored = platform.storage.getItem(`food_diary_${userId}_${dateStr}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return [];
    }
  }

  async insertFoodDiaryEntry(
    entry: Omit<FoodDiaryEntry, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; entry?: FoodDiaryEntry; error?: string }> {
    const fallbackEntry: FoodDiaryEntry = {
      ...entry,
      id: 'entry-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured || !UUID_REGEX.test(entry.userId)) {
      const existing = await this.fetchFoodDiaryEntries(entry.userId, entry.loggedDate);
      existing.push(fallbackEntry);
      platform.storage.setItem(`food_diary_${entry.userId}_${entry.loggedDate}`, JSON.stringify(existing));
      return { success: true, entry: fallbackEntry };
    }

    try {
      const isUUID = entry.foodId && UUID_REGEX.test(entry.foodId);
      const foodIdParam = isUUID ? entry.foodId : null;

      const { data, error } = await supabase
        .from('food_diary_entries')
        .insert({
          user_id: entry.userId,
          logged_date: entry.loggedDate,
          meal_type: entry.mealType,
          food_id: foodIdParam,
          custom_food_name: entry.customFoodName || entry.foodName,
          servings: entry.servings,
          calories: entry.calories,
          protein_g: entry.proteinG,
          carbs_g: entry.carbsG,
          fat_g: entry.fatG,
        })
        .select()
        .single();

      if (error || !data) {
        const existing = await this.fetchFoodDiaryEntries(entry.userId, entry.loggedDate);
        existing.push(fallbackEntry);
        platform.storage.setItem(`food_diary_${entry.userId}_${entry.loggedDate}`, JSON.stringify(existing));
        return { success: true, entry: fallbackEntry };
      }

      const created: FoodDiaryEntry = {
        id: data.id,
        userId: data.user_id,
        loggedDate: data.logged_date,
        mealType: data.meal_type as MealSlot,
        foodId: data.food_id,
        customFoodName: data.custom_food_name,
        foodName: data.custom_food_name || 'Food Item',
        servings: parseFloat(data.servings),
        calories: parseFloat(data.calories),
        proteinG: parseFloat(data.protein_g),
        carbsG: parseFloat(data.carbs_g || 0),
        fatG: parseFloat(data.fat_g || 0),
        createdAt: data.created_at,
      };

      return { success: true, entry: created };
    } catch (err: unknown) {
      logger.error('NutritionRepository: Exception in insertFoodDiaryEntry', { err });
      const existing = await this.fetchFoodDiaryEntries(entry.userId, entry.loggedDate);
      existing.push(fallbackEntry);
      platform.storage.setItem(`food_diary_${entry.userId}_${entry.loggedDate}`, JSON.stringify(existing));
      return { success: true, entry: fallbackEntry };
    }
  }

  async deleteFoodDiaryEntry(userId: string, entryId: string, dateStr: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const existing = await this.fetchFoodDiaryEntries(userId, dateStr);
      const filtered = existing.filter(e => e.id !== entryId);
      platform.storage.setItem(`food_diary_${userId}_${dateStr}`, JSON.stringify(filtered));
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('food_diary_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId);

      const existing = await this.fetchFoodDiaryEntries(userId, dateStr);
      const filtered = existing.filter(e => e.id !== entryId);
      platform.storage.setItem(`food_diary_${userId}_${dateStr}`, JSON.stringify(filtered));

      if (error) {
        logger.error('NutritionRepository: Error deleting food diary entry', { error });
      }
      return { success: true };
    } catch (err: unknown) {
      logger.error('NutritionRepository: Exception in deleteFoodDiaryEntry', { err });
      return { success: true };
    }
  }

  async updateFoodDiaryEntry(
    userId: string,
    entryId: string,
    dateStr: string,
    updates: {
      servings: number;
      calories: number;
      proteinG: number;
      carbsG?: number;
      fatG?: number;
    }
  ): Promise<{ success: boolean; entry?: FoodDiaryEntry; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const existing = await this.fetchFoodDiaryEntries(userId, dateStr);
      const targetIndex = existing.findIndex(e => e.id === entryId);
      if (targetIndex === -1) {
        return { success: false, error: 'Entry not found' };
      }
      const updated: FoodDiaryEntry = {
        ...existing[targetIndex],
        servings: updates.servings,
        calories: updates.calories,
        proteinG: updates.proteinG,
        carbsG: updates.carbsG ?? existing[targetIndex].carbsG,
        fatG: updates.fatG ?? existing[targetIndex].fatG,
      };
      existing[targetIndex] = updated;
      platform.storage.setItem(`food_diary_${userId}_${dateStr}`, JSON.stringify(existing));
      return { success: true, entry: updated };
    }

    try {
      const { data, error } = await supabase
        .from('food_diary_entries')
        .update({
          servings: updates.servings,
          calories: updates.calories,
          protein_g: updates.proteinG,
          carbs_g: updates.carbsG ?? 0,
          fat_g: updates.fatG ?? 0,
        })
        .eq('id', entryId)
        .eq('user_id', userId)
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
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to update food diary entry' };
      }

      const resolvedName = data.custom_food_name || (data as any).foods?.name || 'Food Item';
      const resolvedServing = (data as any).foods
        ? `${(data as any).foods.serving_size} ${(data as any).foods.serving_unit}`
        : `${data.servings} serving`;

      const updatedEntry: FoodDiaryEntry = {
        id: data.id,
        userId: data.user_id,
        loggedDate: data.logged_date,
        mealType: data.meal_type as MealSlot,
        foodId: data.food_id,
        customFoodName: data.custom_food_name,
        foodName: resolvedName,
        servings: parseFloat(data.servings),
        servingSize: resolvedServing,
        calories: parseFloat(data.calories),
        proteinG: parseFloat(data.protein_g),
        carbsG: parseFloat(data.carbs_g || 0),
        fatG: parseFloat(data.fat_g || 0),
        createdAt: data.created_at,
      };

      // Keep local cache in sync
      const existing = await this.fetchFoodDiaryEntries(userId, dateStr);
      const targetIndex = existing.findIndex(e => e.id === entryId);
      if (targetIndex !== -1) {
        existing[targetIndex] = updatedEntry;
        platform.storage.setItem(`food_diary_${userId}_${dateStr}`, JSON.stringify(existing));
      }

      return { success: true, entry: updatedEntry };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Exception updating diary entry';
      logger.error('NutritionRepository: Exception in updateFoodDiaryEntry', { err });
      return { success: false, error: msg };
    }
  }

  // ── 5. Weekly Meal Plans ───────────────────────────────────────────────────
  async fetchWeeklyMealPlan(userId: string): Promise<WeeklyMealPlan | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`weekly_meal_plan_${userId}`);
      if (raw && typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data: planData, error: planError } = await supabase
        .from('weekly_meal_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planError || !planData) {
        const raw = platform.storage.getItem(`weekly_meal_plan_${userId}`);
        if (raw && typeof raw === 'string') {
          try { return JSON.parse(raw); } catch { /* ignore */ }
        }
        return null;
      }

      const { data: daysData, error: daysError } = await supabase
        .from('weekly_meal_plan_days')
        .select('*')
        .eq('weekly_meal_plan_id', planData.id)
        .order('day_of_week', { ascending: true });

      if (daysError || !daysData || daysData.length === 0) return null;

      const dayIds = daysData.map((d: any) => d.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('weekly_meal_plan_items')
        .select('*')
        .in('weekly_meal_plan_day_id', dayIds);

      if (itemsError) return null;

      const itemsByDay = new Map<string, WeeklyMealPlanItem[]>();
      (itemsData || []).forEach((it: any) => {
        const list = itemsByDay.get(it.weekly_meal_plan_day_id) || [];
        list.push({
          id: it.id,
          foodId: it.food_id,
          foodName: it.food_name,
          mealType: it.meal_type,
          servings: Number(it.servings),
          calculatedCalories: Number(it.calculated_calories),
          calculatedProteinG: Number(it.calculated_protein_g),
          calculatedCarbsG: Number(it.calculated_carbs_g),
          calculatedFatG: Number(it.calculated_fat_g),
        });
        itemsByDay.set(it.weekly_meal_plan_day_id, list);
      });

      const days: WeeklyMealPlanDay[] = daysData.map((d: any) => ({
        id: d.id,
        dayOfWeek: d.day_of_week,
        dayName: d.day_name,
        targetCalories: Number(d.target_calories),
        targetProteinG: Number(d.target_protein_g),
        totalCalories: Number(d.total_calories),
        totalProteinG: Number(d.total_protein_g),
        totalCarbsG: Number(d.total_carbs_g),
        totalFatG: Number(d.total_fat_g),
        items: itemsByDay.get(d.id) || [],
      }));

      const averageDailyCalories = Math.round(days.reduce((sum, d) => sum + d.totalCalories, 0) / (days.length || 1));
      const averageDailyProteinG = Math.round((days.reduce((sum, d) => sum + d.totalProteinG, 0) / (days.length || 1)) * 10) / 10;

      const plan: WeeklyMealPlan = {
        id: planData.id,
        userId: planData.user_id,
        name: planData.name,
        targetCalories: Number(planData.target_calories),
        targetProteinG: Number(planData.target_protein_g),
        isActive: planData.is_active,
        createdAt: planData.created_at,
        days,
        averageDailyCalories,
        averageDailyProteinG,
      };

      platform.storage.setItem(`weekly_meal_plan_${userId}`, JSON.stringify(plan));
      return plan;
    } catch (err) {
      logger.error('NutritionRepository: Error fetching weekly meal plan', { err });
      return null;
    }
  }

  async saveWeeklyMealPlan(plan: WeeklyMealPlan): Promise<WeeklyMealPlan> {
    platform.storage.setItem(`weekly_meal_plan_${plan.userId}`, JSON.stringify(plan));

    if (!isSupabaseConfigured || !UUID_REGEX.test(plan.userId)) {
      return plan;
    }

    try {
      // 1. Deactivate old plans for user
      await supabase
        .from('weekly_meal_plans')
        .update({ is_active: false })
        .eq('user_id', plan.userId);

      // 2. Insert parent plan
      const { data: createdPlan, error: planError } = await supabase
        .from('weekly_meal_plans')
        .insert({
          user_id: plan.userId,
          name: plan.name,
          target_calories: plan.targetCalories,
          target_protein_g: plan.targetProteinG,
          is_active: true,
        })
        .select()
        .single();

      if (planError || !createdPlan) return plan;

      // 3. Insert days
      const daysToInsert = plan.days.map(d => ({
        weekly_meal_plan_id: createdPlan.id,
        day_of_week: d.dayOfWeek,
        day_name: d.dayName,
        target_calories: d.targetCalories,
        target_protein_g: d.targetProteinG,
        total_calories: d.totalCalories,
        total_protein_g: d.totalProteinG,
        total_carbs_g: d.totalCarbsG,
        total_fat_g: d.totalFatG,
      }));

      const { data: insertedDays, error: daysError } = await supabase
        .from('weekly_meal_plan_days')
        .insert(daysToInsert)
        .select();

      if (daysError || !insertedDays) return { ...plan, id: createdPlan.id };

      // 4. Insert items per day
      const itemsToInsert: Array<{
        weekly_meal_plan_day_id: string;
        food_id: string;
        food_name: string;
        meal_type: string;
        servings: number;
        calculated_calories: number;
        calculated_protein_g: number;
        calculated_carbs_g: number;
        calculated_fat_g: number;
      }> = [];

      insertedDays.forEach((savedDay: any) => {
        const sourceDay = plan.days.find(d => d.dayOfWeek === savedDay.day_of_week);
        if (sourceDay && sourceDay.items) {
          sourceDay.items.forEach(it => {
            itemsToInsert.push({
              weekly_meal_plan_day_id: savedDay.id,
              food_id: it.foodId,
              food_name: it.foodName,
              meal_type: it.mealType,
              servings: it.servings,
              calculated_calories: it.calculatedCalories,
              calculated_protein_g: it.calculatedProteinG,
              calculated_carbs_g: it.calculatedCarbsG || 0,
              calculated_fat_g: it.calculatedFatG || 0,
            });
          });
        }
      });

      if (itemsToInsert.length > 0) {
        await supabase.from('weekly_meal_plan_items').insert(itemsToInsert);
      }

      const finalizedPlan: WeeklyMealPlan = {
        ...plan,
        id: createdPlan.id,
        createdAt: createdPlan.created_at,
      };

      platform.storage.setItem(`weekly_meal_plan_${plan.userId}`, JSON.stringify(finalizedPlan));
      return finalizedPlan;
    } catch (err) {
      logger.error('NutritionRepository: Error saving weekly meal plan', { err });
      return plan;
    }
  }
}

export const nutritionRepository = new NutritionRepository();
