import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserStreak, FitnessCoinTransaction } from '@/types/streak.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class StreakRepository {
  async fetchStreak(userId: string): Promise<UserStreak> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`streak_${userId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return { currentStreak: 3, longestStreak: 7, lastActivityDate: '2026-09-09' };
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
  }

  async fetchCoinBalance(userId: string): Promise<number> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`coin_balance_${userId}`);
      if (stored && typeof stored === 'string') {
        const val = parseInt(stored, 10);
        if (!isNaN(val)) return val;
      }
      return 160;
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
  }

  async fetchCoinHistory(userId: string, limit = 20): Promise<FitnessCoinTransaction[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
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
  }

  async logRestDay(userId: string, dateStr: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`streak_${userId}`);
      if (stored && typeof stored === 'string') {
        try {
          const parsed = JSON.parse(stored);
          platform.storage.setItem(`streak_${userId}`, JSON.stringify({ ...parsed, lastActivityDate: dateStr }));
        } catch { /* ignore */ }
      }
      return { success: true };
    }

    try {
      const { error: eventError } = await supabase
        .from('streak_events')
        .insert({
          user_id: userId,
          event_date: dateStr,
          event_type: 'rest_day',
        });

      if (eventError && eventError.code !== '23505') {
        return { success: false, error: eventError.message };
      }

      await supabase
        .from('streaks')
        .update({
          last_activity_date: dateStr,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log rest day';
      return { success: false, error: msg };
    }
  }

  async useReviveRpc(
    userId: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; currentStreak?: number; revivesRemaining?: number; isQuotaExceeded?: boolean; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      return { success: true, currentStreak: 4, revivesRemaining: 2 };
    }

    try {
      const { data, error } = await supabase.rpc('use_streak_revive', {
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        logger.error('StreakRepository: use_streak_revive RPC error', { error });
        return { success: false, error: error.message };
      }

      return {
        success: data.status === 'success',
        currentStreak: data.current_streak,
        revivesRemaining: data.revives_remaining,
        isQuotaExceeded: data.status === 'quota_exceeded',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute streak revive';
      return { success: false, error: msg };
    }
  }
}

export const streakRepository = new StreakRepository();
