import { describe, it, expect } from 'vitest';
import { findExerciseAlternatives } from '@/domain/exercise-alternatives';
import { CURATED_EXERCISE_CATALOG } from '@/services/exercise-catalog.data';

describe('Exercise Alternatives Domain Engine', () => {
  it('returns valid substitutes for Barbell Bench Press', () => {
    const benchPress = CURATED_EXERCISE_CATALOG.find(e => e.name === 'Barbell Bench Press')!;
    expect(benchPress).toBeDefined();

    const alts = findExerciseAlternatives(benchPress, CURATED_EXERCISE_CATALOG, 4);

    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(4);
    // Must never include the exercise itself
    expect(alts.some(a => a.id === benchPress.id)).toBe(false);

    // Substitutes should be chest movements
    expect(alts.some(a => a.primaryMuscle === 'Chest')).toBe(true);
  });

  it('returns valid substitutes for Barbell Back Squat', () => {
    const squat = CURATED_EXERCISE_CATALOG.find(e => e.name === 'Barbell Back Squat')!;
    expect(squat).toBeDefined();

    const alts = findExerciseAlternatives(squat, CURATED_EXERCISE_CATALOG, 4);

    expect(alts.length).toBeGreaterThan(0);
    expect(alts.some(a => a.id === squat.id)).toBe(false);
    expect(alts.every(a => a.name.includes('Squat') || a.movementPattern.includes('Squat') || a.movementPattern.includes('Lunge'))).toBe(true);
    expect(alts.some(a => a.name.includes('Deadlift'))).toBe(false);
  });

  it('falls back to same muscle group if exact name is not in direct map', () => {
    const customExercise = {
      id: 'custom-chest-press',
      name: 'Custom Machine Chest Press',
      primaryMuscle: 'Chest',
      secondaryMuscles: ['Triceps'],
      equipmentRequired: 'Machines',
      difficulty: 'beginner' as const,
      movementPattern: 'Horizontal Push',
      instructions: ['Push handles forward'],
      isSystem: false,
    };

    const alts = findExerciseAlternatives(customExercise, CURATED_EXERCISE_CATALOG, 3);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every(a => a.primaryMuscle === 'Chest')).toBe(true);
  });

  it('strictly substitutes deadlift with biomechanical hinge movements, never horizontal rows', () => {
    const deadlift = CURATED_EXERCISE_CATALOG.find(e => e.name === 'Conventional Deadlift');
    if (deadlift) {
      const alts = findExerciseAlternatives(deadlift, CURATED_EXERCISE_CATALOG, 4);
      expect(alts.length).toBeGreaterThan(0);
      expect(alts.some(a => a.name.toLowerCase().includes('row'))).toBe(false);
      expect(alts.every(a => a.movementPattern === 'Hip Hinge' || a.name.includes('Deadlift'))).toBe(true);
    }
  });
});
