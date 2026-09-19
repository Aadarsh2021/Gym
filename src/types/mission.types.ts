import { DailyMission, ClaimMissionResult } from '@/domain/daily-mission';

export type { DailyMission, ClaimMissionResult, DailyMissionType } from '@/domain/daily-mission';

export interface DailyMissionResponse {
  success: boolean;
  data?: DailyMission;
  error?: string;
}

export interface ClaimMissionResponse {
  success: boolean;
  data?: ClaimMissionResult;
  error?: string;
}
