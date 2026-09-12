import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { entitlementService } from '@/services/entitlement.service';
import { weeklyMealPlanService } from '@/services/weekly-meal-plan.service';
import { nutritionService } from '@/services/nutrition.service';
import { exerciseService } from '@/services/exercise.service';
import { reminderService, MOTIVATION_TEMPLATES } from '@/services/reminder.service';
import { Exercise } from '@/types/workout.types';
import { MealPlan, WeeklyMealPlan } from '@/types/nutrition.types';

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
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = mockLocalStorage;
}

describe('Server-Authoritative Premium Enforcement Suite', () => {
  const freeUserId = '11111111-1111-4111-8111-111111111111';
  const premiumUserId = '99999999-9999-4999-8999-999999999999';

  beforeEach(() => {
    // Deterministically configure test entitlement states
    entitlementService.setTestPlanTypeOverride(freeUserId, 'free');
    entitlementService.setTestPlanTypeOverride(premiumUserId, 'premium');
  });

  afterEach(() => {
    entitlementService.clearTestOverrides();
  });

  // ============================================================================
  // 1. FREE USER BYPASS DEFENSE TESTS
  // ============================================================================
  describe('Free User Direct Service Invocation Rejection', () => {
    it('should REJECT weeklyMealPlanService.generateAndSaveWeeklyMealPlan for Free user', async () => {
      await expect(
        weeklyMealPlanService.generateAndSaveWeeklyMealPlan(freeUserId, 2200, 140, 'vegetarian')
      ).rejects.toThrow(/PREMIUM_REQUIRED/);
    });

    it('should REJECT weeklyMealPlanService.saveWeeklyMealPlan for Free user', async () => {
      const dummyPlan: WeeklyMealPlan = {
        id: 'wmp-test-1',
        userId: freeUserId,
        name: '7-Day Rotating Meal Schedule',
        targetCalories: 2200,
        targetProteinG: 140,
        isActive: true,
        createdAt: new Date().toISOString(),
        averageDailyCalories: 2200,
        averageDailyProteinG: 140,
        days: [],
      };

      await expect(
        weeklyMealPlanService.saveWeeklyMealPlan(dummyPlan)
      ).rejects.toThrow(/PREMIUM_REQUIRED/);
    });

    it('should return null for weeklyMealPlanService.getActiveWeeklyMealPlan when called by Free user', async () => {
      const plan = await weeklyMealPlanService.getActiveWeeklyMealPlan(freeUserId);
      expect(plan).toBeNull();
    });

    it('should REJECT nutritionService.generateBudgetMealPlan for Free user', async () => {
      await expect(
        nutritionService.generateBudgetMealPlan(freeUserId, {
          targetCalories: 2100,
          targetProteinG: 130,
          dietaryPreference: 'vegetarian',
          budgetInr: 1500,
          period: 'weekly',
          mealSlotCount: 4,
        })
      ).rejects.toThrow(/PREMIUM_REQUIRED/);
    });

    it('should REJECT nutritionService.swapPlanItem (Meal Replacement) for Free user', async () => {
      const currentPlan: MealPlan = {
        id: 'plan-free-1',
        userId: freeUserId,
        name: 'Standard Plan',
        targetCalories: 2000,
        targetProteinG: 120,
        isActive: true,
        items: [
          {
            id: 'item-1',
            foodId: 'f-1',
            foodName: 'Paneer',
            mealType: 'lunch',
            servings: 1,
            servingSize: '100g',
            calculatedCalories: 265,
            calculatedProteinG: 18,
          },
        ],
      };

      const replacementFood = {
        id: 'f-3',
        name: 'Soya Chunks',
        servingSize: '100',
        servingUnit: 'g',
        calories: 345,
        proteinG: 52,
        carbsG: 33,
        fatG: 0.5,
        dietaryType: 'vegan' as const,
        source: 'Catalog',
        isVerified: true,
      };

      await expect(
        nutritionService.swapPlanItem(freeUserId, currentPlan, 'item-1', {
          food: replacementFood,
          recommendedServings: 0.5,
        })
      ).rejects.toThrow(/PREMIUM_REQUIRED/);
    });

    it('should REJECT exerciseService.getAlternativesForExercise for Free user', async () => {
      const targetExercise: Exercise = {
        id: 'ex-bench-press',
        name: 'Barbell Bench Press',
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
        equipmentRequired: 'barbell',
        difficulty: 'intermediate',
        movementPattern: 'horizontal_push',
        instructions: ['Setup properly', 'Press steadily'],
        isSystem: true,
      };

      await expect(
        exerciseService.getAlternativesForExercise(targetExercise, 4, freeUserId)
      ).rejects.toThrow(/PREMIUM_REQUIRED/);
    });

    it('should REJECT reminderService.saveReminderPreference with tough_love style for Free user', async () => {
      const result = await reminderService.saveReminderPreference({
        userId: freeUserId,
        enabled: true,
        time: '06:30',
        days: [1, 2, 3, 4, 5],
        title: 'Discipline',
        message: 'No excuses',
        motivationStyle: 'tough_love',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/PREMIUM_REQUIRED/);
    });

    it('should REJECT reminderService.saveReminderPreference with motivational style for Free user', async () => {
      const result = await reminderService.saveReminderPreference({
        userId: freeUserId,
        enabled: true,
        time: '07:00',
        days: [1, 3, 5],
        title: 'Champions',
        message: 'Consistency',
        motivationStyle: 'motivational',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/PREMIUM_REQUIRED/);
    });

    it('should REJECT nutritionService.getDailyNutrientComparison for Free user', async () => {
      const res = await nutritionService.getDailyNutrientComparison(
        freeUserId,
        { calories: 1800, proteinG: 120, carbsG: 200, fatG: 50, fiberG: 25 },
        { calories: 2200, proteinG: 150, carbsG: 240, fatG: 70, fiberG: 30 }
      );

      expect(res.authorized).toBe(false);
      expect(res.error?.code).toBe('PREMIUM_REQUIRED');
      expect(res.data).toBeUndefined();
    });

    it('should REJECT nutritionService.analyzeMixedMeal for Free user', async () => {
      const res = await nutritionService.analyzeMixedMeal(
        freeUserId,
        [],
        { calories: 2000, proteinG: 140 }
      );

      expect(res.authorized).toBe(false);
      expect(res.error?.code).toBe('PREMIUM_REQUIRED');
      expect(res.data).toBeUndefined();
    });

    it('should REJECT nutritionService.getFullNutritionAnalysis for Free user', async () => {
      const res = await nutritionService.getFullNutritionAnalysis(freeUserId, 'f-1');
      expect(res.authorized).toBe(false);
      expect(res.error?.code).toBe('PREMIUM_REQUIRED');
      expect(res.data).toBeUndefined();
    });
  });

  // ============================================================================
  // 2. PREMIUM USER ACCESS TESTS
  // ============================================================================
  describe('Premium User Authoritative Execution', () => {
    it('should ALLOW weeklyMealPlanService.generateAndSaveWeeklyMealPlan for Premium user', async () => {
      const plan = await weeklyMealPlanService.generateAndSaveWeeklyMealPlan(
        premiumUserId,
        2200,
        140,
        'vegetarian'
      );

      expect(plan).toBeDefined();
      expect(plan.userId).toBe(premiumUserId);
      expect(plan.days.length).toBe(7);
    });

    it('should ALLOW nutritionService.generateBudgetMealPlan for Premium user', async () => {
      const plan = await nutritionService.generateBudgetMealPlan(premiumUserId, {
        targetCalories: 2100,
        targetProteinG: 130,
        dietaryPreference: 'vegetarian',
        budgetInr: 1500,
        period: 'weekly',
        mealSlotCount: 4,
      });

      expect(plan).toBeDefined();
      expect(plan?.planType).toBe('budget_generated');
    });

    it('should ALLOW nutritionService.swapPlanItem for Premium user', async () => {
      const currentPlan: MealPlan = {
        id: 'plan-prem-1',
        userId: premiumUserId,
        name: 'Premium Plan',
        targetCalories: 2200,
        targetProteinG: 150,
        isActive: true,
        items: [
          {
            id: 'item-1',
            foodId: 'f-1',
            foodName: 'Paneer',
            mealType: 'lunch',
            servings: 1,
            servingSize: '100g',
            calculatedCalories: 265,
            calculatedProteinG: 18,
          },
        ],
      };

      const replacementFood = {
        id: 'f-3',
        name: 'Soya Chunks',
        servingSize: '100',
        servingUnit: 'g',
        calories: 345,
        proteinG: 52,
        carbsG: 33,
        fatG: 0.5,
        dietaryType: 'vegan' as const,
        source: 'Catalog',
        isVerified: true,
      };

      const updated = await nutritionService.swapPlanItem(premiumUserId, currentPlan, 'item-1', {
        food: replacementFood,
        recommendedServings: 0.5,
      });

      expect(updated).toBeDefined();
      expect(updated?.items[0].foodId).toBe('f-3');
    });

    it('should ALLOW exerciseService.getAlternativesForExercise for Premium user', async () => {
      const targetExercise: Exercise = {
        id: 'ex-bench-press',
        name: 'Barbell Bench Press',
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
        equipmentRequired: 'barbell',
        difficulty: 'intermediate',
        movementPattern: 'horizontal_push',
        instructions: ['Setup properly', 'Press steadily'],
        isSystem: true,
      };

      const alternatives = await exerciseService.getAlternativesForExercise(
        targetExercise,
        4,
        premiumUserId
      );

      expect(alternatives).toBeDefined();
      expect(Array.isArray(alternatives)).toBe(true);
      expect(alternatives.length).toBeGreaterThan(0);
    });

    it('should ALLOW reminderService.saveReminderPreference with tough_love style for Premium user', async () => {
      const result = await reminderService.saveReminderPreference({
        userId: premiumUserId,
        enabled: true,
        time: '06:00',
        days: [1, 2, 3, 4, 5],
        title: MOTIVATION_TEMPLATES.tough_love.title,
        message: MOTIVATION_TEMPLATES.tough_love.message,
        motivationStyle: 'tough_love',
      });

      expect(result.success).toBe(true);
      expect(result.data?.motivationStyle).toBe('tough_love');
      expect(result.data?.title).toBe(MOTIVATION_TEMPLATES.tough_love.title);
    });

    it('should ALLOW nutritionService.getDailyNutrientComparison for Premium user', async () => {
      const res = await nutritionService.getDailyNutrientComparison(
        premiumUserId,
        { calories: 2000, proteinG: 140, carbsG: 220, fatG: 60, fiberG: 28 },
        { calories: 2200, proteinG: 150, carbsG: 240, fatG: 70, fiberG: 30 }
      );

      expect(res.authorized).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.length).toBe(5);
      expect(res.data?.[0].label).toBe('Energy (Calories)');
    });

    it('should ALLOW nutritionService.getFullNutritionAnalysis for Premium user', async () => {
      const res = await nutritionService.getFullNutritionAnalysis(premiumUserId, 'f-1');
      expect(res.authorized).toBe(true);
      expect(res.data?.foodId).toBe('f-1');
      expect(res.data?.micronutrients.length).toBeGreaterThan(5);
    });
  });

  // ============================================================================
  // 3. FREE FEATURE NON-REGRESSION TESTS
  // ============================================================================
  describe('Free Feature Non-Regression', () => {
    it('should ALLOW Free user to save basic reminder without error', async () => {
      const res = await reminderService.saveReminderPreference({
        userId: freeUserId,
        enabled: true,
        time: '08:00',
        days: [1, 2, 3],
        title: MOTIVATION_TEMPLATES.basic.title,
        message: MOTIVATION_TEMPLATES.basic.message,
        motivationStyle: 'basic',
      });

      expect(res.success).toBe(true);
      expect(res.data?.enabled).toBe(true);
    });

    it('should ALLOW Free user to generate and save standard meal plans', async () => {
      const plan = await nutritionService.generateAndSaveMealPlan(
        freeUserId,
        2000,
        120,
        'vegetarian'
      );

      expect(plan).toBeDefined();
      expect(plan?.userId).toBe(freeUserId);
      expect(plan?.items.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 4. POSTGRESQL RLS & RPC ENGINE ADVERSARIAL PENETRATION SUITE
  // ============================================================================
  describe('PostgreSQL RLS & RPC Adversarial Penetration Suite', () => {
    interface ProfileRow {
      id: string;
      plan_type: 'free' | 'premium';
    }

    interface MealPlanRow {
      id: string;
      user_id: string;
      name: string;
      plan_kind: 'standard' | 'budget' | 'replacement_derived';
      is_active: boolean;
    }

    interface MealPlanItemRow {
      id: string;
      meal_plan_id: string;
      food_id: string;
      servings: number;
      calculated_calories: number;
      calculated_protein_g: number;
      is_replacement: boolean;
    }

    interface NotificationRow {
      id: string;
      user_id: string;
      title: string;
      message: string;
      notification_style: 'basic' | 'gentle' | 'motivational' | 'tough_love';
      is_active: boolean;
    }

    interface WeeklyMealPlanRow {
      id: string;
      user_id: string;
      name: string;
    }

    const profiles: ProfileRow[] = [
      { id: freeUserId, plan_type: 'free' },
      { id: premiumUserId, plan_type: 'premium' },
      { id: 'victim-user-uuid-3333', plan_type: 'premium' },
    ];

    let mealPlansTable: MealPlanRow[] = [];
    let mealPlanItemsTable: MealPlanItemRow[] = [];

    beforeEach(() => {
      mealPlansTable = [
        {
          id: 'plan-free-100',
          user_id: freeUserId,
          name: 'My Daily Meals',
          plan_kind: 'standard',
          is_active: true,
        },
        {
          id: 'plan-victim-200',
          user_id: 'victim-user-uuid-3333',
          name: 'Victim Plan',
          plan_kind: 'standard',
          is_active: true,
        },
      ];

      mealPlanItemsTable = [
        {
          id: 'item-free-101',
          meal_plan_id: 'plan-free-100',
          food_id: 'f-1',
          servings: 1,
          calculated_calories: 265,
          calculated_protein_g: 18,
          is_replacement: false,
        },
        {
          id: 'item-victim-201',
          meal_plan_id: 'plan-victim-200',
          food_id: 'f-5',
          servings: 1,
          calculated_calories: 120,
          calculated_protein_g: 22.5,
          is_replacement: false,
        },
      ];
    });

    // Authoritative SQL helper simulation: public.is_current_user_premium()
    function isCurrentUserPremium(authUid: string): boolean {
      const p = profiles.find(pr => pr.id === authUid);
      return p?.plan_type === 'premium';
    }

    // Evaluates RLS on public.meal_plans
    function evaluateMealPlanInsertRLS(authUid: string, row: Partial<MealPlanRow>): boolean {
      const planKind = row.plan_kind || 'standard'; // DEFAULT 'standard'
      const validKinds = ['standard', 'budget', 'replacement_derived'];
      if (!validKinds.includes(planKind)) return false; // CHECK constraint
      return authUid === row.user_id && (planKind === 'standard' || isCurrentUserPremium(authUid));
    }

    function evaluateMealPlanUpdateRLS(authUid: string, row: MealPlanRow): boolean {
      return authUid === row.user_id && (row.plan_kind === 'standard' || isCurrentUserPremium(authUid));
    }

    // Evaluates RLS on public.meal_plan_items
    function evaluateMealPlanItemInsertRLS(authUid: string, row: Partial<MealPlanItemRow>): boolean {
      const parentPlan = mealPlansTable.find(p => p.id === row.meal_plan_id);
      if (!parentPlan || parentPlan.user_id !== authUid) return false;
      const isReplacement = row.is_replacement ?? false;
      return (parentPlan.plan_kind === 'standard' && !isReplacement) || isCurrentUserPremium(authUid);
    }

    function evaluateMealPlanItemUpdateRLS(authUid: string, itemId: string): boolean {
      const item = mealPlanItemsTable.find(i => i.id === itemId);
      if (!item) return false;
      const parentPlan = mealPlansTable.find(p => p.id === item.meal_plan_id);
      if (!parentPlan || parentPlan.user_id !== authUid) return false;
      return isCurrentUserPremium(authUid);
    }

    function evaluateMealPlanItemDeleteRLS(authUid: string, itemId: string): boolean {
      const item = mealPlanItemsTable.find(i => i.id === itemId);
      if (!item) return false;
      const parentPlan = mealPlansTable.find(p => p.id === item.meal_plan_id);
      if (!parentPlan || parentPlan.user_id !== authUid) return false;
      return isCurrentUserPremium(authUid);
    }

    // Evaluates RPC public.replace_meal_plan_item
    function executeReplaceMealPlanItemRPC(
      authUid: string,
      args: {
        p_item_id: string;
        p_new_food_id: string;
        p_servings: number;
        p_calculated_calories: number;
        p_calculated_protein_g: number;
      }
    ): MealPlanItemRow {
      if (!isCurrentUserPremium(authUid)) {
        throw new Error('PREMIUM_REQUIRED: Meal replacement requires an active Premium plan.');
      }

      const item = mealPlanItemsTable.find(i => i.id === args.p_item_id);
      if (!item) {
        throw new Error('NOT_FOUND_OR_FORBIDDEN: Target meal item not found or not owned by session.');
      }
      const parentPlan = mealPlansTable.find(p => p.id === item.meal_plan_id);
      if (!parentPlan || parentPlan.user_id !== authUid) {
        throw new Error('NOT_FOUND_OR_FORBIDDEN: Target meal item not found or not owned by session.');
      }

      item.food_id = args.p_new_food_id;
      item.servings = args.p_servings;
      item.calculated_calories = args.p_calculated_calories;
      item.calculated_protein_g = args.p_calculated_protein_g;
      item.is_replacement = true;
      parentPlan.plan_kind = 'replacement_derived';

      return item;
    }

    // Evaluates RLS on public.notifications
    function evaluateNotificationInsertRLS(authUid: string, row: Partial<NotificationRow>): boolean {
      const style = row.notification_style || 'basic'; // DEFAULT 'basic'
      const validStyles = ['basic', 'gentle', 'motivational', 'tough_love'];
      if (!validStyles.includes(style)) return false; // CHECK constraint
      return authUid === row.user_id && (style === 'basic' || isCurrentUserPremium(authUid));
    }

    function evaluateNotificationUpdateRLS(authUid: string, row: NotificationRow): boolean {
      return authUid === row.user_id && (row.notification_style === 'basic' || isCurrentUserPremium(authUid));
    }

    // Evaluates RLS on public.weekly_meal_plans
    function evaluateWeeklyMealPlanInsertRLS(authUid: string, row: WeeklyMealPlanRow): boolean {
      return authUid === row.user_id && isCurrentUserPremium(authUid);
    }

    // --------------------------------------------------------------------------
    // TEST 1: Free Direct REST meal_plan_items Mutation
    // --------------------------------------------------------------------------
    it('adversarial test 1: Free user direct PATCH / DELETE on meal_plan_items must be DENIED by RLS', () => {
      // Free user attempts to directly PATCH an item to swap food without service guard
      const updateAllowed = evaluateMealPlanItemUpdateRLS(freeUserId, 'item-free-101');
      expect(updateAllowed).toBe(false);

      // Free user attempts to directly DELETE an individual item to replace it manually
      const deleteAllowed = evaluateMealPlanItemDeleteRLS(freeUserId, 'item-free-101');
      expect(deleteAllowed).toBe(false);

      // Free user attempts to directly INSERT a replacement item (is_replacement: true)
      const insertReplacementAllowed = evaluateMealPlanItemInsertRLS(freeUserId, {
        meal_plan_id: 'plan-free-100',
        food_id: 'f-3',
        servings: 1,
        calculated_calories: 345,
        calculated_protein_g: 52,
        is_replacement: true,
      });
      expect(insertReplacementAllowed).toBe(false);

      // Free user attempts to directly INSERT a weekly 7-day meal plan via REST
      const insertWeeklyAllowed = evaluateWeeklyMealPlanInsertRLS(freeUserId, {
        id: 'wmp-free-tamper',
        user_id: freeUserId,
        name: 'Bypassed 7-Day Plan',
      });
      expect(insertWeeklyAllowed).toBe(false);
    });

    // --------------------------------------------------------------------------
    // TEST 2: Free Direct REST Notification Insertion Using Premium Style
    // --------------------------------------------------------------------------
    it('adversarial test 2: Free user direct REST notification insert with Premium styles must be DENIED by RLS', () => {
      // Free user attempts to insert tough_love style directly via PostgREST
      const toughLoveAllowed = evaluateNotificationInsertRLS(freeUserId, {
        user_id: freeUserId,
        title: 'Tough Love Alarm',
        message: 'No compromises',
        notification_style: 'tough_love',
        is_active: true,
      });
      expect(toughLoveAllowed).toBe(false);

      // Free user attempts to insert motivational style directly
      const motivationalAllowed = evaluateNotificationInsertRLS(freeUserId, {
        user_id: freeUserId,
        title: 'Championship Mindset',
        message: 'Discipline',
        notification_style: 'motivational',
        is_active: true,
      });
      expect(motivationalAllowed).toBe(false);

      // Free user inserting basic style is ALLOWED
      const basicAllowed = evaluateNotificationInsertRLS(freeUserId, {
        user_id: freeUserId,
        title: 'Workout Reminder',
        message: 'Your workout is scheduled',
        notification_style: 'basic',
        is_active: true,
      });
      expect(basicAllowed).toBe(true);
    });

    // --------------------------------------------------------------------------
    // TEST 3: Free Direct Budget Plan Insertion with Non-Budget Name (Renaming Evasion)
    // --------------------------------------------------------------------------
    it('adversarial test 3: Free user inserting plan_kind=budget with innocent name must be DENIED by RLS', () => {
      // Free user crafts a budget plan with an innocent name "My Standard Healthy Meal Plan"
      const evasivePlanRow: Partial<MealPlanRow> = {
        user_id: freeUserId,
        name: 'My Standard Healthy Meal Plan', // Name does NOT contain "Budget"
        plan_kind: 'budget', // Semantic machine-readable flag
        is_active: true,
      };

      const allowed = evaluateMealPlanInsertRLS(freeUserId, evasivePlanRow);
      expect(allowed).toBe(false); // DENIED by plan_kind RLS check regardless of name
    });

    // --------------------------------------------------------------------------
    // TEST 4: Free Direct RPC Invocation
    // --------------------------------------------------------------------------
    it('adversarial test 4: Free user direct invocation of replace_meal_plan_item RPC must THROW exception', () => {
      expect(() =>
        executeReplaceMealPlanItemRPC(freeUserId, {
          p_item_id: 'item-free-101',
          p_new_food_id: 'f-3',
          p_servings: 1,
          p_calculated_calories: 345,
          p_calculated_protein_g: 52,
        })
      ).toThrow(/PREMIUM_REQUIRED/);
    });

    // --------------------------------------------------------------------------
    // TEST 5: Free Alternate Service/Path Bypasses
    // --------------------------------------------------------------------------
    it('adversarial test 5: Free user attempting to persist replacement_derived plan directly must be DENIED by RLS', () => {
      const derivedPlanRow: Partial<MealPlanRow> = {
        user_id: freeUserId,
        name: 'Custom Swapped Plan',
        plan_kind: 'replacement_derived',
        is_active: true,
      };

      const allowed = evaluateMealPlanInsertRLS(freeUserId, derivedPlanRow);
      expect(allowed).toBe(false);
    });

    // --------------------------------------------------------------------------
    // TEST 6: Cross-User Object IDs (IDOR Defense)
    // --------------------------------------------------------------------------
    it('adversarial test 6: IDOR - Free & Premium users cannot mutate another user’s objects', () => {
      // 1. Free user tries to update Victim's meal plan
      const crossPlanAllowed = evaluateMealPlanUpdateRLS(freeUserId, {
        id: 'plan-victim-200',
        user_id: 'victim-user-uuid-3333',
        name: 'Hacked Plan',
        plan_kind: 'standard',
        is_active: true,
      });
      expect(crossPlanAllowed).toBe(false);

      // 2. Free user tries to update Victim's meal plan item
      const crossItemAllowed = evaluateMealPlanItemUpdateRLS(freeUserId, 'item-victim-201');
      expect(crossItemAllowed).toBe(false);

      // 3. Premium user tries to execute RPC on Victim's meal plan item
      expect(() =>
        executeReplaceMealPlanItemRPC(premiumUserId, {
          p_item_id: 'item-victim-201',
          p_new_food_id: 'f-3',
          p_servings: 1,
          p_calculated_calories: 345,
          p_calculated_protein_g: 52,
        })
      ).toThrow(/NOT_FOUND_OR_FORBIDDEN/);

      // 4. Free user tries to insert a notification under victim's user_id
      const crossNotifAllowed = evaluateNotificationInsertRLS(freeUserId, {
        user_id: 'victim-user-uuid-3333',
        title: 'Spoofed Reminder',
        message: 'Spoofed',
        notification_style: 'basic',
        is_active: true,
      });
      expect(crossNotifAllowed).toBe(false);
    });

    // --------------------------------------------------------------------------
    // TEST 7: Null / Default Payload Bypass
    // --------------------------------------------------------------------------
    it('adversarial test 7: Null / default payload safely falls back to standard and basic', () => {
      // Omitted plan_kind defaults safely to 'standard'
      const defaultPlanAllowed = evaluateMealPlanInsertRLS(freeUserId, {
        user_id: freeUserId,
        name: 'Default Plan',
        // plan_kind omitted
      });
      expect(defaultPlanAllowed).toBe(true);

      // Omitted notification_style defaults safely to 'basic'
      const defaultNotifAllowed = evaluateNotificationInsertRLS(freeUserId, {
        user_id: freeUserId,
        title: 'Standard',
        message: 'Workout',
        // notification_style omitted
      });
      expect(defaultNotifAllowed).toBe(true);

      // Invalid/spoofed semantic values are rejected by database CHECK constraint
      const invalidStyleAllowed = evaluateNotificationInsertRLS(freeUserId, {
        user_id: freeUserId,
        title: 'Hacked',
        message: 'Test',
        notification_style: 'invalid_malicious_style' as any,
      });
      expect(invalidStyleAllowed).toBe(false);
    });

    // --------------------------------------------------------------------------
    // TEST 8: Renamed Semantic Object Bypass
    // --------------------------------------------------------------------------
    it('adversarial test 8: Renaming notification title/message with tough-love words does NOT bypass basic style rule', () => {
      // Free user crafts a basic notification but puts tough-love message text inside
      // In DB RLS, the machine-readable column notification_style is the authorization boundary!
      const basicWithToughLoveText = evaluateNotificationInsertRLS(freeUserId, {
        user_id: freeUserId,
        title: 'Discipline Protocol: Zero Rationalizing Delays',
        message: 'No compromises, no excuses! Let’s execute!',
        notification_style: 'basic', // Honest machine-readable state
      });
      // Permitted as basic style in DB, but client reminderService ensures template tone gating
      expect(basicWithToughLoveText).toBe(true);

      // If user sets notification_style to tough_love, RLS unconditionally rejects regardless of title
      const toughLoveRenamed = evaluateNotificationInsertRLS(freeUserId, {
        user_id: freeUserId,
        title: 'Gentle Friendly Good Morning',
        message: 'Have a great day!',
        notification_style: 'tough_love',
      });
      expect(toughLoveRenamed).toBe(false);
    });

    // --------------------------------------------------------------------------
    // TEST 9: Premium Success Cases
    // --------------------------------------------------------------------------
    it('adversarial test 9: Premium user successfully executes RPC, writes budget plans, and sets tough_love alarms', () => {
      // 1. Premium writes budget plan
      const budgetAllowed = evaluateMealPlanInsertRLS(premiumUserId, {
        user_id: premiumUserId,
        name: 'High Protein Budget Plan',
        plan_kind: 'budget',
        is_active: true,
      });
      expect(budgetAllowed).toBe(true);

      // 2. Premium writes tough_love notification
      const toughLoveAllowed = evaluateNotificationInsertRLS(premiumUserId, {
        user_id: premiumUserId,
        title: 'FitSphere Discipline Protocol',
        message: 'Zero delays',
        notification_style: 'tough_love',
        is_active: true,
      });
      expect(toughLoveAllowed).toBe(true);

      // 3. Premium sets up a meal plan and executes replace_meal_plan_item RPC
      mealPlansTable.push({
        id: 'plan-prem-500',
        user_id: premiumUserId,
        name: 'Premium Plan',
        plan_kind: 'standard',
        is_active: true,
      });
      mealPlanItemsTable.push({
        id: 'item-prem-501',
        meal_plan_id: 'plan-prem-500',
        food_id: 'f-1',
        servings: 1,
        calculated_calories: 265,
        calculated_protein_g: 18,
        is_replacement: false,
      });

      const updated = executeReplaceMealPlanItemRPC(premiumUserId, {
        p_item_id: 'item-prem-501',
        p_new_food_id: 'f-3',
        p_servings: 0.5,
        p_calculated_calories: 172,
        p_calculated_protein_g: 26,
      });

      expect(updated.food_id).toBe('f-3');
      expect(updated.is_replacement).toBe(true);

      const parentPlan = mealPlansTable.find(p => p.id === 'plan-prem-500');
      expect(parentPlan?.plan_kind).toBe('replacement_derived');

      // 4. Premium writes weekly 7-day meal plan
      const weeklyAllowed = evaluateWeeklyMealPlanInsertRLS(premiumUserId, {
        id: 'wmp-prem-1',
        user_id: premiumUserId,
        name: 'Championship 7-Day Schedule',
      });
      expect(weeklyAllowed).toBe(true);
    });

    // --------------------------------------------------------------------------
    // TEST 10: Free Feature Non-Regression
    // --------------------------------------------------------------------------
    it('adversarial test 10: Free users retain 100% normal meal planning and basic reminder capabilities', () => {
      // Free user creates a standard meal plan
      const standardPlanAllowed = evaluateMealPlanInsertRLS(freeUserId, {
        user_id: freeUserId,
        name: 'My Normal Meal Plan',
        plan_kind: 'standard',
        is_active: true,
      });
      expect(standardPlanAllowed).toBe(true);

      // Free user inserts standard meal items for their plan
      const standardItemAllowed = evaluateMealPlanItemInsertRLS(freeUserId, {
        meal_plan_id: 'plan-free-100',
        food_id: 'f-2',
        servings: 1,
        calculated_calories: 160,
        calculated_protein_g: 24,
        is_replacement: false,
      });
      expect(standardItemAllowed).toBe(true);

      // Free user creates and updates standard reminder
      const notifAllowed = evaluateNotificationInsertRLS(freeUserId, {
        user_id: freeUserId,
        title: 'Morning Reminder',
        message: 'Scheduled training',
        notification_style: 'basic',
        is_active: true,
      });
      expect(notifAllowed).toBe(true);

      const notifUpdateAllowed = evaluateNotificationUpdateRLS(freeUserId, {
        id: 'notif-free-1',
        user_id: freeUserId,
        title: 'Updated Morning Reminder',
        message: 'Workout time',
        notification_style: 'basic',
        is_active: true,
      });
      expect(notifUpdateAllowed).toBe(true);
    });
  });
});
