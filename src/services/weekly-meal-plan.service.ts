import { WeeklyMealPlan } from '@/types/nutrition.types';
import { generateWeeklyMealPlan } from '@/domain/weekly-meal-planner';
import { nutritionService } from '@/services/nutrition.service';
import { entitlementService } from '@/services/entitlement.service';
import { nutritionRepository } from '@/repositories/nutrition.repository';

export const weeklyMealPlanService = {
  /**
   * Retrieves the active 7-day weekly meal plan for the given user.
   */
  async getActiveWeeklyMealPlan(userId: string): Promise<WeeklyMealPlan | null> {
    const entitlement = await entitlementService.assertServerEntitlement(userId);
    if (!entitlement.authorized) {
      return null;
    }

    return nutritionRepository.fetchWeeklyMealPlan(userId);
  },

  /**
   * Saves a weekly meal plan to repository.
   */
  async saveWeeklyMealPlan(plan: WeeklyMealPlan): Promise<WeeklyMealPlan> {
    const entitlement = await entitlementService.assertServerEntitlement(plan.userId);
    if (!entitlement.authorized) {
      throw new Error('PREMIUM_REQUIRED: Weekly meal planning requires an active Premium plan.');
    }

    return nutritionRepository.saveWeeklyMealPlan(plan);
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
