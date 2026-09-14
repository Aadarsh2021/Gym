import { gymRepository } from '@/repositories/gym.repository';
import { profileRepository } from '@/repositories/profile.repository';
import { isWithinGymRadius } from '@/utils/geo';
import {
  MemberTrainingContext,
  GymVerificationResult,
  GymMembership,
  Gym,
} from '@/types/gym.types';
import { platform } from '@/platform';
import { logger } from '@/lib/logger';

export const gymContextService = {
  /**
   * Resolves the current member training context:
   * 1. 'integrated_gym' if user belongs to an active FitBoost-registered gym
   * 2. 'non_integrated_gym' if user has set custom gym GPS coordinates
   * 3. 'home' if no gym coordinates or memberships exist
   */
  async resolveTrainingContext(userId: string): Promise<{
    context: MemberTrainingContext;
    activeMembership?: GymMembership;
    customGymLocation?: { latitude: number; longitude: number; radiusMeters: number };
  }> {
    try {
      const memberships = await gymRepository.fetchUserMemberships(userId);
      const activeMembership = memberships.find(m => m.status === 'active');

      if (activeMembership) {
        return { context: 'integrated_gym', activeMembership };
      }

      const fitnessProfile = await profileRepository.fetchFitnessProfile(userId);
      if (fitnessProfile?.gymLatitude && fitnessProfile?.gymLongitude) {
        return {
          context: 'non_integrated_gym',
          customGymLocation: {
            latitude: fitnessProfile.gymLatitude,
            longitude: fitnessProfile.gymLongitude,
            radiusMeters: fitnessProfile.gymRadiusMeters || 200,
          },
        };
      }

      return { context: 'home' };
    } catch (err) {
      logger.error('gymContextService: Error resolving training context', { err });
      return { context: 'home' };
    }
  },

  /**
   * Performs soft GPS proximity check against registered gym or user's custom gym pin.
   */
  async verifyGymProximity(
    userId: string,
    targetGym?: Gym
  ): Promise<GymVerificationResult> {
    if (!platform.location.isSupported()) {
      return {
        verified: false,
        context: 'home',
        message: 'Location service is not supported on this device.',
      };
    }

    try {
      const coords = await platform.location.getCurrentPosition();

      // Case 1: Checking against an Integrated Gym
      if (targetGym) {
        const check = isWithinGymRadius(
          coords.latitude,
          coords.longitude,
          targetGym.latitude,
          targetGym.longitude,
          targetGym.radiusMeters
        );

        if (check.isNearby) {
          await gymRepository.recordCheckin(targetGym.id, userId, 'gps_geofence');
        }

        return {
          verified: check.isNearby,
          context: 'integrated_gym',
          method: 'gps_geofence',
          distanceMeters: check.distanceMeters,
          gymId: targetGym.id,
          gymName: targetGym.name,
          message: check.isNearby
            ? `Verified at ${targetGym.name} (${check.distanceMeters}m away)`
            : `Outside gym perimeter (${check.distanceMeters}m away, required within ${targetGym.radiusMeters}m)`,
        };
      }

      // Case 2: Checking against Non-Integrated Custom Coordinates
      const fitnessProfile = await profileRepository.fetchFitnessProfile(userId);
      if (fitnessProfile?.gymLatitude && fitnessProfile?.gymLongitude) {
        const radius = fitnessProfile.gymRadiusMeters || 200;
        const check = isWithinGymRadius(
          coords.latitude,
          coords.longitude,
          fitnessProfile.gymLatitude,
          fitnessProfile.gymLongitude,
          radius
        );

        return {
          verified: check.isNearby,
          context: 'non_integrated_gym',
          method: 'gps_geofence',
          distanceMeters: check.distanceMeters,
          message: check.isNearby
            ? `Verified at training center (${check.distanceMeters}m away)`
            : `Outside training center radius (${check.distanceMeters}m away)`,
        };
      }

      return {
        verified: false,
        context: 'home',
        message: 'No gym coordinates configured for this account.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Location check failed';
      return {
        verified: false,
        context: 'home',
        message: msg,
      };
    }
  },

  /**
   * Verifies member via QR Code scan at physical gym entrance.
   */
  async verifyQrCheckin(
    userId: string,
    qrCodeHash: string
  ): Promise<GymVerificationResult> {
    try {
      const gyms = await gymRepository.fetchAllGyms();
      const matchedGym = gyms.find(g => g.qrCodeHash === qrCodeHash);

      if (!matchedGym) {
        return {
          verified: false,
          context: 'home',
          message: 'Invalid or unrecognized Gym QR code.',
        };
      }

      await gymRepository.recordCheckin(matchedGym.id, userId, 'qr_scan');

      return {
        verified: true,
        context: 'integrated_gym',
        method: 'qr_scan',
        gymId: matchedGym.id,
        gymName: matchedGym.name,
        message: `Successfully verified check-in at ${matchedGym.name}!`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'QR Verification failed';
      return {
        verified: false,
        context: 'home',
        message: msg,
      };
    }
  },
};
