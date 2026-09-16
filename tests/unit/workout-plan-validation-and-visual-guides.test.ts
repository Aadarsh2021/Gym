import { describe, it, expect } from 'vitest';
import {
  isExerciseLimitationSafe,
  validateWorkoutExercise,
  validateWorkoutPlan,
} from '@/domain/exercise-compatibility';
import { generateWorkoutPlan, GenerationInputs } from '@/domain/workout-generator';
import { CURATED_EXERCISE_CATALOG } from '@/services/exercise-catalog.data';
import { WorkoutPlan } from '@/types/workout.types';

describe('Phase C8: Authoritative Plan-Level Validation & Visual Exercise Guides', () => {
  // =========================================================================
  // SECTION E: ADVERSARIAL PLAN-LEVEL TESTING (Cases 1 - 12)
  // =========================================================================

  describe('Section E: 12 Adversarial Plan-Level Validation Cases', () => {
    // Case 1: Home bodyweight plan contains zero equipment-required exercises
    it('Case 1: Home bodyweight plan contains ZERO equipment-required exercises', () => {
      const input: GenerationInputs = {
        goal: 'muscle_gain',
        experienceLevel: 'beginner',
        daysPerWeek: 3,
        equipment: ['Bodyweight'],
        workoutEnvironment: 'home_bodyweight',
        availableExercises: CURATED_EXERCISE_CATALOG,
      };

      const plan = generateWorkoutPlan(input);
      expect(plan.isValid).toBe(true);
      expect(plan.validationStatus).toBe('passed');

      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(ex.exercise).toBeDefined();
          expect(ex.exercise!.equipmentRequired).toBe('Bodyweight');
          expect(['Barbell', 'Dumbbells', 'Cable', 'Machines', 'Bench', 'Rack']).not.toContain(
            ex.exercise!.equipmentRequired
          );
        }
      }
    });

    // Case 2: Home equipped plan contains only declared equipment
    it('Case 2: Home equipped plan contains ONLY declared equipment (e.g. Dumbbells only)', () => {
      const declaredEquipment = ['Dumbbells', 'Bodyweight'];
      const input: GenerationInputs = {
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        daysPerWeek: 4,
        equipment: declaredEquipment,
        workoutEnvironment: 'home_equipped',
        availableExercises: CURATED_EXERCISE_CATALOG,
      };

      const plan = generateWorkoutPlan(input);
      expect(plan.isValid).toBe(true);
      expect(plan.validationStatus).toBe('passed');

      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(ex.exercise).toBeDefined();
          expect(declaredEquipment).toContain(ex.exercise!.equipmentRequired);
          expect(['Barbell', 'Cable', 'Machines']).not.toContain(ex.exercise!.equipmentRequired);
        }
      }
    });

    // Case 3: External gym plan contains only declared gym equipment
    it('Case 3: External gym plan contains only declared gym equipment', () => {
      const declaredGymEquip = ['Barbell', 'Dumbbells', 'Bench', 'Bodyweight'];
      const input: GenerationInputs = {
        goal: 'strength',
        experienceLevel: 'advanced',
        daysPerWeek: 3,
        equipment: declaredGymEquip,
        workoutEnvironment: 'external_gym',
        availableExercises: CURATED_EXERCISE_CATALOG,
      };

      const plan = generateWorkoutPlan(input);
      expect(plan.isValid).toBe(true);

      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(ex.exercise).toBeDefined();
          expect(declaredGymEquip).toContain(ex.exercise!.equipmentRequired);
          expect(['Cable', 'Machines']).not.toContain(ex.exercise!.equipmentRequired);
        }
      }
    });

    // Case 4: Connected gym plan respects facility equipment
    it('Case 4: Connected gym plan respects facility equipment catalogue', () => {
      const facilityEquipment = ['Barbell', 'Dumbbells', 'Cable', 'Bodyweight'];
      const input: GenerationInputs = {
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        daysPerWeek: 5,
        equipment: facilityEquipment,
        workoutEnvironment: 'connected_gym',
        availableExercises: CURATED_EXERCISE_CATALOG,
      };

      const plan = generateWorkoutPlan(input);
      expect(plan.isValid).toBe(true);

      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(ex.exercise).toBeDefined();
          expect(facilityEquipment).toContain(ex.exercise!.equipmentRequired);
        }
      }
    });

    // Case 5: A generated plan containing one incompatible exercise is rejected
    it('Case 5: A generated plan containing one incompatible exercise is rejected by validator', () => {
      // Intentionally craft a plan with 1 illegal barbell exercise in bodyweight environment
      const barbellBench = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-bench-press')!;
      const pushup = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-pushup')!;

      const mockPlan: WorkoutPlan = {
        id: 'mock-plan-1',
        userId: 'user-1',
        name: 'Tampered Plan',
        description: 'Test',
        splitType: 'full_body',
        isActive: true,
        days: [
          {
            id: 'mock-day-1',
            planId: 'mock-plan-1',
            dayNumber: 1,
            name: 'Day 1',
            targetMuscleGroups: ['Chest'],
            exercises: [
              {
                id: 'mock-ex-1',
                planDayId: 'day-1',
                orderIndex: 0,
                exerciseId: pushup.id,
                exercise: pushup,
                targetSets: 3,
                targetRepsMin: 10,
                targetRepsMax: 15,
                restSeconds: 60,
                isCore: true,
              },
              {
                id: 'mock-ex-2',
                planDayId: 'day-1',
                orderIndex: 1,
                exerciseId: barbellBench.id,
                exercise: barbellBench, // ILLEGAL IN BODYWEIGHT!
                targetSets: 3,
                targetRepsMin: 8,
                targetRepsMax: 10,
                restSeconds: 90,
                isCore: false,
              },
            ],
          },
        ],
      };

      // Validate without replacement pool -> must fail
      const result = validateWorkoutPlan(mockPlan, 'home_bodyweight', ['Bodyweight']);
      expect(result.isValid).toBe(false);
      expect(result.invalidExerciseCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Barbell Bench Press');
    });

    // Case 6: Invalid exercise is deterministically replaced only by a compatible candidate
    it('Case 6: Invalid exercise is deterministically replaced only by a compatible candidate', () => {
      const barbellSquat = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-squat')!;

      const mockPlan: WorkoutPlan = {
        id: 'mock-plan-2',
        userId: 'user-1',
        name: 'Incompatible Squat Plan',
        description: 'Test',
        splitType: 'full_body',
        isActive: true,
        days: [
          {
            id: 'mock-day-2',
            planId: 'mock-plan-2',
            dayNumber: 1,
            name: 'Leg Day',
            targetMuscleGroups: ['Legs'],
            exercises: [
              {
                id: 'mock-ex-3',
                planDayId: 'day-1',
                orderIndex: 0,
                exerciseId: barbellSquat.id,
                exercise: barbellSquat,
                targetSets: 3,
                targetRepsMin: 8,
                targetRepsMax: 10,
                restSeconds: 90,
                isCore: true,
              },
            ],
          },
        ],
      };

      // Validate with candidate pool containing bodyweight leg movements
      const result = validateWorkoutPlan(
        mockPlan,
        'home_bodyweight',
        ['Bodyweight'],
        undefined,
        CURATED_EXERCISE_CATALOG
      );

      expect(result.isValid).toBe(true);
      expect(result.validatedPlan).toBeDefined();
      const replacedEx = result.validatedPlan!.days[0].exercises[0].exercise;
      expect(replacedEx.equipmentRequired).toBe('Bodyweight');
      expect(replacedEx.primaryMuscle).toBe('Legs');
    });

    // Case 7: If no compatible candidate exists, generation fails explicitly
    it('Case 7: If no compatible candidate exists, validation & generation fail explicitly', () => {
      const cableLat = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-lat-pulldown')!;

      const mockPlan: WorkoutPlan = {
        id: 'mock-plan-3',
        userId: 'user-1',
        name: 'Unfixable Plan',
        description: 'Test',
        splitType: 'full_body',
        isActive: true,
        days: [
          {
            id: 'mock-day-3',
            planId: 'mock-plan-3',
            dayNumber: 1,
            name: 'Back Isolation Day',
            targetMuscleGroups: ['Back'],
            exercises: [
              {
                id: 'mock-ex-4',
                planDayId: 'day-1',
                orderIndex: 0,
                exerciseId: cableLat.id,
                exercise: cableLat,
                targetSets: 3,
                targetRepsMin: 12,
                targetRepsMax: 15,
                restSeconds: 60,
                isCore: false,
              },
            ],
          },
        ],
      };

      // Empty replacement pool -> cannot replace -> must fail explicitly
      const result = validateWorkoutPlan(mockPlan, 'home_bodyweight', ['Bodyweight'], undefined, []);
      expect(result.isValid).toBe(false);
      expect(result.invalidExerciseCount).toBe(1);
      expect(result.errors[0]).toContain('no compatible replacement exists');
    });

    // Case 8: Limitations are respected at final-plan level
    it('Case 8: User limitations (e.g. Lower Back) are strictly enforced at final-plan level', () => {
      const input: GenerationInputs = {
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        daysPerWeek: 3,
        equipment: ['Barbell', 'Dumbbells', 'Cable', 'Machines', 'Bodyweight'],
        workoutEnvironment: 'external_gym',
        availableExercises: CURATED_EXERCISE_CATALOG,
        limitations: ['Lower Back'], // Contraindicates heavy spinal loading: Barbell Bent-Over Row, Barbell Back Squat
      };

      const plan = generateWorkoutPlan(input);
      expect(plan.isValid).toBe(true);

      const contraindicatedNames = ['barbell bent-over row', 'barbell back squat'];
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(ex.exercise).toBeDefined();
          const lowerName = ex.exercise!.name.toLowerCase();
          for (const badName of contraindicatedNames) {
            expect(lowerName).not.toContain(badName);
          }
        }
      }
    });

    // Case 9: No arbitrary index-0 fallback can reintroduce incompatible exercises
    it('Case 9: No arbitrary index-0 fallback can reintroduce incompatible exercises', () => {
      // Create a pool where index 0 is an INCOMPATIBLE Barbell Bench Press
      const barbellBench = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-bench-press')!;
      const pushup = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-pushup')!;
      const skewedPool = [barbellBench, pushup];

      const input: GenerationInputs = {
        goal: 'fat_loss',
        experienceLevel: 'beginner',
        daysPerWeek: 2,
        equipment: ['Bodyweight'],
        workoutEnvironment: 'home_bodyweight',
        availableExercises: skewedPool,
      };

      const plan = generateWorkoutPlan(input);
      expect(plan.isValid).toBe(true);
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(ex.exercise).toBeDefined();
          expect(ex.exercise!.equipmentRequired).toBe('Bodyweight');
          expect(ex.exercise!.name).not.toBe('Barbell Bench Press');
        }
      }
    });

    // Case 10: Repeated generation cannot leak an incompatible exercise through another path
    it('Case 10: Repeated generation across 50 iterations never leaks incompatible exercises', () => {
      const input: GenerationInputs = {
        goal: 'endurance',
        experienceLevel: 'beginner',
        daysPerWeek: 3,
        equipment: ['Bodyweight'],
        workoutEnvironment: 'home_bodyweight',
        availableExercises: CURATED_EXERCISE_CATALOG,
      };

      for (let i = 0; i < 50; i++) {
        const plan = generateWorkoutPlan(input);
        expect(plan.isValid).toBe(true);
        for (const day of plan.days) {
          for (const ex of day.exercises) {
            expect(ex.exercise).toBeDefined();
            expect(ex.exercise!.equipmentRequired).toBe('Bodyweight');
          }
        }
      }
    });

    // Case 11: Workout regeneration re-runs full validation
    it('Case 11: Workout regeneration re-runs full validation pipeline', () => {
      const input: GenerationInputs = {
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        daysPerWeek: 4,
        equipment: ['Dumbbells', 'Bodyweight'],
        workoutEnvironment: 'home_equipped',
        availableExercises: CURATED_EXERCISE_CATALOG,
      };

      // Initial generation
      const initialPlan = generateWorkoutPlan(input);
      expect(initialPlan.isValid).toBe(true);

      // Regeneration
      const regeneratedPlan = generateWorkoutPlan(input);
      expect(regeneratedPlan.isValid).toBe(true);
      expect(regeneratedPlan.validationStatus).toBe('passed');

      for (const day of regeneratedPlan.days) {
        for (const ex of day.exercises) {
          expect(ex.exercise).toBeDefined();
          expect(['Dumbbells', 'Bodyweight']).toContain(ex.exercise!.equipmentRequired);
        }
      }
    });

    // Case 12: Existing saved/generated plans are not silently mutated into incompatible states
    it('Case 12: Validator detects if an existing saved plan is corrupted or incompatible', () => {
      const validPlan = generateWorkoutPlan({
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        daysPerWeek: 3,
        equipment: ['Bodyweight'],
        workoutEnvironment: 'home_bodyweight',
        availableExercises: CURATED_EXERCISE_CATALOG,
      });

      // Verify valid initially
      const check1 = validateWorkoutPlan(validPlan, 'home_bodyweight', ['Bodyweight']);
      expect(check1.isValid).toBe(true);

      // Simulate external corruption / mutation
      const corruptedPlan = JSON.parse(JSON.stringify(validPlan)) as WorkoutPlan;
      expect(corruptedPlan.days[0]).toBeDefined();
      expect(corruptedPlan.days[0].exercises[0]).toBeDefined();
      expect(corruptedPlan.days[0].exercises[0].exercise).toBeDefined();

      corruptedPlan.days[0].exercises[0].exercise!.equipmentRequired = 'Barbell';
      corruptedPlan.days[0].exercises[0].exercise!.name = 'Injected Barbell Lift';

      const check2 = validateWorkoutPlan(corruptedPlan, 'home_bodyweight', ['Bodyweight']);
      expect(check2.isValid).toBe(false);
      expect(check2.errors[0]).toContain('Injected Barbell Lift');
    });
  });

  // =========================================================================
  // VISUAL EXERCISE GUIDE SPECIFICATION TESTS
  // =========================================================================

  describe('Visual Exercise Guide Specifications', () => {
    it('verifies catalog visual asset statistics', () => {
      const catalog = CURATED_EXERCISE_CATALOG;
      expect(catalog.length).toBeGreaterThanOrEqual(25);

      // Verify every exercise has primaryMuscle and equipmentRequired
      for (const ex of catalog) {
        expect(ex.primaryMuscle).toBeDefined();
        expect(ex.equipmentRequired).toBeDefined();
        expect(ex.instructions.length).toBeGreaterThan(0);
      }
    });

    it('ensures limitation safety filter accurately excludes contraindicated movements', () => {
      const barbellRow = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-barbell-row')!;
      const pushup = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-pushup')!;

      // Lower Back limitation contraindicates Barbell Bent-Over Row
      expect(isExerciseLimitationSafe(barbellRow, ['Lower Back'])).toBe(false);
      // Pushup is safe for Lower Back
      expect(isExerciseLimitationSafe(pushup, ['Lower Back'])).toBe(true);

      // Knee limitation contraindicates Barbell Back Squat
      const squat = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-squat')!;
      expect(isExerciseLimitationSafe(squat, ['Knees'])).toBe(false);
    });

    it('validates single exercise compatibility across environments', () => {
      const barbellBench = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-bench-press')!;
      const pushup = CURATED_EXERCISE_CATALOG.find(e => e.id === 'ex-pushup')!;

      // Barbell bench in home_bodyweight -> INVALID
      const res1 = validateWorkoutExercise(barbellBench, 'home_bodyweight', ['Bodyweight']);
      expect(res1.valid).toBe(false);
      expect(res1.reason).toContain('requires Barbell');

      // Pushup in home_bodyweight -> VALID
      const res2 = validateWorkoutExercise(pushup, 'home_bodyweight', ['Bodyweight']);
      expect(res2.valid).toBe(true);
    });
  });
});
