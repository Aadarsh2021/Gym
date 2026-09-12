import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Utensils,
  RotateCw,
} from 'lucide-react';
import {
  NutritionProfile,
  MealPlan,
  BudgetPeriod,
} from '@/types/nutrition.types';
import { nutritionService } from '@/services/nutrition.service';
import { evaluateBudgetFeasibility, formatInr } from '@/domain/food-cost-model';


interface MealPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  nutritionProfile: NutritionProfile | null;
  currentDietaryPreference?: string;
  onPlanGenerated: (plan: MealPlan) => void;
}

type PlannerStep = 'goal' | 'diet' | 'meals' | 'preferences' | 'budget' | 'review';

export const MealPlannerModal: React.FC<MealPlannerModalProps> = ({
  isOpen,
  onClose,
  userId,
  nutritionProfile,
  currentDietaryPreference = 'vegetarian',
  onPlanGenerated,
}) => {
  // Step state
  const [currentStep, setCurrentStep] = useState<PlannerStep>('goal');

  // Form State
  const [goal, setGoal] = useState<'fat_loss' | 'muscle_gain' | 'maintenance'>('fat_loss');
  const [targetCalories, setTargetCalories] = useState<number>(
    nutritionProfile?.targetCalories || 2150
  );
  const [targetProteinG, setTargetProteinG] = useState<number>(
    nutritionProfile?.targetProteinG || 150
  );
  const [dietaryPreference, setDietaryPreference] = useState<string>(
    currentDietaryPreference
  );
  const [mealSlotCount, setMealSlotCount] = useState<3 | 4 | 5>(4);
  const [likedFoods, setLikedFoods] = useState<string[]>(['Paneer', 'Dal', 'Roti']);
  const [avoidedFoods, setAvoidedFoods] = useState<string[]>([]);

  // Budget State (Optional Free V1)
  const [enableBudget, setEnableBudget] = useState<boolean>(false);
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>('weekly');
  const [budgetInr, setBudgetInr] = useState<number>(1500);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available foods for preference picking
  const foodChoices = useMemo(() => [
    'Paneer', 'Low-Fat Paneer', 'Soya Chunks', 'Boiled Whole Egg', 'Chicken Breast',
    'Moong Dal', 'Roti', 'Curd', 'Rolled Oats', 'White Rice', 'Sattu', 'Green Salad'
  ], []);

  // Budget feasibility check
  const budgetFeasibility = useMemo(() => {
    if (!enableBudget) return null;
    return evaluateBudgetFeasibility({
      budgetInr,
      period: budgetPeriod,
      targetCalories,
      targetProteinG,
      dietaryPreference,
    });
  }, [enableBudget, budgetInr, budgetPeriod, targetCalories, targetProteinG, dietaryPreference]);

  if (!isOpen) return null;

  const toggleLiked = (food: string) => {
    setLikedFoods(prev =>
      prev.includes(food) ? prev.filter(f => f !== food) : [...prev, food]
    );
    setAvoidedFoods(prev => prev.filter(f => f !== food));
  };

  const toggleAvoided = (food: string) => {
    setAvoidedFoods(prev =>
      prev.includes(food) ? prev.filter(f => f !== food) : [...prev, food]
    );
    setLikedFoods(prev => prev.filter(f => f !== food));
  };

  const handleOptimizeForBudget = () => {
    if (budgetFeasibility?.recommendedBudgetInr) {
      setBudgetInr(budgetFeasibility.recommendedBudgetInr);
    }
    // Prioritize high-efficiency staples
    setLikedFoods(prev => Array.from(new Set([...prev, 'Soya Chunks', 'Sattu', 'Moong Dal', 'Boiled Whole Egg'])));
    setAvoidedFoods(prev => prev.filter(f => !['Soya Chunks', 'Sattu', 'Moong Dal', 'Boiled Whole Egg'].includes(f)));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let plan: MealPlan | null = null;
      if (enableBudget) {
        plan = await nutritionService.generateBudgetMealPlan(userId, {
          targetCalories,
          targetProteinG,
          dietaryPreference,
          mealSlotCount,
          budgetInr,
          period: budgetPeriod,
        });
      } else {
        plan = await nutritionService.generateAndSaveMealPlan(
          userId,
          targetCalories,
          targetProteinG,
          dietaryPreference
        );
      }

      if (plan) {
        onPlanGenerated(plan);
        onClose();
      } else {
        setErrorMsg('Could not generate plan. Please verify options and try again.');
      }
    } catch {
      setErrorMsg('An unexpected error occurred during plan generation.');
    } finally {
      setLoading(false);
    }
  };

  const stepsList: Array<{ id: PlannerStep; title: string }> = [
    { id: 'goal', title: 'Goal' },
    { id: 'diet', title: 'Diet' },
    { id: 'meals', title: 'Meals' },
    { id: 'preferences', title: 'Preferences' },
    { id: 'budget', title: 'Budget' },
    { id: 'review', title: 'Review' },
  ];

  const currentStepIdx = stepsList.findIndex(s => s.id === currentStep);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 250,
        padding: 'var(--space-4)',
      }}
    >
      <div
        className="card card-elevated animate-fade-in"
        style={{
          maxWidth: '620px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 'var(--space-6)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Utensils size={20} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Personalized Meal Planner</h3>
              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                Free V1
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ padding: '4px' }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper Header Indicator */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-5)',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: 'var(--space-3)',
            }}
          >
            {stepsList.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: idx === currentStepIdx ? 1 : idx < currentStepIdx ? 0.75 : 0.4,
                  color: idx <= currentStepIdx ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: idx === currentStepIdx ? 700 : 500,
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: idx <= currentStepIdx ? 'var(--accent-primary)' : 'var(--bg-primary)',
                    color: idx <= currentStepIdx ? '#000' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {idx + 1}
                </span>
                <span className="hidden-mobile">{s.title}</span>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-4)',
                fontSize: '0.82rem',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: GOAL & TARGETS */}
          {currentStep === 'goal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label" style={{ fontSize: '0.84rem' }}>Primary Fitness Goal</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
                  {[
                    { id: 'fat_loss', label: 'Fat Loss', desc: 'Calorie deficit & high protein' },
                    { id: 'muscle_gain', label: 'Muscle Gain', desc: 'Slight surplus for hypertrophy' },
                    { id: 'maintenance', label: 'Maintenance', desc: 'Stable energy balance' },
                  ].map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id as any)}
                      className="card card-interactive"
                      style={{
                        padding: 'var(--space-3)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderColor: goal === g.id ? 'var(--accent-primary)' : undefined,
                        background: goal === g.id ? 'var(--accent-primary-muted)' : undefined,
                      }}
                    >
                      <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--text-primary)' }}>
                        {g.label} {goal === g.id ? '✓' : ''}
                      </strong>
                      <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{g.desc}</small>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Calories & Protein inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label className="label" style={{ fontSize: '0.82rem' }}>Target Calories (kcal)</label>
                  <input
                    type="number"
                    min="1200"
                    max="4500"
                    step="50"
                    value={targetCalories}
                    onChange={e => setTargetCalories(parseInt(e.target.value) || 2000)}
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mifflin-St Jeor TDEE calibrated</small>
                </div>
                <div>
                  <label className="label" style={{ fontSize: '0.82rem' }}>Target Protein (g)</label>
                  <input
                    type="number"
                    min="50"
                    max="300"
                    step="5"
                    value={targetProteinG}
                    onChange={e => setTargetProteinG(parseInt(e.target.value) || 130)}
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Athletic protein target</small>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DIETARY PROTOCOL */}
          {currentStep === 'diet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label className="label" style={{ fontSize: '0.84rem' }}>Select Your Dietary Protocol</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-2)' }}>
                {[
                  { id: 'vegetarian', label: 'Vegetarian', desc: 'Dairy, legumes, grains, produce' },
                  { id: 'non_veg', label: 'Non-Vegetarian', desc: 'Chicken, eggs, dairy, whole foods' },
                  { id: 'eggetarian', label: 'Eggetarian', desc: 'Eggs, dairy, grains, produce' },
                  { id: 'vegan', label: '100% Vegan', desc: 'Soya, sattu, pulses, grains, nuts' },
                  { id: 'jain', label: 'Jain Diet', desc: 'No root vegetables, lacto-vegetarian' },
                ].map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDietaryPreference(d.id)}
                    className="card card-interactive"
                    style={{
                      padding: 'var(--space-3)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderColor: dietaryPreference === d.id ? 'var(--accent-primary)' : undefined,
                      background: dietaryPreference === d.id ? 'var(--accent-primary-muted)' : undefined,
                    }}
                  >
                    <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--text-primary)' }}>
                      {d.label} {dietaryPreference === d.id ? '✓' : ''}
                    </strong>
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: MEAL STRUCTURE */}
          {currentStep === 'meals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label className="label" style={{ fontSize: '0.84rem' }}>Daily Meals Distribution</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                {[
                  { count: 3, label: '3 Meals', desc: 'Breakfast, Lunch, Dinner' },
                  { count: 4, label: '4 Meals', desc: '+ Afternoon Recovery Snack' },
                  { count: 5, label: '5 Meals', desc: '+ Pre/Post Workout Fuel' },
                ].map(m => (
                  <button
                    key={m.count}
                    type="button"
                    onClick={() => setMealSlotCount(m.count as 3 | 4 | 5)}
                    className="card card-interactive"
                    style={{
                      padding: 'var(--space-3)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderColor: mealSlotCount === m.count ? 'var(--accent-primary)' : undefined,
                      background: mealSlotCount === m.count ? 'var(--accent-primary-muted)' : undefined,
                    }}
                  >
                    <strong style={{ fontSize: '1rem', display: 'block', color: 'var(--text-primary)' }}>
                      {m.label} {mealSlotCount === m.count ? '✓' : ''}
                    </strong>
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: FOOD PREFERENCES */}
          {currentStep === 'preferences' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label" style={{ fontSize: '0.84rem' }}>Foods You Like / Prefer in Plan</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {foodChoices.map(f => {
                    const isLiked = likedFoods.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleLiked(f)}
                        className={`badge ${isLiked ? 'badge-accent' : 'badge-secondary'}`}
                        style={{ cursor: 'pointer', padding: '6px 12px' }}
                      >
                        {f} {isLiked ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: '0.84rem' }}>Foods to Minimize or Avoid</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {foodChoices.map(f => {
                    const isAvoided = avoidedFoods.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleAvoided(f)}
                        className={`badge ${isAvoided ? 'badge-danger' : 'badge-secondary'}`}
                        style={{
                          cursor: 'pointer',
                          padding: '6px 12px',
                          border: isAvoided ? '1px solid #ef4444' : undefined,
                          color: isAvoided ? '#f87171' : undefined,
                        }}
                      >
                        {f} {isAvoided ? '✕' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: BUDGET PLANNING (FREE V1) */}
          {currentStep === 'budget' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)', display: 'block' }}>
                    Include Food Budget Constraint (INR ₹)
                  </strong>
                  <small style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Plan will optimize for high protein-per-rupee staples within your budget.
                  </small>
                </div>
                <input
                  type="checkbox"
                  checked={enableBudget}
                  onChange={e => setEnableBudget(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {enableBudget && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-2)' }}>
                    <div>
                      <label className="label" style={{ fontSize: '0.82rem' }}>Period</label>
                      <select
                        className="select"
                        value={budgetPeriod}
                        onChange={e => setBudgetPeriod(e.target.value as BudgetPeriod)}
                      >
                        <option value="weekly">Weekly (₹/week)</option>
                        <option value="monthly">Monthly (₹/month)</option>
                      </select>
                    </div>

                    <div>
                      <label className="label" style={{ fontSize: '0.82rem' }}>
                        Budget Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="500"
                        max="50000"
                        step="100"
                        value={budgetInr}
                        onChange={e => setBudgetInr(parseInt(e.target.value) || 1000)}
                        className="input"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>

                  {/* Budget Feasibility & Conflict Intelligence */}
                  {budgetFeasibility && (
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        background: budgetFeasibility.isFeasible ? 'var(--bg-primary)' : 'rgba(239, 68, 68, 0.08)',
                        border: budgetFeasibility.isFeasible ? '1px solid var(--border-subtle)' : '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      {budgetFeasibility.isFeasible ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                          <div>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Estimated Food Cost: </span>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                              {formatInr(budgetFeasibility.estimatedCostInr)}
                            </strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Remaining: </span>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                              {formatInr(budgetFeasibility.remainingInr)}
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', marginBottom: '4px' }}>
                            <AlertCircle size={16} />
                            <strong style={{ fontSize: '0.88rem' }}>Target Constraint Conflict</strong>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-3)', lineHeight: 1.4 }}>
                            {budgetFeasibility.conflictExplanation}
                          </p>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleOptimizeForBudget}
                            style={{ fontSize: '0.78rem' }}
                          >
                            Optimize for Budget (Use High Protein/₹ Staples)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    * Estimated food cost. Actual prices may vary by location, retailer, season, brand, and package size.
                  </small>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: REVIEW TARGETS & CONFIRM */}
          {currentStep === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div
                style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.98rem' }}>Plan Setup Summary</strong>
                  <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                    {goal.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Daily Calories: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{targetCalories} kcal</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Daily Protein: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{targetProteinG}g</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Dietary Protocol: </span>
                    <strong style={{ textTransform: 'capitalize' }}>{dietaryPreference.replace('_', ' ')}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Daily Slots: </span>
                    <strong>{mealSlotCount} Meals</strong>
                  </div>
                  {enableBudget && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Budget Target: </span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                        {formatInr(budgetInr)} / {budgetPeriod}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Clicking generate will calculate meal quantities and activate your new personalized schedule.
              </p>
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {currentStepIdx > 0 ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setCurrentStep(stepsList[currentStepIdx - 1].id)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {currentStepIdx < stepsList.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCurrentStep(stepsList[currentStepIdx + 1].id)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>Next</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleGenerate}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {loading ? <RotateCw size={14} className="spin" /> : <Sparkles size={14} />}
              <span>{loading ? 'Generating Plan...' : 'Generate & Activate Plan →'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
