import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { FitnessProfile, UserProfile, UserSubscription } from '@/types/user.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProfileRepository {
  async fetchProfile(userId: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`profile_${userId}`);
      if (raw && typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        displayName: data.display_name || 'Athlete',
        unitSystem: data.unit_system as 'metric' | 'imperial',
        timezone: data.timezone || 'Asia/Kolkata',
        avatarUrl: data.avatar_url,
        accountRole: (data.account_role as any) || 'member',
        planType: (data.plan_type as any) || 'free',
      };
    } catch (err) {
      logger.error('ProfileRepository: Error fetching profile', { err });
      return null;
    }
  }

  async fetchFitnessProfile(userId: string): Promise<FitnessProfile | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`fitness_profile_${userId}`);
      if (raw && typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
      return null;
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
      logger.error('ProfileRepository: Error fetching fitness profile', { err });
      return null;
    }
  }

  async saveFitnessProfile(profile: Omit<FitnessProfile, 'id'>): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(profile.userId)) {
      platform.storage.setItem(`fitness_profile_${profile.userId}`, JSON.stringify(profile));
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('fitness_profiles')
        .upsert(
          {
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
            gym_latitude: profile.gymLatitude,
            gym_longitude: profile.gymLongitude,
            gym_radius_meters: profile.gymRadiusMeters ?? 200,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        logger.error('ProfileRepository: Error saving fitness profile', { error });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save fitness profile';
      return { success: false, error: msg };
    }
  }

  async fetchSubscription(userId: string): Promise<UserSubscription | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      return {
        id: `mock-sub-${userId}`,
        userId,
        planType: 'free',
        status: 'active',
        provider: 'manual',
      };
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        planType: data.plan_type,
        status: data.status,
        provider: data.provider,
        currentPeriodEnd: data.current_period_end,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      logger.error('ProfileRepository: Error fetching subscription', { err });
      return null;
    }
  }
}

export const profileRepository = new ProfileRepository();
