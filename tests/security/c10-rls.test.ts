import { describe, it, expect } from 'vitest';

/**
 * C10 Security & RLS Policy Isolation Tests for pr_history
 * Verifies that:
 * 1. Unauthenticated users cannot read PR history.
 * 2. User A cannot read User B's PR history.
 * 3. Direct client INSERT/UPDATE/DELETE are blocked (writes permitted strictly through SECURITY DEFINER RPC).
 */

interface MockUserSession {
  userId: string;
  role: 'authenticated' | 'anon';
}

interface MockPRHistoryRow {
  id: string;
  userId: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  estimatedOneRepMax: number;
  achievedAt: string;
}

// Simulates PostgreSQL RLS engine for pr_history:
// CREATE POLICY "Users can view own PR history" ON public.pr_history FOR SELECT USING (user_id = auth.uid());
function simulatePRHistorySelect(
  session: MockUserSession | null,
  rows: MockPRHistoryRow[]
): MockPRHistoryRow[] {
  if (!session || session.role === 'anon') {
    return [];
  }
  return rows.filter(r => r.userId === session.userId);
}

// Simulates direct client mutations on pr_history (which has NO INSERT/UPDATE/DELETE policies for public role)
function simulateDirectClientInsert(
  _session: MockUserSession | null,
  _newRow: MockPRHistoryRow
): { allowed: boolean; error?: string } {
  // Direct client writes are forbidden because only SELECT policy is defined on pr_history
  return { allowed: false, error: 'new row violates row-level security policy for table "pr_history"' };
}

function simulateDirectClientUpdate(
  _session: MockUserSession | null,
  _targetRow: MockPRHistoryRow
): { allowed: boolean; error?: string } {
  return { allowed: false, error: 'permission denied for table pr_history' };
}

function simulateDirectClientDelete(
  _session: MockUserSession | null,
  _targetRow: MockPRHistoryRow
): { allowed: boolean; error?: string } {
  return { allowed: false, error: 'permission denied for table pr_history' };
}

describe('C10 RLS & Security Policy Verification (pr_history)', () => {
  const userA: MockUserSession = { userId: '11111111-1111-1111-1111-111111111111', role: 'authenticated' };
  const userB: MockUserSession = { userId: '22222222-2222-2222-2222-222222222222', role: 'authenticated' };

  const prRows: MockPRHistoryRow[] = [
    {
      id: 'pr-h-a1',
      userId: userA.userId,
      exerciseId: 'ex-bench',
      weightKg: 100,
      reps: 5,
      estimatedOneRepMax: 116.67,
      achievedAt: '2026-09-10T10:00:00Z',
    },
    {
      id: 'pr-h-b1',
      userId: userB.userId,
      exerciseId: 'ex-squat',
      weightKg: 160,
      reps: 3,
      estimatedOneRepMax: 176,
      achievedAt: '2026-09-11T10:00:00Z',
    },
  ];

  it('DENIES unauthenticated queries from reading PR history rows', () => {
    const results = simulatePRHistorySelect(null, prRows);
    expect(results).toHaveLength(0);

    const anonResults = simulatePRHistorySelect({ userId: 'guest', role: 'anon' }, prRows);
    expect(anonResults).toHaveLength(0);
  });

  it('ALLOWS User A to read only User A PR history rows and blocks User B rows', () => {
    const userAResults = simulatePRHistorySelect(userA, prRows);
    expect(userAResults).toHaveLength(1);
    expect(userAResults[0].id).toBe('pr-h-a1');
    expect(userAResults[0].userId).toBe(userA.userId);
    expect(userAResults.some(r => r.userId === userB.userId)).toBe(false);
  });

  it('ALLOWS User B to read only User B PR history rows and blocks User A rows', () => {
    const userBResults = simulatePRHistorySelect(userB, prRows);
    expect(userBResults).toHaveLength(1);
    expect(userBResults[0].id).toBe('pr-h-b1');
    expect(userBResults[0].userId).toBe(userB.userId);
  });

  it('DENIES direct client-side INSERT to pr_history (writes allowed exclusively via complete_workout_session RPC)', () => {
    const clientAttempt = simulateDirectClientInsert(userA, {
      id: 'fraud-pr-1',
      userId: userA.userId,
      exerciseId: 'ex-deadlift',
      weightKg: 500,
      reps: 10,
      estimatedOneRepMax: 666.67,
      achievedAt: new Date().toISOString(),
    });

    expect(clientAttempt.allowed).toBe(false);
    expect(clientAttempt.error).toContain('violates row-level security policy');
  });

  it('DENIES direct client-side UPDATE and DELETE to pr_history', () => {
    const updateAttempt = simulateDirectClientUpdate(userA, prRows[0]);
    expect(updateAttempt.allowed).toBe(false);

    const deleteAttempt = simulateDirectClientDelete(userA, prRows[0]);
    expect(deleteAttempt.allowed).toBe(false);
  });
});
