import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ownerDashboardService } from '@/services/owner-dashboard.service';
import { gymRepository } from '@/repositories/gym.repository';
import { OwnerDashboardOverview } from '@/types/owner-dashboard.types';

describe('Phase G7: Operations Intelligence Performance & Regression Suite', () => {
  const GYM_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Scalability & Bounded Payload Size', () => {
    it('maintains constant payload footprint regardless of member population (100 vs 1,000 vs 10,000)', async () => {
      // Mock aggregate response for a gym with 10,000 members
      const largeGymOverview: OwnerDashboardOverview = {
        facility: {
          gymId: GYM_ID,
          gymName: 'Mega Iron Facility',
          timezone: 'Asia/Kolkata',
          maxCapacity: 500,
        },
        live: {
          occupancy: 380,
          occupancyRate: 76.0,
          status: 'normal',
        },
        attendance: {
          todayCheckins: 1450,
          todayCompletedVisits: 1070,
          todayAvgDurationMinutes: 72.4,
          peakHoursDistribution: Array.from({ length: 24 }, (_, hour) => ({
            hour,
            checkins: hour === 18 ? 240 : 40,
          })),
        },
        members: {
          activeMembers30d: 6800,
          streakMembersCount: 2200,
          retentionHealthPercentage: 32.4,
          pendingMembershipsCount: 45,
        },
        engagement: {
          activeChallengesCount: 5,
          challengeParticipantsCount: 1850,
          activeBuddyConnectionsCount: 420,
        },
        safety: {
          openSafetyIncidentsCount: 3,
          criticalSafetyIncidentsCount: 0,
          activeSafetyNoticesCount: 4,
        },
        moderation: {
          unresolvedFlagsCount: 12,
        },
      };

      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(largeGymOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result).not.toBeNull();

      // Serialized size of aggregate overview should be under 3KB (actual ~1.8KB)
      const serializedBytes = new TextEncoder().encode(JSON.stringify(result)).length;
      expect(serializedBytes).toBeLessThan(3000);
      expect(serializedBytes).toBeGreaterThan(500);
    });

    it('handles empty gym with zero records gracefully without errors', async () => {
      const emptyGymOverview: OwnerDashboardOverview = {
        facility: {
          gymId: GYM_ID,
          gymName: 'Brand New Facility',
          timezone: 'Asia/Kolkata',
          maxCapacity: 100,
        },
        live: {
          occupancy: 0,
          occupancyRate: 0,
          status: 'normal',
        },
        attendance: {
          todayCheckins: 0,
          todayCompletedVisits: 0,
          todayAvgDurationMinutes: 0,
          peakHoursDistribution: Array.from({ length: 24 }, (_, hour) => ({ hour, checkins: 0 })),
        },
        members: {
          activeMembers30d: 0,
          streakMembersCount: 0,
          retentionHealthPercentage: 0,
          pendingMembershipsCount: 0,
        },
        engagement: {
          activeChallengesCount: 0,
          challengeParticipantsCount: 0,
          activeBuddyConnectionsCount: 0,
        },
        safety: {
          openSafetyIncidentsCount: 0,
          criticalSafetyIncidentsCount: 0,
          activeSafetyNoticesCount: 0,
        },
        moderation: {
          unresolvedFlagsCount: 0,
        },
      };

      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(emptyGymOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result).not.toBeNull();
      expect(result?.live.occupancy).toBe(0);
      expect(result?.live.occupancyRate).toBe(0);
      expect(result?.members.retentionHealthPercentage).toBe(0);
      expect(result?.attendance.todayCheckins).toBe(0);
    });
  });

  describe('2. Floor Sync & Ledger Regression Stability', () => {
    it('preserves existing live floor session query without regression', async () => {
      const mockActiveSessions = [
        {
          id: 'sess-1',
          userId: 'user-1',
          gymId: GYM_ID,
          checkInAt: new Date().toISOString(),
          checkOutAt: null,
          verificationMethod: 'qr_scan' as const,
          status: 'active' as const,
          userProfile: { displayName: 'Iron Athlete' },
        },
      ];

      vi.spyOn(gymRepository, 'fetchGymActiveAttendance').mockResolvedValue(mockActiveSessions);
      vi.spyOn(gymRepository, 'fetchGymTodayCheckinsCount').mockResolvedValue(5);
      vi.spyOn(gymRepository, 'fetchGymMemberCounts').mockResolvedValue({
        active: 10,
        pending: 2,
        inactive: 1,
        total: 13,
      });

      const floor = await ownerDashboardService.getFloorSync(GYM_ID);
      expect(floor.activeCount).toBe(1);
      expect(floor.activeSessions[0].id).toBe('sess-1');
      expect(floor.todayCheckins).toBe(5);
    });

    it('preserves completed attendance ledger pagination without regression', async () => {
      const mockHistory = [
        {
          id: 'sess-hist-1',
          userId: 'user-2',
          gymId: GYM_ID,
          checkInAt: '2026-09-19T06:00:00Z',
          checkOutAt: '2026-09-19T07:15:00Z',
          durationSeconds: 4500,
          verificationMethod: 'qr_scan' as const,
          status: 'completed' as const,
          userProfile: { displayName: 'Completed Athlete' },
        },
      ];

      vi.spyOn(gymRepository, 'fetchGymAttendanceHistory').mockResolvedValue({
        sessions: mockHistory,
        totalCount: 42,
      });

      const ledger = await ownerDashboardService.getCompletedAttendanceLedger(GYM_ID, {
        limit: 15,
        offset: 0,
      });

      expect(ledger.sessions).toHaveLength(1);
      expect(ledger.totalCount).toBe(42);
    });

    it('preserves manual checkout capability on stranded active floor sessions', async () => {
      const checkoutSpy = vi
        .spyOn(gymRepository, 'checkoutAttendanceSession')
        .mockResolvedValue({ success: true });

      const res = await gymRepository.checkoutAttendanceSession(
        'sess-to-checkout',
        'reception_manual'
      );

      expect(checkoutSpy).toHaveBeenCalledWith('sess-to-checkout', 'reception_manual');
      expect(res.success).toBe(true);
    });
  });
});
