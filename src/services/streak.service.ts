import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserStreak, FitnessCoinTransaction } from '@/types/streak.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const memoryStore: Record<string, string> = {};
const getStorageItem = (key: string): string | null => {
  if (typeof localStorage !== 'undefined') {
    try { return localStorage.getItem(key); } catch { /* ignore */ }
  }
  return memoryStore[key] ?? null;
};
const setStorageItem = (key: string, value: string): void => {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(key, value); return; } catch { /* ignore */ }
  }
  memoryStore[key] = value;
};

export const streakService = {
  async getStreak(userId: string): Promise<UserStreak> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = getStorageItem(`streak_${userId}`);
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
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = getStorageItem(`coin_balance_${userId}`);
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
  },

  async logRestDay(userId: string, dateStr?: string): Promise<{ success: boolean; error?: string }> {
    const today = dateStr || new Date().toISOString().split('T')[0];
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = getStorageItem(`streak_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setStorageItem(`streak_${userId}`, JSON.stringify({ ...parsed, lastActivityDate: today }));
      }
      return { success: true };
    }

    try {
      const { error: eventError } = await supabase
        .from('streak_events')
        .insert({
          user_id: userId,
          event_date: today,
          event_type: 'rest_day',
        });

      if (eventError) {
        return { success: false, error: eventError.message };
      }

      await supabase
        .from('streaks')
        .update({
          last_activity_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to log rest day';
      return { success: false, error: message };
    }
  },

  async getMonthlyRevivesStatus(userId: string): Promise<{ used: number; remaining: number }> {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = getStorageItem(`streak_revives_${userId}`);
      let data = stored ? JSON.parse(stored) : { month: currentMonth, used: 0 };
      if (data.month !== currentMonth) {
        data = { month: currentMonth, used: 0 };
        setStorageItem(`streak_revives_${userId}`, JSON.stringify(data));
      }
      return { used: data.used, remaining: Math.max(0, 3 - data.used) };
    }

    try {
      const startOfMonth = `${currentMonth}-01T00:00:00.000Z`;
      const { count, error } = await supabase
        .from('streak_revives')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('used_at', startOfMonth);

      if (error) {
        return { used: 0, remaining: 3 };
      }
      const used = count || 0;
      return { used, remaining: Math.max(0, 3 - used) };
    } catch {
      return { used: 0, remaining: 3 };
    }
  },

  async useRevive(
    idempotencyKey: string,
    userId?: string
  ): Promise<{ success: boolean; currentStreak?: number; revivesRemaining?: number; isQuotaExceeded?: boolean; error?: string }> {
    const uid = userId || 'guest-user';
    const currentMonth = new Date().toISOString().slice(0, 7);

    if (!isSupabaseConfigured || !UUID_REGEX.test(uid)) {
      const stored = getStorageItem(`streak_revives_${uid}`);
      let data = stored ? JSON.parse(stored) : { month: currentMonth, used: 0 };
      if (data.month !== currentMonth) {
        data = { month: currentMonth, used: 0 };
      }

      if (data.used >= 3) {
        return {
          success: false,
          error: 'Monthly revive limit reached (3 per month). Additional revives require a paid add-on.',
          revivesRemaining: 0,
          isQuotaExceeded: true,
        };
      }

      data.used += 1;
      setStorageItem(`streak_revives_${uid}`, JSON.stringify(data));

      const rawStreak = getStorageItem(`streak_${uid}`);
      const currentStreakData = rawStreak ? JSON.parse(rawStreak) : { currentStreak: 1, longestStreak: 7, lastActivityDate: null };
      currentStreakData.currentStreak = Math.max(currentStreakData.longestStreak || 1, 1);
      currentStreakData.lastActivityDate = new Date().toISOString().split('T')[0];
      setStorageItem(`streak_${uid}`, JSON.stringify(currentStreakData));

      return {
        success: true,
        currentStreak: currentStreakData.currentStreak,
        revivesRemaining: Math.max(0, 3 - data.used),
      };
    }

    try {
      const { data, error } = await supabase.rpc('use_streak_revive', {
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        const isQuota = error.message?.includes('limit reached') || error.code === '42901';
        return {
          success: false,
          error: isQuota
            ? 'Monthly revive limit reached (3 per month). Additional revives require a paid add-on.'
            : error.message,
          isQuotaExceeded: isQuota,
        };
      }

      return {
        success: true,
        currentStreak: (data as any)?.current_streak,
        revivesRemaining: (data as any)?.revives_remaining_this_month,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Streak revive failed';
      return { success: false, error: message };
    }
  },
};
