import { describe, it, expect } from 'vitest';
import { generateWorkoutPlan } from '@/domain/workout-generator';
import { Exercise } from '@/types/workout.types';

const mockExercises: Exercise[] = [
  { id: '1', name: 'Barbell Bench Press', primaryMuscle: 'Chest', secondaryMuscles: ['Triceps'], equipmentRequired: 'Barbell', difficulty: 'intermediate', movementPattern: 'Push', instructions: [], isSystem: true },
  { id: '2', name: 'Incline Dumbbell Press', primaryMuscle: 'Chest', secondaryMuscles: ['Triceps'], equipmentRequired: 'Dumbbells', difficulty: 'intermediate', movementPattern: 'Push', instructions: [], isSystem: true },
  { id: '3', name: 'Barbell Row', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'], equipmentRequired: 'Barbell', difficulty: 'intermediate', movementPattern: 'Pull', instructions: [], isSystem: true },
  { id: '4', name: 'Barbell Squat', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes'], equipmentRequired: 'Barbell', difficulty: 'intermediate', movementPattern: 'Squat', instructions: [], isSystem: true },
  { id: '5', name: 'Dumbbell Overhead Press', primaryMuscle: 'Shoulders', secondaryMuscles: ['Triceps'], equipmentRequired: 'Dumbbells', difficulty: 'beginner', movementPattern: 'Push', instructions: [], isSystem: true },
  { id: '6', name: 'Plank', primaryMuscle: 'Core', secondaryMuscles: [], equipmentRequired: 'Bodyweight', difficulty: 'beginner', movementPattern: 'Plank', instructions: [], isSystem: true },
  { id: '7', name: 'Dumbbell Bicep Curl', primaryMuscle: 'Biceps', secondaryMuscles: [], equipmentRequired: 'Dumbbells', difficulty: 'beginner', movementPattern: 'Curl', instructions: [], isSystem: true },
  { id: '8', name: 'Tricep Extension', primaryMuscle: 'Triceps', secondaryMuscles: [], equipmentRequired: 'Dumbbells', difficulty: 'beginner', movementPattern: 'Extension', instructions: [], isSystem: true },
  { id: '9', name: 'Barbell Back Squat', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes'], equipmentRequired: 'Barbell', difficulty: 'intermediate', movementPattern: 'Squat', instructions: [], isSystem: true },
  { id: '10', name: 'Goblet Squat', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes'], equipmentRequired: 'Dumbbells', difficulty: 'beginner', movementPattern: 'Squat', instructions: [], isSystem: true },
  { id: '11', name: 'Conventional Deadlift', primaryMuscle: 'Back', secondaryMuscles: ['Hamstrings'], equipmentRequired: 'Barbell', difficulty: 'advanced', movementPattern: 'Hinge', instructions: [], isSystem: true },
  { id: '12', name: 'Seated Cable Row', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'], equipmentRequired: 'Cable', difficulty: 'beginner', movementPattern: 'Pull', instructions: [], isSystem: true },
];

describe('Workout Generator Engine', () => {
  it('should generate a 3-day Full Body split for beginner users or <= 3 days/week', () => {
    const plan = generateWorkoutPlan({
      daysPerWeek: 3,
      experienceLevel: 'beginner',
      equipment: ['Barbell', 'Dumbbells', 'Bodyweight'],
      goal: 'muscle_gain',
      availableExercises: mockExercises,
    });

    expect(plan.splitType).toBe('Full Body');
    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.days[0].exercises.length).toBeGreaterThanOrEqual(3);
  });

  it('should generate an Upper / Lower split for 4 days/week', () => {
    const plan = generateWorkoutPlan({
      daysPerWeek: 4,
      experienceLevel: 'intermediate',
      equipment: ['Barbell', 'Dumbbells'],
      goal: 'strength',
      availableExercises: mockExercises,
    });

    expect(plan.splitType).toBe('Upper / Lower');
    expect(plan.days.length).toBe(2);
  });

  it('should generate a Push / Pull / Legs split for 5-6 days/week intermediate/advanced', () => {
    const plan = generateWorkoutPlan({
      daysPerWeek: 5,
      experienceLevel: 'intermediate',
      equipment: ['Barbell', 'Dumbbells'],
      goal: 'muscle_gain',
      availableExercises: mockExercises,
    });

    expect(plan.splitType).toBe('Push / Pull / Legs');
    expect(plan.days.length).toBe(3);
    expect(plan.days[0].name).toContain('Push');
    expect(plan.days[1].name).toContain('Pull');
    expect(plan.days[2].name).toContain('Legs');
  });

  it('should respect equipment constraints and not assign unavailable barbell exercises if only dumbbells available', () => {
    const plan = generateWorkoutPlan({
      daysPerWeek: 3,
      experienceLevel: 'beginner',
      equipment: ['Dumbbells', 'Bodyweight'],
      goal: 'fat_loss',
      availableExercises: mockExercises,
    });

    const chestEx = plan.days[0].exercises.find(e => e.exercise?.primaryMuscle === 'Chest');
    expect(chestEx?.exercise?.equipmentRequired).toBe('Dumbbells');
    expect(chestEx?.exercise?.name).toBe('Incline Dumbbell Press');
  });

  it('should conservatively substitute exercises when user specifies movement limitations', () => {
    const planWithLimitation = generateWorkoutPlan({
      daysPerWeek: 3,
      experienceLevel: 'intermediate',
      equipment: ['Barbell', 'Dumbbells', 'Cable', 'Bodyweight'],
      goal: 'muscle_gain',
      availableExercises: mockExercises,
      limitations: ['Lower Back'],
    });

    // For Legs day in Full Body, Barbell Back Squat is replaced with Goblet Squat
    const legEx = planWithLimitation.days[0].exercises.find(e => e.exercise?.primaryMuscle === 'Legs');
    expect(legEx?.exercise?.name).toBe('Goblet Squat');
  });
});
