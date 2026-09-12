import { FoodItem, WeeklyMealPlan, WeeklyMealPlanDay, WeeklyMealPlanItem, MealSlot } from '@/types/nutrition.types';
import { FALLBACK_FOODS } from '@/services/nutrition.service';

export interface WeeklyMealPlanGeneratorOptions {
  userId: string;
  targetCalories: number;
  targetProteinG: number;
  dietaryPreference: string;
  availableFoods?: FoodItem[];
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Deterministic 7-Day Rotating Weekly Meal Planner.
 * Generates an authentic Indian multi-day schedule cycling protein and staple sources.
 * Adheres strictly to ICMR-NIN IFCT verified foods without arbitrary or fabricated numbers.
 */
export function generateWeeklyMealPlan(
  options: WeeklyMealPlanGeneratorOptions
): WeeklyMealPlan {
  const {
    userId,
    targetCalories,
    targetProteinG,
    dietaryPreference,
    availableFoods = FALLBACK_FOODS,
  } = options;

  // Filter food catalog by user's dietary preference
  const compatibleFoods = availableFoods.filter(f => {
    if (dietaryPreference === 'vegan') return f.dietaryType === 'vegan';
    if (dietaryPreference === 'vegetarian') return f.dietaryType === 'veg' || f.dietaryType === 'vegan';
    if (dietaryPreference === 'eggetarian') return f.dietaryType === 'veg' || f.dietaryType === 'vegan' || f.dietaryType === 'egg';
    return true; // non_veg accepts all
  });

  const foodList = compatibleFoods.length >= 4 ? compatibleFoods : availableFoods;

  const findFood = (query: string): FoodItem => {
    const found = foodList.find(f => f.name.toLowerCase().includes(query.toLowerCase()));
    return found || foodList[0];
  };

  const scale = Math.max(0.7, Math.min(1.6, targetCalories / 2000));
  const roundServing = (val: number) => Math.round(Math.max(0.5, Math.min(3.0, val)) * 2) / 2;

  // Rotating menu archetypes for 7 days
  const dayArchetypes = [
    {
      // Monday: Classic High-Protein Vegetarian
      breakfast: [
        { query: 'Oats', servings: 1.0 * scale },
        { query: 'Paneer', servings: 1.0 * scale },
      ],
      lunch: [
        { query: 'Roti', servings: 2.0 * scale },
        { query: 'Moong Dal', servings: 1.0 * scale },
        { query: 'Curd', servings: 1.0 },
      ],
      snack: [
        { query: 'Whey', servings: 1.0 },
      ],
      dinner: [
        { query: 'Roti', servings: 2.0 * scale },
        { query: 'Low-Fat Paneer', servings: 1.2 * scale },
        { query: 'Salad', servings: 1.0 },
      ],
    },
    {
      // Tuesday: Plant-Powered Soya & Rice
      breakfast: [
        { query: 'Sattu', servings: 1.0 * scale },
        { query: 'Oats', servings: 1.0 * scale },
      ],
      lunch: [
        { query: 'Rice', servings: 1.5 * scale },
        { query: 'Soya Chunks', servings: 1.0 * scale },
        { query: 'Dal', servings: 1.0 * scale },
      ],
      snack: [
        { query: 'Curd', servings: 1.0 },
      ],
      dinner: [
        { query: 'Roti', servings: 2.0 * scale },
        { query: 'Moong Dal', servings: 1.2 * scale },
        { query: 'Salad', servings: 1.0 },
      ],
    },
    {
      // Wednesday: Poultry / Eggs or Sattu High-Fiber
      breakfast: [
        { query: dietaryPreference === 'non_veg' || dietaryPreference === 'eggetarian' ? 'Egg' : 'Low-Fat Paneer', servings: 2.0 * scale },
        { query: 'Roti', servings: 1.0 * scale },
      ],
      lunch: [
        { query: 'Roti', servings: 2.0 * scale },
        { query: dietaryPreference === 'non_veg' ? 'Chicken' : 'Paneer', servings: 1.2 * scale },
        { query: 'Dal', servings: 1.0 * scale },
      ],
      snack: [
        { query: 'Whey', servings: 1.0 },
      ],
      dinner: [
        { query: 'Rice', servings: 1.5 * scale },
        { query: 'Moong Dal', servings: 1.2 * scale },
        { query: 'Curd', servings: 1.0 },
      ],
    },
    {
      // Thursday: Lean Dairy & Wholesome Lentils
      breakfast: [
        { query: 'Oats', servings: 1.0 * scale },
        { query: 'Low-Fat Paneer', servings: 1.2 * scale },
      ],
      lunch: [
        { query: 'Roti', servings: 2.0 * scale },
        { query: 'Moong Dal', servings: 1.2 * scale },
        { query: 'Curd', servings: 1.0 },
      ],
      snack: [
        { query: 'Sattu', servings: 1.0 },
      ],
      dinner: [
        { query: 'Roti', servings: 2.0 * scale },
        { query: 'Soya Chunks', servings: 1.0 * scale },
        { query: 'Salad', servings: 1.0 },
      ],
    },
    {
      // Friday: Hypertrophy Fuel (Poultry / High-Density Soya)
      breakfast: [
        { query: dietaryPreference === 'non_veg' || dietaryPreference === 'eggetarian' ? 'Egg' : 'Paneer', servings: 2.0 * scale },
        { query: 'Oats', servings: 1.0 * scale },
      ],
      lunch: [
        { query: 'Rice', servings: 2.0 * scale },
        { query: dietaryPreference === 'non_veg' ? 'Chicken' : 'Soya Chunks', servings: 1.5 * scale },
        { query: 'Dal', servings: 1.0 * scale },
      ],
      snack: [
        { query: 'Whey', servings: 1.0 },
      ],
      dinner: [
        { query: 'Roti', servings: 2.0 * scale },
        { query: 'Low-Fat Paneer', servings: 1.2 * scale },
        { query: 'Curd', servings: 1.0 },
      ],
    },
    {
      // Saturday: High-Density Mixed Rotation
      breakfast: [
        { query: 'Sattu', servings: 1.0 * scale },
        { query: 'Low-Fat Paneer', servings: 1.0 * scale },
      ],
      lunch: [
        { query: 'Roti', servings: 2.0 * scale },
        { query: 'Moong Dal', servings: 1.2 * scale },
        { query: 'Curd', servings: 1.0 },
        { query: 'Salad', servings: 1.0 },
      ],
      snack: [
        { query: 'Whey', servings: 1.0 },
      ],
      dinner: [
        { query: 'Rice', servings: 1.5 * scale },
        { query: dietaryPreference === 'non_veg' ? 'Chicken' : 'Paneer', servings: 1.2 * scale },
        { query: 'Dal', servings: 1.0 * scale },
      ],
    },
    {
      // Sunday: Recovery & Sustained Vitality
      breakfast: [
        { query: 'Oats', servings: 1.0 * scale },
        { query: 'Curd', servings: 1.0 },
        { query: dietaryPreference === 'non_veg' || dietaryPreference === 'eggetarian' ? 'Egg' : 'Paneer', servings: 1.5 * scale },
      ],
      lunch: [
        { query: 'Roti', servings: 2.5 * scale },
        { query: 'Dal', servings: 1.2 * scale },
        { query: 'Low-Fat Paneer', servings: 1.2 * scale },
      ],
      snack: [
        { query: 'Whey', servings: 1.0 },
      ],
      dinner: [
        { query: 'Rice', servings: 1.5 * scale },
        { query: 'Moong Dal', servings: 1.0 * scale },
        { query: 'Salad', servings: 1.0 },
      ],
    },
  ];

  const planId = 'wmp-' + Math.random().toString(36).substring(2, 9);
  const days: WeeklyMealPlanDay[] = [];

  for (let i = 0; i < 7; i++) {
    const dayOfWeek = i + 1;
    const dayName = DAY_NAMES[i];
    const arch = dayArchetypes[i];
    const dayId = `${planId}-d${dayOfWeek}`;

    const items: WeeklyMealPlanItem[] = [];

    const processMeal = (mealSlot: MealSlot, list: Array<{ query: string; servings: number }>) => {
      list.forEach((entry) => {
        const food = findFood(entry.query);
        const servings = roundServing(entry.servings);
        const calculatedCalories = Math.round(food.calories * servings);
        const calculatedProteinG = Math.round(food.proteinG * servings * 10) / 10;
        const calculatedCarbsG = Math.round(food.carbsG * servings * 10) / 10;
        const calculatedFatG = Math.round(food.fatG * servings * 10) / 10;

        items.push({
          id: `${dayId}-i${items.length + 1}`,
          foodId: food.id,
          foodName: food.name,
          mealType: mealSlot,
          servings,
          calculatedCalories,
          calculatedProteinG,
          calculatedCarbsG,
          calculatedFatG,
          food,
        });
      });
    };

    processMeal('breakfast', arch.breakfast);
    processMeal('lunch', arch.lunch);
    processMeal('snack', arch.snack);
    processMeal('dinner', arch.dinner);

    const totalCalories = items.reduce((sum, item) => sum + item.calculatedCalories, 0);
    const totalProteinG = Math.round(items.reduce((sum, item) => sum + item.calculatedProteinG, 0) * 10) / 10;
    const totalCarbsG = Math.round(items.reduce((sum, item) => sum + (item.calculatedCarbsG || 0), 0) * 10) / 10;
    const totalFatG = Math.round(items.reduce((sum, item) => sum + (item.calculatedFatG || 0), 0) * 10) / 10;

    days.push({
      id: dayId,
      dayOfWeek,
      dayName,
      targetCalories,
      targetProteinG,
      items,
      totalCalories,
      totalProteinG,
      totalCarbsG,
      totalFatG,
    });
  }

  const averageDailyCalories = Math.round(days.reduce((sum, d) => sum + d.totalCalories, 0) / 7);
  const averageDailyProteinG = Math.round((days.reduce((sum, d) => sum + d.totalProteinG, 0) / 7) * 10) / 10;

  return {
    id: planId,
    userId,
    name: '7-Day High-Protein Rotation',
    targetCalories,
    targetProteinG,
    isActive: true,
    createdAt: new Date().toISOString(),
    days,
    averageDailyCalories,
    averageDailyProteinG,
  };
}
