import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { DailyMission, ClaimMissionResult } from '@/domain/daily-mission';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

export class DailyMissionRepository {
  /**
   * Calls authoritative get_or_create_daily_mission RPC in PostgreSQL.
   * Derives user from auth.uid(), creates context-aware deterministic mission if not present,
   * and checks live proof progress.
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

  async getOrCreateDailyMission(): Promise<DailyMission | null> {
    if (!isSupabaseConfigured) {
      return this.getLocalFallbackMission();
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        return this.getLocalFallbackMission();
      }

      const { data, error } = await supabase.rpc('get_or_create_daily_mission');

      if (error) {
        logger.error('DailyMissionRepository: Error fetching daily mission', { error });
        return this.getLocalFallbackMission();
      }

      if (!data) return this.getLocalFallbackMission();

      return {
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
    } catch (err) {
      logger.error('DailyMissionRepository: Exception in getOrCreateDailyMission', { err });
      return null;
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

    try {
      const { data, error } = await supabase.rpc('claim_daily_mission', {
        p_idempotency_key: idempotencyKey,
        p_mission_id: missionId || null,
      });

      if (error) {
        logger.error('DailyMissionRepository: Error claiming daily mission', { error });
        throw new Error(error.message || 'Failed to claim daily mission');
      }

      return {
        status: data.status || 'success',
        missionId: data.mission_id,
        missionDate: data.mission_date,
        missionType: data.mission_type,
        coinsAwarded: Number(data.coins_awarded) || 0,
        completedAt: data.completed_at,
      };
    } catch (err) {
      logger.error('DailyMissionRepository: Exception in claimDailyMission', { err });
      throw err;
    }
  }
}

export const dailyMissionRepository = new DailyMissionRepository();
