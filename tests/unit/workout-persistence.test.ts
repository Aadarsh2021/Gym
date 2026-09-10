import { describe, it, expect, beforeEach } from 'vitest';
import { calculateWorkoutSummary } from '@/domain/workout-tonnage';
import { workoutService } from '@/services/workout.service';
import { getTodaysScheduledWorkout } from '@/domain/scheduled-workout';
import { WorkoutSession, WorkoutPlan } from '@/types/workout.types';

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

describe('Workout Persistence & PR Detection Suite', () => {
  const userId = 'test-athlete-001';

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const baseSession: WorkoutSession = {
    id: 'test-session-101',
    userId,
    name: 'Push Hypertrophy',
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    durationSeconds: 2400,
    exercises: [
      {
        exerciseId: 'ex-bench-press',
        exerciseName: 'Barbell Bench Press',
        primaryMuscle: 'Chest',
        orderIndex: 1,
        sets: [
          { setIndex: 1, setType: 'normal', weightKg: 80, reps: 8, completed: true },
          { setIndex: 2, setType: 'normal', weightKg: 80, reps: 8, completed: true },
          { setIndex: 3, setType: 'normal', weightKg: 80, reps: 8, completed: true },
        ],
      },
    ],
  };

  it('detects NO new PR when lift is equal to or below existing personal record', () => {
    // Existing PR is 85kg x 8 reps -> e1RM = 85 * (1 + 8/30) = 107.67 kg
    const existingPrsMap = {
      'ex-bench-press': 107.67,
    };

    // Current session lifts 80kg x 8 reps -> e1RM = 80 * (1 + 8/30) = 101.33 kg
    const summary = calculateWorkoutSummary(baseSession, existingPrsMap);

    expect(summary.totalVolumeKg).toBe(80 * 8 * 3); // 1920 kg
    expect(summary.totalCompletedSets).toBe(3);
    expect(summary.newPersonalRecords.length).toBe(0);
  });

  it('detects ONE new PR when a higher 1RM is achieved', () => {
    // Existing PR is 85kg x 8 reps = 107.67 kg
    const existingPrsMap = {
      'ex-bench-press': 107.67,
    };

    const prSession: WorkoutSession = {
      ...baseSession,
      exercises: [
        {
          ...baseSession.exercises[0],
          sets: [
            { setIndex: 1, setType: 'normal', weightKg: 90, reps: 8, completed: true }, // e1RM = 114 kg
          ],
        },
      ],
    };

    const summary = calculateWorkoutSummary(prSession, existingPrsMap);

    expect(summary.newPersonalRecords.length).toBe(1);
    expect(summary.newPersonalRecords[0].exerciseId).toBe('ex-bench-press');
    expect(summary.newPersonalRecords[0].weightKg).toBe(90);
    expect(summary.newPersonalRecords[0].reps).toBe(8);
    expect(summary.newPersonalRecords[0].estimated1RM).toBeGreaterThan(107.67);
  });

  it('detects MULTIPLE new PRs across different exercises in the same session', () => {
    const multiPrSession: WorkoutSession = {
      ...baseSession,
      exercises: [
        {
          exerciseId: 'ex-bench-press',
          exerciseName: 'Barbell Bench Press',
          primaryMuscle: 'Chest',
          orderIndex: 1,
          sets: [{ setIndex: 1, setType: 'normal', weightKg: 100, reps: 5, completed: true }], // e1RM = 116.67
        },
        {
          exerciseId: 'ex-overhead-press',
          exerciseName: 'Overhead Press',
          primaryMuscle: 'Shoulders',
          orderIndex: 2,
          sets: [{ setIndex: 1, setType: 'normal', weightKg: 65, reps: 6, completed: true }], // e1RM = 78
        },
      ],
    };

    const existingPrsMap = {
      'ex-bench-press': 100,
      'ex-overhead-press': 60,
    };

    const summary = calculateWorkoutSummary(multiPrSession, existingPrsMap);

    expect(summary.newPersonalRecords.length).toBe(2);
    expect(summary.newPersonalRecords.map(p => p.exerciseId)).toEqual(['ex-bench-press', 'ex-overhead-press']);
  });

  it('ignores uncompleted and warmup sets during PR evaluation', () => {
    const sessionWithWarmups: WorkoutSession = {
      ...baseSession,
      exercises: [
        {
          exerciseId: 'ex-bench-press',
          exerciseName: 'Barbell Bench Press',
          primaryMuscle: 'Chest',
          orderIndex: 1,
          sets: [
            { setIndex: 1, setType: 'warmup', weightKg: 120, reps: 10, completed: true }, // Warmup must be ignored
            { setIndex: 2, setType: 'normal', weightKg: 130, reps: 10, completed: false }, // Uncompleted must be ignored
            { setIndex: 3, setType: 'normal', weightKg: 70, reps: 5, completed: true },
          ],
        },
      ],
    };

    const summary = calculateWorkoutSummary(sessionWithWarmups, { 'ex-bench-press': 80 });

    // Both completed warmup & normal sets count towards tonnage & completed sets, but warmup is excluded from PR
    expect(summary.totalCompletedSets).toBe(2);
    expect(summary.totalVolumeKg).toBe(120 * 10 + 70 * 5);
    expect(summary.newPersonalRecords.length).toBe(1);
    expect(summary.newPersonalRecords[0].weightKg).toBe(70);
  });

  it('end-to-end: finishing a workout updates history, streaks, coins, and dashboard schedule status', async () => {
    // 1. Initial history is empty
    const initialHistory = await workoutService.getWorkoutHistory(userId);
    // (mock fallback might return 1 mock item, but not our session)
    expect(initialHistory.find(s => s.id === baseSession.id)).toBeUndefined();

    // 2. Finalize workout
    const result = await workoutService.finishWorkoutSession(
      baseSession,
      'idemp-key-test-1',
      'exhausting',
      'Felt strong today'
    );

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('success');
    expect(result.data.coins_earned).toBe(15);

    // 3. Verify history now contains the completed session
    const updatedHistory = await workoutService.getWorkoutHistory(userId);
    const persisted = updatedHistory.find(s => s.id === baseSession.id);
    expect(persisted).toBeDefined();
    expect(persisted?.status).toBe('completed');
    expect(persisted?.sessionRating).toBe('exhausting');
    expect(persisted?.notes).toBe('Felt strong today');

    // 4. Verify scheduled workout engine transitions to completed_today
    const activePlan: WorkoutPlan = {
      id: 'plan-1',
      userId,
      name: 'PPL',
      splitType: 'PPL',
      isActive: true,
      days: [
        {
          id: 'day-1',
          planId: 'plan-1',
          dayNumber: 1,
          name: 'Push Day',
          targetMuscleGroups: ['Chest', 'Shoulders', 'Triceps'],
          scheduledDaysOfWeek: [new Date().getDay()], // today is scheduled
          exercises: [],
        },
      ],
    };

    const schedule = getTodaysScheduledWorkout({
      activePlan,
      currentDate: new Date(),
      completedSessions: updatedHistory,
    });

    expect(schedule.status).toBe('completed_today');
    expect(schedule.message).toContain('complete');
  });
});
