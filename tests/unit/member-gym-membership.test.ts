import { describe, it, expect, beforeEach } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { gymContextService } from '@/services/gym-context.service';
import { platform } from '@/platform';
import { GymMembership } from '@/types/gym.types';

describe('Member Gym Integration — C2: Member Gym Membership Join & Request', () => {
  const athlete1Id = 'athlete-member-001';
  const athlete2Id = 'athlete-member-002';
  const gymAlphaId = 'gym-facility-alpha';
  const gymBetaId = 'gym-facility-beta';

  beforeEach(() => {
    platform.storage.clear();
  });

  describe('1. Membership Query & Discovery Resolution', () => {
    it('returns null and status "none" when member has no membership record for a gym', async () => {
      const membership = await gymRepository.getMyGymMembership(gymAlphaId, athlete1Id);
      expect(membership).toBeNull();

      const status = await gymRepository.getMembershipStatus(gymAlphaId, athlete1Id);
      expect(status).toBe('none');
    });

    it('returns active membership for an enrolled athlete', async () => {
      const activeRecord: GymMembership = {
        id: 'mem-act-1',
        gymId: gymAlphaId,
        userId: athlete1Id,
        status: 'active',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
      };
      platform.storage.setItem(`user_memberships_${athlete1Id}`, JSON.stringify([activeRecord]));

      const membership = await gymRepository.getMyGymMembership(gymAlphaId, athlete1Id);
      expect(membership).not.toBeNull();
      expect(membership?.status).toBe('active');
      expect(membership?.gymId).toBe(gymAlphaId);

      const status = await gymRepository.getMembershipStatus(gymAlphaId, athlete1Id);
      expect(status).toBe('active');
    });
  });

  describe('2. Join / Request Membership Flow', () => {
    it('creates a new pending membership request when user has no prior membership', async () => {
      const res = await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');

      expect(res.success).toBe(true);
      expect(res.status).toBe('pending');
      expect(res.membership).toBeDefined();
      expect(res.membership?.status).toBe('pending');
      expect(res.membership?.gymId).toBe(gymAlphaId);
      expect(res.membership?.userId).toBe(athlete1Id);
      expect(res.membership?.membershipType).toBe('monthly');

      // Verify persistence in repository lookup
      const stored = await gymRepository.getMyGymMembership(gymAlphaId, athlete1Id);
      expect(stored).not.toBeNull();
      expect(stored?.status).toBe('pending');
    });

    it('prevents duplicate requests when user already has a pending request', async () => {
      // First request
      const first = await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');
      expect(first.success).toBe(true);

      // Second rapid request must be rejected without creating duplicate row
      const second = await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');
      expect(second.success).toBe(false);
      expect(second.status).toBe('pending');
      expect(second.error).toContain('already pending');

      // Only one membership record should exist
      const all = await gymRepository.getMyGymMemberships(athlete1Id);
      expect(all).toHaveLength(1);
    });

    it('prevents join request when user already has an active membership', async () => {
      const activeRecord: GymMembership = {
        id: 'mem-act-2',
        gymId: gymAlphaId,
        userId: athlete1Id,
        status: 'active',
        membershipType: 'annual',
        joinedAt: new Date().toISOString(),
      };
      platform.storage.setItem(`user_memberships_${athlete1Id}`, JSON.stringify([activeRecord]));

      const res = await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');
      expect(res.success).toBe(false);
      expect(res.status).toBe('active');
      expect(res.error).toContain('already an active member');

      // Row remains unchanged
      const current = await gymRepository.getMyGymMembership(gymAlphaId, athlete1Id);
      expect(current?.status).toBe('active');
      expect(current?.membershipType).toBe('annual');
    });

    it('respects frozen membership state and prevents duplicate join requests', async () => {
      const frozenRecord: GymMembership = {
        id: 'mem-frz-1',
        gymId: gymAlphaId,
        userId: athlete1Id,
        status: 'frozen',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
      };
      platform.storage.setItem(`user_memberships_${athlete1Id}`, JSON.stringify([frozenRecord]));

      const res = await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');
      expect(res.success).toBe(false);
      expect(res.status).toBe('frozen');
      expect(res.error).toContain('currently frozen');

      // Remains frozen
      const current = await gymRepository.getMyGymMembership(gymAlphaId, athlete1Id);
      expect(current?.status).toBe('frozen');
    });

    it('handles inactive membership by reactivating it back to pending without creating duplicate row', async () => {
      const inactiveRecord: GymMembership = {
        id: 'mem-inact-1',
        gymId: gymAlphaId,
        userId: athlete1Id,
        status: 'inactive',
        membershipType: 'monthly',
        joinedAt: '2025-01-01T00:00:00.000Z',
      };
      platform.storage.setItem(`user_memberships_${athlete1Id}`, JSON.stringify([inactiveRecord]));

      const res = await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');
      expect(res.success).toBe(true);
      expect(res.status).toBe('pending');
      expect(res.membership?.status).toBe('pending');

      // Still only one membership row for this gym and user
      const all = await gymRepository.getMyGymMemberships(athlete1Id);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('mem-inact-1');
      expect(all[0].status).toBe('pending');
    });
  });

  describe('3. Multi-Gym Memberships & User Isolation', () => {
    it('supports multiple gym memberships for the same user simultaneously', async () => {
      // Join Gym Alpha
      const resA = await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');
      expect(resA.success).toBe(true);

      // Join Gym Beta
      const resB = await gymRepository.requestGymMembership(gymBetaId, athlete1Id, 'quarterly');
      expect(resB.success).toBe(true);

      // Fetch all memberships for athlete1
      const memberships = await gymRepository.getMyGymMemberships(athlete1Id);
      expect(memberships).toHaveLength(2);

      const gymIds = memberships.map(m => m.gymId);
      expect(gymIds).toContain(gymAlphaId);
      expect(gymIds).toContain(gymBetaId);

      // Looking up individual gym returns exact record
      const checkA = await gymRepository.getMyGymMembership(gymAlphaId, athlete1Id);
      expect(checkA?.gymId).toBe(gymAlphaId);
      const checkB = await gymRepository.getMyGymMembership(gymBetaId, athlete1Id);
      expect(checkB?.gymId).toBe(gymBetaId);
    });

    it('preserves strict isolation between different members', async () => {
      // Athlete 1 joins Gym Alpha
      await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');

      // Athlete 2 should have NO membership for Gym Alpha
      const athlete2Status = await gymRepository.getMembershipStatus(gymAlphaId, athlete2Id);
      expect(athlete2Status).toBe('none');

      const athlete2Memberships = await gymRepository.getMyGymMemberships(athlete2Id);
      expect(athlete2Memberships).toHaveLength(0);
    });
  });

  describe('4. Personal Fitness Decoupling & Context Behavior', () => {
    it('keeps member training context as "home" when membership is only pending (requires active status)', async () => {
      // Create pending membership
      await gymRepository.requestGymMembership(gymAlphaId, athlete1Id, 'monthly');

      // Verify gymContextService does NOT consider pending membership as integrated_gym
      const contextResult = await gymContextService.resolveTrainingContext(athlete1Id);
      expect(contextResult.context).toBe('home');
      expect(contextResult.activeMembership).toBeUndefined();
    });

    it('resolves member training context as "integrated_gym" once membership is active', async () => {
      const activeRecord: GymMembership = {
        id: 'mem-act-alpha',
        gymId: gymAlphaId,
        userId: athlete1Id,
        status: 'active',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
      };
      platform.storage.setItem(`user_memberships_${athlete1Id}`, JSON.stringify([activeRecord]));

      const contextResult = await gymContextService.resolveTrainingContext(athlete1Id);
      expect(contextResult.context).toBe('integrated_gym');
      expect(contextResult.activeMembership?.gymId).toBe(gymAlphaId);
      expect(contextResult.activeMembership?.status).toBe('active');
    });
  });
});
