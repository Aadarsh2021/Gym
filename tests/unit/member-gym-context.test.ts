import { describe, it, expect, beforeEach } from 'vitest';
import { deriveMemberGymContext, gymContextService } from '@/services/gym-context.service';
import { platform } from '@/platform';
import { Gym, GymMembership } from '@/types/gym.types';

describe('Member Gym Integration — C3: Member Gym Context Derivation Suite', () => {
  const athleteId = 'athlete-context-001';
  const ownerId = 'owner-facility-001';

  const mockGymAlpha: Gym = {
    id: 'gym-alpha',
    name: 'Iron Pulse Fitness',
    slug: 'iron-pulse',
    ownerId,
    address: '100 Fitness Way',
    city: 'Mumbai',
    latitude: 19.076,
    longitude: 72.8777,
    radiusMeters: 200,
    qrCodeHash: 'qr-pulse',
    createdAt: new Date().toISOString(),
  };

  const mockGymBeta: Gym = {
    id: 'gym-beta',
    name: 'Apex Athletic Club',
    slug: 'apex-athletic',
    ownerId,
    address: '200 Strong Blvd',
    city: 'Delhi',
    latitude: 28.7041,
    longitude: 77.1025,
    radiusMeters: 250,
    qrCodeHash: 'qr-apex',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    platform.storage.clear();
  });

  describe('1. Pure Domain Context Derivation (deriveMemberGymContext)', () => {
    it('resolves mode "home" when user has zero memberships', () => {
      const state = deriveMemberGymContext([]);
      expect(state.mode).toBe('home');
      expect(state.activeGym).toBeNull();
      expect(state.activeMembership).toBeNull();
      expect(state.memberships).toHaveLength(0);
    });

    it('resolves mode "home" when memberships exist but status is "pending"', () => {
      const pending: GymMembership = {
        id: 'mem-1',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'pending',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymAlpha,
      };

      const state = deriveMemberGymContext([pending]);
      expect(state.mode).toBe('home');
      expect(state.activeGym).toBeNull();
      expect(state.activeMembership).toBeNull();
      expect(state.memberships).toHaveLength(1);
    });

    it('resolves mode "home" when memberships exist but status is "inactive"', () => {
      const inactive: GymMembership = {
        id: 'mem-2',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'inactive',
        membershipType: 'monthly',
        joinedAt: '2024-01-01T00:00:00.000Z',
        gym: mockGymAlpha,
      };

      const state = deriveMemberGymContext([inactive]);
      expect(state.mode).toBe('home');
      expect(state.activeGym).toBeNull();
    });

    it('resolves mode "home" when memberships exist but status is "frozen"', () => {
      const frozen: GymMembership = {
        id: 'mem-3',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'frozen',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymAlpha,
      };

      const state = deriveMemberGymContext([frozen]);
      expect(state.mode).toBe('home');
      expect(state.activeGym).toBeNull();
    });

    it('resolves mode "integrated" when user has an active membership and exposes correct gym', () => {
      const active: GymMembership = {
        id: 'mem-4',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'active',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymAlpha,
      };

      const state = deriveMemberGymContext([active]);
      expect(state.mode).toBe('integrated');
      expect(state.activeGym).toEqual(mockGymAlpha);
      expect(state.activeMembership).toEqual(active);
    });

    it('resolves mode "non_integrated" when no active FitBoost membership but user configured custom gym GPS', () => {
      const customLoc = { latitude: 19.1, longitude: 72.8, radiusMeters: 150 };
      const state = deriveMemberGymContext([], customLoc);

      expect(state.mode).toBe('non_integrated');
      expect(state.activeGym).toBeNull();
      if (state.mode === 'non_integrated') {
        expect(state.customGymLocation).toEqual(customLoc);
      }
    });

    it('prioritizes active integrated membership over non-integrated custom gym location', () => {
      const active: GymMembership = {
        id: 'mem-5',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'active',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymAlpha,
      };
      const customLoc = { latitude: 19.1, longitude: 72.8, radiusMeters: 150 };

      const state = deriveMemberGymContext([active], customLoc);
      expect(state.mode).toBe('integrated');
      expect(state.activeGym?.id).toBe(mockGymAlpha.id);
    });

    it('remains non-integrated when user has both custom location and pending membership', () => {
      const pending: GymMembership = {
        id: 'mem-6',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'pending',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymAlpha,
      };
      const customLoc = { latitude: 19.1, longitude: 72.8, radiusMeters: 150 };

      const state = deriveMemberGymContext([pending], customLoc);
      expect(state.mode).toBe('non_integrated');
      expect(state.activeGym).toBeNull();
    });

    it('handles multiple non-active memberships without triggering integrated mode', () => {
      const pending: GymMembership = {
        id: 'mem-p',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'pending',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymAlpha,
      };
      const frozen: GymMembership = {
        id: 'mem-f',
        gymId: mockGymBeta.id,
        userId: athleteId,
        status: 'frozen',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymBeta,
      };

      const state = deriveMemberGymContext([pending, frozen]);
      expect(state.mode).toBe('home');
      expect(state.activeGym).toBeNull();
    });

    it('selects preferred active gym deterministically when multiple active memberships exist', () => {
      const activeAlpha: GymMembership = {
        id: 'mem-act-a',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'active',
        membershipType: 'monthly',
        joinedAt: '2026-01-01T00:00:00.000Z',
        gym: mockGymAlpha,
      };
      const activeBeta: GymMembership = {
        id: 'mem-act-b',
        gymId: mockGymBeta.id,
        userId: athleteId,
        status: 'active',
        membershipType: 'quarterly',
        joinedAt: '2026-02-01T00:00:00.000Z',
        gym: mockGymBeta,
      };

      // With preferred Gym Alpha
      const stateAlpha = deriveMemberGymContext([activeAlpha, activeBeta], undefined, mockGymAlpha.id);
      expect(stateAlpha.mode).toBe('integrated');
      expect(stateAlpha.activeGym?.id).toBe(mockGymAlpha.id);

      // With preferred Gym Beta
      const stateBeta = deriveMemberGymContext([activeAlpha, activeBeta], undefined, mockGymBeta.id);
      expect(stateBeta.mode).toBe('integrated');
      expect(stateBeta.activeGym?.id).toBe(mockGymBeta.id);

      // Without preference, sorts deterministically by joinedAt descending (Gym Beta joined in Feb)
      const stateDefault = deriveMemberGymContext([activeAlpha, activeBeta], undefined, null);
      expect(stateDefault.mode).toBe('integrated');
      expect(stateDefault.activeGym?.id).toBe(mockGymBeta.id);
    });
  });

  describe('2. End-to-End Service Resolution & Persistence Sync', () => {
    it('resolves member gym context end-to-end for an authenticated athlete with active membership', async () => {
      const activeMembership: GymMembership = {
        id: 'mem-srv-1',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'active',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymAlpha,
      };
      platform.storage.setItem(`user_memberships_${athleteId}`, JSON.stringify([activeMembership]));

      const result = await gymContextService.resolveMemberGymContext(athleteId);
      expect(result.mode).toBe('integrated');
      expect(result.activeGym?.name).toBe('Iron Pulse Fitness');
      expect(result.activeMembership?.id).toBe('mem-srv-1');
      expect(result.memberships).toHaveLength(1);
    });

    it('returns mode "home" for guest or empty user without throwing errors', async () => {
      const guestResult = await gymContextService.resolveMemberGymContext('guest-user');
      expect(guestResult.mode).toBe('home');
      expect(guestResult.activeGym).toBeNull();

      const emptyResult = await gymContextService.resolveMemberGymContext('');
      expect(emptyResult.mode).toBe('home');
    });

    it('supports switching active gym preference for multi-gym athletes', async () => {
      const activeAlpha: GymMembership = {
        id: 'mem-multi-1',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'active',
        membershipType: 'monthly',
        joinedAt: '2026-01-01T00:00:00.000Z',
        gym: mockGymAlpha,
      };
      const activeBeta: GymMembership = {
        id: 'mem-multi-2',
        gymId: mockGymBeta.id,
        userId: athleteId,
        status: 'active',
        membershipType: 'quarterly',
        joinedAt: '2026-02-01T00:00:00.000Z',
        gym: mockGymBeta,
      };
      platform.storage.setItem(`user_memberships_${athleteId}`, JSON.stringify([activeAlpha, activeBeta]));

      // Set preference to Alpha
      gymContextService.setActiveGymPreference(athleteId, mockGymAlpha.id);
      const resA = await gymContextService.resolveMemberGymContext(athleteId);
      expect(resA.activeGym?.id).toBe(mockGymAlpha.id);

      // Switch preference to Beta
      gymContextService.setActiveGymPreference(athleteId, mockGymBeta.id);
      const resB = await gymContextService.resolveMemberGymContext(athleteId);
      expect(resB.activeGym?.id).toBe(mockGymBeta.id);
    });

    it('preserves backward-compatible resolveTrainingContext adapter', async () => {
      const activeMembership: GymMembership = {
        id: 'mem-srv-legacy',
        gymId: mockGymAlpha.id,
        userId: athleteId,
        status: 'active',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGymAlpha,
      };
      platform.storage.setItem(`user_memberships_${athleteId}`, JSON.stringify([activeMembership]));

      const legacy = await gymContextService.resolveTrainingContext(athleteId);
      expect(legacy.context).toBe('integrated_gym');
      expect(legacy.activeMembership?.gymId).toBe(mockGymAlpha.id);
    });

    it('guarantees owner accounts do NOT automatically become integrated gym members', async () => {
      // Owner has created gyms but has zero memberships
      const ownerGyms = [mockGymAlpha];
      platform.storage.setItem(`owner_gyms_${ownerId}`, JSON.stringify(ownerGyms));

      const ownerContext = await gymContextService.resolveMemberGymContext(ownerId);
      expect(ownerContext.mode).toBe('home');
      expect(ownerContext.activeGym).toBeNull();
      expect(ownerContext.activeMembership).toBeNull();
    });
  });
});
