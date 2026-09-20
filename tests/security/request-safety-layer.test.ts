import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  safeRequest,
  clearRequestCaches,
  CircuitBreakerOpenError,
  RequestTimeoutError,
} from '@/lib/request-safety';
import { dailyMissionRepository } from '@/repositories/daily-mission.repository';
import { dailyMissionService } from '@/services/daily-mission.service';
import { supabase } from '@/lib/supabase';

describe('Production Request Safety Layer — Automated Guardrails', () => {
  beforeEach(() => {
    clearRequestCaches();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearRequestCaches();
    vi.restoreAllMocks();
  });

  // 1. Same request concurrently -> only one network request (Single-flight)
  it('1. deduplicates concurrent identical read requests into a single network execution', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
      return { data: 'mission-result' };
    });

    const [p1, p2, p3] = await Promise.all([
      safeRequest('read:test_daily_mission', fetchFn, { kind: 'read', deduplicate: true }),
      safeRequest('read:test_daily_mission', fetchFn, { kind: 'read', deduplicate: true }),
      safeRequest('read:test_daily_mission', fetchFn, { kind: 'read', deduplicate: true }),
    ]);

    expect(callCount).toBe(1);
    expect(p1).toEqual({ data: 'mission-result' });
    expect(p2).toEqual({ data: 'mission-result' });
    expect(p3).toEqual({ data: 'mission-result' });
  });

  // 2. 401 -> no retry
  it('2. NEVER retries 401 Unauthorized errors', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      const err = new Error('JWT expired');
      (err as any).status = 401;
      throw err;
    });

    await expect(
      safeRequest('read:auth_test', fetchFn, {
        kind: 'read',
        retryMode: 'read-only',
        maxRetries: 3,
      })
    ).rejects.toThrow('JWT expired');

    expect(callCount).toBe(1); // No retries
  });

  // 3. 403 -> no retry
  it('3. NEVER retries 403 Forbidden errors', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      const err = new Error('Permission denied');
      (err as any).status = 403;
      throw err;
    });

    await expect(
      safeRequest('read:auth_test_403', fetchFn, {
        kind: 'read',
        retryMode: 'read-only',
        maxRetries: 3,
      })
    ).rejects.toThrow('Permission denied');

    expect(callCount).toBe(1);
  });

  // 4. 404 -> no retry
  it('4. NEVER retries 404 Not Found errors', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      const err = new Error('Entity not found');
      (err as any).status = 404;
      throw err;
    });

    await expect(
      safeRequest('read:test_404', fetchFn, {
        kind: 'read',
        retryMode: 'read-only',
        maxRetries: 3,
      })
    ).rejects.toThrow('Entity not found');

    expect(callCount).toBe(1);
  });

  // 5. 429 -> limited exponential retry
  it('5. allows bounded retries with exponential backoff on 429 Too Many Requests', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        const err = new Error('Rate limit exceeded');
        (err as any).status = 429;
        throw err;
      }
      return { success: true };
    });

    const result = await safeRequest('read:rate_limit_test', fetchFn, {
      kind: 'read',
      retryMode: 'read-only',
      maxRetries: 3,
    });

    expect(result).toEqual({ success: true });
    expect(callCount).toBe(3);
  });

  // 6. 500 -> limited retry with backoff
  it('6. allows bounded retries on 500 Internal Server Error, stopping after max retries', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      const err = new Error('Database server error');
      (err as any).status = 500;
      throw err;
    });

    await expect(
      safeRequest('read:server_err_test', fetchFn, {
        kind: 'read',
        retryMode: 'read-only',
        maxRetries: 2,
      })
    ).rejects.toThrow('Database server error');

    // 1 initial attempt + 2 retries = 3 calls total
    expect(callCount).toBe(3);
  });

  // 7. Repeated failure -> circuit breaker activates
  it('7. activates circuit breaker after consecutive server failures and fast-fails subsequent calls', async () => {
    const errorFn = vi.fn().mockImplementation(async () => {
      const err = new Error('Database connection down');
      (err as any).status = 503;
      throw err;
    });

    // Trip the circuit breaker (threshold = 5)
    for (let i = 0; i < 5; i++) {
      await expect(
        safeRequest('rpc:failing_service', errorFn, {
          kind: 'read',
          retryMode: 'none',
          circuitBreakerKey: 'rpc:failing_service',
        })
      ).rejects.toThrow();
    }

    // Next request MUST immediately fail with CircuitBreakerOpenError without calling fetchFn
    const callsBefore = errorFn.mock.calls.length;
    await expect(
      safeRequest('rpc:failing_service', errorFn, {
        kind: 'read',
        retryMode: 'none',
        circuitBreakerKey: 'rpc:failing_service',
      })
    ).rejects.toThrow(CircuitBreakerOpenError);

    expect(errorFn.mock.calls.length).toBe(callsBefore); // ZERO additional database calls
  });

  // 8. Circuit breaker NEVER converts mutation failure into fake success
  it('8. Circuit breaker rejects mutations with real error, never fake success or cached fallback', async () => {
    const mutationFn = vi.fn().mockImplementation(async () => {
      const err = new Error('Postgres outage');
      (err as any).status = 500;
      throw err;
    });

    // Trip circuit breaker on endpoint
    for (let i = 0; i < 5; i++) {
      try {
        await safeRequest('mutation:checkout', mutationFn, {
          kind: 'mutation',
          retryMode: 'none',
          circuitBreakerKey: 'checkout_breaker',
        });
      } catch {}
    }

    // Now attempt a mutation while circuit breaker is open
    await expect(
      safeRequest('mutation:checkout', mutationFn, {
        kind: 'mutation',
        retryMode: 'none',
        circuitBreakerKey: 'checkout_breaker',
        fallbackValue: { fake: 'success' }, // Fallback MUST BE IGNORED for mutations!
      })
    ).rejects.toThrow(CircuitBreakerOpenError);
  });

  // 9. Bounded timeout via AbortController
  it('9. enforces bounded request timeout and cancels unresolved requests', async () => {
    const slowFn = vi.fn().mockImplementation(async (signal: AbortSignal) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve('slow-data'), 5000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        });
      });
    });

    await expect(
      safeRequest('read:slow_request', slowFn, {
        kind: 'read',
        timeoutMs: 50,
      })
    ).rejects.toThrow(RequestTimeoutError);
  });

  // 10. Mutation Rapid Click Concurrency Protection
  it('10. guards against double-click/rapid-click race conditions on mission claims', async () => {
    vi.spyOn(dailyMissionRepository, 'claimDailyMission').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
      return {
        status: 'success',
        missionId: 'm-1',
        coinsAwarded: 15,
        completedAt: new Date().toISOString(),
      };
    });

    // Fire two claims simultaneously (rapid user double click)
    const [res1, res2] = await Promise.all([
      dailyMissionService.claimMission('m-1'),
      dailyMissionService.claimMission('m-1'),
    ]);

    // One succeeds, second is rejected by concurrency lock
    expect(res1.success || res2.success).toBe(true);
    expect(res1.error === 'Claim already in progress.' || res2.error === 'Claim already in progress.').toBe(true);
  });

  // 11. Signed-out users never hammer authenticated RPC
  it('11. returns local fallback mission when user is signed out without invoking Supabase RPC', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const rpcSpy = vi.spyOn(supabase, 'rpc');

    const mission = await dailyMissionRepository.getOrCreateDailyMission(true);
    expect(mission).not.toBeNull();
    expect(mission?.id).toBe('offline-mission-1');
    expect(rpcSpy).not.toHaveBeenCalled(); // RPC was NEVER called!
  });

  // 12. Postgres constraint errors (23505) are never retried
  it('12. NEVER retries Postgres constraint violation errors (e.g. 23505 unique violation)', async () => {
    let callCount = 0;
    const constraintFn = vi.fn().mockImplementation(async () => {
      callCount++;
      const err = new Error('duplicate key value violates unique constraint');
      (err as any).code = '23505';
      throw err;
    });

    await expect(
      safeRequest('mutation:unique_check', constraintFn, {
        kind: 'mutation',
        retryMode: 'none',
      })
    ).rejects.toThrow('duplicate key value violates unique constraint');

    expect(callCount).toBe(1); // Zero retries
  });
});
