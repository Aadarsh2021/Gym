import React from 'react';
import { TrendingUp, Clock, Check, Dumbbell, Award, Timer } from 'lucide-react';
import { formatTimerClock } from '@/utils/formatters';
import { ProgressionRecommendation } from '@/domain/progression';

interface GuidedCockpitSidebarProps {
  elapsedSeconds: number;
  totalCompletedSets: number;
  totalSetsInWorkout: number;
  totalVolumeKg: number;
  isRestActive: boolean;
  restSecondsRemaining: number;
  restProgressFraction: number;
  onAddRestTime: (sec?: number) => void;
  onSubtractRestTime: (sec?: number) => void;
  onSkipRest: () => void;
  isRestPaused: boolean;
  onToggleRestPause: () => void;
  standardRestSeconds: number;
  previousPerformance?: { weightKg: number; reps: number; rpe?: number };
  existing1RM?: number;
  progression: ProgressionRecommendation;
  nextExerciseName?: string;
  nextExerciseMuscle?: string;
}

export const GuidedCockpitSidebar: React.FC<GuidedCockpitSidebarProps> = ({
  elapsedSeconds,
  totalCompletedSets,
  totalSetsInWorkout,
  totalVolumeKg,
  isRestActive,
  restSecondsRemaining,
  restProgressFraction,
  onAddRestTime,
  onSubtractRestTime,
  onSkipRest,
  isRestPaused,
  onToggleRestPause,
  standardRestSeconds,
  previousPerformance,
  existing1RM,
  progression,
  nextExerciseName,
  nextExerciseMuscle,
}) => {
  return (
    <div
      className="card card-elevated"
      style={{
        padding: 'var(--space-4)',
        background: 'var(--bg-surface-elevated)',
        borderColor: 'var(--border-medium)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      {/* 1. SESSION OVERVIEW */}
      <div>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'block',
            marginBottom: 'var(--space-2)',
          }}
        >
          Session
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
          <div style={{ padding: '8px 4px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-xs)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <Clock size={11} /> Time
            </div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', marginTop: '2px' }}>
              {formatTimerClock(elapsedSeconds)}
            </div>
          </div>

          <div style={{ padding: '8px 4px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-xs)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <Check size={11} /> Sets
            </div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
              {totalCompletedSets}/{totalSetsInWorkout}
            </div>
          </div>

          <div style={{ padding: '8px 4px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-xs)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <Dumbbell size={11} /> Volume
            </div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
              {totalVolumeKg >= 1000 ? `${(totalVolumeKg / 1000).toFixed(1)}k` : totalVolumeKg} kg
            </div>
          </div>
        </div>
      </div>

      {/* 2. REST & RECOVERY (Rendered with accent if active, subdued info if inactive) */}
      {isRestActive ? (
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'var(--accent-primary-muted)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--accent-primary)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Timer size={13} /> Rest Active
            </span>
            <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>Pacing</span>
          </div>

          <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', margin: '6px 0', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'var(--accent-primary)',
                width: `${Math.min(100, Math.max(0, restProgressFraction * 100))}%`,
                transition: 'width 1s linear',
              }}
            />
          </div>

          <div
            style={{
              fontSize: '2.2rem',
              fontWeight: 900,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-primary)',
              textAlign: 'center',
              margin: '2px 0 6px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTimerClock(restSecondsRemaining)}
          </div>

          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onSubtractRestTime(15)}
              style={{ padding: '0 8px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}
            >
              -15s
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onToggleRestPause}
              style={{ padding: '0 8px', fontSize: '0.72rem' }}
            >
              {isRestPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onAddRestTime(30)}
              style={{ padding: '0 8px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}
            >
              +30s
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSkipRest}
              style={{ padding: '0 10px', fontSize: '0.72rem' }}
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '2px' }}>
            Target Rest
          </span>
          <span style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            {standardRestSeconds}s between working sets
          </span>
        </div>
      )}

      {/* 3. PREVIOUS PERFORMANCE */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          Previous
        </span>

        {previousPerformance ? (
          <div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {previousPerformance.weightKg} kg × {previousPerformance.reps} reps
            </div>
            {previousPerformance.rpe ? (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Exertion: RPE {previousPerformance.rpe}
              </div>
            ) : null}
            {existing1RM && existing1RM > 0 ? (
              <div style={{ fontSize: '0.76rem', color: 'var(--accent-gold)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Award size={12} /> Record 1RM: {existing1RM} kg
              </div>
            ) : null}
          </div>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            First session logging this movement
          </span>
        )}
      </div>

      {/* 4. PROGRESSION CUE */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '4px',
          }}
        >
          <TrendingUp size={13} color="var(--accent-primary)" /> Progression
        </span>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
          {progression.cue}
        </p>
      </div>

      {/* 5. UP NEXT */}
      {nextExerciseName && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: '2px',
            }}
          >
            Up Next
          </span>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {nextExerciseName}
          </div>
          {nextExerciseMuscle && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {nextExerciseMuscle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
