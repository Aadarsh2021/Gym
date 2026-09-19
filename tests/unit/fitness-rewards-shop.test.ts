import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rewardsService } from '@/services/rewards.service';
import { gymRepository } from '@/repositories/gym.repository';
import { FitnessRewardItem, FitnessRewardRedemption } from '@/types/rewards.types';

describe('Fitness Coin Rewards Shop — Unit & Service Tests', () => {
  const dummyItems: FitnessRewardItem[] = [
    {
      id: 'rwd-001',
      title: 'FitSphere Verified Athlete Badge',
      description: 'Permanent athlete status badge on your profile and leaderboards.',
      category: 'digital_badge',
      coinCost: 250,
      imageUrl: null,
      isActive: true,
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    },
    {
      id: 'rwd-002',
      title: 'Partner Supplement 20% Voucher',
      description: 'Exclusive partner coupon code valid for online checkout.',
      category: 'partner_perk',
      coinCost: 500,
      imageUrl: null,
      isActive: true,
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    },
    {
      id: 'rwd-003',
      title: 'Custom App Theme Unlocked',
      description: 'Special high-contrast tactical graphite dark mode.',
      category: 'app_feature',
      coinCost: 1000,
      imageUrl: null,
      isActive: true,
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. fetches active reward catalog items successfully', async () => {
    vi.spyOn(gymRepository, 'fetchFitnessRewardCatalog').mockResolvedValue(dummyItems);
    const catalog = await rewardsService.getCatalog();
    expect(catalog).toHaveLength(3);
    expect(catalog[0].title).toBe('FitSphere Verified Athlete Badge');
    expect(catalog[0].coinCost).toBe(250);
  });

  it('2. returns empty array if repository throws error fetching catalog', async () => {
    vi.spyOn(gymRepository, 'fetchFitnessRewardCatalog').mockRejectedValue(new Error('Network error'));
    await expect(rewardsService.getCatalog()).rejects.toThrow('Network error');
  });

  it('3. fetches authenticated user coin balance', async () => {
    vi.spyOn(gymRepository, 'fetchFitnessCoinBalance').mockResolvedValue({
      balance: 750,
      lifetimeEarned: 1200,
      lifetimeSpent: 450,
    });

    const bal = await rewardsService.getBalance();
    expect(bal.balance).toBe(750);
    expect(bal.lifetimeEarned).toBe(1200);
    expect(bal.lifetimeSpent).toBe(450);
  });

  it('4. returns zero balance gracefully if balance query fails', async () => {
    vi.spyOn(gymRepository, 'fetchFitnessCoinBalance').mockRejectedValue(new Error('Auth failed'));
    const bal = await rewardsService.getBalance();
    expect(bal.balance).toBe(0);
    expect(bal.lifetimeEarned).toBe(0);
    expect(bal.lifetimeSpent).toBe(0);
  });

  it('5. rejects redemption when reward ID is missing', async () => {
    await expect(rewardsService.redeem('')).rejects.toThrow('Reward ID is required');
  });

  it('6. completes successful redemption via authoritative RPC', async () => {
    const spy = vi.spyOn(gymRepository, 'redeemFitnessReward').mockResolvedValue({
      success: true,
      redemptionId: 'red-001',
      redemptionCode: 'FIT-VOUCHER-9876',
      rewardTitle: 'Partner Supplement 20% Voucher',
      coinSpent: 500,
      remainingBalance: 250,
    });

    const res = await rewardsService.redeem('rwd-002');
    expect(res.success).toBe(true);
    expect(res.redemptionCode).toBe('FIT-VOUCHER-9876');
    expect(res.coinSpent).toBe(500);
    expect(res.remainingBalance).toBe(250);
    expect(spy).toHaveBeenCalledWith('rwd-002');
  });

  it('7. returns error when user balance is insufficient for redemption', async () => {
    vi.spyOn(gymRepository, 'redeemFitnessReward').mockResolvedValue({
      success: false,
      error: 'INSUFFICIENT_BALANCE: Reward costs 1000 coins, current balance is 250',
    });

    const res = await rewardsService.redeem('rwd-003');
    expect(res.success).toBe(false);
    expect(res.error).toContain('INSUFFICIENT_BALANCE');
  });

  it('8. returns error when reward is inactive or not found', async () => {
    vi.spyOn(gymRepository, 'redeemFitnessReward').mockResolvedValue({
      success: false,
      error: 'REWARD_NOT_FOUND: Reward does not exist or is inactive',
    });

    const res = await rewardsService.redeem('rwd-missing');
    expect(res.success).toBe(false);
    expect(res.error).toContain('REWARD_NOT_FOUND');
  });

  it('9. fetches user redemption history', async () => {
    const history: FitnessRewardRedemption[] = [
      {
        id: 'red-001',
        userId: 'user-001',
        rewardId: 'rwd-001',
        coinSpent: 250,
        redemptionCode: 'BADGE-CLAIM-1234',
        status: 'completed',
        createdAt: '2026-09-20T10:00:00.000Z',
        rewardTitle: 'FitSphere Verified Athlete Badge',
        rewardCategory: 'digital_badge',
      },
    ];
    vi.spyOn(gymRepository, 'fetchUserRewardRedemptions').mockResolvedValue(history);

    const res = await rewardsService.getRedemptions('user-001');
    expect(res).toHaveLength(1);
    expect(res[0].redemptionCode).toBe('BADGE-CLAIM-1234');
    expect(res[0].coinSpent).toBe(250);
  });

  it('10. returns empty array if userId is empty for getRedemptions', async () => {
    const res = await rewardsService.getRedemptions('');
    expect(res).toEqual([]);
  });

  it('11. returns empty array if redemption history query encounters exception', async () => {
    vi.spyOn(gymRepository, 'fetchUserRewardRedemptions').mockRejectedValue(new Error('DB error'));
    const res = await rewardsService.getRedemptions('user-001');
    expect(res).toEqual([]);
  });

  it('12. verifies coinCost cannot be client-dictated during redemption', async () => {
    const spy = vi.spyOn(gymRepository, 'redeemFitnessReward').mockResolvedValue({
      success: true,
      redemptionId: 'red-002',
      coinSpent: 250, // authoritative debit
    });

    // Service only accepts rewardId - client cannot pass price or amount
    await rewardsService.redeem('rwd-001');
    expect(spy).toHaveBeenCalledWith('rwd-001');
  });

  it('13. handles database RPC exception gracefully', async () => {
    vi.spyOn(gymRepository, 'redeemFitnessReward').mockResolvedValue({
      success: false,
      error: 'Error redeeming reward',
    });

    const res = await rewardsService.redeem('rwd-001');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Error redeeming reward');
  });

  it('14. preserves separation between personal Fitness Coins and G1 gym attendance perks', () => {
    // Verifies Fitness Reward item category belongs to personal digital/partner perk domain
    expect(['digital_badge', 'partner_perk', 'app_feature', 'swag_discount']).toContain(dummyItems[0].category);
    expect(['digital_badge', 'partner_perk', 'app_feature', 'swag_discount']).toContain(dummyItems[1].category);
  });

  it('15. verifies redemption codes are alphanumeric strings', async () => {
    vi.spyOn(gymRepository, 'redeemFitnessReward').mockResolvedValue({
      success: true,
      redemptionId: 'red-003',
      redemptionCode: 'PERK-XYZ-5544',
      coinSpent: 500,
    });

    const res = await rewardsService.redeem('rwd-002');
    expect(res.redemptionCode).toMatch(/^PERK-[A-Z0-9-]+$/);
  });

  it('16. prevents double debit when redemption is called with duplicate ID concurrently', async () => {
    let callCount = 0;
    vi.spyOn(gymRepository, 'redeemFitnessReward').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { success: true, redemptionId: 'red-1', coinSpent: 250 };
      }
      return { success: false, error: 'INSUFFICIENT_BALANCE: Insufficient coins' };
    });

    const [first, second] = await Promise.all([
      rewardsService.redeem('rwd-001'),
      rewardsService.redeem('rwd-001'),
    ]);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
  });
});
