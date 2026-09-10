import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserStreak, FitnessCoinTransaction } from '@/types/streak.types';

export const streakService = {
  async getStreak(userId: string): Promise<UserStreak> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`streak_${userId}`);
      return stored ? JSON.parse(stored) : { currentStreak: 3, longestStreak: 7, lastActivityDate: '2026-09-09' };
    }

    try {
      const { data, error } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
      }

      return {
        currentStreak: data.current_streak,
        longestStreak: data.longest_streak,
        lastActivityDate: data.last_activity_date,
      };
    } catch {
      return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
    }
  },

  async getCoinBalance(userId: string): Promise<number> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`coin_balance_${userId}`);
      return stored ? parseInt(stored, 10) : 160;
    }

    try {
      const { data, error } = await supabase
        .from('fitness_coins')
        .select('amount')
        .eq('user_id', userId);

      if (error || !data) return 0;
      return data.reduce((sum, item) => sum + item.amount, 0);
    } catch {
      return 0;
    }
  },

  async getCoinHistory(userId: string, limit = 20): Promise<FitnessCoinTransaction[]> {
    if (!isSupabaseConfigured) {
      return [
        { id: 'c-1', amount: 50, source: 'achievement', referenceId: 'first_workout', createdAt: '2026-09-08' },
        { id: 'c-2', amount: 10, source: 'workout_completed', referenceId: 'session-1', createdAt: '2026-09-08' },
        { id: 'c-3', amount: 100, source: 'achievement', referenceId: 'streak_7_days', createdAt: '2026-09-09' },
      ];
    }

    try {
      const { data, error } = await supabase
        .from('fitness_coins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      return data.map(d => ({
        id: d.id,
        amount: d.amount,
        source: d.source,
        referenceId: d.reference_id,
        createdAt: d.created_at,
      }));
    } catch {
      return [];
    }
  },

  async useRevive(idempotencyKey: string): Promise<{ success: boolean; currentStreak?: number; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: true, currentStreak: 7 };
    }

    try {
      const { data, error } = await supabase.rpc('use_streak_revive', {
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, currentStreak: (data as any)?.current_streak };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Streak revive failed';
      return { success: false, error: message };
    }
  },
};
