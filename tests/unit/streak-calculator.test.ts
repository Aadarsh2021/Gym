import { describe, it, expect } from 'vitest';
import { calculateUpdatedStreak, canUseStreakRevive } from '@/domain/streak-calculator';

describe('Streak Calculation Engine', () => {
  it('should initialize streak to 1 on first ever workout', () => {
    const result = calculateUpdatedStreak(
      { currentStreak: 0, longestStreak: 0, lastActivityDate: null },
      '2026-09-10'
    );
    expect(result.newCurrentStreak).toBe(1);
    expect(result.newLongestStreak).toBe(1);
  });

  it('should not double-increment streak if multiple workouts logged on same calendar day', () => {
    const result = calculateUpdatedStreak(
      { currentStreak: 5, longestStreak: 10, lastActivityDate: '2026-09-10' },
      '2026-09-10'
    );
    expect(result.newCurrentStreak).toBe(5);
    expect(result.newLongestStreak).toBe(10);
  });

  it('should increment streak on consecutive calendar day', () => {
    const result = calculateUpdatedStreak(
      { currentStreak: 6, longestStreak: 6, lastActivityDate: '2026-09-09' },
      '2026-09-10'
    );
    expect(result.newCurrentStreak).toBe(7);
    expect(result.newLongestStreak).toBe(7);
  });

  it('should reset streak to 1 if multiple days were missed without revive', () => {
    const result = calculateUpdatedStreak(
      { currentStreak: 12, longestStreak: 12, lastActivityDate: '2026-09-05' },
      '2026-09-10'
    );
    expect(result.newCurrentStreak).toBe(1);
    expect(result.newLongestStreak).toBe(12); // Longest streak preserved
  });

  it('should enforce maximum 3 revives per calendar month', () => {
    expect(canUseStreakRevive(0)).toBe(true);
    expect(canUseStreakRevive(1)).toBe(true);
    expect(canUseStreakRevive(2)).toBe(true);
    expect(canUseStreakRevive(3)).toBe(false);
    expect(canUseStreakRevive(4)).toBe(false);
  });
});
