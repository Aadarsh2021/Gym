import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Shield, Dumbbell, Save, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profile.service';
import { nutritionService } from '@/services/nutrition.service';
import { ExperienceLevel, FitnessGoal, Gender } from '@/types/user.types';
import { calculateBMR, calculateTDEE, calculateCalorieTarget } from '@/domain/calories';
import { calculateProteinTarget, calculateMacroSplit } from '@/domain/protein';
import { validateBiometrics } from '@/utils/validation';

export const ProfileView: React.FC = () => {
  const { session, signOut } = useAuth();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [weightKg, setWeightKg] = useState<number>(70);
  const [heightCm, setHeightCm] = useState<number>(175);
  const [age, setAge] = useState<number>(25);
  const [gender, setGender] = useState<Gender>('male');
  const [goal, setGoal] = useState<FitnessGoal>('muscle_gain');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [equipment, setEquipment] = useState<string[]>(['Barbell', 'Dumbbells', 'Bodyweight']);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const profile = await profileService.getFitnessProfile(userId);
        if (isMounted && profile) {
          setWeightKg(profile.weightKg || 70);
          setHeightCm(profile.heightCm || 175);
          setAge(profile.age || 25);
          setGender(profile.gender || 'male');
          setGoal(profile.goal || 'muscle_gain');
          setExperienceLevel(profile.experienceLevel || 'intermediate');
          setDaysPerWeek(profile.daysPerWeek || 4);
          if (profile.equipment && profile.equipment.length > 0) {
            setEquipment(profile.equipment);
          }
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const toggleEquipment = (item: string) => {
    if (equipment.includes(item)) {
      if (equipment.length > 1) {
        setEquipment(equipment.filter(e => e !== item));
      }
    } else {
      setEquipment([...equipment, item]);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validateBiometrics({ age, heightCm, weightKg });
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'Please enter valid biometrics');
      return;
    }

    setSaving(true);
    try {
      // 1. Update fitness profile
      await profileService.saveFitnessProfile({
        userId,
        age,
        heightCm,
        weightKg,
        gender,
        goal,
        experienceLevel,
        daysPerWeek,
        workoutDurationMinutes: 60,
        equipment,
        dietaryPreference: 'vegetarian',
        limitations: [],
      });

      // 2. Synchronize calculated nutrition profile
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

      setSuccessMsg('Profile and updated nutrition targets saved successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading account profile...</p>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) var(--space-12)', maxWidth: '720px' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--space-1)' }}>Athlete Account</span>
        <h1>Profile & Preferences</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Manage your biometric baselines, training goals, and equipment settings.
        </p>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--accent-success)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-success)',
            fontSize: '0.9rem',
            marginBottom: 'var(--space-4)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(255, 77, 77, 0.15)',
            border: '1px solid var(--accent-fire)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-fire)',
            fontSize: '0.9rem',
            marginBottom: 'var(--space-4)',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Account Info Card */}
      <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <User size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>{session.user?.email || 'Guest User'}</h3>
              <small style={{ color: 'var(--text-muted)' }}>Supabase Authenticated Account</small>
            </div>
          </div>

          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Biometrics & Preferences Form */}
      <form onSubmit={handleSaveProfile} className="card card-elevated" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Shield size={20} color="var(--accent-primary)" /> Biometrics & Metabolism
        </h3>

        <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div className="input-group">
            <label className="label">Current Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={weightKg}
              onChange={e => setWeightKg(parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          <div className="input-group">
            <label className="label">Height (cm)</label>
            <input
              type="number"
              className="input"
              value={heightCm}
              onChange={e => setHeightCm(parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          <div className="input-group">
            <label className="label">Age</label>
            <input
              type="number"
              className="input"
              value={age}
              onChange={e => setAge(parseInt(e.target.value) || 0)}
              required
            />
          </div>
          <div className="input-group">
            <label className="label">Biological Sex</label>
            <select className="select" value={gender} onChange={e => setGender(e.target.value as Gender)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Dumbbell size={20} color="var(--accent-primary)" /> Training Preferences
        </h3>

        <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div className="input-group">
            <label className="label">Primary Goal</label>
            <select className="select" value={goal} onChange={e => setGoal(e.target.value as FitnessGoal)}>
              <option value="muscle_gain">Hypertrophy (Muscle Gain)</option>
              <option value="strength">Pure Strength</option>
              <option value="fat_loss">Fat Loss</option>
              <option value="endurance">Endurance & Conditioning</option>
            </select>
          </div>
          <div className="input-group">
            <label className="label">Experience Level</label>
            <select className="select" value={experienceLevel} onChange={e => setExperienceLevel(e.target.value as ExperienceLevel)}>
              <option value="beginner">Beginner (&lt; 1 yr)</option>
              <option value="intermediate">Intermediate (1-3 yrs)</option>
              <option value="advanced">Advanced (3+ yrs)</option>
            </select>
          </div>
        </div>

        {/* Equipment Selector */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <label className="label">Available Equipment</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {['Barbell', 'Dumbbells', 'Cable', 'Bodyweight', 'Machines'].map(item => {
              const active = equipment.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipment(item)}
                  className={`badge ${active ? 'badge-accent' : 'badge-secondary'}`}
                  style={{ padding: '6px 12px', cursor: 'pointer', border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-medium)' }}
                >
                  {item} {active ? '✓' : '+'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save button */}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save Profile Changes'}
        </button>
      </form>

      {/* Link to Rebuild Plan */}
      <div className="card" style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h4 style={{ fontSize: '1.05rem' }}>Want to change your workout split?</h4>
          <small style={{ color: 'var(--text-muted)' }}>Generate and preview a new training schedule</small>
        </div>
        <Link to="/plan/build" className="btn btn-outline btn-sm">
          Rebuild Training Plan →
        </Link>
      </div>
    </div>
  );
};
