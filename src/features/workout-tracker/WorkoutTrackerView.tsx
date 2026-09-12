import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  Plus,
  Timer,
  AlertCircle,
  X,
  ArrowRightLeft,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { WorkoutSession, WorkoutSet, SetType, Exercise } from '@/types/workout.types';
import { useRestTimer } from '@/hooks/useRestTimer';
import { formatTimerClock } from '@/utils/formatters';
import { workoutService } from '@/services/workout.service';
import { exerciseService } from '@/services/exercise.service';
import { saveActiveSessionDraft } from '@/utils/storage';
import { evaluateProgression } from '@/domain/progression';
import { ExerciseLibraryView } from '@/features/exercise-library/ExerciseLibraryView';
import { WorkoutSummaryModal } from './WorkoutSummaryModal';

interface WorkoutTrackerViewProps {
  session: WorkoutSession;
  onFinish: (summary?: any) => void;
  onCancel: () => void;
  onViewProgress?: () => void;
}

const RPE_DESCRIPTIONS: Record<number, string> = {
  6: '4+ Reps in reserve (Light warm-up)',
  7: '3 Reps in reserve (Submaximal speed)',
  8: '2 Reps in reserve (Target hyper-trophy)',
  8.5: '1-2 Reps in reserve (Hard working set)',
  9: '1 Rep in reserve (Near maximal)',
  9.5: 'Maybe 1 more rep (Grinder)',
  10: '0 Reps in reserve (Absolute failure)',
};

export const WorkoutTrackerView: React.FC<WorkoutTrackerViewProps> = ({
  session: initialSession,
  onFinish,
  onCancel,
  onViewProgress,
}) => {
  const [session, setSession] = useState<WorkoutSession>(initialSession);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(initialSession.durationSeconds || 0);
  const [isFinishingModalOpen, setIsFinishingModalOpen] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionRating, setSessionRating] = useState<'easy' | 'normal' | 'exhausting'>('normal');
  const [sessionNotes, setSessionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exercise Swap & Add Drawer State
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

  // Load previous performances, PRs & available catalog for in-workout swap/add
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

  // Sync draft to local storage on every set change to prevent loss across browser reloads
  useEffect(() => {
    saveActiveSessionDraft({ ...session, durationSeconds: elapsedSeconds });
  }, [session, elapsedSeconds]);

  // Toggle set completed with auto rest timer
  const toggleSetCompleted = (exerciseIndex: number, setIndex: number) => {
    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const targetEx = { ...updatedExercises[exerciseIndex] };
      const updatedSets = [...targetEx.sets];
      const targetSet = { ...updatedSets[setIndex] };

      targetSet.completed = !targetSet.completed;
      if (targetSet.completed) {
        targetSet.completedAt = new Date().toISOString();
        // Start rest timer (custom exercise rest or 90s standard)
        const restDuration = targetEx.restSeconds || 90;
        startTimer(restDuration);
      }

      updatedSets[setIndex] = targetSet;
      targetEx.sets = updatedSets;
      updatedExercises[exerciseIndex] = targetEx;
      return { ...prev, exercises: updatedExercises };
    });
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

  // Adjust weight with stepper (+2.5, -2.5, +5)
  const adjustWeight = (exerciseIndex: number, setIndex: number, delta: number) => {
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

  // Remove set from exercise (with safety check)
  const removeSetFromExercise = (exerciseIndex: number, setIndex: number) => {
    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const targetEx = { ...updatedExercises[exerciseIndex] };
      if (targetEx.sets.length <= 1) return prev; // keep at least 1 set

      const filteredSets = targetEx.sets
        .filter((_, idx) => idx !== setIndex)
        .map((s, idx) => ({ ...s, setIndex: idx + 1 }));

      targetEx.sets = filteredSets;
      updatedExercises[exerciseIndex] = targetEx;
      return { ...prev, exercises: updatedExercises };
    });
  };

  // Swap exercise in-place preserving all logged sets and history
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

  // Remove exercise from active workout (with confirmation if completed sets exist)
  const handleRemoveExercise = (exerciseIndex: number) => {
    const targetEx = session.exercises[exerciseIndex];
    const hasCompletedSets = targetEx.sets.some(s => s.completed);

    if (hasCompletedSets) {
      if (!confirm(`Are you sure you want to remove "${targetEx.exerciseName}"? Already logged sets for this exercise will be deleted.`)) {
        return;
      }
    }

    setSession(prev => ({
      ...prev,
      exercises: prev.exercises
        .filter((_, idx) => idx !== exerciseIndex)
        .map((ex, idx) => ({ ...ex, orderIndex: idx + 1 })),
    }));
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

  // Total completed sets counter
  const totalCompletedSets = useMemo(() => {
    return session.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter(s => s.completed).length,
      0
    );
  }, [session]);

  return (
    <div
      className="container-workout animate-fade-in"
      style={{
        padding: 'var(--space-4) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-12))',
      }}
    >
      {/* Gym Top Action Bar */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--space-4)',
          background: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-medium)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <span className="badge badge-accent">Live Session</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {totalCompletedSets} sets logged
              </span>
            </div>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>{session.name}</h1>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: '4px' }}>
              <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                ⏱ {formatTimerClock(elapsedSeconds)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAddingExercise(true)}
            >
              <Plus size={15} /> Add Movement
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsFinishingModalOpen(true)}
            >
              Finish Workout
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Rest Timer Bar */}
      {isTimerActive && (
        <div
          style={{
            position: 'sticky',
            top: '64px',
            zIndex: 100,
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-4)',
            marginBottom: 'var(--space-4)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Linear Progress Bar */}
          <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', marginBottom: '8px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'var(--accent-primary)',
                width: `${Math.min(100, Math.max(0, progressFraction * 100))}%`,
                transition: 'width 1s linear',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Timer size={16} color="var(--accent-primary)" />
              <span style={{ fontWeight: 700, fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                Rest: {formatTimerClock(secondsRemaining)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => subtractTime(15)} title="Subtract 15 seconds" style={{ minHeight: '36px', minWidth: '40px' }}>
                -15s
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => addTime(30)} title="Add 30 seconds" style={{ minHeight: '36px', minWidth: '40px' }}>
                +30s
              </button>
              <button
                className={`btn ${isTimerPaused ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={isTimerPaused ? resumeTimer : pauseTimer}
                style={{ minHeight: '36px', minWidth: '58px' }}
                title={isTimerPaused ? 'Resume rest timer' : 'Pause rest timer'}
              >
                {isTimerPaused ? 'Resume' : 'Pause'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={stopTimer} style={{ minHeight: '36px' }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercises List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {session.exercises.map((exercise, exIndex) => {
          const prev = performanceMap[exercise.exerciseId];
          const progression = evaluateProgression({
            exerciseName: exercise.exerciseName,
            primaryMuscle: exercise.primaryMuscle,
            targetRepsMin: exercise.targetRepsMin || 8,
            targetRepsMax: exercise.targetRepsMax || 12,
            currentSets: exercise.sets,
            previousPerformance: prev,
          });

          return (
            <div
              key={exercise.exerciseId || exIndex}
              className="card"
              style={{ padding: 0, overflow: 'hidden' }}
            >
              {/* Exercise Header */}
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-surface-elevated)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      #{exIndex + 1}
                    </span>
                    <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{exercise.exerciseName}</h2>
                    <span className="badge">{exercise.primaryMuscle}</span>
                  </div>

                  {prev && (
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      Previous: <span style={{ color: 'var(--text-secondary)' }}>{prev.weightKg} kg × {prev.reps} reps</span>
                      {prev.rpe ? ` @ RPE ${prev.rpe}` : ''}
                    </small>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setExerciseToSwapIndex(exIndex)}
                    title="Swap exercise with alternative"
                  >
                    <ArrowRightLeft size={14} /> Swap
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRemoveExercise(exIndex)}
                    title="Remove exercise"
                  >
                    <Trash2 size={14} color="var(--color-error)" />
                  </button>
                </div>
              </div>

              {/* Progressive Overload Cue Banner */}
              <div
                style={{
                  padding: '6px var(--space-4)',
                  background: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: '0.8rem',
                }}
              >
                <TrendingUp size={14} color={progression.action === 'increase_load' ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <span style={{ color: progression.action === 'increase_load' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                  {progression.cue}
                </span>
              </div>

              {/* DESKTOP TABLE VIEW (>= 768px) */}
              <div className="workout-table-desktop">
                {/* Table Column Headers */}
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
                    letterSpacing: '0.04em',
                    alignItems: 'center',
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

                {/* Sets Rows */}
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
                        background: set.completed ? 'var(--color-success-muted)' : 'var(--bg-input)',
                        border: `1px solid ${set.completed ? 'var(--color-success)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background-color var(--transition-fast)',
                      }}
                    >
                      {/* Set Number */}
                      <span style={{ fontWeight: 700, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                        {set.setIndex}
                      </span>

                      {/* Set Type Selector */}
                      <select
                        className="select"
                        value={set.setType || 'normal'}
                        onChange={e => updateSetValue(exIndex, setIndex, 'setType', e.target.value as SetType)}
                        style={{ height: '38px', minHeight: '38px', fontSize: '0.75rem', padding: '0 4px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                      >
                        <option value="normal">Work</option>
                        <option value="warmup">Warm</option>
                        <option value="drop">Drop</option>
                        <option value="failure">Fail</option>
                      </select>

                      {/* Weight with Quick Steppers */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <input
                          type="number"
                          className="input"
                          value={set.weightKg}
                          min={0}
                          step={0.5}
                          onChange={e => updateSetValue(exIndex, setIndex, 'weightKg', parseFloat(e.target.value) || 0)}
                          style={{ textAlign: 'center', height: '38px', minHeight: '38px', padding: 0, fontSize: '0.95rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ height: '18px', minHeight: '18px', width: '22px', padding: 0, fontSize: '9px', fontWeight: 800 }}
                            onClick={() => adjustWeight(exIndex, setIndex, 2.5)}
                            title="+2.5 kg"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ height: '18px', minHeight: '18px', width: '22px', padding: 0, fontSize: '9px', fontWeight: 800 }}
                            onClick={() => adjustWeight(exIndex, setIndex, -2.5)}
                            title="-2.5 kg"
                          >
                            -
                          </button>
                        </div>
                      </div>

                      {/* Reps Input */}
                      <input
                        type="number"
                        className="input"
                        value={set.reps}
                        min={0}
                        onChange={e => updateSetValue(exIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                        style={{ textAlign: 'center', height: '38px', minHeight: '38px', padding: 0, fontSize: '0.95rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                      />

                      {/* RPE Selector */}
                      <select
                        className="select"
                        value={set.rpe || 8}
                        onChange={e => updateSetValue(exIndex, setIndex, 'rpe', parseFloat(e.target.value))}
                        style={{ height: '38px', minHeight: '38px', fontSize: '0.8rem', padding: '0 4px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                        title={RPE_DESCRIPTIONS[set.rpe || 8] || 'RPE'}
                      >
                        <option value={6}>6</option>
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                        <option value={8.5}>8.5</option>
                        <option value={9}>9</option>
                        <option value={9.5}>9.5</option>
                        <option value={10}>10</option>
                      </select>

                      {/* Checkbox (Touch Target >= 44px) */}
                      <button
                        type="button"
                        onClick={() => toggleSetCompleted(exIndex, setIndex)}
                        style={{
                          height: '44px',
                          width: '44px',
                          minHeight: '44px',
                          minWidth: '44px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${set.completed ? 'var(--color-success)' : 'var(--border-subtle)'}`,
                          backgroundColor: set.completed ? 'var(--color-success)' : 'var(--bg-surface-elevated)',
                          color: set.completed ? '#0B0D10' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color var(--transition-fast)',
                          margin: '0 auto',
                        }}
                        aria-label="Mark set completed"
                      >
                        <Check size={20} strokeWidth={set.completed ? 3 : 2} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* MOBILE ONE-HANDED SET CARDS (< 768px) */}
              <div className="workout-cards-mobile">
                {exercise.sets.map((set, setIndex) => (
                  <div
                    key={setIndex}
                    style={{
                      background: set.completed ? 'var(--accent-primary-muted)' : 'var(--bg-input)',
                      border: `1px solid ${set.completed ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                    }}
                  >
                    {/* Top Row: Set # + Set Type Tag + RPE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          SET {set.setIndex}
                        </span>
                        <select
                          className="select"
                          value={set.setType || 'normal'}
                          onChange={e => updateSetValue(exIndex, setIndex, 'setType', e.target.value as SetType)}
                          style={{ height: '34px', minHeight: '34px', fontSize: '0.78rem', padding: '0 6px', fontFamily: 'var(--font-mono)' }}
                        >
                          <option value="normal">Work</option>
                          <option value="warmup">Warmup</option>
                          <option value="drop">Drop</option>
                          <option value="failure">Failure</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>RPE</span>
                        <select
                          className="select"
                          value={set.rpe || 8}
                          onChange={e => updateSetValue(exIndex, setIndex, 'rpe', parseFloat(e.target.value))}
                          style={{ height: '34px', minHeight: '34px', fontSize: '0.8rem', padding: '0 6px', fontFamily: 'var(--font-mono)' }}
                          title={RPE_DESCRIPTIONS[set.rpe || 8] || 'RPE'}
                        >
                          <option value={6}>6</option>
                          <option value={7}>7</option>
                          <option value={8}>8</option>
                          <option value={8.5}>8.5</option>
                          <option value={9}>9</option>
                          <option value={9.5}>9.5</option>
                          <option value={10}>10</option>
                        </select>
                      </div>
                    </div>

                    {/* Bottom Row: Weight Stepper + Reps + Big 48px Checkmark */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {/* Weight Stepper */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px', fontWeight: 600 }}>Weight (kg)</small>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ height: '42px', minHeight: '42px', minWidth: '32px', padding: 0, fontWeight: 700 }}
                            onClick={() => adjustWeight(exIndex, setIndex, -2.5)}
                            title="-2.5 kg"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            className="input"
                            value={set.weightKg}
                            min={0}
                            step={0.5}
                            onChange={e => updateSetValue(exIndex, setIndex, 'weightKg', parseFloat(e.target.value) || 0)}
                            style={{ textAlign: 'center', height: '42px', minHeight: '42px', padding: 0, fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, width: '100%', minWidth: 0 }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ height: '42px', minHeight: '42px', minWidth: '32px', padding: 0, fontWeight: 700 }}
                            onClick={() => adjustWeight(exIndex, setIndex, 2.5)}
                            title="+2.5 kg"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Reps */}
                      <div style={{ width: '80px', flexShrink: 0 }}>
                        <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px', fontWeight: 600 }}>Reps</small>
                        <input
                          type="number"
                          className="input"
                          value={set.reps}
                          min={0}
                          onChange={e => updateSetValue(exIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                          style={{ textAlign: 'center', height: '42px', minHeight: '42px', padding: 0, fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, width: '100%' }}
                        />
                      </div>

                      {/* Checkmark Button (48px x 48px touch target) */}
                      <div style={{ flexShrink: 0 }}>
                        <small style={{ fontSize: '0.7rem', color: 'transparent', display: 'block', marginBottom: '2px' }}>.</small>
                        <button
                          type="button"
                          onClick={() => toggleSetCompleted(exIndex, setIndex)}
                          style={{
                            height: '48px',
                            width: '48px',
                            minHeight: '48px',
                            minWidth: '48px',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${set.completed ? 'var(--color-success)' : 'var(--border-medium)'}`,
                            backgroundColor: set.completed ? 'var(--color-success)' : 'var(--bg-surface-elevated)',
                            color: set.completed ? '#0B0D10' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            touchAction: 'manipulation',
                            boxShadow: set.completed ? '0 1px 3px rgba(0, 0, 0, 0.35)' : 'none',
                            transition: 'all var(--transition-fast)',
                          }}
                          aria-label="Mark set completed"
                        >
                          <Check size={22} strokeWidth={set.completed ? 3 : 2} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>

                {/* Add Set / Remove Set Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => addSetToExercise(exIndex)}
                    style={{ flex: 1 }}
                  >
                    <Plus size={14} /> Add Set
                  </button>
                  {exercise.sets.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeSetFromExercise(exIndex, exercise.sets.length - 1)}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Remove Last Set
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel Workout Footer */}
      <div style={{ marginTop: 'var(--space-8)', textAlign: 'center' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel Workout Session
        </button>
      </div>

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

      {/* EXERCISE SWAP MODAL / DRAWER */}
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

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Select a substitute exercise. Your sets, completed statuses, and weights will be preserved.
            </p>

            <ExerciseLibraryView
              exercises={availableExercises}
              onSelectExerciseForWorkout={handleSwapExercise}
              isSelectionMode={true}
            />
          </div>
        </div>
      )}

      {/* ADD NEW EXERCISE DRAWER */}
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
    </div>
  );
};
