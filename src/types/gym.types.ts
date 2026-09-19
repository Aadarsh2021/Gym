/**
 * Gym Ecosystem & Multi-Tenant Context Types
 */

import { WorkoutEnvironment } from './user.types';

export type MemberTrainingContext = 'home' | 'non_integrated_gym' | 'integrated_gym';

export type MemberGymMode = 'home' | 'non_integrated' | 'integrated';

export type MemberGymContextState =
  | {
      mode: 'home';
      workoutEnvironment?: WorkoutEnvironment | null;
      activeGym: null;
      activeMembership: null;
      memberships: GymMembership[];
    }
  | {
      mode: 'non_integrated';
      workoutEnvironment?: WorkoutEnvironment | null;
      activeGym: null;
      activeMembership: null;
      memberships: GymMembership[];
      customGymLocation?: { latitude: number; longitude: number; radiusMeters: number };
    }
  | {
      mode: 'integrated';
      workoutEnvironment?: WorkoutEnvironment | null;
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
  timezone?: string;
  createdAt?: string;
}

export interface GymMembership {
  id: string;
  gymId: string;
  userId: string;
  status: GymMembershipStatus;
  membershipType: string;
  joinedAt?: string | null;
  expiresAt?: string | null;
  gym?: Gym;
  userProfile?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
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

// ── Phase G1 Retention Foundation Types ─────────────────────────────────────

export interface GymAttendanceStreak {
  id: string;
  userId: string;
  gymId: string;
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: string; // YYYY-MM-DD
  totalVisitDays: number;
  createdAt?: string;
  updatedAt?: string;
}

export type GymAnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';
export type GymAnnouncementStatus = 'draft' | 'published' | 'archived';

export interface GymAnnouncement {
  id: string;
  gymId: string;
  title: string;
  content: string;
  priority: GymAnnouncementPriority;
  isPinned: boolean;
  status: GymAnnouncementStatus;
  expiresAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GymReward {
  id: string;
  gymId: string;
  title: string;
  description?: string | null;
  requiredVisits: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type GymRewardRedemptionStatus = 'claimed' | 'redeemed' | 'expired';

export interface GymRewardRedemption {
  id: string;
  rewardId: string;
  gymId: string;
  userId: string;
  status: GymRewardRedemptionStatus;
  redemptionCode: string;
  claimedAt: string;
  redeemedAt?: string | null;
  reward?: GymReward;
}

// ==============================================================================
// PHASE G2: GYM COMMUNITY & MODERATION TYPES
// ==============================================================================

export type GymPostStatus = 'published' | 'hidden' | 'removed';
export type GymCommentStatus = 'published' | 'hidden' | 'removed';

export interface GymPost {
  id: string;
  gymId: string;
  authorId: string;
  content: string;
  status: GymPostStatus;
  isPinned: boolean;
  pinnedBy?: string | null;
  pinnedAt?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  moderationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
  commentCount?: number;
}

export interface GymComment {
  id: string;
  postId: string;
  gymId: string;
  authorId: string;
  content: string;
  status: GymCommentStatus;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  moderationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
}

export type GymReportTargetType = 'post' | 'comment';
export type GymReportReason = 'spam' | 'harassment' | 'inappropriate' | 'hate_speech' | 'other';
export type GymReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'action_taken';

export interface GymPostReport {
  id: string;
  gymId: string;
  targetType: GymReportTargetType;
  postId?: string | null;
  commentId?: string | null;
  reporterId: string;
  reason: GymReportReason;
  details?: string | null;
  status: GymReportStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  reporter?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
  targetPost?: GymPost | null;
  targetComment?: GymComment | null;
}

export interface GymCommunityStats {
  activePostsCount: number;
  pinnedPostsCount: number;
  pendingReportsCount: number;
}

// ==============================================================================
// PHASE G3: DYNAMIC GYM BUDDY MATCHING TYPES
// ==============================================================================

export type GymTrainingTimeWindow = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';
export type GymGenderFilter = 'any' | 'same_gender';

export interface GymBuddyPreference {
  userId: string;
  gymId: string;
  isOptedIn: boolean;
  preferredTrainingTime: GymTrainingTimeWindow;
  preferredTrainingDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  preferredGenderFilter: GymGenderFilter;
  bioNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type GymBuddyConnectionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'ended';

export interface GymBuddyMatchReason {
  type: 'schedule' | 'goal' | 'experience' | 'duration' | 'frequency' | 'time' | 'days';
  label: string;
  icon?: string;
}

export interface GymBuddyConnection {
  id: string;
  gymId: string;
  userAId: string;
  userBId: string;
  requesterId: string;
  status: GymBuddyConnectionStatus;
  compatibilityScore?: number;
  matchReasons?: GymBuddyMatchReason[];
  requestedAt: string;
  acceptedAt?: string | null;
  endedAt?: string | null;
  blockedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  partnerProfile?: {
    displayName?: string;
    avatarUrl?: string | null;
    goal?: string;
    experienceLevel?: string;
    bioNote?: string | null;
  };
}

export interface GymBuddyCandidate {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  preferredTrainingTime: GymTrainingTimeWindow;
  preferredTrainingDays: number[];
  bioNote?: string | null;
  goal: string;
  experienceLevel: string;
  workoutDurationMinutes: number;
  daysPerWeek: number;
  compatibilityScore: number;
  matchReasons: GymBuddyMatchReason[];
}

export interface GymBuddyBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export type GymBuddyReportReason =
  | 'harassment'
  | 'inappropriate_behavior'
  | 'unsolicited_contact'
  | 'impersonation'
  | 'spam'
  | 'safety_concern'
  | 'other';

export type GymBuddyReportStatus = 'pending' | 'reviewed' | 'action_taken' | 'dismissed';

export interface GymBuddyReport {
  id: string;
  gymId: string;
  reporterId: string;
  reportedId: string;
  reason: GymBuddyReportReason;
  details?: string | null;
  status: GymBuddyReportStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt?: string;
  reporter?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
  reported?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
}

// ==============================================================================
// PHASE G4: PERSONAL 1:1 BUDDY CHAT TYPES
// ==============================================================================

export interface GymChatMessage {
  id: string;
  connectionId: string;
  senderId: string;
  content: string;
  readAt?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
}

// ==============================================================================
// PHASE G5-A: GYM CHALLENGES TYPES
// ==============================================================================

export type GymChallengeType =
  | 'attendance_count'
  | 'workout_count'
  | 'workout_volume'
  | 'attendance_streak';

export type GymChallengeStatus = 'draft' | 'published' | 'active' | 'completed' | 'archived';

export type GymChallengeScoringUnit = 'days' | 'workouts' | 'kg' | 'streak_days';

export interface GymChallenge {
  id: string;
  gymId: string;
  title: string;
  description?: string | null;
  challengeType: GymChallengeType;
  status: GymChallengeStatus;
  targetValue: number;
  scoringUnit: GymChallengeScoringUnit;
  startAt: string;
  endAt: string;
  rewardBadgeName?: string | null;
  rewardCoins?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  participantCount?: number;
}

export type GymChallengeParticipantStatus = 'active' | 'completed' | 'withdrawn';

export interface GymChallengeParticipant {
  id: string;
  challengeId: string;
  gymId: string;
  userId: string;
  status: GymChallengeParticipantStatus;
  currentScore: number;
  targetAchievedAt?: string | null;
  lastProgressAt?: string | null;
  joinedAt: string;
  updatedAt: string;
}

// ==============================================================================
// PHASE G5-B: GYM LEADERBOARD TYPES
// ==============================================================================

export interface GymChallengeLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  currentScore: number;
  targetValue: number;
  scoringUnit: string;
  progressPercentage: number;
  isCompleted: boolean;
  targetAchievedAt?: string | null;
  lastProgressAt?: string | null;
}

