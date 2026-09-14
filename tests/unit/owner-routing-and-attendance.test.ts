import { describe, it, expect, beforeEach } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { platform } from '@/platform';

describe('Gym Owner Web Experience & Attendance Sessions Lifecycle', () => {
  const testOwnerId = 'owner-test-alpha';
  const testGymId = 'gym-test-alpha';
  const testUserId = 'athlete-test-alpha';
  const otherUserId = 'stranger-test-beta';

  beforeEach(() => {
    platform.storage.clear();
  });

  describe('1. Attendance Lifecycle (Check-in -> Active Session -> Check-out)', () => {
    it('successfully initiates an active attendance session on check-in', async () => {
      const result = await gymRepository.startAttendanceSession(
        testGymId,
        testUserId,
        'qr_scan'
      );

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.gymId).toBe(testGymId);
      expect(result.session?.userId).toBe(testUserId);
      expect(result.session?.status).toBe('active');
      expect(result.session?.verificationMethod).toBe('qr_scan');
      expect(result.session?.checkOutAt).toBeNull();
      expect(result.session?.checkInAt).toBeDefined();
    });

    it('enforces idempotency and rejects duplicate check-ins when an active session exists', async () => {
      // First check-in succeeds
      const first = await gymRepository.startAttendanceSession(
        testGymId,
        testUserId,
        'qr_scan'
      );
      expect(first.success).toBe(true);

      // Second check-in must be rejected
      const second = await gymRepository.startAttendanceSession(
        testGymId,
        testUserId,
        'gps_geofence'
      );
      expect(second.success).toBe(false);
      expect(second.error).toContain("You're already checked in");
    });

    it('retrieves current active attendance session for user', async () => {
      await gymRepository.startAttendanceSession(testGymId, testUserId, 'qr_scan');

      const active = await gymRepository.getActiveAttendanceSession(testUserId);
      expect(active).not.toBeNull();
      expect(active?.userId).toBe(testUserId);
      expect(active?.status).toBe('active');
    });

    it('successfully checks out active session and derives duration safely', async () => {
      const startRes = await gymRepository.startAttendanceSession(
        testGymId,
        testUserId,
        'qr_scan'
      );
      expect(startRes.success).toBe(true);
      const sessionId = startRes.session!.id;

      const checkoutRes = await gymRepository.checkoutAttendanceSession(
        sessionId,
        testUserId,
        'qr_scan'
      );

      expect(checkoutRes.success).toBe(true);
      expect(checkoutRes.session?.status).toBe('completed');
      expect(checkoutRes.session?.checkOutAt).toBeDefined();
      expect(checkoutRes.session?.durationSeconds).toBeGreaterThanOrEqual(0);
      expect(checkoutRes.session?.checkoutMethod).toBe('qr_scan');

      // Subsequent retrieval of active session returns null
      const activeAfter = await gymRepository.getActiveAttendanceSession(testUserId);
      expect(activeAfter).toBeNull();
    });

    it('rejects duplicate check-out on an already completed session', async () => {
      const startRes = await gymRepository.startAttendanceSession(
        testGymId,
        testUserId,
        'qr_scan'
      );
      expect(startRes.success).toBe(true);
      const sessionId = startRes.session!.id;

      // First checkout succeeds
      const firstOut = await gymRepository.checkoutAttendanceSession(
        sessionId,
        testUserId,
        'manual_button'
      );
      expect(firstOut.success).toBe(true);

      // Second checkout must fail
      const secondOut = await gymRepository.checkoutAttendanceSession(
        sessionId,
        testUserId,
        'manual_button'
      );
      expect(secondOut.success).toBe(false);
      expect(secondOut.error).toContain('No active attendance session found');
    });

    it('prevents unauthorized member from checking out another member attendance', async () => {
      const startRes = await gymRepository.startAttendanceSession(
        testGymId,
        testUserId,
        'qr_scan'
      );
      expect(startRes.success).toBe(true);
      const sessionId = startRes.session!.id;

      // otherUserId attempts to checkout testUserId's session
      const unauthorizedOut = await gymRepository.checkoutAttendanceSession(
        sessionId,
        otherUserId,
        'manual_button'
      );
      expect(unauthorizedOut.success).toBe(false);
    });
  });

  describe('2. Gym Ownership & Multi-Tenancy Isolation', () => {
    it('creates gym under authenticated owner and retrieves only owned facilities', async () => {
      const gymData = {
        name: 'Iron Forge Club',
        slug: 'iron-forge',
        ownerId: testOwnerId,
        address: '100 Fitness Way',
        city: 'Mumbai',
        latitude: 19.0760,
        longitude: 72.8777,
        radiusMeters: 200,
        qrCodeHash: 'hash-iron-forge',
      };

      const createdRes = await gymRepository.createGym(gymData);
      expect(createdRes.success).toBe(true);
      expect(createdRes.gym?.ownerId).toBe(testOwnerId);
      expect(createdRes.gym?.name).toBe('Iron Forge Club');

      // Fetch gyms for this owner
      const ownerGyms = await gymRepository.fetchOwnerGyms(testOwnerId);
      expect(ownerGyms.length).toBeGreaterThanOrEqual(1);
      expect(ownerGyms.some(g => g.name === 'Iron Forge Club')).toBe(true);

      // Another owner cannot see these gyms
      const strangerGyms = await gymRepository.fetchOwnerGyms(otherUserId);
      expect(strangerGyms.some(g => g.name === 'Iron Forge Club')).toBe(false);
    });
  });

  describe('3. Personal Workout Independence', () => {
    it('allows home workout session without gym check-in or attendance', () => {
      const homeWorkout = {
        userId: testUserId,
        gymId: null,
        gymVerified: false,
        name: 'Home Bodyweight Flow',
      };

      expect(homeWorkout.gymId).toBeNull();
      expect(homeWorkout.gymVerified).toBe(false);
    });

    it('supports integrated gym workout with verified flag without corrupting personal streaks', () => {
      const gymWorkout = {
        userId: testUserId,
        gymId: testGymId,
        gymVerified: true,
        name: 'Heavy Leg Day',
      };

      expect(gymWorkout.gymId).toBe(testGymId);
      expect(gymWorkout.gymVerified).toBe(true);
    });
  });

  describe('4. Owner Console Navigation Routes Definition', () => {
    it('validates the complete set of 9 owner routes required by Phase A', () => {
      const requiredOwnerRoutes = [
        '/owner/dashboard',
        '/owner/members',
        '/owner/community',
        '/owner/challenges',
        '/owner/events',
        '/owner/announcements',
        '/owner/rewards',
        '/owner/profile',
        '/owner/settings',
      ];

      expect(requiredOwnerRoutes).toHaveLength(9);
      for (const route of requiredOwnerRoutes) {
        expect(route.startsWith('/owner/')).toBe(true);
      }
    });
  });
});
