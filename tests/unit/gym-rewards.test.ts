import { describe, it, expect, beforeEach } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { platform } from '@/platform';

describe('Phase G1: Gym Attendance Rewards & Visit Milestone Perks', () => {
  const gymId = 'mock-gym-gold';
  const memberId = 'mock-member-athlete';

  beforeEach(() => {
    platform.storage.removeItem(`gym_rewards_${gymId}`);
    platform.storage.removeItem(`member_redemptions_${memberId}`);
  });

  it('allows gym owner to configure milestone rewards', async () => {
    const createRes = await gymRepository.createGymReward({
      gymId,
      title: 'Free FitBoost Shaker Bottle',
      description: 'Awarded after 15 verified facility visits.',
      requiredVisits: 15,
      isActive: true,
    });

    expect(createRes.success).toBe(true);
    expect(createRes.reward).toBeDefined();
    expect(createRes.reward?.title).toBe('Free FitBoost Shaker Bottle');
    expect(createRes.reward?.requiredVisits).toBe(15);
    expect(createRes.reward?.isActive).toBe(true);

    const list = await gymRepository.fetchGymRewards(gymId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(createRes.reward?.id);
  });

  it('orders configured rewards ascending by required visits', async () => {
    await gymRepository.createGymReward({
      gymId,
      title: '50-Day Gym Bag',
      requiredVisits: 50,
      isActive: true,
    });

    await gymRepository.createGymReward({
      gymId,
      title: '15-Day Shaker',
      requiredVisits: 15,
      isActive: true,
    });

    await gymRepository.createGymReward({
      gymId,
      title: '30-Day Smoothie Pass',
      requiredVisits: 30,
      isActive: true,
    });

    const list = await gymRepository.fetchGymRewards(gymId);
    expect(list.length).toBe(3);
    expect(list[0].requiredVisits).toBe(15);
    expect(list[1].requiredVisits).toBe(30);
    expect(list[2].requiredVisits).toBe(50);
  });

  it('allows member to claim reward and generates FB-REW-XXXXXX format code', async () => {
    const created = await gymRepository.createGymReward({
      gymId,
      title: 'Free FitBoost Shaker Bottle',
      requiredVisits: 15,
      isActive: true,
    });

    const rewardId = created.reward!.id;

    const claimRes = await gymRepository.claimGymReward(rewardId, memberId);
    expect(claimRes.success).toBe(true);
    expect(claimRes.redemption).toBeDefined();
    expect(claimRes.redemption?.rewardId).toBe(rewardId);
    expect(claimRes.redemption?.status).toBe('claimed');

    // Code format verification
    expect(claimRes.redemption?.redemptionCode).toMatch(/^FB-REW-[A-Z0-9]{6}$/);

    const redemptions = await gymRepository.fetchMemberRedemptions(memberId, gymId);
    expect(redemptions.length).toBe(1);
    expect(redemptions[0].redemptionCode).toBe(claimRes.redemption?.redemptionCode);
  });

  it('allows owner to redeem perk at gym desk and transitions status', async () => {
    const created = await gymRepository.createGymReward({
      gymId,
      title: 'Free FitBoost Shaker Bottle',
      requiredVisits: 15,
      isActive: true,
    });

    const claimRes = await gymRepository.claimGymReward(created.reward!.id, memberId);
    const redemptionId = claimRes.redemption!.id;

    // Owner desk redemption
    const redeemRes = await gymRepository.redeemGymReward(redemptionId);
    expect(redeemRes.success).toBe(true);
  });

  it('allows owner to deactivate and delete reward milestones', async () => {
    const created = await gymRepository.createGymReward({
      gymId,
      title: 'Discontinued Perk',
      requiredVisits: 10,
      isActive: true,
    });

    const rewardId = created.reward!.id;

    // Deactivate
    const updateRes = await gymRepository.updateGymReward(rewardId, {
      gymId,
      isActive: false,
    });
    expect(updateRes.success).toBe(true);
    expect(updateRes.reward?.isActive).toBe(false);

    // Delete
    const deleteRes = await gymRepository.deleteGymReward(rewardId, gymId);
    expect(deleteRes.success).toBe(true);

    const list = await gymRepository.fetchGymRewards(gymId);
    expect(list.find(r => r.id === rewardId)).toBeUndefined();
  });
});
