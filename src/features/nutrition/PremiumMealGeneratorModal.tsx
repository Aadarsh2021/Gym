import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import {
  NutritionProfile,
  PremiumMealGeneratorConfig,
  MealGeneratorFocusGoal,
  MealPlan,
} from '@/types/nutrition.types';
import { nutritionService } from '@/services/nutrition.service';

interface PremiumMealGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  nutritionProfile: NutritionProfile | null;
  currentDietaryPreference?: string;
  onPlanGenerated: (plan: MealPlan) => void;
}

export const PremiumMealGeneratorModal: React.FC<PremiumMealGeneratorModalProps> = ({
  isOpen,
  onClose,
  userId,
  nutritionProfile,
  currentDietaryPreference = 'vegetarian',
  onPlanGenerated,
}) => {
  const [targetCalories, setTargetCalories] = useState<number>(
    nutritionProfile?.targetCalories || 2200
  );
  const [targetProteinG, setTargetProteinG] = useState<number>(
    nutritionProfile?.targetProteinG || 140
  );
  const [dietaryPreference, setDietaryPreference] = useState<string>(
    currentDietaryPreference
  );
  const [mealSlotCount, setMealSlotCount] = useState<3 | 4 | 5>(4);
  const [focusGoal, setFocusGoal] = useState<MealGeneratorFocusGoal>('hypertrophy');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const config: PremiumMealGeneratorConfig = {
        targetCalories,
        targetProteinG,
        dietaryPreference,
        mealSlotCount,
        focusGoal,
      };

      const plan = await nutritionService.generatePremiumMealPlan(userId, config);
      if (plan) {
        onPlanGenerated(plan);
        onClose();
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
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
          maxWidth: '540px',
          width: '100%',
          padding: 'var(--space-6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Sparkles size={20} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Premium Meal Generator</h3>
            <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
              PREMIUM V1
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 var(--space-4)' }}>
          Configure athletic meal slots, dietary protocols, and nutritional focus goals for a deterministic daily schedule.
        </p>

        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Calorie & Protein Targets */}
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
                required
              />
            </div>

            <div>
              <label className="label" style={{ fontSize: '0.82rem' }}>Target Protein (g)</label>
              <input
                type="number"
                min="50"
                max="300"
                step="5"
                value={targetProteinG}
                onChange={e => setTargetProteinG(parseInt(e.target.value) || 120)}
                className="input"
                style={{ fontFamily: 'var(--font-mono)' }}
                required
              />
            </div>
          </div>

          {/* Dietary Preference */}
          <div>
            <label className="label" style={{ fontSize: '0.82rem' }}>Dietary Protocol</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {[
                { id: 'vegetarian', label: 'Vegetarian' },
                { id: 'vegan', label: '100% Vegan' },
                { id: 'eggetarian', label: 'Eggetarian' },
                { id: 'non_veg', label: 'Non-Vegetarian' },
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDietaryPreference(d.id)}
                  className={`badge ${dietaryPreference === d.id ? 'badge-accent' : 'badge-secondary'}`}
                  style={{
                    padding: '6px 12px',
                    cursor: 'pointer',
                    border: dietaryPreference === d.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-medium)',
                  }}
                >
                  {d.label} {dietaryPreference === d.id ? '✓' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Meal Slot Count */}
          <div>
            <label className="label" style={{ fontSize: '0.82rem' }}>Daily Meal Slot Structure</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
              {[
                { count: 3, label: '3 Meals', desc: 'Breakfast, Lunch, Dinner' },
                { count: 4, label: '4 Meals', desc: '+ Evening Snack' },
                { count: 5, label: '5 Meals', desc: '+ Pre/Post Fuel' },
              ].map(s => (
                <button
                  key={s.count}
                  type="button"
                  onClick={() => setMealSlotCount(s.count as 3 | 4 | 5)}
                  className="card card-interactive"
                  style={{
                    padding: 'var(--space-2)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderColor: mealSlotCount === s.count ? 'var(--accent-primary)' : undefined,
                    background: mealSlotCount === s.count ? 'var(--accent-primary-muted)' : undefined,
                  }}
                >
                  <strong style={{ fontSize: '0.88rem', display: 'block', color: 'var(--text-primary)' }}>
                    {s.label}
                  </strong>
                  <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.desc}</small>
                </button>
              ))}
            </div>
          </div>

          {/* Athletic Focus Goal */}
          <div>
            <label className="label" style={{ fontSize: '0.82rem' }}>Nutritional Focus Strategy</label>
            <select
              className="select"
              value={focusGoal}
              onChange={e => setFocusGoal(e.target.value as MealGeneratorFocusGoal)}
            >
              <option value="hypertrophy">High-Protein Hypertrophy (Muscle Gain & Recovery)</option>
              <option value="cutting">Lean Cut Precision (High Satiety, Lean Protein, Low Fat)</option>
              <option value="budget_staples">Budget Performance (Sattu, Eggs, Soya, Legumes)</option>
              <option value="balanced">Balanced Athletic (Classic Macronutrient Distribution)</option>
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
            style={{ marginTop: 'var(--space-2)' }}
          >
            {loading ? 'Optimizing Schedule...' : 'Generate & Activate Plan →'}
          </button>
        </form>
      </div>
    </div>
  );
};
