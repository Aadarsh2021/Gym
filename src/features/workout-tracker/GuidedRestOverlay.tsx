import React from 'react';
import { Timer, Play, Pause, Plus, Minus, ArrowRight } from 'lucide-react';
import { formatTimerClock } from '@/utils/formatters';
import { ExerciseMotionVisualizer } from '@/components/workout/ExerciseMotionVisualizer';

interface GuidedRestOverlayProps {
  secondsRemaining: number;
  progressFraction: number;
  isPaused: boolean;
  onAddTime: (sec?: number) => void;
  onSubtractTime: (sec?: number) => void;
  onTogglePause: () => void;
  onSkipRest: () => void;
  nextExerciseName: string;
  nextSetIndex: number;
  totalSets: number;
  targetWeightKg: number;
  targetReps: number;
  previousPerformance?: { weightKg: number; reps: number; rpe?: number };
}

export const GuidedRestOverlay: React.FC<GuidedRestOverlayProps> = ({
  secondsRemaining,
  progressFraction,
  isPaused,
  onAddTime,
  onSubtractTime,
  onTogglePause,
  onSkipRest,
  nextExerciseName,
  nextSetIndex,
  totalSets,
  targetWeightKg,
  targetReps,
  previousPerformance,
}) => {
  return (
    <div
      className="card card-elevated animate-fade-in"
      style={{
        padding: 'var(--space-6)',
        textAlign: 'center',
        background: 'var(--bg-surface-elevated)',
        borderColor: 'var(--accent-primary)',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Thin Progress Line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'var(--border-subtle)',
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'var(--accent-primary)',
            width: `${Math.min(100, Math.max(0, progressFraction * 100))}%`,
            transition: 'width 1s linear',
          }}
        />
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
        <Timer size={18} />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Rest & Recover
        </span>
      </div>

      {/* Large Numerical Countdown Clock */}
      <div
        style={{
          fontSize: '4.2rem',
          fontWeight: 900,
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent-primary)',
          lineHeight: 1,
          margin: 'var(--space-2) 0 var(--space-4)',
          letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTimerClock(secondsRemaining)}
      </div>

      {/* Quick Interval Adjustment Steppers */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onSubtractTime(15)}
          title="Subtract 15 seconds"
          style={{ minWidth: '64px', fontFamily: 'var(--font-mono)' }}
        >
          <Minus size={14} /> 15s
        </button>

        <button
          type="button"
          className={`btn ${isPaused ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={onTogglePause}
          style={{ minWidth: '84px' }}
        >
          {isPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onAddTime(30)}
          title="Add 30 seconds"
          style={{ minWidth: '64px', fontFamily: 'var(--font-mono)' }}
        >
          <Plus size={14} /> 30s
        </button>
      </div>

      {/* Up Next Preview Panel */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          textAlign: 'left',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Up Next
          </span>
          <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
            Set {nextSetIndex} of {totalSets}
          </span>
        </div>

        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
          {nextExerciseName}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', fontSize: '0.88rem', marginBottom: 'var(--space-2)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Target: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{targetWeightKg} kg</strong> × <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{targetReps} reps</strong>
          </span>
          {previousPerformance && (
            <small style={{ color: 'var(--text-muted)' }}>
              (Last: {previousPerformance.weightKg}kg × {previousPerformance.reps})
            </small>
          )}
        </div>

        <div style={{ marginTop: 'var(--space-2)' }}>
          <ExerciseMotionVisualizer
            exerciseName={nextExerciseName}
            primaryMuscle="Next Focus"
            isCompact={true}
          />
        </div>
      </div>

      {/* Primary Skip CTA */}
      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        onClick={onSkipRest}
      >
        Skip Rest & Start Next Set <ArrowRight size={18} />
      </button>
    </div>
  );
};
