import { describe, it, expect, vi } from 'vitest';
import {
  DailyMissionType,
  getMissionMeta,
  getMissionProgressPercent,
  isWithinGracePeriod,
} from '@/domain/daily-mission';
import { dailyMissionRepository, DailyMissionRepository } from '@/repositories/daily-mission.repository';
import { DailyMissionService } from '@/services/daily-mission.service';

describe('Phase C10-B: Daily Mission Unit & Domain Suite', () => {
  describe('1. Domain Helpers & Presentation Metadata', () => {
    it('provides accurate metadata and badges for all mission types', () => {
      const workoutMeta = getMissionMeta('complete_workout');
      expect(workoutMeta.badge).toBe('Training');
      expect(workoutMeta.icon).toBe('🏋️');

      const proteinMeta = getMissionMeta('hit_protein');
      expect(proteinMeta.badge).toBe('Nutrition');
      expect(proteinMeta.icon).toBe('🥩');

      const streakMeta = getMissionMeta('maintain_streak');
      expect(streakMeta.badge).toBe('Consistency');
      expect(streakMeta.icon).toBe('🔥');
    });

    it('calculates progress percentage accurately and clamps between 0 and 100', () => {
      expect(getMissionProgressPercent(0, 1)).toBe(0);
      expect(getMissionProgressPercent(1, 1)).toBe(100);
      expect(getMissionProgressPercent(2, 1)).toBe(100); // capped at 100
      expect(getMissionProgressPercent(75, 150)).toBe(50);
      expect(getMissionProgressPercent(0, 0)).toBe(0); // division by zero safety
    });
  });

  describe('2. Timezone & 12-Hour Grace Period Math (Correction 1 & 2)', () => {
    it('allows claiming during active mission date D', () => {
      const missionDate = '2026-09-19';
      // Same day 15:00
      const current = new Date('2026-09-19T15:00:00Z');
      expect(isWithinGracePeriod(missionDate, 'UTC', current)).toBe(true);
    });

    it('allows claiming during D+1 morning before 12:00 local time (12-hour grace period)', () => {
      const missionDate = '2026-09-19';
      // D+1 at 09:30 AM
      const nextMorning = new Date('2026-09-20T09:30:00Z');
      expect(isWithinGracePeriod(missionDate, 'UTC', nextMorning)).toBe(true);
    });

    it('allows claiming exactly up to D+1 11:59:59 local time', () => {
      const missionDate = '2026-09-19';
      const justBeforeNoon = new Date('2026-09-20T11:59:59Z');
      expect(isWithinGracePeriod(missionDate, 'UTC', justBeforeNoon)).toBe(true);
    });

    it('rejects claiming after D+1 12:00 local time (grace period expired)', () => {
      const missionDate = '2026-09-19';
      // D+1 at 12:01 PM
      const afterNoon = new Date('2026-09-20T12:01:00Z');
      expect(isWithinGracePeriod(missionDate, 'UTC', afterNoon)).toBe(false);
    });

    it('rejects claiming on D+2', () => {
      const missionDate = '2026-09-19';
      const twoDaysLater = new Date('2026-09-21T08:00:00Z');
      expect(isWithinGracePeriod(missionDate, 'UTC', twoDaysLater)).toBe(false);
    });
  });

  describe('3. Repository & Service Layer Contracts', () => {
    it('dailyMissionRepository returns a valid mission contract in offline mode', () => {
      const repo = new DailyMissionRepository();
      const mission = repo.getLocalFallbackMission();

      expect(mission).not.toBeNull();
      expect(mission?.coinReward).toBe(15);
      expect(mission?.isCompleted).toBe(false);
      expect(['complete_workout', 'hit_protein', 'maintain_streak']).toContain(mission?.missionType);
    });

    it('dailyMissionService claims mission with unique idempotency key', async () => {
      const service = new DailyMissionService();
      vi.spyOn(dailyMissionRepository, 'claimDailyMission').mockResolvedValueOnce({
        status: 'success',
        missionId: 'mock-mission-id',
        coinsAwarded: 15,
        completedAt: new Date().toISOString(),
      });

      const res = await service.claimMission('mock-mission-id');

      expect(res.success).toBe(true);
      expect(res.result?.coinsAwarded).toBe(15);
    });
  });

  describe('4. Deterministic Context Branching Simulation', () => {
    // Pure reproduction of PostgreSQL deterministic hash logic
    function simulateDeterministicAssignment(params: {
      userId: string;
      missionDate: string;
      isTrainingDay: boolean;
      isRestDay: boolean;
      hasNutrition: boolean;
    }): DailyMissionType {
      const { isTrainingDay, isRestDay, hasNutrition } = params;

      // Mock deterministic hash [0, 99]
      // using simple char code sum
      const str = `${params.userId}:${params.missionDate}`;
      const hash = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 100;

      if (isTrainingDay) {
        if (hasNutrition) {
          return hash < 60 ? 'complete_workout' : 'hit_protein';
        }
        return 'complete_workout';
      }

      if (isRestDay) {
        // Rest Day: NEVER complete_workout
        if (hasNutrition) {
          return hash < 50 ? 'maintain_streak' : 'hit_protein';
        }
        return 'maintain_streak';
      }

      // No plan
      if (hasNutrition) {
        return hash < 50 ? 'complete_workout' : 'maintain_streak';
      }
      return 'maintain_streak';
    }

    it('NEVER assigns complete_workout on a Rest Day', () => {
      for (let i = 0; i < 50; i++) {
        const typeWithNutrition = simulateDeterministicAssignment({
          userId: `user-${i}`,
          missionDate: '2026-09-19',
          isTrainingDay: false,
          isRestDay: true,
          hasNutrition: true,
        });
        expect(typeWithNutrition).not.toBe('complete_workout');
        expect(['maintain_streak', 'hit_protein']).toContain(typeWithNutrition);

        const typeWithoutNutrition = simulateDeterministicAssignment({
          userId: `user-${i}`,
          missionDate: '2026-09-19',
          isTrainingDay: false,
          isRestDay: true,
          hasNutrition: false,
        });
        expect(typeWithoutNutrition).toBe('maintain_streak');
      }
    });

    it('assigns complete_workout unconditionally on Training Day if nutrition profile is absent', () => {
      for (let i = 0; i < 20; i++) {
        const type = simulateDeterministicAssignment({
          userId: `user-${i}`,
          missionDate: '2026-09-19',
          isTrainingDay: true,
          isRestDay: false,
          hasNutrition: false,
        });
        expect(type).toBe('complete_workout');
      }
    });

    it('assigns maintain_streak unconditionally when no plan exists and nutrition profile is absent', () => {
      for (let i = 0; i < 20; i++) {
        const type = simulateDeterministicAssignment({
          userId: `user-${i}`,
          missionDate: '2026-09-19',
          isTrainingDay: false,
          isRestDay: false,
          hasNutrition: false,
        });
        expect(type).toBe('maintain_streak');
      }
    });

    it('assignment is strictly deterministic for identical user and date', () => {
      const call1 = simulateDeterministicAssignment({
        userId: 'consistent-user-uuid',
        missionDate: '2026-09-19',
        isTrainingDay: true,
        isRestDay: false,
        hasNutrition: true,
      });

      const call2 = simulateDeterministicAssignment({
        userId: 'consistent-user-uuid',
        missionDate: '2026-09-19',
        isTrainingDay: true,
        isRestDay: false,
        hasNutrition: true,
      });

      expect(call1).toBe(call2);
    });
  });
});
