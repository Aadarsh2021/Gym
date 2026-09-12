import { WorkoutPlanDay } from '@/types/workout.types';

/**
 * Generates an abbreviated "Short on Time Today" session (~15 minutes)
 * by prioritizing core compound exercises and condensing set volume.
 */
export function generateQuickSession(
  fullPlanDay: WorkoutPlanDay,
  targetDurationMinutes: number = 15
): WorkoutPlanDay {
  // 1. Filter for primary core movements (or fallback to first exercises if none explicitly marked)
  const coreExercises = fullPlanDay.exercises.filter(e => e.isCore);
  const exercisePool = coreExercises.length > 0 ? coreExercises : fullPlanDay.exercises;

  // 2. Budget ~5 minutes per exercise (warm-up + 2 working sets + brief rest)
  const maxExercises = Math.max(1, Math.min(exercisePool.length, Math.floor(targetDurationMinutes / 5)));
  const selected = exercisePool.slice(0, maxExercises);

  // 3. Condense to 2 sets max per exercise for high-efficiency completion
  return {
    ...fullPlanDay,
    name: `⚡ Quick: ${fullPlanDay.name}`,
    exercises: selected.map((ex, idx) => ({
      ...ex,
      orderIndex: idx + 1,
      targetSets: Math.min(ex.targetSets, 2),
    })),
  };
}
