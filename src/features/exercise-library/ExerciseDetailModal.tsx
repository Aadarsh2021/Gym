import React from 'react';
import { X, CheckCircle, ArrowRightLeft, Dumbbell, ShieldAlert, Target } from 'lucide-react';
import { Exercise } from '@/types/workout.types';

interface ExerciseDetailModalProps {
  exercise: Exercise;
  alternatives: Exercise[];
  onClose: () => void;
  onSelectAlternative?: (alt: Exercise) => void;
  onSwapInWorkout?: (newExercise: Exercise) => void;
  isWorkoutSwapMode?: boolean;
}

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
  exercise,
  alternatives,
  onClose,
  onSelectAlternative,
  onSwapInWorkout,
  isWorkoutSwapMode = false,
}) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        style={{ maxWidth: '640px', padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div style={{
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-1)', alignItems: 'center' }}>
              <span className="badge badge-accent">{exercise.primaryMuscle}</span>
              <span className="badge">{exercise.equipmentRequired}</span>
              <span className="badge" style={{ textTransform: 'capitalize' }}>{exercise.difficulty}</span>
            </div>
            <h2 style={{ fontSize: '1.4rem' }}>{exercise.name}</h2>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: 'var(--space-5)', maxHeight: '78vh', overflowY: 'auto' }}>
          {/* Swap Action Banner (If in workout swap mode) */}
          {isWorkoutSwapMode && onSwapInWorkout && (
            <div style={{
              background: 'var(--accent-primary-muted)',
              border: '1px solid rgba(199, 240, 0, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
            }}>
              <div>
                <strong style={{ color: 'var(--accent-primary)', display: 'block', fontSize: '0.9rem' }}>
                  Active Workout Substitution
                </strong>
                <small style={{ color: 'var(--text-secondary)' }}>
                  Replace current exercise with {exercise.name} while preserving your logged workout sets.
                </small>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onSwapInWorkout(exercise)}
              >
                Confirm Swap
              </button>
            </div>
          )}

          {/* Muscle Engagement Blueprint */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Target size={16} color="var(--accent-primary)" />
              <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                Target Muscle Anatomy
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  PRIMARY TARGET
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(exercise.targetMusclesDetail?.primary || [exercise.primaryMuscle]).map((m, i) => (
                    <span key={i} className="badge badge-accent" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  SECONDARY SYNERGISTS
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(exercise.targetMusclesDetail?.secondary || exercise.secondaryMuscles).length > 0 ? (
                    (exercise.targetMusclesDetail?.secondary || exercise.secondaryMuscles).map((m, i) => (
                      <span key={i} className="badge" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                        {m}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None (Direct Isolation)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Dumbbell size={16} color="var(--text-secondary)" />
              How to Perform
            </h3>
            <ol style={{ paddingLeft: 'var(--space-5)', margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {exercise.instructions.map((step, idx) => (
                <li key={idx} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{step.split(':')[0]}:</strong>{' '}
                  {step.includes(':') ? step.split(':').slice(1).join(':') : step}
                </li>
              ))}
            </ol>
          </div>

          {/* Coach Form Cues */}
          {exercise.cues && exercise.cues.length > 0 && (
            <div style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-5)',
            }}>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-success)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CheckCircle size={16} color="var(--color-success)" />
                Pro Coaching Cues
              </h4>
              <ul style={{ paddingLeft: 'var(--space-4)', margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {exercise.cues.map((cue, idx) => (
                  <li key={idx} style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Common Mistakes to Avoid */}
          {exercise.mistakesToAvoid && exercise.mistakesToAvoid.length > 0 && (
            <div style={{
              background: 'var(--color-error-muted)',
              border: '1px solid rgba(224, 107, 103, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-5)',
            }}>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-error)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ShieldAlert size={16} color="var(--color-error)" />
                Common Mistakes to Avoid
              </h4>
              <ul style={{ paddingLeft: 'var(--space-4)', margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {exercise.mistakesToAvoid.map((mistake, idx) => (
                  <li key={idx} style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.4 }}>
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alternative Exercises */}
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ArrowRightLeft size={16} color="var(--text-secondary)" />
              Recommended Alternatives
            </h3>

            {alternatives.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No direct alternatives found.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-2)' }}>
                {alternatives.map(alt => (
                  <div
                    key={alt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'border-color var(--transition-fast)',
                    }}
                    onClick={() => onSelectAlternative?.(alt)}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{alt.name}</strong>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: '2px' }}>
                        <small style={{ color: 'var(--text-muted)' }}>{alt.equipmentRequired}</small>
                        <small style={{ color: 'var(--text-muted)' }}>•</small>
                        <small style={{ color: 'var(--text-muted)' }}>{alt.difficulty}</small>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {isWorkoutSwapMode && onSwapInWorkout && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwapInWorkout(alt);
                          }}
                        >
                          Swap In
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAlternative?.(alt);
                        }}
                      >
                        View Guide
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
