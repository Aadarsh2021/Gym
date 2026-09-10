/**
 * Temporary draft storage for active workout session resilience
 * (Prevents data loss on accidental browser refresh or gym connectivity drops)
 */

import { WorkoutSession } from '@/types/workout.types';
import { logger } from '@/lib/logger';

const ACTIVE_SESSION_DRAFT_KEY = 'fitness_active_session_draft';

export function saveActiveSessionDraft(session: WorkoutSession): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_DRAFT_KEY, JSON.stringify(session));
  } catch (err) {
    logger.warn('Failed to persist workout draft to local storage', { err });
  }
}

export function loadActiveSessionDraft(): WorkoutSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('Failed to load workout draft from local storage', { err });
    return null;
  }
}

export function clearActiveSessionDraft(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_DRAFT_KEY);
  } catch (err) {
    logger.warn('Failed to clear workout draft from local storage', { err });
  }
}

const DRAFT_PLAN_KEY = 'fitness_draft_plan_review';
const LEGACY_DRAFT_PLAN_KEY = 'apexfit_draft_plan_review';

export function saveDraftPlan(plan: any): void {
  try {
    sessionStorage.setItem(DRAFT_PLAN_KEY, JSON.stringify(plan));
  } catch (err) {
    logger.warn('Failed to save draft plan to session storage', { err });
  }
}

export function loadDraftPlan(): any | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_PLAN_KEY) || sessionStorage.getItem(LEGACY_DRAFT_PLAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('Failed to load draft plan from session storage', { err });
    return null;
  }
}

export function clearDraftPlan(): void {
  try {
    sessionStorage.removeItem(DRAFT_PLAN_KEY);
    sessionStorage.removeItem(LEGACY_DRAFT_PLAN_KEY);
  } catch (err) {
    logger.warn('Failed to clear draft plan from session storage', { err });
  }
}
