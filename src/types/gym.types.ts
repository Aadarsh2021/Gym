/**
 * Gym Ecosystem & Multi-Tenant Context Types
 */

export type MemberTrainingContext = 'home' | 'non_integrated_gym' | 'integrated_gym';

export type GymMembershipStatus = 'active' | 'inactive' | 'frozen' | 'pending';

export type GymVerificationMethod = 'qr_scan' | 'gps_geofence' | 'reception_manual';

export interface Gym {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  qrCodeHash: string;
  createdAt?: string;
}

export interface GymMembership {
  id: string;
  gymId: string;
  userId: string;
  status: GymMembershipStatus;
  membershipType: string;
  joinedAt: string;
  expiresAt?: string | null;
  gym?: Gym;
}

export interface GymCheckin {
  id: string;
  gymId: string;
  userId: string;
  verificationMethod: GymVerificationMethod;
  checkedInAt: string;
}

export interface GymVerificationResult {
  verified: boolean;
  context: MemberTrainingContext;
  method?: GymVerificationMethod;
  distanceMeters?: number;
  gymId?: string;
  gymName?: string;
  message?: string;
}
