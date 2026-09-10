import React, { useState } from 'react';
import { X, Calculator, ArrowRight } from 'lucide-react';
import { calculateBMR, calculateTDEE } from '@/domain/calories';
import { calculateProteinTarget } from '@/domain/protein';
import { calculateOneRepMaxEpley } from '@/domain/pr-calculator';

interface PublicCalculatorsModalProps {
  initialTool?: string;
  isOpen: boolean;
  onClose: () => void;
  onStartOnboarding: () => void;
}

export const PublicCalculatorsModal: React.FC<PublicCalculatorsModalProps> = ({
  initialTool = 'bmr-calculator',
  isOpen,
  onClose,
  onStartOnboarding,
}) => {
  const [activeTool, setActiveTool] = useState(initialTool);

  // BMR & TDEE inputs
  const [calcWeight, setCalcWeight] = useState(70);
  const [calcHeight, setCalcHeight] = useState(175);
  const [calcAge, setCalcAge] = useState(25);
  const [calcGender, setCalcGender] = useState<'male' | 'female'>('male');
  const [calcDays, setCalcDays] = useState(4);

  // 1RM inputs
  const [liftWeight, setLiftWeight] = useState(80);
  const [liftReps, setLiftReps] = useState(8);

  if (!isOpen) return null;

  const bmrResult = calculateBMR({ weightKg: calcWeight, heightCm: calcHeight, age: calcAge, gender: calcGender });
  const tdeeResult = calculateTDEE(bmrResult, calcDays);
  const proteinResult = calculateProteinTarget(calcWeight, 'muscle_gain');
  const oneRmResult = calculateOneRepMaxEpley(liftWeight, liftReps);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ padding: '8px', background: 'rgba(212, 255, 0, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
              <Calculator size={20} />
            </div>
            <div>
              <h3>Free Public Fitness Tools</h3>
              <small>Evidence-based deterministic calculations</small>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', overflowX: 'auto' }}>
          {[
            { id: 'bmr-calculator', label: 'BMR & TDEE' },
            { id: 'protein-calculator', label: 'Protein Target' },
            { id: '1rm-calculator', label: '1RM Estimator' },
          ].map(t => (
            <button
              key={t.id}
              className={`btn btn-sm ${activeTool === t.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TOOL 1: BMR & TDEE */}
        {activeTool === 'bmr-calculator' && (
          <div>
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div className="input-group">
                <label className="label">Weight (kg)</label>
                <input type="number" className="input" value={calcWeight} onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="input-group">
                <label className="label">Height (cm)</label>
                <input type="number" className="input" value={calcHeight} onChange={e => setCalcHeight(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="input-group">
                <label className="label">Age</label>
                <input type="number" className="input" value={calcAge} onChange={e => setCalcAge(parseInt(e.target.value) || 0)} />
              </div>
              <div className="input-group">
                <label className="label">Gender</label>
                <select className="select" value={calcGender} onChange={e => setCalcGender(e.target.value as any)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="label">Training Days / Week ({calcDays} days)</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {[1, 2, 3, 4, 5, 6].map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`btn btn-sm ${calcDays === d ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: 0 }}
                      onClick={() => setCalcDays(d)}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card card-glow" style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
              <small>Estimated Daily Energy Expenditure (TDEE)</small>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-heading)' }}>
                {tdeeResult} kcal
              </div>
              <small style={{ color: 'var(--text-muted)' }}>Basal Metabolic Rate: {bmrResult} kcal/day</small>
            </div>
          </div>
        )}

        {/* TOOL 2: PROTEIN TARGET */}
        {activeTool === 'protein-calculator' && (
          <div>
            <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label">Current Body Weight (kg)</label>
              <input type="number" className="input" value={calcWeight} onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)} />
            </div>

            <div className="card card-glow" style={{ textAlign: 'center', marginBottom: 'var(--space-4)', borderColor: 'rgba(0, 240, 255, 0.4)' }}>
              <small style={{ color: 'var(--accent-secondary)' }}>Optimal Muscle Growth Target</small>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-secondary)', fontFamily: 'var(--font-heading)' }}>
                {proteinResult} g / day
              </div>
              <small style={{ color: 'var(--text-muted)' }}>Calculated at 2.0g per kg of total bodyweight</small>
            </div>
          </div>
        )}

        {/* TOOL 3: 1RM ESTIMATOR */}
        {activeTool === '1rm-calculator' && (
          <div>
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div className="input-group">
                <label className="label">Weight Lifted (kg)</label>
                <input type="number" className="input" value={liftWeight} onChange={e => setLiftWeight(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="input-group">
                <label className="label">Repetitions Performed</label>
                <input type="number" className="input" value={liftReps} min={1} max={30} onChange={e => setLiftReps(parseInt(e.target.value) || 1)} />
              </div>
            </div>

            <div className="card card-glow" style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
              <small>Estimated 1-Rep Max (Epley Formula)</small>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-heading)' }}>
                {oneRmResult} kg
              </div>
              <small style={{ color: 'var(--text-muted)' }}>Theoretical maximum lift for a single clean repetition</small>
            </div>
          </div>
        )}

        {/* Funnel Call to Action */}
        <div style={{ borderTop: '1px solid var(--border-medium)', paddingTop: 'var(--space-4)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-3)' }}>
            Want a fully personalized workout split and meal plan tailored to your biometrics?
          </p>
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={() => {
              onClose();
              onStartOnboarding();
            }}
          >
            Create My Personalized Plan <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
