/**
 * Authoritative Gym Buddy Service (Phase G3)
 * Orchestrates member buddy preferences, candidate discovery, connection lifecycle,
 * and safety operations (block, report, unmatch).
 */

import { gymRepository } from '@/repositories/gym.repository';
import {
  GymBuddyPreference,
  GymBuddyCandidate,
  GymBuddyConnection,
  GymBuddyReportReason,
  GymBuddyBlock,
  GymBuddyReport,
  GymTrainingTimeWindow,
} from '@/types/gym.types';

export const VALID_TIME_WINDOWS: GymTrainingTimeWindow[] = [
  'early_morning',
  'morning',
  'afternoon',
  'evening',
  'night',
];

export const gymBuddyService = {
  /**
   * Retrieves the member's current buddy preference for the active gym.
   */
  async getPreference(userId: string, gymId: string): Promise<GymBuddyPreference | null> {
    if (!userId || !gymId) return null;
    return gymRepository.fetchBuddyPreference(userId, gymId);
  },

  /**
   * Updates or saves member's buddy preferences.
   */
  async savePreference(
    pref: GymBuddyPreference
  ): Promise<{ success: boolean; error?: string }> {
    if (!pref.userId || !pref.gymId) {
      return { success: false, error: 'User ID and Gym ID are required' };
    }

    if (!VALID_TIME_WINDOWS.includes(pref.preferredTrainingTime)) {
      return { success: false, error: 'Invalid training time window' };
    }

    if (pref.bioNote && pref.bioNote.trim().length > 160) {
      return { success: false, error: 'Bio note cannot exceed 160 characters' };
    }

    // Sanitize training days: must be integers 0..6
    const sanitizedDays = Array.from(
      new Set((pref.preferredTrainingDays || []).filter(d => d >= 0 && d <= 6))
    ).sort((a, b) => a - b);

    if (sanitizedDays.length === 0) {
      return { success: false, error: 'At least one training day must be selected' };
    }

    return gymRepository.saveBuddyPreference({
      ...pref,
      preferredTrainingDays: sanitizedDays,
      bioNote: pref.bioNote ? pref.bioNote.trim() : null,
    });
  },

  /**
   * Toggles opt-in state for matching at the specified gym.
   */
  async toggleOptIn(gymId: string, optIn: boolean): Promise<{ success: boolean; error?: string }> {
    if (!gymId) return { success: false, error: 'Gym ID is required' };
    return gymRepository.setBuddyOptIn(gymId, optIn);
  },

  /**
   * Fetches compatible buddy candidates from the server-authoritative RPC.
   */
  async getCandidates(
    gymId: string,
    options: { limit?: number; cursorScore?: number; cursorUserId?: string } = {}
  ): Promise<{ optedIn: boolean; candidates: GymBuddyCandidate[] }> {
    if (!gymId) return { optedIn: false, candidates: [] };
    return gymRepository.fetchBuddyCandidates(gymId, options);
  },

  /**
   * Sends a buddy request to a compatible peer.
   * Authoritatively checks max 5 pending requests and Free Tier cap (3 active buddies).
   */
  async sendRequest(
    gymId: string,
    targetUserId: string
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    if (!gymId || !targetUserId) {
      return { success: false, error: 'Gym ID and target user ID are required' };
    }
    return gymRepository.sendBuddyRequest(gymId, targetUserId);
  },

  /**
   * Responds to an incoming buddy request (accept or decline).
   */
  async respondToRequest(
    connectionId: string,
    action: 'accept' | 'decline'
  ): Promise<{ success: boolean; error?: string }> {
    if (!connectionId) return { success: false, error: 'Connection ID is required' };
    if (action !== 'accept' && action !== 'decline') {
      return { success: false, error: 'Action must be accept or decline' };
    }
    return gymRepository.respondBuddyRequest(connectionId, action);
  },

  /**
   * Cancels a pending outgoing buddy request.
   */
  async cancelRequest(connectionId: string): Promise<{ success: boolean; error?: string }> {
    if (!connectionId) return { success: false, error: 'Connection ID is required' };
    return gymRepository.cancelBuddyRequest(connectionId);
  },

  /**
   * Safely unmatches an active buddy relationship.
   */
  async unmatch(connectionId: string): Promise<{ success: boolean; error?: string }> {
    if (!connectionId) return { success: false, error: 'Connection ID is required' };
    return gymRepository.unmatchBuddy(connectionId);
  },

  /**
   * Globally blocks a user across all partner facilities.
   */
  async blockUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!targetUserId) return { success: false, error: 'Target user ID is required' };
    return gymRepository.blockBuddy(targetUserId);
  },

  /**
   * Unblocks a previously blocked user.
   */
  async unblockUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!targetUserId) return { success: false, error: 'Target user ID is required' };
    return gymRepository.unblockBuddy(targetUserId);
  },

  /**
   * Dismisses a candidate from the discover feed for 14 days.
   */
  async dismissCandidate(
    gymId: string,
    dismissedUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!gymId || !dismissedUserId) {
      return { success: false, error: 'Gym ID and dismissed user ID are required' };
    }
    return gymRepository.dismissBuddy(gymId, dismissedUserId);
  },

  /**
   * Files a conduct report to the facility owner.
   */
  async reportUser(
    gymId: string,
    reportedUserId: string,
    reason: GymBuddyReportReason,
    details?: string
  ): Promise<{ success: boolean; reportId?: string; error?: string }> {
    if (!gymId || !reportedUserId) {
      return { success: false, error: 'Gym ID and reported user ID are required' };
    }
    return gymRepository.reportBuddy(gymId, reportedUserId, reason, details);
  },

  /**
   * Fetches active and pending buddy connections for the caller at the given gym.
   */
  async getMyConnections(gymId: string, userId: string): Promise<GymBuddyConnection[]> {
    if (!gymId || !userId) return [];
    return gymRepository.fetchMyBuddyConnections(gymId, userId);
  },

  /**
   * Fetches list of users blocked by the caller.
   */
  async getBlockedUsers(userId: string): Promise<GymBuddyBlock[]> {
    if (!userId) return [];
    return gymRepository.fetchBlockedBuddies(userId);
  },

  /**
   * Facility Owner Console: Fetches buddy conduct reports for moderation.
   */
  async getFacilityReports(gymId: string): Promise<GymBuddyReport[]> {
    if (!gymId) return [];
    return gymRepository.fetchFacilityBuddyReports(gymId);
  },
};
