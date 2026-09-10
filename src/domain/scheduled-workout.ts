import { WorkoutPlan, WorkoutPlanDay, WorkoutSession } from '@/types/workout.types';

export interface NextScheduledWorkoutInfo {
  day: WorkoutPlanDay;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  dayOfWeekName: string;
  daysAhead: number;
  scheduledDate: string; // YYYY-MM-DD
}

export interface ScheduledWorkoutResult {
  status: 'scheduled' | 'completed_today' | 'rest_day' | 'no_plan';
  scheduledDay: WorkoutPlanDay | null;
  completedSessionToday?: WorkoutSession | null;
  nextScheduledWorkout?: NextScheduledWorkoutInfo | null;
  missedPreviousWorkout?: WorkoutPlanDay | null;
  message: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Deterministically assigns weekly training days if a plan doesn't have explicit schedule metadata.
 */
export function getDayScheduledDays(day: WorkoutPlanDay, totalDays: number, dayIndex: number): number[] {
  if (day.scheduledDaysOfWeek && day.scheduledDaysOfWeek.length > 0) {
    return day.scheduledDaysOfWeek;
  }

  // Pure deterministic distribution:
  // 1-day plan: Mon, Wed, Fri
  if (totalDays === 1) return [1, 3, 5];
  // 2-day plan: Mon, Thu
  if (totalDays === 2) return dayIndex === 0 ? [1] : [4];
  // 3-day plan: Mon, Wed, Fri
  if (totalDays === 3) return dayIndex === 0 ? [1] : dayIndex === 1 ? [3] : [5];
  // 4-day plan: Mon, Tue, Thu, Fri
  if (totalDays === 4) return dayIndex === 0 ? [1] : dayIndex === 1 ? [2] : dayIndex === 2 ? [4] : [5];
  // 5-day plan: Mon, Tue, Wed, Fri, Sat
  if (totalDays === 5) {
    const daysMap = [1, 2, 3, 5, 6];
    return [daysMap[dayIndex] ?? (dayIndex + 1)];
  }
  // 6-day plan: Mon - Sat
  if (totalDays >= 6) {
    return [dayIndex + 1];
  }

  return [1];
}

/**
 * Returns formatted YYYY-MM-DD in local time
 */
export function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ScheduleOptions {
  activePlan: WorkoutPlan | null;
  currentDate?: Date | string;
  completedSessions?: WorkoutSession[];
}

/**
 * Core deterministic workout scheduler
 * Resolves today's status: scheduled workout, completed today, or rest day with next upcoming routine.
 */
export function getTodaysScheduledWorkout(options: ScheduleOptions): ScheduledWorkoutResult {
  const { activePlan, currentDate = new Date(), completedSessions = [] } = options;

  if (!activePlan || !activePlan.days || activePlan.days.length === 0) {
    return {
      status: 'no_plan',
      scheduledDay: null,
      message: 'No active training plan found. Build your personalized workout split to get started.',
    };
  }

  const dateObj = typeof currentDate === 'string' ? new Date(currentDate) : new Date(currentDate);
  const todayKey = formatDateKey(dateObj);
  const todayDayOfWeek = dateObj.getDay(); // 0-6

  // 1. Check if user already completed a workout today
  const sessionToday = completedSessions.find(s => {
    if (s.status !== 'completed') return false;
    const completedDateStr = s.completedAt ? formatDateKey(new Date(s.completedAt)) : null;
    const startedDateStr = s.startedAt ? formatDateKey(new Date(s.startedAt)) : null;
    return completedDateStr === todayKey || startedDateStr === todayKey;
  });

  // Calculate next scheduled workout (looking ahead 1..7 days)
  const findNextWorkout = (startOffset = 1): NextScheduledWorkoutInfo | null => {
    for (let offset = startOffset; offset <= 7; offset++) {
      const futureDate = new Date(dateObj);
      futureDate.setDate(dateObj.getDate() + offset);
      const futureDOW = futureDate.getDay();

      for (let idx = 0; idx < activePlan.days.length; idx++) {
        const day = activePlan.days[idx];
        const scheduledDOWs = getDayScheduledDays(day, activePlan.days.length, idx);
        if (scheduledDOWs.includes(futureDOW)) {
          return {
            day,
            dayOfWeek: futureDOW,
            dayOfWeekName: DAY_NAMES[futureDOW],
            daysAhead: offset,
            scheduledDate: formatDateKey(futureDate),
          };
        }
      }
    }
    return null;
  };

  const nextWorkout = findNextWorkout(1);

  // If completed today:
  if (sessionToday) {
    // Find the day that matches today or was completed
    const matchingPlanDay = activePlan.days.find((d, idx) => {
      const dows = getDayScheduledDays(d, activePlan.days.length, idx);
      return dows.includes(todayDayOfWeek);
    }) || activePlan.days[0];

    return {
      status: 'completed_today',
      scheduledDay: matchingPlanDay,
      completedSessionToday: sessionToday,
      nextScheduledWorkout: nextWorkout,
      message: `Workout complete for today! Next scheduled session is ${nextWorkout ? nextWorkout.day.name + ' on ' + nextWorkout.dayOfWeekName : 'upcoming'}.`,
    };
  }

  // 2. Check if today is a scheduled training day
  let scheduledDayToday: WorkoutPlanDay | null = null;
  for (let idx = 0; idx < activePlan.days.length; idx++) {
    const day = activePlan.days[idx];
    const scheduledDOWs = getDayScheduledDays(day, activePlan.days.length, idx);
    if (scheduledDOWs.includes(todayDayOfWeek)) {
      scheduledDayToday = day;
      break;
    }
  }

  if (scheduledDayToday) {
    return {
      status: 'scheduled',
      scheduledDay: scheduledDayToday,
      nextScheduledWorkout: nextWorkout,
      message: `Scheduled for today (${DAY_NAMES[todayDayOfWeek]}): ${scheduledDayToday.name}`,
    };
  }

  // 3. Rest Day logic & Off-schedule recovery check
  // Check if yesterday or previous 2 days had a scheduled workout that was NOT completed
  let missedDay: WorkoutPlanDay | null = null;
  for (let pastOffset = 1; pastOffset <= 2; pastOffset++) {
    const pastDate = new Date(dateObj);
    pastDate.setDate(dateObj.getDate() - pastOffset);
    const pastDOW = pastDate.getDay();
    const pastDateKey = formatDateKey(pastDate);

    // Was a session completed on this past day?
    const wasCompleted = completedSessions.some(s => {
      if (s.status !== 'completed') return false;
      const sDate = s.completedAt ? formatDateKey(new Date(s.completedAt)) : null;
      return sDate === pastDateKey;
    });

    if (!wasCompleted) {
      for (let idx = 0; idx < activePlan.days.length; idx++) {
        const day = activePlan.days[idx];
        const dows = getDayScheduledDays(day, activePlan.days.length, idx);
        if (dows.includes(pastDOW)) {
          missedDay = day;
          break;
        }
      }
    }
    if (missedDay) break;
  }

  return {
    status: 'rest_day',
    scheduledDay: null,
    nextScheduledWorkout: nextWorkout,
    missedPreviousWorkout: missedDay,
    message: `Today is a scheduled recovery & rest day. Your next workout is ${nextWorkout ? nextWorkout.day.name + ' on ' + nextWorkout.dayOfWeekName : 'coming soon'}.`,
  };
}
