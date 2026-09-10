export type StreakEventType = 'workout_completed' | 'rest_day' | 'revive';

export interface UserStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

export interface StreakEvent {
  id: string;
  eventDate: string;
  eventType: StreakEventType;
  sessionId?: string | null;
}

export interface FitnessCoinTransaction {
  id: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  createdAt: string;
}

export interface Achievement {
  id: string;
  achievementType: string;
  unlockedAt: string;
}
