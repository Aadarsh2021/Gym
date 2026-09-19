/**
 * FITSPHERE V1 - DAILY MISSION DOMAIN MODULE
 * Pure domain logic, types, and formatting for Daily Missions.
 * Note: Client functions are non-authoritative; server RPCs enforce all completion and rewards.
 */

export type DailyMissionType = 'complete_workout' | 'hit_protein' | 'maintain_streak';

export interface DailyMission {
  id: string;
  userId: string;
  missionDate: string; // YYYY-MM-DD
  timezone: string;
  missionType: DailyMissionType;
  title: string;
  description: string;
  targetValue: number;
  coinReward: number;
  isCompleted: boolean;
  completedAt?: string | null;
  progressValue?: number;
  isClaimable?: boolean;
  isExpired?: boolean;
  createdAt?: string;
}

export interface ClaimMissionResult {
  status: 'success' | 'already_claimed';
  missionId: string;
  missionDate?: string;
  missionType?: DailyMissionType;
  coinsAwarded: number;
  completedAt?: string;
}

/**
 * Returns metadata and presentation styling for mission types
 */
export function getMissionMeta(type: DailyMissionType) {
  switch (type) {
    case 'complete_workout':
      return {
        badge: 'Training',
        icon: '🏋️',
        color: 'from-amber-500 to-orange-600',
        textColor: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
      };
    case 'hit_protein':
      return {
        badge: 'Nutrition',
        icon: '🥩',
        color: 'from-emerald-500 to-teal-600',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
      };
    case 'maintain_streak':
    default:
      return {
        badge: 'Consistency',
        icon: '🔥',
        color: 'from-blue-500 to-indigo-600',
        textColor: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
      };
  }
}

/**
 * Evaluates whether a mission date D is within the 12-hour grace period (until D+1 12:00 local time).
 */
export function isWithinGracePeriod(missionDateStr: string, timezone = 'Asia/Kolkata', now = new Date()): boolean {
  try {
    const [year, month, day] = missionDateStr.split('-').map(Number);
    if (!year || !month || !day) return false;

    // Format current time in user's target timezone into components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);

    const nowYear = getPart('year');
    const nowMonth = getPart('month');
    const nowDay = getPart('day');
    let nowHour = getPart('hour');
    if (nowHour === 24) nowHour = 0;
    const nowMinute = getPart('minute');
    const nowSecond = getPart('second');

    // Grace cutoff is D+1 at 12:00:00 in user's timezone
    const graceCutoffUtc = Date.UTC(year, month - 1, day + 1, 12, 0, 0);
    const nowLocalUtc = Date.UTC(nowYear, nowMonth - 1, nowDay, nowHour, nowMinute, nowSecond);

    return nowLocalUtc < graceCutoffUtc;
  } catch {
    return true; // Graceful fallback
  }
}

/**
 * Calculates progress percentage safely [0, 100]
 */
export function getMissionProgressPercent(progress = 0, target = 1): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress / target) * 100)));
}
