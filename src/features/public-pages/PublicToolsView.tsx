import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { calculateBMR, calculateTDEE } from '@/domain/calories';
import { calculateProteinTarget } from '@/domain/protein';
import { calculateOneRepMaxEpley } from '@/domain/pr-calculator';
import { FitnessGoal } from '@/types/user.types';
import { PRODUCT_NAME } from '@/config/branding';
import { SEOHead } from '@/components/common/SEOHead';

export const PublicToolsView: React.FC = () => {
  const { toolId } = useParams<{ toolId?: string }>();
  const navigate = useNavigate();

  // Normalize active tool tab
  const getInitialTab = (): string => {
    if (toolId === 'bmr' || toolId === 'tdee') return 'bmr';
    if (toolId === 'protein') return 'protein';
    if (toolId === 'one-rep-max' || toolId === '1rm') return '1rm';
    return 'bmr';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab());

  useEffect(() => {
    if (toolId) {
      if (toolId === 'bmr' || toolId === 'tdee') setActiveTab('bmr');
      else if (toolId === 'protein') setActiveTab('protein');
      else if (toolId === 'one-rep-max' || toolId === '1rm') setActiveTab('1rm');
    }
  }, [toolId]);

  // BMR & TDEE State
  const [calcWeight, setCalcWeight] = useState(72);
  const [calcHeight, setCalcHeight] = useState(176);
  const [calcAge, setCalcAge] = useState(25);
  const [calcGender, setCalcGender] = useState<'male' | 'female'>('male');
  const [calcDays, setCalcDays] = useState(4);

  // Protein Target State
  const [proteinWeight, setProteinWeight] = useState(72);
  const [proteinGoal, setProteinGoal] = useState<FitnessGoal>('muscle_gain');

  // 1RM State
  const [liftWeight, setLiftWeight] = useState(85);
  const [liftReps, setLiftReps] = useState(6);

  // Calculations
  const bmrResult = calculateBMR({ weightKg: calcWeight, heightCm: calcHeight, age: calcAge, gender: calcGender });
  const tdeeResult = calculateTDEE(bmrResult, calcDays);
  const proteinResult = calculateProteinTarget(proteinWeight, proteinGoal);
  const oneRmResult = calculateOneRepMaxEpley(liftWeight, liftReps);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'bmr') navigate('/tools/bmr');
    else if (tab === 'protein') navigate('/tools/protein');
    else if (tab === '1rm') navigate('/tools/one-rep-max');
  };

  const toolTitle =
    activeTab === 'protein'
      ? 'Protein Target Calculator'
      : activeTab === '1rm'
      ? '1RM Strength Calculator'
      : 'BMR & TDEE Calorie Calculator';

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4) var(--space-12)' }}>
      <SEOHead
        title={toolTitle}
        description="Evidence-based fitness calculators: Mifflin-St Jeor BMR & TDEE, athletic daily protein requirements, and Epley 1-Rep Max estimation."
        canonicalPath={`/tools${toolId ? `/${toolId}` : ''}`}
      />
      {/* Header */}
      <div style={{ maxWidth: '720px', margin: '0 auto var(--space-8)', textAlign: 'center' }}>
        <span className="badge badge-fire" style={{ marginBottom: 'var(--space-2)' }}>Free Evidence-Based Tools</span>
        <h1>Fitness & Performance Calculators</h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
          Clinical-grade Mifflin-St Jeor, Epley 1RM, and athletic protein scaling formulas. No registration required.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto var(--space-6)',
          display: 'flex',
          gap: 'var(--space-2)',
          justifyContent: 'center',
          background: 'var(--bg-secondary)',
          padding: '6px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <button
          className={`btn btn-sm ${activeTab === 'bmr' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => handleTabChange('bmr')}
          style={{ flex: 1 }}
        >
          BMR & TDEE
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'protein' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => handleTabChange('protein')}
          style={{ flex: 1 }}
        >
          Protein Target
        </button>
        <button
          className={`btn btn-sm ${activeTab === '1rm' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => handleTabChange('1rm')}
          style={{ flex: 1 }}
        >
          1-Rep Max (1RM)
        </button>
      </div>

      {/* Calculator Body */}
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* TAB 1: BMR & TDEE */}
        {activeTab === 'bmr' && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>Basal Metabolic Rate & Total Energy Expenditure</h3>

            <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div className="input-group">
                <label className="label">Weight (kg)</label>
                <input
                  type="number"
                  className="input"
                  value={calcWeight}
                  onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="input-group">
                <label className="label">Height (cm)</label>
                <input
                  type="number"
                  className="input"
                  value={calcHeight}
                  onChange={e => setCalcHeight(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="input-group">
                <label className="label">Age</label>
                <input
                  type="number"
                  className="input"
                  value={calcAge}
                  onChange={e => setCalcAge(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="input-group">
                <label className="label">Biological Sex</label>
                <select className="select" value={calcGender} onChange={e => setCalcGender(e.target.value as any)}>
                  <option value="male">Male (+5 constant)</option>
                  <option value="female">Female (-161 constant)</option>
                </select>
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className="label">Weekly Training Frequency</label>
                  <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{calcDays} days / week</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="7"
                  value={calcDays}
                  onChange={e => setCalcDays(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>
            </div>

            {/* Results Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-4)',
                background: 'var(--bg-input)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <div>
                <small style={{ color: 'var(--text-muted)' }}>BMR (Basal Calories)</small>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {bmrResult} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kcal</span>
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Resting metabolic requirement</small>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)' }}>TDEE (Daily Maintenance)</small>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {tdeeResult} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kcal</span>
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Active energy expenditure</small>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Formula: Mifflin-St Jeor validated clinical equation:
              <br />
              <code>BMR = 10 × W(kg) + 6.25 × H(cm) - 5 × Age + (Sex constant)</code>
            </div>
          </div>
        )}

        {/* TAB 2: PROTEIN */}
        {activeTab === 'protein' && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>Daily Protein Intake Target</h3>

            <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div className="input-group">
                <label className="label">Current Body Weight (kg)</label>
                <input
                  type="number"
                  className="input"
                  value={proteinWeight}
                  onChange={e => setProteinWeight(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="input-group">
                <label className="label">Primary Training Goal</label>
                <select className="select" value={proteinGoal} onChange={e => setProteinGoal(e.target.value as any)}>
                  <option value="muscle_gain">Hypertrophy (2.0g/kg)</option>
                  <option value="fat_loss">Fat Loss / Retention (2.2g/kg)</option>
                  <option value="maintenance">Maintenance / Recomp (1.8g/kg)</option>
                </select>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-input)',
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                marginBottom: 'var(--space-6)',
              }}
            >
              <small style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recommended Target Protein
              </small>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--accent-primary)', margin: '4px 0' }}>
                {proteinResult} <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>grams / day</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Equivalent to {(proteinResult * 4).toFixed(0)} kcal ({((proteinResult * 4 * 100) / (tdeeResult || 2200)).toFixed(0)}% of daily maintenance calories)
              </p>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              International Society of Sports Nutrition (ISSN) recommendation for resistance-trained athletes: 1.6 - 2.2 g/kg/day to maximize MPS (Muscle Protein Synthesis).
            </div>
          </div>
        )}

        {/* TAB 3: 1RM */}
        {activeTab === '1rm' && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>1-Rep Max (1RM) Estimator</h3>

            <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div className="input-group">
                <label className="label">Weight Lifted (kg)</label>
                <input
                  type="number"
                  className="input"
                  value={liftWeight}
                  onChange={e => setLiftWeight(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="input-group">
                <label className="label">Reps Completed</label>
                <input
                  type="number"
                  className="input"
                  value={liftReps}
                  onChange={e => setLiftReps(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-input)',
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                marginBottom: 'var(--space-6)',
              }}
            >
              <small style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estimated 1-Rep Max (Epley)
              </small>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--accent-fire)', margin: '4px 0' }}>
                {oneRmResult} <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>kg</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                85% (5-rep working weight): {(oneRmResult * 0.85).toFixed(1)} kg • 70% (10-rep hypertrophy weight): {(oneRmResult * 0.70).toFixed(1)} kg
              </p>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Formula: Epley Equation: <code>1RM = Weight × (1 + Reps / 30)</code>. Proven accuracy for rep counts between 1 and 10.
            </div>
          </div>
        )}

        {/* Call to action */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
            Want these metrics automatically synced to your training split?
          </p>
          <Link to="/signup" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Save Metrics in {PRODUCT_NAME} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};
