import { describe, it, expect, vi } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { supabase } from '@/lib/supabase';

describe('Phase G7: Operations Intelligence Security & Tenant Boundary Suite', () => {
  const GYM_ALPHA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  describe('1. Owner Authorization & Cross-Gym Isolation', () => {
    it('allows verified owner to access their own facility operations overview', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          facility: { gymId: GYM_ALPHA, gymName: 'Alpha Center', timezone: 'Asia/Kolkata', maxCapacity: 100 },
          live: { occupancy: 10, occupancyRate: 10, status: 'normal' },
          attendance: { todayCheckins: 25, todayCompletedVisits: 15, todayAvgDurationMinutes: 60, peakHoursDistribution: [] },
          members: { activeMembers30d: 50, streakMembersCount: 15, retentionHealthPercentage: 30, pendingMembershipsCount: 1 },
          engagement: { activeChallengesCount: 1, challengeParticipantsCount: 10, activeBuddyConnectionsCount: 5 },
          safety: { openSafetyIncidentsCount: 0, criticalSafetyIncidentsCount: 0, activeSafetyNoticesCount: 1 },
          moderation: { unresolvedFlagsCount: 0 },
        },
        error: null,
      } as any);

      const res = await gymRepository.getOwnerDashboardOverview(GYM_ALPHA);
      expect(res).not.toBeNull();
      expect(res?.facility.gymId).toBe(GYM_ALPHA);
    });

    it('rejects cross-gym access when Owner B queries Gym Alpha owned by Owner A', async () => {
      // Simulating Postgres 42501 'Access denied: not gym owner'
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: {
          message: 'Access denied: not gym owner',
          code: '42501',
          details: null,
          hint: null,
        },
      } as any);

      const res = await gymRepository.getOwnerDashboardOverview(GYM_ALPHA);
      expect(res).toBeNull();
    });

    it('rejects normal gym members attempting to invoke get_owner_dashboard_overview', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: {
          message: 'Access denied: not gym owner',
          code: '42501',
          details: null,
          hint: null,
        },
      } as any);

      const res = await gymRepository.getOwnerDashboardOverview(GYM_ALPHA);
      expect(res).toBeNull();
    });

    it('rejects unauthenticated callers with 42501 Not authenticated', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: {
          message: 'Not authenticated',
          code: '42501',
          details: null,
          hint: null,
        },
      } as any);

      const res = await gymRepository.getOwnerDashboardOverview(GYM_ALPHA);
      expect(res).toBeNull();
    });
  });

  describe('2. Client Identity Derivation Defense', () => {
    it('never accepts an owner_id argument from client input', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: null,
      } as any);

      await gymRepository.getOwnerDashboardOverview(GYM_ALPHA);

      // Verify arguments passed to supabase.rpc
      expect(rpcSpy).toHaveBeenCalledWith('get_owner_dashboard_overview', {
        p_gym_id: GYM_ALPHA,
      });

      // Ensure no p_owner_id or caller override can be injected
      const callArgs = rpcSpy.mock.calls[0][1] as Record<string, any>;
      expect(callArgs.p_owner_id).toBeUndefined();
      expect(callArgs.owner_id).toBeUndefined();
    });

    it('validates UUID format on gymId before invoking remote database RPC', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc');

      // Invalid malformed UUIDs
      const res1 = await gymRepository.getOwnerDashboardOverview('not-a-valid-uuid');
      const res2 = await gymRepository.getOwnerDashboardOverview("'; DROP TABLE gyms; --");

      expect(res1).toBeNull();
      expect(res2).toBeNull();
      expect(rpcSpy).not.toHaveBeenCalled();
    });
  });
});
