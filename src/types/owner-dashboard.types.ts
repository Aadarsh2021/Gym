/**
 * Phase G7: Gym Owner Operations Intelligence Dashboard Types
 */

export interface OwnerDashboardPeakHourBucket {
  hour: number;
  checkins: number;
}

export interface OwnerDashboardFacilityInfo {
  gymId: string;
  gymName: string;
  timezone: string;
  maxCapacity: number;
}

export interface OwnerDashboardLiveMetrics {
  occupancy: number;
  occupancyRate: number;
  status: 'normal' | 'crowded' | 'at_capacity';
}

export interface OwnerDashboardAttendanceMetrics {
  todayCheckins: number;
  todayCompletedVisits: number;
  todayAvgDurationMinutes: number;
  peakHoursDistribution: OwnerDashboardPeakHourBucket[];
}

export interface OwnerDashboardMemberMetrics {
  activeMembers30d: number;
  streakMembersCount: number;
  retentionHealthPercentage: number;
  pendingMembershipsCount: number;
}

export interface OwnerDashboardEngagementMetrics {
  activeChallengesCount: number;
  challengeParticipantsCount: number;
  activeBuddyConnectionsCount: number;
}

export interface OwnerDashboardSafetyMetrics {
  openSafetyIncidentsCount: number;
  criticalSafetyIncidentsCount: number;
  activeSafetyNoticesCount: number;
}

export interface OwnerDashboardModerationMetrics {
  unresolvedFlagsCount: number;
}

export interface OwnerDashboardOverview {
  facility: OwnerDashboardFacilityInfo;
  live: OwnerDashboardLiveMetrics;
  attendance: OwnerDashboardAttendanceMetrics;
  members: OwnerDashboardMemberMetrics;
  engagement: OwnerDashboardEngagementMetrics;
  safety: OwnerDashboardSafetyMetrics;
  moderation: OwnerDashboardModerationMetrics;
}
