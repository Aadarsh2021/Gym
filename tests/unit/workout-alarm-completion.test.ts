import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reminderService, WorkoutReminderPreference } from '@/services/reminder.service';
import { platform } from '@/platform';

describe('Workout Alarm Completion — Unit Tests', () => {
  const dummyPref: WorkoutReminderPreference = {
    userId: 'user-alarm-test-1',
    enabled: true,
    time: '07:30',
    days: [1, 2, 3, 4, 5], // Mon-Fri
    title: 'Morning Workout Call',
    message: 'Time to crush your morning session!',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    reminderService.clearScheduledTimers();
  });

  afterEach(() => {
    reminderService.clearScheduledTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. calculates next reminder milliseconds when scheduled time is later today', () => {
    // 2026-09-21 is a Monday (ISO day 1)
    const now = new Date('2026-09-21T06:00:00.000Z');
    const localNow = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0);

    const ms = reminderService.getMillisecondsUntilNextReminder('07:30', [1, 2, 3, 4, 5], localNow);
    expect(ms).toBe(90 * 60 * 1000); // 1.5 hours = 5400000 ms
  });

  it('2. advances to next scheduled weekday when target time today has already passed', () => {
    // Monday 08:00 -> Next reminder Tuesday 07:30 (23.5 hours later)
    const now = new Date(2026, 8, 21, 8, 0, 0); // Monday Sep 21
    const ms = reminderService.getMillisecondsUntilNextReminder('07:30', [1, 2, 3, 4, 5], now);
    expect(ms).toBe(23.5 * 60 * 60 * 1000);
  });

  it('3. skips unscheduled days (e.g. weekend rollover from Friday afternoon to Monday morning)', () => {
    // Friday Sep 25 at 09:00 -> Next is Monday Sep 28 at 07:30 (Fri 15h + Sat 24h + Sun 24h + Mon 7.5h = 70.5h)
    const now = new Date(2026, 8, 25, 9, 0, 0); // Friday
    const ms = reminderService.getMillisecondsUntilNextReminder('07:30', [1, 2, 3, 4, 5], now);
    expect(ms).toBe(70.5 * 60 * 60 * 1000);
  });

  it('4. handles Sunday to Monday boundary correctly', () => {
    // Sunday Sep 20 at 12:00 -> Next is Monday Sep 21 at 07:30 (12h + 7.5h = 19.5h)
    const now = new Date(2026, 8, 20, 12, 0, 0); // Sunday
    const ms = reminderService.getMillisecondsUntilNextReminder('07:30', [1, 2, 3, 4, 5], now);
    expect(ms).toBe(19.5 * 60 * 60 * 1000);
  });

  it('5. returns null when scheduled days array is empty', () => {
    const ms = reminderService.getMillisecondsUntilNextReminder('07:30', []);
    expect(ms).toBeNull();
  });

  it('6. returns null for malformed time strings', () => {
    expect(reminderService.getMillisecondsUntilNextReminder('invalid', [1])).toBeNull();
    expect(reminderService.getMillisecondsUntilNextReminder('', [1])).toBeNull();
  });

  it('7. formats coarse time remaining (hours and minutes)', () => {
    expect(reminderService.formatTimeRemaining(null)).toBe('Not scheduled');
    expect(reminderService.formatTimeRemaining(0)).toBe('Due now');
    expect(reminderService.formatTimeRemaining(-100)).toBe('Due now');
    expect(reminderService.formatTimeRemaining(3600 * 1000 * 2 + 15 * 60 * 1000)).toBe('2h 15m');
    expect(reminderService.formatTimeRemaining(45 * 60 * 1000)).toBe('45m');
    expect(reminderService.formatTimeRemaining(30 * 1000)).toBe('under a minute');
  });

  it('8. provides detailed second-by-second countdown breakdown', () => {
    const totalMs = 2 * 86400 * 1000 + 3 * 3600 * 1000 + 45 * 60 * 1000 + 12 * 1000;
    const detailed = reminderService.getDetailedCountdown(totalMs);

    expect(detailed.days).toBe(2);
    expect(detailed.hours).toBe(3);
    expect(detailed.minutes).toBe(45);
    expect(detailed.seconds).toBe(12);
    expect(detailed.formatted).toBe('2d 03:45:12');
  });

  it('9. handles single-day detailed countdown formatting without day prefix', () => {
    const totalMs = 5 * 3600 * 1000 + 8 * 60 * 1000 + 30 * 1000;
    const detailed = reminderService.getDetailedCountdown(totalMs);

    expect(detailed.days).toBe(0);
    expect(detailed.hours).toBe(5);
    expect(detailed.minutes).toBe(8);
    expect(detailed.seconds).toBe(30);
    expect(detailed.formatted).toBe('05:08:30');
  });

  it('10. detailed countdown reports Due now when 0 or negative ms provided', () => {
    const detailed = reminderService.getDetailedCountdown(0);
    expect(detailed.formatted).toBe('Due now');
    expect(detailed.totalSeconds).toBe(0);

    const nullDetailed = reminderService.getDetailedCountdown(null);
    expect(nullDetailed.formatted).toBe('Not scheduled');
  });

  it('11. snoozes reminder by 10 minutes and calculates snoozedUntil timestamp', () => {
    const baseTime = new Date('2026-09-21T10:00:00.000Z').getTime();
    vi.setSystemTime(baseTime);

    const res = reminderService.snooze(dummyPref, 10);
    const expectedTime = new Date(baseTime + 10 * 60 * 1000).toISOString();
    expect(res.snoozedUntil).toBe(expectedTime);
  });

  it('12. snooze clears prior active snooze timer to prevent duplicate alerts', () => {
    const triggerSpy = vi.fn();
    reminderService.snooze(dummyPref, 10, triggerSpy);
    // Re-snooze for 5 minutes
    reminderService.snooze(dummyPref, 5, triggerSpy);

    // Fast-forward 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(triggerSpy).toHaveBeenCalledTimes(1);

    // Fast-forward another 5 minutes (old 10-minute timer should NOT fire again)
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it('13. plays platform audio chime upon trigger notification', () => {
    const audioSpy = vi.spyOn(platform.audio, 'playRestTimerChime').mockImplementation(() => {});
    const notifSpy = vi.spyOn(platform.notifications, 'getPermissionStatus').mockReturnValue('granted');
    const dispatchSpy = vi.spyOn(platform.notifications, 'dispatchImmediate').mockReturnValue(true as any);

    const sent = reminderService.triggerNotification('Workout Time', 'Ready to lift!');
    expect(audioSpy).toHaveBeenCalled();
    expect(notifSpy).toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalledWith({ title: 'Workout Time', body: 'Ready to lift!' });
    expect(sent).toBe(true);
  });

  it('14. handles audio playback error gracefully without crashing notification flow', () => {
    vi.spyOn(platform.audio, 'playRestTimerChime').mockImplementation(() => {
      throw new Error('Autoplay prevented without gesture');
    });
    vi.spyOn(platform.notifications, 'getPermissionStatus').mockReturnValue('granted');
    const dispatchSpy = vi.spyOn(platform.notifications, 'dispatchImmediate').mockReturnValue(true as any);

    expect(() => reminderService.triggerNotification('Test', 'Body')).not.toThrow();
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('15. does not dispatch system notification when permission is not granted', () => {
    vi.spyOn(platform.notifications, 'getPermissionStatus').mockReturnValue('denied');
    const dispatchSpy = vi.spyOn(platform.notifications, 'dispatchImmediate');

    const sent = reminderService.triggerNotification('Test', 'Body');
    expect(sent).toBe(false);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('16. rescheduleSameSessionTimer does nothing if alarm is disabled', () => {
    const triggerSpy = vi.fn();
    reminderService.rescheduleSameSessionTimer({ ...dummyPref, enabled: false }, triggerSpy);
    vi.advanceTimersByTime(100 * 3600 * 1000);
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('17. clearScheduledTimers neutralizes active timers immediately', () => {
    const triggerSpy = vi.fn();
    reminderService.snooze(dummyPref, 10, triggerSpy);
    reminderService.clearScheduledTimers();

    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(triggerSpy).not.toHaveBeenCalled();
  });
});
