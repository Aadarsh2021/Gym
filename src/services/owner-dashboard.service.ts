/**
 * Owner Dashboard & Facility Operations Service (Phase C7)
 * Orchestrates live attendance floor sync, completed attendance audit logs,
 * and member roster status management.
 */

import { gymRepository } from '@/repositories/gym.repository';
import {
  GymAttendanceSession,
  GymMembership,
  GymMembershipStatus,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';
import { OwnerDashboardOverview } from '@/types/owner-dashboard.types';

export * from '@/types/owner-dashboard.types';

export interface OwnerFloorSyncResult {
  activeSessions: GymAttendanceSession[];
  activeCount: number;
  todayCheckins: number;
  memberCounts: {
    active: number;
    pending: number;
    inactive: number;
    total: number;
  };
}

export interface OwnerAttendanceHistoryResult {
  sessions: GymAttendanceSession[];
  totalCount: number;
  hasMore: boolean;
}

export interface OwnerMemberRosterResult {
  members: GymMembership[];
  totalCount: number;
  hasMore: boolean;
  counts: {
    active: number;
    pending: number;
    inactive: number;
    total: number;
  };
}

const ALLOWED_STATUS_TRANSITIONS: Record<GymMembershipStatus, GymMembershipStatus[]> = {
  pending: ['active'],
  active: ['frozen', 'inactive'],
  frozen: ['active', 'inactive'],
  inactive: [], // Inactive is terminal unless new request is submitted by member
};

export class OwnerDashboardService {
  /**
   * Fetches real-time floor occupancy, today's check-ins (IST), and member stats for an owned facility.
   */
  async getFloorSync(gymId: string): Promise<OwnerFloorSyncResult> {
    if (!gymId) {
      return {
        activeSessions: [],
        activeCount: 0,
        todayCheckins: 0,
        memberCounts: { active: 0, pending: 0, inactive: 0, total: 0 },
      };
    }

    try {
      const [activeSessions, todayCheckins, memberCounts] = await Promise.all([
        gymRepository.fetchGymActiveAttendance(gymId),
        gymRepository.fetchGymTodayCheckinsCount(gymId),
        gymRepository.fetchGymMemberCounts(gymId),
      ]);

      return {
        activeSessions,
        activeCount: activeSessions.length,
        todayCheckins,
        memberCounts,
      };
    } catch (err: unknown) {
      logger.error('OwnerDashboardService: Failed to get floor sync', { err, gymId });
      return {
        activeSessions: [],
        activeCount: 0,
        todayCheckins: 0,
        memberCounts: { active: 0, pending: 0, inactive: 0, total: 0 },
      };
    }
  }

  /**
   * Fetches completed attendance history ledger for the facility with search & date filtering.
   */
  async getCompletedAttendanceLedger(
    gymId: string,
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      startDateIso?: string;
      endDateIso?: string;
    } = {}
  ): Promise<OwnerAttendanceHistoryResult> {
    if (!gymId) {
      return { sessions: [], totalCount: 0, hasMore: false };
    }

    try {
      const limit = Math.max(1, Math.min(options.limit || 20, 100));
      const offset = Math.max(0, options.offset || 0);

      const res = await gymRepository.fetchGymAttendanceHistory(gymId, {
        ...options,
        limit,
        offset,
      });

      const hasMore = offset + res.sessions.length < res.totalCount;

      return {
        sessions: res.sessions,
        totalCount: res.totalCount,
        hasMore,
      };
    } catch (err: unknown) {
      logger.error('OwnerDashboardService: Failed to fetch attendance ledger', { err, gymId });
      return { sessions: [], totalCount: 0, hasMore: false };
    }
  }

  /**
   * Fetches member roster with status filtering, searching, and pagination.
   */
  async getMemberRoster(
    gymId: string,
    options: {
      status?: GymMembershipStatus | 'all';
      limit?: number;
      offset?: number;
      search?: string;
    } = {}
  ): Promise<OwnerMemberRosterResult> {
    if (!gymId) {
      return {
        members: [],
        totalCount: 0,
        hasMore: false,
        counts: { active: 0, pending: 0, inactive: 0, total: 0 },
      };
    }

    try {
      const limit = Math.max(1, Math.min(options.limit || 20, 100));
      const offset = Math.max(0, options.offset || 0);

      const [rosterRes, counts] = await Promise.all([
        gymRepository.fetchGymMembers(gymId, {
          ...options,
          limit,
          offset,
        }),
        gymRepository.fetchGymMemberCounts(gymId),
      ]);

      const hasMore = offset + rosterRes.members.length < rosterRes.totalCount;

      return {
        members: rosterRes.members,
        totalCount: rosterRes.totalCount,
        hasMore,
        counts,
      };
    } catch (err: unknown) {
      logger.error('OwnerDashboardService: Failed to fetch member roster', { err, gymId });
      return {
        members: [],
        totalCount: 0,
        hasMore: false,
        counts: { active: 0, pending: 0, inactive: 0, total: 0 },
      };
    }
  }

  /**
   * Validates and executes an authoritative membership status update.
   */
  async updateMembershipStatus(
    membershipId: string,
    gymId: string,
    currentStatus: GymMembershipStatus,
    targetStatus: GymMembershipStatus,
    callerOwnerId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!membershipId || !gymId) {
      return { success: false, error: 'Membership ID and Gym ID are required' };
    }

    // Validate lifecycle state transition
    if (currentStatus === targetStatus) {
      return { success: true };
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(targetStatus)) {
      return {
        success: false,
        error: `Cannot transition membership from "${currentStatus}" to "${targetStatus}"`,
      };
    }

    try {
      return await gymRepository.updateMembershipStatus(
        membershipId,
        gymId,
        targetStatus,
        callerOwnerId
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update membership status';
      logger.error('OwnerDashboardService: Error updating membership status', { err, membershipId });
      return { success: false, error: msg };
    }
  }

  /**
   * Fetches and normalizes the high-level Operations Intelligence Overview (Phase G7).
   * Aggregates live occupancy, today's attendance, 30d retention streaks,
   * peak hours distribution, and actionable alerts.
   */
  async getOverview(gymId: string): Promise<OwnerDashboardOverview | null> {
    if (!gymId) return null;

    try {
      const raw = await gymRepository.getOwnerDashboardOverview(gymId);
      if (!raw) return null;

      // Validate & normalize payload
      const maxCapacity = Math.max(1, raw.facility?.maxCapacity || 100);
      const occupancy = Math.max(0, raw.live?.occupancy || 0);
      const occupancyRate = Math.min(100, Math.max(0, Number(raw.live?.occupancyRate) || 0));
      const status = occupancyRate >= 100 ? 'at_capacity' : occupancyRate >= 80 ? 'crowded' : 'normal';

      // Ensure 24 buckets exist for peak hours
      const rawBuckets = Array.isArray(raw.attendance?.peakHoursDistribution)
        ? raw.attendance.peakHoursDistribution
        : [];
      const bucketMap = new Map<number, number>();
      rawBuckets.forEach(b => {
        if (typeof b?.hour === 'number' && typeof b?.checkins === 'number') {
          bucketMap.set(b.hour, Math.max(0, b.checkins));
        }
      });
      const peakHoursDistribution = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        checkins: bucketMap.get(hour) || 0,
      }));

      const activeMembers30d = Math.max(0, raw.members?.activeMembers30d || 0);
      const streakMembersCount = Math.max(0, raw.members?.streakMembersCount || 0);
      const retentionHealthPercentage =
        activeMembers30d > 0
          ? Math.min(100, Math.max(0, Number(raw.members?.retentionHealthPercentage) || 0))
          : 0;

      return {
        facility: {
          gymId: raw.facility?.gymId || gymId,
          gymName: raw.facility?.gymName || 'Facility',
          timezone: raw.facility?.timezone || 'Asia/Kolkata',
          maxCapacity,
        },
        live: {
          occupancy,
          occupancyRate,
          status,
        },
        attendance: {
          todayCheckins: Math.max(0, raw.attendance?.todayCheckins || 0),
          todayCompletedVisits: Math.max(0, raw.attendance?.todayCompletedVisits || 0),
          todayAvgDurationMinutes: Math.max(0, Number(raw.attendance?.todayAvgDurationMinutes) || 0),
          peakHoursDistribution,
        },
        members: {
          activeMembers30d,
          streakMembersCount,
          retentionHealthPercentage,
          pendingMembershipsCount: Math.max(0, raw.members?.pendingMembershipsCount || 0),
        },
        engagement: {
          activeChallengesCount: Math.max(0, raw.engagement?.activeChallengesCount || 0),
          challengeParticipantsCount: Math.max(0, raw.engagement?.challengeParticipantsCount || 0),
          activeBuddyConnectionsCount: Math.max(0, raw.engagement?.activeBuddyConnectionsCount || 0),
        },
        safety: {
          openSafetyIncidentsCount: Math.max(0, raw.safety?.openSafetyIncidentsCount || 0),
          criticalSafetyIncidentsCount: Math.max(0, raw.safety?.criticalSafetyIncidentsCount || 0),
          activeSafetyNoticesCount: Math.max(0, raw.safety?.activeSafetyNoticesCount || 0),
        },
        moderation: {
          unresolvedFlagsCount: Math.max(0, raw.moderation?.unresolvedFlagsCount || 0),
        },
      };
    } catch (err) {
      logger.error('OwnerDashboardService: getOverview failed', { err, gymId });
      return null;
    }
  }
}

export const ownerDashboardService = new OwnerDashboardService();
