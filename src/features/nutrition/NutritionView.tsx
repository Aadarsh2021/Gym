import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Utensils,
  Plus,
  Trash2,
  Calendar,
  RotateCw,
  CheckCircle2,
  X,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { nutritionService } from '@/services/nutrition.service';
import { foodDiaryService } from '@/services/food-diary.service';
import { profileService } from '@/services/profile.service';
import {
  FoodItem,
  NutritionProfile,
  MealPlan,
  FoodDiaryEntry,
  DailyMacroTotals,
  MealSlot,
  MealReplacementCandidate,
} from '@/types/nutrition.types';
import { MixedMealAnalyzerView } from './MixedMealAnalyzerView';
import { MealReplacementModal } from './MealReplacementModal';
import { PremiumMealGeneratorModal } from './PremiumMealGeneratorModal';

interface NutritionViewProps {
  nutritionProfile: NutritionProfile | null;
  userId?: string;
}

type NutritionTab = 'diary' | 'mixed_analyzer' | 'planner';

export const NutritionView: React.FC<NutritionViewProps> = ({
  nutritionProfile,
  userId = 'guest-user',
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<NutritionTab>('diary');

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
  const [planLoading, setPlanLoading] = useState<boolean>(false);
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

  // Meal Replacement Modal State
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState<boolean>(false);
  const [targetFoodForSwap, setTargetFoodForSwap] = useState<FoodItem | null>(null);
  const [targetServingsForSwap, setTargetServingsForSwap] = useState<number>(1.0);
  const [targetFoodIdToSwap, setTargetFoodIdToSwap] = useState<string | null>(null);

  // Premium Meal Generator Modal State
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState<boolean>(false);

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

  // Load Active Meal Plan & Profile
  const loadMealPlan = useCallback(async () => {
    try {
      const [plan, profile] = await Promise.all([
        nutritionService.getMealPlan(userId),
        profileService.getFitnessProfile(userId),
      ]);
      setActivePlan(plan);
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

  // Generate / Regenerate Meal Plan
  const handleGeneratePlan = async () => {
    setPlanLoading(true);
    try {
      const targetCalories = nutritionProfile?.targetCalories || 2200;
      const targetProtein = nutritionProfile?.targetProteinG || 140;

      // Get user dietary preference from profile
      let dietPref = 'vegetarian';
      const fitnessProfile = await profileService.getFitnessProfile(userId);
      if (fitnessProfile?.dietaryPreference) {
        dietPref = fitnessProfile.dietaryPreference;
      }

      const newPlan = await nutritionService.generateAndSaveMealPlan(
        userId,
        targetCalories,
        targetProtein,
        dietPref
      );
      if (newPlan) {
        setActivePlan(newPlan);
      }
    } catch {
      // Fallback
    } finally {
      setPlanLoading(false);
    }
  };

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
        carbsG: 0,
        fatG: 0,
      });
    }

    setLogSuccessMessage(`Logged all ${slot} items to today's diary!`);
    setTimeout(() => setLogSuccessMessage(null), 3000);
    await loadDiary();
  };

  // Target values
  const targetCal = nutritionProfile?.targetCalories || 2200;
  const targetPro = nutritionProfile?.targetProteinG || 140;
  const targetCarb = nutritionProfile?.targetCarbsG || 240;
  const targetFat = nutritionProfile?.targetFatG || 60;

  // Percentage calculations
  const calPercent = Math.min(100, Math.round((dailyTotals.totalCalories / targetCal) * 100));
  const proPercent = Math.min(100, Math.round((dailyTotals.totalProteinG / targetPro) * 100));
  const carbPercent = Math.min(100, Math.round((dailyTotals.totalCarbsG / targetCarb) * 100));
  const fatPercent = Math.min(100, Math.round((dailyTotals.totalFatG / targetFat) * 100));

  const mealSlots: Array<{ slot: MealSlot; label: string }> = [
    { slot: 'breakfast', label: 'Breakfast' },
    { slot: 'lunch', label: 'Lunch' },
    { slot: 'snack', label: 'Evening Snack' },
    { slot: 'dinner', label: 'Dinner' },
  ];

  return (
    <div className="container-app animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>
      {/* Header & Date Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span className="badge badge-accent">Nutrition & Food Diary</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ICMR-NIN Scientific Reference</span>
          </div>
          <h1 style={{ margin: 0 }}>Target vs Consumed Fuel Tracker</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
            Real-time daily macro auditing, deterministic meal schedules, and Indian food database.
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
          className={`btn ${activeTab === 'diary' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('diary')}
          style={{ whiteSpace: 'nowrap' }}
        >
          Daily Fuel Diary
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'mixed_analyzer' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('mixed_analyzer')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <span>Mixed Meal Analyzer</span>
          <span
            className="badge badge-accent"
            style={{ fontSize: '0.65rem', padding: '1px 5px', lineHeight: 1 }}
          >
            PREMIUM V1 — OPEN EARLY ACCESS
          </span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'planner' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('planner')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <span>Personalized Meal Plans</span>
          <span
            className="badge badge-accent"
            style={{ fontSize: '0.65rem', padding: '1px 5px', lineHeight: 1 }}
          >
            PREMIUM V1 — OPEN EARLY ACCESS
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
          TAB 1: DAILY FUEL DIARY
          ========================================================================= */}
      {activeTab === 'diary' && (
        <>
          {/* 1. TARGET VS CONSUMED REAL-TIME PROGRESS CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            {/* Calories Card */}
            <div className="card card-elevated" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Calories Consumed</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{calPercent}%</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {dailyTotals.totalCalories} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {targetCal} kcal</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', marginTop: 'var(--space-3)', overflow: 'hidden' }}>
                <div style={{ width: `${calPercent}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.4s ease' }} />
              </div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 'var(--space-2)' }}>
                {dailyTotals.totalCalories > targetCal ? `${dailyTotals.totalCalories - targetCal} kcal surplus` : `${targetCal - dailyTotals.totalCalories} kcal remaining`}
              </small>
            </div>

            {/* Protein Card */}
            <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderColor: 'var(--accent-primary-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Protein Target</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{proPercent}%</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                {dailyTotals.totalProteinG} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {targetPro} g</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', marginTop: 'var(--space-3)', overflow: 'hidden' }}>
                <div style={{ width: `${proPercent}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.4s ease' }} />
              </div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 'var(--space-2)' }}>
                {dailyTotals.totalProteinG >= targetPro ? 'Daily protein goal achieved!' : `${Math.round((targetPro - dailyTotals.totalProteinG) * 10) / 10} g remaining`}
              </small>
            </div>

            {/* Carbs Card */}
            <div className="card card-elevated" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Carbohydrates</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{carbPercent}%</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {dailyTotals.totalCarbsG} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {targetCarb} g</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', marginTop: 'var(--space-3)', overflow: 'hidden' }}>
                <div style={{ width: `${carbPercent}%`, height: '100%', background: 'var(--color-info)', transition: 'width 0.4s ease' }} />
              </div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 'var(--space-2)' }}>Energy & glycogen stores</small>
            </div>

            {/* Healthy Fats Card */}
            <div className="card card-elevated" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Healthy Fats</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fatPercent}%</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {dailyTotals.totalFatG} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {targetFat} g</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', marginTop: 'var(--space-3)', overflow: 'hidden' }}>
                <div style={{ width: `${fatPercent}%`, height: '100%', background: 'var(--color-warning)', transition: 'width 0.4s ease' }} />
              </div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 'var(--space-2)' }}>Hormonal & cellular health</small>
            </div>
          </div>

          {/* 2. DAILY FOOD DIARY LOG (BY MEAL SLOT) */}
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
          </div>
        </>
      )}

      {/* =========================================================================
          TAB 2: MIXED MEAL ANALYZER (PREMIUM V1)
          ========================================================================= */}
      {activeTab === 'mixed_analyzer' && (
        <MixedMealAnalyzerView
          catalog={foods}
          nutritionProfile={nutritionProfile}
          userId={userId}
          onLogComplete={loadDiary}
        />
      )}

      {/* =========================================================================
          TAB 3: PERSONALIZED MEAL PLANS & PREMIUM GENERATOR
          ========================================================================= */}
      {activeTab === 'planner' && (
        <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Utensils size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>
                {activePlan ? activePlan.name : 'Personalized Daily Meal Plan'}
              </h3>
              {activePlan?.planType === 'premium_generated' && (
                <span className="badge badge-accent" style={{ fontSize: '0.68rem' }}>PREMIUM V1</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleGeneratePlan}
                disabled={planLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCw size={14} className={planLoading ? 'spin' : ''} />
                <span>Generate Free Plan</span>
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setIsGeneratorModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} />
                <span>Premium Meal Generator</span>
              </button>
            </div>
          </div>

          {!activePlan ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                You don't have an active deterministic meal plan. Generate a practical Indian routine calibrated to your calorie and protein targets.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={handleGeneratePlan} disabled={planLoading}>
                  Generate Free Plan
                </button>
                <button className="btn btn-primary" onClick={() => setIsGeneratorModalOpen(true)}>
                  Open Premium Generator
                </button>
              </div>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              {mealSlots.map(({ slot, label }) => {
                const plannedItems = activePlan.items.filter(i => i.mealType === slot);
                const slotCals = plannedItems.reduce((acc, curr) => acc + curr.calculatedCalories, 0);
                const slotPro = plannedItems.reduce((acc, curr) => acc + curr.calculatedProteinG, 0);

                return (
                  <div
                    key={slot}
                    style={{
                      padding: 'var(--space-4)',
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <strong style={{ color: 'var(--accent-primary)', fontSize: '0.98rem' }}>{label}</strong>
                        <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                          {slotPro}g P • {slotCals} kcal
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: 'var(--space-3) 0' }}>
                        {plannedItems.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '0.84rem',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>• {item.foodName} ({item.servings}x)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                {item.calculatedCalories} kcal
                              </span>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{
                                  padding: '1px 6px',
                                  fontSize: '0.7rem',
                                  color: 'var(--accent-primary)',
                                  height: '22px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                                onClick={() => handleOpenSwapModal(item.foodId, item.foodName, item.servings)}
                                title="Swap with macro-equivalent alternative"
                              >
                                <ArrowRightLeft size={11} /> Swap
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm btn-block"
                      style={{ marginTop: 'var(--space-3)', fontSize: '0.78rem' }}
                      onClick={() => handleLogPlannedMeal(slot)}
                    >
                      Log to Today's Diary →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. REFERENCE INDIAN FOOD CATALOG */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>ICMR-NIN Indian Food Reference Catalog</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
              Scientific macronutrient and dietary fiber composition per standard serving based on Indian Food Composition Tables (IFCT). Micronutrient breakdowns (vitamins, trace minerals, amino acids) are not fabricated without direct certified assay data.
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
                <th style={{ padding: '10px', textAlign: 'right' }}>Quick Action</th>
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
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      onClick={() => handleOpenLogModal('lunch', f)}
                    >
                      + Log to Diary
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* 6. MEAL REPLACEMENT MODAL (PREMIUM V1 OPTIONAL) */}
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
        onPlanGenerated={(plan) => {
          setActivePlan(plan);
          setLogSuccessMessage(`Generated ${plan.name}!`);
          setTimeout(() => setLogSuccessMessage(null), 3500);
        }}
      />
    </div>
  );
};
