/**
 * FITSPHERE V1 - WORKOUT QUALITY SCORE DOMAIN MODULE
 * Authoritative mirror of the Candidate C formula for presentation, tiering,
 * and client inspection.
 *
 * NOTE: The client calculation is for UI previews and explanation only.
 * The PostgreSQL complete_workout_session RPC remains the single authoritative source of truth.
 */

export interface QualityScoreInput {
  validSets: number;
  isCoreCompleted: boolean;
  durationSeconds: number;
  sessionRating?: 'easy' | 'normal' | 'exhausting' | string | null;
  newPrCount?: number;
}

export interface QualityScoreBreakdown {
  score: number;
  tier: QualityScoreTier;
  volumePoints: number;
  corePoints: number;
  cadencePoints: number;
  milestonePoints: number;
  effortPoints: number;
  prPoints: number;
}

export type QualityScoreTier = 'Elite' | 'Great' | 'Good' | 'Developing' | 'Incomplete';

/**
 * Exact Candidate C Quality Score Formula Mirror
 */
export function calculateWorkoutQualityScore(input: QualityScoreInput): QualityScoreBreakdown {
  const { validSets, isCoreCompleted, durationSeconds, sessionRating, newPrCount = 0 } = input;

  if (validSets <= 0) {
    return {
      score: 0,
      tier: 'Incomplete',
      volumePoints: 0,
      corePoints: 0,
      cadencePoints: 0,
      milestonePoints: 0,
      effortPoints: 0,
      prPoints: 0,
    };
  }

  // 1. Volume Points (0, 15, 25, 35, 40)
  let volumePoints = 0;
  if (validSets >= 12) {
    volumePoints = 40;
  } else if (validSets >= 8) {
    volumePoints = 35;
  } else if (validSets >= 4) {
    volumePoints = 25;
  } else if (validSets >= 1) {
    volumePoints = 15;
  }

  // 2. Core Focus Points (0, 10, 25)
  let corePoints = 0;
  if (isCoreCompleted) {
    corePoints = 25;
  } else if (validSets >= 4) {
    corePoints = 10;
  } else {
    corePoints = 0;
  }

  // 3. Session Cadence Points (0, 5, 10, 15, 20)
  let cadencePoints = 0;
  if (durationSeconds < 300) {
    cadencePoints = 0;
  } else if (durationSeconds < 600) {
    cadencePoints = 5;
  } else if (durationSeconds < 900) {
    cadencePoints = 10;
  } else if (durationSeconds < 1200) {
    cadencePoints = 15;
  } else if (durationSeconds <= 4500) {
    cadencePoints = 20;
  } else if (durationSeconds <= 7200) {
    cadencePoints = 15;
  } else {
    cadencePoints = 5;
  }

  // 4. Milestone Points: Effort (0, 2, 5, 7) + PR (0, 5, 8), capped at 15
  let effortPoints = 0;
  if (sessionRating === 'exhausting') {
    effortPoints = 7;
  } else if (sessionRating === 'normal') {
    effortPoints = 5;
  } else if (sessionRating === 'easy') {
    effortPoints = 2;
  }

  let prPoints = 0;
  if (newPrCount >= 2) {
    prPoints = 8;
  } else if (newPrCount === 1) {
    prPoints = 5;
  }

  const milestonePoints = Math.min(15, effortPoints + prPoints);

  // Final Score: Capped at 100
  const score = Math.min(100, volumePoints + corePoints + cadencePoints + milestonePoints);
  const tier = getQualityScoreTier(score);

  return {
    score,
    tier,
    volumePoints,
    corePoints,
    cadencePoints,
    milestonePoints,
    effortPoints,
    prPoints,
  };
}

/**
 * Returns the descriptive tier for a quality score
 */
export function getQualityScoreTier(score: number): QualityScoreTier {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'Great';
  if (score >= 50) return 'Good';
  if (score >= 1) return 'Developing';
  return 'Incomplete';
}

/**
 * Presentation colors and styles for Quality Score tiers
 */
export function getQualityScoreMeta(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return {
      tier: 'Unrated',
      badgeColor: 'bg-zinc-800 text-zinc-400 border-zinc-700',
      textColor: 'text-zinc-400',
      gradient: 'from-zinc-600 to-zinc-800',
      ringColor: 'stroke-zinc-700',
    };
  }

  const tier = getQualityScoreTier(score);
  switch (tier) {
    case 'Elite':
      return {
        tier: 'Elite',
        badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        textColor: 'text-amber-400',
        gradient: 'from-amber-400 to-yellow-600',
        ringColor: 'stroke-amber-400',
      };
    case 'Great':
      return {
        tier: 'Great',
        badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        textColor: 'text-emerald-400',
        gradient: 'from-emerald-400 to-teal-600',
        ringColor: 'stroke-emerald-400',
      };
    case 'Good':
      return {
        tier: 'Good',
        badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        textColor: 'text-blue-400',
        gradient: 'from-blue-400 to-indigo-600',
        ringColor: 'stroke-blue-400',
      };
    case 'Developing':
      return {
        tier: 'Developing',
        badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        textColor: 'text-purple-400',
        gradient: 'from-purple-400 to-violet-600',
        ringColor: 'stroke-purple-400',
      };
    case 'Incomplete':
    default:
      return {
        tier: 'Incomplete',
        badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        textColor: 'text-rose-400',
        gradient: 'from-rose-400 to-red-600',
        ringColor: 'stroke-rose-400',
      };
  }
}
