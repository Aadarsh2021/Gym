import React, { useState, useRef } from 'react';
import { Play, Pause, Wind, Compass, ShieldAlert, Sparkles } from 'lucide-react';
import { Exercise } from '@/types/workout.types';
import { ExerciseMotionVisualizer } from '@/components/workout/ExerciseMotionVisualizer';

export interface ExerciseVisualGuideProps {
  exercise: Exercise | {
    id?: string;
    name?: string;
    exerciseName?: string;
    primaryMuscle?: string;
    equipmentRequired?: string;
    difficulty?: string;
    demoVideoUrl?: string;
    demoImageUrl?: string;
    thumbnailUrl?: string;
    instructionSteps?: string[];
    instructions?: string[];
    commonMistakes?: string[];
    mistakesToAvoid?: string[];
    cues?: string[];
    visualCues?: {
      setup: string;
      movement: string;
      breathing: string;
      commonMistake: string;
    };
  };
  variant?: 'full' | 'compact' | 'card';
  showCues?: boolean;
  onStartSet?: () => void;
  ctaText?: string;
}

/**
 * Authoritative Exercise Visual Guide Component
 * Provides visual-first exercise execution:
 * 1. Looped motion video (muted, play/pause controls, fallback on error)
 * 2. Biomechanical animated motion visualizer
 * 3. High-clarity 4-point execution cues (Setup, Movement, Breathing, Common Mistake)
 * 4. Graceful "in preparation" fallback — NEVER fake or mislabeled visuals.
 */
export const ExerciseVisualGuide: React.FC<ExerciseVisualGuideProps> = ({
  exercise,
  variant = 'full',
  showCues = true,
  onStartSet,
  ctaText = 'Start Set',
}) => {
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const name = ('name' in exercise && exercise.name) ? exercise.name : (exercise as any).exerciseName || 'Exercise';
  const primaryMuscle = exercise.primaryMuscle || 'Full Body';
  const equipment = exercise.equipmentRequired || 'Bodyweight';
  const difficulty = exercise.difficulty;

  // Toggle video playback
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Derive structured 4 cues
  const visualCues = exercise.visualCues || {
    setup: exercise.instructionSteps?.[0]
      || exercise.instructions?.[0]
      || 'Assume a stable, balanced posture with feet planted and core braced.',
    movement: exercise.instructionSteps?.[1]
      || exercise.instructions?.[1]
      || exercise.cues?.[0]
      || 'Move through a full, controlled range of motion with focused muscle contraction.',
    breathing: exercise.cues?.find(c => /breath|inhale|exhale/i.test(c))
      || 'Breathe out during exertion (concentric); breathe in during controlled lowering (eccentric).',
    commonMistake: exercise.commonMistakes?.[0]
      || exercise.mistakesToAvoid?.[0]
      || 'Avoid using momentum, arching lower back, or rushing through the eccentric phase.',
  };

  const hasValidVideo = Boolean(exercise.demoVideoUrl && !videoError);
  const hasValidImage = Boolean(exercise.demoImageUrl && !imageError);

  const isCompact = variant === 'compact';
  const isCard = variant === 'card';

  return (
    <div
      className="exercise-visual-guide"
      data-testid="exercise-visual-guide"
      style={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-medium)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Visual Demonstration Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: isCompact ? '130px' : isCard ? '160px' : '220px',
          background: '#0a0d11',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasValidVideo ? (
          <>
            <video
              ref={videoRef}
              src={exercise.demoVideoUrl}
              poster={exercise.thumbnailUrl}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setVideoError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {/* Play/Pause Control Button */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause demonstration video' : 'Play demonstration video'}
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: '2px' }} />}
            </button>
          </>
        ) : hasValidImage ? (
          <img
            src={exercise.demoImageUrl}
            alt={`${name} demonstration`}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          /* Biomechanical Animated Motion Visualizer fallback */
          <ExerciseMotionVisualizer
            exerciseName={name}
            primaryMuscle={primaryMuscle}
            isCompact={isCompact || isCard}
          />
        )}

        {/* Visual Guide Mode Badge */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            display: 'flex',
            gap: '6px',
            pointerEvents: 'none',
          }}
        >
          <span
            className="badge badge-accent"
            style={{
              fontSize: '0.7rem',
              backdropFilter: 'blur(8px)',
              background: 'rgba(79, 142, 247, 0.85)',
              color: '#fff',
              border: 'none',
              padding: '2px 8px',
            }}
          >
            {hasValidVideo ? 'Video Demo' : 'Motion Guide'}
          </span>
        </div>
      </div>

      {/* Header Info */}
      <div style={{ padding: isCompact ? 'var(--space-3)' : 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <h3
              style={{
                margin: '0 0 4px',
                fontSize: isCompact ? '1.05rem' : '1.25rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
              }}
            >
              {name}
            </h3>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                {primaryMuscle}
              </span>
              <span className="badge" style={{ fontSize: '0.72rem' }}>
                {equipment}
              </span>
              {difficulty && (
                <span className="badge" style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>
                  {difficulty}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3-5 Short Form Execution Cues */}
        {showCues && !isCompact && (
          <div
            style={{
              marginTop: 'var(--space-4)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-2)',
            }}
          >
            {/* Setup Cue */}
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <Compass size={14} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-primary)', letterSpacing: '0.04em' }}>
                  1. Setup
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {visualCues.setup}
              </div>
            </div>

            {/* Movement Cue */}
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <Sparkles size={14} color="var(--color-success)" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-success)', letterSpacing: '0.04em' }}>
                  2. Movement
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {visualCues.movement}
              </div>
            </div>

            {/* Breathing Cue */}
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <Wind size={14} color="#38bdf8" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '0.04em' }}>
                  3. Breathing
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {visualCues.breathing}
              </div>
            </div>

            {/* Common Mistake */}
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <ShieldAlert size={14} color="var(--color-error)" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-error)', letterSpacing: '0.04em' }}>
                  4. Common Mistake
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {visualCues.commonMistake}
              </div>
            </div>
          </div>
        )}

        {/* CTA Button if provided */}
        {onStartSet && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={onStartSet}
              style={{ height: '50px', fontSize: '1.05rem', fontWeight: 800 }}
            >
              {ctaText} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
