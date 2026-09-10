import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { FitnessProfile, UserProfile } from '@/types/user.types';
import { logger } from '@/lib/logger';

export const profileService = {
  async getFitnessProfile(userId: string): Promise<FitnessProfile | null> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`fitness_profile_${userId}`);
      return stored ? JSON.parse(stored) : null;
    }

    try {
      const { data, error } = await supabase
        .from('fitness_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        age: data.age || 25,
        heightCm: Number(data.height_cm) || 175,
        weightKg: Number(data.weight_kg) || 70,
        gender: data.gender || 'male',
        goal: data.goal,
        experienceLevel: data.experience_level,
        daysPerWeek: data.days_per_week,
        workoutDurationMinutes: data.workout_duration_minutes,
        equipment: data.equipment || [],
        dietaryPreference: data.dietary_preference,
        limitations: data.limitations || [],
      };
    } catch (err) {
      logger.error('Error fetching fitness profile', { err });
      return null;
    }
  },

  async saveFitnessProfile(profile: Omit<FitnessProfile, 'id'>): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      const fakeId = 'fp-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(`fitness_profile_${profile.userId}`, JSON.stringify({ ...profile, id: fakeId }));
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('fitness_profiles')
        .upsert({
          user_id: profile.userId,
          age: profile.age,
          height_cm: profile.heightCm,
          weight_kg: profile.weightKg,
          gender: profile.gender,
          goal: profile.goal,
          experience_level: profile.experienceLevel,
          days_per_week: profile.daysPerWeek,
          workout_duration_minutes: profile.workoutDurationMinutes,
          equipment: profile.equipment,
          dietary_preference: profile.dietaryPreference,
          limitations: profile.limitations,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save fitness profile';
      return { success: false, error: message };
    }
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
    if (!isSupabaseConfigured) return true;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: updates.displayName,
          unit_system: updates.unitSystem,
          timezone: updates.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      return !error;
    } catch {
      return false;
    }
  },
};
