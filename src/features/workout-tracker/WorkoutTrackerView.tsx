import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  Plus,
  AlertCircle,
  X,
  ArrowRightLeft,
  Trash2,
  List,
  LayoutGrid,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { gymSafetyService } from '@/services/gym-safety.service';
import { WorkoutSession, WorkoutSet, SetType, Exercise } from '@/types/workout.types';
import { useRestTimer } from '@/hooks/useRestTimer';
import { formatTimerClock } from '@/utils/formatters';
import { workoutService } from '@/services/workout.service';
import { exerciseService } from '@/services/exercise.service';
import { saveActiveSessionDraft } from '@/utils/storage';
import { evaluateProgression } from '@/domain/progression';
import { hasCompletedCoreExercise } from '@/domain/streak-calculator';
import { useEntitlement } from '@/hooks/useEntitlement';
import { PremiumLockedSection } from '@/components/PremiumLockedSection';
import { ExerciseLibraryView } from '@/features/exercise-library/ExerciseLibraryView';
import { WorkoutSummaryModal } from './WorkoutSummaryModal';
import { GuidedExerciseStage } from './GuidedExerciseStage';
import { GuidedRestOverlay } from './GuidedRestOverlay';
import { GuidedWorkoutOutlineDrawer } from './GuidedWorkoutOutlineDrawer';
import { GuidedCockpitSidebar } from './GuidedCockpitSidebar';
import { platform } from '@/platform';

interface WorkoutTrackerViewProps {
  session: WorkoutSession;
  isShortOnTime?: boolean;
  onFinish: (summary?: any) => void;
  onCancel: () => void;
  onViewProgress?: () => void;
}

export const WorkoutTrackerView: React.FC<WorkoutTrackerViewProps> = ({
  session: initialSession,
  isShortOnTime = false,
  onFinish,
  onCancel,
  onViewProgress,
}) => {
  const { canAccessAlternatives } = useEntitlement();
  const [session, setSession] = useState<WorkoutSession>(initialSession);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(initialSession.durationSeconds || 0);

  // Short on Time Mode State & Intentional Unlock
  const [shortTimeMode, setShortTimeMode] = useState<boolean>(Boolean(isShortOnTime));
  const [unlockedExerciseIndices, setUnlockedExerciseIndices] = useState<number[]>([]);

  const handleUnlockExercise = (idx: number) => {
    setUnlockedExerciseIndices(prev => (prev.includes(idx) ? prev : [...prev, idx]));
  };

  // Guided Mode Navigation & State (Guided is DEFAULT)
  const [viewMode, setViewMode] = useState<'guided' | 'overview'>('guided');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(() => {
    // If restoring, point to first exercise with uncompleted sets
    const exIdx = initialSession.exercises.findIndex(e => e.sets.some(s => !s.completed));
    return exIdx >= 0 ? exIdx : 0;
  });

  const [currentSetIndex, setCurrentSetIndex] = useState<number>(() => {
    const activeEx = initialSession.exercises[0];
    if (!activeEx) return 0;
    const sIdx = activeEx.sets.findIndex(s => !s.completed);
    return sIdx >= 0 ? sIdx : 0;
  });

  const [isResting, setIsResting] = useState<boolean>(false);
  const [isOutlineDrawerOpen, setIsOutlineDrawerOpen] = useState<boolean>(false);
  const [startedExerciseIndices, setStartedExerciseIndices] = useState<number[]>(() => {
    return initialSession.exercises
      .map((ex, idx) => (ex.sets.some(s => s.completed) ? idx : -1))
      .filter(idx => idx >= 0);
  });

  // Modals & Completion State
  const [isFinishingModalOpen, setIsFinishingModalOpen] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionRating, setSessionRating] = useState<'easy' | 'normal' | 'exhausting'>('normal');
  const [sessionNotes, setSessionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase G6: Emergency SOS State
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosLocationDetails, setSosLocationDetails] = useState('');
  const [isTriggeringSos, setIsTriggeringSos] = useState(false);
  const [sosFeedback, setSosFeedback] = useState<string | null>(null);

  // Exercise Substitution & Addition
  const [exerciseToSwapIndex, setExerciseToSwapIndex] = useState<number | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);

  // Previous performance map: exerciseId -> { weightKg, reps, rpe }
  const [performanceMap, setPerformanceMap] = useState<Record<string, { weightKg: number; reps: number; rpe?: number }>>({});
  // Existing PR map: exerciseId -> estimatedOneRepMax
  const [existingPrsMap, setExistingPrsMap] = useState<Record<string, number>>({});

  // Rest Timer Hook with Web Audio API chime
  const {
    secondsRemaining,
    progressFraction,
    isActive: isTimerActive,
    isPaused: isTimerPaused,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    addTime,
    subtractTime,
  } = useRestTimer();

  // Load previous performances, PRs & available catalog
  useEffect(() => {
    let mounted = true;
    workoutService.getPreviousPerformanceMap(session.userId).then(map => {
      if (mounted) setPerformanceMap(map);
    });
    workoutService.getPersonalRecords(session.userId).then(records => {
      if (mounted) {
        const prMap: Record<string, number> = {};
        records.forEach(r => {
          prMap[r.exerciseId] = r.estimatedOneRepMax;
        });
        setExistingPrsMap(prMap);
      }
    });
    exerciseService.getExercises().then(list => {
      if (mounted) setAvailableExercises(list);
    });
    return () => { mounted = false; };
  }, [session.userId]);

  // Elapsed session duration clock
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tier 1: Sync draft to local storage immediately on every state change
  useEffect(() => {
    saveActiveSessionDraft(
      {
        ...session,
        durationSeconds: elapsedSeconds,
      },
      session.userId
    );
  }, [session, elapsedSeconds]);

  // Tier 2: Debounced autosave to remote database (every 5 seconds when changes occur)
  useEffect(() => {
    const handler = setTimeout(() => {
      workoutService.saveWorkoutSession({
        ...session,
        durationSeconds: elapsedSeconds,
      }).catch(() => {});
    }, 5000);
    return () => clearTimeout(handler);
  }, [session, elapsedSeconds]);

  // When rest timer reaches 0 naturally: auto-advance to next set
  useEffect(() => {
    if (isResting && !isTimerActive && secondsRemaining === 0) {
      setIsResting(false);
      const currentEx = session.exercises[currentExerciseIndex];
      if (currentEx && currentSetIndex < currentEx.sets.length - 1) {
        setCurrentSetIndex(prev => prev + 1);
      }
    }
  }, [isResting, isTimerActive, secondsRemaining, currentExerciseIndex, currentSetIndex, session.exercises]);

  // Unlock Web Audio from synchronous user gesture on first interaction
  useEffect(() => {
    const handleGesture = () => {
      platform.audio.unlockAudio?.();
    };
    window.addEventListener('click', handleGesture, { once: true, passive: true });
    window.addEventListener('touchstart', handleGesture, { once: true, passive: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, []);

  // Toggle set completed with strict Last-Set rule (User Correction #3)
  const toggleSetCompleted = (exerciseIndex: number, setIndex: number) => {
    platform.audio.unlockAudio?.();
    const targetEx = session.exercises[exerciseIndex];
    if (!targetEx) return;

    const willBeCompleted = !targetEx.sets[setIndex].completed;
    const isLastSetOfEx = setIndex === targetEx.sets.length - 1;

    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const exToUpdate = { ...updatedExercises[exerciseIndex] };
      const updatedSets = [...exToUpdate.sets];
      const targetSet = { ...updatedSets[setIndex] };

      targetSet.completed = willBeCompleted;
      if (willBeCompleted) {
        targetSet.completedAt = new Date().toISOString();
      }

      updatedSets[setIndex] = targetSet;
      exToUpdate.sets = updatedSets;
      updatedExercises[exerciseIndex] = exToUpdate;
      return { ...prev, exercises: updatedExercises };
    });

    if (willBeCompleted) {
      // RULE 3: If this is the LAST SET of the exercise, do NOT start another rest interval by default
      if (isLastSetOfEx) {
        stopTimer();
        setIsResting(false);
      } else {
        // Normal set -> complete -> rest -> next set
        const restDuration = targetEx.restSeconds || 90;
        startTimer(restDuration);
        setIsResting(true);
      }
    } else {
      // Undoing completion
      stopTimer();
      setIsResting(false);
    }
  };

  // Skip rest interval manually
  const handleSkipRest = () => {
    stopTimer();
    setIsResting(false);
    const currentEx = session.exercises[currentExerciseIndex];
    if (currentEx && currentSetIndex < currentEx.sets.length - 1) {
      setCurrentSetIndex(prev => prev + 1);
    }
  };

  // Update set values
  const updateSetValue = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof WorkoutSet,
    val: any
  ) => {
    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const targetEx = { ...updatedExercises[exerciseIndex] };
      const updatedSets = [...targetEx.sets];
      updatedSets[setIndex] = { ...updatedSets[setIndex], [field]: val };
      targetEx.sets = updatedSets;
      updatedExercises[exerciseIndex] = targetEx;
      return { ...prev, exercises: updatedExercises };
    });
  };

  // Adjust weight with stepper (+2.5, -2.5, +5, etc.)
  const adjustWeight = (exerciseIndex: number, setIndex: number, delta: number) => {
    platform.audio.unlockAudio?.();
    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const targetEx = { ...updatedExercises[exerciseIndex] };
      const updatedSets = [...targetEx.sets];
      const currentWeight = updatedSets[setIndex].weightKg || 0;
      const nextWeight = Math.max(0, parseFloat((currentWeight + delta).toFixed(1)));

      updatedSets[setIndex] = { ...updatedSets[setIndex], weightKg: nextWeight };
      targetEx.sets = updatedSets;
      updatedExercises[exerciseIndex] = targetEx;
      return { ...prev, exercises: updatedExercises };
    });
  };

  // Add new set to exercise
  const addSetToExercise = (exerciseIndex: number) => {
    platform.audio.unlockAudio?.();
    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const targetEx = { ...updatedExercises[exerciseIndex] };
      const lastSet = targetEx.sets[targetEx.sets.length - 1];
      const newSetIndex = targetEx.sets.length + 1;

      targetEx.sets = [
        ...targetEx.sets,
        {
          setIndex: newSetIndex,
          setType: 'normal',
          weightKg: lastSet ? lastSet.weightKg : 40,
          reps: lastSet ? lastSet.reps : 10,
          rpe: 8,
          completed: false,
        },
      ];
      updatedExercises[exerciseIndex] = targetEx;
      return { ...prev, exercises: updatedExercises };
    });
  };

  // Remove set from exercise (preserving at least 1 set)
  const removeSetFromExercise = (exerciseIndex: number, setIndex: number) => {
    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const targetEx = { ...updatedExercises[exerciseIndex] };
      if (targetEx.sets.length <= 1) return prev;

      const filteredSets = targetEx.sets
        .filter((_, idx) => idx !== setIndex)
        .map((s, idx) => ({ ...s, setIndex: idx + 1 }));

      targetEx.sets = filteredSets;
      updatedExercises[exerciseIndex] = targetEx;
      return { ...prev, exercises: updatedExercises };
    });

    const curEx = session.exercises[exerciseIndex];
    if (curEx && currentSetIndex >= curEx.sets.length - 1) {
      setCurrentSetIndex(Math.max(0, curEx.sets.length - 2));
    }
  };

  // Select another exercise in the routine (Rule 5: preserve all data, point to first incomplete set)
  const handleSelectExercise = (newExIndex: number) => {
    if (newExIndex < 0 || newExIndex >= session.exercises.length) return;
    setCurrentExerciseIndex(newExIndex);
    const targetEx = session.exercises[newExIndex];
    if (targetEx) {
      const firstIncomplete = targetEx.sets.findIndex(s => !s.completed);
      setCurrentSetIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    }
    stopTimer();
    setIsResting(false);
  };

  // Swap exercise in-place preserving logged sets
  const handleSwapExercise = (newExercise: Exercise) => {
    if (exerciseToSwapIndex === null) return;

    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const current = updatedExercises[exerciseToSwapIndex];

      updatedExercises[exerciseToSwapIndex] = {
        ...current,
        exerciseId: newExercise.id,
        exerciseName: newExercise.name,
        primaryMuscle: newExercise.primaryMuscle,
      };

      return { ...prev, exercises: updatedExercises };
    });

    setExerciseToSwapIndex(null);
  };

  // Add new exercise from catalog into active workout
  const handleAddExerciseToWorkout = (newExercise: Exercise) => {
    setSession(prev => {
      const newExEntry = {
        exerciseId: newExercise.id,
        exerciseName: newExercise.name,
        primaryMuscle: newExercise.primaryMuscle,
        orderIndex: prev.exercises.length + 1,
        sets: [
          { setIndex: 1, setType: 'normal' as SetType, weightKg: 30, reps: 10, rpe: 8, completed: false },
          { setIndex: 2, setType: 'normal' as SetType, weightKg: 30, reps: 10, rpe: 8, completed: false },
          { setIndex: 3, setType: 'normal' as SetType, weightKg: 30, reps: 10, rpe: 8, completed: false },
        ],
      };

      return { ...prev, exercises: [...prev.exercises, newExEntry] };
    });

    setIsAddingExercise(false);
  };

  // Remove exercise from active workout
  const handleRemoveExercise = (exerciseIndex: number) => {
    const targetEx = session.exercises[exerciseIndex];
    const hasCompletedSets = targetEx.sets.some(s => s.completed);

    if (hasCompletedSets) {
      if (!confirm(`Are you sure you want to remove "${targetEx.exerciseName}"? Logged sets for this exercise will be deleted.`)) {
        return;
      }
    }

    setSession(prev => ({
      ...prev,
      exercises: prev.exercises
        .filter((_, idx) => idx !== exerciseIndex)
        .map((ex, idx) => ({ ...ex, orderIndex: idx + 1 })),
    }));

    if (currentExerciseIndex >= session.exercises.length - 1) {
      setCurrentExerciseIndex(Math.max(0, session.exercises.length - 2));
      setCurrentSetIndex(0);
    }
  };

  // Finalize workout via atomic RPC
  const handleFinalizeWorkout = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const currentSessionWithDuration: WorkoutSession = {
        ...session,
        durationSeconds: elapsedSeconds,
      };
      const idempotencyKey = `idemp-${session.id}-${Date.now()}`;
      const res = await workoutService.finishWorkoutSession(
        currentSessionWithDuration,
        idempotencyKey,
        sessionRating,
        sessionNotes
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to complete session');
      }

      setIsFinishingModalOpen(false);
      setShowSummaryModal(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error finalizing session';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics Accumulators
  const totalCompletedSets = useMemo(() => {
    return session.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter(s => s.completed).length,
      0
    );
  }, [session]);

  const totalSetsInWorkout = useMemo(() => {
    return session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  }, [session]);

  const totalVolumeKg = useMemo(() => {
    return session.exercises.reduce((sum, ex) => {
      return sum + ex.sets
        .filter(s => s.completed)
        .reduce((sSum, s) => sSum + (s.weightKg * s.reps), 0);
    }, 0);
  }, [session]);

  // Active Exercise & Sets Reference
  const currentExercise = session.exercises[currentExerciseIndex] || session.exercises[0];
  const nextExercise = session.exercises[currentExerciseIndex + 1];
  const activePreviousPerformance = currentExercise ? performanceMap[currentExercise.exerciseId] : undefined;

  const currentProgression = useMemo(() => {
    if (!currentExercise) {
      return {
        action: 'in_progress' as const,
        cue: 'Maintain strict control and fluid tempo across every set.',
        reason: 'Session initializing',
      };
    }
    return evaluateProgression({
      exerciseName: currentExercise.exerciseName,
      primaryMuscle: currentExercise.primaryMuscle,
      targetRepsMin: currentExercise.targetRepsMin || 8,
      targetRepsMax: currentExercise.targetRepsMax || 12,
      currentSets: currentExercise.sets,
      previousPerformance: activePreviousPerformance,
    });
  }, [currentExercise, activePreviousPerformance]);

  if (!currentExercise) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>No movements found in active session.</p>
      </div>
    );
  }

  return (
    <div
      className="container-workout animate-fade-in"
      style={{
        padding: 'var(--space-4) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-12))',
      }}
    >
      {/* GYM TOP ACTION BAR */}
      <div
        className="card card-elevated"
        style={{
          marginBottom: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-medium)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
              {session.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                ⏱ {formatTimerClock(elapsedSeconds)}
              </span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                • {totalCompletedSets}/{totalSetsInWorkout} sets logged
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
            {/* Phase G6: Emergency Floor SOS */}
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSosFeedback(null);
                setShowSosModal(true);
              }}
              style={{
                height: '34px',
                padding: '0 10px',
                fontSize: '0.78rem',
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.12)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                fontWeight: 700,
              }}
              title="Emergency Facility SOS"
            >
              <ShieldAlert size={14} color="#ef4444" />
              <span>SOS</span>
            </button>

            {/* Short on Time Toggle */}
            <button
              type="button"
              className={`btn btn-sm ${shortTimeMode ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setShortTimeMode(prev => !prev)}
              style={{
                height: '34px',
                padding: '0 10px',
                fontSize: '0.78rem',
                color: shortTimeMode ? '#eab308' : 'var(--text-muted)',
                borderColor: shortTimeMode ? 'rgba(234, 179, 8, 0.4)' : undefined,
              }}
              title="Toggle Short on Time Mode (Focus on Core Lifts)"
            >
              <Zap size={14} color={shortTimeMode ? '#eab308' : 'currentColor'} />
              <span className="guided-desktop-only">{shortTimeMode ? 'Short on Time' : 'Time Mode'}</span>
            </button>

            {/* Outline Drawer Trigger */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsOutlineDrawerOpen(true)}
              style={{ height: '34px', padding: '0 10px', fontSize: '0.78rem' }}
              title="All movements in split"
            >
              <List size={14} /> Movements
            </button>

            {/* Desktop Overview Mode Toggle */}
            <div className="guided-desktop-only">
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode(prev => prev === 'guided' ? 'overview' : 'guided')}
                style={{ height: '34px', padding: '0 10px', fontSize: '0.78rem' }}
                title="Toggle Table Overview Mode"
              >
                <LayoutGrid size={14} /> {viewMode === 'guided' ? 'Table View' : 'Guided View'}
              </button>
            </div>

            {/* Finish Workout Primary Action */}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsFinishingModalOpen(true)}
              style={{ height: '34px', padding: '0 12px', fontSize: '0.78rem', fontWeight: 800 }}
            >
              Finish
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          MODE 1: GUIDED ATHLETE EXPERIENCE (DEFAULT)
          ==================================================================== */}
      {viewMode === 'guided' ? (
        <div className="guided-workout-layout">
          {/* DESKTOP COLUMN 1: Pinned Outline & Movement Navigation */}
          <div className="guided-desktop-only guided-sidebar-left">
            <div
              className="card card-elevated"
              style={{
                padding: 'var(--space-4)',
                background: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-medium)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Workout
                </span>
                <span className="badge badge-accent" style={{ fontSize: '0.68rem' }}>
                  {session.exercises.length} Movements
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {session.exercises.map((ex, idx) => {
                  const completedCount = ex.sets.filter(s => s.completed).length;
                  const isAllDone = ex.sets.length > 0 && completedCount === ex.sets.length;
                  const isActive = idx === currentExerciseIndex;

                  return (
                    <div
                      key={ex.exerciseId || idx}
                      onClick={() => handleSelectExercise(idx)}
                      className="card card-interactive"
                      style={{
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: `1px solid ${isActive ? 'var(--accent-primary)' : isAllDone ? 'rgba(114, 184, 121, 0.35)' : 'var(--border-subtle)'}`,
                        background: isActive ? 'var(--accent-primary-muted)' : 'var(--bg-surface)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.85rem',
                            color: isAllDone ? 'var(--color-success)' : isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                            fontWeight: 800,
                            flexShrink: 0,
                            width: '16px',
                            textAlign: 'center',
                          }}
                        >
                          {isAllDone ? '✓' : isActive ? '●' : '○'}
                        </span>

                        <span
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? 'var(--text-primary)' : isAllDone ? 'var(--text-secondary)' : 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ex.exerciseName}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: isAllDone ? 'var(--color-success)' : isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                          marginLeft: '8px',
                          flexShrink: 0,
                        }}
                      >
                        {completedCount}/{ex.sets.length}
                      </span>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="btn btn-secondary btn-block btn-sm"
                  onClick={() => setIsAddingExercise(true)}
                  style={{ marginTop: 'var(--space-2)' }}
                >
                  <Plus size={14} /> Add Movement
                </button>
              </div>
            </div>
          </div>

          {/* CENTER STAGE: Active Guided Exercise OR Focused Rest Interval */}
          <div style={{ minWidth: 0 }}>
            {isResting && isTimerActive ? (
              <GuidedRestOverlay
                secondsRemaining={secondsRemaining}
                progressFraction={progressFraction}
                isPaused={isTimerPaused}
                onAddTime={addTime}
                onSubtractTime={subtractTime}
                onTogglePause={isTimerPaused ? resumeTimer : pauseTimer}
                onSkipRest={handleSkipRest}
                nextExerciseName={currentExercise.exerciseName}
                nextSetIndex={Math.min(currentExercise.sets.length, currentSetIndex + 2)}
                totalSets={currentExercise.sets.length}
                targetWeightKg={currentExercise.sets[currentSetIndex]?.weightKg || 40}
                targetReps={currentExercise.sets[currentSetIndex]?.reps || 10}
                previousPerformance={activePreviousPerformance}
              />
            ) : shortTimeMode && !currentExercise.isCore && !unlockedExerciseIndices.includes(currentExerciseIndex) ? (
              <div style={{ position: 'relative' }}>
                <div style={{ filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
                  <GuidedExerciseStage
                    exercise={currentExercise}
                    exerciseIndex={currentExerciseIndex}
                    totalExercises={session.exercises.length}
                    activeSetIndex={currentSetIndex}
                    hasStartedExercise={false}
                    onStartExercise={() => {}}
                    onSelectSet={() => {}}
                    onToggleSetCompleted={() => {}}
                    onUpdateSetValue={() => {}}
                    onAdjustWeight={() => {}}
                    onAddSet={() => {}}
                    onRemoveSet={() => {}}
                    onOpenSwapModal={() => {}}
                    onOpenOutlineDrawer={() => setIsOutlineDrawerOpen(true)}
                    onNextExercise={() => handleSelectExercise(currentExerciseIndex + 1)}
                    onPreviousExercise={currentExerciseIndex > 0 ? () => handleSelectExercise(currentExerciseIndex - 1) : undefined}
                    isLastExercise={currentExerciseIndex === session.exercises.length - 1}
                    onFinishWorkoutEarly={() => setIsFinishingModalOpen(true)}
                    progression={currentProgression}
                    previousPerformance={activePreviousPerformance}
                    nextExerciseName={nextExercise?.exerciseName}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    background: 'rgba(11, 13, 16, 0.72)',
                    backdropFilter: 'blur(5px)',
                    borderRadius: 'var(--radius-lg)',
                    zIndex: 10,
                  }}
                >
                  <div style={{ padding: '6px 12px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', borderRadius: 'var(--radius-full)', fontSize: '0.82rem', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={15} /> Short on Time: Optional Movement
                  </div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Focus on Core Lifts Today</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', fontSize: '0.9rem', lineHeight: 1.55, marginBottom: 'var(--space-4)' }}>
                    This optional accessory movement is visibly de-emphasized to prioritize your core training. You can unlock and log sets anytime without losing workout progress.
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleUnlockExercise(currentExerciseIndex)}
                    >
                      Unlock & Train Movement →
                    </button>
                    {session.exercises.findIndex(e => e.isCore && !e.sets.every(s => s.completed)) >= 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          const nextCoreIdx = session.exercises.findIndex(e => e.isCore && !e.sets.every(s => s.completed));
                          if (nextCoreIdx >= 0) handleSelectExercise(nextCoreIdx);
                        }}
                      >
                        Jump to Core Lift
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <GuidedExerciseStage
                exercise={currentExercise}
                exerciseIndex={currentExerciseIndex}
                totalExercises={session.exercises.length}
                activeSetIndex={currentSetIndex}
                hasStartedExercise={
                  startedExerciseIndices.includes(currentExerciseIndex) ||
                  currentExercise.sets.some(s => s.completed)
                }
                onStartExercise={() => {
                  setStartedExerciseIndices(prev =>
                    prev.includes(currentExerciseIndex) ? prev : [...prev, currentExerciseIndex]
                  );
                }}
                onSelectSet={setCurrentSetIndex}
                onToggleSetCompleted={toggleSetCompleted}
                onUpdateSetValue={updateSetValue}
                onAdjustWeight={adjustWeight}
                onAddSet={addSetToExercise}
                onRemoveSet={removeSetFromExercise}
                onOpenSwapModal={setExerciseToSwapIndex}
                onOpenOutlineDrawer={() => setIsOutlineDrawerOpen(true)}
                onNextExercise={() => handleSelectExercise(currentExerciseIndex + 1)}
                onPreviousExercise={currentExerciseIndex > 0 ? () => handleSelectExercise(currentExerciseIndex - 1) : undefined}
                isLastExercise={currentExerciseIndex === session.exercises.length - 1}
                onFinishWorkoutEarly={() => setIsFinishingModalOpen(true)}
                progression={currentProgression}
                previousPerformance={activePreviousPerformance}
                nextExerciseName={nextExercise?.exerciseName}
              />
            )}
          </div>

          {/* DESKTOP COLUMN 3: Cockpit Telemetry HUD */}
          <div className="guided-desktop-only guided-sidebar-right">
            <GuidedCockpitSidebar
              elapsedSeconds={elapsedSeconds}
              totalCompletedSets={totalCompletedSets}
              totalSetsInWorkout={totalSetsInWorkout}
              totalVolumeKg={totalVolumeKg}
              isRestActive={isResting && isTimerActive}
              restSecondsRemaining={secondsRemaining}
              restProgressFraction={progressFraction}
              onAddRestTime={addTime}
              onSubtractRestTime={subtractTime}
              onSkipRest={handleSkipRest}
              isRestPaused={isTimerPaused}
              onToggleRestPause={isTimerPaused ? resumeTimer : pauseTimer}
              standardRestSeconds={currentExercise.restSeconds || 90}
              previousPerformance={activePreviousPerformance}
              existing1RM={existingPrsMap[currentExercise.exerciseId]}
              progression={currentProgression}
              nextExerciseName={nextExercise?.exerciseName}
              nextExerciseMuscle={nextExercise?.primaryMuscle}
            />
          </div>
        </div>
      ) : (
        /* ====================================================================
            MODE 2: TABLE OVERVIEW MODE (ADVANCED SECONDARY VIEW)
            ==================================================================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Mode Switch Banner */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--accent-primary-muted)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              Viewing Full Table Overview Mode
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setViewMode('guided')}
            >
              Return to Guided Workout →
            </button>
          </div>

          {/* All Exercises List */}
          {session.exercises.map((exercise, exIndex) => {
            return (
              <div key={exercise.exerciseId || exIndex} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--bg-surface-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>#{exIndex + 1}</span>
                    <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{exercise.exerciseName}</h2>
                    <span className="badge">{exercise.primaryMuscle}</span>
                    {exercise.isCore ? (
                      <span className="badge badge-accent" style={{ fontSize: '0.68rem' }}>Core Lift</span>
                    ) : (
                      <span className="badge" style={{ fontSize: '0.68rem', opacity: 0.75 }}>Optional</span>
                    )}
                    {performanceMap[exercise.exerciseId] ? (
                      <span
                        className="badge badge-outline"
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          borderColor: 'var(--accent-primary)',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        Prev: {performanceMap[exercise.exerciseId].weightKg}kg × {performanceMap[exercise.exerciseId].reps}
                      </span>
                    ) : (
                      <span className="badge" style={{ fontSize: '0.68rem', opacity: 0.65 }}>
                        First time
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setExerciseToSwapIndex(exIndex)}>
                      <ArrowRightLeft size={14} /> Swap
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveExercise(exIndex)}>
                      <Trash2 size={14} color="var(--color-error)" />
                    </button>
                  </div>
                </div>

                {/* Table View with Short-on-Time blur protection */}
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      filter: shortTimeMode && !exercise.isCore && !unlockedExerciseIndices.includes(exIndex) ? 'blur(5px)' : 'none',
                      opacity: shortTimeMode && !exercise.isCore && !unlockedExerciseIndices.includes(exIndex) ? 0.35 : 1,
                      pointerEvents: shortTimeMode && !exercise.isCore && !unlockedExerciseIndices.includes(exIndex) ? 'none' : 'auto',
                      userSelect: shortTimeMode && !exercise.isCore && !unlockedExerciseIndices.includes(exIndex) ? 'none' : 'auto',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div className="workout-table-desktop">
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '48px 70px 1fr 1fr 70px 48px',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-2) var(--space-4)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          textAlign: 'center',
                        }}
                      >
                        <span>Set</span>
                        <span>Type</span>
                        <span>Weight (kg)</span>
                        <span>Reps</span>
                        <span>RPE</span>
                        <span>Done</span>
                      </div>

                      <div style={{ padding: '0 var(--space-4) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {exercise.sets.map((set, setIndex) => (
                          <div
                            key={setIndex}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '48px 70px 1fr 1fr 70px 48px',
                              gap: 'var(--space-2)',
                              alignItems: 'center',
                              padding: 'var(--space-2)',
                              background: set.completed ? 'var(--color-success-muted)' : 'var(--bg-secondary)',
                              border: `1px solid ${set.completed ? 'var(--color-success)' : 'var(--border-subtle)'}`,
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <span style={{ fontWeight: 700, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{set.setIndex}</span>
                            <select
                              className="select"
                              value={set.setType || 'normal'}
                              onChange={e => updateSetValue(exIndex, setIndex, 'setType', e.target.value as SetType)}
                              style={{ height: '36px', minHeight: '36px', fontSize: '0.75rem', padding: '0 4px', textAlign: 'center' }}
                            >
                              <option value="normal">Work</option>
                              <option value="warmup">Warm</option>
                              <option value="drop">Drop</option>
                              <option value="failure">Fail</option>
                            </select>
                            <input
                              type="number"
                              className="input"
                              value={set.weightKg}
                              min={0}
                              step={0.5}
                              onChange={e => updateSetValue(exIndex, setIndex, 'weightKg', parseFloat(e.target.value) || 0)}
                              style={{ textAlign: 'center', height: '36px', minHeight: '36px', padding: 0 }}
                            />
                            <input
                              type="number"
                              className="input"
                              value={set.reps}
                              min={0}
                              onChange={e => updateSetValue(exIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                              style={{ textAlign: 'center', height: '36px', minHeight: '36px', padding: 0 }}
                            />
                            <select
                              className="select"
                              value={set.rpe || 8}
                              onChange={e => updateSetValue(exIndex, setIndex, 'rpe', parseFloat(e.target.value))}
                              style={{ height: '36px', minHeight: '36px', fontSize: '0.8rem', padding: '0 4px', textAlign: 'center' }}
                            >
                              <option value={6}>6</option>
                              <option value={7}>7</option>
                              <option value={8}>8</option>
                              <option value={8.5}>8.5</option>
                              <option value={9}>9</option>
                              <option value={9.5}>9.5</option>
                              <option value={10}>10</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => toggleSetCompleted(exIndex, setIndex)}
                              style={{
                                height: '38px',
                                width: '38px',
                                borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${set.completed ? 'var(--color-success)' : 'var(--border-subtle)'}`,
                                backgroundColor: set.completed ? 'var(--color-success)' : 'var(--bg-surface-elevated)',
                                color: set.completed ? '#0B0D10' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                margin: '0 auto',
                              }}
                            >
                              <Check size={18} strokeWidth={set.completed ? 3 : 2} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: 'var(--space-2) var(--space-4) var(--space-3)' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSetToExercise(exIndex)}>
                        <Plus size={14} /> Add Set
                      </button>
                    </div>
                  </div>

                  {shortTimeMode && !exercise.isCore && !unlockedExerciseIndices.includes(exIndex) && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(11, 13, 16, 0.72)',
                        backdropFilter: 'blur(5px)',
                        zIndex: 10,
                        padding: 'var(--space-4)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#eab308', fontSize: '0.86rem', fontWeight: 700, marginBottom: '6px' }}>
                        <Zap size={14} /> Optional Movement De-emphasized
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '360px', margin: '0 0 var(--space-3)' }}>
                        Short on time mode prioritizes core lifts. You can intentionally unlock this exercise anytime.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleUnlockExercise(exIndex)}
                      >
                        Unlock & Log Sets →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WORKOUT OUTLINE DRAWER (Mobile Slide-Over & Menu) */}
      <GuidedWorkoutOutlineDrawer
        isOpen={isOutlineDrawerOpen}
        onClose={() => setIsOutlineDrawerOpen(false)}
        exercises={session.exercises}
        currentExerciseIndex={currentExerciseIndex}
        onSelectExercise={handleSelectExercise}
        onAddMovement={() => setIsAddingExercise(true)}
        onToggleViewMode={() => setViewMode(prev => prev === 'guided' ? 'overview' : 'guided')}
        onCancelWorkout={onCancel}
      />

      {/* FINISH WORKOUT CONFIRMATION MODAL */}
      {isFinishingModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsFinishingModalOpen(false)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '1.3rem' }}>Finalize Workout</h2>
              <button
                className="btn btn-ghost"
                onClick={() => setIsFinishingModalOpen(false)}
                style={{ width: '36px', height: '36px', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div style={{
                padding: 'var(--space-3)',
                background: 'var(--color-error-muted)',
                border: '1px solid rgba(224, 107, 103, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-error)',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {!hasCompletedCoreExercise(session) && (
              <div style={{
                padding: 'var(--space-3)',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#eab308',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Core Exercise Advisory:</strong> No completed sets were logged for a core compound exercise in this session. You can still save your workout, but streak continuity typically requires completing key movements.
                </div>
              </div>
            )}

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label">Session Exertion Rating</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {(['easy', 'normal', 'exhausting'] as const).map(rate => (
                  <button
                    key={rate}
                    type="button"
                    className={`btn btn-sm ${sessionRating === rate ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ textTransform: 'capitalize' }}
                    onClick={() => setSessionRating(rate)}
                  >
                    {rate}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="label">Session Notes (Optional)</label>
              <textarea
                className="textarea"
                placeholder="Felt strong on compound lifts, strict tempo maintained..."
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={handleFinalizeWorkout}
              disabled={submitting}
              style={{ marginTop: 'var(--space-3)' }}
            >
              {submitting ? <span className="spinner" /> : 'Log & Save Workout'}
            </button>
          </div>
        </div>
      )}

      {/* WORKOUT SUMMARY MODAL */}
      {showSummaryModal && (
        <WorkoutSummaryModal
          session={{ ...session, durationSeconds: elapsedSeconds }}
          existingPrsMap={existingPrsMap}
          onViewProgress={onViewProgress}
          onClose={() => {
            setShowSummaryModal(false);
            onFinish(session);
          }}
        />
      )}

      {/* EXERCISE SWAP MODAL */}
      {exerciseToSwapIndex !== null && (
        <div className="modal-backdrop" onClick={() => setExerciseToSwapIndex(null)}>
          <div
            className="modal-content animate-fade-in"
            style={{ maxWidth: '640px', padding: 'var(--space-4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <span className="badge badge-accent">Exercise Substitution</span>
                <h3 style={{ margin: '4px 0 0' }}>
                  Swap {session.exercises[exerciseToSwapIndex]?.exerciseName}
                </h3>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setExerciseToSwapIndex(null)}
                style={{ width: '36px', height: '36px', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {!canAccessAlternatives ? (
              <PremiumLockedSection
                featureName="Exercise & Equipment Alternatives"
                featureDescription="Unlock biomechanically matched exercise substitutions calibrated to joint-angle stress distribution, movement patterns, and available gym equipment."
              />
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
                  Select a substitute exercise. Your sets, completed statuses, and weights will be preserved.
                </p>

                <ExerciseLibraryView
                  exercises={availableExercises}
                  onSelectExerciseForWorkout={handleSwapExercise}
                  isSelectionMode={true}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ADD NEW MOVEMENT MODAL */}
      {isAddingExercise && (
        <div className="modal-backdrop" onClick={() => setIsAddingExercise(false)}>
          <div
            className="modal-content animate-fade-in"
            style={{ maxWidth: '640px', padding: 'var(--space-4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <span className="badge badge-accent">Add Movement</span>
                <h3 style={{ margin: '4px 0 0' }}>Add Exercise to Routine</h3>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setIsAddingExercise(false)}
                style={{ width: '36px', height: '36px', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <ExerciseLibraryView
              exercises={availableExercises}
              onSelectExerciseForWorkout={handleAddExerciseToWorkout}
              isSelectionMode={true}
            />
          </div>
        </div>
      )}

      {/* PHASE G6: ACTIVE WORKOUT EMERGENCY SOS MODAL */}
      {showSosModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            zIndex: 9999,
          }}
        >
          <div
            className="card card-elevated"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: 'var(--space-6)',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid #ef4444',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-3)' }}>
              <ShieldAlert size={26} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>
                Floor Emergency SOS
              </h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
              Broadcast an immediate high-priority alert to gym floor staff and management.
            </p>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="active-sos-loc" style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px' }}>
                Floor Location / Rack # (Optional)
              </label>
              <input
                id="active-sos-loc"
                type="text"
                className="input"
                placeholder="e.g., Squat Rack 3, Dumbbell area"
                value={sosLocationDetails}
                onChange={e => setSosLocationDetails(e.target.value)}
                maxLength={200}
                style={{ width: '100%' }}
              />
            </div>

            {sosFeedback && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderRadius: 'var(--radius-md)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                {sosFeedback}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSosModal(false)}
                disabled={isTriggeringSos}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={isTriggeringSos}
                onClick={async () => {
                  setIsTriggeringSos(true);
                  setSosFeedback(null);
                  try {
                    const res = await gymSafetyService.triggerEmergencySos(sosLocationDetails);
                    if (!res.success) {
                      setSosFeedback(res.error || 'Emergency SOS failed');
                    } else {
                      setSosFeedback(
                        res.isDeduplicated
                          ? 'Alert updated! Staff are already actively responding.'
                          : 'SOS Alert dispatched! Staff have been notified.'
                      );
                      setTimeout(() => {
                        setShowSosModal(false);
                        setSosLocationDetails('');
                      }, 2000);
                    }
                  } catch (err: any) {
                    setSosFeedback(err.message || 'SOS dispatch error');
                  } finally {
                    setIsTriggeringSos(false);
                  }
                }}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                {isTriggeringSos ? 'Broadcasting...' : 'CONFIRM SOS ALERT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
