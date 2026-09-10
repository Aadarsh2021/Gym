import { Exercise } from '@/types/workout.types';

export interface ExerciseFilterCriteria {
  muscle?: string;
  equipment?: string;
  difficulty?: string;
  movementPattern?: string;
  search?: string;
}

/**
 * Pure deterministic filter function for exercise collections.
 * Platform-independent (no DOM, no browser APIs).
 */
export function filterExerciseCatalog(
  exercises: Exercise[],
  criteria?: ExerciseFilterCriteria
): Exercise[] {
  if (!criteria) return exercises;

  const normalizedSearch = criteria.search?.trim().toLowerCase();
  const normalizedMuscle = criteria.muscle?.trim().toLowerCase();
  const normalizedEquipment = criteria.equipment?.trim().toLowerCase();
  const normalizedDifficulty = criteria.difficulty?.trim().toLowerCase();
  const normalizedPattern = criteria.movementPattern?.trim().toLowerCase();

  return exercises.filter(exercise => {
    // 1. Muscle Filter
    if (normalizedMuscle && normalizedMuscle !== 'all') {
      const primaryMatch = exercise.primaryMuscle.toLowerCase() === normalizedMuscle;
      const secondaryMatch = exercise.secondaryMuscles.some(
        m => m.toLowerCase() === normalizedMuscle
      );
      if (!primaryMatch && !secondaryMatch) {
        return false;
      }
    }

    // 2. Equipment Filter
    if (normalizedEquipment && normalizedEquipment !== 'all') {
      if (exercise.equipmentRequired.toLowerCase() !== normalizedEquipment) {
        return false;
      }
    }

    // 3. Difficulty Filter
    if (normalizedDifficulty && normalizedDifficulty !== 'all') {
      if (exercise.difficulty.toLowerCase() !== normalizedDifficulty) {
        return false;
      }
    }

    // 4. Movement Pattern Filter
    if (normalizedPattern && normalizedPattern !== 'all') {
      if (exercise.movementPattern.toLowerCase() !== normalizedPattern) {
        return false;
      }
    }

    // 5. Search Filter (searches name, primary muscle, and movement pattern)
    if (normalizedSearch) {
      const matchesName = exercise.name.toLowerCase().includes(normalizedSearch);
      const matchesMuscle = exercise.primaryMuscle.toLowerCase().includes(normalizedSearch);
      const matchesPattern = exercise.movementPattern.toLowerCase().includes(normalizedSearch);
      if (!matchesName && !matchesMuscle && !matchesPattern) {
        return false;
      }
    }

    return true;
  });
}
