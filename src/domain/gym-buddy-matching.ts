/**
 * Pure Domain Gym Buddy Matching Engine (Phase G3)
 * 100% Deterministic, Framework-Independent, Zero Non-Deterministic AI/LLMs.
 */

import { GymBuddyCandidate, GymBuddyMatchReason, GymTrainingTimeWindow } from '@/types/gym.types';
import { FitnessGoal, ExperienceLevel } from '@/types/user.types';

export interface BuddyMatchingProfile {
  userId: string;
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  workoutDurationMinutes: number;
  daysPerWeek: number;
  preferredTrainingTime: GymTrainingTimeWindow;
  preferredTrainingDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
}

/**
 * Checks if two training time windows are adjacent.
 */
export function isAdjacentTimeWindow(a: GymTrainingTimeWindow, b: GymTrainingTimeWindow): boolean {
  const order: GymTrainingTimeWindow[] = ['early_morning', 'morning', 'afternoon', 'evening', 'night'];
  const idxA = order.indexOf(a);
  const idxB = order.indexOf(b);
  if (idxA === -1 || idxB === -1) return false;
  return Math.abs(idxA - idxB) === 1;
}

/**
 * Checks if two goals have high training synergy.
 */
export function isSynergisticGoal(a: FitnessGoal, b: FitnessGoal): boolean {
  if (a === b) return true;
  if ((a === 'muscle_gain' && b === 'strength') || (a === 'strength' && b === 'muscle_gain')) return true;
  if ((a === 'fat_loss' && b === 'endurance') || (a === 'endurance' && b === 'fat_loss')) return true;
  if (a === 'maintenance' && (b === 'muscle_gain' || b === 'fat_loss')) return true;
  if (b === 'maintenance' && (a === 'muscle_gain' || a === 'fat_loss')) return true;
  return false;
}

/**
 * Checks if two experience levels are adjacent.
 */
export function isAdjacentExperience(a: ExperienceLevel, b: ExperienceLevel): boolean {
  const order: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
  const idxA = order.indexOf(a);
  const idxB = order.indexOf(b);
  if (idxA === -1 || idxB === -1) return false;
  return Math.abs(idxA - idxB) === 1;
}

/**
 * Computes Jaccard similarity of two arrays of numbers: |A ∩ B| / |A ∪ B|.
 */
export function calculateJaccardSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export interface CompatibilityScoreBreakdown {
  scheduleScore: number;
  goalScore: number;
  experienceScore: number;
  durationScore: number;
  frequencyScore: number;
  totalScore: number;
  daysOverlapCount: number;
  matchReasons: GymBuddyMatchReason[];
}

/**
 * Calculates authoritative 100-point compatibility score between two member profiles.
 */
export function calculateBuddyCompatibility(
  a: BuddyMatchingProfile,
  b: BuddyMatchingProfile
): CompatibilityScoreBreakdown {
  // 1. Schedule & Time (30 pts max)
  let timePts = 0;
  if (a.preferredTrainingTime === b.preferredTrainingTime) {
    timePts = 18;
  } else if (isAdjacentTimeWindow(a.preferredTrainingTime, b.preferredTrainingTime)) {
    timePts = 9;
  }

  const jaccard = calculateJaccardSimilarity(a.preferredTrainingDays, b.preferredTrainingDays);
  const dayPts = Math.round(12.0 * jaccard);
  const scheduleScore = timePts + dayPts;

  // Day overlap count
  const setB = new Set(b.preferredTrainingDays);
  const daysOverlapCount = a.preferredTrainingDays.filter(d => setB.has(d)).length;

  // 2. Goal Compatibility (25 pts max)
  let goalScore = 8;
  if (a.goal === b.goal) {
    goalScore = 25;
  } else if (isSynergisticGoal(a.goal, b.goal)) {
    goalScore = 18;
  }

  // 3. Experience Proximity (20 pts max)
  let experienceScore = 4;
  if (a.experienceLevel === b.experienceLevel) {
    experienceScore = 20;
  } else if (isAdjacentExperience(a.experienceLevel, b.experienceLevel)) {
    experienceScore = 12;
  }

  // 4. Workout Duration Proximity (15 pts max)
  const durationDiff = Math.abs(a.workoutDurationMinutes - b.workoutDurationMinutes);
  let durationScore = 0;
  if (durationDiff <= 15) {
    durationScore = 15;
  } else if (durationDiff <= 30) {
    durationScore = 10;
  } else if (durationDiff <= 45) {
    durationScore = 5;
  }

  // 5. Frequency Proximity (10 pts max)
  const freqDiff = Math.abs(a.daysPerWeek - b.daysPerWeek);
  let frequencyScore = 0;
  if (freqDiff === 0) {
    frequencyScore = 10;
  } else if (freqDiff === 1) {
    frequencyScore = 7;
  } else if (freqDiff === 2) {
    frequencyScore = 4;
  }

  const totalScore = scheduleScore + goalScore + experienceScore + durationScore + frequencyScore;

  // Generate explainable match badges
  const matchReasons: GymBuddyMatchReason[] = [];

  if (a.goal === b.goal) {
    const formattedGoal = b.goal.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    matchReasons.push({
      type: 'goal',
      label: `Same Goal: ${formattedGoal}`,
      icon: 'target',
    });
  }

  if (a.preferredTrainingTime === b.preferredTrainingTime) {
    const formattedTime = b.preferredTrainingTime.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    matchReasons.push({
      type: 'time',
      label: `${formattedTime} Lifters`,
      icon: 'sun',
    });
  }

  if (daysOverlapCount > 0) {
    matchReasons.push({
      type: 'days',
      label: `${daysOverlapCount} Overlapping Day${daysOverlapCount > 1 ? 's' : ''}`,
      icon: 'calendar',
    });
  }

  if (a.experienceLevel === b.experienceLevel) {
    matchReasons.push({
      type: 'experience',
      label: `Same Level: ${b.experienceLevel.charAt(0).toUpperCase() + b.experienceLevel.slice(1)}`,
      icon: 'zap',
    });
  }

  if (durationDiff <= 15) {
    matchReasons.push({
      type: 'duration',
      label: `Similar Pace (~${b.workoutDurationMinutes}m)`,
      icon: 'clock',
    });
  }

  return {
    scheduleScore,
    goalScore,
    experienceScore,
    durationScore,
    frequencyScore,
    totalScore,
    daysOverlapCount,
    matchReasons,
  };
}

/**
 * Deterministic tie-breaking comparator:
 * 1. Score DESC
 * 2. Days overlap count DESC
 * 3. User ID ASC
 */
export function compareCandidates(
  a: GymBuddyCandidate & { daysOverlapCount?: number },
  b: GymBuddyCandidate & { daysOverlapCount?: number }
): number {
  if (b.compatibilityScore !== a.compatibilityScore) {
    return b.compatibilityScore - a.compatibilityScore;
  }
  const overlapA = a.daysOverlapCount ?? 0;
  const overlapB = b.daysOverlapCount ?? 0;
  if (overlapB !== overlapA) {
    return overlapB - overlapA;
  }
  return a.userId.localeCompare(b.userId);
}
