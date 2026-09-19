/**
 * General Fitness Coin Rewards Shop Types
 */

export type FitnessRewardCategory =
  | 'digital_badge'
  | 'partner_perk'
  | 'app_feature'
  | 'swag_discount';

export interface FitnessRewardItem {
  id: string;
  title: string;
  description: string;
  category: FitnessRewardCategory;
  coinCost: number;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FitnessRewardRedemption {
  id: string;
  userId: string;
  rewardId: string;
  coinSpent: number;
  redemptionCode: string;
  status: 'completed' | 'cancelled';
  createdAt: string;
  rewardTitle?: string;
  rewardCategory?: FitnessRewardCategory;
}

export interface FitnessCoinBalance {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}
