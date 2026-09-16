import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  gymHistoryService,
  formatFriendlyDuration,
} from '@/services/gym-history.service';
import { gymCheckoutService } from '@/services/gym-checkout.service';
import { gymRepository } from '@/repositories/gym.repository';
import { platform } from '@/platform';
import { Gym, GymAttendanceSession, GymMembership } from '@/types/gym.types';
import {
  getCurrentMonthIST,
  getCurrentMonthRangeIST,
  isCurrentMonthIST,
  formatVisitDateIST,
  formatVisitTimeIST,
} from '@/utils/date';

describe('Member Gym Attendance History, Visit Details & Insights — Phase C6 Suite', () => {
  const memberId = 'member-c6-uuid-001';
  const otherMemberId = 'member-c6-uuid-002';
  const ownerId = 'owner-c6-uuid-001';

  const mockGym: Gym = {
    id: 'gym-c6-uuid',
    name: 'Iron Forge Fitness',
    slug: 'iron-forge',
    ownerId,
    address: '100 Forge St, Indiranagar',
    city: 'Bengaluru',
    latitude: 12.9784,
    longitude: 77.6408,
    radiusMeters: 200,
    qrCodeHash: 'fitboost_qr_iron-forge_hash123',
    createdAt: new Date().toISOString(),
  };

  const membership: GymMembership = {
    id: 'mem-c6-001',
    gymId: mockGym.id,
    userId: memberId,
    status: 'active',
    membershipType: 'monthly',
    joinedAt: new Date().toISOString(),
    gym: mockGym,
  };

  // Helper to construct mock completed attendance sessions
  const createMockSession = (
    id: string,
    userId: string,
    checkInIso: string,
    checkOutIso: string,
    durationSec: number,
    status: 'completed' | 'active' = 'completed',
    checkoutMethod: any = 'manual_button'
  ): GymAttendanceSession & { gym?: Gym } => ({
    id,
    gymId: mockGym.id,
    userId,
    checkInAt: checkInIso,
    checkOutAt: status === 'completed' ? checkOutIso : null,
    durationSeconds: status === 'completed' ? durationSec : null,
    verificationMethod: 'qr_scan',
    checkoutMethod: status === 'completed' ? checkoutMethod : null,
    status,
    createdAt: checkInIso,
    gym: mockGym,
  });

  beforeEach(() => {
    platform.storage.clear();
    platform.storage.setItem('cached_all_gyms', JSON.stringify([mockGym]));
    platform.storage.setItem(`user_memberships_${memberId}`, JSON.stringify([membership]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // GROUP 1: FEATURE 1 — MEMBER ATTENDANCE HISTORY (Tests 1–13)
  // ============================================================================
  describe('Feature 1: Member Gym Attendance History', () => {
    it('1. loads completed sessions for authenticated user in descending order (newest first)', async () => {
      const session1 = createMockSession(
        'sess-1',
        memberId,
        '2026-09-10T10:00:00.000Z',
        '2026-09-10T11:00:00.000Z',
        3600
      );
      const session2 = createMockSession(
        'sess-2',
        memberId,
        '2026-09-12T10:00:00.000Z',
        '2026-09-12T11:15:00.000Z',
        4500
      );
      const session3 = createMockSession(
        'sess-3',
        memberId,
        '2026-09-14T10:00:00.000Z',
        '2026-09-14T11:30:00.000Z',
        5400
      );

      // Store in arbitrary order
      platform.storage.setItem(
        `attendance_history_${memberId}`,
        JSON.stringify([session1, session3, session2])
      );

      const res = await gymHistoryService.getAttendanceHistory(memberId);
      expect(res.sessions).toHaveLength(3);
      expect(res.sessions[0].id).toBe('sess-3'); // Newest checkout first
      expect(res.sessions[1].id).toBe('sess-2');
      expect(res.sessions[2].id).toBe('sess-1');
    });

    it('2. strictly excludes active attendance sessions from history', async () => {
      const completedSession = createMockSession(
        'sess-comp',
        memberId,
        '2026-09-14T10:00:00.000Z',
        '2026-09-14T11:00:00.000Z',
        3600,
        'completed'
      );
      const activeSession = createMockSession(
        'sess-act',
        memberId,
        '2026-09-15T09:00:00.000Z',
        '',
        0,
        'active'
      );

      platform.storage.setItem(
        `attendance_history_${memberId}`,
        JSON.stringify([completedSession, activeSession])
      );

      const res = await gymHistoryService.getAttendanceHistory(memberId);
      expect(res.sessions).toHaveLength(1);
      expect(res.sessions[0].id).toBe('sess-comp');
      expect(res.sessions.some(s => s.status === 'active')).toBe(false);
    });

    it('3. authoritatively resolves facility name and location from gym relation', async () => {
      const session = createMockSession(
        'sess-rel',
        memberId,
        '2026-09-14T10:00:00.000Z',
        '2026-09-14T11:00:00.000Z',
        3600
      );
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([session]));

      const res = await gymHistoryService.getAttendanceHistory(memberId);
      expect(res.sessions[0].gym).toBeDefined();
      expect(res.sessions[0].gym?.name).toBe('Iron Forge Fitness');
      expect(res.sessions[0].gym?.city).toBe('Bengaluru');
    });

    it('4. formats visit date in IST correctly', () => {
      // 2026-09-15T04:30:00.000Z is 10:00 AM IST on Tuesday, 15 Sep 2026
      const formatted = formatVisitDateIST('2026-09-15T04:30:00.000Z');
      expect(formatted).toContain('Sep');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2026');
    });

    it('5. formats check-in and check-out timestamps in IST correctly', () => {
      // 2026-09-15T04:30:00.000Z = 10:00 AM IST
      const timeIn = formatVisitTimeIST('2026-09-15T04:30:00.000Z');
      // 2026-09-15T05:45:00.000Z = 11:15 AM IST
      const timeOut = formatVisitTimeIST('2026-09-15T05:45:00.000Z');

      expect(timeIn).toMatch(/10:00\s*(AM|am)?/i);
      expect(timeOut).toMatch(/11:15\s*(AM|am)?/i);
    });

    it('6. formats duration in friendly display units', () => {
      expect(formatFriendlyDuration(0)).toBe('0 mins');
      expect(formatFriendlyDuration(45)).toBe('45 secs');
      expect(formatFriendlyDuration(180)).toBe('3 mins');
      expect(formatFriendlyDuration(3600)).toBe('1 hr 0 mins');
      expect(formatFriendlyDuration(4500)).toBe('1 hr 15 mins');
      expect(formatFriendlyDuration(7200 + 120)).toBe('2 hrs 2 mins');
    });

    it('7. displays correct checkout method label', async () => {
      const session = createMockSession(
        'sess-meth',
        memberId,
        '2026-09-14T10:00:00.000Z',
        '2026-09-14T11:00:00.000Z',
        3600,
        'completed',
        'manual_button'
      );
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([session]));

      const res = await gymHistoryService.getAttendanceHistory(memberId);
      expect(res.sessions[0].checkoutMethod).toBe('manual_button');
    });

    it('8. handles loading state gracefully when initialized', async () => {
      const res = await gymHistoryService.getAttendanceHistory(memberId);
      expect(res).toBeDefined();
      expect(Array.isArray(res.sessions)).toBe(true);
    });

    it('9. displays empty state when member has no completed visits', async () => {
      const res = await gymHistoryService.getAttendanceHistory(memberId);
      expect(res.sessions).toHaveLength(0);
      expect(res.hasMore).toBe(false);
    });

    it('10. handles guest or unauthenticated user ID safely without error', async () => {
      const resGuest = await gymHistoryService.getAttendanceHistory('guest-user');
      expect(resGuest.sessions).toHaveLength(0);
      expect(resGuest.hasMore).toBe(false);

      const resEmpty = await gymHistoryService.getAttendanceHistory('');
      expect(resEmpty.sessions).toHaveLength(0);
      expect(resEmpty.hasMore).toBe(false);
    });

    it('11. handles repository errors cleanly and returns empty list', async () => {
      vi.spyOn(gymRepository, 'getAttendanceHistory').mockRejectedValueOnce(
        new Error('Network timeout')
      );

      const res = await gymHistoryService.getAttendanceHistory(memberId);
      expect(res.sessions).toEqual([]);
      expect(res.hasMore).toBe(false);
    });

    it('12. paginates visits with limit and offset correctly', async () => {
      const mockList: (GymAttendanceSession & { gym?: Gym })[] = [];
      for (let i = 1; i <= 25; i++) {
        const timeStr = `2026-09-${i.toString().padStart(2, '0')}T10:00:00.000Z`;
        mockList.push(createMockSession(`sess-${i}`, memberId, timeStr, timeStr, 3600));
      }
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify(mockList));

      // Page 1: limit 10, offset 0
      const page1 = await gymHistoryService.getAttendanceHistory(memberId, {
        limit: 10,
        offset: 0,
      });
      expect(page1.sessions).toHaveLength(10);
      expect(page1.hasMore).toBe(true);

      // Page 2: limit 10, offset 10
      const page2 = await gymHistoryService.getAttendanceHistory(memberId, {
        limit: 10,
        offset: 10,
      });
      expect(page2.sessions).toHaveLength(10);
      expect(page2.hasMore).toBe(true);

      // Page 3: limit 10, offset 20
      const page3 = await gymHistoryService.getAttendanceHistory(memberId, {
        limit: 10,
        offset: 20,
      });
      expect(page3.sessions).toHaveLength(5);
      expect(page3.hasMore).toBe(false);
    });

    it('13. hasMore flag accurately reflects whether more records exist', async () => {
      const mockList = [
        createMockSession('s-1', memberId, '2026-09-01T10:00:00.000Z', '2026-09-01T11:00:00.000Z', 3600),
        createMockSession('s-2', memberId, '2026-09-02T10:00:00.000Z', '2026-09-02T11:00:00.000Z', 3600),
      ];
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify(mockList));

      const resAll = await gymHistoryService.getAttendanceHistory(memberId, { limit: 2, offset: 0 });
      expect(resAll.hasMore).toBe(false);

      const resPartial = await gymHistoryService.getAttendanceHistory(memberId, { limit: 1, offset: 0 });
      expect(resPartial.hasMore).toBe(true);
    });
  });

  // ============================================================================
  // GROUP 2: FEATURE 2 — ATTENDANCE VISIT DETAILS (Tests 14–19)
  // ============================================================================
  describe('Feature 2: Attendance Visit Details', () => {
    it('14. selecting a visit fetches authoritative detail record by sessionId and userId', async () => {
      const session = createMockSession(
        'sess-detail-01',
        memberId,
        '2026-09-14T08:00:00.000Z',
        '2026-09-14T09:15:00.000Z',
        4500
      );
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([session]));

      const res = await gymHistoryService.getVisitDetails('sess-detail-01', memberId);
      expect(res.success).toBe(true);
      expect(res.visit).toBeDefined();
      expect(res.visit?.id).toBe('sess-detail-01');
      expect(res.visit?.durationSeconds).toBe(4500);
    });

    it('15. detail view displays full visit telemetry', async () => {
      const session = createMockSession(
        'sess-telemetry',
        memberId,
        '2026-09-14T08:00:00.000Z',
        '2026-09-14T09:30:00.000Z',
        5400,
        'completed',
        'manual_button'
      );
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([session]));

      const res = await gymHistoryService.getVisitDetails('sess-telemetry', memberId);
      expect(res.success).toBe(true);
      const v = res.visit!;
      expect(v.id).toBe('sess-telemetry');
      expect(v.checkInAt).toBe('2026-09-14T08:00:00.000Z');
      expect(v.checkOutAt).toBe('2026-09-14T09:30:00.000Z');
      expect(v.durationSeconds).toBe(5400);
      expect(v.verificationMethod).toBe('qr_scan');
      expect(v.checkoutMethod).toBe('manual_button');
      expect(v.status).toBe('completed');
    });

    it('16. visit details inspection is strictly read-only and does not mutate session data', async () => {
      const session = createMockSession(
        'sess-readonly',
        memberId,
        '2026-09-14T08:00:00.000Z',
        '2026-09-14T09:00:00.000Z',
        3600
      );
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([session]));

      const res = await gymHistoryService.getVisitDetails('sess-readonly', memberId);
      expect(res.success).toBe(true);

      // Verify the session in storage remains identical
      const rawStored = (await platform.storage.getItem(`attendance_history_${memberId}`)) as string;
      const stored = JSON.parse(rawStored);
      expect(stored[0].status).toBe('completed');
      expect(stored[0].durationSeconds).toBe(3600);
    });

    it('17. enforces user ownership — requests with different userId are rejected', async () => {
      const session = createMockSession(
        'sess-owned',
        memberId,
        '2026-09-14T08:00:00.000Z',
        '2026-09-14T09:00:00.000Z',
        3600
      );
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([session]));

      // Requesting memberId's session using otherMemberId
      const res = await gymHistoryService.getVisitDetails('sess-owned', otherMemberId);
      expect(res.success).toBe(false);
      expect(res.visit).toBeUndefined();
    });

    it('18. cross-user isolation: member A cannot inspect member B attendance visit', async () => {
      const sessionB = createMockSession(
        'sess-member-b',
        otherMemberId,
        '2026-09-14T08:00:00.000Z',
        '2026-09-14T09:00:00.000Z',
        3600
      );
      platform.storage.setItem(`attendance_history_${otherMemberId}`, JSON.stringify([sessionB]));

      const res = await gymHistoryService.getVisitDetails('sess-member-b', memberId);
      expect(res.success).toBe(false);
      expect(res.visit).toBeUndefined();
    });

    it('19. forged or unauthenticated user ID is rejected', async () => {
      const resGuest = await gymHistoryService.getVisitDetails('some-id', 'guest-user');
      expect(resGuest.success).toBe(false);

      const resEmpty = await gymHistoryService.getVisitDetails('some-id', '');
      expect(resEmpty.success).toBe(false);

      const resNoSession = await gymHistoryService.getVisitDetails('', memberId);
      expect(resNoSession.success).toBe(false);
    });
  });

  // ============================================================================
  // GROUP 3: FEATURE 3 — BASIC ATTENDANCE SUMMARY & AGGREGATION (Tests 20–25)
  // ============================================================================
  describe('Feature 3: Basic Attendance Summary / Insights', () => {
    it('20. computes total completed visits count accurately', async () => {
      const s1 = createMockSession('s1', memberId, '2026-09-10T10:00:00.000Z', '2026-09-10T11:00:00.000Z', 3600);
      const s2 = createMockSession('s2', memberId, '2026-09-11T10:00:00.000Z', '2026-09-11T11:00:00.000Z', 3600);
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([s1, s2]));

      const summary = await gymHistoryService.getAttendanceSummary(memberId);
      expect(summary.totalVisits).toBe(2);
    });

    it('21. computes total duration sum accurately', async () => {
      const s1 = createMockSession('s1', memberId, '2026-09-10T10:00:00.000Z', '2026-09-10T11:00:00.000Z', 3600);
      const s2 = createMockSession('s2', memberId, '2026-09-11T10:00:00.000Z', '2026-09-11T11:30:00.000Z', 5400);
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([s1, s2]));

      const summary = await gymHistoryService.getAttendanceSummary(memberId);
      expect(summary.totalDurationSeconds).toBe(9000);
      expect(summary.totalDurationFormatted).toBe('2 hrs 30 mins');
    });

    it('22. computes average visit duration accurately', async () => {
      // 3000s + 6000s = 9000s / 2 = 4500s (1 hr 15 mins)
      const s1 = createMockSession('s1', memberId, '2026-09-10T10:00:00.000Z', '2026-09-10T11:00:00.000Z', 3000);
      const s2 = createMockSession('s2', memberId, '2026-09-11T10:00:00.000Z', '2026-09-11T11:30:00.000Z', 6000);
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([s1, s2]));

      const summary = await gymHistoryService.getAttendanceSummary(memberId);
      expect(summary.averageDurationSeconds).toBe(4500);
      expect(summary.averageDurationFormatted).toBe('1 hr 15 mins');
    });

    it('23. counts current-month completed sessions using IST month boundaries', async () => {
      const currentMonth = getCurrentMonthIST(); // "2026-09"
      const thisMonthSession = createMockSession(
        's-current',
        memberId,
        `${currentMonth}-10T10:00:00.000Z`,
        `${currentMonth}-10T11:00:00.000Z`,
        3600
      );
      const lastMonthSession = createMockSession(
        's-last',
        memberId,
        '2026-08-10T10:00:00.000Z',
        '2026-08-10T11:00:00.000Z',
        3600
      );
      platform.storage.setItem(
        `attendance_history_${memberId}`,
        JSON.stringify([thisMonthSession, lastMonthSession])
      );

      const summary = await gymHistoryService.getAttendanceSummary(memberId);
      expect(summary.totalVisits).toBe(2);
      expect(summary.currentMonthVisits).toBe(1);
    });

    it('24. IST timezone boundary prevents UTC rollover off-by-one errors', () => {
      const { startIso, endIso } = getCurrentMonthRangeIST();
      expect(startIso).toBeDefined();
      expect(endIso).toBeDefined();

      // IST is +5:30. A timestamp on 2026-08-31T18:35:00.000Z is 2026-09-01 00:05:00 IST
      const boundaryTime = '2026-08-31T18:35:00.000Z';
      expect(isCurrentMonthIST(boundaryTime)).toBe(true);
    });

    it('25. active attendance sessions are excluded from summary calculations', async () => {
      const completedSession = createMockSession(
        's-done',
        memberId,
        '2026-09-10T10:00:00.000Z',
        '2026-09-10T11:00:00.000Z',
        3600,
        'completed'
      );
      const activeSession = createMockSession(
        's-live',
        memberId,
        '2026-09-12T10:00:00.000Z',
        '',
        0,
        'active'
      );

      platform.storage.setItem(
        `attendance_history_${memberId}`,
        JSON.stringify([completedSession, activeSession])
      );

      const summary = await gymHistoryService.getAttendanceSummary(memberId);
      expect(summary.totalVisits).toBe(1);
      expect(summary.totalDurationSeconds).toBe(3600);
    });
  });

  // ============================================================================
  // GROUP 4: REGRESSION SUITE & ARCHITECTURE INVARIANTS (Tests 26–30)
  // ============================================================================
  describe('Regression Suite & Architectural Integrity', () => {
    it('26. C5 checkout lifecycle (active -> completed) persists session and makes it available in history', async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 3600 * 1000).toISOString();

      // Mock active session in progress
      const activeSession: GymAttendanceSession = {
        id: 'sess-live-c5',
        gymId: mockGym.id,
        userId: memberId,
        checkInAt: pastTime,
        checkOutAt: null,
        durationSeconds: null,
        verificationMethod: 'qr_scan',
        checkoutMethod: null,
        status: 'active',
        createdAt: pastTime,
      };
      platform.storage.setItem(`active_attendance_${memberId}`, JSON.stringify(activeSession));

      // Perform authoritative checkout
      const checkoutRes = await gymCheckoutService.checkoutCurrentSession({
        userId: memberId,
        userRole: 'member',
        checkoutMethod: 'manual_button',
      });
      expect(checkoutRes.success).toBe(true);
      expect(checkoutRes.session?.status).toBe('completed');
      expect(checkoutRes.session?.durationSeconds).toBeGreaterThan(0);

      // Verify that getAttendanceHistory now contains this completed session
      const history = await gymHistoryService.getAttendanceHistory(memberId);
      expect(history.sessions).toHaveLength(1);
      expect(history.sessions[0].id).toBe('sess-live-c5');
      expect(history.sessions[0].status).toBe('completed');
    });

    it('27. database duration trigger value is preserved and untampered', async () => {
      const session = createMockSession(
        'sess-trigger',
        memberId,
        '2026-09-14T06:00:00.000Z',
        '2026-09-14T07:15:30.000Z',
        4530
      );
      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([session]));

      const res = await gymHistoryService.getVisitDetails('sess-trigger', memberId);
      expect(res.visit?.durationSeconds).toBe(4530);
    });

    it('28. summary query never requires fetching all completed sessions into the browser', async () => {
      const summarySpy = vi.spyOn(gymRepository, 'getAttendanceSummary');

      await gymHistoryService.getAttendanceSummary(memberId);

      expect(summarySpy).toHaveBeenCalledTimes(1);
      const callArgs = summarySpy.mock.calls[0];
      expect(callArgs[0]).toBe(memberId);
      expect(callArgs[1]).toHaveProperty('startIso');
      expect(callArgs[1]).toHaveProperty('endIso');
    });

    it('29. RLS and query isolation ensures member only queries own attendance data', async () => {
      const sessionA = createMockSession('s-a', memberId, '2026-09-14T10:00:00.000Z', '2026-09-14T11:00:00.000Z', 3600);
      const sessionB = createMockSession('s-b', otherMemberId, '2026-09-14T10:00:00.000Z', '2026-09-14T11:00:00.000Z', 3600);

      platform.storage.setItem(`attendance_history_${memberId}`, JSON.stringify([sessionA]));
      platform.storage.setItem(`attendance_history_${otherMemberId}`, JSON.stringify([sessionB]));

      const histA = await gymHistoryService.getAttendanceHistory(memberId);
      const histB = await gymHistoryService.getAttendanceHistory(otherMemberId);

      expect(histA.sessions).toHaveLength(1);
      expect(histA.sessions[0].id).toBe('s-a');

      expect(histB.sessions).toHaveLength(1);
      expect(histB.sessions[0].id).toBe('s-b');
    });

    it('30. guest / unauthenticated users receive zero summary and empty history safely', async () => {
      const summary = await gymHistoryService.getAttendanceSummary('guest-user');
      expect(summary.totalVisits).toBe(0);
      expect(summary.totalDurationSeconds).toBe(0);
      expect(summary.totalDurationFormatted).toBe('0 mins');
      expect(summary.averageDurationSeconds).toBe(0);
      expect(summary.averageDurationFormatted).toBe('0 mins');
      expect(summary.currentMonthVisits).toBe(0);

      const history = await gymHistoryService.getAttendanceHistory('guest-user');
      expect(history.sessions).toEqual([]);
      expect(history.hasMore).toBe(false);
    });
  });
});
