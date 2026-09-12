import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Utensils,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  X,
  ArrowRightLeft,
  Sparkles,
  DollarSign,
  AlertCircle,
  Sliders,
  Lock,
} from 'lucide-react';

import { nutritionService } from '@/services/nutrition.service';
import { foodDiaryService } from '@/services/food-diary.service';
import { profileService } from '@/services/profile.service';
import { progressService, ProgressEntry } from '@/services/progress.service';
import {
  FoodItem,
  NutritionProfile,
  MealPlan,
  FoodDiaryEntry,
  DailyMacroTotals,
  MealSlot,
  MealReplacementCandidate,
  BudgetPeriod,
} from '@/types/nutrition.types';
import {
  calculatePlanEstimatedCost,
  calculateCostBreakdownByFood,
  evaluateBudgetFeasibility,
  formatInr,
} from '@/domain/food-cost-model';
import { useEntitlement } from '@/hooks/useEntitlement';
import { PremiumLockedSection } from '@/components/PremiumLockedSection';
import { getTodayIST } from '@/utils/date';
import { MixedMealAnalyzerView } from './MixedMealAnalyzerView';
import { MealReplacementModal } from './MealReplacementModal';
import { PremiumMealGeneratorModal } from './PremiumMealGeneratorModal';
import { FoodDetailsModal } from './FoodDetailsModal';
import { MealPlannerModal } from './MealPlannerModal';
import { AdaptiveMealReviewBanner } from './AdaptiveMealReviewBanner';
import { WeeklyMealPlanView } from './WeeklyMealPlanView';

interface NutritionViewProps {
  nutritionProfile: NutritionProfile | null;
  userId?: string;
}

type NutritionTab = 'planner' | 'weekly_plan' | 'diary' | 'budget' | 'mixed_analyzer';

export const NutritionView: React.FC<NutritionViewProps> = ({
  nutritionProfile,
  userId = 'guest-user',
}) => {
  const {
    canAccessBudgetPlanning,
    canAccessMixedMealAnalyzer,
    canAccessMealReplacement,
    canAccessPremiumMealGenerator,
    canAccessDailyNutrientComparison,
    canAccessWeeklyMealPlanning,
  } = useEntitlement();
  const [lockedModalPrompt, setLockedModalPrompt] = useState<{ name: string; description: string } | null>(null);

  const todayStr = getTodayIST();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<NutritionTab>('planner');

  // State
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [diaryEntries, setDiaryEntries] = useState<FoodDiaryEntry[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyMacroTotals>({
    date: todayStr,
    totalCalories: 0,
    totalProteinG: 0,
    totalCarbsG: 0,
    totalFatG: 0,
    entriesCount: 0,
  });
  const [activePlan, setActivePlan] = useState<MealPlan | null>(null);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);

  const [search, setSearch] = useState<string>('');
  const [dietFilter, setDietFilter] = useState<string>('all');
  const [userDietaryPref, setUserDietaryPref] = useState<string>('vegetarian');

  // Quick Log Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [modalSlot, setModalSlot] = useState<MealSlot>('breakfast');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [servings, setServings] = useState<number>(1.0);
  const [customCalories, setCustomCalories] = useState<number>(150);
  const [customProtein, setCustomProtein] = useState<number>(10);
  const [customCarbs, setCustomCarbs] = useState<number>(15);
  const [customFat, setCustomFat] = useState<number>(5);
  const [logging, setLogging] = useState<boolean>(false);
  const [logSuccessMessage, setLogSuccessMessage] = useState<string | null>(null);

  // Food Details Modal State (Free V1 Full Nutrition Analysis)
  const [detailsModalFood, setDetailsModalFood] = useState<FoodItem | null>(null);

  // Free V1 Product Meal Planner Wizard Modal State
  const [isPlannerModalOpen, setIsPlannerModalOpen] = useState<boolean>(false);

  // Meal Replacement Modal State
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState<boolean>(false);
  const [targetFoodForSwap, setTargetFoodForSwap] = useState<FoodItem | null>(null);
  const [targetServingsForSwap, setTargetServingsForSwap] = useState<number>(1.0);
  const [targetFoodIdToSwap, setTargetFoodIdToSwap] = useState<string | null>(null);

  // Premium Meal Generator Modal State
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState<boolean>(false);

  // Budget Tab Controls State
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>('weekly');
  const [budgetAmount, setBudgetAmount] = useState<number>(1500);

  // Load Diary Entries & Totals for Selected Date
  const loadDiary = useCallback(async () => {
    try {
      const [entries, totals] = await Promise.all([
        foodDiaryService.getDiaryEntries(userId, selectedDate),
        foodDiaryService.getDailyMacroTotals(userId, selectedDate),
      ]);
      setDiaryEntries(entries);
      setDailyTotals(totals);
    } catch {
      // Fallback
    }
  }, [userId, selectedDate]);

  // Load Active Meal Plan, Profile & Weight Progress History
  const loadMealPlan = useCallback(async () => {
    try {
      const [plan, profile, progress] = await Promise.all([
        nutritionService.getMealPlan(userId),
        profileService.getFitnessProfile(userId),
        progressService.getProgressEntries(userId),
      ]);
      setActivePlan(plan);
      setProgressEntries(progress);
      if (profile?.dietaryPreference) {
        setUserDietaryPref(profile.dietaryPreference);
      }
    } catch {
      // Fallback
    }
  }, [userId]);

  const handleOpenSwapModal = (foodId: string, foodName: string, servings: number) => {
    const foodObj = foods.find(f => f.id === foodId) || {
      id: foodId,
      name: foodName,
      servingSize: '100',
      servingUnit: 'g',
      calories: 150,
      proteinG: 12,
      carbsG: 15,
      fatG: 5,
      dietaryType: 'veg' as const,
      source: 'Catalog',
      isVerified: true,
    };
    setTargetFoodForSwap(foodObj);
    setTargetServingsForSwap(servings);
    setTargetFoodIdToSwap(foodId);
    setIsReplacementModalOpen(true);
  };

  const handleConfirmSwap = async (candidate: MealReplacementCandidate) => {
    if (!activePlan || !targetFoodIdToSwap) return;
    const updatedPlan = await nutritionService.swapPlanItem(userId, activePlan, targetFoodIdToSwap, {
      food: candidate.food,
      recommendedServings: candidate.recommendedServings,
    });
    if (updatedPlan) {
      setActivePlan(updatedPlan);
      setLogSuccessMessage(`Swapped item for ${candidate.food.name} (${candidate.servingDisplay})!`);
      setTimeout(() => setLogSuccessMessage(null), 3000);
    }
    setIsReplacementModalOpen(false);
    setTargetFoodForSwap(null);
    setTargetFoodIdToSwap(null);
  };

  const handleOpenFoodDetails = (foodId: string, foodName: string) => {
    const found = foods.find(f => f.id === foodId || f.name.toLowerCase() === foodName.toLowerCase());
    if (found) {
      setDetailsModalFood(found);
    } else {
      setDetailsModalFood({
        id: foodId,
        name: foodName,
        servingSize: '100',
        servingUnit: 'g',
        calories: 150,
        proteinG: 12,
        carbsG: 15,
        fatG: 5,
        dietaryType: 'veg',
        source: 'ICMR-NIN Indian Food Composition Tables (IFCT)',
        isVerified: true,
      });
    }
  };

  // Load Catalog Foods
  useEffect(() => {
    async function loadCatalog() {
      const data = await nutritionService.getFoods(search, dietFilter);
      setFoods(data);
    }
    loadCatalog();
  }, [search, dietFilter]);

  useEffect(() => {
    loadDiary();
  }, [loadDiary]);

  useEffect(() => {
    loadMealPlan();
  }, [loadMealPlan]);

  // Open Log Modal for specific slot
  const handleOpenLogModal = (slot: MealSlot, preselectedFood?: FoodItem) => {
    setModalSlot(slot);
    if (preselectedFood) {
      setSelectedFood(preselectedFood);
      setCustomName('');
      setServings(1.0);
    } else {
      setSelectedFood(null);
      setCustomName('');
      setServings(1.0);
    }
    setIsLogModalOpen(true);
  };

  // Submit Food Log
  const handleLogFood = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogging(true);

    try {
      let cal = 0;
      let pro = 0;
      let carb = 0;
      let fat = 0;
      let name = '';

      if (selectedFood) {
        cal = Math.round(selectedFood.calories * servings);
        pro = Math.round(selectedFood.proteinG * servings * 10) / 10;
        carb = Math.round(selectedFood.carbsG * servings * 10) / 10;
        fat = Math.round(selectedFood.fatG * servings * 10) / 10;
        name = selectedFood.name;
      } else {
        cal = Math.round(customCalories * servings);
        pro = Math.round(customProtein * servings * 10) / 10;
        carb = Math.round(customCarbs * servings * 10) / 10;
        fat = Math.round(customFat * servings * 10) / 10;
        name = customName.trim() || 'Custom Food';
      }

      const res = await foodDiaryService.logFoodEntry({
        userId,
        loggedDate: selectedDate,
        mealType: modalSlot,
        foodId: selectedFood?.id || null,
        customFoodName: selectedFood ? null : name,
        foodName: name,
        servings,
        calories: cal,
        proteinG: pro,
        carbsG: carb,
        fatG: fat,
      });

      if (res.success) {
        setIsLogModalOpen(false);
        setSelectedFood(null);
        setCustomName('');
        setLogSuccessMessage(`Logged ${name} to ${modalSlot}!`);
        setTimeout(() => setLogSuccessMessage(null), 3000);
        await loadDiary();
      }
    } catch {
      // Fallback
    } finally {
      setLogging(false);
    }
  };

  // Delete Diary Entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      await foodDiaryService.deleteFoodEntry(userId, entryId, selectedDate);
      await loadDiary();
    } catch {
      // Fallback
    }
  };

  // Log an entire meal from planned items to diary
  const handleLogPlannedMeal = async (slot: MealSlot) => {
    if (!activePlan) return;
    const items = activePlan.items.filter(i => i.mealType === slot);
    if (items.length === 0) return;

    for (const it of items) {
      await foodDiaryService.logFoodEntry({
        userId,
        loggedDate: selectedDate,
        mealType: slot,
        foodId: it.foodId,
        customFoodName: null,
        foodName: it.foodName,
        servings: it.servings,
        calories: it.calculatedCalories,
        proteinG: it.calculatedProteinG,
        carbsG: it.calculatedCarbsG || 0,
        fatG: it.calculatedFatG || 0,
        fiberG: it.calculatedFiberG || 0,
      });
    }

    setLogSuccessMessage(`Logged all ${slot} items to today's diary!`);
    setTimeout(() => setLogSuccessMessage(null), 3000);
    await loadDiary();
  };

  // Target values
  const targetCal = nutritionProfile?.targetCalories || 2150;
  const targetPro = nutritionProfile?.targetProteinG || 150;
  const targetCarb = nutritionProfile?.targetCarbsG || 240;
  const targetFat = nutritionProfile?.targetFatG || 70;
  const targetFibre = 30; // standard daily guideline

  // Planned totals from active meal plan
  const plannedTotals = useMemo(() => {
    if (!activePlan || !activePlan.items) {
      return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
    }
    return activePlan.items.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calculatedCalories,
        proteinG: Math.round((acc.proteinG + item.calculatedProteinG) * 10) / 10,
        carbsG: Math.round((acc.carbsG + (item.calculatedCarbsG || 0)) * 10) / 10,
        fatG: Math.round((acc.fatG + (item.calculatedFatG || 0)) * 10) / 10,
        fiberG: Math.round((acc.fiberG + (item.calculatedFiberG || 0)) * 10) / 10,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
    );
  }, [activePlan]);

  // Budget calculations based on active plan items
  const budgetCostBreakdown = useMemo(() => {
    if (!activePlan || !activePlan.items || activePlan.items.length === 0) return [];
    return calculateCostBreakdownByFood(
      activePlan.items.map(i => ({ foodId: i.foodId, foodName: i.foodName, servings: i.servings })),
      budgetPeriod
    );
  }, [activePlan, budgetPeriod]);

  const budgetAnalysis = useMemo(() => {
    if (!activePlan || !activePlan.items) {
      return { dailyCost: 0, weeklyCost: 0, monthlyCost: 0, costForPeriod: 0 };
    }
    return calculatePlanEstimatedCost(
      activePlan.items.map(i => ({ foodId: i.foodId, foodName: i.foodName, servings: i.servings })),
      budgetPeriod
    );
  }, [activePlan, budgetPeriod]);

  const budgetFeasibility = useMemo(() => {
    return evaluateBudgetFeasibility({
      budgetInr: budgetAmount,
      period: budgetPeriod,
      targetCalories: targetCal,
      targetProteinG: targetPro,
      dietaryPreference: userDietaryPref,
    });
  }, [budgetAmount, budgetPeriod, targetCal, targetPro, userDietaryPref]);

  const mealSlots: Array<{ slot: MealSlot; label: string; timing: string }> = [
    { slot: 'breakfast', label: 'Breakfast', timing: '08:30 AM' },
    { slot: 'lunch', label: 'Lunch', timing: '01:30 PM' },
    { slot: 'snack', label: 'Evening Snack', timing: '05:30 PM' },
    { slot: 'dinner', label: 'Dinner', timing: '08:45 PM' },
  ];

  return (
    <div className="container-app animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>
      {/* 1. ADAPTIVE MEAL REVIEW BANNER (FREE V1) */}
      {activePlan && (
        <AdaptiveMealReviewBanner
          userId={userId}
          activePlan={activePlan}
          nutritionProfile={nutritionProfile}
          progressEntries={progressEntries}
          userDietaryPreference={userDietaryPref}
          onPlanUpdated={newPlan => {
            setActivePlan(newPlan);
            setLogSuccessMessage(`Activated updated plan: ${newPlan.name}!`);
            setTimeout(() => setLogSuccessMessage(null), 3500);
          }}
          onWeightLogged={_newW => {
            loadMealPlan();
          }}
        />
      )}

      {/* Header & Date Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <span className="badge badge-accent">Nutrition & Fuel Intelligence</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Verified ICMR-NIN IFCT Catalog</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Nutrition & Meal Planner</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0', fontSize: '0.9rem' }}>
            Structured day plans, macro tracking, grocery budget estimation, and adaptive progress reviews.
          </p>
        </div>

        {/* Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <Calendar size={16} color="var(--accent-primary)" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      {/* 2. DAILY TARGET HEADER: TARGET VS PLANNED PROGRESS BARS */}
      <div
        className="card card-elevated"
        style={{
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Daily Target vs Planned Schedule</strong>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              How close your active meal plan matches your caloric & macronutrient targets
            </span>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setIsPlannerModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sliders size={14} />
            <span>Customize Setup</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-3)' }}>
          {/* Calories */}
          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>Calories</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round((plannedTotals.calories / targetCal) * 100)}%
              </span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: '4px 0' }}>
              {plannedTotals.calories} <small style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {targetCal} kcal</small>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (plannedTotals.calories / targetCal) * 100)}%`, height: '100%', background: 'var(--accent-primary)' }} />
            </div>
          </div>

          {/* Protein */}
          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-primary-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              <span>Protein</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round((plannedTotals.proteinG / targetPro) * 100)}%
              </span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', margin: '4px 0' }}>
              {plannedTotals.proteinG}g <small style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {targetPro}g</small>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (plannedTotals.proteinG / targetPro) * 100)}%`, height: '100%', background: 'var(--accent-primary)' }} />
            </div>
          </div>

          {/* Carbs */}
          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>Carbohydrates</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round((plannedTotals.carbsG / targetCarb) * 100)}%
              </span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: '4px 0' }}>
              {plannedTotals.carbsG}g <small style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {targetCarb}g</small>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (plannedTotals.carbsG / targetCarb) * 100)}%`, height: '100%', background: 'var(--text-secondary)' }} />
            </div>
          </div>

          {/* Fat */}
          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>Fat</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round((plannedTotals.fatG / targetFat) * 100)}%
              </span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: '4px 0' }}>
              {plannedTotals.fatG}g <small style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {targetFat}g</small>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (plannedTotals.fatG / targetFat) * 100)}%`, height: '100%', background: 'var(--text-secondary)' }} />
            </div>
          </div>

          {/* Dietary Fibre */}
          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>Dietary Fibre</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round((plannedTotals.fiberG / targetFibre) * 100)}%
              </span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: '4px 0' }}>
              {plannedTotals.fiberG}g <small style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {targetFibre}g</small>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (plannedTotals.fiberG / targetFibre) * 100)}%`, height: '100%', background: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        className="chip-scroll-container"
        style={{
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 'var(--space-3)',
        }}
      >
        <button
          type="button"
          className={`btn ${activeTab === 'planner' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('planner')}
          style={{ whiteSpace: 'nowrap' }}
        >
          Today's Meal Plan
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'weekly_plan' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('weekly_plan')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <span>7-Day Plan</span>
          <span className="badge badge-secondary" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            {!canAccessWeeklyMealPlanning && <Lock size={10} />} PREMIUM V1
          </span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'diary' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('diary')}
          style={{ whiteSpace: 'nowrap' }}
        >
          Daily Fuel Diary
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'budget' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('budget')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <span>Budget & Cost Analysis</span>
          <span className="badge badge-secondary" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            {!canAccessBudgetPlanning && <Lock size={10} />} PREMIUM V1
          </span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'mixed_analyzer' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('mixed_analyzer')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <span>Mixed Meal & Food Analyzer</span>
          <span className="badge badge-secondary" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            {!canAccessMixedMealAnalyzer && <Lock size={10} />} PREMIUM V1
          </span>
        </button>
      </div>

      {logSuccessMessage && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-success-muted)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-success)',
            fontSize: '0.88rem',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{logSuccessMessage}</span>
        </div>
      )}

      {/* =========================================================================
          TAB 1: TODAY'S MEAL PLAN (CLEAN MEAL CARDS)
          ========================================================================= */}
      {activeTab === 'planner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                {activePlan ? activePlan.name : 'Personalized Daily Schedule'}
              </h3>
              {activePlan?.createdAt && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Active since: {new Date(activePlan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsPlannerModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} />
                <span>Create / Edit Plan</span>
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  if (!canAccessPremiumMealGenerator) {
                    setLockedModalPrompt({
                      name: 'Multi-Attribute Meal Generator',
                      description: 'Configure custom meal slot ratios, caloric distribution curves, and specific regional dietary preferences.',
                    });
                    return;
                  }
                  setIsGeneratorModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {!canAccessPremiumMealGenerator && <Lock size={12} color="#eab308" />}
                <span>Advanced Slot Config</span>
              </button>
            </div>
          </div>

          {!activePlan ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
              <Utensils size={36} color="var(--accent-primary)" style={{ margin: '0 auto var(--space-3)' }} />
              <h3 style={{ margin: '0 0 var(--space-2)' }}>No Active Meal Plan</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto var(--space-5)', fontSize: '0.9rem' }}>
                Create a customized, goal-targeted Indian meal schedule calibrated to your exact calories, protein targets, and dietary preferences.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsPlannerModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={16} />
                <span>Start Meal Planning Wizard →</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 'var(--space-4)' }}>
              {mealSlots.map(({ slot, label, timing }) => {
                const plannedItems = activePlan.items.filter(i => i.mealType === slot);
                const slotCals = plannedItems.reduce((acc, curr) => acc + curr.calculatedCalories, 0);
                const slotPro = Math.round(plannedItems.reduce((acc, curr) => acc + curr.calculatedProteinG, 0) * 10) / 10;
                const slotCarb = Math.round(plannedItems.reduce((acc, curr) => acc + (curr.calculatedCarbsG || 0), 0) * 10) / 10;
                const slotFat = Math.round(plannedItems.reduce((acc, curr) => acc + (curr.calculatedFatG || 0), 0) * 10) / 10;

                return (
                  <div
                    key={slot}
                    className="card card-elevated"
                    style={{
                      padding: 'var(--space-5)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                    }}
                  >
                    <div>
                      {/* Slot Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>{label}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'var(--space-2)' }}>
                            ~{timing}
                          </span>
                        </div>
                        <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {slotPro}g P • {slotCals} kcal
                        </span>
                      </div>

                      {/* Macro Subtitle */}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-4)' }}>
                        Carbs: {slotCarb}g • Fat: {slotFat}g
                      </div>

                      {/* Food Items List */}
                      {plannedItems.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'var(--space-4) 0' }}>
                          No food scheduled in this slot.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                          {plannedItems.map((item, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: 'var(--space-3)',
                                background: 'var(--bg-primary)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 'var(--space-2)',
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
                                  {item.foodName}
                                </strong>
                                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                  {item.servings}x serving ({item.servingSize})
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                  {item.calculatedCalories} kcal
                                </span>

                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem', height: '24px', display: 'flex', alignItems: 'center', gap: '3px', opacity: canAccessMealReplacement ? 1 : 0.8 }}
                                  onClick={() => {
                                    if (!canAccessMealReplacement) {
                                      setLockedModalPrompt({
                                        name: 'Smart Meal Replacement',
                                        description: 'Swap any ingredient or recipe for macro-equivalent alternatives matched to your dietary preferences with 1-click.',
                                      });
                                      return;
                                    }
                                    handleOpenSwapModal(item.foodId, item.foodName, item.servings);
                                  }}
                                  title={canAccessMealReplacement ? "Swap with macro-equivalent food" : "Premium: Swap with macro-equivalent food"}
                                >
                                  {canAccessMealReplacement ? <ArrowRightLeft size={11} /> : <Lock size={11} color="#eab308" />} Replace
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem', height: '24px' }}
                                  onClick={() => handleOpenFoodDetails(item.foodId, item.foodName)}
                                  title="View full nutrition & IFCT source"
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Action */}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-block"
                      style={{ marginTop: 'var(--space-2)', fontSize: '0.82rem' }}
                      onClick={() => handleLogPlannedMeal(slot)}
                    >
                      Log Meal to Today's Diary →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: 7-DAY ROTATING MEAL SCHEDULE (PREMIUM V1)
          ========================================================================= */}
      {activeTab === 'weekly_plan' && (
        !canAccessWeeklyMealPlanning ? (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <PremiumLockedSection
              featureName="7-Day Rotating Meal Schedule"
              featureDescription="Access automated multi-day meal rotations that balance high-protein Indian whole foods, avoid dietary monotony, and ensure exact daily macro tracking throughout the entire week."
            />
          </div>
        ) : (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <WeeklyMealPlanView userId={userId} nutritionProfile={nutritionProfile} />
          </div>
        )
      )}

      {/* =========================================================================
          TAB 2: BUDGET & COST ANALYSIS (PREMIUM V1)
          ========================================================================= */}
      {activeTab === 'budget' && (
        !canAccessBudgetPlanning ? (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <PremiumLockedSection
              featureName="Budget & Cost Analysis"
              featureDescription="Calculate real-time grocery expenses in INR across daily, weekly, and monthly periods matched to your active diet plan, with protein-cost efficiency scoring and high-cost food alerts."
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            {/* Budget Input & Overview */}
            <div className="card card-elevated" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <DollarSign size={20} color="var(--accent-primary)" />
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Food Budget & Cost Estimator</h3>
                    <span className="badge badge-secondary">PREMIUM V1</span>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
                    Evaluate grocery costs against your athletic caloric & protein requirements using Indian commodity averages.
                  </p>
                </div>

              {/* Budget Period & Amount Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <select
                  className="select select-sm"
                  value={budgetPeriod}
                  onChange={e => setBudgetPeriod(e.target.value as BudgetPeriod)}
                  style={{ width: '130px' }}
                >
                  <option value="weekly">Weekly (₹/wk)</option>
                  <option value="monthly">Monthly (₹/mo)</option>
                </select>

                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>₹</span>
                  <input
                    type="number"
                    min="500"
                    max="50000"
                    step="100"
                    value={budgetAmount}
                    onChange={e => setBudgetAmount(parseInt(e.target.value) || 1000)}
                    className="input input-sm"
                    style={{ paddingLeft: '24px', width: '120px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>
            </div>

            {/* Budget Stat Indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Your Target Budget</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: '4px 0' }}>
                  {formatInr(budgetAmount)}
                </div>
                <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Per {budgetPeriod === 'weekly' ? 'Week' : 'Month'}</small>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-primary-border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Estimated Food Cost</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', margin: '4px 0' }}>
                  {formatInr(budgetAnalysis.costForPeriod)}
                </div>
                <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  ≈ {formatInr(budgetAnalysis.dailyCost)} / day
                </small>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remaining Balance</span>
                <div
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: budgetAmount >= budgetAnalysis.costForPeriod ? '#10b981' : '#f87171',
                    margin: '4px 0',
                  }}
                >
                  {formatInr(budgetAmount - budgetAnalysis.costForPeriod)}
                </div>
                <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {budgetAmount >= budgetAnalysis.costForPeriod ? 'Within budget' : 'Over budget'}
                </small>
              </div>
            </div>

            {/* Constraint Intelligence Card (If Budget is tight or conflict exists) */}
            {!budgetFeasibility.isFeasible && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', marginBottom: '4px' }}>
                  <AlertCircle size={18} />
                  <strong style={{ fontSize: '0.92rem' }}>Target Conflict Detected</strong>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-3)', lineHeight: 1.45 }}>
                  {budgetFeasibility.conflictExplanation}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Suggested Optimization: Increase Soya, Dal, Sattu, Eggs; Reduce Paneer, Whey.
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (budgetFeasibility.recommendedBudgetInr) {
                        setBudgetAmount(budgetFeasibility.recommendedBudgetInr);
                      }
                      setIsPlannerModalOpen(true);
                    }}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Optimize for Budget in Planner →
                  </button>
                </div>
              </div>
            )}

            {/* Mandatory Disclaimer */}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 var(--space-5)', fontStyle: 'italic' }}>
              * Estimated food cost. Actual prices may vary by location, retailer, season, brand, and package size.
            </p>

            {/* Cost Breakdown by Food Category */}
            <div>
              <h4 style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', color: 'var(--text-primary)' }}>
                Estimated Cost Contribution by Food (Active Plan)
              </h4>

              {budgetCostBreakdown.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No active meal plan items to analyze. Generate or activate a plan to view detailed category costs.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Food Item</th>
                        <th style={{ padding: '8px' }}>Category</th>
                        <th style={{ padding: '8px' }}>Daily Servings</th>
                        <th style={{ padding: '8px' }}>Daily Cost</th>
                        <th style={{ padding: '8px' }}>{budgetPeriod === 'weekly' ? 'Weekly Cost' : 'Monthly Cost'}</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetCostBreakdown.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.foodName}</td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{item.category}</td>
                          <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{item.servingsPerDay}x</td>
                          <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{formatInr(item.costPerDayInr)}</td>
                          <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {formatInr(item.costForPeriodInr)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {item.percentOfTotal}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* =========================================================================
          TAB 3: DAILY FOOD DIARY
          ========================================================================= */}
      {activeTab === 'diary' && (
        <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Daily Food Diary</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Logged meals for {selectedDate === todayStr ? 'Today' : selectedDate} ({dailyTotals.entriesCount} items)
              </span>
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenLogModal('breakfast')}
            >
              <Plus size={16} /> Log Food Item
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {mealSlots.map(({ slot, label }) => {
              const slotItems = diaryEntries.filter(e => e.mealType === slot);
              const slotCalories = slotItems.reduce((acc, curr) => acc + curr.calories, 0);
              const slotProtein = slotItems.reduce((acc, curr) => acc + curr.proteinG, 0);

              return (
                <div
                  key={slot}
                  style={{
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    padding: 'var(--space-4)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.98rem' }}>{label}</strong>
                      <span style={{ marginLeft: 'var(--space-2)', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {Math.round(slotCalories)} kcal • {Math.round(slotProtein * 10) / 10}g protein
                      </span>
                    </div>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                      onClick={() => handleOpenLogModal(slot)}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>

                  {slotItems.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 'var(--space-2) 0', fontStyle: 'italic' }}>
                      No food logged for {label.toLowerCase()} yet.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {slotItems.map(item => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--bg-surface)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.foodName}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'var(--space-2)' }}>
                              ({item.servings} serving{item.servings > 1 ? 's' : ''})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>
                              {Math.round(item.proteinG)}g P
                            </span>
                            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                              {Math.round(item.calories)} kcal
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(item.id)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px', color: 'var(--accent-fire)', opacity: 0.8 }}
                              title="Delete food entry"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Daily Nutrient Comparison (Consumed vs Target) */}
          <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Daily Macro & Nutrient Comparison</h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  Live consumed vs. target analysis with deficit/surplus delta
                </p>
              </div>
              <span className="badge badge-secondary" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                {!canAccessDailyNutrientComparison && <Lock size={11} />} PREMIUM V1
              </span>
            </div>

            {!canAccessDailyNutrientComparison ? (
              <PremiumLockedSection
                featureName="Daily Nutrient Comparison"
                featureDescription="Access real-time consumed vs. target macronutrient comparisons with exact gram deltas, percentage compliance curves, and deficit/surplus status."
                compact
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                      <th style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-muted)', fontWeight: 600 }}>Macronutrient</th>
                      <th style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-muted)', fontWeight: 600 }}>Consumed</th>
                      <th style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-muted)', fontWeight: 600 }}>Target Goal</th>
                      <th style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-muted)', fontWeight: 600 }}>Completion</th>
                      <th style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-muted)', fontWeight: 600 }}>Delta Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: 'Energy (Calories)',
                        consumed: dailyTotals.totalCalories || 0,
                        target: nutritionProfile?.targetCalories || 2200,
                        unit: 'kcal',
                      },
                      {
                        label: 'Protein',
                        consumed: dailyTotals.totalProteinG || 0,
                        target: nutritionProfile?.targetProteinG || 140,
                        unit: 'g',
                      },
                      {
                        label: 'Carbohydrates',
                        consumed: dailyTotals.totalCarbsG || 0,
                        target: nutritionProfile?.targetCarbsG || 250,
                        unit: 'g',
                      },
                      {
                        label: 'Fat',
                        consumed: dailyTotals.totalFatG || 0,
                        target: nutritionProfile?.targetFatG || 65,
                        unit: 'g',
                      },
                      {
                        label: 'Dietary Fibre',
                        consumed: dailyTotals.totalFiberG || 0,
                        target: 30,
                        unit: 'g',
                      },
                    ].map(row => {
                      const pct = Math.round((row.consumed / (row.target || 1)) * 100);
                      const delta = Math.round((row.consumed - row.target) * 10) / 10;
                      const isOptimal = pct >= 90 && pct <= 110;
                      const isUnder = pct < 90;

                      return (
                        <tr key={row.label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: 'var(--space-3)', fontWeight: 600 }}>{row.label}</td>
                          <td style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)' }}>
                            {row.consumed} {row.unit}
                          </td>
                          <td style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {row.target} {row.unit}
                          </td>
                          <td style={{ padding: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', minWidth: '60px' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${Math.min(100, pct)}%`,
                                    background: isOptimal ? 'var(--color-success)' : pct > 110 ? 'var(--color-warning)' : 'var(--accent-primary)',
                                    borderRadius: 'var(--radius-full)',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', minWidth: '35px' }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3)' }}>
                            <span
                              className={`badge ${isOptimal ? 'badge-success' : isUnder ? 'badge-accent' : 'badge-warning'}`}
                              style={{ fontSize: '0.72rem' }}
                            >
                              {delta === 0 ? 'On Target' : delta > 0 ? `+${delta} ${row.unit} surplus` : `${delta} ${row.unit} deficit`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: MIXED MEAL & FOOD ANALYZER (WITH FULL NUTRITION DETAILS MODAL)
          ========================================================================= */}
      {activeTab === 'mixed_analyzer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          {/* Mixed Meal Analyzer */}
          {!canAccessMixedMealAnalyzer ? (
            <PremiumLockedSection
              featureName="Mixed Meal & Recipe Analyzer"
              featureDescription="Decompose complex Indian home-cooked dishes, multi-ingredient thalis, and custom recipes into precise macronutrient attributions without guesswork."
            />
          ) : (
            <MixedMealAnalyzerView
              catalog={foods}
              nutritionProfile={nutritionProfile}
              userId={userId}
              onLogComplete={loadDiary}
            />
          )}

          {/* Reference Indian Food Catalog with Details Button */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>ICMR-NIN Indian Food Reference Catalog</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
                  Scientific macronutrient and dietary fiber composition per standard serving based on Indian Food Composition Tables (IFCT).
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder="Search food (Paneer, Dal, Oats)..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: '32px', width: '220px' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>

                <select
                  className="select select-sm"
                  value={dietFilter}
                  onChange={e => setDietFilter(e.target.value)}
                >
                  <option value="all">All Diets</option>
                  <option value="veg">Vegetarian</option>
                  <option value="non_veg">Non-Veg</option>
                  <option value="egg">Egg</option>
                  <option value="vegan">Vegan</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px' }}>Food Name</th>
                    <th style={{ padding: '10px' }}>Serving Size</th>
                    <th style={{ padding: '10px' }}>Calories</th>
                    <th style={{ padding: '10px' }}>Protein</th>
                    <th style={{ padding: '10px' }}>Carbs</th>
                    <th style={{ padding: '10px' }}>Fats</th>
                    <th style={{ padding: '10px' }}>Fibre</th>
                    <th style={{ padding: '10px' }}>Diet Type</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {foods.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{f.servingSize} {f.servingUnit}</td>
                      <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{f.calories} kcal</td>
                      <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>{f.proteinG}g</td>
                      <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{f.carbsG}g</td>
                      <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{f.fatG}g</td>
                      <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{f.fiberG !== undefined ? `${f.fiberG}g` : '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <span className="badge" style={{ fontSize: '0.72rem' }}>{f.dietaryType}</span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.76rem', padding: '3px 8px' }}
                            onClick={() => setDetailsModalFood(f)}
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.76rem', padding: '3px 8px' }}
                            onClick={() => handleOpenLogModal('lunch', f)}
                          >
                            + Log
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. LOG FOOD MODAL */}
      {isLogModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: 'var(--space-4)',
          }}
        >
          <div className="card card-elevated" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Log Food to Diary</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsLogModalOpen(false)}
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogFood} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Meal Slot */}
              <div className="input-group">
                <label className="label">Meal Slot</label>
                <select
                  className="select"
                  value={modalSlot}
                  onChange={e => setModalSlot(e.target.value as MealSlot)}
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="snack">Evening Snack</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>

              {/* Food Item Selection */}
              {selectedFood ? (
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedFood.name}</strong>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedFood(null)}
                      style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    >
                      Change
                    </button>
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>
                    Base serving: {selectedFood.servingSize} {selectedFood.servingUnit} ({selectedFood.calories} kcal, {selectedFood.proteinG}g protein)
                  </small>
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label className="label">Custom Food Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Besan Chilla, Whey Shake"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                    <div className="input-group">
                      <label className="label">Calories per serving</label>
                      <input
                        type="number"
                        className="input"
                        value={customCalories}
                        onChange={e => setCustomCalories(Number(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                    <div className="input-group">
                      <label className="label">Protein (g)</label>
                      <input
                        type="number"
                        className="input"
                        value={customProtein}
                        onChange={e => setCustomProtein(Number(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                    <div className="input-group">
                      <label className="label">Carbs (g)</label>
                      <input
                        type="number"
                        className="input"
                        value={customCarbs}
                        onChange={e => setCustomCarbs(Number(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                    <div className="input-group">
                      <label className="label">Fat (g)</label>
                      <input
                        type="number"
                        className="input"
                        value={customFat}
                        onChange={e => setCustomFat(Number(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Servings */}
              <div className="input-group">
                <label className="label">Servings (Multiplier)</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="5"
                  className="input"
                  value={servings}
                  onChange={e => setServings(parseFloat(e.target.value) || 1)}
                  required
                />
              </div>

              {/* Estimated Macros (Calculated) */}
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Calculated Nutrition ({servings}x)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                  <span>Calories: <strong style={{ color: 'var(--text-primary)' }}>{Math.round((selectedFood ? selectedFood.calories : customCalories) * servings)} kcal</strong></span>
                  <span>Protein: <strong style={{ color: 'var(--accent-primary)' }}>{Math.round((selectedFood ? selectedFood.proteinG : customProtein) * servings * 10) / 10}g</strong></span>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={logging}
                style={{ marginTop: 'var(--space-2)' }}
              >
                {logging ? 'Logging Food...' : 'Confirm & Log Entry'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. MEAL REPLACEMENT MODAL (PREMIUM V1) */}
      <MealReplacementModal
        isOpen={isReplacementModalOpen}
        onClose={() => {
          setIsReplacementModalOpen(false);
          setTargetFoodForSwap(null);
          setTargetFoodIdToSwap(null);
        }}
        targetFood={targetFoodForSwap}
        targetServings={targetServingsForSwap}
        catalog={foods}
        userDietaryPreference={userDietaryPref}
        onConfirmSwap={handleConfirmSwap}
      />

      {/* 7. PREMIUM MEAL GENERATOR MODAL (PREMIUM V1) */}
      <PremiumMealGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        userId={userId}
        nutritionProfile={nutritionProfile}
        currentDietaryPreference={userDietaryPref}
        onPlanGenerated={plan => {
          setActivePlan(plan);
          setLogSuccessMessage(`Generated ${plan.name}!`);
          setTimeout(() => setLogSuccessMessage(null), 3500);
        }}
      />

      {/* 8. FOOD DETAILS MODAL (FREE V1 FULL NUTRITION ANALYSIS) */}
      <FoodDetailsModal
        food={detailsModalFood}
        isOpen={Boolean(detailsModalFood)}
        onClose={() => setDetailsModalFood(null)}
      />

      {/* 9. PRODUCT MEAL PLANNER MODAL (FREE V1 DELIBERATE WORKFLOW) */}
      <MealPlannerModal
        isOpen={isPlannerModalOpen}
        onClose={() => setIsPlannerModalOpen(false)}
        userId={userId}
        nutritionProfile={nutritionProfile}
        currentDietaryPreference={userDietaryPref}
        onPlanGenerated={plan => {
          setActivePlan(plan);
          setLogSuccessMessage(`Generated & activated ${plan.name}!`);
          setTimeout(() => setLogSuccessMessage(null), 3500);
        }}
      />

      {/* 10. LOCKED FEATURE MODAL PROMPT */}
      {lockedModalPrompt && (
        <div className="modal-backdrop" onClick={() => setLockedModalPrompt(null)}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '520px', padding: 'var(--space-2)' }} onClick={e => e.stopPropagation()}>
            <PremiumLockedSection
              featureName={lockedModalPrompt.name}
              featureDescription={lockedModalPrompt.description}
            />
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0 var(--space-4) var(--space-4)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setLockedModalPrompt(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
