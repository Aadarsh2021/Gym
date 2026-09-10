/**
 * Privacy-Conscious Telemetry & Event Analytics
 * Collects zero PII. Tracks consumer funnel milestones:
 * Acquisition -> Activation -> Retention
 */

import { logger } from './logger';

export type FunnelEvent =
  | 'landing_view'
  | 'signup_started'
  | 'signup_completed'
  | 'onboarding_completed'
  | 'workout_generated'
  | 'workout_started'
  | 'exercise_completed'
  | 'workout_completed'
  | 'meal_plan_generated'
  | 'protein_search'
  | 'streak_started'
  | 'streak_milestone'
  | 'guru_ji_message'
  | 'share_card_generated'
  | 'return_visit';

export function trackEvent(event: FunnelEvent, metadata?: Record<string, string | number | boolean>): void {
  // In development, log cleanly
  logger.debug(`[Telemetry] ${event}`, metadata);

  // In production, this can push to a privacy-friendly collector without cookies or PII
}
