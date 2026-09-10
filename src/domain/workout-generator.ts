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
}

export interface GeneratedPlan {
  name: string;
  splitType: string;
  description: string;
  days: WorkoutPlanDay[];
}

/**
 * Filters catalog exercises by user's equipment and muscle group
 */
function findExercise(
  exercises: Exercise[],
  primaryMuscle: string,
  allowedEquipment: string[]
): Exercise | undefined {
  // Normalize equipment names
  const equipSet = new Set(allowedEquipment.map(e => e.toLowerCase()));
  equipSet.add('bodyweight'); // Bodyweight is always available

  return exercises.find(ex => {
    const muscleMatch = ex.primaryMuscle.toLowerCase() === primaryMuscle.toLowerCase();
    const equipMatch = equipSet.has(ex.equipmentRequired.toLowerCase());
    return muscleMatch && equipMatch;
  });
}

export function generateWorkoutPlan(inputs: GenerationInputs): GeneratedPlan {
  const { daysPerWeek, experienceLevel, equipment, goal, availableExercises } = inputs;

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
    const chestEx = findExercise(availableExercises, 'Chest', equipment) || availableExercises[0];
    const shoulderEx = findExercise(availableExercises, 'Shoulders', equipment) || availableExercises[1];
    const tricepEx = findExercise(availableExercises, 'Triceps', equipment) || availableExercises[2];

    generatedDays.push({
      id: 'day-1',
      planId: '',
      dayNumber: 1,
      name: 'Push (Chest, Shoulders & Triceps)',
      targetMuscleGroups: ['Chest', 'Shoulders', 'Triceps'],
      exercises: [
        createDayExercise(chestEx, 1, 4, 8, 10, 120, true),
        createDayExercise(shoulderEx, 2, 3, 10, 12, 90, true),
        createDayExercise(tricepEx, 3, 3, 10, 12, 60, false),
      ],
    });

    // Day 2: Pull
    const backEx = findExercise(availableExercises, 'Back', equipment) || availableExercises[1];
    const bicepEx = findExercise(availableExercises, 'Biceps', equipment) || availableExercises[2];
    const rearDeltEx = findExercise(availableExercises, 'Shoulders', equipment) || availableExercises[0];

    generatedDays.push({
      id: 'day-2',
      planId: '',
      dayNumber: 2,
      name: 'Pull (Back, Biceps & Rear Delts)',
      targetMuscleGroups: ['Back', 'Biceps'],
      exercises: [
        createDayExercise(backEx, 1, 4, 8, 10, 120, true),
        createDayExercise(bicepEx, 2, 3, 10, 12, 60, false),
        createDayExercise(rearDeltEx, 3, 3, 12, 15, 60, false),
      ],
    });

    // Day 3: Legs
    const legEx = findExercise(availableExercises, 'Legs', equipment) || availableExercises[0];
    const coreEx = findExercise(availableExercises, 'Core', equipment) || availableExercises[availableExercises.length - 1];

    generatedDays.push({
      id: 'day-3',
      planId: '',
      dayNumber: 3,
      name: 'Legs & Core (Quads, Hamstrings & Abs)',
      targetMuscleGroups: ['Legs', 'Core'],
      exercises: [
        createDayExercise(legEx, 1, 4, 8, 12, 120, true),
        createDayExercise(coreEx, 2, 3, 15, 20, 60, false),
      ],
    });
  } else if (splitType === 'Upper / Lower') {
    // Upper Day
    const chestEx = findExercise(availableExercises, 'Chest', equipment) || availableExercises[0];
    const backEx = findExercise(availableExercises, 'Back', equipment) || availableExercises[1];
    const shoulderEx = findExercise(availableExercises, 'Shoulders', equipment) || availableExercises[2];

    generatedDays.push({
      id: 'day-1',
      planId: '',
      dayNumber: 1,
      name: 'Upper Body Power',
      targetMuscleGroups: ['Chest', 'Back', 'Shoulders'],
      exercises: [
        createDayExercise(chestEx, 1, 4, 8, 10, 120, true),
        createDayExercise(backEx, 2, 4, 8, 10, 120, true),
        createDayExercise(shoulderEx, 3, 3, 10, 12, 90, false),
      ],
    });

    // Lower Day
    const legEx = findExercise(availableExercises, 'Legs', equipment) || availableExercises[0];
    const coreEx = findExercise(availableExercises, 'Core', equipment) || availableExercises[1];

    generatedDays.push({
      id: 'day-2',
      planId: '',
      dayNumber: 2,
      name: 'Lower Body & Core',
      targetMuscleGroups: ['Legs', 'Core'],
      exercises: [
        createDayExercise(legEx, 1, 4, 8, 12, 120, true),
        createDayExercise(coreEx, 2, 3, 12, 15, 60, false),
      ],
    });
  } else {
    // Full Body Day
    const chestEx = findExercise(availableExercises, 'Chest', equipment) || availableExercises[0];
    const backEx = findExercise(availableExercises, 'Back', equipment) || availableExercises[1];
    const legEx = findExercise(availableExercises, 'Legs', equipment) || availableExercises[2];
    const coreEx = findExercise(availableExercises, 'Core', equipment) || availableExercises[0];

    generatedDays.push({
      id: 'day-1',
      planId: '',
      dayNumber: 1,
      name: 'Full Body Foundational',
      targetMuscleGroups: ['Chest', 'Back', 'Legs', 'Core'],
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
