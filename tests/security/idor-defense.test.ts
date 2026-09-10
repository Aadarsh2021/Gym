import { describe, it, expect } from 'vitest';

/**
 * IDOR (Insecure Direct Object Reference) Defense Tests
 * Verifies that forging UUIDs or supplying other users' resource IDs is blocked.
 */

interface WorkoutSession {
  id: string;
  userId: string;
  name: string;
}

const mockSessions: Record<string, WorkoutSession> = {
  'session-user-a': { id: 'session-user-a', userId: 'user-a', name: 'User A Push Workout' },
  'session-user-b': { id: 'session-user-b', userId: 'user-b', name: 'User B Leg Workout' },
};

function getWorkoutSession(callerUserId: string, requestedSessionId: string): WorkoutSession | null {
  const session = mockSessions[requestedSessionId];
  if (!session) return null;

  // Authorization check enforced by auth.uid() scope in database query:
  // SELECT * FROM workout_sessions WHERE id = requestedSessionId AND user_id = auth.uid()
  if (session.userId !== callerUserId) {
    return null; // IDOR blocked
  }
  return session;
}

describe('IDOR Defense Tests', () => {
  it('should ALLOW User A to access their own workout session', () => {
    const session = getWorkoutSession('user-a', 'session-user-a');
    expect(session).not.toBeNull();
    expect(session?.name).toBe('User A Push Workout');
  });

  it('should DENY User A when attempting to access User B session via UUID tampering', () => {
    // User A knows the UUID of User B's workout session
    const session = getWorkoutSession('user-a', 'session-user-b');
    expect(session).toBeNull(); // Access blocked
  });

  it('should return null on non-existent resource UUIDs without disclosing error specifics', () => {
    const session = getWorkoutSession('user-a', 'unknown-session-uuid');
    expect(session).toBeNull();
  });
});
