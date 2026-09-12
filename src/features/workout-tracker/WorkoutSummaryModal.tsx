import React, { useEffect } from 'react';
import { Trophy, Clock, Dumbbell, Award, ArrowRight, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { WorkoutSession } from '@/types/workout.types';
import { calculateWorkoutSummary } from '@/domain/workout-tonnage';
import { formatTimerClock } from '@/utils/formatters';
import { hasCompletedCoreExercise } from '@/domain/streak-calculator';

interface WorkoutSummaryModalProps {
  session: WorkoutSession;
  onClose: () => void;
  onViewProgress?: () => void;
  existingPrsMap?: Record<string, number>;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  session,
  onClose,
  onViewProgress,
  existingPrsMap = {},
}) => {
  const summary = calculateWorkoutSummary(session, existingPrsMap);
  const isCoreDone = hasCompletedCoreExercise(session);

  // Event-driven celebratory moment: Electric Blue & Success Green confetti strictly when a new PR is broken
  useEffect(() => {
    if (summary.newPersonalRecords.length > 0) {
      try {
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4F8CFF', '#72B879', '#F4F6F8'],
          disableForReducedMotion: true,
        });
      } catch {
        // safe fallback
      }
    }
  }, [summary.newPersonalRecords.length]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        style={{ maxWidth: '520px', padding: 'var(--space-6)', borderColor: 'var(--border-medium)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Completion Header (Restrained Success Green) */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--color-success-muted)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-3)',
            border: '1px solid var(--color-success)',
          }}>
            <Check size={28} strokeWidth={3} />
          </div>

          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
            <span className="badge badge-success">
              Workout Completed
            </span>
            {session.gymVerified && (
              <span className="badge" style={{ background: 'rgba(127, 166, 107, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(127, 166, 107, 0.3)' }}>
                ✓ Gym Verified
              </span>
            )}
            {isCoreDone ? (
              <span className="badge badge-accent">
                🔥 Streak Counted
              </span>
            ) : (
              <span className="badge" style={{ color: '#eab308', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                ⚠️ Core Exercise Incomplete (Streak Not Advanced)
              </span>
            )}
          </div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-1)' }}>{session.name}</h2>
          <small style={{ color: 'var(--text-muted)' }}>
            Logged on {new Date(session.completedAt || Date.now()).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </small>
        </div>

        {/* 4-Stat Metric Grid with IBM Plex Mono figures */}
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
            <div className="value" style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
              {summary.totalVolumeKg.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>KG</span>
            </div>
          </div>

          <div className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--text-muted)' }}>
              <Clock size={14} />
              <span className="label">Duration</span>
            </div>
            <div className="value" style={{ fontFamily: 'var(--font-mono)' }}>
              {formatTimerClock(session.durationSeconds)}
            </div>
          </div>

          <div className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--text-muted)' }}>
              <Check size={14} />
              <span className="label">Sets Logged</span>
            </div>
            <div className="value" style={{ fontFamily: 'var(--font-mono)' }}>
              {summary.totalCompletedSets}
            </div>
          </div>

          <div className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--text-muted)' }}>
              <Award size={14} />
              <span className="label">Total Reps</span>
            </div>
            <div className="value" style={{ fontFamily: 'var(--font-mono)' }}>
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
              <Trophy size={16} color="var(--accent-gold)" />
              <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-gold)' }}>
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
                    <span className="badge badge-gold" style={{ fontFamily: 'var(--font-mono)' }}>
                      {pr.weightKg} kg × {pr.reps} reps
                    </span>
                    <small style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>1RM: {pr.estimated1RM} kg</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={onClose}
          >
            Back to Home <Check size={16} />
          </button>
          {onViewProgress && (
            <button
              className="btn btn-ghost btn-block"
              onClick={onViewProgress}
              style={{ color: 'var(--accent-primary)' }}
            >
              View Progress & Analytics <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
