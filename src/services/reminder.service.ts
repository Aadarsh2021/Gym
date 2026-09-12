import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface WorkoutReminderPreference {
  id?: string;
  userId: string;
  enabled: boolean;
  time: string; // 'HH:MM' (24-hour format)
  days: number[]; // 1 = Monday, 7 = Sunday
  title: string;
  message: string;
  snoozedUntil?: string | null;
}

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

// In-memory active timer handle registry to prevent duplicate alarms across re-renders
let activeTimerHandle: any = null;
let activeSnoozeHandle: any = null;

export const reminderService = {
  /**
   * Check current browser Notification API permission status
   */
  getPermissionStatus(): NotificationPermissionStatus {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as NotificationPermissionStatus;
  },

  /**
   * Request browser notification permission
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      return result as NotificationPermissionStatus;
    } catch {
      return 'denied';
    }
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

      return {
        id: data.id,
        userId: data.user_id,
        enabled: data.is_active,
        time: timeStr,
        days: Array.isArray(data.scheduled_days) ? data.scheduled_days : [1, 2, 3, 4, 5],
        title: data.title || defaultPreference.title,
        message: data.message || defaultPreference.message,
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

    // Save locally for offline / fast access
    localStorage.setItem(`reminder_pref_${pref.userId}`, JSON.stringify(pref));

    if (!isSupabaseConfigured) {
      this.rescheduleSameSessionTimer(pref);
      return { success: true, data: pref };
    }

    try {
      if (pref.id) {
        // Update existing notification row
        const { error } = await supabase
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

        if (error) {
          this.rescheduleSameSessionTimer(pref);
          return { success: true, data: pref };
        }
      } else {
        // Insert new notification configuration
        const { data, error } = await supabase
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

        if (error || !data) {
          this.rescheduleSameSessionTimer(pref);
          return { success: true, data: pref };
        }

        pref.id = data.id;
      }

      this.rescheduleSameSessionTimer(pref);
      return { success: true, data: pref };
    } catch {
      this.rescheduleSameSessionTimer(pref);
      return { success: true, data: pref };
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
   * Dispatch system notification and fallback gracefully
   */
  triggerNotification(title: string, body: string): boolean {
    if (typeof window === 'undefined') return false;

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/vite.svg',
          badge: '/vite.svg',
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },

  /**
   * Immediate test notification dispatch
   */
  async sendTestNotification(
    title = 'FitSphere Workout Alarm Test',
    message = 'Workout reminder test successful! Reminders will trigger during your active sessions.'
  ): Promise<{ success: boolean; message: string }> {
    const perm = this.getPermissionStatus();
    if (perm === 'unsupported') {
      return { success: false, message: 'Browser Notification API is not supported on this browser.' };
    }
    if (perm === 'denied') {
      return {
        success: false,
        message: 'Notification permission is blocked. Please allow notifications in your browser address bar.',
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
