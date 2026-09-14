import { progressRepository, ProgressEntryRecord } from '@/repositories/progress.repository';

export interface ProgressEntry extends ProgressEntryRecord {}

export const progressService = {
  /**
   * Fetch all progress entries for a user, sorted chronologically
   */
  async getProgressEntries(userId: string): Promise<ProgressEntry[]> {
    return progressRepository.fetchProgressEntries(userId);
  },

  /**
   * Log a new weight entry
   */
  async logWeight(
    userId: string,
    weightKg: number,
    recordedDate?: string,
    notes?: string
  ): Promise<{ success: boolean; entry?: ProgressEntry; error?: string }> {
    const targetDate = recordedDate || new Date().toISOString().split('T')[0];
    return progressRepository.insertProgressEntry(userId, weightKg, targetDate, notes);
  },

  /**
   * Delete a progress entry
   */
  async deleteProgressEntry(userId: string, entryId: string): Promise<{ success: boolean; error?: string }> {
    return progressRepository.deleteProgressEntry(userId, entryId);
  },
};
