import { describe, it, expect } from 'vitest';
import {
  compressWorkoutForDuration,
  normalizeTimeMode,
} from '@/domain/quick-workout';
import { WorkoutPlanDay } from '@/types/workout.types';

describe('Phase C9: Workout Time Mode Suite', () => {
  const fullPlanDay: WorkoutPlanDay = {
    id: 'day-ppl-push',
    planId: 'plan-ppl',
    dayNumber: 1,
    name: 'Push Hypertrophy',
    targetMuscleGroups: ['Chest', 'Shoulders', 'Triceps'],
    exercises: [
      {
        id: 'wpe-1',
        planDayId: 'day-ppl-push',
        exerciseId: 'ex-bench-press',
        orderIndex: 1,
        targetSets: 4,
        targetRepsMin: 8,
        targetRepsMax: 10,
        restSeconds: 120,
        isCore: true,
        exercise: {
          id: 'ex-bench-press',
          name: 'Barbell Bench Press',
          primaryMuscle: 'Chest',
          secondaryMuscles: ['Triceps', 'Shoulders'],
          equipmentRequired: 'Barbell',
          difficulty: 'intermediate',
          movementPattern: 'Horizontal Push',
          instructions: [],
          isSystem: true,
        },
      },
      {
        id: 'wpe-2',
        planDayId: 'day-ppl-push',
        exerciseId: 'ex-overhead-press',
        orderIndex: 2,
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 12,
        restSeconds: 90,
        isCore: true,
        exercise: {
          id: 'ex-overhead-press',
          name: 'Overhead Barbell Press',
          primaryMuscle: 'Shoulders',
          secondaryMuscles: ['Triceps'],
          equipmentRequired: 'Barbell',
          difficulty: 'intermediate',
          movementPattern: 'Vertical Push',
          instructions: [],
          isSystem: true,
        },
      },
      {
        id: 'wpe-3',
        planDayId: 'day-ppl-push',
        exerciseId: 'ex-incline-db',
        orderIndex: 3,
        targetSets: 3,
        targetRepsMin: 10,
        targetRepsMax: 12,
        restSeconds: 90,
        isCore: false,
        exercise: {
          id: 'ex-incline-db',
          name: 'Incline Dumbbell Press',
          primaryMuscle: 'Chest',
          secondaryMuscles: ['Shoulders'],
          equipmentRequired: 'Dumbbells',
          difficulty: 'intermediate',
          movementPattern: 'Incline Push',
          instructions: [],
          isSystem: true,
        },
      },
      {
        id: 'wpe-4',
        planDayId: 'day-ppl-push',
        exerciseId: 'ex-cable-fly',
        orderIndex: 4,
        targetSets: 3,
        targetRepsMin: 12,
        targetRepsMax: 15,
        restSeconds: 60,
        isCore: false,
        exercise: {
          id: 'ex-cable-fly',
          name: 'Cable Chest Fly',
          primaryMuscle: 'Chest',
          secondaryMuscles: [],
          equipmentRequired: 'Cable',
          difficulty: 'intermediate',
          movementPattern: 'Horizontal Push',
          instructions: [],
          isSystem: true,
        },
      },
      {
        id: 'wpe-5',
        planDayId: 'day-ppl-push',
        exerciseId: 'ex-tricep-pushdown',
        orderIndex: 5,
        targetSets: 3,
        targetRepsMin: 12,
        targetRepsMax: 15,
        restSeconds: 60,
        isCore: false,
        exercise: {
          id: 'ex-tricep-pushdown',
          name: 'Tricep Rope Pushdown',
          primaryMuscle: 'Triceps',
          secondaryMuscles: [],
          equipmentRequired: 'Cable',
          difficulty: 'beginner',
          movementPattern: 'Arm Extension',
          instructions: [],
          isSystem: true,
        },
      },
    ],
  };

  it('normalizes duration safely and defaults unknown/invalid inputs to 60m (Full Plan)', () => {
    expect(normalizeTimeMode(undefined)).toBe(60);
    expect(normalizeTimeMode(null)).toBe(60);
    expect(normalizeTimeMode(-5)).toBe(60);
    expect(normalizeTimeMode(NaN)).toBe(60);
    expect(normalizeTimeMode('invalid')).toBe(60);

    expect(normalizeTimeMode(20)).toBe(20);
    expect(normalizeTimeMode('20')).toBe(20);
    expect(normalizeTimeMode(25)).toBe(20);

    expect(normalizeTimeMode(30)).toBe(30);
    expect(normalizeTimeMode(35)).toBe(30);

    expect(normalizeTimeMode(45)).toBe(45);
    expect(normalizeTimeMode(50)).toBe(45);

    expect(normalizeTimeMode(60)).toBe(60);
    expect(normalizeTimeMode(90)).toBe(60);
  });

  it('compresses to 20-minute mode: budgets 2 core compound exercises capped at 2 sets each', () => {
    const result = compressWorkoutForDuration(fullPlanDay, 20);

    expect(result.success).toBe(true);
    expect(result.targetDurationMinutes).toBe(20);
    expect(result.totalExercises).toBe(2);
    expect(result.planDay.exercises.length).toBe(2);

    // Both should be the core lifts
    expect(result.planDay.exercises[0].exerciseId).toBe('ex-bench-press');
    expect(result.planDay.exercises[0].isCore).toBe(true);
    expect(result.planDay.exercises[0].targetSets).toBe(2);

    expect(result.planDay.exercises[1].exerciseId).toBe('ex-overhead-press');
    expect(result.planDay.exercises[1].isCore).toBe(true);
    expect(result.planDay.exercises[1].targetSets).toBe(2);

    expect(result.totalSets).toBe(4);
    expect(result.planDay.name).toContain('20m Express');
  });

  it('compresses to 30-minute mode: budgets 3 exercises with adjusted sets', () => {
    const result = compressWorkoutForDuration(fullPlanDay, 30);

    expect(result.success).toBe(true);
    expect(result.targetDurationMinutes).toBe(30);
    expect(result.totalExercises).toBe(3);
    expect(result.planDay.exercises.length).toBe(3);

    // First two core lifts (3 sets each), third lift (2 sets)
    expect(result.planDay.exercises[0].exerciseId).toBe('ex-bench-press');
    expect(result.planDay.exercises[0].targetSets).toBe(3);

    expect(result.planDay.exercises[1].exerciseId).toBe('ex-overhead-press');
    expect(result.planDay.exercises[1].targetSets).toBe(3);

    expect(result.planDay.exercises[2].exerciseId).toBe('ex-incline-db');
    expect(result.planDay.exercises[2].targetSets).toBe(2);

    expect(result.totalSets).toBe(8);
  });

  it('compresses to 45-minute mode: budgets 4 exercises with 3 sets each', () => {
    const result = compressWorkoutForDuration(fullPlanDay, 45);

    expect(result.success).toBe(true);
    expect(result.targetDurationMinutes).toBe(45);
    expect(result.totalExercises).toBe(4);
    expect(result.planDay.exercises.length).toBe(4);

    expect(result.planDay.exercises[0].targetSets).toBe(3);
    expect(result.planDay.exercises[1].targetSets).toBe(3);
    expect(result.planDay.exercises[2].targetSets).toBe(3);
    expect(result.planDay.exercises[3].targetSets).toBe(3);

    expect(result.totalSets).toBe(12);
  });

  it('preserves full plan when 60+ minutes is selected', () => {
    const result = compressWorkoutForDuration(fullPlanDay, 60);

    expect(result.success).toBe(true);
    expect(result.targetDurationMinutes).toBe(60);
    expect(result.totalExercises).toBe(5);
    expect(result.planDay.exercises.length).toBe(5);
    // Preserves original target sets
    expect(result.planDay.exercises[0].targetSets).toBe(4);
    expect(result.planDay.name).toBe('Push Hypertrophy');
  });

  it('is deterministic: produces identical compressed workout across multiple runs', () => {
    const run1 = compressWorkoutForDuration(fullPlanDay, 30);
    const run2 = compressWorkoutForDuration(fullPlanDay, 30);

    expect(run1).toEqual(run2);
  });

  it('enforces C8 home_bodyweight environment: filters out non-bodyweight equipment', () => {
    const mixedPlanDay: WorkoutPlanDay = {
      ...fullPlanDay,
      exercises: [
        ...fullPlanDay.exercises,
        {
          id: 'wpe-bw-1',
          planDayId: 'day-ppl-push',
          exerciseId: 'ex-pushup',
          orderIndex: 6,
          targetSets: 3,
          targetRepsMin: 12,
          targetRepsMax: 15,
          restSeconds: 60,
          isCore: true,
          exercise: {
            id: 'ex-pushup',
            name: 'Push-Up',
            primaryMuscle: 'Chest',
            secondaryMuscles: ['Triceps'],
            equipmentRequired: 'Bodyweight',
            difficulty: 'beginner',
            movementPattern: 'Horizontal Push',
            instructions: [],
            isSystem: true,
          },
        },
      ],
    };

    const result = compressWorkoutForDuration(mixedPlanDay, 30, {
      workoutEnvironment: 'home_bodyweight',
      availableEquipment: ['Bodyweight'],
    });

    expect(result.success).toBe(true);
    expect(result.planDay.exercises.length).toBe(1);
    expect(result.planDay.exercises[0].exerciseId).toBe('ex-pushup');
    expect(result.planDay.exercises[0].exercise?.equipmentRequired.toLowerCase()).toBe('bodyweight');
  });

  it('enforces user limitations: excludes contraindicated exercises', () => {
    // Shoulder limitation blacklists Overhead Barbell Press
    const result = compressWorkoutForDuration(fullPlanDay, 30, {
      limitations: ['shoulders'],
    });

    expect(result.success).toBe(true);
    const hasOverheadPress = result.planDay.exercises.some(
      e => e.exercise?.name.toLowerCase() === 'overhead barbell press'
    );
    expect(hasOverheadPress).toBe(false);
  });

  it('CORRECTION 1: returns safe failure state with ZERO exercises when all are incompatible (NO ARBITRARY FALLBACK)', () => {
    // All exercises in fullPlanDay require Barbell, Dumbbells, or Cable.
    // If user is in home_bodyweight, zero exercises are compatible.
    const result = compressWorkoutForDuration(fullPlanDay, 30, {
      workoutEnvironment: 'home_bodyweight',
      availableEquipment: ['Bodyweight'],
    });

    // Must NOT arbitrarily pick index 0 or fall back to an incompatible exercise
    expect(result.success).toBe(false);
    expect(result.planDay.exercises.length).toBe(0);
    expect(result.totalExercises).toBe(0);
    expect(result.error).toContain('No compatible exercises available');
  });
});
