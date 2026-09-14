/**
 * Gym Ecosystem & Multi-Tenant Context Types
 */

export type MemberTrainingContext = 'home' | 'non_integrated_gym' | 'integrated_gym';

export type MemberGymMode = 'home' | 'non_integrated' | 'integrated';

export type MemberGymContextState =
  | {
      mode: 'home';
      activeGym: null;
      activeMembership: null;
      memberships: GymMembership[];
    }
  | {
      mode: 'non_integrated';
      activeGym: null;
      activeMembership: null;
      memberships: GymMembership[];
      customGymLocation?: { latitude: number; longitude: number; radiusMeters: number };
    }
  | {
      mode: 'integrated';
      activeGym: Gym;
      activeMembership: GymMembership;
      memberships: GymMembership[];
    };

export type GymMembershipStatus = 'active' | 'inactive' | 'frozen' | 'pending';

export type GymVerificationMethod = 'qr_scan' | 'gps_geofence' | 'reception_manual';

export type GymAttendanceStatus = 'active' | 'completed' | 'abandoned';

export type GymCheckoutMethod = 'qr_scan' | 'gps_geofence' | 'manual_button' | 'reception_manual' | 'auto_timeout';

export interface DaySchedule {
  isOpen: boolean;
  openTime: string; // e.g. "06:00"
  closeTime: string; // e.g. "22:00"
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface Gym {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  contactNumber?: string;
  email?: string;
  description?: string;
  openingTime?: string;
  closingTime?: string;
  weeklySchedule?: WeeklySchedule;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  qrCodeHash: string;
  logoUrl?: string;
  coverImageUrl?: string;
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

export interface GymAttendanceSession {
  id: string;
  gymId: string;
  userId: string;
  checkInAt: string;
  checkOutAt?: string | null;
  durationSeconds?: number | null;
  verificationMethod: GymVerificationMethod;
  checkoutMethod?: GymCheckoutMethod | null;
  status: GymAttendanceStatus;
  createdAt?: string;
  userProfile?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
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
