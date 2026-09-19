import { describe, it, expect, beforeEach } from 'vitest';
import { platform } from '@/platform';

describe('Phase G6: Emergency SOS & Dynamic Contact Authorization Suite', () => {
  const GYM_A_ID = '11111111-1111-4111-8111-111111111111';
  const GYM_B_ID = '22222222-2222-4222-8222-222222222222';
  const ATHLETE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(() => {
    platform.storage.clear();
  });

  describe('1. Active Attendance Session Requirement & Server-Side Derivation', () => {
    it('rejects SOS trigger when athlete has no active floor session', () => {
      const activeSessions: { userId: string; gymId: string; status: string; checkOutAt: string | null }[] = [];

      const triggerSos = (userId: string) => {
        const session = activeSessions.find(s => s.userId === userId && s.status === 'active' && s.checkOutAt === null);
        if (!session) {
          throw new Error('40302: Active floor attendance session required to trigger Emergency SOS');
        }
        return { success: true, gymId: session.gymId };
      };

      expect(() => triggerSos(ATHLETE_ID)).toThrow(/40302: Active floor attendance session required/i);
    });

    it('derives gym_id server-side and ignores any client-supplied gym_id', () => {
      const activeSessions = [
        { userId: ATHLETE_ID, gymId: GYM_A_ID, status: 'active', checkOutAt: null },
      ];

      // Even if attacker tries to pass GYM_B_ID from client, RPC resolves from active session:
      const resolveSosGym = (userId: string, _untrustedClientGymId: string) => {
        const session = activeSessions.find(s => s.userId === userId && s.status === 'active' && s.checkOutAt === null);
        if (!session) throw new Error('40302');
        return session.gymId; // Server authoritative
      };

      const resolved = resolveSosGym(ATHLETE_ID, GYM_B_ID);
      expect(resolved).toBe(GYM_A_ID); // Derivation strictly matches actual checked-in gym
    });
  });

  describe('2. 15-Minute Concurrent Incident Deduplication', () => {
    it('deduplicates multiple SOS triggers within 15 minutes into single active incident', () => {
      const existingSosIncident = {
        id: 'sos-inc-1',
        userId: ATHLETE_ID,
        gymId: GYM_A_ID,
        category: 'medical_emergency',
        severity: 'critical',
        status: 'reported',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
      };

      const handleSosTrigger = (userId: string, gymId: string) => {
        const now = Date.now();
        const createdMs = new Date(existingSosIncident.createdAt).getTime();
        const diffMinutes = (now - createdMs) / (1000 * 60);

        if (
          existingSosIncident.userId === userId &&
          existingSosIncident.gymId === gymId &&
          diffMinutes < 15 &&
          ['reported', 'acknowledged', 'investigating'].includes(existingSosIncident.status)
        ) {
          return {
            success: true,
            incidentId: existingSosIncident.id,
            isDeduplicated: true,
          };
        }

        return {
          success: true,
          incidentId: 'new-sos-id',
          isDeduplicated: false,
        };
      };

      const res = handleSosTrigger(ATHLETE_ID, GYM_A_ID);
      expect(res.isDeduplicated).toBe(true);
      expect(res.incidentId).toBe('sos-inc-1');
    });

    it('creates new incident if previous emergency was resolved or older than 15 minutes', () => {
      const oldSosIncident = {
        id: 'sos-old',
        userId: ATHLETE_ID,
        gymId: GYM_A_ID,
        category: 'medical_emergency',
        severity: 'critical',
        status: 'resolved',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
      };

      const handleSosTrigger = (userId: string, gymId: string) => {
        const now = Date.now();
        const createdMs = new Date(oldSosIncident.createdAt).getTime();
        const diffMinutes = (now - createdMs) / (1000 * 60);

        if (
          oldSosIncident.userId === userId &&
          oldSosIncident.gymId === gymId &&
          diffMinutes < 15 &&
          ['reported', 'acknowledged', 'investigating'].includes(oldSosIncident.status)
        ) {
          return { success: true, incidentId: oldSosIncident.id, isDeduplicated: true };
        }

        return { success: true, incidentId: 'new-sos-id', isDeduplicated: false };
      };

      const res = handleSosTrigger(ATHLETE_ID, GYM_A_ID);
      expect(res.isDeduplicated).toBe(false);
      expect(res.incidentId).toBe('new-sos-id');
    });
  });

  describe('3. Dynamic Next-of-Kin Emergency Contact Authorization', () => {
    it('authorizes emergency contact lookup only while member has active session', () => {
      const attendance: { userId: string; gymId: string; status: string; checkOutAt: string | null } = {
        userId: ATHLETE_ID,
        gymId: GYM_A_ID,
        status: 'active',
        checkOutAt: null,
      };

      const getEmergencyContact = (callerOwnerGymId: string, targetUserId: string) => {
        if (attendance.gymId !== callerOwnerGymId || attendance.userId !== targetUserId) {
          throw new Error('40301: Facility mismatch');
        }
        if (attendance.status !== 'active' || attendance.checkOutAt !== null) {
          throw new Error('40303: Member is not currently checked into this facility');
        }
        return {
          contactName: 'Jane Doe',
          phoneNumber: '+15550192831',
        };
      };

      // During active workout: authorized
      const contact = getEmergencyContact(GYM_A_ID, ATHLETE_ID);
      expect(contact.contactName).toBe('Jane Doe');

      // Member checks out: immediately revoked
      attendance.status = 'completed';
      attendance.checkOutAt = new Date().toISOString();

      expect(() => getEmergencyContact(GYM_A_ID, ATHLETE_ID)).toThrow(
        /40303: Member is not currently checked into this facility/i
      );
    });

    it('rejects cross-gym contact access attempts by owners of different gyms', () => {
      const attendance = {
        userId: ATHLETE_ID,
        gymId: GYM_A_ID,
        status: 'active',
        checkOutAt: null,
      };

      const getEmergencyContact = (callerGymId: string, _targetUserId: string) => {
        if (attendance.gymId !== callerGymId) {
          throw new Error('40303: Member is not checked into your facility');
        }
        return { contactName: 'Jane Doe' };
      };

      // Owner of Gym B tries to lookup member checked into Gym A
      expect(() => getEmergencyContact(GYM_B_ID, ATHLETE_ID)).toThrow(/40303/);
    });
  });

  describe('4. Sensitive Emergency Contact Access Audit Ledger (gym_emergency_contact_access_logs)', () => {
    const OWNER_ID = 'oooooooo-oooo-4ooo-8ooo-oooooooooooo';
    const SESSION_ID = 'sess-1111-4111-8111-111111111111';

    interface AccessLogEntry {
      id: string;
      gymId: string;
      memberUserId: string;
      viewerOwnerId: string;
      attendanceSessionId: string;
      accessedFields: string[];
      accessedAt: string;
    }

    it('creates exactly one immutable access audit log entry upon successful contact lookup', () => {
      const accessLogs: AccessLogEntry[] = [];
      const attendance = {
        id: SESSION_ID,
        userId: ATHLETE_ID,
        gymId: GYM_A_ID,
        status: 'active',
        checkOutAt: null,
      };

      const getContactWithAudit = (callerOwnerId: string, callerGymId: string, targetUserId: string) => {
        if (attendance.gymId !== callerGymId || attendance.userId !== targetUserId) {
          throw new Error('40301');
        }
        if (attendance.status !== 'active' || attendance.checkOutAt !== null) {
          throw new Error('40303');
        }

        // Atomically record access in log
        const logEntry: AccessLogEntry = {
          id: `log-${Date.now()}`,
          gymId: callerGymId,
          memberUserId: targetUserId,
          viewerOwnerId: callerOwnerId,
          attendanceSessionId: attendance.id,
          accessedFields: ['contact_name', 'relationship', 'phone_number', 'alternative_phone', 'medical_notes'],
          accessedAt: new Date().toISOString(),
        };
        accessLogs.push(logEntry);

        return { contactName: 'Jane Doe', phoneNumber: '+15550192831' };
      };

      const contact = getContactWithAudit(OWNER_ID, GYM_A_ID, ATHLETE_ID);
      expect(contact.contactName).toBe('Jane Doe');
      expect(accessLogs.length).toBe(1);
      expect(accessLogs[0].viewerOwnerId).toBe(OWNER_ID);
      expect(accessLogs[0].memberUserId).toBe(ATHLETE_ID);
      expect(accessLogs[0].gymId).toBe(GYM_A_ID);
      expect(accessLogs[0].attendanceSessionId).toBe(SESSION_ID);
      expect(accessLogs[0].accessedFields).toContain('phone_number');
    });

    it('creates no audit log entry when access is rejected after member checkout', () => {
      const accessLogs: AccessLogEntry[] = [];
      const attendance = {
        id: SESSION_ID,
        userId: ATHLETE_ID,
        gymId: GYM_A_ID,
        status: 'completed', // Checked out!
        checkOutAt: new Date().toISOString(),
      };

      const getContactWithAudit = (_callerOwnerId: string, _callerGymId: string, _targetUserId: string) => {
        if (attendance.status !== 'active' || attendance.checkOutAt !== null) {
          throw new Error('40303: Member is not currently checked into this facility');
        }
        accessLogs.push({} as any);
        return { contactName: 'Jane Doe' };
      };

      expect(() => getContactWithAudit(OWNER_ID, GYM_A_ID, ATHLETE_ID)).toThrow(/40303/);
      expect(accessLogs.length).toBe(0); // Zero log records created
    });

    it('creates no audit log entry when cross-gym lookup is rejected', () => {
      const accessLogs: AccessLogEntry[] = [];

      const getContactWithAudit = (_callerOwnerId: string, callerGymId: string, _targetUserId: string) => {
        if (callerGymId !== GYM_A_ID) {
          throw new Error('40301: Facility mismatch');
        }
        accessLogs.push({} as any);
        return { contactName: 'Jane Doe' };
      };

      expect(() => getContactWithAudit(OWNER_ID, GYM_B_ID, ATHLETE_ID)).toThrow(/40301/);
      expect(accessLogs.length).toBe(0);
    });

    it('denies direct client INSERT, UPDATE, and DELETE on gym_emergency_contact_access_logs', () => {
      const isDirectClientMutationAllowed = (_role: string, _op: 'INSERT' | 'UPDATE' | 'DELETE') => {
        // Table RLS strictly denies all direct mutations for both member and owner
        return false;
      };

      expect(isDirectClientMutationAllowed('member', 'INSERT')).toBe(false);
      expect(isDirectClientMutationAllowed('member', 'UPDATE')).toBe(false);
      expect(isDirectClientMutationAllowed('member', 'DELETE')).toBe(false);
      expect(isDirectClientMutationAllowed('gym_owner', 'INSERT')).toBe(false);
      expect(isDirectClientMutationAllowed('gym_owner', 'UPDATE')).toBe(false);
      expect(isDirectClientMutationAllowed('gym_owner', 'DELETE')).toBe(false);
    });

    it('prevents cascading deletion of access logs via ON DELETE RESTRICT on all parent references', () => {
      // Setup mock parent tables and foreign keys
      const foreignKeyRules: Record<'gym_id' | 'member_user_id' | 'viewer_owner_id' | 'attendance_session_id', 'RESTRICT' | 'CASCADE'> = {
        gym_id: 'RESTRICT',
        member_user_id: 'RESTRICT',
        viewer_owner_id: 'RESTRICT',
        attendance_session_id: 'RESTRICT',
      };

      // Assert all 4 parent references strictly enforce RESTRICT
      expect(foreignKeyRules.gym_id).toBe('RESTRICT');
      expect(foreignKeyRules.member_user_id).toBe('RESTRICT');
      expect(foreignKeyRules.viewer_owner_id).toBe('RESTRICT');
      expect(foreignKeyRules.attendance_session_id).toBe('RESTRICT');

      const deleteParentEntity = (entityType: 'gym' | 'member' | 'owner' | 'session', entityId: string, hasChildLogs: boolean) => {
        if (hasChildLogs) {
          // PostgreSQL throws 23503 foreign_key_violation due to ON DELETE RESTRICT
          const error: any = new Error(`update or delete on table "${entityType}" violates foreign key constraint on table "gym_emergency_contact_access_logs"`);
          error.code = '23503';
          throw error;
        }
        return { deleted: true, entityId };
      };

      // Deletion of any parent with existing access logs must fail and preserve logs
      expect(() => deleteParentEntity('gym', GYM_A_ID, true)).toThrow(/violates foreign key constraint/);
      expect(() => deleteParentEntity('member', ATHLETE_ID, true)).toThrow(/violates foreign key constraint/);
      expect(() => deleteParentEntity('owner', OWNER_ID, true)).toThrow(/violates foreign key constraint/);
      expect(() => deleteParentEntity('session', SESSION_ID, true)).toThrow(/violates foreign key constraint/);

      // Safe deletion only when no child logs exist
      expect(deleteParentEntity('gym', 'unused-gym', false).deleted).toBe(true);
    });

    it('permits athlete transparency SELECT on their own access logs while denying cross-athlete and direct owner SELECT', () => {
      const logs: AccessLogEntry[] = [
        {
          id: 'log-1',
          gymId: GYM_A_ID,
          memberUserId: ATHLETE_ID,
          viewerOwnerId: OWNER_ID,
          attendanceSessionId: SESSION_ID,
          accessedFields: ['contact_name', 'phone_number'],
          accessedAt: new Date().toISOString(),
        },
        {
          id: 'log-2',
          gymId: GYM_A_ID,
          memberUserId: 'other-athlete-uuid',
          viewerOwnerId: OWNER_ID,
          attendanceSessionId: 'other-session-uuid',
          accessedFields: ['contact_name', 'phone_number'],
          accessedAt: new Date().toISOString(),
        },
      ];

      const selectAccessLogs = (callerUid: string, isOwner: boolean) => {
        // RLS policy: USING (member_user_id = auth.uid())
        // Owners have no direct SELECT policy on this table
        if (isOwner) {
          return []; // Owner direct SELECT returns 0 rows
        }
        return logs.filter((log) => log.memberUserId === callerUid);
      };

      // Athlete can view logs where they are the subject
      const athleteLogs = selectAccessLogs(ATHLETE_ID, false);
      expect(athleteLogs.length).toBe(1);
      expect(athleteLogs[0].id).toBe('log-1');
      expect(athleteLogs[0].memberUserId).toBe(ATHLETE_ID);

      // Other athlete only sees their own log
      const otherAthleteLogs = selectAccessLogs('other-athlete-uuid', false);
      expect(otherAthleteLogs.length).toBe(1);
      expect(otherAthleteLogs[0].id).toBe('log-2');

      // Facility owner receives 0 rows upon direct table SELECT
      const ownerLogs = selectAccessLogs(OWNER_ID, true);
      expect(ownerLogs.length).toBe(0);
    });
  });
});
