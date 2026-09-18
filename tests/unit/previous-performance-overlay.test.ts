import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workoutService } from '@/services/workout.service';
import { workoutRepository } from '@/repositories/workout.repository';
import { WorkoutSession } from '@/types/workout.types';

describe('Phase C9: Previous Performance Overlay Suite', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const exerciseBenchPressId = '00000000-0000-4000-a000-000000000001';
  const exerciseSquatId = '00000000-0000-4000-a000-000000000002';
  const exerciseDeadliftId = '00000000-0000-4000-a000-000000000003';

  // Completed session 5 days ago
  const olderSession: WorkoutSession = {
    id: '11111111-1111-4000-8000-000000000001',
    userId,
    name: 'Push Day A',
    status: 'completed',
    startedAt: '2026-09-10T10:00:00.000Z',
    completedAt: '2026-09-10T11:00:00.000Z',
    durationSeconds: 3600,
    exercises: [
      {
        id: '22222222-1111-4000-8000-000000000001',
        exerciseId: exerciseBenchPressId,
        exerciseName: 'Barbell Bench Press',
        primaryMuscle: 'Chest',
        orderIndex: 1,
        sets: [
          { setIndex: 1, weightKg: 80, reps: 8, completed: true },
          { setIndex: 2, weightKg: 80, reps: 8, completed: true },
        ],
      },
    ],
  };

  // More recent completed session 2 days ago with higher weight
  const newerSession: WorkoutSession = {
    id: '11111111-1111-4000-8000-000000000002',
    userId,
    name: 'Push Day B',
    status: 'completed',
    startedAt: '2026-09-15T10:00:00.000Z',
    completedAt: '2026-09-15T11:00:00.000Z',
    durationSeconds: 3600,
    exercises: [
      {
        id: '22222222-1111-4000-8000-000000000002',
        exerciseId: exerciseBenchPressId,
        exerciseName: 'Barbell Bench Press',
        primaryMuscle: 'Chest',
        orderIndex: 1,
        sets: [
          { setIndex: 1, weightKg: 82.5, reps: 8, completed: true },
          { setIndex: 2, weightKg: 82.5, reps: 8, rpe: 8.5, completed: true },
          { setIndex: 3, weightKg: 85, reps: 6, rpe: 9, completed: true },
        ],
      },
      {
        id: '22222222-1111-4000-8000-000000000003',
        exerciseId: exerciseSquatId,
        exerciseName: 'Barbell Back Squat',
        primaryMuscle: 'Legs',
        orderIndex: 2,
        sets: [
          { setIndex: 1, weightKg: 100, reps: 5, completed: true },
          { setIndex: 2, weightKg: 105, reps: 5, completed: false }, // uncompleted set
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns genuine previous performance from the most recent completed session', async () => {
    // History ordered descending by completed_at: newerSession, olderSession
    vi.spyOn(workoutRepository, 'fetchWorkoutHistory').mockResolvedValue([newerSession, olderSession]);

    const map = await workoutService.getPreviousPerformanceMap(userId);

    // Bench press should pick the last completed set of the NEWER session (85kg x 6, RPE 9)
    expect(map[exerciseBenchPressId]).toBeDefined();
    expect(map[exerciseBenchPressId].weightKg).toBe(85);
    expect(map[exerciseBenchPressId].reps).toBe(6);
    expect(map[exerciseBenchPressId].rpe).toBe(9);

    // Single exercise query
    const single = await workoutService.getPreviousPerformance(userId, exerciseBenchPressId);
    expect(single).toEqual({ weightKg: 85, reps: 6, rpe: 9 });
  });

  it('ignores uncompleted sets and picks the last completed set', async () => {
    vi.spyOn(workoutRepository, 'fetchWorkoutHistory').mockResolvedValue([newerSession]);

    const squatPerf = await workoutService.getPreviousPerformance(userId, exerciseSquatId);
    expect(squatPerf).not.toBeNull();
    // Set 2 was completed: false, so set 1 (100kg x 5) must be chosen
    expect(squatPerf?.weightKg).toBe(100);
    expect(squatPerf?.reps).toBe(5);
  });

  it('returns null/undefined when no history exists and NEVER fabricates fallback metrics', async () => {
    // Empty history
    vi.spyOn(workoutRepository, 'fetchWorkoutHistory').mockResolvedValue([]);

    const map = await workoutService.getPreviousPerformanceMap(userId);
    expect(map).toEqual({});

    // Specifically assert exercises that used to be in fallbackMap return null/undefined
    expect(map[exerciseBenchPressId]).toBeUndefined();
    expect(map['ex-bench-press']).toBeUndefined();
    expect(map['ex-squat']).toBeUndefined();
    expect(map[exerciseDeadliftId]).toBeUndefined();

    const deadliftPerf = await workoutService.getPreviousPerformance(userId, exerciseDeadliftId);
    expect(deadliftPerf).toBeNull();
  });

  it('matches deterministically by canonical exercise UUID', async () => {
    vi.spyOn(workoutRepository, 'fetchWorkoutHistory').mockResolvedValue([newerSession]);

    const bench = await workoutService.getPreviousPerformance(userId, exerciseBenchPressId);
    const squat = await workoutService.getPreviousPerformance(userId, exerciseSquatId);
    const deadlift = await workoutService.getPreviousPerformance(userId, exerciseDeadliftId);

    expect(bench).not.toBeNull();
    expect(squat).not.toBeNull();
    expect(deadlift).toBeNull(); // Never performed
  });

  it('handles repository errors gracefully without blocking or throwing', async () => {
    vi.spyOn(workoutRepository, 'fetchWorkoutHistory').mockRejectedValue(new Error('Network offline in gym'));

    const map = await workoutService.getPreviousPerformanceMap(userId);
    expect(map).toEqual({});

    const perf = await workoutService.getPreviousPerformance(userId, exerciseBenchPressId);
    expect(perf).toBeNull();
  });
});
