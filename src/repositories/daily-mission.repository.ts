import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { DailyMission, ClaimMissionResult } from '@/domain/daily-mission';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';
import { safeRequest } from '@/lib/request-safety';

export class DailyMissionRepository {
  /**
   * Authoritative local fallback mission used when offline, unauthenticated,
   * or when database circuit breaker is open.
   */
  getLocalFallbackMission(): DailyMission {
    const stored = platform.storage.getItem('daily_mission_offline');
    if (stored && typeof stored === 'string') {
      try {
        return JSON.parse(stored);
      } catch {
        /* ignore */
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: 'offline-mission-1',
      userId: 'offline-user',
      missionDate: today,
      timezone: 'Asia/Kolkata',
      missionType: 'complete_workout',
      title: 'Complete Daily Workout',
      description: 'Log and complete a full training session today.',
      targetValue: 1,
      coinReward: 15,
      isCompleted: false,
      progressValue: 0,
      isClaimable: false,
      isExpired: false,
    };
  }

  private cachedMission: DailyMission | null = null;
  private lastFetchTimestamp: number = 0;
  private readonly MISSION_CACHE_TTL_MS = 60 * 1000; // 60s throttle
  private consecutiveErrorCount: number = 0;
  private lastErrorTimestamp: number = 0;
  private readonly BASE_ERROR_BACKOFF_MS = 30 * 1000; // 30s initial backoff on RPC error

  /**
   * Reset in-memory cache and backoff state (useful for testing)
   */
  resetCache(): void {
    this.cachedMission = null;
    this.lastFetchTimestamp = 0;
    this.consecutiveErrorCount = 0;
    this.lastErrorTimestamp = 0;
  }

  async getOrCreateDailyMission(forceRefresh = false): Promise<DailyMission | null> {
    if (!isSupabaseConfigured) {
      return this.getLocalFallbackMission();
    }

    const now = Date.now();

    // 1. In-memory fast cache check
    if (!forceRefresh && this.cachedMission && now - this.lastFetchTimestamp < this.MISSION_CACHE_TTL_MS) {
      return this.cachedMission;
    }

    // 2. Exponential error backoff: If repeated errors occurred, back off without hitting the DB
    if (!forceRefresh && this.consecutiveErrorCount > 0) {
      const backoffMs = Math.min(
        this.BASE_ERROR_BACKOFF_MS * Math.pow(2, this.consecutiveErrorCount - 1),
        120000 // max 2 min backoff
      );
      if (now - this.lastErrorTimestamp < backoffMs) {
        return this.cachedMission || this.getLocalFallbackMission();
      }
    }

    // 3. Auth Check: Signed-out or unauthenticated users must NEVER call authenticated RPC
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user?.id) {
        return this.getLocalFallbackMission();
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const identityKey = `daily_mission:${user.id}:${todayStr}`;

      // 4. Safe single-flight request with deduplication, bounded retries (read-only), and circuit breaker
      const mission = await safeRequest<DailyMission>(
        identityKey,
        async () => {
          const { data, error } = await supabase.rpc('get_or_create_daily_mission');

          if (error) {
            throw error;
          }

          if (!data) {
            return this.getLocalFallbackMission();
          }

          const parsedMission: DailyMission = {
            id: data.id,
            userId: data.user_id,
            missionDate: data.mission_date,
            timezone: data.timezone || 'Asia/Kolkata',
            missionType: data.mission_type,
            title: data.title,
            description: data.description,
            targetValue: Number(data.target_value) || 1,
            coinReward: Number(data.coin_reward) || 15,
            isCompleted: Boolean(data.is_completed),
            completedAt: data.completed_at || null,
            progressValue: Number(data.progress_value) || 0,
            isClaimable: Boolean(data.is_claimable),
            isExpired: Boolean(data.is_expired),
            createdAt: data.created_at,
          };

          return parsedMission;
        },
        {
          kind: 'read',
          retryMode: 'read-only',
          maxRetries: 2,
          timeoutMs: 8000,
          deduplicate: true,
          cacheTtlMs: this.MISSION_CACHE_TTL_MS,
          circuitBreakerKey: 'rpc:get_or_create_daily_mission',
          fallbackValue: this.cachedMission || this.getLocalFallbackMission(),
        }
      );

      this.consecutiveErrorCount = 0;
      this.cachedMission = mission;
      this.lastFetchTimestamp = Date.now();
      return mission;
    } catch (err) {
      this.consecutiveErrorCount += 1;
      this.lastErrorTimestamp = Date.now();
      logger.error('DailyMissionRepository: Exception in getOrCreateDailyMission', { err });
      return this.cachedMission || this.getLocalFallbackMission();
    }
  }

  /**
   * Calls authoritative claim_daily_mission RPC in PostgreSQL.
   * Performs server-side proof verification on mission_date, validates grace period,
   * and credits 15 Fitness Coins.
   */
  async claimDailyMission(
    idempotencyKey: string,
    missionId?: string
  ): Promise<ClaimMissionResult> {
    if (!isSupabaseConfigured) {
      // Offline fallback
      return {
        status: 'success',
        missionId: missionId || 'offline-mission-1',
        coinsAwarded: 15,
        completedAt: new Date().toISOString(),
      };
    }

    // MUTATION: retryMode is strictly 'none'. Circuit breaker never converts failure into fake success.
    const identityKey = `mutation:claim_daily_mission:${idempotencyKey}`;

    return safeRequest<ClaimMissionResult>(
      identityKey,
      async () => {
        const { data, error } = await supabase.rpc('claim_daily_mission', {
          p_idempotency_key: idempotencyKey,
          p_mission_id: missionId || null,
        });

        if (error) {
          logger.error('DailyMissionRepository: Error claiming daily mission', { error });
          throw new Error(error.message || 'Failed to claim daily mission');
        }

        // Invalidate read cache upon successful claim
        this.cachedMission = null;
        this.lastFetchTimestamp = 0;

        return {
          status: data.status || 'success',
          missionId: data.mission_id,
          missionDate: data.mission_date,
          missionType: data.mission_type,
          coinsAwarded: Number(data.coins_awarded) || 0,
          completedAt: data.completed_at,
        };
      },
      {
        kind: 'mutation',
        retryMode: 'none',
        deduplicate: false,
        timeoutMs: 10000,
        circuitBreakerKey: 'rpc:claim_daily_mission',
        // Note: NO fallbackValue for mutations! Mutations must throw real errors!
      }
    );
  }
}

export const dailyMissionRepository = new DailyMissionRepository();
