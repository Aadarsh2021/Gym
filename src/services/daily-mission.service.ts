import { dailyMissionRepository } from '@/repositories/daily-mission.repository';
import { DailyMission, ClaimMissionResult } from '@/domain/daily-mission';
import { logger } from '@/lib/logger';

export class DailyMissionService {
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
   */
  async claimMission(missionId?: string): Promise<{
    success: boolean;
    result?: ClaimMissionResult;
    error?: string;
  }> {
    try {
      const idempotencyKey = `claim_mission_${missionId || 'active'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const result = await dailyMissionRepository.claimDailyMission(idempotencyKey, missionId);
      return { success: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim daily mission reward';
      logger.error('DailyMissionService: Error claiming mission', { err });
      return { success: false, error: message };
    }
  }
}

export const dailyMissionService = new DailyMissionService();
