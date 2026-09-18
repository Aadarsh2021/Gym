import { describe, it, expect } from 'vitest';
import { generateWorkoutPlan } from '@/domain/workout-generator';
import { CURATED_EXERCISE_CATALOG } from '@/services/exercise-catalog.data';
import { isExerciseCompatible, isExerciseLimitationSafe } from '@/domain/exercise-compatibility';
import { ExperienceLevel, FitnessGoal, WorkoutEnvironment } from '@/types/user.types';

describe('Authoritative Workout Generator Smoke Tests (Final Plans Inspection)', () => {
  const allExercises = CURATED_EXERCISE_CATALOG;
  const experienceLevels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
  const fitnessGoals: FitnessGoal[] = ['muscle_gain', 'strength', 'fat_loss', 'endurance', 'maintenance'];
  const dayOptions = [2, 3, 4, 5, 6];

  // Helper to extract all exercises from a final generated plan
  const getAllExercisesFromPlan = (plan: ReturnType<typeof generateWorkoutPlan>) => {
    const exercises = [];
    for (const day of plan.days) {
      for (const exEntry of day.exercises) {
        if (exEntry.exercise) {
          exercises.push(exEntry.exercise);
        }
      }
    }
    return exercises;
  };

  // =========================================================================
  // CASE A: home_bodyweight
  // =========================================================================
  describe('Case A: home_bodyweight', () => {
    it('generates final plans with ZERO equipment-required exercises across multiple variations', () => {
      for (const days of dayOptions) {
        for (const exp of experienceLevels) {
          const plan = generateWorkoutPlan({
            daysPerWeek: days,
            experienceLevel: exp,
            equipment: ['Bodyweight'],
            goal: 'maintenance',
            workoutEnvironment: 'home_bodyweight',
            availableExercises: allExercises,
          });

          expect(plan.isValid).toBe(true);
          expect(plan.validationStatus).toBe('passed');
          expect(plan.days.length).toBeGreaterThan(0);

          const planExercises = getAllExercisesFromPlan(plan);
          expect(planExercises.length).toBeGreaterThan(0);

          for (const ex of planExercises) {
            // Assert equipment-compatible
            expect(isExerciseCompatible(ex, 'home_bodyweight', ['Bodyweight'])).toBe(true);
            expect(ex.equipmentRequired).toBe('Bodyweight');

            // Assert ZERO barbell, dumbbell, cable, machine, bench/rack
            expect(ex.equipmentRequired.toLowerCase()).not.toBe('barbell');
            expect(ex.equipmentRequired.toLowerCase()).not.toBe('dumbbells');
            expect(ex.equipmentRequired.toLowerCase()).not.toBe('cable');
            expect(ex.equipmentRequired.toLowerCase()).not.toBe('machines');
            expect(ex.name.toLowerCase()).not.toContain('barbell');
            expect(ex.name.toLowerCase()).not.toContain('dumbbell');
            expect(ex.name.toLowerCase()).not.toContain('cable');
          }
        }
      }
    });
  });

  // =========================================================================
  // CASE B: home_equipped
  // =========================================================================
  describe('Case B: home_equipped', () => {
    it('generates final plans where NO undeclared equipment appears (Dumbbells + Resistance Bands only)', () => {
      const declaredInventory = ['Dumbbells', 'Resistance Bands', 'Bodyweight'];

      for (const days of [3, 4, 5]) {
        for (const exp of experienceLevels) {
          const plan = generateWorkoutPlan({
            daysPerWeek: days,
            experienceLevel: exp,
            equipment: declaredInventory,
            goal: 'muscle_gain',
            workoutEnvironment: 'home_equipped',
            availableExercises: allExercises,
          });

          expect(plan.isValid).toBe(true);
          expect(plan.validationStatus).toBe('passed');

          const planExercises = getAllExercisesFromPlan(plan);
          expect(planExercises.length).toBeGreaterThan(0);

          for (const ex of planExercises) {
            expect(isExerciseCompatible(ex, 'home_equipped', declaredInventory)).toBe(true);
            expect(['Dumbbells', 'Resistance Bands', 'Bodyweight']).toContain(ex.equipmentRequired);
            // Assert no barbell, cable, or machine
            expect(ex.equipmentRequired).not.toBe('Barbell');
            expect(ex.equipmentRequired).not.toBe('Cable');
            expect(ex.equipmentRequired).not.toBe('Machines');
          }
        }
      }
    });
  });

  // =========================================================================
  // CASE C: external_gym
  // =========================================================================
  describe('Case C: external_gym', () => {
    it('restricts final plans strictly to declared external gym equipment', () => {
      // Restricted inventory: only Barbell and Bodyweight (no dumbbells, no cable, no machines)
      const restrictedGymInventory = ['Barbell', 'Bodyweight'];

      for (const days of [3, 4]) {
        const plan = generateWorkoutPlan({
          daysPerWeek: days,
          experienceLevel: 'intermediate',
          equipment: restrictedGymInventory,
          goal: 'strength',
          workoutEnvironment: 'external_gym',
          availableExercises: allExercises,
        });

        expect(plan.isValid).toBe(true);
        expect(plan.validationStatus).toBe('passed');

        const planExercises = getAllExercisesFromPlan(plan);
        expect(planExercises.length).toBeGreaterThan(0);

        for (const ex of planExercises) {
          expect(isExerciseCompatible(ex, 'external_gym', restrictedGymInventory)).toBe(true);
          expect(restrictedGymInventory).toContain(ex.equipmentRequired);
          expect(['Dumbbells', 'Cable', 'Machines']).not.toContain(ex.equipmentRequired);
        }
      }
    });
  });

  // =========================================================================
  // CASE D: connected_gym
  // =========================================================================
  describe('Case D: connected_gym', () => {
    it('restricts final plans to facility equipment set', () => {
      // Connected gym facility equipment set: Barbell, Dumbbells, Cable, Bodyweight
      const facilityEquipment = ['Barbell', 'Dumbbells', 'Cable', 'Bodyweight'];

      for (const days of [3, 5]) {
        const plan = generateWorkoutPlan({
          daysPerWeek: days,
          experienceLevel: 'advanced',
          equipment: facilityEquipment,
          goal: 'muscle_gain',
          workoutEnvironment: 'connected_gym',
          availableExercises: allExercises,
        });

        expect(plan.isValid).toBe(true);
        expect(plan.validationStatus).toBe('passed');

        const planExercises = getAllExercisesFromPlan(plan);
        expect(planExercises.length).toBeGreaterThan(0);

        for (const ex of planExercises) {
          expect(isExerciseCompatible(ex, 'connected_gym', facilityEquipment)).toBe(true);
          expect(facilityEquipment).toContain(ex.equipmentRequired);
        }
      }
    });
  });

  // =========================================================================
  // CASE E: limitations
  // =========================================================================
  describe('Case E: limitations (lower-back, knees, shoulders, wrists)', () => {
    const limitationsList = ['lower back', 'knees', 'shoulders', 'wrists'];

    it.each(limitationsList)('respects %s limitation in final plan without contraindicated exercises', (limitation) => {
      const plan = generateWorkoutPlan({
        daysPerWeek: 3,
        experienceLevel: 'intermediate',
        equipment: ['Barbell', 'Dumbbells', 'Cable', 'Bodyweight'],
        goal: 'muscle_gain',
        workoutEnvironment: 'connected_gym',
        limitations: [limitation],
        availableExercises: allExercises,
      });

      expect(plan.isValid).toBe(true);
      expect(plan.validationStatus).toBe('passed');

      const planExercises = getAllExercisesFromPlan(plan);
      expect(planExercises.length).toBeGreaterThan(0);

      for (const ex of planExercises) {
        expect(isExerciseLimitationSafe(ex, [limitation])).toBe(true);

        if (limitation === 'lower back') {
          expect(ex.name).not.toBe('Conventional Deadlift');
          expect(ex.name).not.toBe('Barbell Bent-Over Row');
        } else if (limitation === 'knees') {
          expect(ex.name).not.toBe('Barbell Back Squat');
          expect(ex.name).not.toBe('Walking Lunge');
        } else if (limitation === 'shoulders') {
          expect(ex.name).not.toBe('Overhead Barbell Press');
        } else if (limitation === 'wrists') {
          expect(ex.name).not.toBe('Barbell Bench Press');
          expect(ex.name).not.toBe('Barbell Bicep Curl');
        }
      }
    });
  });

  // =========================================================================
  // CASE F: 50+ Iterations Per Critical Environment
  // =========================================================================
  describe('Case F: 50+ iteration stress test for each critical environment', () => {
    const environments: { env: WorkoutEnvironment; equip: string[] }[] = [
      { env: 'home_bodyweight', equip: ['Bodyweight'] },
      { env: 'home_equipped', equip: ['Dumbbells', 'Resistance Bands', 'Bodyweight'] },
      { env: 'external_gym', equip: ['Barbell', 'Dumbbells', 'Bodyweight'] },
      { env: 'connected_gym', equip: ['Barbell', 'Dumbbells', 'Cable', 'Bodyweight'] },
    ];

    it.each(environments)(
      'generates 50 valid, compatible plans with ZERO incompatible outputs for $env',
      ({ env, equip }) => {
        let incompatibleCount = 0;

        for (let i = 0; i < 50; i++) {
          const days = (i % 5) + 2; // 2 to 6 days
          const exp = experienceLevels[i % experienceLevels.length];
          const goal = fitnessGoals[i % fitnessGoals.length];
          const limitation = i % 4 === 0 ? ['lower back'] : i % 4 === 1 ? ['knees'] : i % 4 === 2 ? ['shoulders'] : [];

          const plan = generateWorkoutPlan({
            daysPerWeek: days,
            experienceLevel: exp,
            equipment: equip,
            goal,
            workoutEnvironment: env,
            limitations: limitation,
            availableExercises: allExercises,
          });

          if (!plan.isValid || plan.validationStatus !== 'passed') {
            incompatibleCount++;
          }

          const planExercises = getAllExercisesFromPlan(plan);
          for (const ex of planExercises) {
            const isComp = isExerciseCompatible(ex, env, equip);
            const isSafe = isExerciseLimitationSafe(ex, limitation);
            if (!isComp || !isSafe) {
              incompatibleCount++;
            }
          }
        }

        expect(incompatibleCount).toBe(0);
      }
    );
  });
});
