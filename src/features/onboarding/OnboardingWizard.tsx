import React, { useState } from 'react';
import { Check, ArrowRight, ArrowLeft, Target, Award, Dumbbell, Utensils, Activity, ShieldAlert } from 'lucide-react';
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
  const [limitations, setLimitations] = useState<string[]>(existingProfile?.limitations && existingProfile.limitations.length > 0 ? existingProfile.limitations : ['None']);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleEquipment = (item: string) => {
    if (equipment.includes(item)) {
      setEquipment(equipment.filter(e => e !== item));
    } else {
      setEquipment([...equipment, item]);
    }
  };

  const toggleLimitation = (item: string) => {
    if (item === 'None') {
      setLimitations(['None']);
      return;
    }
    let updated = limitations.filter(l => l !== 'None');
    if (updated.includes(item)) {
      updated = updated.filter(l => l !== item);
    } else {
      updated.push(item);
    }
    setLimitations(updated.length === 0 ? ['None'] : updated);
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
    setStep(prev => Math.min(5, prev + 1));
  };

  const handleFinish = async () => {
    setError(null);
    setSaving(true);

    try {
      // 1. Save fitness profile (Authoritative Supabase write)
      const fitnessRes = await profileService.saveFitnessProfile({
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
        limitations,
      });

      if (!fitnessRes.success) {
        throw new Error(fitnessRes.error || 'Failed to persist fitness profile. Please retry.');
      }

      // 2. Compute deterministic nutrition targets & persist
      const bmr = calculateBMR({ weightKg, heightCm, age, gender });
      const tdee = calculateTDEE(bmr, daysPerWeek);
      const targetCalories = calculateCalorieTarget(tdee, goal);
      const targetProteinG = calculateProteinTarget(weightKg, goal);
      const macros = calculateMacroSplit(targetCalories, targetProteinG);

      const nutritionSuccess = await nutritionService.saveNutritionProfile({
        userId,
        bmrCalories: bmr,
        tdeeCalories: tdee,
        targetCalories,
        targetProteinG,
        targetCarbsG: macros.carbsG,
        targetFatG: macros.fatG,
        calculationVersion: 'v1.0-deterministic',
      });

      if (!nutritionSuccess) {
        throw new Error('Failed to persist nutrition profile targets. Please retry.');
      }

      // 3. Telemetry and state progression ONLY after confirmed authoritative writes
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
      <div className="card" style={{ padding: 'var(--space-8)', borderColor: 'var(--border-medium)', background: 'var(--bg-surface)' }}>
        {/* Progress Dots (5 Steps) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {[1, 2, 3, 4, 5].map(num => (
            <div
              key={num}
              style={{
                width: '32px',
                height: '5px',
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
            backgroundColor: 'rgba(193, 89, 79, 0.15)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error)',
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
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-primary)' }}>
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
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-primary)' }}>
                <Award size={28} />
              </div>
              <h2>What is your primary goal?</h2>
              <p style={{ color: 'var(--text-secondary)' }}>We personalize your workout intensity and nutritional balance to match.</p>
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
                  className="card card-interactive"
                  style={{
                    padding: 'var(--space-4)',
                    cursor: 'pointer',
                    borderColor: goal === opt.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    background: goal === opt.id ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h4 style={{ color: goal === opt.id ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {opt.title}
                    </h4>
                    <small style={{ color: 'var(--text-secondary)' }}>{opt.desc}</small>
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
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-primary)' }}>
                <Dumbbell size={28} />
              </div>
              <h2>Training Setup & Gear</h2>
              <p style={{ color: 'var(--text-secondary)' }}>We ensure you are never assigned an exercise you cannot physically perform.</p>
            </div>

            {/* Weekly Schedule Days */}
            <div className="input-group" style={{ marginBottom: 'var(--space-6)' }}>
              <label className="label">Weekly Training Availability</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                {[3, 4, 5, 6].map(days => (
                  <button
                    key={days}
                    type="button"
                    className={`btn ${daysPerWeek === days ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDaysPerWeek(days)}
                    style={{ padding: 'var(--space-3) 0', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>

            {/* Target Session Duration */}
            <div className="input-group" style={{ marginBottom: 'var(--space-6)' }}>
              <label className="label">Target Session Duration ({duration} mins)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                {[30, 45, 60, 90].map(dur => (
                  <button
                    key={dur}
                    type="button"
                    className={`btn ${duration === dur ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDuration(dur)}
                    style={{ padding: 'var(--space-3) 0', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}
                  >
                    {dur}m
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment Multi-select */}
            <div className="input-group">
              <label className="label">Available Equipment (Select all that apply)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
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
                        backgroundColor: selected ? 'var(--accent-primary-muted)' : 'var(--bg-input)',
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
              <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(127, 166, 107, 0.15)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--color-success)' }}>
                <Utensils size={28} />
              </div>
              <h2>Dietary Foundation</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Tailored specifically for high-protein Indian dietary choices.</p>
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
                  className="card card-interactive"
                  style={{
                    padding: 'var(--space-4)',
                    cursor: 'pointer',
                    borderColor: dietaryPreference === diet.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    background: dietaryPreference === diet.id ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h4 style={{ color: dietaryPreference === diet.id ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {diet.title}
                    </h4>
                    <small style={{ color: 'var(--text-secondary)' }}>{diet.desc}</small>
                  </div>
                  {dietaryPreference === diet.id && <Check size={20} color="var(--accent-primary)" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: PHYSICAL LIMITATIONS & MOVEMENT PREFERENCES */}
        {step === 5 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-full)', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
                <Activity size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-1)' }}>Physical Limitations & Movement Preferences</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Select any joints or areas where you prefer conservative exercise alternatives.
              </p>
            </div>

            {/* Non-medical disclaimer alert */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(59, 75, 107, 0.18)',
                border: '1px solid var(--accent-indigo)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-5)',
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'flex-start',
              }}
            >
              <ShieldAlert size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Non-Medical Disclaimer: </strong>
                APEXFIT movement recommendations are biomechanical exercise adjustments designed to reduce joint stress, NOT medical diagnosis or physical therapy. Consult a physician for injury treatment.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 'var(--space-3)' }}>
              {[
                { id: 'None', label: 'None (Full Range)' },
                { id: 'Lower Back', label: 'Lower Back' },
                { id: 'Knees', label: 'Knees' },
                { id: 'Shoulders', label: 'Shoulders' },
                { id: 'Elbows', label: 'Elbows' },
                { id: 'Wrists', label: 'Wrists' },
                { id: 'Hips', label: 'Hips' },
                { id: 'Ankles', label: 'Ankles' },
              ].map(lim => {
                const isSelected = limitations.includes(lim.id);
                return (
                  <button
                    key={lim.id}
                    type="button"
                    onClick={() => toggleLimitation(lim.id)}
                    className="btn btn-sm"
                    style={{
                      height: 'auto',
                      padding: 'var(--space-3)',
                      textAlign: 'center',
                      background: isSelected ? 'var(--accent-primary-muted)' : 'var(--bg-input)',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {isSelected && <Check size={14} />}
                    <span style={{ fontWeight: isSelected ? 700 : 500 }}>{lim.label}</span>
                  </button>
                );
              })}
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

          {step < 5 ? (
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
