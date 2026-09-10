import React, { useState, useMemo } from 'react';
import { Search, Dumbbell, ArrowRightLeft, BookOpen, Plus, X } from 'lucide-react';
import { Exercise } from '@/types/workout.types';
import { filterExerciseCatalog } from '@/domain/exercise-search';
import { findExerciseAlternatives } from '@/domain/exercise-alternatives';
import { FALLBACK_EXERCISES } from '@/services/exercise.service';
import { ExerciseDetailModal } from './ExerciseDetailModal';

interface ExerciseLibraryViewProps {
  exercises?: Exercise[];
  onSelectExerciseForWorkout?: (exercise: Exercise) => void;
  isSelectionMode?: boolean;
}

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Core'];
const EQUIPMENT_LIST = ['All', 'Barbell', 'Dumbbells', 'Cable', 'Bodyweight'];
const DIFFICULTY_LIST = ['All', 'beginner', 'intermediate', 'advanced'];

export const ExerciseLibraryView: React.FC<ExerciseLibraryViewProps> = ({
  exercises = FALLBACK_EXERCISES,
  onSelectExerciseForWorkout,
  isSelectionMode = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [activeModalExercise, setActiveModalExercise] = useState<Exercise | null>(null);

  // Pure domain filtering
  const filteredExercises = useMemo(() => {
    return filterExerciseCatalog(exercises, {
      muscle: selectedMuscle,
      equipment: selectedEquipment,
      difficulty: selectedDifficulty,
      search: searchQuery,
    });
  }, [exercises, selectedMuscle, selectedEquipment, selectedDifficulty, searchQuery]);

  // Alternatives for active modal
  const activeAlternatives = useMemo(() => {
    if (!activeModalExercise) return [];
    return findExerciseAlternatives(activeModalExercise, exercises);
  }, [activeModalExercise, exercises]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedMuscle('All');
    setSelectedEquipment('All');
    setSelectedDifficulty('All');
  };

  const hasActiveFilters = searchQuery !== '' || selectedMuscle !== 'All' || selectedEquipment !== 'All' || selectedDifficulty !== 'All';

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) calc(var(--bottom-nav-height) + var(--space-8))' }}>
      {/* Editorial Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span className="badge badge-accent">Movement Index</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filteredExercises.length} of {exercises.length} Exercises
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>Exercise Library</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '640px' }}>
          Biomechanical setup guides, execution form cues, common mistakes, and deterministic movement alternatives.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="input"
            placeholder="Search exercises by name, muscle, or movement pattern..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '42px', paddingRight: searchQuery ? '42px' : '14px' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Chips Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Muscle Group Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '54px' }}>
              Muscle
            </span>
            {MUSCLE_GROUPS.map(muscle => (
              <button
                key={muscle}
                type="button"
                className={`btn btn-sm ${selectedMuscle === muscle ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}
                onClick={() => setSelectedMuscle(muscle)}
              >
                {muscle}
              </button>
            ))}
          </div>

          {/* Equipment & Difficulty Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Equipment:
              </span>
              {EQUIPMENT_LIST.map(eq => (
                <button
                  key={eq}
                  type="button"
                  className={`btn btn-sm ${selectedEquipment === eq ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minHeight: '30px', padding: '0 10px', fontSize: '0.75rem', border: '1px solid var(--border-subtle)' }}
                  onClick={() => setSelectedEquipment(eq)}
                >
                  {eq}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Difficulty:
              </span>
              {DIFFICULTY_LIST.map(diff => (
                <button
                  key={diff}
                  type="button"
                  className={`btn btn-sm ${selectedDifficulty === diff ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minHeight: '30px', padding: '0 10px', fontSize: '0.75rem', border: '1px solid var(--border-subtle)', textTransform: 'capitalize' }}
                  onClick={() => setSelectedDifficulty(diff)}
                >
                  {diff}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={clearFilters}
                style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Exercise Cards Grid */}
      {filteredExercises.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
          <Dumbbell size={32} color="var(--text-muted)" style={{ margin: '0 auto var(--space-3)' }} />
          <h3 style={{ marginBottom: 'var(--space-2)' }}>No matching exercises found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            Try clearing your filters or searching for a different muscle or movement pattern.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {filteredExercises.map(exercise => (
            <div
              key={exercise.id}
              className="card card-interactive"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 'var(--space-4)',
              }}
              onClick={() => setActiveModalExercise(exercise)}
            >
              <div>
                {/* Header Tag Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span className="badge badge-accent">{exercise.primaryMuscle}</span>
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <span className="badge">{exercise.equipmentRequired}</span>
                    <span className="badge" style={{ textTransform: 'capitalize' }}>{exercise.difficulty}</span>
                  </div>
                </div>

                {/* Exercise Title */}
                <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>
                  {exercise.name}
                </h3>

                {/* Pattern & Synapses */}
                <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-3)' }}>
                  {exercise.movementPattern} • {exercise.secondaryMuscles.join(', ') || 'Direct isolation'}
                </small>

                {/* Top Coach Cue Preview */}
                {exercise.cues && exercise.cues.length > 0 && (
                  <div style={{
                    background: 'var(--bg-input)',
                    borderLeft: '2px solid var(--accent-primary)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: '0 var(--radius-xs) var(--radius-xs) 0',
                    marginBottom: 'var(--space-3)',
                  }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                      "{exercise.cues[0]}"
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                {isSelectionMode && onSelectExerciseForWorkout ? (
                  <button
                    className="btn btn-primary btn-sm btn-block"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectExerciseForWorkout(exercise);
                    }}
                  >
                    <Plus size={15} /> Add to Workout
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalExercise(exercise);
                      }}
                    >
                      <BookOpen size={14} /> Guide
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalExercise(exercise);
                      }}
                    >
                      <ArrowRightLeft size={14} /> Alternatives
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coaching Detail & Alternatives Modal */}
      {activeModalExercise && (
        <ExerciseDetailModal
          exercise={activeModalExercise}
          alternatives={activeAlternatives}
          onClose={() => setActiveModalExercise(null)}
          onSelectAlternative={(alt) => setActiveModalExercise(alt)}
          onSwapInWorkout={onSelectExerciseForWorkout}
          isWorkoutSwapMode={isSelectionMode}
        />
      )}
    </div>
  );
};
