import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProgressEntryRecord {
  id: string;
  userId: string;
  recordedDate: string; // YYYY-MM-DD
  weightKg: number;
  notes?: string;
  createdAt?: string;
}

export class ProgressRepository {
  /**
   * Fetches all progress entries for a user, sorted chronologically.
   */
  async fetchProgressEntries(userId: string): Promise<ProgressEntryRecord[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`progress_entries_${userId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('progress_entries')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_date', { ascending: true });

      if (error || !data) {
        const stored = platform.storage.getItem(`progress_entries_${userId}`);
        if (stored && typeof stored === 'string') {
          try { return JSON.parse(stored); } catch { /* ignore */ }
        }
        return [];
      }

      return data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        recordedDate: row.recorded_date,
        weightKg: parseFloat(row.weight_kg),
        notes: row.notes || undefined,
        createdAt: row.created_at,
      }));
    } catch (err) {
      logger.error('ProgressRepository: Error fetching progress entries', { err });
      const stored = platform.storage.getItem(`progress_entries_${userId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return [];
    }
  }

  /**
   * Inserts a new progress entry for a user.
   */
  async insertProgressEntry(
    userId: string,
    weightKg: number,
    recordedDate: string,
    notes?: string
  ): Promise<{ success: boolean; entry?: ProgressEntryRecord; error?: string }> {
    const fallbackEntry: ProgressEntryRecord = {
      id: 'entry-' + Math.random().toString(36).substring(2, 9),
      userId,
      recordedDate,
      weightKg,
      notes,
      createdAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const existing = await this.fetchProgressEntries(userId);
      existing.push(fallbackEntry);
      existing.sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime());
      platform.storage.setItem(`progress_entries_${userId}`, JSON.stringify(existing));
      return { success: true, entry: fallbackEntry };
    }

    try {
      const { data, error } = await supabase
        .from('progress_entries')
        .insert({
          user_id: userId,
          recorded_date: recordedDate,
          weight_kg: weightKg,
          notes: notes || null,
        })
        .select()
        .single();

      if (error || !data) {
        const existing = await this.fetchProgressEntries(userId);
        existing.push(fallbackEntry);
        existing.sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime());
        platform.storage.setItem(`progress_entries_${userId}`, JSON.stringify(existing));
        return { success: true, entry: fallbackEntry };
      }

      const created: ProgressEntryRecord = {
        id: data.id,
        userId: data.user_id,
        recordedDate: data.recorded_date,
        weightKg: parseFloat(data.weight_kg),
        notes: data.notes || undefined,
        createdAt: data.created_at,
      };

      return { success: true, entry: created };
    } catch (err: unknown) {
      logger.error('ProgressRepository: Exception in insertProgressEntry', { err });
      const existing = await this.fetchProgressEntries(userId);
      existing.push(fallbackEntry);
      existing.sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime());
      platform.storage.setItem(`progress_entries_${userId}`, JSON.stringify(existing));
      return { success: true, entry: fallbackEntry };
    }
  }

  /**
   * Deletes a progress entry.
   */
  async deleteProgressEntry(userId: string, entryId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const existing = await this.fetchProgressEntries(userId);
      const filtered = existing.filter(e => e.id !== entryId);
      platform.storage.setItem(`progress_entries_${userId}`, JSON.stringify(filtered));
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('progress_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId);

      const existing = await this.fetchProgressEntries(userId);
      const filtered = existing.filter(e => e.id !== entryId);
      platform.storage.setItem(`progress_entries_${userId}`, JSON.stringify(filtered));

      if (error) {
        logger.error('ProgressRepository: Error deleting progress entry', { error });
      }
      return { success: true };
    } catch (err: unknown) {
      logger.error('ProgressRepository: Exception deleting progress entry', { err });
      const existing = await this.fetchProgressEntries(userId);
      const filtered = existing.filter(e => e.id !== entryId);
      platform.storage.setItem(`progress_entries_${userId}`, JSON.stringify(filtered));
      return { success: true };
    }
  }
}

export const progressRepository = new ProgressRepository();
