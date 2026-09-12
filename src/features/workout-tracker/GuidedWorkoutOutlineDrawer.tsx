import React from 'react';
import { X, Check, Plus, LayoutGrid, AlertTriangle } from 'lucide-react';
import { WorkoutSessionExercise } from '@/types/workout.types';

interface GuidedWorkoutOutlineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: WorkoutSessionExercise[];
  currentExerciseIndex: number;
  onSelectExercise: (index: number) => void;
  onAddMovement: () => void;
  onToggleViewMode: () => void;
  onCancelWorkout: () => void;
}

export const GuidedWorkoutOutlineDrawer: React.FC<GuidedWorkoutOutlineDrawerProps> = ({
  isOpen,
  onClose,
  exercises,
  currentExerciseIndex,
  onSelectExercise,
  onAddMovement,
  onToggleViewMode,
  onCancelWorkout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 120 }}>
      <div
        className="drawer animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                Session Outline
              </span>
              <h2 style={{ fontSize: '1.2rem', margin: '4px 0 0' }}>All Movements</h2>
            </div>
            <button
              className="btn btn-ghost"
              onClick={onClose}
              style={{ width: '36px', height: '36px', padding: 0 }}
              aria-label="Close outline"
            >
              <X size={18} />
            </button>
          </div>

          {/* Exercise List */}
          <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '60vh', overflowY: 'auto' }}>
            {exercises.map((ex, idx) => {
              const completedCount = ex.sets.filter(s => s.completed).length;
              const isAllDone = ex.sets.length > 0 && completedCount === ex.sets.length;
              const isActive = idx === currentExerciseIndex;

              return (
                <div
                  key={ex.exerciseId || idx}
                  onClick={() => {
                    onSelectExercise(idx);
                    onClose();
                  }}
                  className="card card-interactive"
                  style={{
                    padding: 'var(--space-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: `1px solid ${isActive ? 'var(--accent-primary)' : isAllDone ? 'rgba(114, 184, 121, 0.4)' : 'var(--border-subtle)'}`,
                    background: isActive ? 'var(--accent-primary-muted)' : 'var(--bg-surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        background: isAllDone ? 'var(--color-success)' : isActive ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                        color: isAllDone || isActive ? '#FFFFFF' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}
                    >
                      {isAllDone ? <Check size={16} strokeWidth={3} /> : idx + 1}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ex.exerciseName}
                      </div>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {ex.primaryMuscle} • {ex.sets.length} {ex.sets.length === 1 ? 'set' : 'sets'}
                      </small>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: isAllDone ? 'var(--color-success)' : 'var(--text-muted)',
                      }}
                    >
                      {completedCount} / {ex.sets.length}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Add Movement Button */}
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => {
                onClose();
                onAddMovement();
              }}
              style={{ marginTop: 'var(--space-2)' }}
            >
              <Plus size={16} /> Add Movement
            </button>
          </div>
        </div>

        {/* Footer with Secondary Overview Switch & Cancel */}
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-outline btn-block btn-sm"
            onClick={() => {
              onClose();
              onToggleViewMode();
            }}
          >
            <LayoutGrid size={15} /> Switch to Table Overview Mode
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block btn-sm"
            onClick={() => {
              onClose();
              onCancelWorkout();
            }}
            style={{ color: 'var(--color-error)' }}
          >
            <AlertTriangle size={14} /> Cancel Workout
          </button>
        </div>
      </div>
    </div>
  );
};
