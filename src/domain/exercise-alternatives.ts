import { Exercise } from '@/types/workout.types';

/**
 * Direct substitution graph mapping canonical exercise IDs or names to alternative IDs/names.
 */
const DIRECT_ALTERNATIVES_MAP: Record<string, string[]> = {
  // Chest
  'Barbell Bench Press': ['Incline Dumbbell Press', 'Dumbbell Bench Press', 'Push-Up', 'Cable Chest Fly'],
  'Incline Dumbbell Press': ['Barbell Bench Press', 'Dumbbell Bench Press', 'Push-Up', 'Cable Chest Fly'],
  'Push-Up': ['Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Cable Chest Fly'],
  'Cable Chest Fly': ['Dumbbell Fly', 'Incline Dumbbell Press', 'Push-Up'],

  // Back / Posterior Chain
  'Conventional Deadlift': ['Romanian Deadlift', 'Trap Bar Deadlift', 'Dumbbell RDL'],
  'Barbell Bent-Over Row': ['Seated Cable Row', 'Dumbbell Single-Arm Row', 'Lat Pulldown'],
  'Lat Pulldown': ['Pull-Up', 'Seated Cable Row', 'Straight-Arm Pulldown'],
  'Seated Cable Row': ['Barbell Bent-Over Row', 'Lat Pulldown', 'Dumbbell Single-Arm Row'],

  // Shoulders
  'Overhead Barbell Press': ['Dumbbell Shoulder Press', 'Arnold Press', 'Dumbbell Lateral Raise', 'Pike Push-Up'],
  'Dumbbell Lateral Raise': ['Cable Lateral Raise', 'Face Pull'],
  'Rear Delt Face Pull': ['Dumbbell Rear Delt Fly', 'Dumbbell Lateral Raise'],

  // Legs
  'Barbell Back Squat': ['Goblet Squat', 'Bulgarian Split Squat', 'Leg Press', 'Bodyweight Squat'],
  'Romanian Deadlift': ['Conventional Deadlift', 'Dumbbell RDL', 'Trap Bar Deadlift'],
  'Goblet Squat': ['Barbell Back Squat', 'Bulgarian Split Squat', 'Bodyweight Squat'],
  'Bulgarian Split Squat': ['Goblet Squat', 'Barbell Back Squat', 'Walking Lunge'],
  'Calf Raise': ['Seated Calf Raise', 'Standing Dumbbell Calf Raise'],

  // Arms
  'Barbell Bicep Curl': ['Hammer Curl', 'Dumbbell Bicep Curl', 'Incline Dumbbell Curl'],
  'Hammer Curl': ['Barbell Bicep Curl', 'Cable Rope Curl', 'Dumbbell Bicep Curl'],
  'Tricep Cable Pushdown': ['Overhead Dumbbell Tricep Extension', 'Skull Crushers', 'Dips'],
  'Overhead Dumbbell Tricep Extension': ['Tricep Cable Pushdown', 'Skull Crushers', 'Close-Grip Push-Up'],

  // Core
  'Plank': ['Hanging Leg Raise', 'Ab Wheel Rollout', 'Deadbug'],
  'Hanging Leg Raise': ['Plank', 'Captain’s Chair Leg Raise', 'Cable Woodchopper'],
};

/**
 * Finds high-quality deterministic alternatives for any exercise.
 * 1. Checks explicit `alternativeExerciseIds` on the exercise object.
 * 2. Checks canonical name substitution map.
 * 3. Fallback: matches same primary muscle + compatible movement pattern.
 */
export function findExerciseAlternatives(
  targetExercise: Exercise,
  allAvailableExercises: Exercise[],
  limit = 4
): Exercise[] {
  const alternatives: Exercise[] = [];
  const addedIds = new Set<string>([targetExercise.id]);

  // 1. Check explicit alternative IDs on target exercise
  if (targetExercise.alternativeExerciseIds && targetExercise.alternativeExerciseIds.length > 0) {
    for (const altId of targetExercise.alternativeExerciseIds) {
      const match = allAvailableExercises.find(ex => ex.id === altId && !addedIds.has(ex.id));
      if (match) {
        alternatives.push(match);
        addedIds.add(match.id);
      }
    }
  }

  // 2. Check canonical name substitution map
  const mappedNames = DIRECT_ALTERNATIVES_MAP[targetExercise.name] || [];
  for (const name of mappedNames) {
    if (alternatives.length >= limit) break;
    const match = allAvailableExercises.find(
      ex => ex.name.toLowerCase() === name.toLowerCase() && !addedIds.has(ex.id)
    );
    if (match) {
      alternatives.push(match);
      addedIds.add(match.id);
    }
  }

  // 3. Fallback: match by primary muscle and same/compatible movement pattern
  if (alternatives.length < limit) {
    const isHinge =
      targetExercise.movementPattern.toLowerCase().includes('hinge') ||
      targetExercise.name.toLowerCase().includes('deadlift');

    if (isHinge) {
      // Hinge movements must strictly substitute with other hip hinge / deadlift movements
      const hingeCandidates = allAvailableExercises.filter(ex => {
        if (addedIds.has(ex.id)) return false;
        const exPattern = ex.movementPattern.toLowerCase();
        const exName = ex.name.toLowerCase();
        return (
          (exPattern.includes('hinge') || exName.includes('deadlift') || exName.includes('rdl')) &&
          !exName.includes('row') &&
          !exPattern.includes('pull')
        );
      });

      for (const candidate of hingeCandidates) {
        if (alternatives.length >= limit) break;
        alternatives.push(candidate);
        addedIds.add(candidate.id);
      }
    } else {
      const candidateList = allAvailableExercises.filter(ex => {
        if (addedIds.has(ex.id)) return false;
        return ex.primaryMuscle.toLowerCase() === targetExercise.primaryMuscle.toLowerCase();
      });

      // Prefer exact same movement pattern first
      for (const candidate of candidateList) {
        if (alternatives.length >= limit) break;
        if (candidate.movementPattern.toLowerCase() === targetExercise.movementPattern.toLowerCase()) {
          alternatives.push(candidate);
          addedIds.add(candidate.id);
        }
      }

      // Then compatible movements within the same muscle group
      const isSquatOrLunge = /squat|lunge/i.test(targetExercise.movementPattern);
      const isPush = targetExercise.movementPattern.toLowerCase().includes('push');
      const isPull = targetExercise.movementPattern.toLowerCase().includes('pull');

      for (const candidate of candidateList) {
        if (alternatives.length >= limit) break;
        if (!addedIds.has(candidate.id)) {
          const candPattern = candidate.movementPattern.toLowerCase();
          // Never substitute squat/lunge with hinge, pull, or isolation
          if (isSquatOrLunge && !/squat|lunge/i.test(candPattern)) continue;
          // Never substitute push with pull or vice versa
          if (isPush && candPattern.includes('pull')) continue;
          if (isPull && candPattern.includes('push')) continue;

          alternatives.push(candidate);
          addedIds.add(candidate.id);
        }
      }
    }
  }

  return alternatives.slice(0, limit);
}
