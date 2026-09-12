import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface ProgressEntry {
  id: string;
  userId: string;
  recordedDate: string; // YYYY-MM-DD
  weightKg: number;
  notes?: string;
  createdAt?: string;
}

export const progressService = {
  /**
   * Fetch all progress entries for a user, sorted chronologically
   */
  async getProgressEntries(userId: string): Promise<ProgressEntry[]> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`progress_entries_${userId}`);
      return stored ? JSON.parse(stored) : [];
    }

    try {
      const { data, error } = await supabase
        .from('progress_entries')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_date', { ascending: true });

      if (error || !data) {
        const stored = localStorage.getItem(`progress_entries_${userId}`);
        return stored ? JSON.parse(stored) : [];
      }

      return data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        recordedDate: row.recorded_date,
        weightKg: parseFloat(row.weight_kg),
        notes: row.notes || undefined,
        createdAt: row.created_at,
      }));
    } catch {
      const stored = localStorage.getItem(`progress_entries_${userId}`);
      return stored ? JSON.parse(stored) : [];
    }
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

    if (!isSupabaseConfigured) {
      const newEntry: ProgressEntry = {
        id: 'entry-' + Math.random().toString(36).substring(2, 9),
        userId,
        recordedDate: targetDate,
        weightKg,
        notes,
        createdAt: new Date().toISOString(),
      };
      const existing = await this.getProgressEntries(userId);
      existing.push(newEntry);
      existing.sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime());
      localStorage.setItem(`progress_entries_${userId}`, JSON.stringify(existing));
      return { success: true, entry: newEntry };
    }

    try {
      const { data, error } = await supabase
        .from('progress_entries')
        .insert({
          user_id: userId,
          recorded_date: targetDate,
          weight_kg: weightKg,
          notes: notes || null,
        })
        .select()
        .single();

      if (error || !data) {
        // Fallback to local storage
        const newEntry: ProgressEntry = {
          id: 'entry-' + Math.random().toString(36).substring(2, 9),
          userId,
          recordedDate: targetDate,
          weightKg,
          notes,
          createdAt: new Date().toISOString(),
        };
        const existing = await this.getProgressEntries(userId);
        existing.push(newEntry);
        existing.sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime());
        localStorage.setItem(`progress_entries_${userId}`, JSON.stringify(existing));
        return { success: true, entry: newEntry };
      }

      const created: ProgressEntry = {
        id: data.id,
        userId: data.user_id,
        recordedDate: data.recorded_date,
        weightKg: parseFloat(data.weight_kg),
        notes: data.notes || undefined,
        createdAt: data.created_at,
      };

      return { success: true, entry: created };
    } catch {
      // Offline fallback
      const newEntry: ProgressEntry = {
        id: 'entry-' + Math.random().toString(36).substring(2, 9),
        userId,
        recordedDate: targetDate,
        weightKg,
        notes,
        createdAt: new Date().toISOString(),
      };
      const existing = await this.getProgressEntries(userId);
      existing.push(newEntry);
      existing.sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime());
      localStorage.setItem(`progress_entries_${userId}`, JSON.stringify(existing));
      return { success: true, entry: newEntry };
    }
  },

  /**
   * Delete a progress entry
   */
  async deleteProgressEntry(userId: string, entryId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      const existing = await this.getProgressEntries(userId);
      const filtered = existing.filter(e => e.id !== entryId);
      localStorage.setItem(`progress_entries_${userId}`, JSON.stringify(filtered));
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('progress_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId);

      if (error) {
        const existing = await this.getProgressEntries(userId);
        const filtered = existing.filter(e => e.id !== entryId);
        localStorage.setItem(`progress_entries_${userId}`, JSON.stringify(filtered));
      }
      return { success: true };
    } catch {
      const existing = await this.getProgressEntries(userId);
      const filtered = existing.filter(e => e.id !== entryId);
      localStorage.setItem(`progress_entries_${userId}`, JSON.stringify(filtered));
      return { success: true };
    }
  },
};
