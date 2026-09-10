import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { FoodItem, NutritionProfile, MealPlan } from '@/types/nutrition.types';

export const FALLBACK_FOODS: FoodItem[] = [
  { id: 'f-1', name: 'Paneer (Cottage Cheese)', servingSize: '100', servingUnit: 'g', calories: 265, proteinG: 18.3, carbsG: 3.4, fatG: 20.8, dietaryType: 'veg', source: 'ICMR-NIN Indian Food Composition Tables (IFCT)', sourceReference: 'Dairy D004', isVerified: true },
  { id: 'f-2', name: 'Low-Fat Paneer', servingSize: '100', servingUnit: 'g', calories: 160, proteinG: 24.0, carbsG: 4.0, fatG: 5.0, dietaryType: 'veg', source: 'ICMR-NIN IFCT', sourceReference: 'Dairy D005', isVerified: true },
  { id: 'f-3', name: 'Soya Chunks (Raw / Uncooked)', servingSize: '100', servingUnit: 'g', calories: 345, proteinG: 52.0, carbsG: 33.0, fatG: 0.5, dietaryType: 'vegan', source: 'ICMR-NIN IFCT', sourceReference: 'Legumes L042', isVerified: true },
  { id: 'f-4', name: 'Boiled Whole Egg', servingSize: '1', servingUnit: 'piece (50g)', calories: 74, proteinG: 6.3, carbsG: 0.4, fatG: 5.0, dietaryType: 'egg', source: 'ICMR-NIN IFCT', sourceReference: 'Poultry P001', isVerified: true },
  { id: 'f-5', name: 'Chicken Breast (Skinless, Raw)', servingSize: '100', servingUnit: 'g', calories: 120, proteinG: 22.5, carbsG: 0.0, fatG: 2.6, dietaryType: 'non_veg', source: 'ICMR-NIN IFCT', sourceReference: 'Poultry P012', isVerified: true },
  { id: 'f-6', name: 'Moong Dal (Raw)', servingSize: '100', servingUnit: 'g', calories: 348, proteinG: 24.0, carbsG: 60.0, fatG: 1.2, dietaryType: 'veg', source: 'ICMR-NIN IFCT', sourceReference: 'Pulses P020', isVerified: true },
  { id: 'f-7', name: 'Cooked Dal (Standard Tadka)', servingSize: '1', servingUnit: 'katori (150g)', calories: 140, proteinG: 7.5, carbsG: 18.0, fatG: 4.5, dietaryType: 'veg', source: 'ICMR-NIN Cooked Composite Reference', sourceReference: 'Standard', isVerified: true },
  { id: 'f-8', name: 'Roti / Chapati (Whole Wheat, No Oil)', servingSize: '1', servingUnit: 'medium (35g)', calories: 85, proteinG: 3.1, carbsG: 17.5, fatG: 0.5, dietaryType: 'veg', source: 'ICMR-NIN IFCT', sourceReference: 'Cereal C002', isVerified: true },
  { id: 'f-9', name: 'Curd / Dahi (Plain Whole Milk)', servingSize: '100', servingUnit: 'g', calories: 98, proteinG: 4.3, carbsG: 5.0, fatG: 6.5, dietaryType: 'veg', source: 'ICMR-NIN IFCT', sourceReference: 'Dairy D002', isVerified: true },
  { id: 'f-10', name: 'Rolled Oats (Raw)', servingSize: '50', servingUnit: 'g', calories: 190, proteinG: 6.8, carbsG: 33.0, fatG: 3.5, dietaryType: 'vegan', source: 'ICMR-NIN IFCT', sourceReference: 'Cereals C030', isVerified: true },
  { id: 'f-11', name: 'Whey Protein Concentrate (80%)', servingSize: '30', servingUnit: 'g (1 scoop)', calories: 120, proteinG: 24.0, carbsG: 2.0, fatG: 1.5, dietaryType: 'veg', source: 'Standard Nutritional Analysis Certificate', sourceReference: 'Supplements', isVerified: true },
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
      if (error || !data || data.length === 0) {
        return FALLBACK_FOODS.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
      }

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
      return FALLBACK_FOODS;
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

      return !error;
    } catch {
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

      if (error || !plan) return null;

      return {
        id: plan.id,
        userId: plan.user_id,
        name: plan.name,
        targetCalories: plan.target_calories,
        targetProteinG: plan.target_protein_g,
        isActive: plan.is_active,
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
      return null;
    }
  },
};
