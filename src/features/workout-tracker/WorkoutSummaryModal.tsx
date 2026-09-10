import React from 'react';
import { Trophy, Clock, Dumbbell, Award, ArrowRight, Check } from 'lucide-react';
import { WorkoutSession } from '@/types/workout.types';
import { calculateWorkoutSummary } from '@/domain/workout-tonnage';
import { formatTimerClock } from '@/utils/formatters';

interface WorkoutSummaryModalProps {
  session: WorkoutSession;
  onClose: () => void;
  existingPrsMap?: Record<string, number>;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  session,
  onClose,
  existingPrsMap = {},
}) => {
  const summary = calculateWorkoutSummary(session, existingPrsMap);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        style={{ maxWidth: '520px', padding: 'var(--space-6)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Celebration Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-primary-muted)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-3)',
            border: '1px solid rgba(199, 240, 0, 0.3)',
          }}>
            <Check size={28} strokeWidth={3} />
          </div>

          <span className="badge badge-accent" style={{ marginBottom: 'var(--space-1)' }}>
            Workout Completed
          </span>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-1)' }}>{session.name}</h2>
          <small style={{ color: 'var(--text-muted)' }}>
            Logged on {new Date(session.completedAt || Date.now()).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </small>
        </div>

        {/* 4-Stat Metric Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}>
          <div className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--text-muted)' }}>
              <Dumbbell size={14} />
              <span className="label">Total Tonnage</span>
            </div>
            <div className="value" style={{ color: 'var(--accent-primary)' }}>
              {summary.totalVolumeKg.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>KG</span>
            </div>
          </div>

          <div className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--text-muted)' }}>
              <Clock size={14} />
              <span className="label">Duration</span>
            </div>
            <div className="value">
              {formatTimerClock(session.durationSeconds)}
            </div>
          </div>

          <div className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--text-muted)' }}>
              <Check size={14} />
              <span className="label">Sets Logged</span>
            </div>
            <div className="value">
              {summary.totalCompletedSets}
            </div>
          </div>

          <div className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--text-muted)' }}>
              <Award size={14} />
              <span className="label">Total Reps</span>
            </div>
            <div className="value">
              {summary.totalReps}
            </div>
          </div>
        </div>

        {/* New Personal Records Section */}
        {summary.newPersonalRecords.length > 0 && (
          <div style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Trophy size={16} color="var(--color-warning)" />
              <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-warning)' }}>
                Personal Records Broken ({summary.newPersonalRecords.length})
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {summary.newPersonalRecords.map((pr, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{pr.exerciseName}</strong>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <span className="badge badge-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {pr.weightKg} kg × {pr.reps} reps
                    </span>
                    <small style={{ color: 'var(--text-muted)' }}>1RM: {pr.estimated1RM} kg</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={onClose}
        >
          View Dashboard & Progress <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
