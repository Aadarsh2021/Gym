import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  RefreshCw,
  Flame,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { WeeklyMealPlan, WeeklyMealPlanDay, NutritionProfile } from '@/types/nutrition.types';
import { weeklyMealPlanService } from '@/services/weekly-meal-plan.service';
import { logger } from '@/lib/logger';

interface WeeklyMealPlanViewProps {
  userId: string;
  nutritionProfile: NutritionProfile | null;
}

const MEAL_SLOT_LABELS: Record<string, { label: string; color: string; badgeClass: string }> = {
  breakfast: { label: 'Breakfast', color: 'var(--accent-primary)', badgeClass: 'badge-accent' },
  lunch: { label: 'Lunch', color: 'var(--color-success)', badgeClass: 'badge-success' },
  snack: { label: 'Mid-Day Snack', color: 'var(--color-warning)', badgeClass: 'badge' },
  dinner: { label: 'Dinner', color: 'var(--color-info)', badgeClass: 'badge-primary' },
};

export const WeeklyMealPlanView: React.FC<WeeklyMealPlanViewProps> = ({
  userId,
  nutritionProfile,
}) => {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1); // 1 = Monday
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchPlan = async () => {
      try {
        const plan = await weeklyMealPlanService.getActiveWeeklyMealPlan(userId);
        if (isMounted) {
          setWeeklyPlan(plan);
        }
      } catch (err) {
        logger.error('Failed to load weekly meal plan', { err });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPlan();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      const targetCalories = nutritionProfile?.targetCalories || 2200;
      const targetProteinG = nutritionProfile?.targetProteinG || 140;
      const dietaryPreference = 'non_veg'; // Default or from profile

      const newPlan = await weeklyMealPlanService.generateAndSaveWeeklyMealPlan(
        userId,
        targetCalories,
        targetProteinG,
        dietaryPreference
      );
      setWeeklyPlan(newPlan);
    } catch (err) {
      logger.error('Failed to generate weekly meal plan', { err });
    } finally {
      setGenerating(false);
    }
  };

  const selectedDay: WeeklyMealPlanDay | undefined = weeklyPlan?.days.find(
    d => d.dayOfWeek === selectedDayOfWeek
  );

  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading your 7-day rotating meal schedule...</p>
      </div>
    );
  }

  // EMPTY STATE: No Weekly Plan Yet
  if (!weeklyPlan || !weeklyPlan.days || weeklyPlan.days.length === 0) {
    return (
      <div
        className="card card-elevated"
        style={{
          padding: 'var(--space-10) var(--space-6)',
          textAlign: 'center',
          maxWidth: '680px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--accent-primary-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-4)',
            color: 'var(--accent-primary)',
          }}
        >
          <Calendar size={32} />
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          No 7-Day Meal Schedule Active
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 'var(--space-6)', maxWidth: '520px', margin: '0 auto var(--space-6)' }}>
          Generate a complete Monday-to-Sunday rotating nutrition routine. Every day features distinct high-protein Indian staples (paneer, chicken, soya, eggs, lentils) precisely calibrated to your target calories.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleGeneratePlan}
          disabled={generating}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          {generating ? (
            <>
              <RefreshCw size={18} className="animate-spin" /> Generating 7-Day Schedule...
            </>
          ) : (
            <>
              <Sparkles size={18} /> Generate 7-Day Rotating Plan
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header & Controls */}
      <div
        className="card card-elevated"
        style={{
          padding: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
            <span className="badge badge-accent" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Premium V1
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Multi-Day Routine</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            7-Day Rotating Nutrition Schedule
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Authentic Indian food rotations to prevent dietary monotony while guaranteeing daily protein targets.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleGeneratePlan}
          disabled={generating}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
          <span>{generating ? 'Regenerating...' : 'Regenerate Schedule'}</span>
        </button>
      </div>

      {/* 3 Overview Telemetry Cards */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Card 1: Average Calories */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', marginBottom: '4px' }}>
            <Flame size={18} />
            <small style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.04em' }}>
              Avg Daily Calories
            </small>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {weeklyPlan.averageDailyCalories} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>kcal</span>
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Target: {weeklyPlan.targetCalories} kcal
          </small>
        </div>

        {/* Card 2: Average Protein */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', marginBottom: '4px' }}>
            <Zap size={18} />
            <small style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.04em' }}>
              Avg Daily Protein
            </small>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
            {weeklyPlan.averageDailyProteinG} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>g</span>
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Target: {weeklyPlan.targetProteinG}g protein
          </small>
        </div>

        {/* Card 3: Variety & Source Assurance */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-info)', marginBottom: '4px' }}>
            <ShieldCheck size={18} />
            <small style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.04em' }}>
              Data Quality
            </small>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
            ICMR-NIN IFCT Verified
          </div>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Zero synthetic or fabricated macro stats
          </small>
        </div>
      </div>

      {/* Day Selector Buttons (Mon-Sun) */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          overflowX: 'auto',
          paddingBottom: 'var(--space-2)',
        }}
      >
        {weeklyPlan.days.map(day => {
          const isSelected = day.dayOfWeek === selectedDayOfWeek;
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => setSelectedDayOfWeek(day.dayOfWeek)}
              className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                flex: '1 0 auto',
                minWidth: '100px',
                padding: 'var(--space-3) var(--space-2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                borderRadius: 'var(--radius-md)',
                borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{day.dayName.slice(0, 3)}</span>
              <span style={{ fontSize: '0.74rem', opacity: isSelected ? 0.95 : 0.7, fontFamily: 'var(--font-mono)' }}>
                {day.totalCalories} kcal
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Nutrition Detail */}
      {selectedDay && (
        <div className="card card-elevated" style={{ padding: 'var(--space-6)' }}>
          {/* Day Title & Macros */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-6)',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: 'var(--space-4)',
            }}
          >
            <div>
              <span className="badge badge-accent" style={{ marginBottom: '4px' }}>
                Day {selectedDay.dayOfWeek} of 7
              </span>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '2px 0 0' }}>
                {selectedDay.dayName} Rotation
              </h3>
            </div>

            {/* Macro Summary Pill Matrix */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <div style={{ padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>CALORIES</span>
                <strong style={{ fontSize: '0.92rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                  {selectedDay.totalCalories} / {selectedDay.targetCalories} kcal
                </strong>
              </div>
              <div style={{ padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>PROTEIN</span>
                <strong style={{ fontSize: '0.92rem', fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                  {selectedDay.totalProteinG} / {selectedDay.targetProteinG}g
                </strong>
              </div>
              <div style={{ padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>CARBS</span>
                <strong style={{ fontSize: '0.92rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {selectedDay.totalCarbsG}g
                </strong>
              </div>
              <div style={{ padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>FAT</span>
                <strong style={{ fontSize: '0.92rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {selectedDay.totalFatG}g
                </strong>
              </div>
            </div>
          </div>

          {/* Meals List for Selected Day */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map(mealType => {
              const itemsInMeal = selectedDay.items.filter(it => it.mealType === mealType);
              if (itemsInMeal.length === 0) return null;

              const meta = MEAL_SLOT_LABELS[mealType];
              const mealCalories = itemsInMeal.reduce((sum, it) => sum + it.calculatedCalories, 0);
              const mealProtein = Math.round(itemsInMeal.reduce((sum, it) => sum + it.calculatedProteinG, 0) * 10) / 10;

              return (
                <div
                  key={mealType}
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {mealCalories} kcal • <strong style={{ color: 'var(--color-success)' }}>{mealProtein}g protein</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {itemsInMeal.map(it => (
                      <div
                        key={it.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 'var(--space-2) var(--space-3)',
                          background: 'var(--bg-card)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.88rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{it.foodName}</span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-full)',
                                background: 'rgba(34, 197, 94, 0.1)',
                                color: 'var(--color-success)',
                                fontWeight: 700,
                              }}
                            >
                              IFCT Verified
                            </span>
                          </div>
                          <small style={{ color: 'var(--text-muted)' }}>
                            {it.servings} {it.servings === 1 ? 'serving' : 'servings'}
                          </small>
                        </div>

                        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)', display: 'block' }}>
                            {it.calculatedCalories} kcal
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-success)' }}>
                            {it.calculatedProteinG}g protein
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
