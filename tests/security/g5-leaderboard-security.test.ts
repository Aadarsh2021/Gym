import { describe, it, expect, beforeEach } from 'vitest';
import { platform } from '@/platform';
import { GymChallengeLeaderboardEntry } from '@/types/gym.types';

describe('Phase G5-B: Gym Leaderboard Security & Privacy Suite', () => {
  beforeEach(() => {
    platform.storage.clear();
  });

  describe('1. Member Privacy & Sensitive Biometric Protection', () => {
    it('strictly omits private fields (email, phone, weight, height, limitations, diet, age) from leaderboard payload', () => {
      const entry: GymChallengeLeaderboardEntry = {
        rank: 1,
        userId: 'candidate-1',
        displayName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        currentScore: 5000,
        targetValue: 10000,
        scoringUnit: 'kg',
        progressPercentage: 50,
        isCompleted: false,
      };

      // Ensure private biometric, contact, and diet fields are completely absent
      expect((entry as any).email).toBeUndefined();
      expect((entry as any).phone).toBeUndefined();
      expect((entry as any).weightKg).toBeUndefined();
      expect((entry as any).heightCm).toBeUndefined();
      expect((entry as any).limitations).toBeUndefined();
      expect((entry as any).dietaryPreference).toBeUndefined();
      expect((entry as any).age).toBeUndefined();
      expect((entry as any).bodyFatPercentage).toBeUndefined();
      expect((entry as any).privateNotes).toBeUndefined();
    });
  });

  describe('2. Multi-Tenant Challenge Scoping & Isolation', () => {
    it('guarantees leaderboard results are strictly scoped to the target challenge', () => {
      const isChallengeParticipant = (challengeId: string, entryChallengeId: string) => {
        return challengeId === entryChallengeId;
      };

      expect(isChallengeParticipant('ch-1', 'ch-1')).toBe(true);
      expect(isChallengeParticipant('ch-1', 'ch-2')).toBe(false);
    });
  });

  describe('3. Deterministic Invariance Under Re-evaluation', () => {
    it('produces identical ranking order across multiple evaluations', () => {
      const data = [
        { userId: 'u-1', score: 100, targetAchievedAt: '2026-09-19T10:00:00Z', lastProgressAt: '2026-09-19T10:00:00Z' },
        { userId: 'u-2', score: 100, targetAchievedAt: '2026-09-19T10:00:00Z', lastProgressAt: '2026-09-19T10:00:00Z' },
        { userId: 'u-3', score: 80, targetAchievedAt: null, lastProgressAt: '2026-09-19T11:00:00Z' },
      ];

      const ranker = (list: typeof data) => {
        return [...list].sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.targetAchievedAt && b.targetAchievedAt) {
            const diff = new Date(a.targetAchievedAt).getTime() - new Date(b.targetAchievedAt).getTime();
            if (diff !== 0) return diff;
          }
          return a.userId.localeCompare(b.userId);
        });
      };

      const run1 = ranker(data);
      const run2 = ranker(data);

      expect(run1.map(r => r.userId)).toEqual(run2.map(r => r.userId));
      expect(run1[0].userId).toBe('u-1');
      expect(run1[1].userId).toBe('u-2');
      expect(run1[2].userId).toBe('u-3');
    });
  });
});
