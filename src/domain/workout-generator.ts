/**
 * Algorithmic Workout Plan Generator (Phase C8)
 * Generates structured, exercise-compatible training splits based on biometrics,
 * frequency, and authoritative workout environment & equipment constraints.
 */

import { Exercise, WorkoutPlanDay, WorkoutPlanExercise } from '@/types/workout.types';
import { ExperienceLevel, FitnessGoal, WorkoutEnvironment } from '@/types/user.types';
import { isExerciseCompatible, validateWorkoutPlan } from './exercise-compatibility';
import { logger } from '@/lib/logger';

export interface GenerationInputs {
  daysPerWeek: number;
  experienceLevel: ExperienceLevel;
  equipment: string[];
  goal: FitnessGoal;
  availableExercises: Exercise[];
  limitations?: string[];
  workoutEnvironment?: WorkoutEnvironment | null;
}

export interface GeneratedPlan {
  name: string;
  splitType: string;
  description: string;
  days: WorkoutPlanDay[];
  isValid?: boolean;
  validationStatus?: 'passed' | 'failed';
  validationErrors?: string[];
}

/**
 * Non-medical disclaimer regarding conservative movement modifications.
 */
export const LIMITATIONS_DISCLAIMER =
  'FitBoost movement recommendations are general biomechanical exercise modifications based on joint stress distribution, NOT medical diagnosis, treatment, or rehabilitation. If experiencing pain, consult a physician or licensed physiotherapist.';

/**
 * Conservative movement preference suggestions.
 * Replaces high-compression or high-shear movements with joint-sparing alternative candidates.
 * Non-diagnostic biomechanical preferences.
 */
const CONSERVATIVE_SUBSTITUTIONS: Record<string, Record<string, string>> = {
  'lower back': {
    'Conventional Deadlift': 'Romanian Deadlift',
    'Barbell Bent-Over Row': 'Seated Cable Row',
    'Barbell Back Squat': 'Goblet Squat',
  },
  'knees': {
    'Barbell Back Squat': 'Leg Press',
    'Walking Lunge': 'Goblet Squat',
    'Bulgarian Split Squat': 'Goblet Squat',
  },
  'shoulders': {
    'Overhead Barbell Press': 'Dumbbell Lateral Raise',
    'Incline Dumbbell Press': 'Cable Chest Fly',
  },
  'wrists': {
    'Barbell Bench Press': 'Dumbbell Bench Press',
    'Barbell Bicep Curl': 'Hammer Curl',
  },
  'elbows': {
    'Skull Crushers': 'Tricep Cable Pushdown',
    'Barbell Bicep Curl': 'Hammer Curl',
  },
  'hips': {
    'Barbell Back Squat': 'Goblet Squat',
    'Bulgarian Split Squat': 'Goblet Squat',
  },
  'ankles': {
    'Barbell Back Squat': 'Goblet Squat',
    'Bulgarian Split Squat': 'Goblet Squat',
  },
};

/**
 * Filters catalog exercises by user's workout environment, equipment, muscle group,
 * and conservative movement preferences.
 *
 * CRITICAL RULE:
 * NEVER falls back to an incompatible exercise or arbitrary index-0 exercise.
 * If no compatible exercise matches, returns undefined so the caller can handle it safely.
 */
export function findExercise(
  exercises: Exercise[],
  primaryMuscle: string,
  workoutEnvironment?: WorkoutEnvironment | null,
  allowedEquipment: string[] = [],
  limitations: string[] = []
): Exercise | undefined {
  // 1. Strict compatibility filter: only keep exercises compatible with user's environment & gear
  const compatible = exercises.filter(ex =>
    isExerciseCompatible(ex, workoutEnvironment, allowedEquipment)
  );

  if (compatible.length === 0) return undefined;

  // 2. Muscle group match among compatible candidates
  const matching = compatible.filter(
    ex => ex.primaryMuscle.toLowerCase() === primaryMuscle.toLowerCase()
  );

  if (matching.length === 0) {
    // Return undefined: do NOT inject an incompatible exercise!
    return undefined;
  }

  // 3. Check if any limitation suggests a conservative alternative candidate
  const normalizedLimitations = limitations.map(l => l.toLowerCase()).filter(l => l !== 'none');
  for (const lim of normalizedLimitations) {
    const subMap = CONSERVATIVE_SUBSTITUTIONS[lim];
    if (subMap) {
      for (const ex of matching) {
        const altName = subMap[ex.name];
        if (altName) {
          const alternativeCandidate =
            matching.find(c => c.name.toLowerCase() === altName.toLowerCase()) ||
            compatible.find(c => c.name.toLowerCase() === altName.toLowerCase());
          if (alternativeCandidate) {
            return alternativeCandidate;
          }
        }
      }
    }
  }

  return matching[0];
}

export function generateWorkoutPlan(inputs: GenerationInputs): GeneratedPlan {
  const {
    daysPerWeek,
    experienceLevel,
    equipment,
    goal,
    availableExercises,
    limitations = [],
    workoutEnvironment,
  } = inputs;

  let splitType = 'Full Body';
  let planName = 'Foundational Full Body Routine';
  let description = '3-day full body split designed for maximum recovery and functional strength.';

  if (daysPerWeek >= 5 && experienceLevel !== 'beginner') {
    splitType = 'Push / Pull / Legs';
    planName = 'Hypertrophy PPL Routine';
    description = 'High-frequency 5-day push-pull-legs split for progressive overload and muscle building.';
  } else if (daysPerWeek >= 4) {
    splitType = 'Upper / Lower';
    planName = 'Athletic Upper / Lower Split';
    description = 'Balanced 4-day split distributing volume between upper body pressing/pulling and lower body power.';
  }

  const generatedDays: WorkoutPlanDay[] = [];

  const createDayExercise = (
    exercise: Exercise,
    orderIndex: number,
    sets: number,
    repsMin: number,
    repsMax: number,
    rest: number,
    isCore: boolean
  ): WorkoutPlanExercise => ({
    id: `temp-pe-${Math.random()}`,
    planDayId: '',
    exerciseId: exercise.id,
    exercise,
    orderIndex,
    targetSets: sets,
    targetRepsMin: repsMin,
    targetRepsMax: repsMax,
    restSeconds: rest,
    isCore,
  });

  const getCandidate = (primaryMuscle: string): Exercise | undefined => {
    return findExercise(availableExercises, primaryMuscle, workoutEnvironment, equipment, limitations);
  };

  if (splitType === 'Push / Pull / Legs') {
    // Day 1: Push (Chest, Shoulders, Triceps)
    const chestEx = getCandidate('Chest');
    const shoulderEx = getCandidate('Shoulders');
    const tricepEx = getCandidate('Triceps');

    const pushCandidates = [
      chestEx ? { ex: chestEx, sets: 4, rMin: 8, rMax: 10, rest: 120, core: true } : null,
      shoulderEx ? { ex: shoulderEx, sets: 3, rMin: 10, rMax: 12, rest: 90, core: true } : null,
      tricepEx ? { ex: tricepEx, sets: 3, rMin: 10, rMax: 12, rest: 60, core: false } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (pushCandidates.length > 0) {
      generatedDays.push({
        id: 'day-1',
        planId: '',
        dayNumber: 1,
        name: 'Push (Chest, Shoulders & Triceps)',
        targetMuscleGroups: ['Chest', 'Shoulders', 'Triceps'],
        scheduledDaysOfWeek: [1, 4], // Mon, Thu
        exercises: pushCandidates.map((item, idx) =>
          createDayExercise(item.ex, idx + 1, item.sets, item.rMin, item.rMax, item.rest, item.core)
        ),
      });
    }

    // Day 2: Pull (Back, Biceps)
    const backEx = getCandidate('Back');
    const bicepEx = getCandidate('Biceps');
    const rearDeltEx = getCandidate('Shoulders');

    const pullCandidates = [
      backEx ? { ex: backEx, sets: 4, rMin: 8, rMax: 10, rest: 120, core: true } : null,
      bicepEx ? { ex: bicepEx, sets: 3, rMin: 10, rMax: 12, rest: 60, core: false } : null,
      rearDeltEx && rearDeltEx.id !== shoulderEx?.id
        ? { ex: rearDeltEx, sets: 3, rMin: 12, rMax: 15, rest: 60, core: false }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (pullCandidates.length > 0) {
      generatedDays.push({
        id: 'day-2',
        planId: '',
        dayNumber: 2,
        name: 'Pull (Back, Biceps & Rear Delts)',
        targetMuscleGroups: ['Back', 'Biceps'],
        scheduledDaysOfWeek: [2, 5], // Tue, Fri
        exercises: pullCandidates.map((item, idx) =>
          createDayExercise(item.ex, idx + 1, item.sets, item.rMin, item.rMax, item.rest, item.core)
        ),
      });
    }

    // Day 3: Legs & Core
    const legEx = getCandidate('Legs');
    const coreEx = getCandidate('Core');

    const legCandidates = [
      legEx ? { ex: legEx, sets: 4, rMin: 8, rMax: 12, rest: 120, core: true } : null,
      coreEx ? { ex: coreEx, sets: 2, rMin: 15, rMax: 20, rest: 60, core: false } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (legCandidates.length > 0) {
      generatedDays.push({
        id: 'day-3',
        planId: '',
        dayNumber: 3,
        name: 'Legs & Core (Quads, Hamstrings & Abs)',
        targetMuscleGroups: ['Legs', 'Core'],
        scheduledDaysOfWeek: [3, 6], // Wed, Sat
        exercises: legCandidates.map((item, idx) =>
          createDayExercise(item.ex, idx + 1, item.sets, item.rMin, item.rMax, item.rest, item.core)
        ),
      });
    }
  } else if (splitType === 'Upper / Lower') {
    // Upper Day
    const chestEx = getCandidate('Chest');
    const backEx = getCandidate('Back');
    const shoulderEx = getCandidate('Shoulders');

    const upperCandidates = [
      chestEx ? { ex: chestEx, sets: 4, rMin: 8, rMax: 10, rest: 120, core: true } : null,
      backEx ? { ex: backEx, sets: 4, rMin: 8, rMax: 10, rest: 120, core: true } : null,
      shoulderEx ? { ex: shoulderEx, sets: 3, rMin: 10, rMax: 12, rest: 90, core: false } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (upperCandidates.length > 0) {
      generatedDays.push({
        id: 'day-1',
        planId: '',
        dayNumber: 1,
        name: 'Upper Body Power',
        targetMuscleGroups: ['Chest', 'Back', 'Shoulders'],
        scheduledDaysOfWeek: [1, 4], // Mon, Thu
        exercises: upperCandidates.map((item, idx) =>
          createDayExercise(item.ex, idx + 1, item.sets, item.rMin, item.rMax, item.rest, item.core)
        ),
      });
    }

    // Lower Day
    const legEx = getCandidate('Legs');
    const coreEx = getCandidate('Core');

    const lowerCandidates = [
      legEx ? { ex: legEx, sets: 4, rMin: 8, rMax: 12, rest: 120, core: true } : null,
      coreEx ? { ex: coreEx, sets: 2, rMin: 12, rMax: 15, rest: 60, core: false } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (lowerCandidates.length > 0) {
      generatedDays.push({
        id: 'day-2',
        planId: '',
        dayNumber: 2,
        name: 'Lower Body & Core',
        targetMuscleGroups: ['Legs', 'Core'],
        scheduledDaysOfWeek: [2, 5], // Tue, Fri
        exercises: lowerCandidates.map((item, idx) =>
          createDayExercise(item.ex, idx + 1, item.sets, item.rMin, item.rMax, item.rest, item.core)
        ),
      });
    }
  } else {
    // Full Body Day
    const chestEx = getCandidate('Chest');
    const backEx = getCandidate('Back');
    const legEx = getCandidate('Legs');
    const coreEx = getCandidate('Core');

    const fullBodyCandidates = [
      legEx ? { ex: legEx, sets: 3, rMin: 8, rMax: 10, rest: 120, core: true } : null,
      chestEx ? { ex: chestEx, sets: 3, rMin: 8, rMax: 10, rest: 90, core: true } : null,
      backEx ? { ex: backEx, sets: 3, rMin: 8, rMax: 10, rest: 90, core: true } : null,
      coreEx ? { ex: coreEx, sets: 2, rMin: 12, rMax: 15, rest: 60, core: false } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (fullBodyCandidates.length > 0) {
      generatedDays.push({
        id: 'day-1',
        planId: '',
        dayNumber: 1,
        name: 'Full Body Foundational',
        targetMuscleGroups: ['Chest', 'Back', 'Legs', 'Core'],
        scheduledDaysOfWeek: [1, 3, 5], // Mon, Wed, Fri
        exercises: fullBodyCandidates.map((item, idx) =>
          createDayExercise(item.ex, idx + 1, item.sets, item.rMin, item.rMax, item.rest, item.core)
        ),
      });
    }
  }

  if (generatedDays.length === 0) {
    logger.warn('WorkoutGenerator: Insufficient exercise coverage for requested environment', {
      workoutEnvironment,
      equipment,
    });
  }

  const preliminaryPlan: GeneratedPlan = {
    name: planName,
    splitType,
    description: `${description} Optimized for ${goal.replace('_', ' ')}.`,
    days: generatedDays,
  };

  // FINAL PLAN VALIDATION LAYER (Phase C8 Mandatory Correctness Gate)
  const validation = validateWorkoutPlan(
    preliminaryPlan,
    workoutEnvironment,
    equipment,
    limitations,
    availableExercises
  );

  if (!validation.isValid) {
    logger.warn('WorkoutGenerator: Generated plan failed final validation', {
      errors: validation.errors,
      workoutEnvironment,
      equipment,
    });
    return {
      ...preliminaryPlan,
      isValid: false,
      validationStatus: 'failed',
      validationErrors: validation.errors,
      days: validation.validatedPlan?.days || [],
    };
  }

  return {
    ...validation.validatedPlan,
    isValid: true,
    validationStatus: 'passed',
    validationErrors: [],
  };
}
