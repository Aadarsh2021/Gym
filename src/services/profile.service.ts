import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { FitnessProfile, UserProfile } from '@/types/user.types';
import { logger } from '@/lib/logger';

export async function ensureUserProfile(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (existing && !selectErr) return true;

    const { data: authData } = await supabase.auth.getSession();
    const sessionUser = authData?.session?.user;
    const meta = sessionUser?.id === userId ? sessionUser.user_metadata || {} : {};
    const displayName = meta.full_name || meta.name || meta.display_name || sessionUser?.email?.split('@')[0] || 'Athlete';
    const timezone = meta.timezone || 'Asia/Kolkata';
    const avatarUrl = meta.avatar_url || meta.picture || null;

    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        display_name: displayName,
        timezone,
        avatar_url: avatarUrl,
      });

    if (insertErr && insertErr.code !== '23505') {
      logger.error('Error provisioning profile record', { insertErr });
      return false;
    }

    // Provision initial streak counter if missing
    await supabase
      .from('streaks')
      .insert({ user_id: userId, current_streak: 0, longest_streak: 0 });

    return true;
  } catch (err) {
    logger.error('Exception in ensureUserProfile', { err });
    return false;
  }
}

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
        gymLatitude: data.gym_latitude ? Number(data.gym_latitude) : null,
        gymLongitude: data.gym_longitude ? Number(data.gym_longitude) : null,
        gymRadiusMeters: data.gym_radius_meters ? Number(data.gym_radius_meters) : 200,
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
      // 1. Authoritative authenticated user verification
      const { data: { session } } = await supabase.auth.getSession();
      const authenticatedUserId = session?.user?.id;
      if (!authenticatedUserId || authenticatedUserId !== profile.userId) {
        return { success: false, error: 'Unauthorized: Session user ID does not match profile target' };
      }

      // 2. Ensure authoritative parent row exists in public.profiles
      const profileReady = await ensureUserProfile(authenticatedUserId);
      if (!profileReady) {
        return { success: false, error: 'Failed to provision authoritative profile record' };
      }

      // 3. Upsert into fitness_profiles (Unique on user_id)
      const { error } = await supabase
        .from('fitness_profiles')
        .upsert({
          user_id: authenticatedUserId,
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
          gym_latitude: profile.gymLatitude ?? null,
          gym_longitude: profile.gymLongitude ?? null,
          gym_radius_meters: profile.gymRadiusMeters ?? 200,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        logger.error('Error upserting fitness profile', { error });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save fitness profile';
      logger.error('Exception in saveFitnessProfile', { err });
      return { success: false, error: message };
    }
  },

  async saveGymLocation(
    userId: string,
    latitude: number | null,
    longitude: number | null,
    radiusMeters: number = 200
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(`fitness_profile_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem(
          `fitness_profile_${userId}`,
          JSON.stringify({ ...parsed, gymLatitude: latitude, gymLongitude: longitude, gymRadiusMeters: radiusMeters })
        );
      }
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('fitness_profiles')
        .update({
          gym_latitude: latitude,
          gym_longitude: longitude,
          gym_radius_meters: radiusMeters,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update gym location';
      return { success: false, error: msg };
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
