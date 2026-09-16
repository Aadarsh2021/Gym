import { gymRepository } from '@/repositories/gym.repository';
import {
  Gym,
  GymAttendanceSession,
  GymCheckoutMethod,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';

export interface CheckOutRequest {
  userId: string;
  userRole?: string; // Must be 'member'
  checkoutMethod?: GymCheckoutMethod;
}

export interface CheckOutResult {
  success: boolean;
  session?: GymAttendanceSession;
  gym?: Gym;
  error?: string;
  isAlreadyCompleted?: boolean;
}

/**
 * Pure domain service for Member Gym Check-Out.
 * Encapsulates authorization, active visit resolution, idempotent checkout execution,
 * and canonical attendance session updates.
 * Contains zero React, DOM, window, navigator, or localStorage dependencies.
 */
export class GymCheckoutService {
  /**
   * Retrieves the current user's active attendance session and facility.
   */
  async getActiveSession(userId: string): Promise<{ session: GymAttendanceSession | null; gym: Gym | null }> {
    if (!userId || userId === 'guest-user') {
      return { session: null, gym: null };
    }
    const session = await gymRepository.getActiveAttendanceSession(userId);
    if (!session) {
      return { session: null, gym: null };
    }
    const gym = await gymRepository.fetchGymById(session.gymId);
    return { session, gym };
  }

  /**
   * Performs check-out for the member's current active attendance session.
   * Enforces that checkout operates strictly on the active session bound to userId.
   */
  async checkoutCurrentSession(request: CheckOutRequest): Promise<CheckOutResult> {
    const { userId, userRole, checkoutMethod = 'manual_button' } = request;

    // 1. Authenticated User & Role Verification
    if (!userId || userId === 'guest-user') {
      return { success: false, error: 'You must be signed in to check out.' };
    }

    if (userRole && userRole !== 'member') {
      return {
        success: false,
        error: 'Member checkout is exclusively for athlete member accounts. Gym owner accounts cannot check out via member flow.',
      };
    }

    // 2. Active Session Lookup (Source of Truth)
    const activeSession = await gymRepository.getActiveAttendanceSession(userId);
    if (!activeSession) {
      return {
        success: false,
        error: 'You are not currently checked in.',
      };
    }

    // 3. Resolve Facility Details
    const gym = await gymRepository.fetchGymById(activeSession.gymId);

    // 4. Execute Checkout in Repository
    try {
      const result = await gymRepository.checkoutAttendanceSession(
        activeSession.id,
        userId,
        checkoutMethod
      );

      if (!result.success || !result.session) {
        return {
          success: false,
          error: result.error || 'Failed to complete checkout.',
        };
      }

      return {
        success: true,
        session: result.session,
        gym: gym || undefined,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected checkout error';
      logger.error('GymCheckoutService: Error completing checkout', { err });
      return {
        success: false,
        error: msg,
      };
    }
  }
}

export const gymCheckoutService = new GymCheckoutService();
