/**
 * Temporary draft storage for active workout session resilience
 * (Prevents data loss on accidental browser refresh or gym connectivity drops)
 * Platform-independent: routes through platform.storage.
 */

import { WorkoutSession } from '@/types/workout.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const ACTIVE_SESSION_DRAFT_KEY_PREFIX = 'fitness_active_session_draft';
export const ACTIVE_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours TTL

export interface ActiveSessionDraftWrapper {
  session: WorkoutSession;
  savedAt: string;
  userId: string;
  version: number;
}

function getDraftStorageKey(userId?: string): string {
  if (userId && userId.trim()) {
    return `${ACTIVE_SESSION_DRAFT_KEY_PREFIX}_${userId.trim()}`;
  }
  return ACTIVE_SESSION_DRAFT_KEY_PREFIX;
}

export function saveActiveSessionDraft(session: WorkoutSession, userId?: string): void {
  try {
    const targetUserId = userId || session.userId;
    const key = getDraftStorageKey(targetUserId);
    const wrapper: ActiveSessionDraftWrapper = {
      session,
      savedAt: new Date().toISOString(),
      userId: targetUserId,
      version: 1,
    };
    platform.storage.setItem(key, JSON.stringify(wrapper));
    // Also update legacy key if no specific userId to maintain backwards compatibility
    if (!targetUserId || targetUserId === 'guest-user') {
      platform.storage.setItem(ACTIVE_SESSION_DRAFT_KEY_PREFIX, JSON.stringify(wrapper));
    }
  } catch (err) {
    logger.warn('Failed to persist workout draft to platform storage', { err });
  }
}

export function isSessionDraftStale(savedAtStr?: string, startedAtStr?: string): boolean {
  const timestamp = savedAtStr || startedAtStr;
  if (!timestamp) return false;
  const timeMs = new Date(timestamp).getTime();
  if (isNaN(timeMs)) return false;
  return Date.now() - timeMs > ACTIVE_SESSION_MAX_AGE_MS;
}

export function loadActiveSessionDraft(userId?: string): WorkoutSession | null {
  try {
    const key = getDraftStorageKey(userId);
    let raw = platform.storage.getItem(key);

    // Fallback to unscoped key if user key not found
    if (!raw && (!userId || userId === 'guest-user')) {
      raw = platform.storage.getItem(ACTIVE_SESSION_DRAFT_KEY_PREFIX);
    }

    if (!raw || typeof raw !== 'string') return null;

    const parsed = JSON.parse(raw);
    // Handle wrapped format with savedAt timestamp
    if (parsed && typeof parsed === 'object' && 'session' in parsed && 'savedAt' in parsed) {
      const wrapper = parsed as ActiveSessionDraftWrapper;
      if (isSessionDraftStale(wrapper.savedAt, wrapper.session?.startedAt)) {
        logger.info('Active workout draft expired (exceeded 12-hour TTL)', {
          savedAt: wrapper.savedAt,
          userId: wrapper.userId,
        });
        clearActiveSessionDraft(userId || wrapper.userId);
        return null;
      }
      return wrapper.session;
    }

    // Handle legacy raw WorkoutSession
    if (parsed && typeof parsed === 'object' && 'id' in parsed && 'exercises' in parsed) {
      const legacySession = parsed as WorkoutSession;
      if (isSessionDraftStale(undefined, legacySession.startedAt)) {
        logger.info('Legacy active workout draft expired (exceeded 12-hour TTL)', {
          startedAt: legacySession.startedAt,
        });
        clearActiveSessionDraft(userId);
        return null;
      }
      return legacySession;
    }

    return null;
  } catch (err) {
    logger.warn('Failed to load workout draft from platform storage', { err });
    return null;
  }
}

export function clearActiveSessionDraft(userId?: string): void {
  try {
    if (userId) {
      platform.storage.removeItem(getDraftStorageKey(userId));
    }
    // Also remove global/legacy key
    platform.storage.removeItem(ACTIVE_SESSION_DRAFT_KEY_PREFIX);
  } catch (err) {
    logger.warn('Failed to clear workout draft from platform storage', { err });
  }
}

const DRAFT_PLAN_KEY = 'fitness_draft_plan_review';
const LEGACY_DRAFT_PLAN_KEY = 'apexfit_draft_plan_review';

export function saveDraftPlan(plan: any): void {
  try {
    platform.storage.setItem(DRAFT_PLAN_KEY, JSON.stringify(plan));
  } catch (err) {
    logger.warn('Failed to save draft plan to platform storage', { err });
  }
}

export function loadDraftPlan(): any | null {
  try {
    const raw = platform.storage.getItem(DRAFT_PLAN_KEY) || platform.storage.getItem(LEGACY_DRAFT_PLAN_KEY);
    if (!raw || typeof raw !== 'string') return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('Failed to load draft plan from platform storage', { err });
    return null;
  }
}

export function clearDraftPlan(): void {
  try {
    platform.storage.removeItem(DRAFT_PLAN_KEY);
    platform.storage.removeItem(LEGACY_DRAFT_PLAN_KEY);
  } catch (err) {
    logger.warn('Failed to clear draft plan from platform storage', { err });
  }
}
