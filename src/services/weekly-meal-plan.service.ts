import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { WeeklyMealPlan, WeeklyMealPlanDay, WeeklyMealPlanItem } from '@/types/nutrition.types';
import { generateWeeklyMealPlan } from '@/domain/weekly-meal-planner';
import { nutritionService } from '@/services/nutrition.service';
import { entitlementService } from '@/services/entitlement.service';
import { logger } from '@/lib/logger';

export const weeklyMealPlanService = {
  /**
   * Retrieves the active 7-day weekly meal plan for the given user.
   */
  async getActiveWeeklyMealPlan(userId: string): Promise<WeeklyMealPlan | null> {
    const entitlement = await entitlementService.assertServerEntitlement(userId);
    if (!entitlement.authorized) {
      return null;
    }

    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`weekly_meal_plan_${userId}`);
      return stored ? JSON.parse(stored) : null;
    }

    try {
      // 1. Fetch active plan
      const { data: planData, error: planError } = await supabase
        .from('weekly_meal_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planError || !planData) {
        const stored = localStorage.getItem(`weekly_meal_plan_${userId}`);
        return stored ? JSON.parse(stored) : null;
      }

      // 2. Fetch days
      const { data: daysData, error: daysError } = await supabase
        .from('weekly_meal_plan_days')
        .select('*')
        .eq('weekly_meal_plan_id', planData.id)
        .order('day_of_week', { ascending: true });

      if (daysError || !daysData || daysData.length === 0) {
        const stored = localStorage.getItem(`weekly_meal_plan_${userId}`);
        return stored ? JSON.parse(stored) : null;
      }

      // 3. Fetch items for all days
      const dayIds = daysData.map(d => d.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('weekly_meal_plan_items')
        .select('*')
        .in('weekly_meal_plan_day_id', dayIds);

      const itemsByDay = new Map<string, WeeklyMealPlanItem[]>();
      if (!itemsError && itemsData) {
        itemsData.forEach(it => {
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
      }

      const days: WeeklyMealPlanDay[] = daysData.map(d => ({
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

      localStorage.setItem(`weekly_meal_plan_${userId}`, JSON.stringify(plan));
      return plan;
    } catch (err) {
      logger.error('Error fetching weekly meal plan', { err });
      const stored = localStorage.getItem(`weekly_meal_plan_${userId}`);
      return stored ? JSON.parse(stored) : null;
    }
  },

  /**
   * Saves a weekly meal plan to Supabase and caches to localStorage.
   */
  async saveWeeklyMealPlan(plan: WeeklyMealPlan): Promise<WeeklyMealPlan> {
    const entitlement = await entitlementService.assertServerEntitlement(plan.userId);
    if (!entitlement.authorized) {
      throw new Error('PREMIUM_REQUIRED: Weekly meal planning requires an active Premium plan.');
    }

    localStorage.setItem(`weekly_meal_plan_${plan.userId}`, JSON.stringify(plan));

    if (!isSupabaseConfigured) {
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

      if (planError || !createdPlan) {
        return plan;
      }

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

      if (daysError || !insertedDays) {
        return { ...plan, id: createdPlan.id };
      }

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

      insertedDays.forEach(savedDay => {
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

      localStorage.setItem(`weekly_meal_plan_${plan.userId}`, JSON.stringify(finalizedPlan));
      return finalizedPlan;
    } catch (err) {
      logger.error('Error saving weekly meal plan to Supabase', { err });
      return plan;
    }
  },

  /**
   * Generates, computes, and persists a fresh 7-day weekly meal plan.
   */
  async generateAndSaveWeeklyMealPlan(
    userId: string,
    targetCalories: number,
    targetProteinG: number,
    dietaryPreference: string
  ): Promise<WeeklyMealPlan> {
    const foods = await nutritionService.getFoods();
    const plan = generateWeeklyMealPlan({
      userId,
      targetCalories,
      targetProteinG,
      dietaryPreference,
      availableFoods: foods,
    });

    return this.saveWeeklyMealPlan(plan);
  },
};
