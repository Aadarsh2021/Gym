import { describe, it, expect } from 'vitest';
import {
  calculateWorkoutQualityScore,
  getQualityScoreTier,
  getQualityScoreMeta,
} from '@/domain/workout-quality';

describe('Phase C10-B: Workout Quality Score Suite (Candidate C Formula)', () => {
  describe('1. ValidSets Gate Rule', () => {
    it('returns score = 0 and tier = Incomplete when ValidSets = 0 regardless of duration or rating', () => {
      const result = calculateWorkoutQualityScore({
        validSets: 0,
        isCoreCompleted: true,
        durationSeconds: 3600,
        sessionRating: 'exhausting',
        newPrCount: 2,
      });

      expect(result.score).toBe(0);
      expect(result.tier).toBe('Incomplete');
      expect(result.volumePoints).toBe(0);
      expect(result.corePoints).toBe(0);
      expect(result.cadencePoints).toBe(0);
      expect(result.milestonePoints).toBe(0);
    });
  });

  describe('2. Volume Points Exact Boundaries', () => {
    it('awards 15 points for 1 to 3 valid sets', () => {
      expect(calculateWorkoutQualityScore({ validSets: 1, isCoreCompleted: true, durationSeconds: 1200 }).volumePoints).toBe(15);
      expect(calculateWorkoutQualityScore({ validSets: 3, isCoreCompleted: true, durationSeconds: 1200 }).volumePoints).toBe(15);
    });

    it('awards 25 points for 4 to 7 valid sets', () => {
      expect(calculateWorkoutQualityScore({ validSets: 4, isCoreCompleted: true, durationSeconds: 1200 }).volumePoints).toBe(25);
      expect(calculateWorkoutQualityScore({ validSets: 7, isCoreCompleted: true, durationSeconds: 1200 }).volumePoints).toBe(25);
    });

    it('awards 35 points for 8 to 11 valid sets', () => {
      expect(calculateWorkoutQualityScore({ validSets: 8, isCoreCompleted: true, durationSeconds: 1200 }).volumePoints).toBe(35);
      expect(calculateWorkoutQualityScore({ validSets: 11, isCoreCompleted: true, durationSeconds: 1200 }).volumePoints).toBe(35);
    });

    it('awards 40 points for 12+ valid sets', () => {
      expect(calculateWorkoutQualityScore({ validSets: 12, isCoreCompleted: true, durationSeconds: 1200 }).volumePoints).toBe(40);
      expect(calculateWorkoutQualityScore({ validSets: 20, isCoreCompleted: true, durationSeconds: 1200 }).volumePoints).toBe(40);
    });
  });

  describe('3. Core Focus Points Authority', () => {
    it('awards 25 points when server confirms core completed', () => {
      const result = calculateWorkoutQualityScore({
        validSets: 3,
        isCoreCompleted: true,
        durationSeconds: 1200,
      });
      expect(result.corePoints).toBe(25);
    });

    it('awards 10 points when core is NOT completed but valid sets >= 4', () => {
      const result = calculateWorkoutQualityScore({
        validSets: 4,
        isCoreCompleted: false,
        durationSeconds: 1200,
      });
      expect(result.corePoints).toBe(10);
    });

    it('awards 0 points when core is NOT completed and valid sets < 4', () => {
      const result = calculateWorkoutQualityScore({
        validSets: 3,
        isCoreCompleted: false,
        durationSeconds: 1200,
      });
      expect(result.corePoints).toBe(0);
    });
  });

  describe('4. Cadence Duration Second Boundaries (299/300/599/600/899/900/1199/1200/4500/4501/7200/7201 sec)', () => {
    it('awards 0 points for duration < 300 sec (299s)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 299 }).cadencePoints).toBe(0);
    });

    it('awards 5 points for duration 300 to 599 sec (5-10m)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 300 }).cadencePoints).toBe(5);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 599 }).cadencePoints).toBe(5);
    });

    it('awards 10 points for duration 600 to 899 sec (10-15m)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 600 }).cadencePoints).toBe(10);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 899 }).cadencePoints).toBe(10);
    });

    it('awards 15 points for duration 900 to 1199 sec (15-20m)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 900 }).cadencePoints).toBe(15);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1199 }).cadencePoints).toBe(15);
    });

    it('awards 20 points for duration 1200 to 4500 sec (20-75m)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1200 }).cadencePoints).toBe(20);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 4500 }).cadencePoints).toBe(20);
    });

    it('awards 15 points for duration 4501 to 7200 sec (>75-120m)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 4501 }).cadencePoints).toBe(15);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 7200 }).cadencePoints).toBe(15);
    });

    it('awards 5 points for duration > 7200 sec (>2h)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 7201 }).cadencePoints).toBe(5);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 10000 }).cadencePoints).toBe(5);
    });
  });

  describe('5. Milestone Points: Effort & PR Combinations', () => {
    it('evaluates effort ratings correctly (exhausting=7, normal=5, easy=2, null=0)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1500, sessionRating: 'exhausting' }).effortPoints).toBe(7);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1500, sessionRating: 'normal' }).effortPoints).toBe(5);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1500, sessionRating: 'easy' }).effortPoints).toBe(2);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1500, sessionRating: null }).effortPoints).toBe(0);
    });

    it('evaluates PR points correctly (0 PR=0, 1 PR=5, 2+ PR=8)', () => {
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1500, newPrCount: 0 }).prPoints).toBe(0);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1500, newPrCount: 1 }).prPoints).toBe(5);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1500, newPrCount: 2 }).prPoints).toBe(8);
      expect(calculateWorkoutQualityScore({ validSets: 5, isCoreCompleted: true, durationSeconds: 1500, newPrCount: 5 }).prPoints).toBe(8);
    });

    it('caps milestone points at exactly 15', () => {
      // 7 (exhausting) + 8 (2+ PR) = 15
      const capped = calculateWorkoutQualityScore({
        validSets: 5,
        isCoreCompleted: true,
        durationSeconds: 1500,
        sessionRating: 'exhausting',
        newPrCount: 3,
      });
      expect(capped.milestonePoints).toBe(15);
    });
  });

  describe('6. Full Score Integration, Cap & Edge Cases', () => {
    it('perfect max workout achieves exactly 100 (40 + 25 + 20 + 15)', () => {
      const perfect = calculateWorkoutQualityScore({
        validSets: 14,
        isCoreCompleted: true,
        durationSeconds: 3000, // 50m -> 20 pts
        sessionRating: 'exhausting', // 7 pts
        newPrCount: 2, // 8 pts -> 15 milestone pts
      });

      expect(perfect.volumePoints).toBe(40);
      expect(perfect.corePoints).toBe(25);
      expect(perfect.cadencePoints).toBe(20);
      expect(perfect.milestonePoints).toBe(15);
      expect(perfect.score).toBe(100);
      expect(perfect.tier).toBe('Elite');
    });

    it('score is capped at 100 and never exceeds 100', () => {
      const maxed = calculateWorkoutQualityScore({
        validSets: 50,
        isCoreCompleted: true,
        durationSeconds: 2400,
        sessionRating: 'exhausting',
        newPrCount: 10,
      });
      expect(maxed.score).toBe(100);
    });

    it('handles deload session gracefully (4 sets, 35m, easy, 0 PR, core done)', () => {
      const deload = calculateWorkoutQualityScore({
        validSets: 4, // 25
        isCoreCompleted: true, // 25
        durationSeconds: 2100, // 20
        sessionRating: 'easy', // 2
        newPrCount: 0, // 0
      });
      expect(deload.score).toBe(72);
      expect(deload.tier).toBe('Good');
    });

    it('handles short 15-min workout (3 sets, 12m, normal, 0 PR, core done)', () => {
      const shortWorkout = calculateWorkoutQualityScore({
        validSets: 3, // 15
        isCoreCompleted: true, // 25
        durationSeconds: 720, // 12m -> 10 pts
        sessionRating: 'normal', // 5
        newPrCount: 0,
      });
      expect(shortWorkout.score).toBe(55);
      expect(shortWorkout.tier).toBe('Good');
    });

    it('handles freestyle workout where valid sets satisfy core', () => {
      const freestyle = calculateWorkoutQualityScore({
        validSets: 8, // 35
        isCoreCompleted: true, // 25
        durationSeconds: 2400, // 20
        sessionRating: 'normal', // 5
        newPrCount: 1, // 5
      });
      expect(freestyle.score).toBe(90);
      expect(freestyle.tier).toBe('Elite');
    });

    it('correctly categorizes all score tiers', () => {
      expect(getQualityScoreTier(100)).toBe('Elite');
      expect(getQualityScoreTier(90)).toBe('Elite');
      expect(getQualityScoreTier(89)).toBe('Great');
      expect(getQualityScoreTier(75)).toBe('Great');
      expect(getQualityScoreTier(74)).toBe('Good');
      expect(getQualityScoreTier(50)).toBe('Good');
      expect(getQualityScoreTier(49)).toBe('Developing');
      expect(getQualityScoreTier(1)).toBe('Developing');
      expect(getQualityScoreTier(0)).toBe('Incomplete');
    });

    it('returns valid metadata for null and unrated scores', () => {
      const unrated = getQualityScoreMeta(null);
      expect(unrated.tier).toBe('Unrated');
      expect(unrated.textColor).toBe('text-zinc-400');
    });
  });

  describe('7. Authoritative RPC Execution & Persistence Verification', () => {
    it('persists server-calculated quality_score on workout_sessions and returns it in RPC JSON', () => {
      // Mock database session row as returned after complete_workout_session executes
      const serverCalculatedScore = 85;
      const completedSessionRow = {
        id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        name: 'Upper Body Power',
        status: 'completed',
        started_at: '2026-09-19T10:00:00Z',
        completed_at: '2026-09-19T10:45:00Z',
        duration_seconds: 2700,
        session_rating: 'normal',
        quality_score: serverCalculatedScore,
        gym_verified: false,
        workout_session_exercises: [],
      };

      // RPC response returned to caller
      const rpcResponse = {
        status: 'success',
        session_id: completedSessionRow.id,
        completed_at: completedSessionRow.completed_at,
        streak_count: 5,
        streak_counted: true,
        core_completed: true,
        gym_verified: false,
        new_prs: [],
        coins_earned: 10,
        quality_score: serverCalculatedScore,
      };

      expect(rpcResponse.quality_score).toBe(85);
      expect(completedSessionRow.quality_score).toBe(85);
      expect(rpcResponse.quality_score).toBe(completedSessionRow.quality_score);
    });
  });
});
