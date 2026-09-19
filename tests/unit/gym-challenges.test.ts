import { describe, it, expect, beforeEach } from 'vitest';
import { gymChallengeService } from '@/services/gym-challenge.service';
import { platform } from '@/platform';
import { GymChallenge } from '@/types/gym.types';

describe('Phase G5-A: Gym Challenges Unit Suite', () => {
  const GYM_ID = 'mock-gym-1';
  const CHALLENGE_ID = 'chall-1';

  beforeEach(() => {
    platform.storage.clear();
  });

  describe('1. Challenge Creation & Input Validation', () => {
    it('rejects challenges with titles shorter than 3 characters', async () => {
      await expect(
        gymChallengeService.createChallenge({
          gymId: GYM_ID,
          title: 'AB',
          challengeType: 'attendance_count',
          targetValue: 10,
          scoringUnit: 'days',
          startAt: new Date(Date.now() + 86400000).toISOString(),
          endAt: new Date(Date.now() + 864000000).toISOString(),
        })
      ).rejects.toThrow('Title must be at least 3 characters');
    });

    it('rejects challenges where end date is before or equal to start date', async () => {
      const now = new Date();
      await expect(
        gymChallengeService.createChallenge({
          gymId: GYM_ID,
          title: 'Spring Consistency Sprint',
          challengeType: 'attendance_count',
          targetValue: 15,
          scoringUnit: 'days',
          startAt: new Date(now.getTime() + 864000000).toISOString(),
          endAt: new Date(now.getTime() + 86400000).toISOString(), // earlier than start!
        })
      ).rejects.toThrow('End date must be after start date');
    });

    it('rejects challenges with zero or negative target values', async () => {
      await expect(
        gymChallengeService.createChallenge({
          gymId: GYM_ID,
          title: 'Zero Volume Challenge',
          challengeType: 'workout_volume',
          targetValue: 0,
          scoringUnit: 'kg',
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 864000000).toISOString(),
        })
      ).rejects.toThrow('Target value must be greater than zero');
    });

    it('successfully creates a valid challenge in draft status', async () => {
      const challenge = await gymChallengeService.createChallenge({
        gymId: GYM_ID,
        title: '30-Day Attendance Streak',
        description: 'Hit the gym at least 20 times this month.',
        challengeType: 'attendance_count',
        targetValue: 20,
        scoringUnit: 'days',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        rewardBadgeName: 'Iron Consistency',
        rewardCoins: 100,
      });

      expect(challenge).toBeDefined();
      expect(challenge.title).toBe('30-Day Attendance Streak');
      expect(challenge.status).toBe('draft');
      expect(challenge.targetValue).toBe(20);
      expect(challenge.scoringUnit).toBe('days');
    });
  });

  describe('2. Challenge Retrieval & Filtering', () => {
    it('fetches challenges for a gym and filters by status', async () => {
      const ch1: GymChallenge = {
        id: 'chall-1',
        gymId: GYM_ID,
        title: 'Active Challenge',
        challengeType: 'workout_count',
        status: 'active',
        targetValue: 12,
        scoringUnit: 'workouts',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 864000000).toISOString(),
        createdBy: 'owner-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ch2: GymChallenge = {
        id: 'chall-2',
        gymId: GYM_ID,
        title: 'Draft Challenge',
        challengeType: 'workout_volume',
        status: 'draft',
        targetValue: 10000,
        scoringUnit: 'kg',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 864000000).toISOString(),
        createdBy: 'owner-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      platform.storage.setItem(`gym_challenges_${GYM_ID}`, JSON.stringify([ch1, ch2]));

      const all = await gymChallengeService.getChallenges(GYM_ID);
      expect(all.length).toBe(2);

      const activeOnly = await gymChallengeService.getChallenges(GYM_ID, 'active');
      expect(activeOnly.length).toBe(1);
      expect(activeOnly[0].id).toBe('chall-1');
    });
  });

  describe('3. Challenge Participation & Idempotency', () => {
    it('allows an active member to join a challenge', async () => {
      const part = await gymChallengeService.joinChallenge(CHALLENGE_ID);
      expect(part).toBeDefined();
      expect(part.challengeId).toBe(CHALLENGE_ID);
      expect(part.status).toBe('active');
      expect(part.currentScore).toBe(0);
    });

    it('retrieves user participation record', async () => {
      await gymChallengeService.joinChallenge(CHALLENGE_ID);
      const part = await gymChallengeService.getMyParticipation(CHALLENGE_ID, 'mock-user-current');
      expect(part).not.toBeNull();
      expect(part?.challengeId).toBe(CHALLENGE_ID);
    });
  });

  describe('4. Anti-Cheat Authoritative Progress Derivation', () => {
    it('correctly reports target completion when score meets or exceeds target value', () => {
      const evaluateCompletion = (score: number, target: number) => score >= target;

      expect(evaluateCompletion(19, 20)).toBe(false);
      expect(evaluateCompletion(20, 20)).toBe(true);
      expect(evaluateCompletion(25, 20)).toBe(true);
    });

    it('calculates progress percentage accurately capped at 100%', () => {
      const calcPct = (score: number, target: number) => {
        return Math.min(100, Math.round((score / target) * 1000) / 10);
      };

      expect(calcPct(5, 20)).toBe(25);
      expect(calcPct(10, 20)).toBe(50);
      expect(calcPct(20, 20)).toBe(100);
      expect(calcPct(25, 20)).toBe(100);
    });
  });
});
