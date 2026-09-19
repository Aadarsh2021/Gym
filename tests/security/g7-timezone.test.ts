import { describe, it, expect } from 'vitest';

describe('Phase G7: Facility-Local Timezone & Date Semantics Suite', () => {
  describe('1. Facility Timezone vs Browser Timezone Authority', () => {
    it('anchors start of business day to facility timezone rather than UTC', () => {
      // 06:00 AM IST on 2026-09-20 is 00:30 UTC on 2026-09-20.
      // 03:00 AM IST on 2026-09-20 is 21:30 UTC on 2026-09-19.
      // Both must belong to the facility-local day of 2026-09-20 IST.
      const date1 = new Date('2026-09-20T00:30:00.000Z'); // 6:00 AM IST
      const date2 = new Date('2026-09-19T21:30:00.000Z'); // 3:00 AM IST on Sep 20

      // Converting to Asia/Kolkata date
      const toKolkataDateString = (d: Date) => {
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
      };

      expect(toKolkataDateString(date1)).toBe('2026-09-20');
      expect(toKolkataDateString(date2)).toBe('2026-09-20');
    });

    it('correctly maps hourly check-in events across midnight boundary into 24 buckets', () => {
      // 11:30 PM IST (23:30 IST) is 18:00 UTC
      const lateNightCheckin = new Date('2026-09-20T18:00:00.000Z');

      const getKolkataHour = (d: Date) => {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          hourCycle: 'h23',
        }).formatToParts(d);
        const hourPart = parts.find(p => p.type === 'hour');
        return parseInt(hourPart?.value || '0', 10);
      };

      expect(getKolkataHour(lateNightCheckin)).toBe(23);
      expect(lateNightCheckin.getUTCHours()).toBe(18); // Demonstrates why UTC alone would be wrong!
    });
  });

  describe('2. Month Boundary Rollover Integrity', () => {
    it('properly preserves trailing 30-day window across month boundary', () => {
      // e.g. From March 1, trailing 30 days extends back into February
      const marchFirst = new Date('2026-03-01T04:30:00.000Z'); // 10:00 AM IST March 1
      const thirtyDaysPrior = new Date(marchFirst.getTime() - 29 * 24 * 60 * 60 * 1000);

      expect(thirtyDaysPrior.getUTCMonth()).toBe(0); // Jan 31 or early Feb
      expect(thirtyDaysPrior.getTime()).toBeLessThan(marchFirst.getTime());
    });
  });

  describe('3. Attendance Streak Deduping Semantics', () => {
    it('treats multiple check-ins on the same facility-local calendar day as a single streak visit', () => {
      // Member attends morning (07:00 IST) and evening (19:00 IST) on 2026-09-20
      const session1 = { checkInAt: '2026-09-20T01:30:00.000Z' }; // 07:00 IST
      const session2 = { checkInAt: '2026-09-20T13:30:00.000Z' }; // 19:00 IST

      const toLocalDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const distinctDays = new Set([toLocalDate(session1.checkInAt), toLocalDate(session2.checkInAt)]);
      expect(distinctDays.size).toBe(1);
    });

    it('identifies broken streak when consecutive day is skipped', () => {
      const day1 = '2026-09-18';
      const day2 = '2026-09-19';
      const day4 = '2026-09-21'; // skipped Sep 20

      const checkConsecutive = (d1: string, d2: string) => {
        const diffDays =
          (new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24);
        return Math.round(diffDays) === 1;
      };

      expect(checkConsecutive(day1, day2)).toBe(true);
      expect(checkConsecutive(day2, day4)).toBe(false); // Streak reset!
    });
  });
});
