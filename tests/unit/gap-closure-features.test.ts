import { describe, it, expect } from 'vitest';
import { generateWeeklyMealPlan } from '@/domain/weekly-meal-planner';
import { haversineDistanceMeters, isWithinGymRadius } from '@/utils/geo';
import { generateQuickSession } from '@/domain/quick-workout';
import { hasCompletedCoreExercise } from '@/domain/streak-calculator';
import { WorkoutPlanDay, WorkoutSessionExercise, WorkoutSession } from '@/types/workout.types';
import { streakService } from '@/services/streak.service';
import { workoutService } from '@/services/workout.service';

// In-memory localStorage mock for node test environment
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => { storage[key] = String(val); },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => {
    Object.keys(storage).forEach(k => delete storage[k]);
  },
};
(globalThis as any).localStorage = mockLocalStorage;

describe('FitSphere V1 Gap Closure Features Suite', () => {
  describe('7-Day Rotating Weekly Meal Planner (Phase 5)', () => {
    it('generates a 7-day schedule with exactly 7 consecutive days', () => {
      const plan = generateWeeklyMealPlan({
        userId: 'user-test-1',
        targetCalories: 2200,
        targetProteinG: 140,
        dietaryPreference: 'vegetarian',
      });

      expect(plan.days).toHaveLength(7);
      expect(plan.days.map(d => d.dayName)).toEqual([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ]);
    });

    it('respects dietary preferences and excludes non-veg foods for vegetarian profile', () => {
      const plan = generateWeeklyMealPlan({
        userId: 'user-test-2',
        targetCalories: 2000,
        targetProteinG: 130,
        dietaryPreference: 'vegetarian',
      });

      for (const day of plan.days) {
        for (const item of day.items) {
          expect(item.food?.dietaryType).not.toBe('non_veg');
          expect(item.foodName.toLowerCase()).not.toContain('chicken');
        }
      }
    });

    it('accurately computes daily macro totals and weekly averages', () => {
      const plan = generateWeeklyMealPlan({
        userId: 'user-test-3',
        targetCalories: 2400,
        targetProteinG: 160,
        dietaryPreference: 'non_veg',
      });

      expect(plan.averageDailyCalories).toBeGreaterThan(1500);
      expect(plan.averageDailyProteinG).toBeGreaterThan(80);

      for (const day of plan.days) {
        const sumCalories = day.items.reduce((s, it) => s + it.calculatedCalories, 0);
        expect(day.totalCalories).toBe(sumCalories);
        expect(day.items.length).toBeGreaterThanOrEqual(4); // 4 meal slots
      }
    });
  });

  describe('Gym Location Geofencing & Haversine Distance (Phase 4)', () => {
    it('calculates 0 meters for identical coordinates', () => {
      const dist = haversineDistanceMeters(28.6139, 77.2090, 28.6139, 77.2090);
      expect(dist).toBe(0);
    });

    it('detects proximity within specified radius', () => {
      // 28.6139, 77.2090 to 28.6140, 77.2091 is ~15-20 meters
      const res = isWithinGymRadius(28.6139, 77.2090, 28.6140, 77.2091, 100);
      expect(res.isNearby).toBe(true);
      expect(res.distanceMeters).toBeLessThan(50);
    });

    it('flags location outside geofenced radius', () => {
      // Connaught Place to Gurgaon (~25km away)
      const res = isWithinGymRadius(28.6304, 77.2177, 28.4595, 77.0266, 200);
      expect(res.isNearby).toBe(false);
      expect(res.distanceMeters).toBeGreaterThan(20000);
    });
  });

  describe('Short on Time (15m) Mode (Phase 2)', () => {
    it('creates a trimmed quick workout with at most 3 exercises and 2 sets max', () => {
      const dummyDay: WorkoutPlanDay = {
        id: 'day-1',
        planId: 'plan-1',
        dayNumber: 1,
        scheduledDaysOfWeek: [1],
        name: 'Full Chest & Back',
        targetMuscleGroups: ['Chest', 'Back'],
        exercises: [
          {
            id: 'e1',
            planDayId: 'day-1',
            exerciseId: 'bench-press',
            orderIndex: 0,
            targetSets: 4,
            targetRepsMin: 8,
            targetRepsMax: 10,
            restSeconds: 90,
            isCore: true,
            exercise: {
              id: 'bench-press',
              name: 'Barbell Bench Press',
              difficulty: 'intermediate',
              equipmentRequired: 'Barbell',
              movementPattern: 'Horizontal Push',
              primaryMuscle: 'Chest',
              secondaryMuscles: ['Triceps'],
              instructions: [],
              isSystem: true,
            },
          },
          {
            id: 'e2',
            planDayId: 'day-1',
            exerciseId: 'incline-dumbbell-press',
            orderIndex: 1,
            targetSets: 3,
            targetRepsMin: 10,
            targetRepsMax: 12,
            restSeconds: 60,
            isCore: false,
            exercise: {
              id: 'incline-dumbbell-press',
              name: 'Incline Dumbbell Press',
              difficulty: 'intermediate',
              equipmentRequired: 'Dumbbells',
              movementPattern: 'Incline Push',
              primaryMuscle: 'Chest',
              secondaryMuscles: [],
              instructions: [],
              isSystem: true,
            },
          },
          {
            id: 'e3',
            planDayId: 'day-1',
            exerciseId: 'cable-fly',
            orderIndex: 2,
            targetSets: 3,
            targetRepsMin: 12,
            targetRepsMax: 15,
            restSeconds: 45,
            isCore: false,
            exercise: {
              id: 'cable-fly',
              name: 'Cable Chest Fly',
              difficulty: 'beginner',
              equipmentRequired: 'Cable',
              movementPattern: 'Isolation',
              primaryMuscle: 'Chest',
              secondaryMuscles: [],
              instructions: [],
              isSystem: true,
            },
          },
          {
            id: 'e4',
            planDayId: 'day-1',
            exerciseId: 'push-up',
            orderIndex: 3,
            targetSets: 3,
            targetRepsMin: 15,
            targetRepsMax: 20,
            restSeconds: 45,
            isCore: false,
            exercise: {
              id: 'push-up',
              name: 'Push Up',
              difficulty: 'beginner',
              equipmentRequired: 'Bodyweight',
              movementPattern: 'Horizontal Push',
              primaryMuscle: 'Chest',
              secondaryMuscles: [],
              instructions: [],
              isSystem: true,
            },
          },
        ],
      };

      const quick = generateQuickSession(dummyDay);
      expect(quick.exercises.length).toBeLessThanOrEqual(3);
      for (const ex of quick.exercises) {
        expect(ex.targetSets).toBeLessThanOrEqual(2);
      }
      expect(quick.exercises[0].exerciseId).toBe('bench-press'); // Core compound prioritized
    });
  });

  describe('Core Exercise Enforcement (Phase 2)', () => {
    it('detects when core exercise was completed with logged sets', () => {
      const exercises: WorkoutSessionExercise[] = [
        {
          id: 'se-1',
          exerciseId: 'squat',
          exerciseName: 'Barbell Squat',
          primaryMuscle: 'Legs',
          orderIndex: 0,
          isCore: true,
          sets: [
            { setIndex: 1, weightKg: 100, reps: 5, completed: true },
          ],
        },
        {
          id: 'se-2',
          exerciseId: 'leg-curl',
          exerciseName: 'Leg Curl',
          primaryMuscle: 'Legs',
          orderIndex: 1,
          isCore: false,
          sets: [
            { setIndex: 1, weightKg: 40, reps: 12, completed: true },
          ],
        },
      ];

      expect(hasCompletedCoreExercise(exercises)).toBe(true);
    });

    it('returns false when no core exercises had completed sets', () => {
      const exercises: WorkoutSessionExercise[] = [
        {
          id: 'se-1',
          exerciseId: 'bench-press',
          exerciseName: 'Bench Press',
          primaryMuscle: 'Chest',
          orderIndex: 0,
          isCore: true,
          sets: [
            { setIndex: 1, weightKg: 100, reps: 0, completed: false },
          ],
        },
        {
          id: 'se-2',
          exerciseId: 'bicep-curl',
          exerciseName: 'Bicep Curl',
          primaryMuscle: 'Biceps',
          orderIndex: 1,
          isCore: false,
          sets: [
            { setIndex: 1, weightKg: 15, reps: 10, completed: true },
          ],
        },
      ];

      expect(hasCompletedCoreExercise(exercises)).toBe(false);
    });

    it('end-to-end: workout finalized with only optional exercise completed does NOT count towards streak', async () => {
      const testUserId = `core-streak-test-${Date.now()}`;
      // Initialize streak at 3 days
      localStorage.setItem(`streak_${testUserId}`, JSON.stringify({
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: '2026-09-08',
      }));

      const sessionWithOnlyOptionalCompleted: WorkoutSession = {
        id: `sess-${Date.now()}-opt`,
        userId: testUserId,
        name: 'Upper Body Split',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        durationSeconds: 1800,
        gymVerified: true,
        exercises: [
          {
            exerciseId: 'core-barbell-bench',
            exerciseName: 'Barbell Bench Press',
            primaryMuscle: 'Chest',
            orderIndex: 1,
            isCore: true,
            sets: [
              { setIndex: 1, weightKg: 80, reps: 8, completed: false }, // Core NOT completed
            ],
          },
          {
            exerciseId: 'opt-cable-fly',
            exerciseName: 'Cable Fly',
            primaryMuscle: 'Chest',
            orderIndex: 2,
            isCore: false,
            sets: [
              { setIndex: 1, weightKg: 20, reps: 15, completed: true }, // Optional completed
            ],
          },
        ],
      };

      const result = await workoutService.finishWorkoutSession(
        sessionWithOnlyOptionalCompleted,
        `idemp-${Date.now()}-opt`,
        'normal'
      );

      expect(result.success).toBe(true);
      expect(result.data.core_completed).toBe(false);
      expect(result.data.streak_counted).toBe(false);
      expect(result.data.streak_count).toBe(3); // Streak did NOT advance
      expect(result.data.gym_verified).toBe(true);
    });

    it('end-to-end: workout finalized with core exercise completed DOES count towards streak', async () => {
      const testUserId = `core-streak-test-pass-${Date.now()}`;
      // Initialize streak at 3 days
      localStorage.setItem(`streak_${testUserId}`, JSON.stringify({
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: '2026-09-08',
      }));

      const sessionWithCoreCompleted: WorkoutSession = {
        id: `sess-${Date.now()}-core`,
        userId: testUserId,
        name: 'Upper Body Split',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        durationSeconds: 2400,
        gymVerified: true,
        exercises: [
          {
            exerciseId: 'core-barbell-bench',
            exerciseName: 'Barbell Bench Press',
            primaryMuscle: 'Chest',
            orderIndex: 1,
            isCore: true,
            sets: [
              { setIndex: 1, weightKg: 80, reps: 8, completed: true }, // Core completed!
            ],
          },
          {
            exerciseId: 'opt-cable-fly',
            exerciseName: 'Cable Fly',
            primaryMuscle: 'Chest',
            orderIndex: 2,
            isCore: false,
            sets: [
              { setIndex: 1, weightKg: 20, reps: 15, completed: false },
            ],
          },
        ],
      };

      const result = await workoutService.finishWorkoutSession(
        sessionWithCoreCompleted,
        `idemp-${Date.now()}-core`,
        'exhausting'
      );

      expect(result.success).toBe(true);
      expect(result.data.core_completed).toBe(true);
      expect(result.data.streak_counted).toBe(true);
      expect(result.data.streak_count).toBe(4); // Streak advanced from 3 to 4!
      expect(result.data.gym_verified).toBe(true);
    });
  });

  describe('Streak Revives Quota (Phase 8)', () => {
    it('enforces 3 free revives per month, strictly transitioning 3 -> 2 -> 1 -> 0 then failing with quota exceeded', async () => {
      const testUserId = `revive-test-user-${Date.now()}`;
      // Initial status: 0 used, 3 remaining
      let status = await streakService.getMonthlyRevivesStatus(testUserId);
      expect(status.remaining).toBe(3);

      // Use 1: remaining = 2
      const res1 = await streakService.useRevive('k1', testUserId);
      expect(res1.success).toBe(true);
      expect(res1.revivesRemaining).toBe(2);

      // Use 2: remaining = 1
      const res2 = await streakService.useRevive('k2', testUserId);
      expect(res2.success).toBe(true);
      expect(res2.revivesRemaining).toBe(1);

      // Use 3: remaining = 0
      const res3 = await streakService.useRevive('k3', testUserId);
      expect(res3.success).toBe(true);
      expect(res3.revivesRemaining).toBe(0);

      // Check status: 3 used, 0 remaining
      status = await streakService.getMonthlyRevivesStatus(testUserId);
      expect(status.used).toBe(3);
      expect(status.remaining).toBe(0);

      // Attempt 4th revive: fails safely with quota exceeded and paid add-on requirement
      const res4 = await streakService.useRevive('k4', testUserId);
      expect(res4.success).toBe(false);
      expect(res4.isQuotaExceeded).toBe(true);
      expect(res4.error).toContain('Monthly revive limit reached');
      expect(res4.revivesRemaining).toBe(0);
    });

    it('resets quota when calendar month changes', async () => {
      const testUserId = `revive-test-user-month-${Date.now()}`;
      // Simulate 3 revives used in previous month '2026-08'
      localStorage.setItem(`streak_revives_${testUserId}`, JSON.stringify({ month: '2026-08', used: 3 }));

      // Accessing in current month resets used to 0 and remaining to 3
      const status = await streakService.getMonthlyRevivesStatus(testUserId);
      expect(status.used).toBe(0);
      expect(status.remaining).toBe(3);
    });
  });
});
