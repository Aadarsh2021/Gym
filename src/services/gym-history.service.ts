/**
 * Member Gym History Domain Service
 * Pure TypeScript service handling attendance history, visit details, and summary metrics.
 * Operates without React or DOM dependencies.
 */

import { gymRepository } from '@/repositories/gym.repository';
import { GymAttendanceSession, Gym } from '@/types/gym.types';
import { getCurrentMonthRangeIST } from '@/utils/date';
import { logger } from '@/lib/logger';

export interface GymAttendanceSummaryResult {
  totalVisits: number;
  totalDurationSeconds: number;
  totalDurationFormatted: string;
  averageDurationSeconds: number;
  averageDurationFormatted: string;
  currentMonthVisits: number;
}

export interface AttendanceHistoryResult {
  sessions: (GymAttendanceSession & { gym?: Gym })[];
  hasMore: boolean;
}

export interface VisitDetailsResult {
  success: boolean;
  visit?: GymAttendanceSession & { gym?: Gym };
  error?: string;
}

export function formatFriendlyDuration(durationSec: number | null | undefined): string {
  if (durationSec === null || durationSec === undefined || durationSec <= 0) {
    return '0 mins';
  }
  const mins = Math.floor(durationSec / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hrs > 0) {
    return `${hrs} hr${hrs === 1 ? '' : 's'} ${remMins} min${remMins === 1 ? '' : 's'}`;
  }
  if (mins > 0) {
    return `${mins} min${mins === 1 ? '' : 's'}`;
  }
  return `${durationSec} sec${durationSec === 1 ? '' : 's'}`;
}

export class GymHistoryService {
  /**
   * Retrieves paginated completed attendance sessions for the authenticated member.
   */
  async getAttendanceHistory(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<AttendanceHistoryResult> {
    if (!userId || userId === 'guest-user') {
      return { sessions: [], hasMore: false };
    }

    try {
      return await gymRepository.getAttendanceHistory(userId, options);
    } catch (err) {
      logger.error('GymHistoryService: Error getting attendance history', { err });
      return { sessions: [], hasMore: false };
    }
  }

  /**
   * Retrieves authoritative details for a single completed visit, strictly enforcing user ownership.
   */
  async getVisitDetails(sessionId: string, userId: string): Promise<VisitDetailsResult> {
    if (!sessionId || !userId || userId === 'guest-user') {
      return { success: false, error: 'Invalid session or user identity' };
    }

    try {
      const session = await gymRepository.getAttendanceSessionById(sessionId, userId);
      if (!session) {
        return { success: false, error: 'Visit record not found or access denied' };
      }

      // Explicit domain ownership check
      if (session.userId !== userId) {
        return { success: false, error: 'Access denied: Cross-user visit inspection forbidden' };
      }

      return { success: true, visit: session };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve visit details';
      logger.error('GymHistoryService: Error getting visit details', { err });
      return { success: false, error: msg };
    }
  }

  /**
   * Retrieves aggregate attendance summary metrics computed at the database/repository layer.
   * Does NOT fetch all completed attendance sessions into the browser.
   */
  async getAttendanceSummary(userId: string): Promise<GymAttendanceSummaryResult> {
    const emptySummary: GymAttendanceSummaryResult = {
      totalVisits: 0,
      totalDurationSeconds: 0,
      totalDurationFormatted: '0 mins',
      averageDurationSeconds: 0,
      averageDurationFormatted: '0 mins',
      currentMonthVisits: 0,
    };

    if (!userId || userId === 'guest-user') {
      return emptySummary;
    }

    try {
      const monthRange = getCurrentMonthRangeIST();
      const rawSummary = await gymRepository.getAttendanceSummary(userId, monthRange);

      return {
        totalVisits: rawSummary.totalVisits,
        totalDurationSeconds: rawSummary.totalDurationSeconds,
        totalDurationFormatted: formatFriendlyDuration(rawSummary.totalDurationSeconds),
        averageDurationSeconds: rawSummary.averageDurationSeconds,
        averageDurationFormatted: formatFriendlyDuration(rawSummary.averageDurationSeconds),
        currentMonthVisits: rawSummary.currentMonthVisits,
      };
    } catch (err) {
      logger.error('GymHistoryService: Error getting attendance summary', { err });
      return emptySummary;
    }
  }
}

export const gymHistoryService = new GymHistoryService();
