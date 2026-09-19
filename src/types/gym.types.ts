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

// ==============================================================================
// PHASE G6: GYM SAFETY & SPS TYPES
// ==============================================================================

export type GymSafetyCategory =
  | 'equipment_hazard'
  | 'facility_damage'
  | 'hygiene_sanitation'
  | 'member_harassment'
  | 'theft_security'
  | 'medical_emergency'
  | 'staff_conduct'
  | 'other';

export type GymSafetySeverity = 'low' | 'medium' | 'high' | 'critical';

export type GymSafetyIncidentStatus =
  | 'reported'
  | 'acknowledged'
  | 'investigating'
  | 'action_taken'
  | 'resolved'
  | 'dismissed';

export type GymSafetyAuditAction =
  | 'created'
  | 'status_changed'
  | 'notes_updated'
  | 'resolved'
  | 'dismissed';

export type GymSafetyNoticeType =
  | 'hazard_warning'
  | 'maintenance_closure'
  | 'safety_guideline'
  | 'emergency_advisory';

export interface GymSafetyIncident {
  id: string;
  gymId: string;
  gymName?: string;
  reporterId?: string | null;
  reporterName?: string;
  reporterAvatarUrl?: string | null;
  isAnonymous: boolean;
  category: GymSafetyCategory;
  severity: GymSafetySeverity;
  title: string;
  description: string;
  locationInFacility?: string | null;
  reportedUserId?: string | null;
  reportedUserName?: string | null;
  attendanceSessionId?: string | null;
  status: GymSafetyIncidentStatus;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GymSafetyIncidentLog {
  id: string;
  incidentId: string;
  actorId?: string | null;
  actorName?: string;
  action: GymSafetyAuditAction;
  previousStatus?: GymSafetyIncidentStatus | null;
  newStatus?: GymSafetyIncidentStatus | null;
  notes?: string | null;
  createdAt: string;
}

export interface GymEmergencyContactAccessLog {
  id: string;
  gymId: string;
  memberUserId: string;
  viewerOwnerId: string;
  attendanceSessionId: string;
  accessedFields: string[];
  accessedAt: string;
}

export interface GymEmergencyContact {
  id?: string;
  userId?: string;
  contactName: string;
  relationship: string;
  phoneNumber: string;
  alternativePhone?: string | null;
  medicalNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GymSafetyNotice {
  id: string;
  gymId: string;
  authorId: string;
  title: string;
  content: string;
  noticeType: GymSafetyNoticeType;
  severity: GymSafetySeverity;
  affectedArea?: string | null;
  startsAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSafetyIncidentPayload {
  gymId: string;
  category: GymSafetyCategory;
  severity: GymSafetySeverity;
  title: string;
  description: string;
  locationInFacility?: string;
  reportedUserId?: string;
  isAnonymous?: boolean;
  triggerBlock?: boolean;
}

// ==============================================================================
// GYM EVENTS & RSVP TYPES
// ==============================================================================

export type GymEventType = 'workshop' | 'bootcamp' | 'class' | 'competition' | 'social' | 'seminar' | 'other';

export type GymEventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export type GymEventRsvpStatus = 'attending' | 'cancelled';

export interface GymEvent {
  id: string;
  gymId: string;
  createdBy: string;
  title: string;
  description?: string | null;
  eventType: GymEventType;
  startsAt: string;
  endsAt: string;
  capacity?: number | null;
  locationText?: string | null;
  status: GymEventStatus;
  attendeeCount?: number;
  userRsvpStatus?: GymEventRsvpStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface GymEventRsvp {
  id: string;
  eventId: string;
  gymId: string;
  userId: string;
  status: GymEventRsvpStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GymEventAttendee {
  rsvpId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  rsvpStatus: GymEventRsvpStatus;
  rsvpCreatedAt: string;
}

export interface CreateGymEventInput {
  gymId: string;
  title: string;
  description?: string;
  eventType: GymEventType;
  startsAt: string;
  endsAt?: string;
  capacity?: number | null;
  locationText?: string;
}



