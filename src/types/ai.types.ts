export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface CoachResponse {
  message: string;
  suggestedAction?: 'view_workout' | 'log_workout' | 'check_nutrition' | 'rest_day';
  disclaimer?: string;
}

export interface ScopedAIContext {
  goal: string;
  experience: string;
  diet: string;
  currentStreak: number;
  activePlan: string;
}
