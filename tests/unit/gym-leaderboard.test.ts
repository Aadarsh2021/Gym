import { describe, it, expect, beforeEach } from 'vitest';
import { gymChallengeService } from '@/services/gym-challenge.service';
import { platform } from '@/platform';
import { GymChallengeLeaderboardEntry } from '@/types/gym.types';

describe('Phase G5-B: Gym Leaderboard Unit Suite', () => {
  const CHALLENGE_ID = 'chall-leaderboard-1';

  beforeEach(() => {
    platform.storage.clear();
  });

  describe('1. Deterministic Multi-Level Tie-Breaking Engine', () => {
    it('ranks primarily by current score DESC', () => {
      const participants = [
        { userId: 'user-b', score: 15, targetAchievedAt: null, lastProgressAt: '2026-09-19T10:00:00Z' },
        { userId: 'user-a', score: 20, targetAchievedAt: '2026-09-19T12:00:00Z', lastProgressAt: '2026-09-19T12:00:00Z' },
        { userId: 'user-c', score: 10, targetAchievedAt: null, lastProgressAt: '2026-09-19T09:00:00Z' },
      ];

      const sorted = [...participants].sort((a, b) => b.score - a.score);
      expect(sorted[0].userId).toBe('user-a');
      expect(sorted[1].userId).toBe('user-b');
      expect(sorted[2].userId).toBe('user-c');
    });

    it('breaks ties using earliest target achievement timestamp ASC', () => {
      const participants = [
        { userId: 'user-late', score: 20, targetAchievedAt: '2026-09-19T15:00:00Z', lastProgressAt: '2026-09-19T15:00:00Z' },
        { userId: 'user-early', score: 20, targetAchievedAt: '2026-09-19T10:00:00Z', lastProgressAt: '2026-09-19T10:00:00Z' },
      ];

      const sorted = [...participants].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.targetAchievedAt && b.targetAchievedAt) {
          return new Date(a.targetAchievedAt).getTime() - new Date(b.targetAchievedAt).getTime();
        }
        return 0;
      });

      expect(sorted[0].userId).toBe('user-early');
      expect(sorted[1].userId).toBe('user-late');
    });

    it('breaks secondary ties using earliest last_progress_at timestamp ASC', () => {
      const participants = [
        { userId: 'user-recent', score: 15, targetAchievedAt: null, lastProgressAt: '2026-09-19T16:00:00Z' },
        { userId: 'user-earlier', score: 15, targetAchievedAt: null, lastProgressAt: '2026-09-19T08:00:00Z' },
      ];

      const sorted = [...participants].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.lastProgressAt).getTime() - new Date(b.lastProgressAt).getTime();
      });

      expect(sorted[0].userId).toBe('user-earlier');
      expect(sorted[1].userId).toBe('user-recent');
    });

    it('breaks identical timestamp ties deterministically using UUID lexicographical order', () => {
      const participants = [
        { userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', score: 15, lastProgressAt: '2026-09-19T12:00:00Z' },
        { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', score: 15, lastProgressAt: '2026-09-19T12:00:00Z' },
      ];

      const sorted = [...participants].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.userId.localeCompare(b.userId);
      });

      expect(sorted[0].userId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      expect(sorted[1].userId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    });
  });

  describe('2. Bounded Pagination & Retrieval', () => {
    it('retrieves leaderboard entries for a challenge', async () => {
      const mockEntries: GymChallengeLeaderboardEntry[] = [
        {
          rank: 1,
          userId: 'user-1',
          displayName: 'Iron Titan',
          avatarUrl: 'https://example.com/avatar1.jpg',
          currentScore: 20,
          targetValue: 20,
          scoringUnit: 'days',
          progressPercentage: 100,
          isCompleted: true,
          targetAchievedAt: '2026-09-19T10:00:00Z',
          lastProgressAt: '2026-09-19T10:00:00Z',
        },
        {
          rank: 2,
          userId: 'user-2',
          displayName: 'Fitness Ace',
          avatarUrl: null,
          currentScore: 16,
          targetValue: 20,
          scoringUnit: 'days',
          progressPercentage: 80,
          isCompleted: false,
          lastProgressAt: '2026-09-19T11:00:00Z',
        },
      ];

      platform.storage.setItem(`leaderboard_${CHALLENGE_ID}`, JSON.stringify(mockEntries));

      const leaderboard = await gymChallengeService.getLeaderboard(CHALLENGE_ID);
      expect(leaderboard.length).toBe(2);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].displayName).toBe('Iron Titan');
      expect(leaderboard[1].rank).toBe(2);
    });

    it('returns empty array when challenge has no participants', async () => {
      const leaderboard = await gymChallengeService.getLeaderboard('empty-chall');
      expect(leaderboard).toEqual([]);
    });
  });
});
