/**
 * Central Request Safety Layer — Production Request-Amplification Hardening
 *
 * Provides:
 * 1. Read vs. Mutation Discrimination
 * 2. Strict Central Retry Policy (default retryMode = 'none')
 * 3. Exponential Backoff with Jitter
 * 4. Bounded Timeout via AbortController
 * 5. Single-Flight Request Deduplication (for reads / idempotent requests)
 * 6. Global Error Circuit Breaker (never fake successes for mutations)
 * 7. Request Rate Guard & Loop Detection
 * 8. Development Safety Monitor & Telemetry
 */

export type RequestKind = 'read' | 'mutation';
export type RetryMode = 'none' | 'read-only' | 'idempotent';

export interface SafeRequestOptions<T> {
  kind?: RequestKind; // 'read' | 'mutation' (default: 'read')
  retryMode?: RetryMode; // default 'none'
  maxRetries?: number; // max 3 (only used if retryMode !== 'none')
  timeoutMs?: number; // default: 10,000ms
  deduplicate?: boolean; // default: true for reads, false for mutations
  cacheTtlMs?: number; // optional in-memory cache TTL (reads only)
  signal?: AbortSignal;
  fallbackValue?: T; // ONLY used for reads when circuit is open or on error; NEVER used for mutations
  circuitBreakerKey?: string;
  identityKey?: string;
}

export class CircuitBreakerOpenError extends Error {
  public readonly endpointKey: string;
  public readonly cooldownRemainingMs: number;
  public readonly isMutation: boolean;

  constructor(endpointKey: string, cooldownRemainingMs: number, isMutation: boolean) {
    super(
      `Circuit breaker is OPEN for "${endpointKey}". Cooldown remaining: ${Math.round(
        cooldownRemainingMs / 1000
      )}s. ${isMutation ? 'Mutation rejected for safety.' : 'Read request paused.'}`
    );
    this.name = 'CircuitBreakerOpenError';
    this.endpointKey = endpointKey;
    this.cooldownRemainingMs = cooldownRemainingMs;
    this.isMutation = isMutation;
  }
}

export class RequestTimeoutError extends Error {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, endpointKey?: string) {
    super(`Request timed out after ${timeoutMs}ms${endpointKey ? ` for "${endpointKey}"` : ''}.`);
    this.name = 'RequestTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Classification
// ─────────────────────────────────────────────────────────────────────────────

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 409, 422]);
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// Known Postgres constraint/auth error codes that must never be retried
const NON_RETRYABLE_PG_CODES = new Set([
  '23505', // unique_violation
  '23503', // foreign_key_violation
  '23502', // not_null_violation
  '23514', // check_violation
  '42501', // insufficient_privilege / RLS violation
  '42P01', // undefined_table
  'P0001', // raise_exception
]);

export function isNonRetryableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const anyErr = err as Record<string, any>;
  const status = Number(anyErr.status || anyErr.statusCode || anyErr.code);
  if (NON_RETRYABLE_STATUSES.has(status)) {
    return true;
  }

  const pgCode = String(anyErr.code || anyErr.error_code || anyErr.details?.code || '');
  if (NON_RETRYABLE_PG_CODES.has(pgCode)) {
    return true;
  }

  return false;
}

export function isRetryableError(err: unknown): boolean {
  if (isNonRetryableError(err)) {
    return false;
  }

  if (!err || typeof err !== 'object') return false;
  const anyErr = err as Record<string, any>;

  const status = Number(anyErr.status || anyErr.statusCode);
  if (RETRYABLE_STATUSES.has(status)) {
    return true;
  }

  // Network / fetch TypeError or Timeout / AbortError
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return true;
  }
  if (err instanceof RequestTimeoutError) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exponential Backoff with Full Jitter
// ─────────────────────────────────────────────────────────────────────────────

export function calculateBackoffDelay(
  attempt: number,
  baseMs = 150,
  maxDelayMs = 2000
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs;
  return Math.min(exponential + jitter, maxDelayMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Circuit Breaker State & Logic
// ─────────────────────────────────────────────────────────────────────────────

interface CircuitState {
  failureCount: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  cooldownMs: number;
  probing: boolean;
}

export class CircuitBreakerRegistry {
  private circuits = new Map<string, CircuitState>();
  private readonly FAILURE_THRESHOLD = 5;
  private readonly INITIAL_COOLDOWN_MS = 30000; // 30s
  private readonly MAX_COOLDOWN_MS = 120000; // 2 min

  getState(key: string): CircuitState {
    let circuit = this.circuits.get(key);
    if (!circuit) {
      circuit = {
        failureCount: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
        cooldownMs: this.INITIAL_COOLDOWN_MS,
        probing: false,
      };
      this.circuits.set(key, circuit);
    }
    return circuit;
  }

  recordSuccess(key: string): void {
    const circuit = this.getState(key);
    circuit.failureCount = 0;
    circuit.state = 'CLOSED';
    circuit.cooldownMs = this.INITIAL_COOLDOWN_MS;
    circuit.probing = false;
  }

  recordFailure(key: string, err: unknown): void {
    // Normal client/auth/validation errors DO NOT trip the circuit breaker
    if (isNonRetryableError(err)) {
      return;
    }

    const circuit = this.getState(key);
    circuit.failureCount += 1;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === 'HALF_OPEN') {
      // Probe failed, re-open circuit with extended cooldown
      circuit.state = 'OPEN';
      circuit.cooldownMs = Math.min(circuit.cooldownMs * 2, this.MAX_COOLDOWN_MS);
      circuit.probing = false;
    } else if (circuit.failureCount >= this.FAILURE_THRESHOLD) {
      circuit.state = 'OPEN';
    }
  }

  canExecute(key: string): { allowed: boolean; cooldownRemainingMs: number } {
    const circuit = this.getState(key);
    if (circuit.state === 'CLOSED') {
      return { allowed: true, cooldownRemainingMs: 0 };
    }

    const elapsed = Date.now() - circuit.lastFailureTime;
    if (elapsed > circuit.cooldownMs) {
      // Transition to HALF_OPEN to allow a single probe request
      if (!circuit.probing) {
        circuit.state = 'HALF_OPEN';
        circuit.probing = true;
        return { allowed: true, cooldownRemainingMs: 0 };
      }
      // Another probe is already running, wait for it
      return { allowed: false, cooldownRemainingMs: circuit.cooldownMs - elapsed };
    }

    return { allowed: false, cooldownRemainingMs: circuit.cooldownMs - elapsed };
  }

  reset(): void {
    this.circuits.clear();
  }
}

export const globalCircuitBreaker = new CircuitBreakerRegistry();

// ─────────────────────────────────────────────────────────────────────────────
// Rate Guard & Loop Detection
// ─────────────────────────────────────────────────────────────────────────────

interface SlidingWindow {
  timestamps: number[];
}

export class RequestRateGuard {
  private windows = new Map<string, SlidingWindow>();
  private readonly WINDOW_MS = 5000;
  private readonly WARN_THRESHOLD = 15; // 15 calls in 5 seconds triggers warning
  private readonly THROTTLE_THRESHOLD = 30; // 30 calls in 5 seconds triggers throttle for reads

  recordAndCheck(key: string, kind: RequestKind): { isAmplified: boolean; count: number } {
    const now = Date.now();
    let win = this.windows.get(key);
    if (!win) {
      win = { timestamps: [] };
      this.windows.set(key, win);
    }

    // Retain only timestamps within the sliding window
    win.timestamps = win.timestamps.filter(t => now - t < this.WINDOW_MS);
    win.timestamps.push(now);

    const count = win.timestamps.length;

    if (count >= this.WARN_THRESHOLD && import.meta.env?.DEV) {
      console.warn(
        `[REQUEST AMPLIFICATION DETECTED]\n` +
        `Endpoint: ${key}\n` +
        `Count: ${count} calls in ${this.WINDOW_MS / 1000}s\n` +
        `Kind: ${kind}\n` +
        `Action: Potential render loop, unmemoized hook dependency, or missing debounce!`
      );
    }

    const isAmplified = count >= this.THROTTLE_THRESHOLD;
    return { isAmplified, count };
  }

  reset(): void {
    this.windows.clear();
  }
}

export const globalRateGuard = new RequestRateGuard();

// ─────────────────────────────────────────────────────────────────────────────
// In-Flight Request Deduplication (Single-Flight) & In-Memory Read Cache
// ─────────────────────────────────────────────────────────────────────────────

const inFlightMap = new Map<string, Promise<any>>();
const readCache = new Map<string, { value: any; expiresAt: number }>();

export function clearRequestCaches(): void {
  inFlightMap.clear();
  readCache.clear();
  globalCircuitBreaker.reset();
  globalRateGuard.reset();
}

// ─────────────────────────────────────────────────────────────────────────────
// Central Safe Request Executor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps an asynchronous request with:
 * - Read vs Mutation safety discrimination
 * - Strict retry policy (default 'none')
 * - Single-flight deduplication (reads only)
 * - Bounded timeouts
 * - Circuit breaker protection
 * - Rate guard loop detection
 * - Observability/telemetry
 */
export async function safeRequest<T>(
  identityKey: string,
  executeFn: (signal: AbortSignal) => Promise<T>,
  options: SafeRequestOptions<T> = {}
): Promise<T> {
  const kind: RequestKind = options.kind ?? 'read';
  const retryMode: RetryMode = options.retryMode ?? 'none';
  const maxRetries = retryMode === 'none' ? 0 : Math.min(options.maxRetries ?? 2, 3);
  const timeoutMs = options.timeoutMs ?? 10000;
  const isMutation = kind === 'mutation';
  // Deduplicate reads by default; NEVER deduplicate mutations unless explicitly idempotent
  const shouldDeduplicate = options.deduplicate ?? (!isMutation || retryMode === 'idempotent');
  const circuitKey = options.circuitBreakerKey || identityKey;
  const cacheTtlMs = options.cacheTtlMs ?? 0;

  // 1. Check in-memory read cache if configured
  if (!isMutation && cacheTtlMs > 0) {
    const cached = readCache.get(identityKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
  }

  // 2. Check Circuit Breaker
  const circuitStatus = globalCircuitBreaker.canExecute(circuitKey);
  if (!circuitStatus.allowed) {
    if (isMutation) {
      // REQUIREMENT: The circuit breaker MUST NOT silently convert a mutation failure into a fake success.
      // A circuit breaker may fast-fail reads, but mutations must return a real error.
      // Do not return "cached fallback" for mutation requests.
      throw new CircuitBreakerOpenError(circuitKey, circuitStatus.cooldownRemainingMs, true);
    } else {
      // For reads, if fallback value is provided, safely return fallback
      if (options.fallbackValue !== undefined) {
        return options.fallbackValue;
      }
      throw new CircuitBreakerOpenError(circuitKey, circuitStatus.cooldownRemainingMs, false);
    }
  }

  // 3. Single-Flight Deduplication for Reads / Idempotent Requests
  if (shouldDeduplicate) {
    const existing = inFlightMap.get(identityKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  // 4. Rate Guard & Loop Detection (tracks new execution launches)
  const { isAmplified } = globalRateGuard.recordAndCheck(identityKey, kind);
  if (isAmplified && !isMutation) {
    // If runaway read loop detected, serve cached value if available to protect DB
    const cached = readCache.get(identityKey);
    if (cached) {
      return cached.value as T;
    }
    if (options.fallbackValue !== undefined) {
      return options.fallbackValue;
    }
  }

  // 5. Execute with Timeout & Controlled Retries
  const executionPromise = (async () => {
    let attempt = 0;
    const startTime = Date.now();

    while (attempt <= maxRetries) {
      // AbortController for bounded timeout
      const controller = new AbortController();
      let timeoutId: any = null;

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          controller.abort(new RequestTimeoutError(timeoutMs, identityKey));
        }, timeoutMs);
      }

      // Link external signal if provided
      const onExternalAbort = () => {
        controller.abort(options.signal?.reason);
      };
      if (options.signal) {
        if (options.signal.aborted) {
          controller.abort(options.signal.reason);
        } else {
          options.signal.addEventListener('abort', onExternalAbort);
        }
      }

      try {
        const result = await executeFn(controller.signal);

        // Success! Record to circuit breaker
        globalCircuitBreaker.recordSuccess(circuitKey);

        // Cache read result if TTL specified
        if (!isMutation && cacheTtlMs > 0) {
          readCache.set(identityKey, {
            value: result,
            expiresAt: Date.now() + cacheTtlMs,
          });
        }

        // DEV telemetry
        if (import.meta.env?.DEV) {
          const duration = Date.now() - startTime;
          // Subdued logging to avoid spam
          if (duration > 1500) {
            console.debug(`[API Slow Request] ${kind.toUpperCase()} ${identityKey} took ${duration}ms`);
          }
        }

        return result;
      } catch (err: any) {
        // Record failure in circuit breaker
        globalCircuitBreaker.recordFailure(circuitKey, err);

        // Never retry if error is classified as non-retryable (400, 401, 403, 404, 409, 422, constraint errors)
        if (isNonRetryableError(err)) {
          throw err;
        }

        // Never retry mutations unless retryMode === 'idempotent'
        if (isMutation && retryMode !== 'idempotent') {
          throw err;
        }

        // Check if retry is allowed
        if (attempt < maxRetries && isRetryableError(err)) {
          attempt++;
          const delay = calculateBackoffDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If all retries exhausted or not retryable:
        // For reads with fallback, return fallback
        if (!isMutation && options.fallbackValue !== undefined) {
          return options.fallbackValue;
        }

        throw err;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (options.signal) {
          options.signal.removeEventListener('abort', onExternalAbort);
        }
      }
    }

    throw new Error(`Request failed after ${maxRetries} retries.`);
  })();

  if (shouldDeduplicate) {
    inFlightMap.set(identityKey, executionPromise);
    executionPromise
      .catch(() => {
        // Handled by caller; internal cleanup catch prevents unhandled rejection
      })
      .finally(() => {
        inFlightMap.delete(identityKey);
      });
  }

  return executionPromise;
}
