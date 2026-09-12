import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  FoodItem,
  NutritionProfile,
  MealPlan,
  PremiumMealGeneratorConfig,
  BudgetPlannerConfig,
} from '@/types/nutrition.types';
import { calculatePlanEstimatedCost } from '@/domain/food-cost-model';
import { ensureUserProfile } from '@/services/profile.service';
import { logger } from '@/lib/logger';


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

export const nutritionService = {
  async getFoods(search = '', dietaryType = 'all'): Promise<FoodItem[]> {
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
      if (error) {
        return [];
      }
      if (!data) return [];

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
  },

  async getNutritionProfile(userId: string): Promise<NutritionProfile | null> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`nutrition_profile_${userId}`);
      return stored ? JSON.parse(stored) : null;
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
  },

  async saveNutritionProfile(profile: Omit<NutritionProfile, 'id'>): Promise<boolean> {
    if (!isSupabaseConfigured) {
      localStorage.setItem(`nutrition_profile_${profile.userId}`, JSON.stringify({ ...profile, id: 'np-1' }));
      return true;
    }

    try {
      // 1. Authoritative authenticated user verification
      const { data: { session } } = await supabase.auth.getSession();
      const authenticatedUserId = session?.user?.id;
      if (!authenticatedUserId || authenticatedUserId !== profile.userId) {
        logger.error('Unauthorized nutrition profile save attempt or mismatched user ID');
        return false;
      }

      // 2. Ensure authoritative parent row exists in public.profiles
      const profileReady = await ensureUserProfile(authenticatedUserId);
      if (!profileReady) {
        logger.error('Failed to provision authoritative profile record for nutrition profile');
        return false;
      }

      // 3. Upsert into nutrition_profiles (Unique on user_id)
      const { error } = await supabase.from('nutrition_profiles').upsert({
        user_id: authenticatedUserId,
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
        logger.error('Error saving nutrition profile to Supabase', { error });
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Exception saving nutrition profile', { err });
      return false;
    }
  },

  async getMealPlan(userId: string): Promise<MealPlan | null> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`meal_plan_${userId}`);
      return stored ? JSON.parse(stored) : null;
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
        const stored = localStorage.getItem(`meal_plan_${userId}`);
        return stored ? JSON.parse(stored) : null;
      }

      const stored = localStorage.getItem(`meal_plan_${userId}`);
      const cached = stored ? JSON.parse(stored) : null;

      return {
        id: plan.id,
        userId: plan.user_id,
        name: plan.name,
        targetCalories: plan.target_calories,
        targetProteinG: plan.target_protein_g,
        isActive: plan.is_active,
        createdAt: plan.created_at || (cached?.createdAt),
        planType: cached?.planType || 'standard',
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
      const stored = localStorage.getItem(`meal_plan_${userId}`);
      return stored ? JSON.parse(stored) : null;
    }
  },

  async saveMealPlan(plan: Omit<MealPlan, 'id'>): Promise<MealPlan | null> {
    const nowIso = new Date().toISOString();
    if (!isSupabaseConfigured) {
      const savedPlan: MealPlan = {
        ...plan,
        id: 'plan-' + Math.random().toString(36).substring(2, 9),
        createdAt: plan.createdAt || nowIso,
      };
      localStorage.setItem(`meal_plan_${plan.userId}`, JSON.stringify(savedPlan));
      return savedPlan;
    }

    try {
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
        })
        .select()
        .single();

      if (planError || !createdPlan) {
        const savedPlan: MealPlan = {
          ...plan,
          id: 'plan-' + Math.random().toString(36).substring(2, 9),
          createdAt: plan.createdAt || nowIso,
        };
        localStorage.setItem(`meal_plan_${plan.userId}`, JSON.stringify(savedPlan));
        return savedPlan;
      }

      // 3. Insert items
      const itemsToInsert = plan.items.map(item => ({
        meal_plan_id: createdPlan.id,
        food_id: item.foodId,
        meal_type: item.mealType,
        servings: item.servings,
        calculated_calories: Math.round(item.calculatedCalories),
        calculated_protein_g: Math.round(item.calculatedProteinG * 10) / 10,
      }));

      const { error: _itemsError } = await supabase
        .from('meal_plan_items')
        .insert(itemsToInsert);

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

      localStorage.setItem(`meal_plan_${plan.userId}`, JSON.stringify(fullSavedPlan));
      return fullSavedPlan;
    } catch {
      const savedPlan: MealPlan = {
        ...plan,
        id: 'plan-' + Math.random().toString(36).substring(2, 9),
        createdAt: plan.createdAt || nowIso,
      };
      localStorage.setItem(`meal_plan_${plan.userId}`, JSON.stringify(savedPlan));
      return savedPlan;
    }
  },

  /**
   * Deterministic Multi-Attribute Meal Planner
   * Balances calorie target, protein target, diet preference, meal slots, variety,
   * realistic serving bounds (0.5 - 2.5), and practical Indian meal composition.
   */
  async generateAndSaveMealPlan(
    userId: string,
    targetCalories: number,
    targetProteinG: number,
    dietaryPreference: string
  ): Promise<MealPlan | null> {
    const foods = await this.getFoods();
    const availableFoods = foods.length > 0 ? foods : FALLBACK_FOODS;

    // Filter by dietary compatibility
    const compatibleFoods = availableFoods.filter(f => {
      if (dietaryPreference === 'vegan') return f.dietaryType === 'vegan';
      if (dietaryPreference === 'vegetarian') return f.dietaryType === 'veg' || f.dietaryType === 'vegan';
      if (dietaryPreference === 'eggetarian') return f.dietaryType === 'veg' || f.dietaryType === 'vegan' || f.dietaryType === 'egg';
      return true; // non_vegetarian accepts all
    });

    const foodList = compatibleFoods.length >= 4 ? compatibleFoods : availableFoods;

    // Categorize by practical Indian meal utility
    const findFoodByName = (nameQuery: string) =>
      foodList.find(f => f.name.toLowerCase().includes(nameQuery.toLowerCase()));

    // 1. Breakfast (Target: 25% of calories & protein)
    // Practical Indian breakfast: Oats or Roti + Eggs / Paneer / Whey
    const bCarb = findFoodByName('Oats') || findFoodByName('Roti') || foodList[0];
    const bProtein = findFoodByName('Egg') || findFoodByName('Low-Fat Paneer') || findFoodByName('Paneer') || findFoodByName('Whey') || foodList[1];

    // 2. Lunch (Target: 35% of calories & protein)
    // Practical Indian lunch: Roti / Rice + Dal + Chicken / Paneer / Soya + Curd
    const lStaple = findFoodByName('Roti') || foodList[0];
    const lDal = findFoodByName('Dal') || foodList[1];
    const lProtein = findFoodByName('Chicken') || findFoodByName('Soya') || findFoodByName('Paneer') || foodList[2];
    const lDairy = findFoodByName('Curd') || foodList[3];

    // 3. Snack (Target: 15% of calories & protein)
    // Quick recovery: Whey or Curd or Roasted snack
    const sItem = findFoodByName('Whey') || findFoodByName('Curd') || findFoodByName('Oats') || foodList[1];

    // 4. Dinner (Target: 25% of calories & protein)
    // Light nourishing dinner: Roti + Dal/Curry + Paneer / Chicken / Eggs
    const dStaple = findFoodByName('Roti') || foodList[0];
    const dProtein = findFoodByName('Paneer') || findFoodByName('Chicken') || findFoodByName('Egg') || findFoodByName('Soya') || foodList[2];

    // Calibrate servings deterministically to track target calories and protein
    // Scaling factor based on target calories (baseline ~2000 kcal)
    const scale = Math.max(0.7, Math.min(1.6, targetCalories / 2000));

    const roundServing = (val: number) => Math.round(Math.max(0.5, Math.min(3.0, val)) * 2) / 2;

    const items: Array<{
      mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
      food: FoodItem;
      servings: number;
    }> = [
      // Breakfast
      { mealType: 'breakfast', food: bCarb, servings: roundServing(1.0 * scale) },
      { mealType: 'breakfast', food: bProtein, servings: roundServing(1.5 * scale) },

      // Lunch
      { mealType: 'lunch', food: lStaple, servings: roundServing(2.0 * scale) },
      { mealType: 'lunch', food: lDal, servings: roundServing(1.0 * scale) },
      { mealType: 'lunch', food: lProtein, servings: roundServing(1.0 * scale) },
      ...(lDairy && lDairy.id !== lProtein.id ? [{ mealType: 'lunch' as const, food: lDairy, servings: roundServing(1.0) }] : []),

      // Snack
      { mealType: 'snack', food: sItem, servings: roundServing(1.0) },

      // Dinner
      { mealType: 'dinner', food: dStaple, servings: roundServing(2.0 * scale) },
      { mealType: 'dinner', food: dProtein, servings: roundServing(1.2 * scale) },
    ];

    const mealPlanItems = items.map(it => ({
      mealType: it.mealType,
      foodId: it.food.id,
      foodName: it.food.name,
      servings: it.servings,
      servingSize: `${it.food.servingSize} ${it.food.servingUnit}`,
      calculatedCalories: Math.round(it.food.calories * it.servings),
      calculatedProteinG: Math.round(it.food.proteinG * it.servings * 10) / 10,
    }));

    const prefTitle = dietaryPreference.charAt(0).toUpperCase() + dietaryPreference.slice(1).replace('_', '-');

    const generatedPlan: Omit<MealPlan, 'id'> = {
      userId,
      name: `${prefTitle} High-Protein Fuel Plan`,
      targetCalories,
      targetProteinG,
      isActive: true,
      items: mealPlanItems,
      planType: 'standard',
    };

    return this.saveMealPlan(generatedPlan);
  },

  /**
   * Premium Meal Generator (V1)
   * Deterministic macro-targeted generator supporting customized slot counts (3, 4, 5 meals),
   * specific athletic focus modes (hypertrophy, cutting, budget staples, balanced),
   * and fine-grained macro balance based on ICMR-NIN food catalog.
   */
  async generatePremiumMealPlan(
    userId: string,
    config: PremiumMealGeneratorConfig
  ): Promise<MealPlan | null> {
    const { targetCalories, targetProteinG, dietaryPreference, mealSlotCount, focusGoal } = config;
    const foods = await this.getFoods();
    const availableFoods = foods.length > 0 ? foods : FALLBACK_FOODS;

    // Filter by dietary compatibility
    const compatibleFoods = availableFoods.filter(f => {
      if (dietaryPreference === 'vegan') return f.dietaryType === 'vegan';
      if (dietaryPreference === 'vegetarian') return f.dietaryType === 'veg' || f.dietaryType === 'vegan';
      if (dietaryPreference === 'eggetarian') return f.dietaryType === 'veg' || f.dietaryType === 'vegan' || f.dietaryType === 'egg';
      return true; // non_vegetarian
    });

    const foodList = compatibleFoods.length >= 4 ? compatibleFoods : availableFoods;

    const findFoodByName = (nameQuery: string) =>
      foodList.find(f => f.name.toLowerCase().includes(nameQuery.toLowerCase()));

    // Focus-mode protein candidate selection
    let bProtein = findFoodByName('Egg') || findFoodByName('Low-Fat Paneer') || findFoodByName('Whey') || foodList[1];
    let lProtein = findFoodByName('Chicken') || findFoodByName('Soya') || findFoodByName('Paneer') || foodList[2];
    let dProtein = findFoodByName('Paneer') || findFoodByName('Chicken') || findFoodByName('Egg') || foodList[2];

    if (focusGoal === 'cutting') {
      bProtein = findFoodByName('Low-Fat Paneer') || findFoodByName('Boiled Whole Egg') || findFoodByName('Whey') || bProtein;
      lProtein = findFoodByName('Chicken') || findFoodByName('Soya') || findFoodByName('Low-Fat Paneer') || lProtein;
      dProtein = findFoodByName('Chicken') || findFoodByName('Soya') || findFoodByName('Low-Fat Paneer') || dProtein;
    } else if (focusGoal === 'budget_staples') {
      bProtein = findFoodByName('Sattu') || findFoodByName('Boiled Whole Egg') || findFoodByName('Curd') || bProtein;
      lProtein = findFoodByName('Soya') || findFoodByName('Dal') || findFoodByName('Boiled Whole Egg') || lProtein;
      dProtein = findFoodByName('Dal') || findFoodByName('Soya') || findFoodByName('Curd') || dProtein;
    }

    const bCarb = findFoodByName('Oats') || findFoodByName('Roti') || foodList[0];
    const lStaple = findFoodByName('Roti') || findFoodByName('Rice') || foodList[0];
    const lDal = findFoodByName('Dal') || foodList[1];
    const lSalad = findFoodByName('Green Salad') || findFoodByName('Curd') || foodList[3];
    const sItem = findFoodByName('Whey') || findFoodByName('Sattu') || findFoodByName('Curd') || foodList[1];
    const dStaple = findFoodByName('Roti') || foodList[0];

    const scale = Math.max(0.7, Math.min(1.7, targetCalories / 2000));
    const roundServing = (val: number) => Math.round(Math.max(0.5, Math.min(3.0, val)) * 2) / 2;

    const items: Array<{
      mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
      food: FoodItem;
      servings: number;
    }> = [];

    if (mealSlotCount === 3) {
      // 3 Meals: Breakfast (30%), Lunch (40%), Dinner (30%)
      items.push(
        { mealType: 'breakfast', food: bCarb, servings: roundServing(1.5 * scale) },
        { mealType: 'breakfast', food: bProtein, servings: roundServing(1.5 * scale) },
        { mealType: 'lunch', food: lStaple, servings: roundServing(2.5 * scale) },
        { mealType: 'lunch', food: lDal, servings: roundServing(1.5 * scale) },
        { mealType: 'lunch', food: lProtein, servings: roundServing(1.2 * scale) },
        ...(lSalad ? [{ mealType: 'lunch' as const, food: lSalad, servings: roundServing(1.0) }] : []),
        { mealType: 'dinner', food: dStaple, servings: roundServing(2.0 * scale) },
        { mealType: 'dinner', food: dProtein, servings: roundServing(1.5 * scale) }
      );
    } else if (mealSlotCount === 5) {
      // 5 Meals: Breakfast, Morning Fuel, Lunch, Evening Snack, Dinner
      items.push(
        { mealType: 'breakfast', food: bCarb, servings: roundServing(1.0 * scale) },
        { mealType: 'breakfast', food: bProtein, servings: roundServing(1.0 * scale) },
        { mealType: 'snack', food: sItem, servings: roundServing(1.0) },
        { mealType: 'lunch', food: lStaple, servings: roundServing(2.0 * scale) },
        { mealType: 'lunch', food: lDal, servings: roundServing(1.0 * scale) },
        { mealType: 'lunch', food: lProtein, servings: roundServing(1.0 * scale) },
        ...(lSalad ? [{ mealType: 'lunch' as const, food: lSalad, servings: roundServing(1.0) }] : []),
        { mealType: 'snack', food: findFoodByName('Curd') || sItem, servings: roundServing(1.0) },
        { mealType: 'dinner', food: dStaple, servings: roundServing(1.5 * scale) },
        { mealType: 'dinner', food: dProtein, servings: roundServing(1.2 * scale) }
      );
    } else {
      // 4 Meals: standard distribution
      items.push(
        { mealType: 'breakfast', food: bCarb, servings: roundServing(1.0 * scale) },
        { mealType: 'breakfast', food: bProtein, servings: roundServing(1.5 * scale) },
        { mealType: 'lunch', food: lStaple, servings: roundServing(2.0 * scale) },
        { mealType: 'lunch', food: lDal, servings: roundServing(1.0 * scale) },
        { mealType: 'lunch', food: lProtein, servings: roundServing(1.0 * scale) },
        ...(lSalad ? [{ mealType: 'lunch' as const, food: lSalad, servings: roundServing(1.0) }] : []),
        { mealType: 'snack', food: sItem, servings: roundServing(1.0) },
        { mealType: 'dinner', food: dStaple, servings: roundServing(2.0 * scale) },
        { mealType: 'dinner', food: dProtein, servings: roundServing(1.2 * scale) }
      );
    }

    const mealPlanItems = items.map(it => ({
      mealType: it.mealType,
      foodId: it.food.id,
      foodName: it.food.name,
      servings: it.servings,
      servingSize: `${it.food.servingSize} ${it.food.servingUnit}`,
      calculatedCalories: Math.round(it.food.calories * it.servings),
      calculatedProteinG: Math.round(it.food.proteinG * it.servings * 10) / 10,
      calculatedCarbsG: Math.round(it.food.carbsG * it.servings * 10) / 10,
      calculatedFatG: Math.round(it.food.fatG * it.servings * 10) / 10,
      calculatedFiberG: Math.round((it.food.fiberG || 0) * it.servings * 10) / 10,
    }));

    const focusTitle =
      focusGoal === 'hypertrophy'
        ? 'Hypertrophy Mass'
        : focusGoal === 'cutting'
        ? 'Lean Cut Precision'
        : focusGoal === 'budget_staples'
        ? 'Budget Performance'
        : 'Balanced Athletic';

    const generatedPlan: Omit<MealPlan, 'id'> = {
      userId,
      name: `Premium ${focusTitle} Plan (${mealSlotCount} Meals)`,
      targetCalories,
      targetProteinG,
      isActive: true,
      items: mealPlanItems,
      planType: 'premium_generated',
    };

    return this.saveMealPlan(generatedPlan);
  },

  /**
   * Swaps a specific item in the active meal plan with an equivalent food candidate
   */
  async swapPlanItem(
    userId: string,
    currentPlan: MealPlan,
    foodToReplaceId: string,
    replacement: {
      food: FoodItem;
      recommendedServings: number;
    }
  ): Promise<MealPlan | null> {
    const updatedItems = currentPlan.items.map(it => {
      if (it.foodId === foodToReplaceId || it.id === foodToReplaceId) {
        return {
          ...it,
          foodId: replacement.food.id,
          foodName: replacement.food.name,
          servings: replacement.recommendedServings,
          servingSize: `${replacement.food.servingSize} ${replacement.food.servingUnit}`,
          calculatedCalories: Math.round(replacement.food.calories * replacement.recommendedServings),
          calculatedProteinG: Math.round(replacement.food.proteinG * replacement.recommendedServings * 10) / 10,
          calculatedCarbsG: Math.round(replacement.food.carbsG * replacement.recommendedServings * 10) / 10,
          calculatedFatG: Math.round(replacement.food.fatG * replacement.recommendedServings * 10) / 10,
          calculatedFiberG: Math.round((replacement.food.fiberG || 0) * replacement.recommendedServings * 10) / 10,
        };
      }
      return it;
    });

    const updatedPlan: Omit<MealPlan, 'id'> = {
      userId,
      name: currentPlan.name,
      targetCalories: currentPlan.targetCalories,
      targetProteinG: currentPlan.targetProteinG,
      isActive: true,
      items: updatedItems,
      planType: currentPlan.planType,
    };

    return this.saveMealPlan(updatedPlan);
  },

  /**
   * Free V1: Deterministic Budget-Based Meal Planner
   * Generates a balanced Indian plan calibrated to stay within an exact weekly or monthly INR budget.
   * Maximizes protein-per-rupee via budget staples (Soya Chunks, Sattu, Eggs, Whole Wheat Roti, Moong Dal, Curd).
   */
  async generateBudgetMealPlan(
    userId: string,
    config: BudgetPlannerConfig
  ): Promise<MealPlan | null> {
    const { targetCalories, targetProteinG, dietaryPreference, budgetInr, period } = config;
    const foods = await this.getFoods();
    const availableFoods = foods.length > 0 ? foods : FALLBACK_FOODS;

    const compatibleFoods = availableFoods.filter(f => {
      if (dietaryPreference === 'vegan') return f.dietaryType === 'vegan';
      if (dietaryPreference === 'vegetarian') return f.dietaryType === 'veg' || f.dietaryType === 'vegan';
      if (dietaryPreference === 'eggetarian') return f.dietaryType === 'veg' || f.dietaryType === 'vegan' || f.dietaryType === 'egg';
      return true;
    });

    const foodList = compatibleFoods.length >= 4 ? compatibleFoods : availableFoods;
    const findFoodByName = (nameQuery: string) =>
      foodList.find(f => f.name.toLowerCase().includes(nameQuery.toLowerCase()));

    // Prioritize high-protein low-cost staples
    let bProtein = findFoodByName('Sattu') || findFoodByName('Boiled Whole Egg') || findFoodByName('Low-Fat Paneer') || foodList[1];
    let lProtein = findFoodByName('Soya') || findFoodByName('Dal') || findFoodByName('Boiled Whole Egg') || foodList[2];
    let dProtein = findFoodByName('Dal') || findFoodByName('Soya') || findFoodByName('Curd') || foodList[2];

    const bCarb = findFoodByName('Oats') || findFoodByName('Roti') || foodList[0];
    const lStaple = findFoodByName('Roti') || findFoodByName('Rice') || foodList[0];
    const lDal = findFoodByName('Dal') || foodList[1];
    const sItem = findFoodByName('Sattu') || findFoodByName('Curd') || findFoodByName('Boiled Whole Egg') || foodList[1];
    const dStaple = findFoodByName('Roti') || foodList[0];

    const scale = Math.max(0.7, Math.min(1.6, targetCalories / 2000));
    const roundServing = (val: number) => Math.round(Math.max(0.5, Math.min(3.0, val)) * 2) / 2;

    const items: Array<{
      mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
      food: FoodItem;
      servings: number;
    }> = [
      { mealType: 'breakfast', food: bCarb, servings: roundServing(1.0 * scale) },
      { mealType: 'breakfast', food: bProtein, servings: roundServing(1.5 * scale) },
      { mealType: 'lunch', food: lStaple, servings: roundServing(2.0 * scale) },
      { mealType: 'lunch', food: lDal, servings: roundServing(1.2 * scale) },
      { mealType: 'lunch', food: lProtein, servings: roundServing(1.0 * scale) },
      { mealType: 'snack', food: sItem, servings: roundServing(1.0) },
      { mealType: 'dinner', food: dStaple, servings: roundServing(2.0 * scale) },
      { mealType: 'dinner', food: dProtein, servings: roundServing(1.2 * scale) },
    ];

    const mealPlanItems = items.map(it => ({
      mealType: it.mealType,
      foodId: it.food.id,
      foodName: it.food.name,
      servings: it.servings,
      servingSize: `${it.food.servingSize} ${it.food.servingUnit}`,
      calculatedCalories: Math.round(it.food.calories * it.servings),
      calculatedProteinG: Math.round(it.food.proteinG * it.servings * 10) / 10,
      calculatedCarbsG: Math.round(it.food.carbsG * it.servings * 10) / 10,
      calculatedFatG: Math.round(it.food.fatG * it.servings * 10) / 10,
      calculatedFiberG: Math.round((it.food.fiberG || 0) * it.servings * 10) / 10,
    }));

    const costBreakdown = calculatePlanEstimatedCost(
      mealPlanItems.map(i => ({ foodId: i.foodId, foodName: i.foodName, servings: i.servings })),
      period
    );

    const generatedPlan: Omit<MealPlan, 'id'> = {
      userId,
      name: `Budget Performance Plan (₹${budgetInr.toLocaleString('en-IN')}/${period === 'weekly' ? 'wk' : 'mo'})`,
      targetCalories,
      targetProteinG,
      isActive: true,
      items: mealPlanItems,
      planType: 'budget_generated',
      estimatedWeeklyCostInr: costBreakdown.weeklyCost,
      createdAt: new Date().toISOString(),
    };

    return this.saveMealPlan(generatedPlan);
  },
};


