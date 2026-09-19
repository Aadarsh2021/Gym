import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profile.service';
import { exerciseService, FALLBACK_EXERCISES } from '@/services/exercise.service';
import { generateWorkoutPlan } from '@/domain/workout-generator';
import { saveDraftPlan } from '@/utils/storage';
import { ExperienceLevel, FitnessGoal, WorkoutEnvironment, FitnessProfile } from '@/types/user.types';

export const PlanBuilderView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();

  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [goal, setGoal] = useState<FitnessGoal>('muscle_gain');
  const [equipment, setEquipment] = useState<string[]>(['Barbell', 'Dumbbells', 'Bodyweight']);
  const [workoutEnvironment, setWorkoutEnvironment] = useState<WorkoutEnvironment | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [limitations, setLimitations] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadProfileDefaults = async () => {
      try {
        const profile = await profileService.getFitnessProfile(userId);
        if (isMounted) {
          setFitnessProfile(profile);
        }
        if (isMounted && profile) {
          if (profile.daysPerWeek) setDaysPerWeek(profile.daysPerWeek);
          if (profile.experienceLevel) setExperienceLevel(profile.experienceLevel);
          if (profile.goal) setGoal(profile.goal);
          if (profile.workoutEnvironment) {
            setWorkoutEnvironment(profile.workoutEnvironment);
            if (profile.workoutEnvironment === 'home_bodyweight') {
              setEquipment(['Bodyweight']);
            } else if (profile.equipment && profile.equipment.length > 0) {
              setEquipment(profile.equipment);
            }
          } else if (profile.equipment && profile.equipment.length > 0) {
            setEquipment(profile.equipment);
          }
          if (profile.limitations && profile.limitations.length > 0) setLimitations(profile.limitations);
        }
      } catch {
        // Fallback to initial defaults
      } finally {
        if (isMounted) setFetchingProfile(false);
      }
    };
    loadProfileDefaults();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const toggleEquipment = (item: string) => {
    if (workoutEnvironment === 'home_bodyweight') return; // Locked to bodyweight
    if (equipment.includes(item)) {
      if (equipment.length > 1) {
        setEquipment(equipment.filter(e => e !== item));
      }
    } else {
      setEquipment([...equipment, item]);
    }
  };

  const handleGeneratePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const exercises = await exerciseService.getExercises().catch(() => FALLBACK_EXERCISES);
      const availableExercises = exercises.length > 0 ? exercises : FALLBACK_EXERCISES;

      // Pure deterministic plan generation with authoritative workout environment
      const generatedPlan = generateWorkoutPlan({
        daysPerWeek,
        experienceLevel,
        equipment,
        workoutEnvironment,
        goal,
        availableExercises,
        limitations,
      });

      if (!generatedPlan.isValid) {
        setError(
          'Workout plan generation failed: Insufficient exercise coverage for your selected training environment and limitations. Please adjust your equipment or limitations.'
        );
        return;
      }

      // Save to temporary draft storage across refreshes (Safe across refreshes)
      saveDraftPlan(generatedPlan);

      // Navigate to review screen without persisting to Supabase active plan yet
      navigate('/plan/review');
    } catch {
      setError('An error occurred while generating your workout plan. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingProfile) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading training preferences...</p>
      </div>
    );
  }

  // Plan Build Guard: Require a valid fitness profile with goal before generating a plan
  if (!fitnessProfile || !fitnessProfile.goal) {
    return (
      <div className="container-narrow animate-fade-in" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-8) var(--space-6)', maxWidth: '520px', margin: '0 auto' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(249, 115, 22, 0.15)',
              color: 'var(--accent-fire)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.35rem', margin: '0 0 var(--space-2)' }}>
            Finish Setting Up Your Athlete Profile
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 var(--space-6)' }}>
            Generating a structured, science-backed workout routine requires your fitness goal and biometric preferences. Please complete your profile setup before building a personalized plan.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => navigate('/onboarding')}
          >
            Complete Your Profile →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>Structured Training Architecture</span>
        <h1>Build Your Workout Plan</h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
          Configure your training split. Generate a science-backed routine tailored to your frequency and equipment.
        </p>
      </div>

      <div className="card card-elevated" style={{ padding: 'var(--space-8) var(--space-6)' }}>
        {/* 1. Days Per Week */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <label className="label" style={{ margin: 0, fontWeight: 700 }}>Training Frequency</label>
            <span className="badge badge-fire">{daysPerWeek} Days / Week</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
            {daysPerWeek <= 3 && 'Foundational Full Body split: High frequency per muscle group with maximum recovery.'}
            {daysPerWeek === 4 && 'Upper / Lower split: Optimal hypertrophy and mechanical tension distribution.'}
            {daysPerWeek >= 5 && 'Push / Pull / Legs split: High volume target isolation for intermediate & advanced lifters.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {[3, 4, 5, 6].map(num => (
              <button
                key={num}
                type="button"
                className={`btn ${daysPerWeek === num ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setDaysPerWeek(num)}
              >
                {num} Days
              </button>
            ))}
          </div>
        </div>

        {/* 2. Experience Level */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <label className="label" style={{ fontWeight: 700 }}>Experience Level</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {[
              { id: 'beginner', label: 'Beginner (<1 yr)' },
              { id: 'intermediate', label: 'Intermediate (1-3 yrs)' },
              { id: 'advanced', label: 'Advanced (3+ yrs)' },
            ].map(lvl => (
              <button
                key={lvl.id}
                type="button"
                className={`btn btn-sm ${experienceLevel === lvl.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: 'var(--space-3) var(--space-2)', fontSize: '0.85rem' }}
                onClick={() => setExperienceLevel(lvl.id as ExperienceLevel)}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Primary Goal */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <label className="label" style={{ fontWeight: 700 }}>Primary Objective</label>
          <div className="grid grid-cols-2" style={{ gap: 'var(--space-2)' }}>
            {[
              { id: 'muscle_gain', label: 'Hypertrophy (Muscle Gain)' },
              { id: 'strength', label: 'Pure Strength' },
              { id: 'fat_loss', label: 'Fat Loss / Retention' },
              { id: 'endurance', label: 'Athletic Conditioning' },
            ].map(g => (
              <button
                key={g.id}
                type="button"
                className={`btn btn-sm ${goal === g.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: 'var(--space-3)', textAlign: 'left', justifyContent: 'flex-start' }}
                onClick={() => setGoal(g.id as FitnessGoal)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Equipment */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <label className="label" style={{ fontWeight: 700 }}>Available Equipment</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {['Barbell', 'Dumbbells', 'Cable', 'Bodyweight', 'Machines'].map(item => {
              const active = equipment.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipment(item)}
                  className={`badge ${active ? 'badge-accent' : 'badge-secondary'}`}
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-medium)',
                  }}
                >
                  {item} {active ? '✓' : '+'}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'rgba(255, 77, 77, 0.15)',
              border: '1px solid var(--accent-fire)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-fire)',
              fontSize: '0.88rem',
              marginBottom: 'var(--space-4)',
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        {/* Action button */}
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={handleGeneratePlan}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {loading ? 'Synthesizing Split...' : 'Generate Plan Preview'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
