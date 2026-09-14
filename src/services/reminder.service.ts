import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { entitlementService } from '@/services/entitlement.service';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

export type AlarmMotivationStyle = 'basic' | 'gentle' | 'motivational' | 'tough_love';

export const MOTIVATION_TEMPLATES: Record<
  AlarmMotivationStyle,
  { title: string; message: string; label: string; description: string; isPremium: boolean }
> = {
  basic: {
    label: 'Standard Reminder',
    description: 'Direct session reminder to maintain your training habit.',
    isPremium: false,
    title: 'Time for Today’s Workout Session',
    message: 'Your scheduled training session is waiting. Maintain your streak today!',
  },
  gentle: {
    label: 'Gentle Motivation',
    description: 'Supportive and encouraging prompt focused on well-being.',
    isPremium: true,
    title: 'FitBoost Daily Movement',
    message: 'Every workout counts. Take a deep breath, step into your space, and enjoy building your strength today.',
  },
  motivational: {
    label: 'Motivational Push',
    description: 'High-energy athletic drive emphasizing consistency and ambition.',
    isPremium: true,
    title: 'FitBoost Championship Mindset',
    message: 'Consistency separates ambition from accomplishment. Your future PRs are earned right now. Let’s crush this session!',
  },
  tough_love: {
    label: 'Tough-Love Discipline',
    description: 'Direct, focused discipline protocol. Zero rationalizing delays.',
    isPremium: true,
    title: 'FitBoost Discipline Protocol',
    message: 'No compromises, no rationalizing delays. Put your training gear on and execute your sets. Discipline over excuses.',
  },
};

export interface WorkoutReminderPreference {
  id?: string;
  userId: string;
  enabled: boolean;
  time: string; // 'HH:MM' (24-hour format)
  days: number[]; // 1 = Monday, 7 = Sunday
  title: string;
  message: string;
  motivationStyle?: AlarmMotivationStyle;
  snoozedUntil?: string | null;
}

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

// In-memory active timer handle registry to prevent duplicate alarms across re-renders
let activeTimerHandle: any = null;
let activeSnoozeHandle: any = null;

export const reminderService = {
  /**
   * Check current notification permission status via platform
   */
  getPermissionStatus(): NotificationPermissionStatus {
    return platform.notifications.getPermissionStatus();
  },

  /**
   * Request notification permission via platform
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    return platform.notifications.requestPermission();
  },

  /**
   * Fetch saved workout reminder preference for a user
   * Authoritative store: Supabase public.notifications
   */
  async getReminderPreference(userId: string): Promise<WorkoutReminderPreference> {
    const defaultPreference: WorkoutReminderPreference = {
      userId,
      enabled: false,
      time: '07:30',
      days: [1, 2, 3, 4, 5], // Monday through Friday
      title: 'Time for Today’s Workout Session',
      message: 'Your scheduled training session is waiting. Maintain your streak today!',
      snoozedUntil: null,
    };

    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`reminder_pref_${userId}`);
      return stored ? JSON.parse(stored) : defaultPreference;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'workout_reminder')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        const stored = localStorage.getItem(`reminder_pref_${userId}`);
        return stored ? JSON.parse(stored) : defaultPreference;
      }

      // Convert Supabase TIME format (e.g. '07:30:00') to '07:30'
      const timeStr = data.scheduled_time ? data.scheduled_time.substring(0, 5) : '07:30';

      // Machine-readable notification_style from DB, fallback to string-check or default 'basic'
      let motivationStyle: AlarmMotivationStyle = (data.notification_style as AlarmMotivationStyle) || 'basic';
      if (!data.notification_style) {
        if (data.message?.includes('Championship Mindset') || data.message?.includes('separates ambition')) {
          motivationStyle = 'motivational';
        } else if (data.message?.includes('Discipline Protocol') || data.message?.includes('No compromises')) {
          motivationStyle = 'tough_love';
        } else if (data.message?.includes('Daily Movement') || data.message?.includes('deep breath')) {
          motivationStyle = 'gentle';
        }
      }

      return {
        id: data.id,
        userId: data.user_id,
        enabled: data.is_active,
        time: timeStr,
        days: Array.isArray(data.scheduled_days) ? data.scheduled_days : [1, 2, 3, 4, 5],
        title: data.title || defaultPreference.title,
        message: data.message || defaultPreference.message,
        motivationStyle,
        snoozedUntil: null,
      };
    } catch {
      const stored = localStorage.getItem(`reminder_pref_${userId}`);
      return stored ? JSON.parse(stored) : defaultPreference;
    }
  },

  /**
   * Save reminder preference to Supabase with local fallback
   */
  async saveReminderPreference(
    pref: WorkoutReminderPreference
  ): Promise<{ success: boolean; data?: WorkoutReminderPreference; error?: string }> {
    // Validate time format 'HH:MM'
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(pref.time)) {
      return { success: false, error: 'Invalid reminder time format (must be HH:MM in 24h format)' };
    }

    // Authoritative entitlement check for Premium Motivation Styles
    if (pref.motivationStyle && pref.motivationStyle !== 'basic') {
      const entitlement = await entitlementService.assertServerEntitlement(pref.userId);
      if (!entitlement.authorized) {
        return {
          success: false,
          error: 'PREMIUM_REQUIRED: Motivational and Tough-Love alarms require an active Premium subscription.',
        };
      }
    }

    // Apply template title & message if style specified
    if (pref.motivationStyle && MOTIVATION_TEMPLATES[pref.motivationStyle]) {
      const template = MOTIVATION_TEMPLATES[pref.motivationStyle];
      pref.title = template.title;
      pref.message = template.message;
    }

    // Save locally for offline / fast access
    localStorage.setItem(`reminder_pref_${pref.userId}`, JSON.stringify(pref));

    if (!isSupabaseConfigured) {
      this.rescheduleSameSessionTimer(pref);
      return { success: true, data: pref };
    }

    try {
      if (pref.id) {
        // Update existing notification row
        let { error } = await supabase
          .from('notifications')
          .update({
            scheduled_time: `${pref.time}:00`,
            scheduled_days: pref.days,
            is_active: pref.enabled,
            title: pref.title,
            message: pref.message,
            notification_style: pref.motivationStyle || 'basic',
          })
          .eq('id', pref.id)
          .eq('user_id', pref.userId);

        if (error && error.code === 'PGRST204') {
          // Backward-compatibility: live Supabase migration 20260913000005 not yet applied
          const fallback = await supabase
            .from('notifications')
            .update({
              scheduled_time: `${pref.time}:00`,
              scheduled_days: pref.days,
              is_active: pref.enabled,
              title: pref.title,
              message: pref.message,
            })
            .eq('id', pref.id)
            .eq('user_id', pref.userId);
          error = fallback.error;
        }

        if (error) {
          logger.warn('Failed to sync updated notification to Supabase, preserving local preference', { error });
          this.rescheduleSameSessionTimer(pref);
          return { success: true, data: pref };
        }
      } else {
        // Insert new notification configuration
        let { data, error } = await supabase
          .from('notifications')
          .insert({
            user_id: pref.userId,
            type: 'workout_reminder',
            notification_style: pref.motivationStyle || 'basic',
            scheduled_time: `${pref.time}:00`,
            scheduled_days: pref.days,
            is_active: pref.enabled,
            title: pref.title,
            message: pref.message,
          })
          .select()
          .single();

        if (error && error.code === 'PGRST204') {
          // Backward-compatibility: live Supabase migration 20260913000005 not yet applied
          const fallback = await supabase
            .from('notifications')
            .insert({
              user_id: pref.userId,
              type: 'workout_reminder',
              scheduled_time: `${pref.time}:00`,
              scheduled_days: pref.days,
              is_active: pref.enabled,
              title: pref.title,
              message: pref.message,
            })
            .select()
            .single();
          data = fallback.data;
          error = fallback.error;
        }

        if (error) {
          logger.warn('Failed to insert notification into Supabase, preserving local preference', { error });
          this.rescheduleSameSessionTimer(pref);
          return { success: true, data: pref };
        }

        if (data) {
          pref.id = data.id;
        }
      }

      this.rescheduleSameSessionTimer(pref);
      return { success: true, data: pref };
    } catch (err: any) {
      this.rescheduleSameSessionTimer(pref);
      return { success: false, error: err?.message || 'Unexpected exception saving reminder preference' };
    }
  },

  /**
   * Calculates milliseconds until the next scheduled reminder time
   */
  getMillisecondsUntilNextReminder(timeStr: string, scheduledDays: number[], now = new Date()): number | null {
    if (!timeStr || !scheduledDays || scheduledDays.length === 0) return null;

    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    // Convert JS getDay() (0=Sun, 1=Mon, ..., 6=Sat) to ISO day (1=Mon, ..., 7=Sun)
    const currentJsDay = now.getDay();
    const currentIsoDay = currentJsDay === 0 ? 7 : currentJsDay;

    // Target time today
    const targetToday = new Date(now);
    targetToday.setHours(hours, minutes, 0, 0);

    const diffToday = targetToday.getTime() - now.getTime();

    // Check if scheduled today and time is still in future
    if (diffToday > 0 && scheduledDays.includes(currentIsoDay)) {
      return diffToday;
    }

    // Find next scheduled day
    for (let offset = 1; offset <= 7; offset++) {
      const nextDayIso = ((currentIsoDay - 1 + offset) % 7) + 1;
      if (scheduledDays.includes(nextDayIso)) {
        const nextDate = new Date(now);
        nextDate.setDate(now.getDate() + offset);
        nextDate.setHours(hours, minutes, 0, 0);
        return Math.max(0, nextDate.getTime() - now.getTime());
      }
    }

    return null;
  },

  /**
   * Formats millisecond duration into human-readable hours and minutes countdown
   */
  formatTimeRemaining(ms: number | null): string {
    if (ms === null) return 'Not scheduled';
    if (ms <= 0) return 'Due now';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return 'under a minute';
  },

  /**
   * Reschedule active same-session timer
   */
  rescheduleSameSessionTimer(
    pref: WorkoutReminderPreference,
    onTrigger?: (title: string, body: string) => void
  ) {
    this.clearScheduledTimers();

    if (!pref.enabled) return;

    const msUntil = this.getMillisecondsUntilNextReminder(pref.time, pref.days);
    if (msUntil === null) return;

    // Max safe 32-bit integer for setTimeout is 2,147,483,647 ms (~24.8 days)
    if (msUntil > 2147483647) return;

    activeTimerHandle = setTimeout(() => {
      this.triggerNotification(pref.title, pref.message);
      if (onTrigger) onTrigger(pref.title, pref.message);
      // Recursively schedule next occurrence
      this.rescheduleSameSessionTimer(pref, onTrigger);
    }, msUntil);
  },

  /**
   * Snooze the reminder for N minutes (default 10 minutes)
   */
  snooze(
    pref: WorkoutReminderPreference,
    minutes = 10,
    onTrigger?: (title: string, body: string) => void
  ): { snoozedUntil: string } {
    if (activeSnoozeHandle) {
      clearTimeout(activeSnoozeHandle);
      activeSnoozeHandle = null;
    }

    const snoozeMs = minutes * 60 * 1000;
    const snoozedDate = new Date(Date.now() + snoozeMs);
    const snoozedUntilIso = snoozedDate.toISOString();

    activeSnoozeHandle = setTimeout(() => {
      this.triggerNotification(
        `[Snooze Alert] ${pref.title}`,
        `Your ${minutes}-minute snooze ended. Time to hit your workout session!`
      );
      if (onTrigger) {
        onTrigger(`[Snooze Alert] ${pref.title}`, 'Your snooze ended. Time to train!');
      }
    }, snoozeMs);

    return { snoozedUntil: snoozedUntilIso };
  },

  /**
   * Clear all running setTimeout timers
   */
  clearScheduledTimers() {
    if (activeTimerHandle) {
      clearTimeout(activeTimerHandle);
      activeTimerHandle = null;
    }
    if (activeSnoozeHandle) {
      clearTimeout(activeSnoozeHandle);
      activeSnoozeHandle = null;
    }
  },

  /**
   * Dispatch notification via platform adapter
   */
  triggerNotification(title: string, body: string): boolean {
    if (platform.notifications.getPermissionStatus() !== 'granted') return false;
    platform.notifications.dispatchImmediate({ title, body });
    return true;
  },

  /**
   * Immediate test notification dispatch
   */
  async sendTestNotification(
    title = 'FitBoost Workout Alarm Test',
    message = 'Workout reminder test successful! Reminders will trigger during your active sessions.'
  ): Promise<{ success: boolean; message: string }> {
    const perm = this.getPermissionStatus();
    if (perm === 'unsupported') {
      return { success: false, message: 'Notification API is not supported on this device/browser.' };
    }
    if (perm === 'denied') {
      return {
        success: false,
        message: 'Notification permission is blocked. Please allow notifications in your device or browser settings.',
      };
    }
    if (perm === 'default') {
      const requested = await this.requestPermission();
      if (requested !== 'granted') {
        return { success: false, message: 'Notification permission was not granted.' };
      }
    }

    const sent = this.triggerNotification(title, message);
    if (sent) {
      return { success: true, message: 'Test notification sent to your system!' };
    }
    return { success: false, message: 'Could not deliver system notification.' };
  },
};
