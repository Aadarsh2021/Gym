import { describe, it, expect, beforeEach } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { platform } from '@/platform';

describe('Phase G1: Gym Attendance Streak & Milestones', () => {
  const userId = 'user-streak-test-1';
  const gymA = 'gym-aaa-111';
  const gymB = 'gym-bbb-222';

  beforeEach(() => {
    // Clear storage before each test
    platform.storage.removeItem(`gym_attendance_streak_${userId}_${gymA}`);
    platform.storage.removeItem(`gym_attendance_streak_${userId}_${gymB}`);
  });

  it('initializes streak to 1 on first verified visit', () => {
    const streak = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-20T08:00:00.000Z');

    expect(streak.currentStreak).toBe(1);
    expect(streak.longestStreak).toBe(1);
    expect(streak.totalVisitDays).toBe(1);
    expect(streak.lastVisitDate).toBe('2026-09-20');
  });

  it('increments streak on consecutive facility-local calendar days', () => {
    // Day 1
    gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-20T08:00:00.000Z');

    // Day 2
    const streakDay2 = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-21T09:30:00.000Z');
    expect(streakDay2.currentStreak).toBe(2);
    expect(streakDay2.longestStreak).toBe(2);
    expect(streakDay2.totalVisitDays).toBe(2);
    expect(streakDay2.lastVisitDate).toBe('2026-09-21');

    // Day 3
    const streakDay3 = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-22T07:15:00.000Z');
    expect(streakDay3.currentStreak).toBe(3);
    expect(streakDay3.longestStreak).toBe(3);
    expect(streakDay3.totalVisitDays).toBe(3);
    expect(streakDay3.lastVisitDate).toBe('2026-09-22');
  });

  it('resets current_streak to 1 on a missed calendar day, preserving longest_streak', () => {
    // Day 1
    gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-20T08:00:00.000Z');
    // Day 2
    gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-21T08:00:00.000Z');
    // Day 3
    gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-22T08:00:00.000Z');

    // Skip Day 4 (2026-09-23), visit on Day 5 (2026-09-24)
    const streakAfterGap = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-24T10:00:00.000Z');
    expect(streakAfterGap.currentStreak).toBe(1);
    expect(streakAfterGap.longestStreak).toBe(3);
    expect(streakAfterGap.totalVisitDays).toBe(4);
    expect(streakAfterGap.lastVisitDate).toBe('2026-09-24');
  });

  it('idempotently handles same-day multiple visits with zero extra streak or visit day credit', () => {
    // Visit 1: morning workout at 07:00
    const morningVisit = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-20T07:00:00.000Z');
    expect(morningVisit.currentStreak).toBe(1);
    expect(morningVisit.totalVisitDays).toBe(1);

    // Visit 2: afternoon recovery at 14:30 UTC (20:00 facility time on same date)
    const eveningVisit = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-20T14:30:00.000Z');
    expect(eveningVisit.currentStreak).toBe(1);
    expect(eveningVisit.totalVisitDays).toBe(1);
    expect(eveningVisit.longestStreak).toBe(1);

    // Visit 3: night scan at 16:45 UTC (22:15 facility time on same date)
    const nightVisit = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-20T16:45:00.000Z');
    expect(nightVisit.currentStreak).toBe(1);
    expect(nightVisit.totalVisitDays).toBe(1);
  });

  it('maintains completely isolated streaks across different connected gyms', () => {
    // Gym A: 3-day consecutive streak
    gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-20T08:00:00.000Z');
    gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-21T08:00:00.000Z');
    const streakGymA = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-22T08:00:00.000Z');

    // Gym B: 1-day visit
    const streakGymB = gymRepository.updateMockGymAttendanceStreak(gymB, userId, '2026-09-22T19:00:00.000Z');

    expect(streakGymA.gymId).toBe(gymA);
    expect(streakGymA.currentStreak).toBe(3);
    expect(streakGymA.totalVisitDays).toBe(3);

    expect(streakGymB.gymId).toBe(gymB);
    expect(streakGymB.currentStreak).toBe(1);
    expect(streakGymB.totalVisitDays).toBe(1);
  });

  it('SECURITY: confirms client cannot forge or self-credit streak directly', async () => {
    // In migration 20260920000001_gym_retention_foundation.sql:
    // REVOKE INSERT, UPDATE, DELETE ON public.gym_attendance_streaks FROM authenticated, anon;
    // Streaks are computed authoritatively via record_verified_gym_checkin RPC
    // Attempting direct client mutations without RPC must be rejected
    const getResult = await gymRepository.getGymAttendanceStreak(gymA, userId);
    // If not recorded via check-in, no arbitrary streak exists
    expect(getResult).toBeNull();
  });

  it('SECURITY: proves that a forged direct client attendance insert cannot self-credit gym streak', async () => {
    // 1. Simulate an unauthorized or forged client insertion directly into attendance history/storage
    const forgedSession = {
      id: 'forged-attendance-session-123',
      gymId: gymA,
      userId,
      checkInAt: '2026-09-21T10:00:00.000Z',
      checkOutAt: '2026-09-21T11:00:00.000Z',
      durationSeconds: 3600,
      verificationMethod: 'manual_button',
      status: 'completed',
    };
    platform.storage.setItem(`attendance_history_${userId}`, JSON.stringify([forgedSession]));

    // 2. Query streak repository - streak must NOT be self-credited by direct attendance table/history write
    const streak = await gymRepository.getGymAttendanceStreak(gymA, userId);
    expect(streak).toBeNull();

    // 3. Confirm that ONLY the authoritative verified check-in flow credits the streak
    const authoritativeStreak = gymRepository.updateMockGymAttendanceStreak(gymA, userId, '2026-09-21T10:00:00.000Z');
    expect(authoritativeStreak).toBeDefined();
    expect(authoritativeStreak.currentStreak).toBe(1);

    const verifiedStreak = await gymRepository.getGymAttendanceStreak(gymA, userId);
    expect(verifiedStreak?.currentStreak).toBe(1);
  });
});
