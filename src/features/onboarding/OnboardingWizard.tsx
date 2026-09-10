import React, { useState } from 'react';
import { Check, ArrowRight, ArrowLeft, Target, Award, Dumbbell, Utensils } from 'lucide-react';
import { FitnessGoal, ExperienceLevel, DietaryPreference, Gender, FitnessProfile } from '@/types/user.types';
import { validateBiometrics } from '@/utils/validation';
import { profileService } from '@/services/profile.service';
import { calculateBMR, calculateTDEE, calculateCalorieTarget } from '@/domain/calories';
import { calculateProteinTarget, calculateMacroSplit } from '@/domain/protein';
import { nutritionService } from '@/services/nutrition.service';
import { trackEvent } from '@/lib/analytics';

interface OnboardingWizardProps {
  userId: string;
  onComplete: () => void;
  existingProfile?: FitnessProfile | null;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  userId,
  onComplete,
  existingProfile,
}) => {
  const [step, setStep] = useState(1);
  const [age, setAge] = useState(existingProfile?.age || 24);
  const [heightCm, setHeightCm] = useState(existingProfile?.heightCm || 175);
  const [weightKg, setWeightKg] = useState(existingProfile?.weightKg || 70);
  const [gender, setGender] = useState<Gender>(existingProfile?.gender || 'male');
  const [goal, setGoal] = useState<FitnessGoal>(existingProfile?.goal || 'muscle_gain');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(existingProfile?.experienceLevel || 'intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(existingProfile?.daysPerWeek || 4);
  const [duration, setDuration] = useState(existingProfile?.workoutDurationMinutes || 60);
  const [equipment, setEquipment] = useState<string[]>(existingProfile?.equipment || ['Barbell', 'Dumbbells', 'Bodyweight']);
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>(existingProfile?.dietaryPreference || 'vegetarian');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleEquipment = (item: string) => {
    if (equipment.includes(item)) {
      setEquipment(equipment.filter(e => e !== item));
    } else {
      setEquipment([...equipment, item]);
    }
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      const validation = validateBiometrics({ age, heightCm, weightKg });
      if (!validation.isValid) {
        setError(validation.error || 'Please enter valid biometrics');
        return;
      }
    }
    setStep(prev => Math.min(4, prev + 1));
  };

  const handleFinish = async () => {
    setError(null);
    setSaving(true);

    try {
      // 1. Save fitness profile
      await profileService.saveFitnessProfile({
        userId,
        age,
        heightCm,
        weightKg,
        gender,
        goal,
        experienceLevel,
        daysPerWeek,
        workoutDurationMinutes: duration,
        equipment,
        dietaryPreference,
        limitations: [],
      });

      // 2. Compute deterministic nutrition targets
      const bmr = calculateBMR({ weightKg, heightCm, age, gender });
      const tdee = calculateTDEE(bmr, daysPerWeek);
      const targetCalories = calculateCalorieTarget(tdee, goal);
      const targetProteinG = calculateProteinTarget(weightKg, goal);
      const macros = calculateMacroSplit(targetCalories, targetProteinG);

      await nutritionService.saveNutritionProfile({
        userId,
        bmrCalories: bmr,
        tdeeCalories: tdee,
        targetCalories,
        targetProteinG,
        targetCarbsG: macros.carbsG,
        targetFatG: macros.fatG,
        calculationVersion: 'v1.0-deterministic',
      });

      trackEvent('onboarding_completed', { goal, daysPerWeek });
      onComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving profile';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-narrow animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
      <div className="card card-glass" style={{ padding: 'var(--space-8)' }}>
        {/* Progress Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {[1, 2, 3, 4].map(num => (
            <div
              key={num}
              style={{
                width: '32px',
                height: '6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: num <= step ? 'var(--accent-primary)' : 'var(--border-medium)',
                transition: 'all var(--transition-normal)',
              }}
            />
          ))}
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-3)',
            backgroundColor: 'rgba(255, 77, 77, 0.1)',
            border: '1px solid rgba(255, 77, 77, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-fire)',
            fontSize: '0.875rem',
            marginBottom: 'var(--space-4)',
          }}>
            {error}
          </div>
        )}

        {/* STEP 1: BIOMETRICS */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(212, 255, 0, 0.1)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-primary)' }}>
                <Target size={28} />
              </div>
              <h2>Your Biometrics</h2>
              <p>Used strictly for accurate calorie, protein, and recovery calculations.</p>
            </div>

            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <div className="input-group">
                <label className="label">Age (Years)</label>
                <input
                  type="number"
                  className="input"
                  value={age}
                  min={13}
                  max={100}
                  onChange={e => setAge(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="input-group">
                <label className="label">Biological Gender</label>
                <select className="select" value={gender} onChange={e => setGender(e.target.value as Gender)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="input-group">
                <label className="label">Height (cm)</label>
                <input
                  type="number"
                  className="input"
                  value={heightCm}
                  min={50}
                  max={260}
                  onChange={e => setHeightCm(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="input-group">
                <label className="label">Body Weight (kg)</label>
                <input
                  type="number"
                  className="input"
                  value={weightKg}
                  min={25}
                  max={350}
                  onChange={e => setWeightKg(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: GOALS & EXPERIENCE */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(0, 240, 255, 0.1)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-secondary)' }}>
                <Award size={28} />
              </div>
              <h2>What is your primary goal?</h2>
              <p>We personalize your workout intensity and nutritional balance to match.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              {[
                { id: 'muscle_gain', title: 'Muscle Gain (Hypertrophy)', desc: 'Build lean muscle mass and sculpted aesthetics' },
                { id: 'fat_loss', title: 'Fat Loss & Definition', desc: 'Burn fat while preserving hard-earned muscle' },
                { id: 'strength', title: 'Pure Strength', desc: 'Increase 1-rep maximums on heavy compound lifts' },
                { id: 'maintenance', title: 'General Fitness & Energy', desc: 'Maintain strength, mobility, and cardiovascular health' },
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setGoal(opt.id as FitnessGoal)}
                  className={`card card-interactive ${goal === opt.id ? 'card-glow' : ''}`}
                  style={{
                    padding: 'var(--space-4)',
                    cursor: 'pointer',
                    borderColor: goal === opt.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h4 style={{ color: goal === opt.id ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {opt.title}
                    </h4>
                    <small>{opt.desc}</small>
                  </div>
                  {goal === opt.id && <Check size={20} color="var(--accent-primary)" />}
                </div>
              ))}
            </div>

            <div className="input-group">
              <label className="label">Experience Level</label>
              <select
                className="select"
                value={experienceLevel}
                onChange={e => setExperienceLevel(e.target.value as ExperienceLevel)}
              >
                <option value="beginner">Beginner (&lt; 1 year of consistent lifting)</option>
                <option value="intermediate">Intermediate (1 - 3 years lifting)</option>
                <option value="advanced">Advanced (3+ years serious lifting)</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 3: SCHEDULE & EQUIPMENT */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(212, 255, 0, 0.1)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-primary)' }}>
                <Dumbbell size={28} />
              </div>
              <h2>Training Setup & Gear</h2>
              <p>We ensure you are never assigned an exercise you cannot physically perform.</p>
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-6)' }}>
              <label className="label">Workout Days Per Week ({daysPerWeek} days)</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {[2, 3, 4, 5, 6].map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`btn ${daysPerWeek === d ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minHeight: '42px', padding: 0 }}
                    onClick={() => setDaysPerWeek(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label">Workout Duration ({duration} mins)</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {[30, 45, 60, 90].map(dur => (
                  <button
                    key={dur}
                    type="button"
                    className={`btn ${duration === dur ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minHeight: '38px', padding: 0 }}
                    onClick={() => setDuration(dur)}
                  >
                    {dur}m
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="label">Available Equipment (Select all available)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
                {['Barbell', 'Dumbbells', 'Cable', 'Bodyweight', 'Machines'].map(eq => {
                  const selected = equipment.includes(eq);
                  return (
                    <div
                      key={eq}
                      onClick={() => toggleEquipment(eq)}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
                        backgroundColor: selected ? 'rgba(212, 255, 0, 0.08)' : 'var(--bg-input)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{eq}</span>
                      {selected && <Check size={16} color="var(--accent-primary)" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: NUTRITION PREFERENCE */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-success)' }}>
                <Utensils size={28} />
              </div>
              <h2>Dietary Foundation</h2>
              <p>Tailored specifically for high-protein Indian dietary choices.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              {[
                { id: 'vegetarian', title: 'Vegetarian', desc: 'Dairy, pulses, grains, paneer, tofu & soya chunks' },
                { id: 'eggetarian', title: 'Eggetarian', desc: 'Vegetarian staples plus whole eggs and egg whites' },
                { id: 'non_vegetarian', title: 'Non-Vegetarian', desc: 'Chicken breast, fish, eggs, and all vegetarian sources' },
                { id: 'vegan', title: '100% Plant-Based / Vegan', desc: 'Soya, lentils, beans, oats, seeds, and plant proteins' },
              ].map(diet => (
                <div
                  key={diet.id}
                  onClick={() => setDietaryPreference(diet.id as DietaryPreference)}
                  className={`card card-interactive ${dietaryPreference === diet.id ? 'card-glow' : ''}`}
                  style={{
                    padding: 'var(--space-4)',
                    cursor: 'pointer',
                    borderColor: dietaryPreference === diet.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h4 style={{ color: dietaryPreference === diet.id ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {diet.title}
                    </h4>
                    <small>{diet.desc}</small>
                  </div>
                  {dietaryPreference === diet.id && <Check size={20} color="var(--accent-primary)" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-8)' }}>
          {step > 1 ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(prev => Math.max(1, prev - 1))}
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button type="button" className="btn btn-primary" onClick={handleNext}>
              Next Step <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : 'Generate My Fitness System'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
