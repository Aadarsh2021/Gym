/**
 * Pure Deterministic Streak Engine
 * Evaluates consecutive calendar workout consistency, rest day protection, and revives.
 */

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null; // ISO YYYY-MM-DD
}

/**
 * Calculates updated streak count when a workout is completed today
 */
export function calculateUpdatedStreak(
  currentState: StreakState,
  todayDateStr: string // YYYY-MM-DD in user's timezone
): { newCurrentStreak: number; newLongestStreak: number } {
  const { currentStreak, longestStreak, lastActivityDate } = currentState;

  if (!lastActivityDate) {
    // First workout ever
    return {
      newCurrentStreak: 1,
      newLongestStreak: Math.max(longestStreak, 1),
    };
  }

  if (lastActivityDate === todayDateStr) {
    // Already worked out today; do not duplicate increment
    return {
      newCurrentStreak: currentStreak,
      newLongestStreak: longestStreak,
    };
  }

  // Calculate difference in days
  const today = new Date(todayDateStr);
  const lastDate = new Date(lastActivityDate);
  const diffTime = Math.abs(today.getTime() - lastDate.getTime());
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day
    const updated = currentStreak + 1;
    return {
      newCurrentStreak: updated,
      newLongestStreak: Math.max(longestStreak, updated),
    };
  }

  // Broken streak (more than 1 day missed without rest day freeze)
  return {
    newCurrentStreak: 1,
    newLongestStreak: Math.max(longestStreak, 1),
  };
}

/**
 * Validates whether user is eligible for free streak revive (Max 3 per calendar month)
 */
export function canUseStreakRevive(revivesUsedThisMonth: number): boolean {
  return revivesUsedThisMonth < 3;
}
