/**
 * Authoritative Exercise Compatibility & Plan Validation Domain Rules (Phase C8)
 *
 * Enforces strict environment boundaries, declared equipment match,
 * user physical limitation / injury protection, and full-plan validation.
 */

import { Exercise, WorkoutPlanDay, WorkoutPlanExercise } from '@/types/workout.types';
import { WorkoutEnvironment } from '@/types/user.types';

export interface ExerciseValidationResult {
  valid: boolean;
  reason?: string;
}

export interface PlanValidationResult {
  isValid: boolean;
  errors: string[];
  invalidExerciseCount: number;
  validatedPlan?: any;
}

/**
 * High-stress / contraindicated exercise names per user limitation.
 * Conservative exclusion: If an exercise imposes high joint stress or axial shear on an injured area,
 * it must be excluded unless modified or supported.
 */
export const LIMITATION_INCOMPATIBLE_MAP: Record<string, string[]> = {
  'lower back': [
    'Conventional Deadlift',
    'Barbell Bent-Over Row',
    'Barbell Row',
    'Barbell Back Squat',
    'Good Morning',
  ],
  'knees': [
    'Barbell Back Squat',
    'Bulgarian Split Squat',
    'Walking Lunge',
    'Reverse Lunge',
  ],
  'shoulders': [
    'Overhead Barbell Press',
    'Chair/Bench Dips',
    'Dips',
    'Pike Push-Up',
  ],
  'wrists': [
    'Barbell Bench Press',
    'Barbell Bicep Curl',
  ],
  'elbows': [
    'Skull Crushers',
  ],
  'hips': [
    'Barbell Back Squat',
    'Bulgarian Split Squat',
  ],
  'ankles': [
    'Barbell Back Squat',
  ],
};

/**
 * Evaluates whether an exercise is compatible with the workout environment and available equipment.
 */
export function isExerciseCompatible(
  exercise: Exercise | { equipmentRequired?: string; equipment_required?: string },
  workoutEnvironment?: WorkoutEnvironment | null,
  availableEquipment: string[] = []
): boolean {
  const equipRequired = (
    ('equipmentRequired' in exercise && exercise.equipmentRequired
      ? exercise.equipmentRequired
      : 'equipment_required' in exercise && exercise.equipment_required
      ? exercise.equipment_required
      : '')
  )
    .trim()
    .toLowerCase();

  // If no environment specified, check available equipment (backward compatibility)
  if (!workoutEnvironment) {
    if (availableEquipment.length === 0) return true;
    const allowed = new Set(availableEquipment.map(e => e.toLowerCase()));
    allowed.add('bodyweight');
    allowed.add('none');
    return allowed.has(equipRequired);
  }

  // 1. HOME BODYWEIGHT: Strict calisthenics only
  // Disallows: Barbell, Dumbbell, Cable, Machine, Bench, Rack, etc.
  if (workoutEnvironment === 'home_bodyweight') {
    return equipRequired === 'bodyweight' || equipRequired === 'none' || equipRequired === '';
  }

  // 2. HOME EQUIPPED: User's declared home inventory + bodyweight
  if (workoutEnvironment === 'home_equipped') {
    const allowed = new Set(availableEquipment.map(e => e.toLowerCase()));
    allowed.add('bodyweight');
    allowed.add('none');
    return allowed.has(equipRequired);
  }

  // 3. EXTERNAL GYM: Commercial gym inventory or declared gear
  if (workoutEnvironment === 'external_gym') {
    if (availableEquipment.length > 0) {
      const allowed = new Set(availableEquipment.map(e => e.toLowerCase()));
      allowed.add('bodyweight');
      allowed.add('none');
      return allowed.has(equipRequired);
    }
    return true;
  }

  // 4. CONNECTED GYM: Partner facility inventory
  if (workoutEnvironment === 'connected_gym') {
    if (availableEquipment.length > 0) {
      const allowed = new Set(availableEquipment.map(e => e.toLowerCase()));
      allowed.add('bodyweight');
      allowed.add('none');
      return allowed.has(equipRequired);
    }
    return true;
  }

  return false;
}

/**
 * Evaluates whether an exercise is safe given the user's declared limitations/injuries.
 */
export function isExerciseLimitationSafe(
  exercise: Exercise | { name?: string },
  limitations: string[] = []
): boolean {
  const exName = exercise.name?.trim().toLowerCase() || '';
  if (!exName) return false;

  const normalized = limitations
    .map(l => l.trim().toLowerCase())
    .filter(l => l !== 'none' && l !== '');

  for (const lim of normalized) {
    const blacklisted = LIMITATION_INCOMPATIBLE_MAP[lim];
    if (blacklisted) {
      const isForbidden = blacklisted.some(
        name => name.toLowerCase() === exName
      );
      if (isForbidden) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validates an individual workout exercise across all product constraints:
 * 1. Metadata integrity (valid name, muscle, equipment)
 * 2. Workout environment & equipment compatibility
 * 3. Limitation & injury safety
 */
export function validateWorkoutExercise(
  exercise: Exercise | undefined | null,
  workoutEnvironment?: WorkoutEnvironment | null,
  availableEquipment: string[] = [],
  limitations: string[] = []
): ExerciseValidationResult {
  if (!exercise || !exercise.name) {
    return { valid: false, reason: 'Exercise record is missing or undefined.' };
  }

  if (!exercise.primaryMuscle) {
    return { valid: false, reason: `Exercise "${exercise.name}" is missing primaryMuscle metadata.` };
  }

  // Environment & equipment validation
  if (!isExerciseCompatible(exercise, workoutEnvironment, availableEquipment)) {
    return {
      valid: false,
      reason: `Exercise "${exercise.name}" requires ${exercise.equipmentRequired}, which is incompatible with environment "${workoutEnvironment}".`,
    };
  }

  // Limitation safety validation
  if (!isExerciseLimitationSafe(exercise, limitations)) {
    return {
      valid: false,
      reason: `Exercise "${exercise.name}" violates user physical limitation constraints.`,
    };
  }

  return { valid: true };
}

/**
 * FINAL PLAN VALIDATION LAYER (Phase C8)
 *
 * Inspects every day and exercise in a generated plan.
 * If an exercise is invalid:
 * - Attempts deterministic replacement from the replacement pool.
 * - If replacement is impossible, records an error and marks the plan invalid.
 * The UI must never display a plan that fails validation.
 */
export function validateWorkoutPlan<T extends { days: WorkoutPlanDay[] }>(
  plan: T,
  workoutEnvironment?: WorkoutEnvironment | null,
  availableEquipment: string[] = [],
  limitations: string[] = [],
  replacementPool: Exercise[] = []
): PlanValidationResult {
  const errors: string[] = [];
  let invalidCount = 0;

  // Deep clone days to avoid in-place mutation of caller state
  const validatedDays: WorkoutPlanDay[] = plan.days.map(day => {
    const validatedExercises: WorkoutPlanExercise[] = [];

    for (const planEx of day.exercises) {
      const validation = validateWorkoutExercise(
        planEx.exercise,
        workoutEnvironment,
        availableEquipment,
        limitations
      );

      if (validation.valid) {
        validatedExercises.push(planEx);
      } else {
        invalidCount++;
        // Attempt deterministic replacement from replacement pool
        const targetMuscle = planEx.exercise?.primaryMuscle;
        let replacementFound = false;

        if (targetMuscle && replacementPool.length > 0) {
          const compatibleCandidates = replacementPool.filter(candidate => {
            if (candidate.primaryMuscle.toLowerCase() !== targetMuscle.toLowerCase()) return false;
            return validateWorkoutExercise(candidate, workoutEnvironment, availableEquipment, limitations).valid;
          });

          if (compatibleCandidates.length > 0) {
            const replacement = compatibleCandidates[0];
            validatedExercises.push({
              ...planEx,
              exerciseId: replacement.id,
              exercise: replacement,
            });
            replacementFound = true;
          }
        }

        if (!replacementFound) {
          errors.push(
            `Day ${day.dayNumber} (${day.name}): ${validation.reason || 'Incompatible exercise'} and no compatible replacement exists.`
          );
        }
      }
    }

    return {
      ...day,
      exercises: validatedExercises,
    };
  });

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    invalidExerciseCount: invalidCount,
    validatedPlan: isValid ? { ...plan, days: validatedDays } : undefined,
  };
}
