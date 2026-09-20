import { dailyMissionRepository } from '@/repositories/daily-mission.repository';
import { DailyMission, ClaimMissionResult } from '@/domain/daily-mission';
import { logger } from '@/lib/logger';

export class DailyMissionService {
  private activeClaimLock: boolean = false;

  /**
   * Retrieves or assigns today's authoritative daily mission.
   */
  async getTodayMission(): Promise<DailyMission | null> {
    try {
      return await dailyMissionRepository.getOrCreateDailyMission();
    } catch (err) {
      logger.error('DailyMissionService: Error getting today mission', { err });
      return null;
    }
  }

  /**
   * Authoritatively claims the completed daily mission reward.
   * Enforces client-side single-flight concurrency lock to prevent double-click / rapid-click mutation races.
   */
  async claimMission(missionId?: string): Promise<{
    success: boolean;
    result?: ClaimMissionResult;
    error?: string;
  }> {
    if (this.activeClaimLock) {
      return { success: false, error: 'Claim already in progress.' };
    }

    this.activeClaimLock = true;
    try {
      const idempotencyKey = `claim_mission_${missionId || 'active'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const result = await dailyMissionRepository.claimDailyMission(idempotencyKey, missionId);
      return { success: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim daily mission reward';
      logger.error('DailyMissionService: Error claiming mission', { err });
      return { success: false, error: message };
    } finally {
      this.activeClaimLock = false;
    }
  }
}

export const dailyMissionService = new DailyMissionService();
