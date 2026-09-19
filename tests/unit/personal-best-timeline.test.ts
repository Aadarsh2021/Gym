import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workoutRepository } from '@/repositories/workout.repository';
import { workoutService } from '@/services/workout.service';
import { PRHistoryEvent } from '@/types/workout.types';
import { platform } from '@/platform';

describe('Personal Best Timeline Unit Tests', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const exercise1 = '11111111-1111-1111-1111-111111111111';
  const exercise2 = '22222222-2222-2222-2222-222222222222';

  const mockPRHistory: PRHistoryEvent[] = [
    {
      id: 'pr-h-3',
      userId,
      exerciseId: exercise1,
      exerciseName: 'Barbell Bench Press',
      weightKg: 105,
      reps: 5,
      estimatedOneRepMax: 122.5,
      achievedAt: '2026-09-15T10:00:00Z',
      sessionId: 'sess-3',
    },
    {
      id: 'pr-h-2',
      userId,
      exerciseId: exercise2,
      exerciseName: 'Barbell Back Squat',
      weightKg: 140,
      reps: 3,
      estimatedOneRepMax: 154,
      achievedAt: '2026-09-12T10:00:00Z',
      sessionId: 'sess-2',
    },
    {
      id: 'pr-h-1',
      userId,
      exerciseId: exercise1,
      exerciseName: 'Barbell Bench Press',
      weightKg: 100,
      reps: 5,
      estimatedOneRepMax: 116.67,
      achievedAt: '2026-09-08T10:00:00Z',
      sessionId: 'sess-1',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches PR history through workoutService and workoutRepository fallback cleanly', async () => {
    vi.spyOn(platform.storage, 'getItem').mockImplementation((key: string) => {
      if (key === `pr_history_${userId}`) {
        return JSON.stringify(mockPRHistory);
      }
      return null;
    });

    const result = await workoutService.getPRHistory(userId);
    expect(result).toHaveLength(3);
    expect(result[0].exerciseName).toBe('Barbell Bench Press');
    expect(result[0].weightKg).toBe(105);
    expect(result[1].exerciseName).toBe('Barbell Back Squat');
  });

  it('filters PR history by exerciseId when provided', async () => {
    vi.spyOn(platform.storage, 'getItem').mockImplementation((key: string) => {
      if (key === `pr_history_${userId}`) {
        return JSON.stringify(mockPRHistory);
      }
      return null;
    });

    const benchOnly = await workoutService.getPRHistory(userId, exercise1);
    expect(benchOnly).toHaveLength(2);
    expect(benchOnly.every(pr => pr.exerciseId === exercise1)).toBe(true);

    const squatOnly = await workoutService.getPRHistory(userId, exercise2);
    expect(squatOnly).toHaveLength(1);
    expect(squatOnly[0].weightKg).toBe(140);
  });

  it('respects limit parameter', async () => {
    vi.spyOn(platform.storage, 'getItem').mockImplementation((key: string) => {
      if (key === `pr_history_${userId}`) {
        return JSON.stringify(mockPRHistory);
      }
      return null;
    });

    const top1 = await workoutService.getPRHistory(userId, undefined, 1);
    expect(top1).toHaveLength(1);
    expect(top1[0].id).toBe('pr-h-3');
  });

  it('handles empty or corrupted storage gracefully without crashing', async () => {
    vi.spyOn(platform.storage, 'getItem').mockImplementation(() => 'corrupted{json');

    const result = await workoutService.getPRHistory(userId);
    expect(result).toEqual([]);

    vi.spyOn(platform.storage, 'getItem').mockImplementation(() => null);
    const emptyResult = await workoutService.getPRHistory(userId);
    expect(emptyResult).toEqual([]);
  });

  it('never fabricates records if no events exist', async () => {
    vi.spyOn(platform.storage, 'getItem').mockReturnValue(null);

    const result = await workoutRepository.fetchPRHistory('unknown-user-id');
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });
});
