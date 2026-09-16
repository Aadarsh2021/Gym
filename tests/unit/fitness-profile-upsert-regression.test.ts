import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { profileRepository } from '@/repositories/profile.repository';
import { profileService } from '@/services/profile.service';
import { supabase } from '@/lib/supabase';
import { platform } from '@/platform';
import { FitnessProfile } from '@/types/user.types';

describe('Fitness Profiles Upsert & 400 Schema Regression Suite', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  const mockProfile: Omit<FitnessProfile, 'id'> = {
    userId,
    age: 28,
    heightCm: 180,
    weightKg: 78,
    gender: 'male',
    goal: 'muscle_gain',
    experienceLevel: 'intermediate',
    daysPerWeek: 4,
    workoutDurationMinutes: 60,
    equipment: ['Barbell', 'Dumbbells'],
    dietaryPreference: 'vegetarian',
    limitations: ['None'],
    gymLatitude: 12.9716,
    gymLongitude: 77.5946,
    gymRadiusMeters: 200,
  };

  beforeEach(() => {
    platform.storage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. saveFitnessProfile strips non-existent gym columns (gym_latitude, gym_longitude, gym_radius_meters) before Supabase upsert', async () => {
    let capturedPayload: any = null;
    let capturedOptions: any = null;

    vi.spyOn(supabase, 'from').mockReturnValue({
      upsert: vi.fn().mockImplementation((payload, options) => {
        capturedPayload = payload;
        capturedOptions = options;
        return Promise.resolve({ error: null });
      }),
    } as any);

    const result = await profileRepository.saveFitnessProfile(mockProfile);
    expect(result.success).toBe(true);

    expect(capturedPayload).toBeDefined();
    expect(capturedPayload.user_id).toBe(userId);
    expect(capturedPayload.age).toBe(28);
    expect(capturedPayload.height_cm).toBe(180);
    expect(capturedPayload.weight_kg).toBe(78);
    expect(capturedPayload.goal).toBe('muscle_gain');

    // CRITICAL: Ensure non-existent columns are NOT sent to Supabase
    expect(capturedPayload.gym_latitude).toBeUndefined();
    expect(capturedPayload.gym_longitude).toBeUndefined();
    expect(capturedPayload.gym_radius_meters).toBeUndefined();

    // Ensure onConflict: 'user_id' is preserved
    expect(capturedOptions).toEqual({ onConflict: 'user_id' });
  });

  it('2. custom gym location is preserved in platform storage without contaminating database payload', async () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    await profileRepository.saveFitnessProfile(mockProfile);

    // Verify location is saved in platform storage
    const stored = platform.storage.getItem(`user_custom_gym_location_${userId}`);
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored as string);
    expect(parsed.latitude).toBe(12.9716);
    expect(parsed.longitude).toBe(77.5946);
    expect(parsed.radiusMeters).toBe(200);
  });

  it('3. fetchFitnessProfile recombines database row with platform storage custom gym location', async () => {
    // Simulate database row without gym location columns
    const dbRow = {
      id: 'fp-123',
      user_id: userId,
      age: 28,
      height_cm: 180,
      weight_kg: 78,
      gender: 'male',
      goal: 'muscle_gain',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration_minutes: 60,
      equipment: ['Barbell'],
      dietary_preference: 'vegetarian',
      limitations: ['None'],
    };

    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: dbRow, error: null }),
        }),
      }),
    } as any);

    // Pre-seed custom location in platform storage
    platform.storage.setItem(
      `user_custom_gym_location_${userId}`,
      JSON.stringify({ latitude: 12.9716, longitude: 77.5946, radiusMeters: 200 })
    );

    const profile = await profileRepository.fetchFitnessProfile(userId);
    expect(profile).toBeDefined();
    expect(profile?.userId).toBe(userId);
    expect(profile?.gymLatitude).toBe(12.9716);
    expect(profile?.gymLongitude).toBe(77.5946);
    expect(profile?.gymRadiusMeters).toBe(200);
  });

  it('4. saveGymLocation preserves coordinates in storage without triggering database schema mismatch', async () => {
    const res = await profileService.saveGymLocation(userId, 13.0827, 80.2707, 500);
    expect(res.success).toBe(true);

    const stored = platform.storage.getItem(`user_custom_gym_location_${userId}`);
    const parsed = JSON.parse(stored as string);
    expect(parsed.latitude).toBe(13.0827);
    expect(parsed.longitude).toBe(80.2707);
    expect(parsed.radiusMeters).toBe(500);
  });

  it('5. documents exact reproduction: sending gym_latitude yields PGRST204 (400), clean payload passes schema validation', async () => {
    const anonKey = 'sb_publishable_qhgrBeVEFS70VsXUrQ-8XA_Ds2w8hxu';
    const baseUrl = 'https://zmfwtidtilghminwirjx.supabase.co/rest/v1/fitness_profiles?on_conflict=user_id';

    // A. Payload WITH gym_latitude produces HTTP 400 PGRST204
    const badPayload = {
      user_id: '00000000-0000-0000-0000-000000000000',
      age: 25,
      gym_latitude: 12.9716,
    };

    const badRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + anonKey,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(badPayload),
    });

    expect(badRes.status).toBe(400);
    const badBody = await badRes.json();
    expect(badBody.code).toBe('PGRST204');
    expect(badBody.message).toContain("Could not find the 'gym_latitude' column of 'fitness_profiles'");

    // B. Clean payload WITHOUT gym_latitude does NOT return 400
    const cleanPayload = {
      user_id: '00000000-0000-0000-0000-000000000000',
      age: 25,
      height_cm: 175,
      weight_kg: 70,
      gender: 'male',
      goal: 'muscle_gain',
      experience_level: 'beginner',
      days_per_week: 4,
      workout_duration_minutes: 60,
      equipment: ['Barbell'],
      dietary_preference: 'vegetarian',
      limitations: ['None'],
    };

    const cleanRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + anonKey,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(cleanPayload),
    });

    // Clean payload is accepted by PostgREST schema validation (401 because anon key has no auth session)
    expect(cleanRes.status).not.toBe(400);
  });
});
