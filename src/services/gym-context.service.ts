import { gymRepository } from '@/repositories/gym.repository';
import { profileRepository } from '@/repositories/profile.repository';
import { isWithinGymRadius } from '@/utils/geo';
import {
  MemberTrainingContext,
  MemberGymContextState,
  GymVerificationResult,
  GymMembership,
  Gym,
} from '@/types/gym.types';
import { platform } from '@/platform';
import { logger } from '@/lib/logger';

/**
 * Pure domain function to derive member gym context from memberships and custom coordinates.
 * Deterministic, framework-independent, containing zero DOM/React/Supabase dependencies.
 */
export function deriveMemberGymContext(
  memberships: GymMembership[],
  customGymLocation?: { latitude: number; longitude: number; radiusMeters: number },
  preferredGymId?: string | null
): MemberGymContextState {
  // 1. Authoritative active memberships only: pending, inactive, frozen are excluded
  const activeMemberships = memberships.filter(m => m.status === 'active');

  if (activeMemberships.length > 0) {
    let chosenMembership: GymMembership | undefined;

    // Multi-gym selection: check if user has an explicit preferred active gym
    if (preferredGymId) {
      chosenMembership = activeMemberships.find(m => m.gymId === preferredGymId);
    }

    // Deterministic fallback: sort by joinedAt descending, tie-break by gymId ascending
    if (!chosenMembership) {
      const sorted = [...activeMemberships].sort((a, b) => {
        const bTime = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
        const aTime = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        const timeDiff = bTime - aTime;
        if (timeDiff !== 0) return timeDiff;
        return a.gymId.localeCompare(b.gymId);
      });
      chosenMembership = sorted[0];
    }

    if (chosenMembership) {
      const activeGym: Gym = chosenMembership.gym || {
        id: chosenMembership.gymId,
        name: 'Integrated Gym',
        slug: chosenMembership.gymId,
        ownerId: '',
        address: '',
        city: '',
        latitude: 0,
        longitude: 0,
        radiusMeters: 200,
        qrCodeHash: '',
      };

      return {
        mode: 'integrated',
        activeGym,
        activeMembership: chosenMembership,
        memberships,
      };
    }
  }

  // 2. Non-Integrated Gym Context (User configured custom non-integrated gym coordinates)
  if (customGymLocation && customGymLocation.latitude && customGymLocation.longitude) {
    return {
      mode: 'non_integrated',
      activeGym: null,
      activeMembership: null,
      memberships,
      customGymLocation,
    };
  }

  // 3. Default: Home / Independent
  return {
    mode: 'home',
    activeGym: null,
    activeMembership: null,
    memberships,
  };
}

export const gymContextService = {
  /**
   * Resolves the current member gym context for an authenticated user.
   * Loads user memberships via gymRepository and fitnessProfile via profileRepository,
   * then applies pure domain derivation.
   */
  async resolveMemberGymContext(userId: string): Promise<MemberGymContextState> {
    if (!userId || userId === 'guest-user') {
      return {
        mode: 'home',
        activeGym: null,
        activeMembership: null,
        memberships: [],
      };
    }

    try {
      // 1. Fetch all memberships for this user
      const memberships = await gymRepository.getMyGymMemberships(userId);

      // 2. Fetch custom location if any from fitness profile
      let customLocation: { latitude: number; longitude: number; radiusMeters: number } | undefined;
      const fitnessProfile = await profileRepository.fetchFitnessProfile(userId);
      if (fitnessProfile?.gymLatitude && fitnessProfile?.gymLongitude) {
        customLocation = {
          latitude: fitnessProfile.gymLatitude,
          longitude: fitnessProfile.gymLongitude,
          radiusMeters: fitnessProfile.gymRadiusMeters || 200,
        };
      }

      // 3. Check for preferred active gym in platform storage
      const rawPreferred = platform.storage.getItem(`active_member_gym_id_${userId}`);
      const preferredGymId = typeof rawPreferred === 'string' ? rawPreferred : null;

      // 4. Derive context
      return deriveMemberGymContext(memberships, customLocation, preferredGymId);
    } catch (err) {
      logger.error('gymContextService: Error resolving member gym context', { err });
      return {
        mode: 'home',
        activeGym: null,
        activeMembership: null,
        memberships: [],
      };
    }
  },

  /**
   * Sets the user's active gym preference for multi-gym members.
   */
  setActiveGymPreference(userId: string, gymId: string): void {
    if (userId && gymId) {
      platform.storage.setItem(`active_member_gym_id_${userId}`, gymId);
    }
  },

  /**
   * Resolves the current member training context (backward-compatible adapter):
   * 1. 'integrated_gym' if user belongs to an active FitBoost-registered gym
   * 2. 'non_integrated_gym' if user has set custom gym GPS coordinates
   * 3. 'home' if no gym coordinates or memberships exist
   */
  async resolveTrainingContext(userId: string): Promise<{
    context: MemberTrainingContext;
    activeMembership?: GymMembership;
    customGymLocation?: { latitude: number; longitude: number; radiusMeters: number };
  }> {
    const derived = await this.resolveMemberGymContext(userId);
    const legacyContext: MemberTrainingContext =
      derived.mode === 'integrated'
        ? 'integrated_gym'
        : derived.mode === 'non_integrated'
        ? 'non_integrated_gym'
        : 'home';

    return {
      context: legacyContext,
      activeMembership: derived.activeMembership || undefined,
      customGymLocation: derived.mode === 'non_integrated' ? derived.customGymLocation : undefined,
    };
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
