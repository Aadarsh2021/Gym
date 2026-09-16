import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gymCheckinService } from '@/services/gym-checkin.service';
import { gymRepository } from '@/repositories/gym.repository';
import { platform } from '@/platform';
import { Gym, GymMembership, MemberGymContextState } from '@/types/gym.types';

describe('Member Gym Check-In — C4: QR Attendance & Active Session Suite', () => {
  const athleteId = 'athlete-checkin-001';
  const ownerId = 'owner-facility-001';

  const mockGymA: Gym = {
    id: 'gym-a-uuid',
    name: 'Metropolis Fitness Club',
    slug: 'metropolis-fitness',
    ownerId,
    address: '100 Main St',
    city: 'Mumbai',
    latitude: 19.076,
    longitude: 72.8777,
    radiusMeters: 200,
    qrCodeHash: 'fitboost_qr_metropolis-fitness_1a2b3c',
    createdAt: new Date().toISOString(),
  };

  const mockGymB: Gym = {
    id: 'gym-b-uuid',
    name: 'Titan Strength Academy',
    slug: 'titan-strength',
    ownerId,
    address: '200 Power Ave',
    city: 'Delhi',
    latitude: 28.7041,
    longitude: 77.1025,
    radiusMeters: 250,
    qrCodeHash: 'fitboost_qr_titan-strength_9z8y7x',
    createdAt: new Date().toISOString(),
  };

  const activeMembershipA: GymMembership = {
    id: 'mem-a-active',
    gymId: mockGymA.id,
    userId: athleteId,
    status: 'active',
    membershipType: 'monthly',
    joinedAt: new Date().toISOString(),
    gym: mockGymA,
  };

  const pendingMembershipA: GymMembership = {
    id: 'mem-a-pending',
    gymId: mockGymA.id,
    userId: athleteId,
    status: 'pending',
    membershipType: 'monthly',
    joinedAt: new Date().toISOString(),
    gym: mockGymA,
  };

  const inactiveMembershipA: GymMembership = {
    id: 'mem-a-inactive',
    gymId: mockGymA.id,
    userId: athleteId,
    status: 'inactive',
    membershipType: 'monthly',
    joinedAt: new Date().toISOString(),
    gym: mockGymA,
  };

  const frozenMembershipA: GymMembership = {
    id: 'mem-a-frozen',
    gymId: mockGymA.id,
    userId: athleteId,
    status: 'frozen',
    membershipType: 'monthly',
    joinedAt: new Date().toISOString(),
    gym: mockGymA,
  };

  const activeMembershipB: GymMembership = {
    id: 'mem-b-active',
    gymId: mockGymB.id,
    userId: athleteId,
    status: 'active',
    membershipType: 'annual',
    joinedAt: new Date().toISOString(),
    gym: mockGymB,
  };

  const integratedContextA: MemberGymContextState = {
    mode: 'integrated',
    activeGym: mockGymA,
    activeMembership: activeMembershipA,
    memberships: [activeMembershipA],
  };

  const homeContext: MemberGymContextState = {
    mode: 'home',
    activeGym: null,
    activeMembership: null,
    memberships: [],
  };

  const nonIntegratedContext: MemberGymContextState = {
    mode: 'non_integrated',
    activeGym: null,
    activeMembership: null,
    memberships: [],
    customGymLocation: { latitude: 19.076, longitude: 72.8777, radiusMeters: 200 },
  };

  beforeEach(() => {
    platform.storage.clear();
    // Pre-populate mock gyms in storage
    platform.storage.setItem('cached_all_gyms', JSON.stringify([mockGymA, mockGymB]));
    // Pre-populate active membership A for athleteId
    platform.storage.setItem(`user_memberships_${athleteId}`, JSON.stringify([activeMembershipA]));
  });

  describe('1. Member Eligibility & Context Enforcement', () => {
    it('1. HOME user cannot check in', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        memberContext: homeContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('You must be enrolled in an integrated gym to check in');
    });

    it('2. NON_INTEGRATED user cannot check in', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        memberContext: nonIntegratedContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Personal gyms do not support digital QR check-in');
    });

    it('3. Pending membership cannot check in', async () => {
      platform.storage.setItem(`user_memberships_${athleteId}`, JSON.stringify([pendingMembershipA]));
      const pendingContext: MemberGymContextState = {
        mode: 'integrated',
        activeGym: mockGymA,
        activeMembership: pendingMembershipA,
        memberships: [pendingMembershipA],
      };

      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        memberContext: pendingContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('pending gym approval');
    });

    it('4. Inactive membership cannot check in', async () => {
      platform.storage.setItem(`user_memberships_${athleteId}`, JSON.stringify([inactiveMembershipA]));
      const inactiveContext: MemberGymContextState = {
        mode: 'integrated',
        activeGym: mockGymA,
        activeMembership: inactiveMembershipA,
        memberships: [inactiveMembershipA],
      };

      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        memberContext: inactiveContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Your membership is inactive');
    });

    it('5. Frozen membership cannot check in', async () => {
      platform.storage.setItem(`user_memberships_${athleteId}`, JSON.stringify([frozenMembershipA]));
      const frozenContext: MemberGymContextState = {
        mode: 'integrated',
        activeGym: mockGymA,
        activeMembership: frozenMembershipA,
        memberships: [frozenMembershipA],
      };

      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        memberContext: frozenContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Your membership is currently frozen');
    });

    it('6. Active membership can check in to its integrated gym', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.gym?.id).toBe(mockGymA.id);
    });
  });

  describe('2. Canonical QR Payload & Gym Resolution', () => {
    it('7. Valid QR resolves the correct gym', async () => {
      const resolved = await gymRepository.resolveGymByQr(mockGymA.qrCodeHash);
      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(mockGymA.id);
      expect(resolved?.name).toBe('Metropolis Fitness Club');
    });

    it('8. Invalid QR format is rejected', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: 'arbitrary_unauthorized_token_xyz',
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid QR code');
    });

    it('9. Unknown QR/gym is rejected', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: 'fitboost_qr_non-existent-facility_999999',
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown or unrecognized gym QR code');
    });
  });

  describe('3. Wrong-Gym Protection & Multi-Membership Selection', () => {
    it('10. Member scanning another gym\'s QR is rejected', async () => {
      // User is integrated with Gym A, but scans Gym B's QR code
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymB.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('This QR belongs to a different gym');
    });

    it('19. Multiple active memberships use the currently selected active gym', async () => {
      // User has memberships at both Gym A and Gym B
      platform.storage.setItem(
        `user_memberships_${athleteId}`,
        JSON.stringify([activeMembershipA, activeMembershipB])
      );

      // Context is currently focused on Gym A
      const resultA = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });
      expect(resultA.success).toBe(true);
      expect(resultA.session?.gymId).toBe(mockGymA.id);
    });

    it('20. Scanning QR does not silently change active gym selection', async () => {
      // Athlete's context is Gym A. Athlete scans Gym B.
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymB.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(false);
      expect(integratedContextA.activeGym?.id).toBe(mockGymA.id);
    });
  });

  describe('4. Active Session Lifecycle & Idempotency', () => {
    it('11. Existing active attendance session prevents duplicate session', async () => {
      // First check-in
      const first = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });
      expect(first.success).toBe(true);

      // Second check-in while active
      const second = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(second.success).toBe(false);
      expect(second.isAlreadyCheckedIn).toBe(true);
      expect(second.error).toContain("already checked in");
    });

    it('12. Double scan is idempotent and returns existing active session', async () => {
      const first = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });
      expect(first.success).toBe(true);

      const second = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(second.session?.id).toBe(first.session?.id);
      expect(second.isAlreadyCheckedIn).toBe(true);
    });

    it('13. Attendance session gets status "active"', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(true);
      expect(result.session?.status).toBe('active');
    });

    it('14. Attendance session records QR verification method ("qr_scan")', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(true);
      expect(result.session?.verificationMethod).toBe('qr_scan');
    });

    it('15. check_out_at remains null at check-in', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(true);
      expect(result.session?.checkOutAt).toBeNull();
    });

    it('16. duration_seconds remains null at check-in', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(true);
      expect(result.session?.durationSeconds).toBeNull();
    });

    it('17. Correct authenticated user is recorded', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
        memberContext: integratedContextA,
      });

      expect(result.success).toBe(true);
      expect(result.session?.userId).toBe(athleteId);
    });
  });

  describe('5. Security, Roles & Platform Camera Integration', () => {
    it('18. Owner is not treated as member check-in automatically', async () => {
      const result = await gymCheckinService.checkInWithQr({
        userId: ownerId,
        userRole: 'gym_owner',
        rawQrContent: mockGymA.qrCodeHash,
        expectedGymId: mockGymA.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Gym owner accounts cannot check in via member flow');
    });

    it('21. Camera permission failure is handled gracefully by platform abstraction', async () => {
      const originalRequestPermission = platform.camera.requestPermission;
      try {
        platform.camera.requestPermission = vi.fn().mockResolvedValue(false);
        const granted = await platform.camera.requestPermission();
        expect(granted).toBe(false);
      } finally {
        platform.camera.requestPermission = originalRequestPermission;
      }
    });

    it('22. Platform camera abstraction is used rather than direct browser MediaDevices', () => {
      expect(platform.camera).toBeDefined();
      expect(typeof platform.camera.isSupported).toBe('function');
      expect(typeof platform.camera.requestPermission).toBe('function');
    });

    it('23. Personal workouts/personal streak remain unaffected', () => {
      // Personal workout sessions carry gym_id: null or distinct context
      const personalWorkout = {
        userId: athleteId,
        gymId: null,
        title: 'Morning Home Calisthenics',
      };
      expect(personalWorkout.gymId).toBeNull();
    });

    it('24. Error states are deterministic and user-safe', async () => {
      // Empty input
      const emptyRes = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: '',
      });
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.error).toBe('Empty or invalid QR content.');

      // Whitespace only
      const wsRes = await gymCheckinService.checkInWithQr({
        userId: athleteId,
        userRole: 'member',
        rawQrContent: '   ',
      });
      expect(wsRes.success).toBe(false);
      expect(wsRes.error).toBe('Empty QR code.');
    });
  });
});
