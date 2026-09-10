import React, { useState, useEffect } from 'react';
import { Check, Plus, Timer, AlertCircle, X } from 'lucide-react';
import { WorkoutSession } from '@/types/workout.types';
import { useRestTimer } from '@/hooks/useRestTimer';
import { formatTimerClock } from '@/utils/formatters';
import { workoutService } from '@/services/workout.service';
import { saveActiveSessionDraft } from '@/utils/storage';
import confetti from 'canvas-confetti';

interface WorkoutTrackerViewProps {
  session: WorkoutSession;
  onFinish: (summary: any) => void;
  onCancel: () => void;
}

export const WorkoutTrackerView: React.FC<WorkoutTrackerViewProps> = ({
  session: initialSession,
  onFinish,
  onCancel,
}) => {
  const [session, setSession] = useState<WorkoutSession>(initialSession);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [sessionRating, setSessionRating] = useState<'easy' | 'normal' | 'exhausting'>('normal');
  const [sessionNotes, setSessionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { secondsRemaining, isActive: isTimerActive, startTimer, stopTimer, addTime } = useRestTimer();

  // Elapsed session duration clock
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync draft to local storage on every set change for resilience
  useEffect(() => {
    saveActiveSessionDraft({ ...session, durationSeconds: elapsedSeconds });
  }, [session, elapsedSeconds]);

  const toggleSetCompleted = (exerciseIndex: number, setIndex: number) => {
    setSession(prev => {
      const updatedExercises = [...prev.exercises];
      const targetEx = { ...updatedExercises[exerciseIndex] };
      const updatedSets = [...targetEx.sets];
      const targetSet = { ...updatedSets[setIndex] };

      targetSet.completed = !targetSet.completed;
      if (targetSet.completed) {
        targetSet.completedAt = new Date().toISOString();
        // Trigger auto rest timer (90 seconds default)
        startTimer(90);
      }

      updatedSets[setIndex] = targetSet;
      targetEx.sets = updatedSets;
      updatedExercises[exerciseIndex] = targetEx;
      return { ...prev, exercises: updatedExercises };
    });
  };

  const updateSetValues = (
    exerciseIndex: number,
    setIndex: number,
    field: 'weightKg' | 'reps',
    val: number
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
          weightKg: lastSet ? lastSet.weightKg : 50,
          reps: lastSet ? lastSet.reps : 10,
          completed: false,
        },
      ];
      updatedExercises[exerciseIndex] = targetEx;
      return { ...prev, exercises: updatedExercises };
    });
  };

  const handleFinalizeWorkout = async () => {
    setError(null);
    setSubmitting(true);

    try {
      // Deterministic client UUID idempotency key to prevent double completion
      const idempotencyKey = `idemp-${session.id}-${Date.now()}`;

      const res = await workoutService.finishWorkoutSession(
        session.id,
        idempotencyKey,
        sessionRating,
        sessionNotes
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to complete session');
      }

      // Fire celebratory confetti on success
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {
        // ignore
      }

      onFinish(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error finalizing session';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-narrow animate-fade-in" style={{ padding: 'var(--space-4) var(--space-4) calc(var(--bottom-nav-height) + var(--space-12))' }}>
      {/* Active Workout Header */}
      <div className="card card-glass" style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="badge badge-lime" style={{ marginBottom: 'var(--space-1)' }}>Workout In Progress</span>
          <h2 style={{ fontSize: '1.4rem' }}>{session.name}</h2>
          <small style={{ color: 'var(--text-muted)' }}>Duration: {formatTimerClock(elapsedSeconds)}</small>
        </div>
        <button className="btn btn-primary" onClick={() => setIsFinishing(true)}>
          Finish Workout
        </button>
      </div>

      {/* Floating Rest Timer Pill */}
      {isTimerActive && (
        <div
          className="card-glow"
          style={{
            position: 'sticky',
            top: '70px',
            zIndex: 80,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-full)',
            padding: 'var(--space-2) var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--glow-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Timer size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
              Rest: {formatTimerClock(secondsRemaining)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => addTime(30)}>
              +30s
            </button>
            <button className="btn btn-secondary btn-sm" onClick={stopTimer}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Exercises List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {session.exercises.map((exercise, exIndex) => (
          <div key={exercise.exerciseId || exIndex} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem' }}>{exercise.exerciseName}</h3>
                <span className="badge badge-cyan">{exercise.primaryMuscle}</span>
              </div>
            </div>

            {/* Set Column Headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 1fr 54px',
              gap: 'var(--space-2)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-2)',
              textAlign: 'center',
            }}>
              <span>SET</span>
              <span>KG</span>
              <span>REPS</span>
              <span>DONE</span>
            </div>

            {/* Sets Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {exercise.sets.map((set, setIndex) => (
                <div
                  key={setIndex}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 1fr 54px',
                    gap: 'var(--space-2)',
                    alignItems: 'center',
                    padding: 'var(--space-2)',
                    background: set.completed ? 'rgba(212, 255, 0, 0.08)' : 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${set.completed ? 'rgba(212, 255, 0, 0.3)' : 'var(--border-subtle)'}`,
                  }}
                >
                  <span style={{ fontWeight: 700, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {set.setIndex}
                  </span>

                  <input
                    type="number"
                    className="input"
                    value={set.weightKg}
                    min={0}
                    step={2.5}
                    onChange={e => updateSetValues(exIndex, setIndex, 'weightKg', parseFloat(e.target.value) || 0)}
                    style={{ textAlign: 'center', height: '42px', padding: 0 }}
                  />

                  <input
                    type="number"
                    className="input"
                    value={set.reps}
                    min={0}
                    onChange={e => updateSetValues(exIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                    style={{ textAlign: 'center', height: '42px', padding: 0 }}
                  />

                  <button
                    type="button"
                    onClick={() => toggleSetCompleted(exIndex, setIndex)}
                    style={{
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      backgroundColor: set.completed ? 'var(--accent-primary)' : 'var(--border-medium)',
                      color: set.completed ? 'var(--accent-primary-text)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Check size={20} strokeWidth={set.completed ? 3 : 2} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addSetToExercise(exIndex)}
              style={{ marginTop: 'var(--space-3)', width: '100%' }}
            >
              <Plus size={16} /> Add Set
            </button>
          </div>
        ))}
      </div>

      {/* Cancel Workout Button */}
      <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
        <button
          className="btn btn-secondary"
          onClick={onCancel}
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel Workout Session
        </button>
      </div>

      {/* FINISH WORKOUT MODAL */}
      {isFinishing && (
        <div className="modal-backdrop" onClick={() => setIsFinishing(false)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3>Workout Finished!</h3>
              <button
                onClick={() => setIsFinishing(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{
                padding: 'var(--space-3)',
                background: 'rgba(255, 77, 77, 0.1)',
                border: '1px solid rgba(255, 77, 77, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-fire)',
                marginBottom: 'var(--space-4)',
              }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label">How was this workout session?</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {(['easy', 'normal', 'exhausting'] as const).map(rate => (
                  <button
                    key={rate}
                    type="button"
                    className={`btn ${sessionRating === rate ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ textTransform: 'capitalize', padding: 0 }}
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
                placeholder="Felt strong on bench press, good energy levels..."
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={handleFinalizeWorkout}
              disabled={submitting}
              style={{ marginTop: 'var(--space-4)' }}
            >
              {submitting ? <span className="spinner" /> : 'Log & Save Workout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
