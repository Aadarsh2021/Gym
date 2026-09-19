import { describe, it, expect, vi } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { supabase } from '@/lib/supabase';

describe('Phase G7: Operations Intelligence Privacy Firewall & Whistleblower Defense', () => {
  const GYM_ID = '11111111-1111-4111-8111-111111111111';
  const ANONYMOUS_REPORTER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ACCUSED_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const EMERGENCY_PHONE = '+91 98765 43210';
  const MEDICAL_NOTE = 'Severe asthma, requires inhaler in gym bag';
  const CHAT_MESSAGE_TEXT = 'Hey, want to train chest together at 6pm?';

  const mockOverviewPayload = {
    facility: {
      gymId: GYM_ID,
      gymName: 'Titan Strength Club',
      timezone: 'Asia/Kolkata',
      maxCapacity: 100,
    },
    live: {
      occupancy: 20,
      occupancyRate: 20.0,
      status: 'normal',
    },
    attendance: {
      todayCheckins: 50,
      todayCompletedVisits: 30,
      todayAvgDurationMinutes: 60.0,
      peakHoursDistribution: [],
    },
    members: {
      activeMembers30d: 100,
      streakMembersCount: 25,
      retentionHealthPercentage: 25.0,
      pendingMembershipsCount: 2,
    },
    engagement: {
      activeChallengesCount: 1,
      challengeParticipantsCount: 20,
      activeBuddyConnectionsCount: 8,
    },
    safety: {
      openSafetyIncidentsCount: 2,
      criticalSafetyIncidentsCount: 1,
      activeSafetyNoticesCount: 1,
    },
    moderation: {
      unresolvedFlagsCount: 0,
    },
  };

  describe('1. G6 Whistleblower & Incident Anonymity Firewall', () => {
    it('ensures dashboard payload contains ONLY numerical safety incident aggregates', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockOverviewPayload,
        error: null,
      } as any);

      const overview = await gymRepository.getOwnerDashboardOverview(GYM_ID);
      expect(overview).not.toBeNull();

      const serialized = JSON.stringify(overview);

      // Verify no reporter UUID or name can be detected in the payload
      expect(serialized).not.toContain(ANONYMOUS_REPORTER_ID);
      expect(serialized).not.toContain(ACCUSED_ID);
      expect(serialized).not.toContain('Anonymous Member');
      expect(serialized).not.toContain('reporter_id');
      expect(serialized).not.toContain('reporterId');
      expect(serialized).not.toContain('incident_description');
      expect(serialized).not.toContain('incidentDescription');
    });

    it('ensures individual safety incident descriptions never appear in overview response', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockOverviewPayload,
        error: null,
      } as any);

      const overview = await gymRepository.getOwnerDashboardOverview(GYM_ID);
      expect(overview?.safety).toEqual({
        openSafetyIncidentsCount: 2,
        criticalSafetyIncidentsCount: 1,
        activeSafetyNoticesCount: 1,
      });

      // Keys must strictly match aggregate count contract
      const safetyKeys = Object.keys(overview?.safety || {});
      expect(safetyKeys).toEqual([
        'openSafetyIncidentsCount',
        'criticalSafetyIncidentsCount',
        'activeSafetyNoticesCount',
      ]);
    });
  });

  describe('2. Emergency Contact & Medical Data Firewall', () => {
    it('ensures emergency contact phone numbers and medical notes are never aggregated into dashboard', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockOverviewPayload,
        error: null,
      } as any);

      const overview = await gymRepository.getOwnerDashboardOverview(GYM_ID);
      const serialized = JSON.stringify(overview);

      expect(serialized).not.toContain(EMERGENCY_PHONE);
      expect(serialized).not.toContain(MEDICAL_NOTE);
      expect(serialized).not.toContain('medical');
      expect(serialized).not.toContain('emergency_contact');
      expect(serialized).not.toContain('emergencyContact');
    });
  });

  describe('3. G4 Peer Chat Air-Gap', () => {
    it('ensures private peer chat message content and DM participants are completely air-gapped', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockOverviewPayload,
        error: null,
      } as any);

      const overview = await gymRepository.getOwnerDashboardOverview(GYM_ID);
      const serialized = JSON.stringify(overview);

      expect(serialized).not.toContain(CHAT_MESSAGE_TEXT);
      expect(serialized).not.toContain('chat');
      expect(serialized).not.toContain('messages');
      expect(serialized).not.toContain('sentiment');
    });
  });

  describe('4. G3 Sensitive Buddy Preferences Air-Gap', () => {
    it('only exposes accepted buddy connection count, not individual preferences or blocks', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockOverviewPayload,
        error: null,
      } as any);

      const overview = await gymRepository.getOwnerDashboardOverview(GYM_ID);
      expect(overview?.engagement.activeBuddyConnectionsCount).toBe(8);

      const serialized = JSON.stringify(overview);
      expect(serialized).not.toContain('block');
      expect(serialized).not.toContain('decline');
      expect(serialized).not.toContain('swipe');
      expect(serialized).not.toContain('preference');
    });
  });
});
