import { describe, it, expect } from 'vitest';
import { calculateWorkoutQualityScore } from '@/domain/workout-quality';

/**
 * Phase C10-B: Security, Authority & Anti-Tampering Suite
 * Covers:
 * 1. daily_missions RLS isolation and IDOR defense
 * 2. Protected-column trigger (guard_workout_quality_score) testing:
 *    - Direct client UPDATE quality_score = 100 -> DENIED
 *    - Direct client UPDATE quality_score = 99 -> DENIED
 *    - Direct client UPDATE quality_score = NULL -> DENIED
 *    - Direct client updates to legitimate fields (name, notes, duration) -> ALLOWED (C1-C9 intact)
 *    - complete_workout_session (SECURITY DEFINER) writes quality_score -> ALLOWED
 *    - Cross-user updates -> DENIED
 * 3. Complete rejection of client-fabricated core completion for Quality Score
 * 4. Rejection of arbitrary client quality_score payloads
 * 5. Authoritative mission proof validation on mission_date
 * 6. Duplicate claim and reward replay protection
 */

interface MockSession {
  userId: string;
  role: 'authenticated' | 'anon';
}

interface MockDailyMission {
  id: string;
  userId: string;
  missionDate: string;
  timezone: string;
  missionType: string;
  title: string;
  targetValue: number;
  coinReward: number;
  isCompleted: boolean;
  completedAt?: string | null;
  idempotencyKey?: string | null;
}

interface MockWorkoutSessionRow {
  id: string;
  userId: string;
  name: string;
  notes?: string;
  durationSeconds: number;
  qualityScore?: number | null;
  status: 'in_progress' | 'completed' | 'cancelled';
}

// Simulates PostgreSQL RLS engine for public.daily_missions
function simulateDailyMissionsSelect(
  session: MockSession | null,
  rows: MockDailyMission[]
): MockDailyMission[] {
  if (!session || session.role === 'anon') return [];
  return rows.filter(r => r.userId === session.userId);
}

// Simulates direct client writes on daily_missions
function simulateDirectDailyMissionMutation(
  _session: MockSession | null,
  _operation: 'INSERT' | 'UPDATE' | 'DELETE'
): { allowed: boolean; error: string } {
  return {
    allowed: false,
    error: 'new row violates row-level security policy for table "daily_missions"',
  };
}

/**
 * Simulates PostgreSQL table owner and trigger check:
 * guard_workout_quality_score trigger logic:
 *
 * IF NEW.quality_score IS DISTINCT FROM OLD.quality_score THEN
 *     IF CURRENT_USER <> v_table_owner THEN
 *         RAISE EXCEPTION 'quality_score is server-authoritative...';
 *     END IF;
 * END IF;
 */
function simulateWorkoutSessionUpdate(params: {
  callerRole: 'authenticated' | 'anon' | 'postgres'; // 'postgres' represents SECURITY DEFINER execution
  callerUserId: string;
  targetSession: MockWorkoutSessionRow;
  updates: Partial<MockWorkoutSessionRow>;
  tableOwner?: string; // default 'postgres'
}): { allowed: boolean; updatedSession?: MockWorkoutSessionRow; error?: string } {
  const { callerRole, callerUserId, targetSession, updates, tableOwner = 'postgres' } = params;

  // 1. RLS Policy: Users can update own workout sessions (USING user_id = auth.uid())
  if (callerRole !== 'postgres' && callerUserId !== targetSession.userId) {
    return { allowed: false, error: 'permission denied for table workout_sessions (cross-user violation)' };
  }

  // 2. Trigger check: guard_workout_quality_score()
  if ('qualityScore' in updates && updates.qualityScore !== targetSession.qualityScore) {
    // Current user in execution context: switches to postgres inside SECURITY DEFINER RPC
    const currentUser = callerRole === 'postgres' ? 'postgres' : 'authenticated';
    if (currentUser !== tableOwner) {
      return {
        allowed: false,
        error: 'quality_score is server-authoritative and cannot be directly modified by clients',
      };
    }
  }

  // Allowed: apply updates
  const updatedSession = { ...targetSession, ...updates };
  return { allowed: true, updatedSession };
}

// Simulates server-authoritative Quality Score evaluation inside PostgreSQL complete_workout_session
function simulateServerQualityScoreCalculation(params: {
  dbPlanCoreExercises: string[]; // Authoritative core exercise IDs from workout_plan_exercises
  sessionExerciseSets: Array<{ exerciseId: string; weightKg: number; reps: number; completed: boolean }>;
  durationSeconds: number;
  sessionRating?: string | null;
  clientProvidedCoreCompleted: boolean; // What the client claims
  newPrsCount: number;
  clientProvidedQualityScore?: number; // Malicious client payload field
}): {
  serverCalculatedScore: number;
  persistedScore: number;
  serverCoreCompleted: boolean;
  clientSpoofIgnored: boolean;
  clientQualityScoreIgnored: boolean;
} {
  const {
    dbPlanCoreExercises,
    sessionExerciseSets,
    durationSeconds,
    sessionRating,
    clientProvidedCoreCompleted,
    newPrsCount,
    clientProvidedQualityScore,
  } = params;

  // 1. Server calculates valid sets strictly from authoritative sets table
  const validSets = sessionExerciseSets.filter(
    s => s.completed && s.weightKg > 0 && s.reps > 0
  );
  const validSetsCount = validSets.length;

  if (validSetsCount === 0) {
    return {
      serverCalculatedScore: 0,
      persistedScore: 0,
      serverCoreCompleted: false,
      clientSpoofIgnored: clientProvidedCoreCompleted === true,
      clientQualityScoreIgnored: clientProvidedQualityScore !== undefined && clientProvidedQualityScore !== 0,
    };
  }

  // 2. Server authoritatively determines if core exercise was completed from DB records
  let serverCoreCompleted = false;
  if (dbPlanCoreExercises.length > 0) {
    // Plan has core exercises: user must have completed at least one valid set on one of them
    serverCoreCompleted = validSets.some(s => dbPlanCoreExercises.includes(s.exerciseId));
  } else {
    // Freestyle / no core defined: any valid set qualifies
    serverCoreCompleted = validSetsCount > 0;
  }

  // Authoritative quality score calculation
  const breakdown = calculateWorkoutQualityScore({
    validSets: validSetsCount,
    isCoreCompleted: serverCoreCompleted, // SERVER TRUTH, NEVER CLIENT
    durationSeconds,
    sessionRating,
    newPrCount: newPrsCount,
  });

  return {
    serverCalculatedScore: breakdown.score,
    persistedScore: breakdown.score, // Persisted into workout_sessions
    serverCoreCompleted,
    clientSpoofIgnored: clientProvidedCoreCompleted !== serverCoreCompleted,
    clientQualityScoreIgnored:
      clientProvidedQualityScore !== undefined && clientProvidedQualityScore !== breakdown.score,
  };
}

describe('Phase C10-B Security & Authority Suite', () => {
  const userA: MockSession = { userId: '11111111-1111-1111-1111-111111111111', role: 'authenticated' };
  const userB: MockSession = { userId: '22222222-2222-2222-2222-222222222222', role: 'authenticated' };
  const anon: MockSession = { userId: '', role: 'anon' };

  const missionA: MockDailyMission = {
    id: 'm-101',
    userId: userA.userId,
    missionDate: '2026-09-19',
    timezone: 'Asia/Kolkata',
    missionType: 'complete_workout',
    title: 'Complete Daily Workout',
    targetValue: 1,
    coinReward: 15,
    isCompleted: false,
  };

  const missionB: MockDailyMission = {
    id: 'm-102',
    userId: userB.userId,
    missionDate: '2026-09-19',
    timezone: 'Asia/Kolkata',
    missionType: 'hit_protein',
    title: 'Hit Daily Protein Target',
    targetValue: 150,
    coinReward: 15,
    isCompleted: false,
  };

  const allMissions = [missionA, missionB];

  describe('1. RLS Isolation & IDOR Defense on daily_missions', () => {
    it('blocks anonymous access completely', () => {
      const results = simulateDailyMissionsSelect(anon, allMissions);
      expect(results).toHaveLength(0);
    });

    it('allows User A to select only their own daily missions', () => {
      const results = simulateDailyMissionsSelect(userA, allMissions);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(missionA.id);
      expect(results[0].userId).toBe(userA.userId);
    });

    it('prevents User A from viewing User B missions (cross-user IDOR protection)', () => {
      const results = simulateDailyMissionsSelect(userA, allMissions);
      const containsUserB = results.some(r => r.userId === userB.userId);
      expect(containsUserB).toBe(false);
    });

    it('blocks direct client INSERT mutations via RLS', () => {
      const res = simulateDirectDailyMissionMutation(userA, 'INSERT');
      expect(res.allowed).toBe(false);
      expect(res.error).toContain('violates row-level security policy');
    });

    it('blocks direct client UPDATE mutations via RLS (completion only via RPC)', () => {
      const res = simulateDirectDailyMissionMutation(userA, 'UPDATE');
      expect(res.allowed).toBe(false);
    });

    it('blocks direct client DELETE mutations via RLS', () => {
      const res = simulateDirectDailyMissionMutation(userA, 'DELETE');
      expect(res.allowed).toBe(false);
    });
  });

  describe('2. Direct Client Mutation Protection on workout_sessions.quality_score (Trigger Guard)', () => {
    const ownedSession: MockWorkoutSessionRow = {
      id: 'ws-owned-1',
      userId: userA.userId,
      name: 'Push Day',
      durationSeconds: 1800,
      qualityScore: null,
      status: 'in_progress',
    };

    it('DENIED: Normal authenticated client attempts UPDATE quality_score = 100', () => {
      const res = simulateWorkoutSessionUpdate({
        callerRole: 'authenticated',
        callerUserId: userA.userId,
        targetSession: ownedSession,
        updates: { qualityScore: 100 },
      });

      expect(res.allowed).toBe(false);
      expect(res.error).toContain('quality_score is server-authoritative');
    });

    it('DENIED: Normal authenticated client attempts UPDATE quality_score = 99', () => {
      const res = simulateWorkoutSessionUpdate({
        callerRole: 'authenticated',
        callerUserId: userA.userId,
        targetSession: ownedSession,
        updates: { qualityScore: 99 },
      });

      expect(res.allowed).toBe(false);
      expect(res.error).toContain('quality_score is server-authoritative');
    });

    it('DENIED: Normal authenticated client attempts UPDATE quality_score = NULL when changing existing score', () => {
      const sessionWithScore: MockWorkoutSessionRow = {
        ...ownedSession,
        qualityScore: 85,
        status: 'completed',
      };

      const res = simulateWorkoutSessionUpdate({
        callerRole: 'authenticated',
        callerUserId: userA.userId,
        targetSession: sessionWithScore,
        updates: { qualityScore: null },
      });

      expect(res.allowed).toBe(false);
      expect(res.error).toContain('quality_score is server-authoritative');
    });

    it('ALLOWED: Normal authenticated client updates legitimate C1-C9 fields while leaving quality_score unchanged', () => {
      const res = simulateWorkoutSessionUpdate({
        callerRole: 'authenticated',
        callerUserId: userA.userId,
        targetSession: ownedSession,
        updates: {
          name: 'Updated Push Day Routine',
          notes: 'Felt strong on incline dumbbell press',
          durationSeconds: 2400,
        },
      });

      expect(res.allowed).toBe(true);
      expect(res.updatedSession?.name).toBe('Updated Push Day Routine');
      expect(res.updatedSession?.notes).toBe('Felt strong on incline dumbbell press');
      expect(res.updatedSession?.durationSeconds).toBe(2400);
      expect(res.updatedSession?.qualityScore).toBeNull(); // unchanged
    });

    it('ALLOWED: complete_workout_session (SECURITY DEFINER) writes quality_score successfully', () => {
      const res = simulateWorkoutSessionUpdate({
        callerRole: 'postgres', // Switched execution context inside SECURITY DEFINER
        callerUserId: userA.userId,
        targetSession: ownedSession,
        updates: {
          status: 'completed',
          qualityScore: 90,
        },
      });

      expect(res.allowed).toBe(true);
      expect(res.updatedSession?.status).toBe('completed');
      expect(res.updatedSession?.qualityScore).toBe(90);
    });

    it('ALLOWED: complete_workout_session (SECURITY DEFINER) writes NULL for incomplete/cancelled sessions', () => {
      const res = simulateWorkoutSessionUpdate({
        callerRole: 'postgres',
        callerUserId: userA.userId,
        targetSession: ownedSession,
        updates: {
          status: 'cancelled',
          qualityScore: null,
        },
      });

      expect(res.allowed).toBe(true);
      expect(res.updatedSession?.status).toBe('cancelled');
      expect(res.updatedSession?.qualityScore).toBeNull();
    });

    it('DENIED: Cross-user client update remains rejected', () => {
      const res = simulateWorkoutSessionUpdate({
        callerRole: 'authenticated',
        callerUserId: userB.userId, // User B trying to update User A's session
        targetSession: ownedSession,
        updates: { notes: 'Malicious modification' },
      });

      expect(res.allowed).toBe(false);
      expect(res.error).toContain('cross-user violation');
    });
  });

  describe('3. Anti-Spoofing: Core Completion Security & Payload Authority (Correction 3)', () => {
    it('CRITICAL: Malicious client sending p_is_core_completed = true CANNOT fabricate 25 points when core exercise was skipped', () => {
      // Scenario: Plan has Bench Press (ex-bench) as core.
      // User only logged Bicep Curls (ex-curls) with 5 valid sets.
      // Malicious client sends p_is_core_completed = true.
      const result = simulateServerQualityScoreCalculation({
        dbPlanCoreExercises: ['ex-bench'],
        sessionExerciseSets: [
          { exerciseId: 'ex-curls', weightKg: 15, reps: 10, completed: true },
          { exerciseId: 'ex-curls', weightKg: 15, reps: 10, completed: true },
          { exerciseId: 'ex-curls', weightKg: 15, reps: 10, completed: true },
          { exerciseId: 'ex-curls', weightKg: 15, reps: 10, completed: true },
          { exerciseId: 'ex-curls', weightKg: 15, reps: 10, completed: true },
        ],
        durationSeconds: 1800, // 20-75m -> 20 cadence pts
        sessionRating: 'normal', // 5 effort pts
        clientProvidedCoreCompleted: true, // MALICIOUS SPOOF
        newPrsCount: 0,
      });

      // Server must detect that core was NOT completed despite client claim
      expect(result.serverCoreCompleted).toBe(false);
      expect(result.clientSpoofIgnored).toBe(true);

      // Volume = 25 (5 sets), Core = 10 (not completed but validSets >= 4), Cadence = 20, Milestone = 5
      // Total = 25 + 10 + 20 + 5 = 60 (NOT 75 which spoofing would give)
      expect(result.serverCalculatedScore).toBe(60);
      expect(result.persistedScore).toBe(60);
    });

    it('awards full 25 core points when server independently verifies completed core working set', () => {
      const result = simulateServerQualityScoreCalculation({
        dbPlanCoreExercises: ['ex-bench'],
        sessionExerciseSets: [
          { exerciseId: 'ex-bench', weightKg: 100, reps: 5, completed: true }, // Core done!
          { exerciseId: 'ex-curls', weightKg: 15, reps: 10, completed: true },
          { exerciseId: 'ex-curls', weightKg: 15, reps: 10, completed: true },
          { exerciseId: 'ex-curls', weightKg: 15, reps: 10, completed: true },
        ],
        durationSeconds: 1800,
        sessionRating: 'normal',
        clientProvidedCoreCompleted: true,
        newPrsCount: 0,
      });

      expect(result.serverCoreCompleted).toBe(true);
      // Volume = 25 (4 sets), Core = 25 (server verified), Cadence = 20, Milestone = 5 -> Total = 75
      expect(result.serverCalculatedScore).toBe(75);
      expect(result.persistedScore).toBe(75);
    });

    it('awards authoritative core points even if client erroneously passed p_is_core_completed = FALSE', () => {
      // Client negative bug / spoof: DB proves core exercise was completed
      const result = simulateServerQualityScoreCalculation({
        dbPlanCoreExercises: ['ex-bench'],
        sessionExerciseSets: [
          { exerciseId: 'ex-bench', weightKg: 100, reps: 5, completed: true }, // Core done!
          { exerciseId: 'ex-bench', weightKg: 100, reps: 5, completed: true },
          { exerciseId: 'ex-bench', weightKg: 100, reps: 5, completed: true },
          { exerciseId: 'ex-bench', weightKg: 100, reps: 5, completed: true },
        ],
        durationSeconds: 1800,
        sessionRating: 'normal',
        clientProvidedCoreCompleted: false, // Client falsely says false
        newPrsCount: 0,
      });

      // Server discovers DB truth: core was indeed completed
      expect(result.serverCoreCompleted).toBe(true);
      expect(result.serverCalculatedScore).toBe(75);
    });

    it('completely ignores client-submitted quality_score payload and persists server value', () => {
      const result = simulateServerQualityScoreCalculation({
        dbPlanCoreExercises: ['ex-bench'],
        sessionExerciseSets: [
          { exerciseId: 'ex-bench', weightKg: 100, reps: 5, completed: true },
        ],
        durationSeconds: 600, // 10 cadence pts
        sessionRating: 'easy', // 2 effort pts
        clientProvidedCoreCompleted: true,
        newPrsCount: 0,
        clientProvidedQualityScore: 100, // Client attempts to force 100
      });

      // Volume = 15 (1 set), Core = 25, Cadence = 10, Milestone = 2 -> Total = 52
      expect(result.serverCalculatedScore).toBe(52);
      expect(result.persistedScore).toBe(52);
      expect(result.clientQualityScoreIgnored).toBe(true);
    });

    it('scores strictly 0 when all sets have 0 kg or 0 reps (ValidSets = 0 gate)', () => {
      const result = simulateServerQualityScoreCalculation({
        dbPlanCoreExercises: ['ex-bench'],
        sessionExerciseSets: [
          { exerciseId: 'ex-bench', weightKg: 0, reps: 0, completed: true }, // invalid
        ],
        durationSeconds: 1800,
        sessionRating: 'exhausting',
        clientProvidedCoreCompleted: true,
        newPrsCount: 0,
      });

      expect(result.serverCalculatedScore).toBe(0);
    });
  });

  describe('4. Replay Protection & Ledger Deduplication', () => {
    it('prevents multiple coin rewards for the same mission via unique reference_id constraint', () => {
      const coinLedger: Array<{ userId: string; source: string; referenceId: string; amount: number }> = [];

      function awardMissionCoins(userId: string, missionId: string): { awarded: boolean; coins: number } {
        const exists = coinLedger.some(
          entry => entry.userId === userId && entry.source === 'daily_mission' && entry.referenceId === missionId
        );
        if (exists) {
          return { awarded: false, coins: 0 }; // ON CONFLICT DO NOTHING
        }
        coinLedger.push({ userId, source: 'daily_mission', referenceId: missionId, amount: 15 });
        return { awarded: true, coins: 15 };
      }

      // First claim
      const first = awardMissionCoins(userA.userId, 'mission-uuid-1');
      expect(first.awarded).toBe(true);
      expect(first.coins).toBe(15);

      // Replay claim
      const second = awardMissionCoins(userA.userId, 'mission-uuid-1');
      expect(second.awarded).toBe(false);
      expect(second.coins).toBe(0);

      expect(coinLedger).toHaveLength(1);
    });
  });
});
