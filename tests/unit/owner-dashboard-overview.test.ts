import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ownerDashboardService } from '@/services/owner-dashboard.service';
import { gymRepository } from '@/repositories/gym.repository';
import { OwnerDashboardOverview } from '@/types/owner-dashboard.types';

describe('Phase G7: Operations Intelligence Dashboard — Unit Suite', () => {
  const GYM_ID = '11111111-1111-4111-8111-111111111111';

  const mockValidOverview: OwnerDashboardOverview = {
    facility: {
      gymId: GYM_ID,
      gymName: 'Titan Strength Club',
      timezone: 'Asia/Kolkata',
      maxCapacity: 100,
    },
    live: {
      occupancy: 45,
      occupancyRate: 45.0,
      status: 'normal',
    },
    attendance: {
      todayCheckins: 88,
      todayCompletedVisits: 43,
      todayAvgDurationMinutes: 62.5,
      peakHoursDistribution: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        checkins: hour === 7 ? 20 : hour === 18 ? 35 : 2,
      })),
    },
    members: {
      activeMembers30d: 150,
      streakMembersCount: 45,
      retentionHealthPercentage: 30.0,
      pendingMembershipsCount: 4,
    },
    engagement: {
      activeChallengesCount: 2,
      challengeParticipantsCount: 38,
      activeBuddyConnectionsCount: 12,
    },
    safety: {
      openSafetyIncidentsCount: 1,
      criticalSafetyIncidentsCount: 0,
      activeSafetyNoticesCount: 2,
    },
    moderation: {
      unresolvedFlagsCount: 3,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Occupancy & Capacity Calculations', () => {
    it('accurately normalizes occupancy and capacity', async () => {
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(mockValidOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result).not.toBeNull();
      expect(result?.live.occupancy).toBe(45);
      expect(result?.facility.maxCapacity).toBe(100);
      expect(result?.live.occupancyRate).toBe(45.0);
      expect(result?.live.status).toBe('normal');
    });

    it('sets status to crowded when occupancy rate >= 80%', async () => {
      const crowded = {
        ...mockValidOverview,
        live: { occupancy: 85, occupancyRate: 85.0, status: 'crowded' as const },
      };
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(crowded);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result?.live.status).toBe('crowded');
      expect(result?.live.occupancyRate).toBe(85.0);
    });

    it('sets status to at_capacity and clamps rate to 100% when occupancy exceeds max capacity', async () => {
      const atCapacity = {
        ...mockValidOverview,
        live: { occupancy: 120, occupancyRate: 120.0, status: 'at_capacity' as const },
      };
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(atCapacity);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result?.live.status).toBe('at_capacity');
      expect(result?.live.occupancyRate).toBe(100); // clamped to 100
    });
  });

  describe('2. Today Attendance & Visit Duration', () => {
    it('returns today checkins, completed visits, and duration', async () => {
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(mockValidOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result?.attendance.todayCheckins).toBe(88);
      expect(result?.attendance.todayCompletedVisits).toBe(43);
      expect(result?.attendance.todayAvgDurationMinutes).toBe(62.5);
    });
  });

  describe('3. Member Retention & Zero-Denominator Safety', () => {
    it('calculates retention health percentage correctly', async () => {
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(mockValidOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result?.members.activeMembers30d).toBe(150);
      expect(result?.members.streakMembersCount).toBe(45);
      expect(result?.members.retentionHealthPercentage).toBe(30.0);
    });

    it('safely handles zero active members without division by zero or NaN', async () => {
      const zeroMembers = {
        ...mockValidOverview,
        members: {
          activeMembers30d: 0,
          streakMembersCount: 0,
          retentionHealthPercentage: 0,
          pendingMembershipsCount: 0,
        },
      };
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(zeroMembers);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result?.members.activeMembers30d).toBe(0);
      expect(result?.members.retentionHealthPercentage).toBe(0);
      expect(Number.isNaN(result?.members.retentionHealthPercentage)).toBe(false);
      expect(Number.isFinite(result?.members.retentionHealthPercentage)).toBe(true);
    });
  });

  describe('4. Subsystem Intelligence & Moderation Counts', () => {
    it('surfaces pending memberships, flags, challenges, and buddy pairs', async () => {
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(mockValidOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result?.members.pendingMembershipsCount).toBe(4);
      expect(result?.moderation.unresolvedFlagsCount).toBe(3);
      expect(result?.engagement.activeChallengesCount).toBe(2);
      expect(result?.engagement.challengeParticipantsCount).toBe(38);
      expect(result?.engagement.activeBuddyConnectionsCount).toBe(12);
    });
  });

  describe('5. Safety & SPS Metrics', () => {
    it('surfaces open incidents, critical incidents, and active notices', async () => {
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(mockValidOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result?.safety.openSafetyIncidentsCount).toBe(1);
      expect(result?.safety.criticalSafetyIncidentsCount).toBe(0);
      expect(result?.safety.activeSafetyNoticesCount).toBe(2);
    });
  });

  describe('6. 24-Hour Peak Hours Distribution', () => {
    it('ensures exactly 24 hourly buckets exist from hour 0 to 23', async () => {
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(mockValidOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      const buckets = result?.attendance.peakHoursDistribution;
      expect(buckets).toHaveLength(24);
      expect(buckets?.[0].hour).toBe(0);
      expect(buckets?.[23].hour).toBe(23);
      expect(buckets?.[7].checkins).toBe(20);
      expect(buckets?.[18].checkins).toBe(35);
    });

    it('populates missing buckets with 0 check-ins when database returns sparse array', async () => {
      const sparseOverview = {
        ...mockValidOverview,
        attendance: {
          ...mockValidOverview.attendance,
          peakHoursDistribution: [
            { hour: 7, checkins: 15 },
            { hour: 19, checkins: 25 },
          ],
        },
      };
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(sparseOverview);

      const result = await ownerDashboardService.getOverview(GYM_ID);
      const buckets = result?.attendance.peakHoursDistribution;
      expect(buckets).toHaveLength(24);
      expect(buckets?.find(b => b.hour === 0)?.checkins).toBe(0);
      expect(buckets?.find(b => b.hour === 7)?.checkins).toBe(15);
      expect(buckets?.find(b => b.hour === 12)?.checkins).toBe(0);
      expect(buckets?.find(b => b.hour === 19)?.checkins).toBe(25);
    });
  });

  describe('7. Edge Cases & Null Handling', () => {
    it('returns null when gymId is empty', async () => {
      const result = await ownerDashboardService.getOverview('');
      expect(result).toBeNull();
    });

    it('returns null when repository fails', async () => {
      vi.spyOn(gymRepository, 'getOwnerDashboardOverview').mockResolvedValue(null);
      const result = await ownerDashboardService.getOverview(GYM_ID);
      expect(result).toBeNull();
    });
  });
});
