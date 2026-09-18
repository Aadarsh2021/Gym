import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveActiveSessionDraft,
  loadActiveSessionDraft,
  clearActiveSessionDraft,
  isSessionDraftStale,
} from '@/utils/storage';
import { workoutService } from '@/services/workout.service';
import { workoutRepository } from '@/repositories/workout.repository';
import { WorkoutSession } from '@/types/workout.types';
import { platform } from '@/platform';

describe('Phase C9: Smart Workout Resume Suite', () => {
  const userA = '00000000-0000-4000-8000-000000000001';
  const userB = '00000000-0000-4000-8000-000000000002';

  const mockSessionUserA: WorkoutSession = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: userA,
    name: 'Upper Body Power',
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    durationSeconds: 320,
    exercises: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        exerciseId: 'ex-bench-press',
        exerciseName: 'Bench Press',
        primaryMuscle: 'Chest',
        orderIndex: 1,
        sets: [
          {
            id: '33333333-3333-4333-8333-333333333331',
            setIndex: 1,
            weightKg: 85,
            reps: 8,
            completed: true,
          },
          {
            id: '33333333-3333-4333-8333-333333333332',
            setIndex: 2,
            weightKg: 85,
            reps: 7,
            completed: false,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    clearActiveSessionDraft(userA);
    clearActiveSessionDraft(userB);
    vi.restoreAllMocks();
  });

  it('saves and restores active draft with user-scoped storage isolation', () => {
    // Save draft for User A
    saveActiveSessionDraft(mockSessionUserA, userA);

    // User A can load their draft
    const loadedUserA = loadActiveSessionDraft(userA);
    expect(loadedUserA).not.toBeNull();
    expect(loadedUserA?.id).toBe(mockSessionUserA.id);
    expect(loadedUserA?.exercises[0].sets[0].completed).toBe(true);
    expect(loadedUserA?.exercises[0].sets[0].weightKg).toBe(85);

    // User B cannot see User A's draft (Strict Tenant Isolation)
    const loadedUserB = loadActiveSessionDraft(userB);
    expect(loadedUserB).toBeNull();
  });

  it('rejects stale drafts older than 12 hours and auto-clears storage', () => {
    const thirteenHoursAgo = new Date(Date.now() - (13 * 60 * 60 * 1000)).toISOString();
    const staleSession: WorkoutSession = {
      ...mockSessionUserA,
      startedAt: thirteenHoursAgo,
    };

    const staleWrapper = {
      session: staleSession,
      savedAt: thirteenHoursAgo,
      userId: userA,
      version: 1,
    };
    platform.storage.setItem(`fitness_active_session_draft_${userA}`, JSON.stringify(staleWrapper));

    expect(isSessionDraftStale(thirteenHoursAgo)).toBe(true);

    const result = loadActiveSessionDraft(userA);
    expect(result).toBeNull();

    const rawAfter = platform.storage.getItem(`fitness_active_session_draft_${userA}`);
    expect(rawAfter).toBeNull();
  });

  it('retains valid drafts within 12 hours TTL', () => {
    const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
    const validSession: WorkoutSession = {
      ...mockSessionUserA,
      startedAt: twoHoursAgo,
    };

    saveActiveSessionDraft(validSession, userA);

    const result = loadActiveSessionDraft(userA);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(mockSessionUserA.id);
  });

  it('guarantees persistent set IDs across autosaves preventing duplicate set generation', async () => {
    const sessionToSave = { ...mockSessionUserA };
    const initialSetId1 = sessionToSave.exercises[0].sets[0].id;
    const initialSetId2 = sessionToSave.exercises[0].sets[1].id;

    await workoutService.saveWorkoutSession(sessionToSave);

    expect(sessionToSave.exercises[0].sets[0].id).toBe(initialSetId1);
    expect(sessionToSave.exercises[0].sets[1].id).toBe(initialSetId2);

    await workoutService.saveWorkoutSession(sessionToSave);

    expect(sessionToSave.exercises[0].sets[0].id).toBe(initialSetId1);
    expect(sessionToSave.exercises[0].sets[1].id).toBe(initialSetId2);
  });

  it('clears draft completely on workout completion', () => {
    saveActiveSessionDraft(mockSessionUserA, userA);
    expect(loadActiveSessionDraft(userA)).not.toBeNull();

    clearActiveSessionDraft(userA);
    expect(loadActiveSessionDraft(userA)).toBeNull();
  });

  it('clears draft and archives session on explicit cancellation', async () => {
    saveActiveSessionDraft(mockSessionUserA, userA);
    expect(loadActiveSessionDraft(userA)).not.toBeNull();

    const cancelSpy = vi.spyOn(workoutRepository, 'cancelActiveSession').mockResolvedValue();

    await workoutService.cancelActiveSession(mockSessionUserA.id, userA);
    clearActiveSessionDraft(userA);

    expect(cancelSpy).toHaveBeenCalledWith(mockSessionUserA.id, userA);
    expect(loadActiveSessionDraft(userA)).toBeNull();
  });

  it('reconciles remote active session when local draft is missing', async () => {
    const fetchSpy = vi.spyOn(workoutRepository, 'fetchActiveSession').mockResolvedValue(mockSessionUserA);

    const activeRemote = await workoutService.getActiveSession(userA);
    expect(fetchSpy).toHaveBeenCalledWith(userA);
    expect(activeRemote).not.toBeNull();
    expect(activeRemote?.id).toBe(mockSessionUserA.id);
  });

  it('cancels stale remote session older than 12 hours', async () => {
    const fourteenHoursAgo = new Date(Date.now() - (14 * 60 * 60 * 1000)).toISOString();
    const staleRemoteSession: WorkoutSession = {
      ...mockSessionUserA,
      startedAt: fourteenHoursAgo,
    };

    vi.spyOn(workoutRepository, 'fetchActiveSession').mockResolvedValue(staleRemoteSession);
    const cancelSpy = vi.spyOn(workoutRepository, 'cancelActiveSession').mockResolvedValue();

    const remote = await workoutService.getActiveSession(userA);
    expect(remote).not.toBeNull();
    expect(isSessionDraftStale(undefined, remote?.startedAt)).toBe(true);

    if (remote && isSessionDraftStale(undefined, remote.startedAt)) {
      await workoutService.cancelActiveSession(remote.id, userA);
    }

    expect(cancelSpy).toHaveBeenCalledWith(staleRemoteSession.id, userA);
  });
});
