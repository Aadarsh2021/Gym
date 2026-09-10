import { describe, it, expect } from 'vitest';

/**
 * Idempotency & Duplicate Request Protection Tests
 * Verifies that repeating requests with the same idempotency key produces a safe replay,
 * and different keys on a completed resource return 409 Conflict.
 */

interface SessionState {
  id: string;
  userId: string;
  status: 'in_progress' | 'completed';
  idempotencyKey?: string;
  coinsAwarded: number;
}

class MockWorkoutCompletionEngine {
  private sessions = new Map<string, SessionState>();
  private coinLedger: { userId: string; source: string; refId: string; amount: number }[] = [];

  constructor(initialSession: SessionState) {
    this.sessions.set(initialSession.id, { ...initialSession });
  }

  completeWorkout(callerUserId: string, sessionId: string, idempotencyKey: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== callerUserId) {
      throw new Error('40400: Not found or unauthorized');
    }

    // Idempotent Replay Check
    if (session.status === 'completed') {
      if (session.idempotencyKey === idempotencyKey) {
        return {
          status: 'already_completed',
          sessionId: session.id,
          coinsAwarded: session.coinsAwarded,
        };
      }
      throw new Error('40900: Workout session already finalized with different key');
    }

    // Complete session
    session.status = 'completed';
    session.idempotencyKey = idempotencyKey;
    session.coinsAwarded = 10; // Completion reward

    // Award coin into ledger
    this.coinLedger.push({
      userId: callerUserId,
      source: 'workout_completed',
      refId: sessionId,
      amount: 10,
    });

    return {
      status: 'success',
      sessionId: session.id,
      coinsAwarded: 10,
    };
  }

  getCoinTransactions() {
    return this.coinLedger;
  }
}

describe('Idempotency & Double-Click Concurrency Protection', () => {
  it('should complete workout and award coins on first submission', () => {
    const engine = new MockWorkoutCompletionEngine({
      id: 'session-1',
      userId: 'user-a',
      status: 'in_progress',
      coinsAwarded: 0,
    });

    const result = engine.completeWorkout('user-a', 'session-1', 'key-uuid-123');
    expect(result.status).toBe('success');
    expect(result.coinsAwarded).toBe(10);
    expect(engine.getCoinTransactions().length).toBe(1);
  });

  it('should safely return existing result without duplicate rewards on identical repeated request (Idempotent Replay)', () => {
    const engine = new MockWorkoutCompletionEngine({
      id: 'session-1',
      userId: 'user-a',
      status: 'in_progress',
      coinsAwarded: 0,
    });

    // Request 1
    engine.completeWorkout('user-a', 'session-1', 'key-uuid-123');

    // Request 2 (Network retry or double click with same key)
    const retryResult = engine.completeWorkout('user-a', 'session-1', 'key-uuid-123');
    expect(retryResult.status).toBe('already_completed');
    expect(retryResult.coinsAwarded).toBe(10);

    // CRITICAL: Coin ledger MUST still only have 1 transaction, never 2
    expect(engine.getCoinTransactions().length).toBe(1);
  });

  it('should reject submission with 409 Conflict if session was already completed with a different key', () => {
    const engine = new MockWorkoutCompletionEngine({
      id: 'session-1',
      userId: 'user-a',
      status: 'in_progress',
      coinsAwarded: 0,
    });

    engine.completeWorkout('user-a', 'session-1', 'key-1');

    // Stale or malicious attempt with different key
    expect(() => {
      engine.completeWorkout('user-a', 'session-1', 'different-key-2');
    }).toThrow('40900');
  });
});
