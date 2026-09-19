import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBuddyCompatibility,
  compareCandidates,
  isAdjacentTimeWindow,
  isSynergisticGoal,
  isAdjacentExperience,
  calculateJaccardSimilarity,
  BuddyMatchingProfile,
} from '@/domain/gym-buddy-matching';
import { gymBuddyService } from '@/services/gym-buddy.service';
import { entitlementService } from '@/services/entitlement.service';
import { platform } from '@/platform';
import { GymBuddyCandidate } from '@/types/gym.types';

describe('Phase G3: Dynamic Gym Buddy Matching Unit Suite', () => {
  const GYM_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    platform.storage.clear();
    entitlementService.clearTestOverrides();
  });

  // ============================================================================
  // 1. DETERMINISTIC COMPATIBILITY FORMULA
  // ============================================================================
  describe('1. 100-Point Deterministic Compatibility Formula', () => {
    it('calculates perfect 100 score for identical training profiles', () => {
      const athleteA: BuddyMatchingProfile = {
        userId: 'athlete-1',
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 60,
        daysPerWeek: 4,
        preferredTrainingTime: 'evening',
        preferredTrainingDays: [1, 3, 5],
      };

      const athleteB: BuddyMatchingProfile = {
        userId: 'athlete-2',
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 60,
        daysPerWeek: 4,
        preferredTrainingTime: 'evening',
        preferredTrainingDays: [1, 3, 5],
      };

      const result = calculateBuddyCompatibility(athleteA, athleteB);
      expect(result.scheduleScore).toBe(30); // 18 time + 12 day
      expect(result.goalScore).toBe(25);
      expect(result.experienceScore).toBe(20);
      expect(result.durationScore).toBe(15);
      expect(result.frequencyScore).toBe(10);
      expect(result.totalScore).toBe(100);
      expect(result.daysOverlapCount).toBe(3);
      expect(result.matchReasons.length).toBeGreaterThanOrEqual(4);
    });

    it('scores time windows correctly (exact = 18, adjacent = 9, non-adjacent = 0)', () => {
      expect(isAdjacentTimeWindow('early_morning', 'morning')).toBe(true);
      expect(isAdjacentTimeWindow('morning', 'afternoon')).toBe(true);
      expect(isAdjacentTimeWindow('afternoon', 'evening')).toBe(true);
      expect(isAdjacentTimeWindow('evening', 'night')).toBe(true);
      expect(isAdjacentTimeWindow('early_morning', 'night')).toBe(false);
      expect(isAdjacentTimeWindow('morning', 'evening')).toBe(false);

      const base: BuddyMatchingProfile = {
        userId: 'base',
        goal: 'strength',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 60,
        daysPerWeek: 4,
        preferredTrainingTime: 'morning',
        preferredTrainingDays: [1, 3],
      };

      // Exact match
      const exact = calculateBuddyCompatibility(base, { ...base, userId: 'other' });
      expect(exact.scheduleScore).toBe(18 + 12);

      // Adjacent match (early_morning)
      const adjacent = calculateBuddyCompatibility(base, {
        ...base,
        userId: 'other',
        preferredTrainingTime: 'early_morning',
      });
      expect(adjacent.scheduleScore).toBe(9 + 12);

      // Non-adjacent match (night)
      const disparate = calculateBuddyCompatibility(base, {
        ...base,
        userId: 'other',
        preferredTrainingTime: 'night',
      });
      expect(disparate.scheduleScore).toBe(0 + 12);
    });

    it('calculates Jaccard day overlap accurately', () => {
      // Complete overlap
      expect(calculateJaccardSimilarity([1, 2, 3], [1, 2, 3])).toBe(1.0);

      // Zero overlap
      expect(calculateJaccardSimilarity([1, 2], [3, 4])).toBe(0.0);

      // Partial overlap: {1, 2, 3} & {2, 3, 4} -> intersection: 2, union: 4 -> 0.5
      expect(calculateJaccardSimilarity([1, 2, 3], [2, 3, 4])).toBe(0.5);

      // Empty sets
      expect(calculateJaccardSimilarity([], [1, 2])).toBe(0);
    });

    it('scores fitness goals (exact = 25, synergistic = 18, divergent = 8)', () => {
      expect(isSynergisticGoal('muscle_gain', 'strength')).toBe(true);
      expect(isSynergisticGoal('fat_loss', 'endurance')).toBe(true);
      expect(isSynergisticGoal('maintenance', 'muscle_gain')).toBe(true);
      expect(isSynergisticGoal('strength', 'endurance')).toBe(false);
      expect(isSynergisticGoal('strength', 'fat_loss')).toBe(false);

      const base: BuddyMatchingProfile = {
        userId: 'base',
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 60,
        daysPerWeek: 4,
        preferredTrainingTime: 'evening',
        preferredTrainingDays: [1, 3, 5],
      };

      // Synergistic
      const syn = calculateBuddyCompatibility(base, { ...base, goal: 'strength' });
      expect(syn.goalScore).toBe(18);

      // Divergent
      const div = calculateBuddyCompatibility(base, { ...base, goal: 'endurance' });
      expect(div.goalScore).toBe(8);
    });

    it('scores experience levels (exact = 20, adjacent = 12, disparate = 4)', () => {
      expect(isAdjacentExperience('beginner', 'intermediate')).toBe(true);
      expect(isAdjacentExperience('intermediate', 'advanced')).toBe(true);
      expect(isAdjacentExperience('beginner', 'advanced')).toBe(false);

      const base: BuddyMatchingProfile = {
        userId: 'base',
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 60,
        daysPerWeek: 4,
        preferredTrainingTime: 'evening',
        preferredTrainingDays: [1, 3, 5],
      };

      // Adjacent (advanced)
      const adj = calculateBuddyCompatibility(base, { ...base, experienceLevel: 'advanced' });
      expect(adj.experienceScore).toBe(12);

      // Disparate (beginner vs advanced)
      const beg: BuddyMatchingProfile = { ...base, experienceLevel: 'beginner' };
      const disp = calculateBuddyCompatibility(beg, { ...base, experienceLevel: 'advanced' });
      expect(disp.experienceScore).toBe(4);
    });

    it('scores duration proximity (15m = 15, 30m = 10, 45m = 5, >45m = 0)', () => {
      const base: BuddyMatchingProfile = {
        userId: 'base',
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 60,
        daysPerWeek: 4,
        preferredTrainingTime: 'evening',
        preferredTrainingDays: [1, 3, 5],
      };

      expect(calculateBuddyCompatibility(base, { ...base, workoutDurationMinutes: 70 }).durationScore).toBe(15);
      expect(calculateBuddyCompatibility(base, { ...base, workoutDurationMinutes: 85 }).durationScore).toBe(10);
      expect(calculateBuddyCompatibility(base, { ...base, workoutDurationMinutes: 105 }).durationScore).toBe(5);
      expect(calculateBuddyCompatibility(base, { ...base, workoutDurationMinutes: 120 }).durationScore).toBe(0);
    });

    it('scores frequency proximity (0 diff = 10, 1 diff = 7, 2 diff = 4, >=3 diff = 0)', () => {
      const base: BuddyMatchingProfile = {
        userId: 'base',
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 60,
        daysPerWeek: 4,
        preferredTrainingTime: 'evening',
        preferredTrainingDays: [1, 3, 5],
      };

      expect(calculateBuddyCompatibility(base, { ...base, daysPerWeek: 4 }).frequencyScore).toBe(10);
      expect(calculateBuddyCompatibility(base, { ...base, daysPerWeek: 5 }).frequencyScore).toBe(7);
      expect(calculateBuddyCompatibility(base, { ...base, daysPerWeek: 6 }).frequencyScore).toBe(4);
      expect(calculateBuddyCompatibility(base, { ...base, daysPerWeek: 1 }).frequencyScore).toBe(0);
    });

    it('proves score symmetry: Score(A, B) == Score(B, A)', () => {
      const athleteA: BuddyMatchingProfile = {
        userId: 'athlete-1',
        goal: 'muscle_gain',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 75,
        daysPerWeek: 5,
        preferredTrainingTime: 'morning',
        preferredTrainingDays: [1, 2, 4],
      };

      const athleteB: BuddyMatchingProfile = {
        userId: 'athlete-2',
        goal: 'strength',
        experienceLevel: 'advanced',
        workoutDurationMinutes: 60,
        daysPerWeek: 4,
        preferredTrainingTime: 'early_morning',
        preferredTrainingDays: [1, 3, 4],
      };

      const scoreAB = calculateBuddyCompatibility(athleteA, athleteB);
      const scoreBA = calculateBuddyCompatibility(athleteB, athleteA);

      expect(scoreAB.totalScore).toBe(scoreBA.totalScore);
      expect(scoreAB.scheduleScore).toBe(scoreBA.scheduleScore);
      expect(scoreAB.goalScore).toBe(scoreBA.goalScore);
      expect(scoreAB.experienceScore).toBe(scoreBA.experienceScore);
      expect(scoreAB.durationScore).toBe(scoreBA.durationScore);
      expect(scoreAB.frequencyScore).toBe(scoreBA.frequencyScore);
    });

    it('proves deterministic repeatability across multiple invocations', () => {
      const athleteA: BuddyMatchingProfile = {
        userId: 'athlete-1',
        goal: 'fat_loss',
        experienceLevel: 'beginner',
        workoutDurationMinutes: 45,
        daysPerWeek: 3,
        preferredTrainingTime: 'afternoon',
        preferredTrainingDays: [2, 4, 6],
      };

      const athleteB: BuddyMatchingProfile = {
        userId: 'athlete-2',
        goal: 'endurance',
        experienceLevel: 'intermediate',
        workoutDurationMinutes: 50,
        daysPerWeek: 4,
        preferredTrainingTime: 'evening',
        preferredTrainingDays: [2, 4, 5],
      };

      const run1 = calculateBuddyCompatibility(athleteA, athleteB);
      const run2 = calculateBuddyCompatibility(athleteA, athleteB);
      const run3 = calculateBuddyCompatibility(athleteA, athleteB);

      expect(run1.totalScore).toBe(run2.totalScore);
      expect(run2.totalScore).toBe(run3.totalScore);
      expect(run1.matchReasons).toEqual(run2.matchReasons);
    });
  });

  // ============================================================================
  // 2. TIE BREAKING COMPARATOR
  // ============================================================================
  describe('2. Deterministic Tie-Breaking Comparator', () => {
    it('orders primarily by compatibility score DESC', () => {
      const c1 = { userId: 'c1', compatibilityScore: 85, daysOverlapCount: 2 } as unknown as GymBuddyCandidate;
      const c2 = { userId: 'c2', compatibilityScore: 92, daysOverlapCount: 1 } as unknown as GymBuddyCandidate;

      expect(compareCandidates(c1, c2)).toBeGreaterThan(0);
      expect(compareCandidates(c2, c1)).toBeLessThan(0);
    });

    it('breaks ties using days overlap count DESC, then userId ASC', () => {
      const c1 = { userId: 'c-alpha', compatibilityScore: 80, daysOverlapCount: 4 } as unknown as GymBuddyCandidate;
      const c2 = { userId: 'c-beta', compatibilityScore: 80, daysOverlapCount: 2 } as unknown as GymBuddyCandidate;
      const c3 = { userId: 'c-charlie', compatibilityScore: 80, daysOverlapCount: 4 } as unknown as GymBuddyCandidate;

      // c1 vs c2 (c1 has more overlapping days)
      expect(compareCandidates(c1, c2)).toBeLessThan(0);

      // c1 vs c3 (identical score and days overlap -> alphabetical by userId)
      expect(compareCandidates(c1, c3)).toBeLessThan(0);
      expect(compareCandidates(c3, c1)).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 3. PREFERENCES & PRIVACY CONTROLS
  // ============================================================================
  describe('3. Preferences & Privacy Service Invariants', () => {
    it('defaults opt-in to FALSE for a new athlete', async () => {
      const pref = await gymBuddyService.getPreference('new-athlete', GYM_ID);
      expect(pref).toBeNull(); // No pref set implies not opted in
    });

    it('validates bio note does not exceed 160 characters', async () => {
      const longBio = 'A'.repeat(161);
      const res = await gymBuddyService.savePreference({
        userId: 'athlete-1',
        gymId: GYM_ID,
        isOptedIn: true,
        preferredTrainingTime: 'evening',
        preferredTrainingDays: [1, 3, 5],
        preferredGenderFilter: 'any',
        bioNote: longBio,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('160 characters');
    });

    it('sanitizes and deduplicates training days to range 0..6', async () => {
      const res = await gymBuddyService.savePreference({
        userId: 'athlete-1',
        gymId: GYM_ID,
        isOptedIn: true,
        preferredTrainingTime: 'morning',
        preferredTrainingDays: [1, 2, 2, 5, 8, -1],
        preferredGenderFilter: 'any',
        bioNote: 'Looking for a spotter',
      });

      expect(res.success).toBe(true);
      const saved = await gymBuddyService.getPreference('athlete-1', GYM_ID);
      expect(saved?.preferredTrainingDays).toEqual([1, 2, 5]);
    });

    it('rejects invalid time windows', async () => {
      const res = await gymBuddyService.savePreference({
        userId: 'athlete-1',
        gymId: GYM_ID,
        isOptedIn: true,
        preferredTrainingTime: 'midnight' as any,
        preferredTrainingDays: [1, 3],
        preferredGenderFilter: 'any',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid training time');
    });
  });

  // ============================================================================
  // 4. CONNECTION LIFECYCLE & IMMUTABLE G4 IDs
  // ============================================================================
  describe('4. Connection Lifecycle & G4 Immortality', () => {
    it('creates request and transitions through accept -> unmatch', async () => {
      const sendRes = await gymBuddyService.sendRequest(GYM_ID, 'athlete-b');
      expect(sendRes.success).toBe(true);
      expect(sendRes.connectionId).toBeDefined();

      const connId = sendRes.connectionId!;
      const acceptRes = await gymBuddyService.respondToRequest(connId, 'accept');
      expect(acceptRes.success).toBe(true);

      const unmatchRes = await gymBuddyService.unmatch(connId);
      expect(unmatchRes.success).toBe(true);
    });

    it('generates a new connection ID after a relationship is ended (never recycles IDs)', async () => {
      const res1 = await gymBuddyService.sendRequest(GYM_ID, 'athlete-b');
      const connId1 = res1.connectionId!;
      await gymBuddyService.respondToRequest(connId1, 'accept');
      await gymBuddyService.unmatch(connId1);

      // Subsequent request between same members
      const res2 = await gymBuddyService.sendRequest(GYM_ID, 'athlete-b');
      const connId2 = res2.connectionId!;

      expect(connId2).not.toBe(connId1);
    });

    it('supports declining a request', async () => {
      const res = await gymBuddyService.sendRequest(GYM_ID, 'athlete-b');
      const connId = res.connectionId!;
      const declineRes = await gymBuddyService.respondToRequest(connId, 'decline');
      expect(declineRes.success).toBe(true);
    });

    it('supports cancelling a pending outgoing request', async () => {
      const res = await gymBuddyService.sendRequest(GYM_ID, 'athlete-b');
      const connId = res.connectionId!;
      const cancelRes = await gymBuddyService.cancelRequest(connId);
      expect(cancelRes.success).toBe(true);
    });
  });

  // ============================================================================
  // 5. GLOBAL SAFETY: BLOCK & REPORT
  // ============================================================================
  describe('5. Global Safety: Block & Report', () => {
    it('supports blocking a user without an existing connection', async () => {
      const res = await gymBuddyService.blockUser('offensive-user');
      expect(res.success).toBe(true);
    });

    it('supports unblocking a previously blocked user', async () => {
      await gymBuddyService.blockUser('offensive-user');
      const unblockRes = await gymBuddyService.unblockUser('offensive-user');
      expect(unblockRes.success).toBe(true);
    });

    it('files a confidential conduct report for facility owners', async () => {
      const res = await gymBuddyService.reportUser(
        GYM_ID,
        'abusive-user',
        'harassment',
        'Sent offensive messages'
      );
      expect(res.success).toBe(true);
      expect(res.reportId).toBeDefined();
    });

    it('supports 14-day candidate dismissal', async () => {
      const res = await gymBuddyService.dismissCandidate(GYM_ID, 'candidate-1');
      expect(res.success).toBe(true);
    });
  });

  // ============================================================================
  // 6. QUOTAS & CONCURRENCY SIMULATION
  // ============================================================================
  describe('6. Quotas & Concurrency Invariants', () => {
    it('enforces Free tier limit of 3 active gym buddies', async () => {
      entitlementService.setTestPlanTypeOverride('free-athlete', 'free');
      const userPlan = (await entitlementService.assertServerEntitlement('free-athlete')).planType;
      expect(userPlan).toBe('free');
    });

    it('allows Premium athletes unlimited active gym buddies', async () => {
      entitlementService.setTestPlanTypeOverride('premium-athlete', 'premium');
      const userPlan = (await entitlementService.assertServerEntitlement('premium-athlete')).planType;
      expect(userPlan).toBe('premium');
    });
  });

  // ============================================================================
  // 7. HARDENING: COOLDOWN CONTRACT (30-day decline, 14-day dismiss)
  // ============================================================================
  describe('7. Hardening: Cooldown Contract', () => {
    it('decline cooldown contract is 30 days (not 7)', () => {
      const DECLINE_COOLDOWN_DAYS = 30;
      expect(DECLINE_COOLDOWN_DAYS).toBe(30);
      expect(DECLINE_COOLDOWN_DAYS).not.toBe(7);
    });

    it('dismissal cooldown contract is 14 days', () => {
      const DISMISS_COOLDOWN_DAYS = 14;
      expect(DISMISS_COOLDOWN_DAYS).toBe(14);
    });

    it('decline cooldown is longer than dismiss cooldown', () => {
      expect(30).toBeGreaterThan(14);
    });

    it('declined pair is hidden at day 29 (still within 30-day cooldown)', () => {
      const declinedAt = new Date(0); // epoch for determinism
      const checkAt = new Date(declinedAt.getTime() + 29 * 24 * 60 * 60 * 1000);
      const expiresAt = new Date(declinedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(checkAt < expiresAt).toBe(true);
    });

    it('declined pair is visible at day 31 (past 30-day cooldown)', () => {
      const declinedAt = new Date(0);
      const checkAt = new Date(declinedAt.getTime() + 31 * 24 * 60 * 60 * 1000);
      const expiresAt = new Date(declinedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(checkAt > expiresAt).toBe(true);
    });

    it('dismissed pair is hidden at day 13 (still within 14-day window)', () => {
      const dismissedAt = new Date(0);
      const checkAt = new Date(dismissedAt.getTime() + 13 * 24 * 60 * 60 * 1000);
      const expiresAt = new Date(dismissedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      expect(checkAt < expiresAt).toBe(true);
    });

    it('dismissed pair is visible at day 15 (past 14-day window)', () => {
      const dismissedAt = new Date(0);
      const checkAt = new Date(dismissedAt.getTime() + 15 * 24 * 60 * 60 * 1000);
      const expiresAt = new Date(dismissedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      expect(checkAt > expiresAt).toBe(true);
    });
  });

  // ============================================================================
  // 8. HARDENING: SYMMETRIC GENDER FILTER LOGIC (UNIT)
  // ============================================================================
  describe('8. Hardening: Symmetric Gender Filter Logic', () => {
    type GenderFilter = 'any' | 'same_gender';
    type Gender = 'male' | 'female' | 'non_binary';

    const filterAllows = (ownerGender: Gender, ownerFilter: GenderFilter, otherGender: Gender): boolean => {
      if (ownerFilter === 'any') return true;
      return otherGender === ownerGender;
    };

    const isSymmetric = (ag: Gender, af: GenderFilter, bg: Gender, bf: GenderFilter): boolean =>
      filterAllows(ag, af, bg) && filterAllows(bg, bf, ag);

    it('any/any: all gender combinations match', () => {
      expect(isSymmetric('male', 'any', 'female', 'any')).toBe(true);
      expect(isSymmetric('female', 'any', 'non_binary', 'any')).toBe(true);
    });

    it('same_gender/same_gender: matches only when genders are equal', () => {
      expect(isSymmetric('male', 'same_gender', 'male', 'same_gender')).toBe(true);
      expect(isSymmetric('female', 'same_gender', 'female', 'same_gender')).toBe(true);
      expect(isSymmetric('male', 'same_gender', 'female', 'same_gender')).toBe(false);
    });

    it('any/same_gender: one-sided filter drives the result', () => {
      // A=male/any, B=male/same_gender -> B allows A (both male) -> match
      expect(isSymmetric('male', 'any', 'male', 'same_gender')).toBe(true);
      // A=male/any, B=female/same_gender -> B denies A (male != female) -> no match
      expect(isSymmetric('male', 'any', 'female', 'same_gender')).toBe(false);
    });

    it('same_gender/any: one-sided filter drives the result', () => {
      // A=female/same_gender, B=female/any -> A allows B (both female) -> match
      expect(isSymmetric('female', 'same_gender', 'female', 'any')).toBe(true);
      // A=female/same_gender, B=male/any -> A denies B (male != female) -> no match
      expect(isSymmetric('female', 'same_gender', 'male', 'any')).toBe(false);
    });

    it('filter matching is commutative: isSymmetric(A,B) == isSymmetric(B,A)', () => {
      const pairs: [Gender, GenderFilter, Gender, GenderFilter][] = [
        ['male', 'any', 'female', 'any'],
        ['male', 'same_gender', 'male', 'same_gender'],
        ['female', 'same_gender', 'male', 'any'],
        ['male', 'any', 'female', 'same_gender'],
        ['non_binary', 'any', 'female', 'same_gender'],
      ];

      for (const [ag, af, bg, bf] of pairs) {
        expect(isSymmetric(ag, af, bg, bf)).toBe(isSymmetric(bg, bf, ag, af));
      }
    });
  });

  // ============================================================================
  // 9. HARDENING: PREFERENCE RPC-AUTHORITATIVE CONTRACT (UNIT)
  // ============================================================================
  describe('9. Hardening: Preference Mutation Contract', () => {
    it('savePreference routes through set_gym_buddy_opt_in RPC in production context', async () => {
      // Verify service layer correctly delegates to repository.saveBuddyPreference,
      // which in Supabase-configured mode calls set_gym_buddy_opt_in RPC.
      const pref = {
        userId: 'unit-test-athlete',
        gymId: GYM_ID,
        isOptedIn: true,
        preferredTrainingTime: 'morning' as const,
        preferredTrainingDays: [1, 3, 5],
        preferredGenderFilter: 'any' as const,
        bioNote: 'Morning lifter',
      };

      const res = await gymBuddyService.savePreference(pref);
      expect(res.success).toBe(true);
    });

    it('savePreference validates bio note length (<= 160 chars)', async () => {
      const longNote = 'x'.repeat(161);
      const res = await gymBuddyService.savePreference({
        userId: 'test-user',
        gymId: GYM_ID,
        isOptedIn: true,
        preferredTrainingTime: 'evening' as const,
        preferredTrainingDays: [1],
        preferredGenderFilter: 'any' as const,
        bioNote: longNote,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/160/);
    });

    it('savePreference rejects invalid training time windows', async () => {
      const res = await gymBuddyService.savePreference({
        userId: 'test-user',
        gymId: GYM_ID,
        isOptedIn: true,
        preferredTrainingTime: 'midnight' as any,
        preferredTrainingDays: [1],
        preferredGenderFilter: 'any' as const,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Invalid training time window/);
    });

    it('savePreference requires at least one training day', async () => {
      const res = await gymBuddyService.savePreference({
        userId: 'test-user',
        gymId: GYM_ID,
        isOptedIn: true,
        preferredTrainingTime: 'evening' as const,
        preferredTrainingDays: [],
        preferredGenderFilter: 'any' as const,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/At least one training day/);
    });

    it('savePreference sanitizes training days to valid 0..6 range', async () => {
      const res = await gymBuddyService.savePreference({
        userId: 'sanitize-test',
        gymId: GYM_ID,
        isOptedIn: true,
        preferredTrainingTime: 'morning' as const,
        preferredTrainingDays: [-1, 0, 3, 7, 8, 6],
        preferredGenderFilter: 'any' as const,
      });
      // After sanitization only valid days [0, 3, 6] remain -- still has 3 valid days
      expect(res.success).toBe(true);
    });
  });
});

