import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { FitnessProfile, UserProfile } from '@/types/user.types';
import { profileRepository } from '@/repositories/profile.repository';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

export async function ensureUserProfile(userId: string, roleSelected: boolean = false): Promise<boolean> {
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
        account_role: 'member',
        role_selected: roleSelected,
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

      let customLat: number | null = null;
      let customLng: number | null = null;
      let customRadius: number = 200;
      const storedLoc = platform.storage.getItem(`user_custom_gym_location_${userId}`);
      if (storedLoc && typeof storedLoc === 'string') {
        try {
          const parsedLoc = JSON.parse(storedLoc);
          customLat = parsedLoc.latitude ?? null;
          customLng = parsedLoc.longitude ?? null;
          customRadius = parsedLoc.radiusMeters ?? 200;
        } catch { /* ignore */ }
      }

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
        gymLatitude: customLat,
        gymLongitude: customLng,
        gymRadiusMeters: customRadius,
      };
    } catch (err) {
      logger.error('Error fetching fitness profile', { err });
      return null;
    }
  },

  async saveFitnessProfile(profile: Omit<FitnessProfile, 'id'>): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      const fakeId = 'fp-' + Math.random().toString(36).substring(2, 9);
      platform.storage.setItem(`fitness_profile_${profile.userId}`, JSON.stringify({ ...profile, id: fakeId }));
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
      // Note: Only persist columns that exist on public.fitness_profiles in PostgreSQL
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
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        logger.error('Error upserting fitness profile', { error });
        return { success: false, error: error.message };
      }

      // Preserve custom personal gym location in platform storage if provided
      if (profile.gymLatitude && profile.gymLongitude) {
        platform.storage.setItem(
          `user_custom_gym_location_${authenticatedUserId}`,
          JSON.stringify({
            latitude: profile.gymLatitude,
            longitude: profile.gymLongitude,
            radiusMeters: profile.gymRadiusMeters ?? 200,
          })
        );
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
    if (latitude && longitude) {
      platform.storage.setItem(
        `user_custom_gym_location_${userId}`,
        JSON.stringify({
          latitude,
          longitude,
          radiusMeters,
        })
      );
    } else {
      platform.storage.removeItem(`user_custom_gym_location_${userId}`);
    }
    return { success: true };
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    return profileRepository.fetchProfile(userId);
  },

  async selectAccountRole(userId: string, role: 'member' | 'gym_owner'): Promise<{ success: boolean; error?: string }> {
    return profileRepository.updateAccountRole(userId, role);
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
