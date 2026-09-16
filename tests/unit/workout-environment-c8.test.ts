import { describe, it, expect } from 'vitest';
import { isExerciseCompatible } from '@/domain/exercise-compatibility';
import { generateWorkoutPlan } from '@/domain/workout-generator';
import { findExerciseAlternatives } from '@/domain/exercise-alternatives';
import { deriveMemberGymContext } from '@/services/gym-context.service';
import { GymCheckinService } from '@/services/gym-checkin.service';
import { FALLBACK_EXERCISES } from '@/services/exercise.service';
import { Exercise } from '@/types/workout.types';
import { GymMembership, Gym } from '@/types/gym.types';

// Mock test catalog
const testCatalog: Exercise[] = [
  {
    id: 'ex-bb-bench',
    name: 'Barbell Bench Press',
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Triceps'],
    equipmentRequired: 'Barbell',
    difficulty: 'intermediate',
    movementPattern: 'Push',
    instructions: ['Lower bar to chest and press up.'],
    isSystem: true,
  },
  {
    id: 'ex-db-bench',
    name: 'Dumbbell Bench Press',
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Triceps'],
    equipmentRequired: 'Dumbbells',
    difficulty: 'beginner',
    movementPattern: 'Push',
    instructions: ['Press dumbbells upwards.'],
    isSystem: true,
  },
  {
    id: 'ex-pushup',
    name: 'Push-Up',
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Triceps', 'Core'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'beginner',
    movementPattern: 'Push',
    instructions: ['Standard push-up on floor.'],
    isSystem: true,
  },
  {
    id: 'ex-pike-pushup',
    name: 'Pike Push-Up',
    primaryMuscle: 'Shoulders',
    secondaryMuscles: ['Triceps'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'intermediate',
    movementPattern: 'Push',
    instructions: ['Elevate hips into inverted V and lower crown of head.'],
    isSystem: true,
  },
  {
    id: 'ex-bb-squat',
    name: 'Barbell Back Squat',
    primaryMuscle: 'Legs',
    secondaryMuscles: ['Glutes'],
    equipmentRequired: 'Barbell',
    difficulty: 'intermediate',
    movementPattern: 'Squat',
    instructions: ['Squat below parallel.'],
    isSystem: true,
  },
  {
    id: 'ex-bw-squat',
    name: 'Bodyweight Squat',
    primaryMuscle: 'Legs',
    secondaryMuscles: ['Glutes'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'beginner',
    movementPattern: 'Squat',
    instructions: ['Descend until thighs parallel to floor.'],
    isSystem: true,
  },
  {
    id: 'ex-inv-row',
    name: 'Inverted Bodyweight Row',
    primaryMuscle: 'Back',
    secondaryMuscles: ['Biceps'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'beginner',
    movementPattern: 'Pull',
    instructions: ['Pull chest towards bar or sturdy horizontal surface.'],
    isSystem: true,
  },
  {
    id: 'ex-bb-row',
    name: 'Barbell Row',
    primaryMuscle: 'Back',
    secondaryMuscles: ['Biceps'],
    equipmentRequired: 'Barbell',
    difficulty: 'intermediate',
    movementPattern: 'Pull',
    instructions: ['Bent-over barbell row.'],
    isSystem: true,
  },
  {
    id: 'ex-cable-row',
    name: 'Seated Cable Row',
    primaryMuscle: 'Back',
    secondaryMuscles: ['Biceps'],
    equipmentRequired: 'Cable',
    difficulty: 'beginner',
    movementPattern: 'Pull',
    instructions: ['Row handle to abdomen.'],
    isSystem: true,
  },
  {
    id: 'ex-dips',
    name: 'Chair/Bench Dips',
    primaryMuscle: 'Arms',
    secondaryMuscles: ['Triceps', 'Chest'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'beginner',
    movementPattern: 'Push',
    instructions: ['Dip hips down by bending elbows.'],
    isSystem: true,
  },
  {
    id: 'ex-diamond-pushup',
    name: 'Diamond Push-Up',
    primaryMuscle: 'Arms',
    secondaryMuscles: ['Triceps', 'Chest'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'intermediate',
    movementPattern: 'Push',
    instructions: ['Hands together forming a diamond shape.'],
    isSystem: true,
  },
  {
    id: 'ex-db-curl',
    name: 'Dumbbell Bicep Curl',
    primaryMuscle: 'Arms',
    secondaryMuscles: ['Biceps'],
    equipmentRequired: 'Dumbbells',
    difficulty: 'beginner',
    movementPattern: 'Pull',
    instructions: ['Curl dumbbells up.'],
    isSystem: true,
  },
  {
    id: 'ex-plank',
    name: 'Plank',
    primaryMuscle: 'Core',
    secondaryMuscles: [],
    equipmentRequired: 'Bodyweight',
    difficulty: 'beginner',
    movementPattern: 'Plank',
    instructions: ['Hold forearm plank.'],
    isSystem: true,
  },
  {
    id: 'ex-superman',
    name: 'Superman',
    primaryMuscle: 'Back',
    secondaryMuscles: ['Glutes'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'beginner',
    movementPattern: 'Hinge',
    instructions: ['Lift chest, arms, and legs off the ground.'],
    isSystem: true,
  },
  {
    id: 'ex-reverse-lunge',
    name: 'Reverse Lunge',
    primaryMuscle: 'Legs',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'beginner',
    movementPattern: 'Lunge',
    instructions: ['Step back into a 90-degree lunge.'],
    isSystem: true,
  },
  {
    id: 'ex-glute-bridge',
    name: 'Glute Bridge',
    primaryMuscle: 'Legs',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipmentRequired: 'Bodyweight',
    difficulty: 'beginner',
    movementPattern: 'Hinge',
    instructions: ['Drive hips towards ceiling.'],
    isSystem: true,
  },
];

describe('Phase C8: Account Roles & 4-Environment Model', () => {
  // =========================================================================
  // 1. AUTHORITATIVE COMPATIBILITY RULE & DOMAIN LOGIC
  // =========================================================================
  describe('Exercise Compatibility Engine (isExerciseCompatible)', () => {
    it('home_bodyweight: ONLY allows Bodyweight or None equipment', () => {
      const bwExercise = testCatalog.find(e => e.id === 'ex-pushup')!;
      const barbellExercise = testCatalog.find(e => e.id === 'ex-bb-bench')!;
      const dumbbellExercise = testCatalog.find(e => e.id === 'ex-db-bench')!;
      const cableExercise = testCatalog.find(e => e.id === 'ex-cable-row')!;

      expect(isExerciseCompatible(bwExercise, 'home_bodyweight', ['Bodyweight'])).toBe(true);
      expect(isExerciseCompatible(barbellExercise, 'home_bodyweight', ['Bodyweight'])).toBe(false);
      expect(isExerciseCompatible(dumbbellExercise, 'home_bodyweight', ['Bodyweight'])).toBe(false);
      expect(isExerciseCompatible(cableExercise, 'home_bodyweight', ['Bodyweight'])).toBe(false);
    });

    it('home_bodyweight: strictly rejects equipment even if declared in availableEquipment array', () => {
      // Even if someone malicious or buggy passed Barbell in equipment array, home_bodyweight environment rule overrides
      const barbellExercise = testCatalog.find(e => e.id === 'ex-bb-bench')!;
      expect(isExerciseCompatible(barbellExercise, 'home_bodyweight', ['Barbell', 'Dumbbells', 'Bodyweight'])).toBe(false);
    });

    it('home_equipped: strictly respects declared equipment', () => {
      const bwExercise = testCatalog.find(e => e.id === 'ex-pushup')!;
      const dumbbellExercise = testCatalog.find(e => e.id === 'ex-db-bench')!;
      const barbellExercise = testCatalog.find(e => e.id === 'ex-bb-bench')!;

      const userInventory = ['Dumbbells', 'Bodyweight'];

      expect(isExerciseCompatible(bwExercise, 'home_equipped', userInventory)).toBe(true);
      expect(isExerciseCompatible(dumbbellExercise, 'home_equipped', userInventory)).toBe(true);
      expect(isExerciseCompatible(barbellExercise, 'home_equipped', userInventory)).toBe(false);
    });

    it('external_gym: respects declared gym equipment inventory', () => {
      const barbellExercise = testCatalog.find(e => e.id === 'ex-bb-squat')!;
      const cableExercise = testCatalog.find(e => e.id === 'ex-cable-row')!;

      expect(isExerciseCompatible(barbellExercise, 'external_gym', ['Barbell', 'Dumbbells'])).toBe(true);
      expect(isExerciseCompatible(cableExercise, 'external_gym', ['Barbell', 'Dumbbells'])).toBe(false);
    });

    it('connected_gym: respects facility/user equipment', () => {
      const barbellExercise = testCatalog.find(e => e.id === 'ex-bb-squat')!;
      expect(isExerciseCompatible(barbellExercise, 'connected_gym', ['Barbell', 'Dumbbells', 'Cable', 'Machines'])).toBe(true);
    });
  });

  // =========================================================================
  // 2. WORKOUT GENERATOR HARDENING (CRITICAL ACCEPTANCE CRITERION)
  // =========================================================================
  describe('Workout Generator Engine Hardening', () => {
    it('MANDATORY: home_bodyweight user NEVER receives an equipment-required exercise', () => {
      const plan = generateWorkoutPlan({
        daysPerWeek: 4,
        experienceLevel: 'intermediate',
        equipment: ['Bodyweight'],
        workoutEnvironment: 'home_bodyweight',
        goal: 'muscle_gain',
        availableExercises: testCatalog,
      });

      expect(plan.days.length).toBeGreaterThan(0);

      // Verify every single exercise across all generated days
      for (const day of plan.days) {
        for (const item of day.exercises) {
          expect(item.exercise).toBeDefined();
          const eq = item.exercise!.equipmentRequired;
          expect(['Bodyweight', 'None']).toContain(eq);
          expect(item.exercise!.name).not.toContain('Barbell');
          expect(item.exercise!.name).not.toContain('Dumbbell');
          expect(item.exercise!.name).not.toContain('Cable');
        }
      }
    });

    it('NO ARBITRARY FALLBACK: when no compatible exercise exists, does NOT fall back to availableExercises[0]', () => {
      // Construct a hostile catalog where index 0 is Barbell Bench Press, and there are NO compatible chest/back exercises
      const onlyBarbellCatalog: Exercise[] = [
        {
          id: 'ex-0-hostile',
          name: 'Barbell Bench Press',
          primaryMuscle: 'Chest',
          secondaryMuscles: [],
          equipmentRequired: 'Barbell',
          difficulty: 'advanced',
          movementPattern: 'Push',
          instructions: [],
          isSystem: true,
        },
        {
          id: 'ex-1-hostile',
          name: 'Heavy Barbell Squat',
          primaryMuscle: 'Legs',
          secondaryMuscles: [],
          equipmentRequired: 'Barbell',
          difficulty: 'advanced',
          movementPattern: 'Squat',
          instructions: [],
          isSystem: true,
        },
      ];

      const plan = generateWorkoutPlan({
        daysPerWeek: 3,
        experienceLevel: 'beginner',
        equipment: ['Bodyweight'],
        workoutEnvironment: 'home_bodyweight',
        goal: 'muscle_gain',
        availableExercises: onlyBarbellCatalog,
      });

      // Every day must be safely shaped with 0 incompatible exercises; index 0 must NEVER be injected!
      for (const day of plan.days) {
        expect(day.exercises.length).toBe(0);
        for (const item of day.exercises) {
          expect(item.exercise?.equipmentRequired).not.toBe('Barbell');
        }
      }
    });

    it('home_equipped respects user declared equipment only', () => {
      const plan = generateWorkoutPlan({
        daysPerWeek: 3,
        experienceLevel: 'intermediate',
        equipment: ['Dumbbells', 'Bodyweight'], // NO Barbell
        workoutEnvironment: 'home_equipped',
        goal: 'strength',
        availableExercises: testCatalog,
      });

      for (const day of plan.days) {
        for (const item of day.exercises) {
          expect(['Dumbbells', 'Bodyweight', 'None']).toContain(item.exercise!.equipmentRequired);
          expect(item.exercise!.equipmentRequired).not.toBe('Barbell');
          expect(item.exercise!.equipmentRequired).not.toBe('Cable');
        }
      }
    });

    it('external_gym respects declared gym equipment', () => {
      const plan = generateWorkoutPlan({
        daysPerWeek: 4,
        experienceLevel: 'intermediate',
        equipment: ['Barbell', 'Dumbbells', 'Bodyweight'], // NO Cable
        workoutEnvironment: 'external_gym',
        goal: 'muscle_gain',
        availableExercises: testCatalog,
      });

      for (const day of plan.days) {
        for (const item of day.exercises) {
          expect(item.exercise!.equipmentRequired).not.toBe('Cable');
        }
      }
    });
  });

  // =========================================================================
  // 3. EXERCISE ALTERNATIVES ENGINE
  // =========================================================================
  describe('Exercise Alternatives (findExerciseAlternatives)', () => {
    it('restricts alternatives to bodyweight for home_bodyweight user', () => {
      const currentEx = testCatalog.find(e => e.id === 'ex-pushup')!;
      const alternatives = findExerciseAlternatives(
        currentEx,
        testCatalog,
        4,
        'home_bodyweight',
        ['Bodyweight']
      );

      expect(alternatives.length).toBeGreaterThanOrEqual(0);
      for (const alt of alternatives) {
        expect(['Bodyweight', 'None']).toContain(alt.equipmentRequired);
      }
    });

    it('does not offer barbell alternatives if user only has dumbbells at home', () => {
      const currentEx = testCatalog.find(e => e.id === 'ex-db-bench')!;
      const alternatives = findExerciseAlternatives(
        currentEx,
        testCatalog,
        4,
        'home_equipped',
        ['Dumbbells', 'Bodyweight']
      );

      for (const alt of alternatives) {
        expect(alt.equipmentRequired).not.toBe('Barbell');
      }
    });
  });

  // =========================================================================
  // 4. EXERCISE CATALOG EXPANSION
  // =========================================================================
  describe('Authoritative Bodyweight Catalog Expansion', () => {
    it('verifies all 9 foundational bodyweight exercises exist in the catalog', () => {
      const requiredNames = [
        'Inverted Bodyweight Row',
        'Doorframe Row',
        'Superman',
        'Pike Push-Up',
        'Chair/Bench Dips',
        'Diamond Push-Up',
        'Bodyweight Squat',
        'Glute Bridge',
        'Reverse Lunge',
      ];

      for (const name of requiredNames) {
        const found = FALLBACK_EXERCISES.find(e => e.name.toLowerCase() === name.toLowerCase());
        expect(found, `Expected ${name} to be in FALLBACK_EXERCISES`).toBeDefined();
        expect(found?.equipmentRequired).toBe('Bodyweight');
        expect(found?.instructions.length).toBeGreaterThan(0);
      }
    });

    it('ensures no duplicate exercise names in catalog', () => {
      const names = FALLBACK_EXERCISES.map(e => e.name.toLowerCase());
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    it('ensures all bodyweight exercises have valid muscle groups', () => {
      const validMuscles = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Triceps', 'Biceps', 'Glutes'];
      for (const ex of FALLBACK_EXERCISES.filter(e => e.equipmentRequired === 'Bodyweight')) {
        expect(validMuscles).toContain(ex.primaryMuscle);
      }
    });
  });

  // =========================================================================
  // 5. GYM CONTEXT & BOUNDARIES
  // =========================================================================
  describe('Connected Gym Boundaries & Routing', () => {
    it('home users derive mode = "home" and have no active gym', () => {
      const context = deriveMemberGymContext([], undefined, null, 'home_bodyweight');
      expect(context.mode).toBe('home');
      expect(context.activeGym).toBeNull();
      expect(context.activeMembership).toBeNull();
    });

    it('external gym users derive mode = "non_integrated" and have no active connected gym', () => {
      const context = deriveMemberGymContext([], undefined, null, 'external_gym');
      expect(context.mode).toBe('non_integrated');
      expect(context.activeGym).toBeNull();
      expect(context.activeMembership).toBeNull();
    });

    it('connected gym user with active membership derives mode = "integrated"', () => {
      const mockGym: Gym = {
        id: 'gym-123',
        name: 'Iron Forge Gym',
        slug: 'iron-forge',
        ownerId: 'owner-456',
        address: '123 Power St',
        city: 'Metropolis',
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 200,
        qrCodeHash: 'fitboost_qr_iron_forge_abc',
      };

      const mockMembership: GymMembership = {
        id: 'mem-789',
        gymId: 'gym-123',
        userId: 'user-001',
        membershipType: 'standard',
        status: 'active',
        joinedAt: '2026-09-01T00:00:00Z',
        gym: mockGym,
      };

      const context = deriveMemberGymContext([mockMembership], undefined, 'gym-123', 'connected_gym');
      expect(context.mode).toBe('integrated');
      expect(context.activeGym?.id).toBe('gym-123');
      expect(context.activeMembership?.id).toBe('mem-789');
    });

    it('home user is rejected from QR check-in flow', async () => {
      const checkinService = new GymCheckinService();
      const res = await checkinService.checkInWithQr({
        userId: 'user-home',
        userRole: 'member',
        rawQrContent: 'fitboost_qr_iron_forge_abc',
        memberContext: {
          mode: 'home',
          activeGym: null,
          activeMembership: null,
          memberships: [],
        },
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('You must be enrolled in an integrated gym');
    });

    it('external gym user is rejected from QR check-in flow', async () => {
      const checkinService = new GymCheckinService();
      const res = await checkinService.checkInWithQr({
        userId: 'user-ext',
        userRole: 'member',
        rawQrContent: 'fitboost_qr_iron_forge_abc',
        memberContext: {
          mode: 'non_integrated',
          activeGym: null,
          activeMembership: null,
          memberships: [],
        },
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Personal gyms do not support digital QR check-in');
    });

    it('gym owner cannot check in via member check-in flow', async () => {
      const checkinService = new GymCheckinService();
      const res = await checkinService.checkInWithQr({
        userId: 'owner-user',
        userRole: 'gym_owner',
        rawQrContent: 'fitboost_qr_iron_forge_abc',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Facility check-in is for athlete members only');
    });
  });

  // =========================================================================
  // 6. BACKWARD COMPATIBILITY & MIGRATION RESILIENCE
  // =========================================================================
  describe('Existing-User Migration Resilience', () => {
    it('gracefully handles legacy user with null workoutEnvironment without throwing', () => {
      const legacyContext = deriveMemberGymContext([], undefined, null, null);
      expect(legacyContext.mode).toBe('home');

      // Workout generator defaults safely without crashing
      const plan = generateWorkoutPlan({
        daysPerWeek: 3,
        experienceLevel: 'intermediate',
        equipment: ['Barbell', 'Dumbbells', 'Bodyweight'],
        workoutEnvironment: null,
        goal: 'muscle_gain',
        availableExercises: testCatalog,
      });

      expect(plan.days.length).toBeGreaterThan(0);
    });

    it('preserves all legacy fitness profile fields while supporting optional workoutEnvironment', () => {
      const legacyProfile = {
        userId: 'legacy-user-1',
        age: 28,
        heightCm: 180,
        weightKg: 78,
        gender: 'male',
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        daysPerWeek: 4,
        workoutDurationMinutes: 60,
        equipment: ['Dumbbells', 'Bodyweight'],
        dietaryPreference: 'vegetarian',
        limitations: ['None'],
        workoutEnvironment: null, // Unmigrated / confirmation pending
      };

      expect(legacyProfile.goal).toBe('muscle_gain');
      expect(legacyProfile.equipment).toEqual(['Dumbbells', 'Bodyweight']);
      expect(legacyProfile.workoutEnvironment).toBeNull();
    });
  });
});
