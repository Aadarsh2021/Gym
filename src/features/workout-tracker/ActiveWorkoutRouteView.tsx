import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { workoutService } from '@/services/workout.service';
import { profileService } from '@/services/profile.service';
import { WorkoutSession, WorkoutPlanDay } from '@/types/workout.types';
import {
  loadActiveSessionDraft,
  saveActiveSessionDraft,
  clearActiveSessionDraft,
  isSessionDraftStale,
} from '@/utils/storage';
import { getTodaysScheduledWorkout } from '@/domain/scheduled-workout';
import { compressWorkoutForDuration, normalizeTimeMode } from '@/domain/quick-workout';
import { WorkoutTrackerView } from './WorkoutTrackerView';
import { Dumbbell, Zap, AlertTriangle } from 'lucide-react';

export const ActiveWorkoutRouteView: React.FC = () => {
  const { session: authSession } = useAuth();
  const userId = authSession.user?.id || 'guest-user';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDayId = searchParams.get('dayId');
  const durationParam = searchParams.get('duration');
  const isQuickMode = searchParams.get('mode') === 'quick' || Boolean(durationParam);

  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeModeError, setTimeModeError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);

  const [showCountdown, setShowCountdown] = useState<boolean>(() => {
    const draft = loadActiveSessionDraft(userId);
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
      try {
        // ---------------------------------------------------------------------
        // 1. TWO-TIER SMART RESUME RESOLUTION
        // ---------------------------------------------------------------------
        // Tier 1: Local storage draft (user-scoped)
        const localDraft = loadActiveSessionDraft(userId);

        // Tier 2: Remote Supabase in-progress session
        let remoteSession: WorkoutSession | null = null;
        try {
          remoteSession = await workoutService.getActiveSession(userId);
        } catch {
          // If remote fails, localDraft remains authoritative
        }

        // Check for staleness (> 12 hours)
        let hasStaleDiscarded = false;
        if (remoteSession && isSessionDraftStale(undefined, remoteSession.startedAt)) {
          await workoutService.cancelActiveSession(remoteSession.id, userId);
          remoteSession = null;
          hasStaleDiscarded = true;
        }

        if (localDraft && isSessionDraftStale(undefined, localDraft.startedAt)) {
          clearActiveSessionDraft(userId);
          hasStaleDiscarded = true;
        }

        if (hasStaleDiscarded && isMounted) {
          setStaleNotice('A previous session older than 12 hours was archived. Ready for a fresh workout!');
        }

        // Reconcile valid in-progress session
        let resolvedSession: WorkoutSession | null = null;
        if (localDraft && localDraft.status === 'in_progress' && remoteSession && remoteSession.status === 'in_progress') {
          // If both exist, local draft has in-flight timer and set inputs
          resolvedSession = localDraft;
        } else if (localDraft && localDraft.status === 'in_progress') {
          resolvedSession = localDraft;
        } else if (remoteSession && remoteSession.status === 'in_progress') {
          resolvedSession = remoteSession;
          saveActiveSessionDraft(remoteSession, userId);
        }

        if (resolvedSession) {
          if (isMounted) {
            setActiveSession(resolvedSession);
            setShowCountdown(false); // Do not block resumption with countdown
            setLoading(false);
          }
          return;
        }

        // ---------------------------------------------------------------------
        // 2. INITIALIZE NEW WORKOUT SESSION FROM ACTIVE PLAN
        // ---------------------------------------------------------------------
        const [plan, recentHistory, fitnessProfile] = await Promise.all([
          workoutService.getActivePlan(userId),
          workoutService.getWorkoutHistory(userId, 5),
          profileService.getFitnessProfile(userId).catch(() => null),
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

        // Apply Workout Time Mode compression
        const targetDuration = durationParam
          ? parseInt(durationParam, 10)
          : searchParams.get('mode') === 'quick'
          ? 20
          : 60;

        const timeModeResult = compressWorkoutForDuration(targetDay, targetDuration, {
          workoutEnvironment: fitnessProfile?.workoutEnvironment,
          availableEquipment: fitnessProfile?.equipment,
          limitations: fitnessProfile?.limitations,
        });

        // CORRECTION 1: Zero valid exercises -> return safe error state without arbitrary fallback
        if (!timeModeResult.success || timeModeResult.planDay.exercises.length === 0) {
          if (isMounted) {
            setTimeModeError(
              timeModeResult.error ||
                'No compatible exercises found matching your environment and physical safety profile. Please update your equipment in profile or select another routine.'
            );
            setLoading(false);
          }
          return;
        }

        const scheduledDay = timeModeResult.planDay;
        const isGymVerified = searchParams.get('gymVerified') === '1';

        // Mint persistent UUIDs upfront
        const newSessionId = crypto.randomUUID();
        const newSession: WorkoutSession = {
          id: newSessionId,
          userId,
          planId: plan.id,
          name: scheduledDay.name,
          status: 'in_progress',
          gymVerified: isGymVerified,
          startedAt: new Date().toISOString(),
          durationSeconds: 0,
          exercises: scheduledDay.exercises.map((wpe, idx) => {
            const sessionExerciseId = crypto.randomUUID();
            return {
              id: sessionExerciseId,
              exerciseId: wpe.exerciseId,
              exerciseName: wpe.exercise?.name || 'Movement',
              primaryMuscle: wpe.exercise?.primaryMuscle || 'Target Muscle',
              orderIndex: idx + 1,
              targetRepsMin: wpe.targetRepsMin,
              targetRepsMax: wpe.targetRepsMax,
              restSeconds: wpe.restSeconds,
              isCore: wpe.isCore,
              sets: Array.from({ length: wpe.targetSets || 3 }, (_, sIdx) => ({
                id: crypto.randomUUID(),
                setIndex: sIdx + 1,
                weightKg: 40,
                reps: wpe.targetRepsMin || 10,
                completed: false,
              })),
            };
          }),
        };

        // Proactively save to local storage and remote DB for resilience
        saveActiveSessionDraft(newSession, userId);
        workoutService.saveWorkoutSession(newSession).catch(() => {});

        if (isMounted) {
          setActiveSession(newSession);
        }
      } catch (err) {
        // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeSession();
    return () => {
      isMounted = false;
    };
  }, [userId, requestedDayId, durationParam]);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Preparing workout tracker...</p>
      </div>
    );
  }

  // Safe failure state when 0 valid exercises exist (Correction 1)
  if (timeModeError) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '560px', textAlign: 'center' }}>
        <div className="card" style={{ padding: 'var(--space-8)', borderColor: 'var(--color-error)' }}>
          <AlertTriangle size={36} color="var(--color-error)" style={{ margin: '0 auto var(--space-3)' }} />
          <h3>No Compatible Exercises</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', fontSize: '0.94rem' }}>
            {timeModeError}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <Link to="/app/workouts" className="btn btn-outline">
              Back to Routines
            </Link>
            <Link to="/app/profile" className="btn btn-primary">
              Adjust Equipment Profile
            </Link>
          </div>
        </div>
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
          {isQuickMode ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              <Zap size={14} /> Time Mode ({normalizeTimeMode(durationParam || 20)}m)
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
      {staleNotice && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(234, 179, 8, 0.15)',
            borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#eab308',
            fontSize: '0.85rem',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {staleNotice}
        </div>
      )}
      <WorkoutTrackerView
        session={activeSession}
        isShortOnTime={isQuickMode}
        onFinish={() => {
          clearActiveSessionDraft(userId);
          navigate('/app');
        }}
        onViewProgress={() => {
          clearActiveSessionDraft(userId);
          navigate('/app/progress');
        }}
        onCancel={() => {
          if (confirm('Are you sure you want to cancel and exit this active workout session?')) {
            if (activeSession) {
              workoutService.cancelActiveSession(activeSession.id, userId);
            }
            clearActiveSessionDraft(userId);
            navigate('/app/workouts');
          }
        }}
      />
    </div>
  );
};
