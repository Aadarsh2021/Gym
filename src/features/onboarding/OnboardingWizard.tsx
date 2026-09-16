import React, { useState } from 'react';
import { Check, ArrowRight, ArrowLeft, Target, Award, Dumbbell, Utensils, Activity, ShieldAlert, Home, Building2 } from 'lucide-react';
import { FitnessGoal, ExperienceLevel, DietaryPreference, Gender, FitnessProfile, WorkoutEnvironment } from '@/types/user.types';
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

  // Phase C8: Workout Environment Progressive State
  const initialEnv = existingProfile?.workoutEnvironment || 'home_equipped';
  const [workoutEnvironment, setWorkoutEnvironment] = useState<WorkoutEnvironment>(initialEnv);
  const [locationType, setLocationType] = useState<'home' | 'gym'>(
    initialEnv === 'external_gym' || initialEnv === 'connected_gym' ? 'gym' : 'home'
  );
  const [hasHomeEquipment, setHasHomeEquipment] = useState<boolean>(
    initialEnv === 'home_equipped'
  );
  const [isGymConnected, setIsGymConnected] = useState<boolean>(
    initialEnv === 'connected_gym'
  );

  const [equipment, setEquipment] = useState<string[]>(
    existingProfile?.equipment && existingProfile.equipment.length > 0
      ? existingProfile.equipment
      : initialEnv === 'home_bodyweight'
      ? ['Bodyweight']
      : ['Barbell', 'Dumbbells', 'Bodyweight']
  );
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

  const handleLocationSelect = (loc: 'home' | 'gym') => {
    setLocationType(loc);
    if (loc === 'home') {
      if (hasHomeEquipment) {
        setWorkoutEnvironment('home_equipped');
        if (equipment.length === 0 || (equipment.length === 1 && equipment[0] === 'Bodyweight')) {
          setEquipment(['Dumbbells', 'Bodyweight']);
        }
      } else {
        setWorkoutEnvironment('home_bodyweight');
        setEquipment(['Bodyweight']);
      }
    } else {
      if (isGymConnected) {
        setWorkoutEnvironment('connected_gym');
        setEquipment(['Barbell', 'Dumbbells', 'Cable', 'Machines', 'Bodyweight']);
      } else {
        setWorkoutEnvironment('external_gym');
        setEquipment(['Barbell', 'Dumbbells', 'Cable', 'Machines', 'Bodyweight']);
      }
    }
  };

  const handleHomeEquipmentToggle = (equipped: boolean) => {
    setHasHomeEquipment(equipped);
    if (equipped) {
      setWorkoutEnvironment('home_equipped');
      if (equipment.length === 0 || (equipment.length === 1 && equipment[0] === 'Bodyweight')) {
        setEquipment(['Dumbbells', 'Bodyweight']);
      }
    } else {
      setWorkoutEnvironment('home_bodyweight');
      setEquipment(['Bodyweight']);
    }
  };

  const handleGymConnectedToggle = (connected: boolean) => {
    setIsGymConnected(connected);
    if (connected) {
      setWorkoutEnvironment('connected_gym');
      setEquipment(['Barbell', 'Dumbbells', 'Cable', 'Machines', 'Bodyweight']);
    } else {
      setWorkoutEnvironment('external_gym');
      setEquipment(['Barbell', 'Dumbbells', 'Cable', 'Machines', 'Bodyweight']);
    }
  };

  const handleFinish = async () => {
    setError(null);
    setSaving(true);

    try {
      // Determine final sanitized equipment list based on environment
      const finalEquipment =
        workoutEnvironment === 'home_bodyweight'
          ? ['Bodyweight']
          : equipment.length > 0
          ? equipment
          : ['Bodyweight'];

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
        workoutEnvironment,
        equipment: finalEquipment,
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
      trackEvent('onboarding_completed', { goal, daysPerWeek, workoutEnvironment });
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
                backgroundColor: step === num ? 'var(--accent-primary)' : 'var(--border-medium)',
                transition: 'all var(--transition-fast)',
              }}
            />
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'rgba(255, 77, 77, 0.15)',
              border: '1px solid var(--accent-fire)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-fire)',
              fontSize: '0.85rem',
              marginBottom: 'var(--space-4)',
            }}
          >
            {error}
          </div>
        )}

        {/* STEP 1: BIOMETRICS & TARGETS */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-primary)' }}>
                <Target size={28} />
              </div>
              <h2>Biometrics & Physical Baseline</h2>
              <p style={{ color: 'var(--text-secondary)' }}>We use clinical formulas (Mifflin-St Jeor) to build your metabolic profile.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div className="input-group">
                <label className="label">Age</label>
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
                <label className="label">Gender</label>
                <select
                  className="select"
                  value={gender}
                  onChange={e => setGender(e.target.value as Gender)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Non-binary</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="input-group">
                <label className="label">Height (cm)</label>
                <input
                  type="number"
                  className="input"
                  value={heightCm}
                  min={100}
                  max={250}
                  onChange={e => setHeightCm(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="input-group">
                <label className="label">Weight (kg)</label>
                <input
                  type="number"
                  className="input"
                  value={weightKg}
                  min={30}
                  max={300}
                  step={0.5}
                  onChange={e => setWeightKg(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PRIMARY GOAL & EXPERIENCE */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-primary)' }}>
                <Award size={28} />
              </div>
              <h2>Primary Goal & Experience</h2>
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

        {/* STEP 3: WORKOUT ENVIRONMENT & SCHEDULE */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: '50%', marginBottom: 'var(--space-2)', color: 'var(--accent-primary)' }}>
                <Dumbbell size={28} />
              </div>
              <h2>Training Setup & Environment</h2>
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

            {/* Question 1: Where do you usually work out? */}
            <div className="input-group" style={{ marginBottom: 'var(--space-6)' }}>
              <label className="label">Where do you usually work out?</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div
                  onClick={() => handleLocationSelect('home')}
                  className="card card-interactive"
                  style={{
                    padding: 'var(--space-4)',
                    cursor: 'pointer',
                    borderColor: locationType === 'home' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    background: locationType === 'home' ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <Home size={24} color={locationType === 'home' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                  <div>
                    <h4 style={{ margin: 0, color: locationType === 'home' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      At Home
                    </h4>
                    <small style={{ color: 'var(--text-secondary)' }}>Living room, garage, or home gym</small>
                  </div>
                </div>

                <div
                  onClick={() => handleLocationSelect('gym')}
                  className="card card-interactive"
                  style={{
                    padding: 'var(--space-4)',
                    cursor: 'pointer',
                    borderColor: locationType === 'gym' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    background: locationType === 'gym' ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <Building2 size={24} color={locationType === 'gym' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                  <div>
                    <h4 style={{ margin: 0, color: locationType === 'gym' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      At a Gym
                    </h4>
                    <small style={{ color: 'var(--text-secondary)' }}>Commercial gym, club, or fitness center</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Home Branch: Do you have workout equipment? */}
            {locationType === 'home' && (
              <div className="animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="label">Do you have workout equipment?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  <div
                    onClick={() => handleHomeEquipmentToggle(false)}
                    className="card card-interactive"
                    style={{
                      padding: 'var(--space-4)',
                      cursor: 'pointer',
                      borderColor: !hasHomeEquipment ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      background: !hasHomeEquipment ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, color: !hasHomeEquipment ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        Home + No Equipment
                      </h4>
                      {!hasHomeEquipment && <Check size={18} color="var(--accent-primary)" />}
                    </div>
                    <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 'var(--space-1)' }}>
                      Pure bodyweight calisthenics only. No barbells, dumbbells, or machines will ever be assigned.
                    </small>
                  </div>

                  <div
                    onClick={() => handleHomeEquipmentToggle(true)}
                    className="card card-interactive"
                    style={{
                      padding: 'var(--space-4)',
                      cursor: 'pointer',
                      borderColor: hasHomeEquipment ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      background: hasHomeEquipment ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, color: hasHomeEquipment ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        Home + Equipment
                      </h4>
                      {hasHomeEquipment && <Check size={18} color="var(--accent-primary)" />}
                    </div>
                    <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 'var(--space-1)' }}>
                      Select the specific gear you own at home.
                    </small>
                  </div>
                </div>

                {/* Declared Home Equipment Inventory (ONLY shown when Home + Equipment) */}
                {hasHomeEquipment && (
                  <div className="input-group animate-fade-in">
                    <label className="label">Select your home equipment:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
                      {['Dumbbells', 'Barbell', 'Cable', 'Bodyweight'].map(eq => {
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
                )}
              </div>
            )}

            {/* Gym Branch: Is your gym connected with FitSphere? */}
            {locationType === 'gym' && (
              <div className="animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="label">Is your gym connected with FitSphere?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  <div
                    onClick={() => handleGymConnectedToggle(true)}
                    className="card card-interactive"
                    style={{
                      padding: 'var(--space-4)',
                      cursor: 'pointer',
                      borderColor: isGymConnected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      background: isGymConnected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, color: isGymConnected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        Gym + FitSphere Connected
                      </h4>
                      {isGymConnected && <Check size={18} color="var(--accent-primary)" />}
                    </div>
                    <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 'var(--space-1)' }}>
                      Partner facility with QR check-in, owner approval, and live floor sync.
                    </small>
                  </div>

                  <div
                    onClick={() => handleGymConnectedToggle(false)}
                    className="card card-interactive"
                    style={{
                      padding: 'var(--space-4)',
                      cursor: 'pointer',
                      borderColor: !isGymConnected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      background: !isGymConnected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, color: !isGymConnected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        Gym + Not Connected
                      </h4>
                      {!isGymConnected && <Check size={18} color="var(--accent-primary)" />}
                    </div>
                    <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 'var(--space-1)' }}>
                      Independent or commercial gym. Full autonomous workout planner with no facility check-in needed.
                    </small>
                  </div>
                </div>

                {/* External Gym Declared Equipment */}
                {!isGymConnected && (
                  <div className="input-group animate-fade-in">
                    <label className="label">Select available equipment at your gym:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
                      {['Barbell', 'Dumbbells', 'Cable', 'Machines', 'Bodyweight'].map(eq => {
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
                )}
              </div>
            )}
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
                FitBoost movement recommendations are biomechanical exercise adjustments designed to reduce joint stress, NOT medical diagnosis or physical therapy. Consult a physician for injury treatment.
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
