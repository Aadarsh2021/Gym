/**
 * Temporary draft storage for active workout session resilience
 * (Prevents data loss on accidental browser refresh or gym connectivity drops)
 * Platform-independent: routes through platform.storage.
 */

import { WorkoutSession } from '@/types/workout.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const ACTIVE_SESSION_DRAFT_KEY = 'fitness_active_session_draft';

export function saveActiveSessionDraft(session: WorkoutSession): void {
  try {
    platform.storage.setItem(ACTIVE_SESSION_DRAFT_KEY, JSON.stringify(session));
  } catch (err) {
    logger.warn('Failed to persist workout draft to platform storage', { err });
  }
}

export function loadActiveSessionDraft(): WorkoutSession | null {
  try {
    const raw = platform.storage.getItem(ACTIVE_SESSION_DRAFT_KEY);
    if (!raw || typeof raw !== 'string') return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('Failed to load workout draft from platform storage', { err });
    return null;
  }
}

export function clearActiveSessionDraft(): void {
  try {
    platform.storage.removeItem(ACTIVE_SESSION_DRAFT_KEY);
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
