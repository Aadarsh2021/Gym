import React, { useState, useMemo } from 'react';
import { X, Check, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { FoodItem, MealReplacementCandidate } from '@/types/nutrition.types';
import { findMealReplacements } from '@/domain/meal-replacement';

interface MealReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFood: FoodItem | null;
  targetServings: number;
  catalog: FoodItem[];
  userDietaryPreference?: string;
  onConfirmSwap: (candidate: MealReplacementCandidate) => void;
}

export const MealReplacementModal: React.FC<MealReplacementModalProps> = ({
  isOpen,
  onClose,
  targetFood,
  targetServings,
  catalog,
  userDietaryPreference = 'all',
  onConfirmSwap,
}) => {
  const [dietFilter, setDietFilter] = useState<string>(userDietaryPreference);

  const candidates = useMemo(() => {
    if (!targetFood) return [];
    return findMealReplacements(targetFood, targetServings, catalog, {
      dietaryPreference: dietFilter,
      calorieTolerancePercent: 35,
    });
  }, [targetFood, targetServings, catalog, dietFilter]);

  if (!isOpen || !targetFood) return null;

  const targetCals = Math.round(targetFood.calories * targetServings);
  const targetPro = Math.round(targetFood.proteinG * targetServings * 10) / 10;

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
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--space-6)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ArrowRightLeft size={20} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Macro-Equivalent Replacement</h3>
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

        {/* Target Item Reference Banner */}
        <div
          style={{
            background: 'var(--color-surface-subtle)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Current Item to Replace
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
              {targetFood.name} ({targetServings}x)
            </strong>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>
              {targetPro}g P • {targetCals} kcal
            </span>
          </div>
        </div>

        {/* Dietary Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Filter Diet:</span>
          {['all', 'veg', 'vegan', 'egg', 'non_veg'].map(diet => (
            <button
              key={diet}
              type="button"
              onClick={() => setDietFilter(diet)}
              className={`badge ${dietFilter === diet ? 'badge-accent' : 'badge-secondary'}`}
              style={{
                cursor: 'pointer',
                fontSize: '0.75rem',
                textTransform: 'capitalize',
                padding: '3px 10px',
              }}
            >
              {diet.replace('_', '-')}
            </button>
          ))}
        </div>

        {/* Candidates List (Scrollable) */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--text-muted)' }}>
              <p>No suitable macro-equivalent food items found within tolerance for this dietary filter.</p>
            </div>
          ) : (
            candidates.map((cand, idx) => (
              <div
                key={cand.food.id || idx}
                style={{
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                      {cand.food.name}
                    </strong>
                    <span
                      className="badge"
                      style={{
                        fontSize: '0.68rem',
                        background:
                          cand.similarityScore >= 80
                            ? 'rgba(255, 85, 0, 0.15)'
                            : 'var(--color-surface-subtle)',
                        color:
                          cand.similarityScore >= 80
                            ? 'var(--accent-primary)'
                            : 'var(--text-secondary)',
                        border:
                          cand.similarityScore >= 80
                            ? '1px solid var(--accent-primary)'
                            : '1px solid var(--border-subtle)',
                      }}
                    >
                      {cand.similarityScore}% Match
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      margin: '4px 0',
                    }}
                  >
                    Serving: <strong>{cand.servingDisplay}</strong> →{' '}
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                      {cand.calculatedProteinG}g Protein
                    </span>{' '}
                    • {cand.calculatedCalories} kcal
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {cand.rationale}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onConfirmSwap(cand)}
                  style={{ flexShrink: 0, padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Check size={14} /> Swap Item
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Disclaimer */}
        <div
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ShieldAlert size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span>Replacements are mathematically calibrated to preserve your target protein and energy density.</span>
        </div>
      </div>
    </div>
  );
};
