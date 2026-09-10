import { describe, it, expect } from 'vitest';
import { getTodaysScheduledWorkout } from '@/domain/scheduled-workout';
import { WorkoutPlan, WorkoutSession } from '@/types/workout.types';

describe('Scheduled Workout Domain Engine', () => {
  const samplePlan: WorkoutPlan = {
    id: 'plan-123',
    userId: 'user-abc',
    name: 'Upper / Lower Split',
    splitType: 'Upper / Lower',
    isActive: true,
    days: [
      {
        id: 'day-1',
        planId: 'plan-123',
        dayNumber: 1,
        name: 'Upper Body Power',
        targetMuscleGroups: ['Chest', 'Back', 'Shoulders'],
        scheduledDaysOfWeek: [1, 4], // Monday, Thursday
        exercises: [],
      },
      {
        id: 'day-2',
        planId: 'plan-123',
        dayNumber: 2,
        name: 'Lower Body & Core',
        targetMuscleGroups: ['Legs', 'Core'],
        scheduledDaysOfWeek: [2, 5], // Tuesday, Friday
        exercises: [],
      },
    ],
  };

  it('returns status no_plan when plan is null or has no days', () => {
    const res1 = getTodaysScheduledWorkout({ activePlan: null });
    expect(res1.status).toBe('no_plan');
    expect(res1.scheduledDay).toBeNull();

    const res2 = getTodaysScheduledWorkout({ activePlan: { ...samplePlan, days: [] } });
    expect(res2.status).toBe('no_plan');
  });

  it('correctly identifies scheduled workout on a scheduled day (Monday)', () => {
    // 2026-09-07 is a Monday (day 1)
    const monday = new Date('2026-09-07T10:00:00Z');
    const result = getTodaysScheduledWorkout({
      activePlan: samplePlan,
      currentDate: monday,
      completedSessions: [],
    });

    expect(result.status).toBe('scheduled');
    expect(result.scheduledDay?.name).toBe('Upper Body Power');
    expect(result.nextScheduledWorkout?.day.name).toBe('Lower Body & Core');
    expect(result.nextScheduledWorkout?.dayOfWeekName).toBe('Tuesday');
  });

  it('correctly identifies scheduled workout on Tuesday (Day 2)', () => {
    // 2026-09-08 is a Tuesday (day 2)
    const tuesday = new Date('2026-09-08T10:00:00Z');
    const result = getTodaysScheduledWorkout({
      activePlan: samplePlan,
      currentDate: tuesday,
      completedSessions: [],
    });

    expect(result.status).toBe('scheduled');
    expect(result.scheduledDay?.name).toBe('Lower Body & Core');
  });

  it('correctly returns rest_day when today is an unscheduled day (Wednesday)', () => {
    // 2026-09-09 is a Wednesday (day 3, rest day for this split)
    const wednesday = new Date('2026-09-09T10:00:00Z');
    const result = getTodaysScheduledWorkout({
      activePlan: samplePlan,
      currentDate: wednesday,
      completedSessions: [],
    });

    expect(result.status).toBe('rest_day');
    expect(result.scheduledDay).toBeNull();
    // Next scheduled is Thursday (Day 1 Upper Body Power)
    expect(result.nextScheduledWorkout?.day.name).toBe('Upper Body Power');
    expect(result.nextScheduledWorkout?.dayOfWeekName).toBe('Thursday');
  });

  it('flags completed_today if user already completed their workout today', () => {
    const monday = new Date('2026-09-07T14:00:00Z');
    const completedSession: WorkoutSession = {
      id: 'session-1',
      userId: 'user-abc',
      planId: 'plan-123',
      name: 'Upper Body Power',
      status: 'completed',
      startedAt: '2026-09-07T09:00:00Z',
      completedAt: '2026-09-07T10:00:00Z',
      durationSeconds: 3600,
      exercises: [],
    };

    const result = getTodaysScheduledWorkout({
      activePlan: samplePlan,
      currentDate: monday,
      completedSessions: [completedSession],
    });

    expect(result.status).toBe('completed_today');
    expect(result.completedSessionToday?.id).toBe('session-1');
    expect(result.nextScheduledWorkout?.day.name).toBe('Lower Body & Core');
  });

  it('detects missed previous workout during a rest day for off-schedule recovery', () => {
    // Wednesday 2026-09-09 (Rest day). Monday (2026-09-07) was not completed, but Tuesday was.
    const wednesday = new Date('2026-09-09T10:00:00Z');
    const tuesdaySession: WorkoutSession = {
      id: 'session-2',
      userId: 'user-abc',
      planId: 'plan-123',
      name: 'Lower Body & Core',
      status: 'completed',
      startedAt: '2026-09-08T09:00:00Z',
      completedAt: '2026-09-08T10:00:00Z',
      durationSeconds: 3600,
      exercises: [],
    };

    const result = getTodaysScheduledWorkout({
      activePlan: samplePlan,
      currentDate: wednesday,
      completedSessions: [tuesdaySession],
    });

    expect(result.status).toBe('rest_day');
  });

  it('falls back deterministically if scheduledDaysOfWeek is not explicitly set', () => {
    const legacyPlan: WorkoutPlan = {
      id: 'legacy-1',
      userId: 'user-abc',
      name: '3-Day Classic',
      splitType: 'Full Body',
      isActive: true,
      days: [
        { id: 'd1', planId: 'legacy-1', dayNumber: 1, name: 'Full Body A', targetMuscleGroups: ['Chest'], exercises: [] },
        { id: 'd2', planId: 'legacy-1', dayNumber: 2, name: 'Full Body B', targetMuscleGroups: ['Back'], exercises: [] },
        { id: 'd3', planId: 'legacy-1', dayNumber: 3, name: 'Full Body C', targetMuscleGroups: ['Legs'], exercises: [] },
      ],
    };

    // 2026-09-07 is Monday -> Day 1 (Full Body A)
    const monday = new Date('2026-09-07T10:00:00Z');
    const resMon = getTodaysScheduledWorkout({ activePlan: legacyPlan, currentDate: monday });
    expect(resMon.status).toBe('scheduled');
    expect(resMon.scheduledDay?.name).toBe('Full Body A');

    // 2026-09-09 is Wednesday -> Day 2 (Full Body B)
    const wednesday = new Date('2026-09-09T10:00:00Z');
    const resWed = getTodaysScheduledWorkout({ activePlan: legacyPlan, currentDate: wednesday });
    expect(resWed.status).toBe('scheduled');
    expect(resWed.scheduledDay?.name).toBe('Full Body B');
  });
});
