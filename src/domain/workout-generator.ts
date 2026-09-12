/**
 * Algorithmic Workout Plan Generator
 * Generates structured, exercise-compatible training splits based on biometrics, frequency, and available equipment.
 */

import { Exercise, WorkoutPlanDay, WorkoutPlanExercise } from '@/types/workout.types';
import { ExperienceLevel, FitnessGoal } from '@/types/user.types';

export interface GenerationInputs {
  daysPerWeek: number;
  experienceLevel: ExperienceLevel;
  equipment: string[];
  goal: FitnessGoal;
  availableExercises: Exercise[];
  limitations?: string[];
}

export interface GeneratedPlan {
  name: string;
  splitType: string;
  description: string;
  days: WorkoutPlanDay[];
}

/**
 * Non-medical disclaimer regarding conservative movement modifications.
 */
export const LIMITATIONS_DISCLAIMER =
  'FitSphere movement recommendations are general biomechanical exercise modifications based on joint stress distribution, NOT medical diagnosis, treatment, or rehabilitation. If experiencing pain, consult a physician or licensed physiotherapist.';

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
 * Filters catalog exercises by user's equipment, muscle group, and conservative movement preferences
 */
function findExercise(
  exercises: Exercise[],
  primaryMuscle: string,
  allowedEquipment: string[],
  limitations: string[] = []
): Exercise | undefined {
  // Normalize equipment names
  const equipSet = new Set(allowedEquipment.map(e => e.toLowerCase()));
  equipSet.add('bodyweight'); // Bodyweight is always available

  const matching = exercises.filter(ex => {
    const muscleMatch = ex.primaryMuscle.toLowerCase() === primaryMuscle.toLowerCase();
    const equipMatch = equipSet.has(ex.equipmentRequired.toLowerCase());
    return muscleMatch && equipMatch;
  });

  if (matching.length === 0) return undefined;

  // Check if any limitation suggests a conservative alternative candidate
  const normalizedLimitations = limitations.map(l => l.toLowerCase()).filter(l => l !== 'none');
  for (const lim of normalizedLimitations) {
    const subMap = CONSERVATIVE_SUBSTITUTIONS[lim];
    if (subMap) {
      for (const ex of matching) {
        const altName = subMap[ex.name];
        if (altName) {
          const alternativeCandidate =
            matching.find(c => c.name.toLowerCase() === altName.toLowerCase()) ||
            exercises.find(c => c.name.toLowerCase() === altName.toLowerCase() && equipSet.has(c.equipmentRequired.toLowerCase()));
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
  const { daysPerWeek, experienceLevel, equipment, goal, availableExercises, limitations = [] } = inputs;

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

  if (splitType === 'Push / Pull / Legs') {
    // Day 1: Push
    const chestEx = findExercise(availableExercises, 'Chest', equipment, limitations) || availableExercises[0];
    const shoulderEx = findExercise(availableExercises, 'Shoulders', equipment, limitations) || availableExercises[1];
    const tricepEx = findExercise(availableExercises, 'Triceps', equipment, limitations) || availableExercises[2];

    generatedDays.push({
      id: 'day-1',
      planId: '',
      dayNumber: 1,
      name: 'Push (Chest, Shoulders & Triceps)',
      targetMuscleGroups: ['Chest', 'Shoulders', 'Triceps'],
      scheduledDaysOfWeek: [1, 4], // Mon, Thu
      exercises: [
        createDayExercise(chestEx, 1, 4, 8, 10, 120, true),
        createDayExercise(shoulderEx, 2, 3, 10, 12, 90, true),
        createDayExercise(tricepEx, 3, 3, 10, 12, 60, false),
      ],
    });

    // Day 2: Pull
    const backEx = findExercise(availableExercises, 'Back', equipment, limitations) || availableExercises[1];
    const bicepEx = findExercise(availableExercises, 'Biceps', equipment, limitations) || availableExercises[2];
    const rearDeltEx = findExercise(availableExercises, 'Shoulders', equipment, limitations) || availableExercises[0];

    generatedDays.push({
      id: 'day-2',
      planId: '',
      dayNumber: 2,
      name: 'Pull (Back, Biceps & Rear Delts)',
      targetMuscleGroups: ['Back', 'Biceps'],
      scheduledDaysOfWeek: [2, 5], // Tue, Fri
      exercises: [
        createDayExercise(backEx, 1, 4, 8, 10, 120, true),
        createDayExercise(bicepEx, 2, 3, 10, 12, 60, false),
        createDayExercise(rearDeltEx, 3, 3, 12, 15, 60, false),
      ],
    });

    // Day 3: Legs
    const legEx = findExercise(availableExercises, 'Legs', equipment, limitations) || availableExercises[0];
    const coreEx = findExercise(availableExercises, 'Core', equipment, limitations) || availableExercises[availableExercises.length - 1];

    generatedDays.push({
      id: 'day-3',
      planId: '',
      dayNumber: 3,
      name: 'Legs & Core (Quads, Hamstrings & Abs)',
      targetMuscleGroups: ['Legs', 'Core'],
      scheduledDaysOfWeek: [3, 6], // Wed, Sat
      exercises: [
        createDayExercise(legEx, 1, 4, 8, 12, 120, true),
        createDayExercise(coreEx, 2, 3, 15, 20, 60, false),
      ],
    });
  } else if (splitType === 'Upper / Lower') {
    // Upper Day
    const chestEx = findExercise(availableExercises, 'Chest', equipment, limitations) || availableExercises[0];
    const backEx = findExercise(availableExercises, 'Back', equipment, limitations) || availableExercises[1];
    const shoulderEx = findExercise(availableExercises, 'Shoulders', equipment, limitations) || availableExercises[2];

    generatedDays.push({
      id: 'day-1',
      planId: '',
      dayNumber: 1,
      name: 'Upper Body Power',
      targetMuscleGroups: ['Chest', 'Back', 'Shoulders'],
      scheduledDaysOfWeek: [1, 4], // Mon, Thu
      exercises: [
        createDayExercise(chestEx, 1, 4, 8, 10, 120, true),
        createDayExercise(backEx, 2, 4, 8, 10, 120, true),
        createDayExercise(shoulderEx, 3, 3, 10, 12, 90, false),
      ],
    });

    // Lower Day
    const legEx = findExercise(availableExercises, 'Legs', equipment, limitations) || availableExercises[0];
    const coreEx = findExercise(availableExercises, 'Core', equipment, limitations) || availableExercises[1];

    generatedDays.push({
      id: 'day-2',
      planId: '',
      dayNumber: 2,
      name: 'Lower Body & Core',
      targetMuscleGroups: ['Legs', 'Core'],
      scheduledDaysOfWeek: [2, 5], // Tue, Fri
      exercises: [
        createDayExercise(legEx, 1, 4, 8, 12, 120, true),
        createDayExercise(coreEx, 2, 3, 12, 15, 60, false),
      ],
    });
  } else {
    // Full Body Day
    const chestEx = findExercise(availableExercises, 'Chest', equipment, limitations) || availableExercises[0];
    const backEx = findExercise(availableExercises, 'Back', equipment, limitations) || availableExercises[1];
    const legEx = findExercise(availableExercises, 'Legs', equipment, limitations) || availableExercises[2];
    const coreEx = findExercise(availableExercises, 'Core', equipment, limitations) || availableExercises[0];

    generatedDays.push({
      id: 'day-1',
      planId: '',
      dayNumber: 1,
      name: 'Full Body Foundational',
      targetMuscleGroups: ['Chest', 'Back', 'Legs', 'Core'],
      scheduledDaysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      exercises: [
        createDayExercise(legEx, 1, 3, 8, 10, 120, true),
        createDayExercise(chestEx, 2, 3, 8, 10, 90, true),
        createDayExercise(backEx, 3, 3, 8, 10, 90, true),
        createDayExercise(coreEx, 4, 2, 12, 15, 60, false),
      ],
    });
  }

  return {
    name: planName,
    splitType,
    description: `${description} Optimized for ${goal.replace('_', ' ')}.`,
    days: generatedDays,
  };
}
