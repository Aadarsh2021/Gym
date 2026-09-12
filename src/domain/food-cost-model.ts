import { BudgetPlannerConfig, BudgetFeasibilityResult } from '@/types/nutrition.types';


/**
 * Standard Indian Commodity Retail Benchmark Rates (INR per standard catalog serving).
 * Clearly documented as realistic estimates based on Indian grocery and market averages.
 * Does NOT pretend to be real-time live API pricing.
 */
export const INDIAN_FOOD_ESTIMATED_COSTS: Record<string, { costPerServingInr: number; category: string; benchmarkUnit: string }> = {
  // Eggs & Poultry
  'f-4': { costPerServingInr: 7, category: 'Poultry', benchmarkUnit: '1 egg' }, // Boiled Whole Egg
  'f-egg-white': { costPerServingInr: 6, category: 'Poultry', benchmarkUnit: '1 white' },
  'f-5': { costPerServingInr: 36, category: 'Poultry', benchmarkUnit: '100g raw chicken breast' }, // Chicken Breast

  // Dairy
  'f-1': { costPerServingInr: 42, category: 'Dairy', benchmarkUnit: '100g paneer' }, // Paneer
  'f-2': { costPerServingInr: 45, category: 'Dairy', benchmarkUnit: '100g low-fat paneer' }, // Low-Fat Paneer
  'f-9': { costPerServingInr: 12, category: 'Dairy', benchmarkUnit: '100g curd' }, // Curd / Dahi
  'f-curd-lowfat': { costPerServingInr: 14, category: 'Dairy', benchmarkUnit: '100g low-fat dahi' },
  'f-milk': { costPerServingInr: 15, category: 'Dairy', benchmarkUnit: '1 glass (250ml) toned milk' },

  // Plant Proteins & Legumes (High Protein per Rupee)
  'f-3': { costPerServingInr: 12, category: 'Soy', benchmarkUnit: '100g dry soya chunks' }, // Soya Chunks (52g P for ₹12!)
  'f-6': { costPerServingInr: 15, category: 'Pulses', benchmarkUnit: '100g raw moong dal' },
  'f-7': { costPerServingInr: 14, category: 'Pulses', benchmarkUnit: '1 katori cooked dal' }, // Cooked Dal
  'f-14': { costPerServingInr: 15, category: 'Pulses', benchmarkUnit: '50g sattu' }, // Sattu (Roasted Chana Flour)
  'f-rajma': { costPerServingInr: 16, category: 'Pulses', benchmarkUnit: '100g raw rajma' },
  'f-chana': { costPerServingInr: 14, category: 'Pulses', benchmarkUnit: '100g raw kala chana' },
  'f-tofu': { costPerServingInr: 30, category: 'Soy', benchmarkUnit: '100g firm tofu' },

  // Cereals & Staples
  'f-8': { costPerServingInr: 5, category: 'Cereals', benchmarkUnit: '1 medium roti' }, // Whole Wheat Roti
  'f-10': { costPerServingInr: 18, category: 'Cereals', benchmarkUnit: '50g rolled oats' }, // Rolled Oats
  'f-13': { costPerServingInr: 8, category: 'Cereals', benchmarkUnit: '1 katori cooked white rice' }, // White Rice
  'f-rice-brown': { costPerServingInr: 12, category: 'Cereals', benchmarkUnit: '1 katori cooked brown rice' },
  'f-poha': { costPerServingInr: 10, category: 'Cereals', benchmarkUnit: '50g poha' },

  // Supplements & Produce
  'f-11': { costPerServingInr: 75, category: 'Supplements', benchmarkUnit: '1 scoop (30g) 80% whey' }, // Whey Protein
  'f-12': { costPerServingInr: 10, category: 'Vegetables', benchmarkUnit: '1 plate salad' }, // Green Salad
  'f-pb': { costPerServingInr: 18, category: 'Nuts', benchmarkUnit: '32g peanut butter' },
  'f-almonds': { costPerServingInr: 28, category: 'Nuts', benchmarkUnit: '28g almonds' },
};

/**
 * Fallback name-based resolver for foods that may not match hardcoded IDs.
 */
export function getEstimatedCostPerServing(foodId: string, foodName = ''): number {
  if (INDIAN_FOOD_ESTIMATED_COSTS[foodId]) {
    return INDIAN_FOOD_ESTIMATED_COSTS[foodId].costPerServingInr;
  }

  const name = foodName.toLowerCase();
  if (name.includes('egg white')) return 6;
  if (name.includes('egg')) return 7;
  if (name.includes('chicken')) return 36;
  if (name.includes('soya')) return 12;
  if (name.includes('sattu')) return 15;
  if (name.includes('paneer')) return 42;
  if (name.includes('whey')) return 75;
  if (name.includes('roti') || name.includes('chapati')) return 5;
  if (name.includes('dal')) return 14;
  if (name.includes('rice')) return 8;
  if (name.includes('curd') || name.includes('dahi')) return 12;
  if (name.includes('oats')) return 18;
  if (name.includes('salad')) return 10;
  if (name.includes('tofu')) return 30;
  if (name.includes('almond')) return 28;

  return 15; // default modest standard serving estimate
}

/**
 * Calculates estimated daily, weekly, and monthly cost in INR for a list of meal items.
 */
export function calculatePlanEstimatedCost(
  items: Array<{ foodId?: string; foodName: string; servings: number }>,
  period: 'weekly' | 'monthly' = 'weekly'
): { dailyCost: number; weeklyCost: number; monthlyCost: number; costForPeriod: number } {
  const dailyCost = items.reduce((acc, item) => {
    const costPerServing = getEstimatedCostPerServing(item.foodId || '', item.foodName);
    return acc + Math.round(costPerServing * item.servings * 10) / 10;
  }, 0);

  const roundedDaily = Math.round(dailyCost);
  const weeklyCost = Math.round(roundedDaily * 7);
  const monthlyCost = Math.round(roundedDaily * 30);
  const costForPeriod = period === 'weekly' ? weeklyCost : monthlyCost;

  return {
    dailyCost: roundedDaily,
    weeklyCost,
    monthlyCost,
    costForPeriod,
  };
}

/**
 * Evaluates whether a proposed budget (weekly or monthly) is feasible for the target calories and protein.
 * If impossible/overly tight, explains the exact constraint conflict instead of silently violating it.
 */
export function evaluateBudgetFeasibility(config: BudgetPlannerConfig): BudgetFeasibilityResult {
  const { budgetInr, period, targetCalories, targetProteinG, dietaryPreference } = config;

  // Minimum realistic weekly grocery cost in India for 1800-2400 kcal & protein targets

  // Using high-efficiency Indian staples (Soya chunks, Sattu, Eggs, Dal, Roti, Rice)
  let minWeeklyBaseline = 1050; // ~₹150/day minimum for adequate whole foods & ~100-120g protein
  if (targetProteinG > 140) minWeeklyBaseline = 1350;
  if (targetProteinG > 175) minWeeklyBaseline = 1600;

  if (dietaryPreference === 'non_veg') {
    // Non-veg usually slightly higher unless purely egg-based
    minWeeklyBaseline = Math.round(minWeeklyBaseline * 1.08);
  } else if (dietaryPreference === 'vegan') {
    // Vegan relying on Soya Chunks & Sattu is extremely cost-effective
    minWeeklyBaseline = Math.round(minWeeklyBaseline * 0.92);
  }

  const minPeriodBaseline = period === 'monthly' ? Math.round(minWeeklyBaseline * 30 / 7) : minWeeklyBaseline;

  if (budgetInr < minPeriodBaseline) {
    const periodLabel = period === 'weekly' ? 'week' : 'month';
    return {
      isFeasible: false,
      budgetInr,
      period,
      estimatedCostInr: minPeriodBaseline,
      remainingInr: budgetInr - minPeriodBaseline,
      recommendedBudgetInr: minPeriodBaseline,
      conflictExplanation: `Your ₹${budgetInr.toLocaleString('en-IN')}/${periodLabel} budget is below the minimum estimated cost of ₹${minPeriodBaseline.toLocaleString('en-IN')}/${periodLabel} required to hit ${targetProteinG}g protein and ${targetCalories} kcal with wholesome Indian foods.`,
      costSavingTips: [
        'Prioritize raw Soya Chunks (₹12/100g) which deliver 52g protein at minimal cost.',
        'Use Sattu (Roasted Chana Flour) and whole Boiled Eggs for budget-efficient daytime protein.',
        'Replace expensive paneer or supplements with home-set curd and cooked lentils/dal.',
      ],
    };
  }

  // Budget is feasible - estimate typical compliant plan cost (usually 85-95% of budget or baseline)
  const estimatedCostInr = Math.min(budgetInr, Math.max(minPeriodBaseline, Math.round(budgetInr * 0.92)));
  const remainingInr = budgetInr - estimatedCostInr;

  return {
    isFeasible: true,
    budgetInr,
    period,
    estimatedCostInr,
    remainingInr,
    costSavingTips: [
      'Staples like Whole Wheat Roti, Moong Dal, and Eggs keep your daily cost low.',
      'Soya Chunks provide the highest protein-per-rupee ratio in India.',
    ],
  };
}

export interface CostContribution {
  foodName: string;
  category: string;
  servingsPerDay: number;
  costPerDayInr: number;
  costForPeriodInr: number;
  percentOfTotal: number;
}

/**
 * Breaks down estimated meal plan costs by major food items/categories
 * e.g. Paneer, Soya, Dal, Rice, Roti, Curd, Eggs, Other
 */
export function calculateCostBreakdownByFood(
  items: Array<{ foodId?: string; foodName: string; servings: number }>,
  period: 'weekly' | 'monthly' = 'weekly'
): CostContribution[] {
  const periodMultiplier = period === 'weekly' ? 7 : 30.4;
  const foodMap: Record<string, { foodName: string; category: string; totalServings: number; costPerDay: number }> = {};

  items.forEach(it => {
    const costPerServing = getEstimatedCostPerServing(it.foodId || '', it.foodName);
    const key = it.foodName;
    const cat = INDIAN_FOOD_ESTIMATED_COSTS[it.foodId || '']?.category || 'Staples';

    if (!foodMap[key]) {
      foodMap[key] = {
        foodName: it.foodName,
        category: cat,
        totalServings: 0,
        costPerDay: 0,
      };
    }
    foodMap[key].totalServings += it.servings;
    foodMap[key].costPerDay += costPerServing * it.servings;
  });

  const totalDailyCost = Object.values(foodMap).reduce((sum, f) => sum + f.costPerDay, 0);

  return Object.values(foodMap)
    .map(f => {
      const costForPeriod = Math.round(f.costPerDay * periodMultiplier);
      const percent = totalDailyCost > 0 ? Math.round((f.costPerDay / totalDailyCost) * 100) : 0;
      return {
        foodName: f.foodName,
        category: f.category,
        servingsPerDay: Math.round(f.totalServings * 10) / 10,
        costPerDayInr: Math.round(f.costPerDay),
        costForPeriodInr: costForPeriod,
        percentOfTotal: percent,
      };
    })
    .sort((a, b) => b.costForPeriodInr - a.costForPeriodInr);
}

/**
 * Formats an amount in INR with Indian comma groupings.
 * e.g. 1500 -> "₹1,500"
 */
export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

