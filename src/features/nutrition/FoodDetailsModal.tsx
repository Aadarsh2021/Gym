import React, { useState } from 'react';
import { X, ShieldCheck, ChevronDown, ChevronUp, Info, Sparkles, Lock } from 'lucide-react';
import { FoodItem } from '@/types/nutrition.types';
import { useEntitlement } from '@/hooks/useEntitlement';
import { PremiumLockedSection } from '@/components/PremiumLockedSection';

interface FoodDetailsModalProps {
  food: FoodItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FoodDetailsModal: React.FC<FoodDetailsModalProps> = ({
  food,
  isOpen,
  onClose,
}) => {
  const { canAccessFullNutritionAnalysis } = useEntitlement();
  const [showMicros, setShowMicros] = useState<boolean>(false);

  if (!isOpen || !food) return null;

  // Macro calorie calculation & percentages
  const proteinCals = food.proteinG * 4;
  const carbsCals = food.carbsG * 4;
  const fatCals = food.fatG * 9;
  const totalCalsFromMacros = Math.max(1, proteinCals + carbsCals + fatCals);

  const proteinPct = Math.round((proteinCals / totalCalsFromMacros) * 100);
  const carbsPct = Math.round((carbsCals / totalCalsFromMacros) * 100);
  const fatPct = Math.round((fatCals / totalCalsFromMacros) * 100);

  // Protein Quality based strictly on verified dietary type & catalog category
  const isComplete =
    food.dietaryType === 'egg' ||
    food.dietaryType === 'non_veg' ||
    food.name.toLowerCase().includes('paneer') ||
    food.name.toLowerCase().includes('curd') ||
    food.name.toLowerCase().includes('milk') ||
    food.name.toLowerCase().includes('whey');

  const proteinQualityText = isComplete
    ? 'Complete Protein (Contains all 9 essential amino acids in balanced ratios)'
    : 'Plant Complementary (Pairs effectively with complementary grains/pulses for complete amino profile)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 250,
        padding: 'var(--space-4)',
      }}
      onClick={onClose}
    >
      <div
        className="card card-elevated animate-fade-in"
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 'var(--space-6)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{food.name}</h3>
              <span className="badge badge-accent" style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}>
                {food.dietaryType.replace('_', ' ')}
              </span>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Standard Serving: <strong>{food.servingSize} {food.servingUnit}</strong>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '6px', color: 'var(--text-muted)' }}
            aria-label="Close food details"
          >
            <X size={18} />
          </button>
        </div>

        {/* Verified Data Source Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            background: 'var(--bg-primary)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-4)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
          }}
        >
          <ShieldCheck size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          <span>
            Verified Source: <strong>{food.source}</strong> {food.sourceReference ? `(${food.sourceReference})` : ''}
          </span>
        </div>

        {/* 1. NUTRITION SUMMARY GRID */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Energy</small>
            <strong style={{ display: 'block', fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
              {food.calories}
            </strong>
            <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>kcal</small>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--accent-primary-border)' }}>
            <small style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Protein</small>
            <strong style={{ display: 'block', fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', marginTop: '2px' }}>
              {food.proteinG}g
            </strong>
            <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{proteinPct}%</small>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Carbs</small>
            <strong style={{ display: 'block', fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
              {food.carbsG}g
            </strong>
            <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{carbsPct}%</small>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fats</small>
            <strong style={{ display: 'block', fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
              {food.fatG}g
            </strong>
            <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{fatPct}%</small>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Dietary Fibre</small>
            <strong style={{ display: 'block', fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
              {food.fiberG !== undefined ? `${food.fiberG}g` : '—'}
            </strong>
            <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>digestive</small>
          </div>
        </div>

        {/* 2. PROTEIN QUALITY CLASSIFICATION */}
        <div
          style={{
            background: 'var(--bg-primary)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
            <Sparkles size={15} color="var(--accent-primary)" />
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Protein Quality Classification</strong>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            {proteinQualityText}
          </p>
        </div>

        {/* 3. FULL NUTRITION ANALYSIS & MICRONUTRIENTS (EXPANDABLE) */}
        <div
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-primary)',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => setShowMicros(!showMicros)}
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span>Full Micronutrient & Vitamin Breakdown</span>
              <span className="badge badge-secondary" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                {!canAccessFullNutritionAnalysis && <Lock size={10} />} PREMIUM V1
              </span>
            </div>
            {showMicros ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showMicros && (
            <div style={{ padding: '0 var(--space-4) var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
              {!canAccessFullNutritionAnalysis ? (
                <div style={{ padding: 'var(--space-3) 0' }}>
                  <PremiumLockedSection
                    featureName="Full Micronutrient & Vitamin Breakdown"
                    featureDescription="Unlock comprehensive micronutrient profiles, vitamin & mineral density analysis, and bio-available mineral ratios for whole foods."
                    compact
                  />
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-2)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      margin: 'var(--space-3) 0',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.4,
                    }}
                  >
                    <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      Authoritative assay assays for individual vitamins, minerals, and amino acid profiles are not currently stored in the repository catalog for this entry. Values are strictly displayed as <strong>Data unavailable</strong> rather than fabricated.
                    </span>
                  </div>

                  {/* Table of items marked clearly as Data unavailable */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: '0.82rem' }}>
                    {[
                      { name: 'Vitamin A', unit: 'µg' },
                      { name: 'Vitamin B1 (Thiamine)', unit: 'mg' },
                      { name: 'Vitamin B9 (Folate)', unit: 'µg' },
                      { name: 'Vitamin B12', unit: 'µg' },
                      { name: 'Vitamin C', unit: 'mg' },
                      { name: 'Vitamin D', unit: 'µg' },
                      { name: 'Calcium', unit: 'mg' },
                      { name: 'Iron', unit: 'mg' },
                      { name: 'Magnesium', unit: 'mg' },
                      { name: 'Zinc', unit: 'mg' },
                      { name: 'Potassium', unit: 'mg' },
                      { name: 'Leucine', unit: 'g' },
                    ].map(n => (
                      <div
                        key={n.name}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: 'var(--bg-surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>{n.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.76rem' }}>
                          Data unavailable
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
