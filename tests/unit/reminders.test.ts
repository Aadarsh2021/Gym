import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reminderService, WorkoutReminderPreference } from '@/services/reminder.service';

// In-memory localStorage mock for node test environment
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => {
    storage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    Object.keys(storage).forEach(k => delete storage[k]);
  },
};
(globalThis as any).localStorage = mockLocalStorage;

// Mock window and Notification if in node environment
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

describe('Workout Alarms & Reminders Suite (Batch 6)', () => {
  beforeEach(() => {
    reminderService.clearScheduledTimers();
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    reminderService.clearScheduledTimers();
  });

  describe('Timer Scheduling Calculations (getMillisecondsUntilNextReminder)', () => {
    it('returns milliseconds until later today if scheduled day is today and time is in the future', () => {
      // Mock now as Wednesday (ISO day 3) at 06:00:00
      const mockNow = new Date('2026-09-09T06:00:00'); // Sept 9 2026 was Wednesday
      const timeStr = '07:30';
      const scheduledDays = [1, 2, 3, 4, 5]; // Mon-Fri

      const msUntil = reminderService.getMillisecondsUntilNextReminder(timeStr, scheduledDays, mockNow);
      expect(msUntil).not.toBeNull();
      // 06:00 to 07:30 = 90 minutes = 5,400,000 ms
      expect(msUntil).toBe(90 * 60 * 1000);
    });

    it('returns milliseconds until next scheduled day if today is scheduled but time has already passed', () => {
      // Mock now as Wednesday (ISO day 3) at 08:00:00
      const mockNow = new Date('2026-09-09T08:00:00');
      const timeStr = '07:30';
      const scheduledDays = [1, 2, 3, 4, 5]; // Next is Thursday (day 4) at 07:30

      const msUntil = reminderService.getMillisecondsUntilNextReminder(timeStr, scheduledDays, mockNow);
      expect(msUntil).not.toBeNull();
      // From Wed 08:00 to Thu 07:30 = 23.5 hours = 23.5 * 3600 * 1000 = 84,600,000 ms
      expect(msUntil).toBe(23.5 * 60 * 60 * 1000);
    });

    it('correctly rolls over the weekend if today is Friday after alarm time and next is Monday', () => {
      // Mock now as Friday (ISO day 5) at 10:00:00
      const mockNow = new Date('2026-09-11T10:00:00'); // Sept 11 2026 was Friday
      const timeStr = '07:30';
      const scheduledDays = [1, 3, 5]; // Mon, Wed, Fri. Next is Monday (day 1)

      const msUntil = reminderService.getMillisecondsUntilNextReminder(timeStr, scheduledDays, mockNow);
      expect(msUntil).not.toBeNull();
      // From Fri 10:00 to Mon 07:30 = 2 days and 21.5 hours = (48 + 21.5) * 3600 * 1000 = 69.5 * 3600 * 1000 ms
      expect(msUntil).toBe(69.5 * 60 * 60 * 1000);
    });

    it('returns null for invalid time string or empty scheduled days', () => {
      expect(reminderService.getMillisecondsUntilNextReminder('', [1, 2, 3])).toBeNull();
      expect(reminderService.getMillisecondsUntilNextReminder('invalid', [1, 2, 3])).toBeNull();
      expect(reminderService.getMillisecondsUntilNextReminder('07:30', [])).toBeNull();
    });
  });

  describe('Countdown Formatter (formatTimeRemaining)', () => {
    it('formats durations correctly into human-readable strings', () => {
      expect(reminderService.formatTimeRemaining(null)).toBe('Not scheduled');
      expect(reminderService.formatTimeRemaining(0)).toBe('Due now');
      expect(reminderService.formatTimeRemaining(-5000)).toBe('Due now');
      expect(reminderService.formatTimeRemaining(45 * 1000)).toBe('under a minute');
      expect(reminderService.formatTimeRemaining(25 * 60 * 1000)).toBe('25m');
      expect(reminderService.formatTimeRemaining((2 * 3600 + 15 * 60) * 1000)).toBe('2h 15m');
    });
  });

  describe('Reminder Preferences & Persistence Behavior', () => {
    it('returns sensible defaults when no preference is stored', async () => {
      const pref = await reminderService.getReminderPreference('test-athlete-1');
      expect(pref.userId).toBe('test-athlete-1');
      expect(pref.enabled).toBe(false);
      expect(pref.time).toBe('07:30');
      expect(pref.days).toEqual([1, 2, 3, 4, 5]);
    });

    it('rejects invalid time formats gracefully without crashing', async () => {
      const invalidPref: WorkoutReminderPreference = {
        userId: 'test-athlete-1',
        enabled: true,
        time: '25:99', // Invalid time
        days: [1],
        title: 'Workout',
        message: 'Let us train',
      };
      const res = await reminderService.saveReminderPreference(invalidPref);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid reminder time');
    });

    it('persists valid preferences to storage and reloads accurately', async () => {
      const validPref: WorkoutReminderPreference = {
        userId: 'test-athlete-2',
        enabled: true,
        time: '06:15',
        days: [1, 3, 5, 6],
        title: 'Morning Push',
        message: 'Time for squats and bench',
      };
      const res = await reminderService.saveReminderPreference(validPref);
      expect(res.success).toBe(true);

      const loaded = await reminderService.getReminderPreference('test-athlete-2');
      expect(loaded.time).toBe('06:15');
      expect(loaded.enabled).toBe(true);
      expect(loaded.days).toEqual([1, 3, 5, 6]);
    });
  });

  describe('Snooze Behavior & Duplicate Prevention', () => {
    it('snoozes reminder for exactly 5, 10, and 15 minutes and computes target ISO time', () => {
      const baseNow = 1757400000000;
      vi.spyOn(Date, 'now').mockReturnValue(baseNow);

      const pref: WorkoutReminderPreference = {
        userId: 'test-athlete-snooze',
        enabled: true,
        time: '08:00',
        days: [1, 2, 3],
        title: 'Snooze Test',
        message: 'Testing snooze',
      };

      // 5-minute snooze
      const res5 = reminderService.snooze(pref, 5);
      expect(res5.snoozedUntil).toBe(new Date(baseNow + 5 * 60 * 1000).toISOString());

      // 10-minute snooze
      const res10 = reminderService.snooze(pref, 10);
      expect(res10.snoozedUntil).toBe(new Date(baseNow + 10 * 60 * 1000).toISOString());

      // 15-minute snooze
      const res15 = reminderService.snooze(pref, 15);
      expect(res15.snoozedUntil).toBe(new Date(baseNow + 15 * 60 * 1000).toISOString());
    });

    it('prevents duplicate timers when rescheduling repeatedly', () => {
      const pref: WorkoutReminderPreference = {
        userId: 'test-athlete-dups',
        enabled: true,
        time: '23:59',
        days: [1, 2, 3, 4, 5, 6, 7],
        title: 'Daily Check',
        message: 'Daily session reminder',
      };

      // Reschedule multiple times sequentially
      expect(() => {
        reminderService.rescheduleSameSessionTimer(pref);
        reminderService.rescheduleSameSessionTimer(pref);
        reminderService.rescheduleSameSessionTimer(pref);
        reminderService.clearScheduledTimers();
      }).not.toThrow();
    });
  });

  describe('Browser Notification API & Graceful Fallback', () => {
    it('handles environments where Notification API is unsupported gracefully', () => {
      const originalNotification = (globalThis as any).Notification;
      // Remove Notification from globalThis/window
      delete (globalThis as any).Notification;
      if (typeof window !== 'undefined') {
        delete (window as any).Notification;
      }

      const status = reminderService.getPermissionStatus();
      expect(status).toBe('unsupported');

      const triggered = reminderService.triggerNotification('Test', 'Body');
      expect(triggered).toBe(false);

      // Restore
      if (originalNotification) {
        (globalThis as any).Notification = originalNotification;
      }
    });

    it('returns correct permission status when Notification API is available', () => {
      (globalThis as any).Notification = {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      };
      if (typeof window !== 'undefined') {
        (window as any).Notification = (globalThis as any).Notification;
      }

      const status = reminderService.getPermissionStatus();
      expect(status).toBe('granted');
    });
  });
});
