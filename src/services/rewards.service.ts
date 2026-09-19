import { gymRepository } from '@/repositories/gym.repository';
import { FitnessRewardItem, FitnessRewardRedemption, FitnessCoinBalance } from '@/types/rewards.types';
import { logger } from '@/lib/logger';

export const rewardsService = {
  /**
   * Fetch active reward catalog items
   */
  async getCatalog(): Promise<FitnessRewardItem[]> {
    try {
      return await gymRepository.fetchFitnessRewardCatalog();
    } catch (err) {
      logger.error('rewardsService.getCatalog failed', { err });
      throw err;
    }
  },

  /**
   * Fetch current user's authenticated Fitness Coin balance
   */
  async getBalance(): Promise<FitnessCoinBalance> {
    try {
      return await gymRepository.fetchFitnessCoinBalance();
    } catch (err) {
      logger.error('rewardsService.getBalance failed', { err });
      return { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
    }
  },

  /**
   * Redeem a reward item atomically via RPC
   */
  async redeem(rewardId: string): Promise<{
    success: boolean;
    redemptionId?: string;
    redemptionCode?: string;
    rewardTitle?: string;
    coinSpent?: number;
    remainingBalance?: number;
    error?: string;
  }> {
    if (!rewardId) {
      throw new Error('Reward ID is required for redemption');
    }
    return await gymRepository.redeemFitnessReward(rewardId);
  },

  /**
   * Fetch user's previous redemptions
   */
  async getRedemptions(userId: string): Promise<FitnessRewardRedemption[]> {
    if (!userId) return [];
    try {
      return await gymRepository.fetchUserRewardRedemptions(userId);
    } catch (err) {
      logger.error('rewardsService.getRedemptions failed', { err, userId });
      return [];
    }
  },
};
