import React, { useState } from 'react';
import {
  Check,
  Plus,
  Minus,
  ArrowRightLeft,
  TrendingUp,
  List,
  HelpCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { WorkoutSessionExercise, WorkoutSet } from '@/types/workout.types';
import { ProgressionRecommendation } from '@/domain/progression';
import { ExerciseVisualGuide } from '@/components/exercise/ExerciseVisualGuide';

interface GuidedExerciseStageProps {
  exercise: WorkoutSessionExercise;
  exerciseIndex: number;
  totalExercises: number;
  activeSetIndex: number;
  hasStartedExercise: boolean;
  onStartExercise: () => void;
  onSelectSet: (setIndex: number) => void;
  onToggleSetCompleted: (exerciseIndex: number, setIndex: number) => void;
  onUpdateSetValue: (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, val: any) => void;
  onAdjustWeight: (exerciseIndex: number, setIndex: number, delta: number) => void;
  onAddSet: (exerciseIndex: number) => void;
  onRemoveSet: (exerciseIndex: number, setIndex: number) => void;
  onOpenSwapModal: (exerciseIndex: number) => void;
  onOpenOutlineDrawer: () => void;
  onNextExercise: () => void;
  onPreviousExercise?: () => void;
  isLastExercise: boolean;
  onFinishWorkoutEarly: () => void;
  progression: ProgressionRecommendation;
  previousPerformance?: { weightKg: number; reps: number; rpe?: number };
  nextExerciseName?: string;
}

export const GuidedExerciseStage: React.FC<GuidedExerciseStageProps> = ({
  exercise,
  exerciseIndex,
  totalExercises,
  activeSetIndex,
  hasStartedExercise,
  onStartExercise,
  onSelectSet,
  onToggleSetCompleted,
  onUpdateSetValue,
  onAdjustWeight,
  onAddSet,
  onRemoveSet,
  onOpenSwapModal,
  onOpenOutlineDrawer,
  onNextExercise,
  isLastExercise,
  onFinishWorkoutEarly,
  progression,
  previousPerformance,
  nextExerciseName,
}) => {
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const totalSets = exercise.sets.length;
  const completedSetsCount = exercise.sets.filter(s => s.completed).length;
  const isExerciseFullyCompleted = totalSets > 0 && completedSetsCount === totalSets;
  const isLastSetOfExercise = activeSetIndex === totalSets - 1;
  const currentSet: WorkoutSet | undefined = exercise.sets[activeSetIndex] || exercise.sets[0];

  // Exercise volume calculation for completion summary
  const exerciseVolumeKg = exercise.sets
    .filter(s => s.completed)
    .reduce((sum, s) => sum + (s.weightKg * s.reps), 0);

  // =========================================================================
  // STATE 4: EXERCISE COMPLETE (Brief, action-oriented completion card)
  // =========================================================================
  if (isExerciseFullyCompleted) {
    return (
      <div
        className="card card-elevated animate-fade-in"
        style={{
          padding: 'var(--space-6)',
          textAlign: 'center',
          background: 'var(--bg-surface-elevated)',
          borderColor: 'rgba(114, 184, 121, 0.4)',
        }}
      >
        <div
          style={{
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
          }}
        >
          <Check size={28} strokeWidth={3} />
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          Movement Complete
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 var(--space-2)', color: 'var(--text-primary)' }}>
          {exercise.exerciseName}
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
          <span><strong style={{ color: 'var(--text-primary)' }}>{completedSetsCount} / {totalSets}</strong> sets</span>
          <span>•</span>
          <span>Total Volume: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{exerciseVolumeKg.toLocaleString()} kg</strong></span>
        </div>

        {nextExerciseName && !isLastExercise && (
          <div
            style={{
              marginBottom: 'var(--space-5)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Up Next
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {nextExerciseName}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {isLastExercise ? (
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={onFinishWorkoutEarly}
              style={{ height: '54px', fontSize: '1.1rem', fontWeight: 800 }}
            >
              Finish Workout & Review PRs →
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={onNextExercise}
              style={{ height: '54px', fontSize: '1.1rem', fontWeight: 800 }}
            >
              Next Exercise →
            </button>
          )}

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onSelectSet(0)}
            style={{ color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}
          >
            Review or Edit Completed Sets
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 1: EXERCISE INTRO (Dominant Visual, Specs & "START EXERCISE" CTA)
  // =========================================================================
  if (!hasStartedExercise && completedSetsCount === 0) {
    return (
      <div
        className="card card-elevated animate-fade-in"
        style={{
          padding: 'var(--space-5)',
          background: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-medium)',
        }}
      >
        {/* Step Indicator Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)' }}>
            Movement {exerciseIndex + 1} of {totalExercises}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {exercise.isCore && (
              <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>Core Lift</span>
            )}
            <span className="badge">{exercise.primaryMuscle}</span>
          </div>
        </div>

        {/* Visual Exercise Guide: Demonstration & Biomechanical Motion */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ExerciseVisualGuide
            exercise={{
              name: exercise.exerciseName,
              primaryMuscle: exercise.primaryMuscle,
              equipmentRequired: exercise.equipmentRequired,
              demoVideoUrl: exercise.demoVideoUrl,
              demoImageUrl: exercise.demoImageUrl,
              thumbnailUrl: exercise.thumbnailUrl,
              instructionSteps: exercise.instructionSteps,
              instructions: exercise.instructions,
              commonMistakes: exercise.commonMistakes,
              cues: exercise.cues,
              visualCues: exercise.visualCues,
            }}
            variant="full"
            showCues={true}
          />
        </div>

        {/* Movement Title */}
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            margin: '0 0 var(--space-3)',
            lineHeight: 1.2,
            color: 'var(--text-primary)',
          }}
        >
          {exercise.exerciseName}
        </h1>

        {/* Movement Spec Badges */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          <span
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Target: <strong style={{ color: 'var(--text-primary)' }}>{totalSets} Sets × {exercise.targetRepsMin || 8}–{exercise.targetRepsMax || 12} Reps</strong>
          </span>

          <span
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Rest: <strong style={{ color: 'var(--text-primary)' }}>{exercise.restSeconds || 90}s</strong>
          </span>
        </div>

        {/* Previous Performance Tile */}
        {previousPerformance ? (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '2px' }}>
              Previous Session Performance
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {previousPerformance.weightKg} kg × {previousPerformance.reps} reps
              {previousPerformance.rpe ? (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  @ RPE {previousPerformance.rpe}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 'var(--space-4)',
              fontSize: '0.84rem',
              color: 'var(--text-muted)',
            }}
          >
            First time performing this movement in the app. Dial in baseline weight.
          </div>
        )}

        {/* Progression Cue */}
        {progression && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--accent-primary-muted)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(79, 142, 247, 0.3)',
              marginBottom: 'var(--space-5)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <TrendingUp size={18} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {progression.cue}
            </span>
          </div>
        )}

        {/* DOMINANT PRIMARY CTA: START EXERCISE */}
        <button
          type="button"
          className="btn btn-primary btn-block btn-lg"
          onClick={onStartExercise}
          style={{
            height: '56px',
            fontSize: '1.15rem',
            fontWeight: 800,
            letterSpacing: '0.02em',
            boxShadow: '0 4px 20px rgba(79, 142, 247, 0.35)',
            marginBottom: 'var(--space-3)',
          }}
        >
          START EXERCISE →
        </button>

        {/* Secondary Utility Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--space-3)',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowInstructions(prev => !prev)}
            style={{ color: 'var(--text-secondary)' }}
          >
            <HelpCircle size={14} /> Instructions
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onOpenSwapModal(exerciseIndex)}
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowRightLeft size={14} /> Swap
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onOpenOutlineDrawer}
            style={{ color: 'var(--text-secondary)' }}
          >
            <List size={14} /> All Exercises
          </button>
        </div>

        {/* Collapsible Form Instructions */}
        {showInstructions && (
          <div
            className="animate-fade-in"
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong>Form Cues:</strong> Maintain a full range of motion. Control the eccentric phase for 2 seconds, pause briefly in the contracted position, and avoid using secondary momentum.
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STATE 2: ACTIVE SET (Focused, Dominant Weight & Reps Steppers, Large CTA)
  // =========================================================================
  return (
    <div
      className="card card-elevated animate-fade-in"
      style={{
        padding: 'var(--space-5)',
        background: 'var(--bg-surface-elevated)',
        borderColor: 'var(--border-medium)',
      }}
    >
      {/* Exercise Subheading & Set Progress Dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Movement {exerciseIndex + 1} of {totalExercises} • {exercise.primaryMuscle}
          </span>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
            {exercise.exerciseName}
          </h2>
        </div>

        {/* Visual Progress Indicator (Dots) */}
        <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }} title="Sets progress">
          {exercise.sets.map((s, sIdx) => (
            <div
              key={sIdx}
              onClick={() => onSelectSet(sIdx)}
              style={{
                width: sIdx === activeSetIndex ? '20px' : '9px',
                height: '9px',
                borderRadius: '5px',
                background: s.completed
                  ? 'var(--color-success)'
                  : sIdx === activeSetIndex
                  ? 'var(--accent-primary)'
                  : 'var(--border-subtle)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      {/* Biomechanical Live Motion Cadence Loop & Visual Guide */}
      <div style={{ margin: 'var(--space-2) 0 var(--space-3)' }}>
        <ExerciseVisualGuide
          exercise={{
            name: exercise.exerciseName,
            primaryMuscle: exercise.primaryMuscle,
            equipmentRequired: exercise.equipmentRequired,
            demoVideoUrl: exercise.demoVideoUrl,
            demoImageUrl: exercise.demoImageUrl,
            thumbnailUrl: exercise.thumbnailUrl,
            instructionSteps: exercise.instructionSteps,
            instructions: exercise.instructions,
            commonMistakes: exercise.commonMistakes,
            cues: exercise.cues,
            visualCues: exercise.visualCues,
          }}
          variant="compact"
          showCues={showInstructions}
        />
      </div>

      {currentSet && (
        <div>
          {/* Active Set Dominant Indicator */}
          <div style={{ textAlign: 'center', margin: 'var(--space-2) 0 var(--space-4)' }}>
            <span
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-primary)',
                letterSpacing: '0.05em',
              }}
            >
              SET {currentSet.setIndex} OF {totalSets}
            </span>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
              {previousPerformance ? (
                <span>
                  Last: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{previousPerformance.weightKg} kg × {previousPerformance.reps}</strong>
                </span>
              ) : (
                <span>First time logging this movement</span>
              )}
              <span>•</span>
              <span>
                Target: <strong style={{ color: 'var(--text-secondary)' }}>{exercise.targetRepsMin || 8}–{exercise.targetRepsMax || 12} reps</strong>
              </span>
            </div>
          </div>

          {/* DUAL DOMINANT HERO STEPPERS: Weight & Reps */}
          <div className="guided-steppers-grid">
            {/* WEIGHT STEPPER */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-2)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'block',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Weight (KG)
              </span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onAdjustWeight(exerciseIndex, activeSetIndex, -2.5)}
                  style={{ height: '46px', width: '38px', minWidth: '38px', padding: 0, borderRadius: 'var(--radius-xs)' }}
                  title="Minus 2.5 kg"
                >
                  <Minus size={18} strokeWidth={2.5} />
                </button>

                <div style={{ flex: '1 1 50px', maxWidth: '85px', minWidth: '40px' }}>
                  <input
                    type="number"
                    className="input"
                    value={currentSet.weightKg}
                    min={0}
                    step={0.5}
                    onChange={e => onUpdateSetValue(exerciseIndex, activeSetIndex, 'weightKg', parseFloat(e.target.value) || 0)}
                    style={{
                      height: '46px',
                      fontSize: '1.65rem',
                      fontWeight: 900,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      padding: 0,
                      background: 'var(--bg-surface)',
                      borderColor: 'var(--border-medium)',
                      width: '100%',
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onAdjustWeight(exerciseIndex, activeSetIndex, 2.5)}
                  style={{ height: '46px', width: '38px', minWidth: '38px', padding: 0, borderRadius: 'var(--radius-xs)' }}
                  title="Plus 2.5 kg"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* REPS STEPPER */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-2)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'block',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Reps Logged
              </span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onUpdateSetValue(exerciseIndex, activeSetIndex, 'reps', Math.max(0, currentSet.reps - 1))}
                  style={{ height: '46px', width: '38px', minWidth: '38px', padding: 0, borderRadius: 'var(--radius-xs)' }}
                  title="Minus 1 rep"
                >
                  <Minus size={18} strokeWidth={2.5} />
                </button>

                <div style={{ flex: '1 1 50px', maxWidth: '85px', minWidth: '40px' }}>
                  <input
                    type="number"
                    className="input"
                    value={currentSet.reps}
                    min={0}
                    onChange={e => onUpdateSetValue(exerciseIndex, activeSetIndex, 'reps', parseInt(e.target.value) || 0)}
                    style={{
                      height: '46px',
                      fontSize: '1.65rem',
                      fontWeight: 900,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      padding: 0,
                      background: 'var(--bg-surface)',
                      borderColor: 'var(--border-medium)',
                      width: '100%',
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onUpdateSetValue(exerciseIndex, activeSetIndex, 'reps', currentSet.reps + 1)}
                  style={{ height: '46px', width: '38px', minWidth: '38px', padding: 0, borderRadius: 'var(--radius-xs)' }}
                  title="Plus 1 rep"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          {/* PRIMARY ACTION CTA: COMPLETE SET (Dominant Action) */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={() => onToggleSetCompleted(exerciseIndex, activeSetIndex)}
              style={{
                height: '58px',
                fontSize: '1.18rem',
                fontWeight: 900,
                letterSpacing: '0.03em',
                boxShadow: '0 4px 20px rgba(79, 142, 247, 0.35)',
              }}
            >
              <Check size={22} strokeWidth={3} />
              {currentSet.completed
                ? `Set ${currentSet.setIndex} Completed (Tap to Undo)`
                : isLastSetOfExercise
                ? 'COMPLETE FINAL SET'
                : 'COMPLETE SET'}
            </button>
          </div>

          {/* ADVANCED CONTROLS / OPTIONS (Tucked Behind "More / Options") */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowMoreOptions(prev => !prev)}
              style={{
                color: 'var(--text-muted)',
                width: '100%',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.82rem',
              }}
            >
              <SlidersHorizontal size={14} />
              {showMoreOptions ? 'Hide Advanced Options ▲' : 'More / Advanced Options ▼'}
            </button>

            {showMoreOptions && (
              <div
                className="animate-fade-in"
                style={{
                  marginTop: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                {/* Set Type & RPE Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Set Type
                    </label>
                    <select
                      className="select"
                      value={currentSet.setType || 'normal'}
                      onChange={e => onUpdateSetValue(exerciseIndex, activeSetIndex, 'setType', e.target.value)}
                      style={{ width: '100%', height: '36px', minHeight: '36px', fontSize: '0.82rem' }}
                    >
                      <option value="normal">Work Set</option>
                      <option value="warmup">Warmup</option>
                      <option value="drop">Drop Set</option>
                      <option value="failure">To Failure</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      RPE Effort
                    </label>
                    <select
                      className="select"
                      value={currentSet.rpe || 8}
                      onChange={e => onUpdateSetValue(exerciseIndex, activeSetIndex, 'rpe', parseFloat(e.target.value))}
                      style={{ width: '100%', height: '36px', minHeight: '36px', fontSize: '0.82rem' }}
                    >
                      <option value={6}>6 (Warmup / Light)</option>
                      <option value={7}>7 (3 reps in reserve)</option>
                      <option value={8}>8 (2 reps in reserve)</option>
                      <option value={8.5}>8.5 (1-2 in reserve)</option>
                      <option value={9}>9 (1 in reserve)</option>
                      <option value={9.5}>9.5 (Near max)</option>
                      <option value={10}>10 (Absolute limit)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Weight Adjustments Chips */}
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Quick Micro-Load Chips
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[-5, -1, +1, +5].map(delta => (
                      <button
                        key={delta}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onAdjustWeight(exerciseIndex, activeSetIndex, delta)}
                        style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}
                      >
                        {delta > 0 ? `+${delta} kg` : `${delta} kg`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add / Remove Set & Swap Action Buttons */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onAddSet(exerciseIndex)}
                  >
                    <Plus size={14} /> Add Set
                  </button>

                  {exercise.sets.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onRemoveSet(exerciseIndex, exercise.sets.length - 1)}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Remove Set
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onOpenSwapModal(exerciseIndex)}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <ArrowRightLeft size={14} /> Swap Movement
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
