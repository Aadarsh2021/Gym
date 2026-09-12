import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { workoutService } from '@/services/workout.service';
import { WorkoutSession, WorkoutPlanDay } from '@/types/workout.types';
import { loadActiveSessionDraft, clearActiveSessionDraft } from '@/utils/storage';
import { getTodaysScheduledWorkout } from '@/domain/scheduled-workout';
import { WorkoutTrackerView } from './WorkoutTrackerView';
import { Dumbbell, Zap } from 'lucide-react';

export const ActiveWorkoutRouteView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDayId = searchParams.get('dayId');

  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCountdown, setShowCountdown] = useState<boolean>(() => {
    const draft = loadActiveSessionDraft();
    return !(draft && draft.status === 'in_progress');
  });
  const [countdownSeconds, setCountdownSeconds] = useState<number>(5);

  useEffect(() => {
    if (!showCountdown) return;
    if (countdownSeconds <= 0) {
      setShowCountdown(false);
      return;
    }
    const timer = setTimeout(() => {
      setCountdownSeconds(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [showCountdown, countdownSeconds]);

  useEffect(() => {
    let isMounted = true;
    const initializeSession = async () => {
      // 1. Check for existing in-progress local session draft
      const draft = loadActiveSessionDraft();
      if (draft && draft.status === 'in_progress') {
        if (isMounted) {
          setActiveSession(draft);
          setLoading(false);
        }
        return;
      }

      // 2. Otherwise initialize new session from active plan
      try {
        const [plan, recentHistory] = await Promise.all([
          workoutService.getActivePlan(userId),
          workoutService.getWorkoutHistory(userId, 5),
        ]);

        if (!plan || !plan.days || plan.days.length === 0) {
          if (isMounted) setLoading(false);
          return;
        }

        // Determine which day to start: requestedDayId or scheduled day
        let targetDay: WorkoutPlanDay | undefined;
        if (requestedDayId) {
          targetDay = plan.days.find(d => d.id === requestedDayId);
        }

        if (!targetDay) {
          const scheduleResult = getTodaysScheduledWorkout({
            activePlan: plan,
            currentDate: new Date(),
            completedSessions: recentHistory,
          });
          targetDay = scheduleResult.scheduledDay || plan.days[0];
        }

        const isGymVerified = searchParams.get('gymVerified') === '1';

        const newSession: WorkoutSession = {
          id: `session-${Date.now()}`,
          userId,
          planId: plan.id,
          name: targetDay.name,
          status: 'in_progress',
          gymVerified: isGymVerified,
          startedAt: new Date().toISOString(),
          durationSeconds: 0,
          exercises: targetDay.exercises.map((wpe, idx) => ({
            exerciseId: wpe.exerciseId,
            exerciseName: wpe.exercise?.name || 'Movement',
            primaryMuscle: wpe.exercise?.primaryMuscle || 'Target Muscle',
            orderIndex: idx + 1,
            targetRepsMin: wpe.targetRepsMin,
            targetRepsMax: wpe.targetRepsMax,
            restSeconds: wpe.restSeconds,
            isCore: wpe.isCore,
            sets: Array.from({ length: wpe.targetSets }, (_, sIdx) => ({
              setIndex: sIdx + 1,
              weightKg: 40,
              reps: wpe.targetRepsMin,
              completed: false,
            })),
          })),
        };

        if (isMounted) {
          setActiveSession(newSession);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeSession();
    return () => {
      isMounted = false;
    };
  }, [userId, requestedDayId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Preparing workout tracker...</p>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '560px', textAlign: 'center' }}>
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <Dumbbell size={36} color="var(--accent-primary)" style={{ margin: '0 auto var(--space-3)' }} />
          <h3>No Active Workout Ready</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            Please build or select a training routine to launch a gym tracking session.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <Link to="/app" className="btn btn-outline">
              Back to Home
            </Link>
            <Link to="/plan/build" className="btn btn-primary">
              Build Training Plan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Pre-Workout Countdown
  if (showCountdown) {
    return (
      <div
        className="container animate-fade-in"
        style={{
          padding: 'var(--space-12) var(--space-4)',
          maxWidth: '520px',
          textAlign: 'center',
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          {searchParams.get('mode') === 'quick' ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              <Zap size={14} /> Short on Time Mode (15m - Core Lifts)
            </div>
          ) : (
            <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>
              Workout Countdown
            </span>
          )}
          <h2 style={{ marginBottom: 'var(--space-1)', fontSize: '1.6rem' }}>Get Ready, Athlete!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.92rem' }}>
            Preparing <strong>{activeSession.name}</strong>. Set your mindset, review your weights, and brace your core.
          </p>

          <div
            style={{
              fontSize: '5rem',
              fontWeight: 900,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-primary)',
              lineHeight: 1,
              margin: 'var(--space-5) 0',
              letterSpacing: '-0.04em',
            }}
          >
            {countdownSeconds > 0 ? countdownSeconds : 'GO!'}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCountdown(false)}
            >
              Start Session Now →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <WorkoutTrackerView
        session={activeSession}
        isShortOnTime={searchParams.get('mode') === 'quick'}
        onFinish={() => {
          clearActiveSessionDraft();
          navigate('/app');
        }}
        onViewProgress={() => {
          clearActiveSessionDraft();
          navigate('/app/progress');
        }}
        onCancel={() => {
          if (confirm('Are you sure you want to cancel and exit this active workout session?')) {
            clearActiveSessionDraft();
            navigate('/app/workouts');
          }
        }}
      />
    </div>
  );
};
