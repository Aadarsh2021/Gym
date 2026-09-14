import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Gym,
  GymMembership,
  GymCheckin,
  GymVerificationMethod,
  GymAttendanceSession,
  GymCheckoutMethod,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GymRepository {
  // ── 1. Gym Discovery & Directory ──────────────────────────────────────────
  async fetchAllGyms(): Promise<Gym[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .order('name', { ascending: true });

      if (error || !data) return [];

      return data.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        ownerId: g.owner_id,
        address: g.address,
        city: g.city,
        state: g.state || undefined,
        pincode: g.pincode || undefined,
        contactNumber: g.contact_number || undefined,
        email: g.email || undefined,
        description: g.description || undefined,
        openingTime: g.opening_time || undefined,
        closingTime: g.closing_time || undefined,
        latitude: Number(g.latitude),
        longitude: Number(g.longitude),
        radiusMeters: g.radius_meters || 200,
        qrCodeHash: g.qr_code_hash,
        logoUrl: g.logo_url || undefined,
        coverImageUrl: g.cover_image_url || undefined,
        createdAt: g.created_at,
      }));
    } catch (err) {
      logger.error('GymRepository: Error fetching gyms', { err });
      return [];
    }
  }

  async fetchGymById(gymId: string): Promise<Gym | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .eq('id', gymId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.owner_id,
        address: data.address,
        city: data.city,
        state: data.state || undefined,
        pincode: data.pincode || undefined,
        contactNumber: data.contact_number || undefined,
        email: data.email || undefined,
        description: data.description || undefined,
        openingTime: data.opening_time || undefined,
        closingTime: data.closing_time || undefined,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        radiusMeters: data.radius_meters || 200,
        qrCodeHash: data.qr_code_hash,
        logoUrl: data.logo_url || undefined,
        coverImageUrl: data.cover_image_url || undefined,
        createdAt: data.created_at,
      };
    } catch {
      return null;
    }
  }

  async fetchOwnerGyms(ownerId: string): Promise<Gym[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(ownerId)) {
      const stored = platform.storage.getItem(`owner_gyms_${ownerId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      const mapped = data.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        ownerId: g.owner_id,
        address: g.address,
        city: g.city,
        state: g.state || undefined,
        pincode: g.pincode || undefined,
        contactNumber: g.contact_number || undefined,
        email: g.email || undefined,
        description: g.description || undefined,
        openingTime: g.opening_time || undefined,
        closingTime: g.closing_time || undefined,
        latitude: Number(g.latitude),
        longitude: Number(g.longitude),
        radiusMeters: g.radius_meters || 200,
        qrCodeHash: g.qr_code_hash,
        logoUrl: g.logo_url || undefined,
        coverImageUrl: g.cover_image_url || undefined,
        createdAt: g.created_at,
      }));

      platform.storage.setItem(`owner_gyms_${ownerId}`, JSON.stringify(mapped));
      return mapped;
    } catch (err) {
      logger.error('GymRepository: Error fetching owner gyms', { err });
      return [];
    }
  }

  async createGym(
    gymData: Omit<Gym, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; gym?: Gym; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymData.ownerId)) {
      const mockGym: Gym = {
        ...gymData,
        id: 'gym-' + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
      };
      const existing = await this.fetchOwnerGyms(gymData.ownerId);
      existing.unshift(mockGym);
      platform.storage.setItem(`owner_gyms_${gymData.ownerId}`, JSON.stringify(existing));
      return { success: true, gym: mockGym };
    }

    try {
      const { data, error } = await supabase
        .from('gyms')
        .insert({
          name: gymData.name,
          slug: gymData.slug,
          owner_id: gymData.ownerId,
          address: gymData.address,
          city: gymData.city,
          latitude: gymData.latitude,
          longitude: gymData.longitude,
          radius_meters: gymData.radiusMeters || 200,
          qr_code_hash: gymData.qrCodeHash,
        })
        .select('*')
        .single();

      if (error || !data) {
        logger.error('GymRepository: Error creating gym', { error });
        return { success: false, error: error?.message || 'Failed to create gym' };
      }

      const created: Gym = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.owner_id,
        address: data.address,
        city: data.city,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        radiusMeters: data.radius_meters || 200,
        qrCodeHash: data.qr_code_hash,
        createdAt: data.created_at,
      };

      const existing = await this.fetchOwnerGyms(gymData.ownerId);
      existing.unshift(created);
      platform.storage.setItem(`owner_gyms_${gymData.ownerId}`, JSON.stringify(existing));

      return { success: true, gym: created };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gym creation failed';
      return { success: false, error: msg };
    }
  }

  // ── 2. Member Memberships ──────────────────────────────────────────────────
  async fetchUserMemberships(userId: string): Promise<GymMembership[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('gym_memberships')
        .select('*, gyms(*)')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error || !data) return [];

      return data.map(m => ({
        id: m.id,
        gymId: m.gym_id,
        userId: m.user_id,
        status: m.status,
        membershipType: m.membership_type,
        joinedAt: m.joined_at,
        expiresAt: m.expires_at,
        gym: m.gyms
          ? {
              id: m.gyms.id,
              name: m.gyms.name,
              slug: m.gyms.slug,
              ownerId: m.gyms.owner_id,
              address: m.gyms.address,
              city: m.gyms.city,
              latitude: Number(m.gyms.latitude),
              longitude: Number(m.gyms.longitude),
              radiusMeters: m.gyms.radius_meters || 200,
              qrCodeHash: m.gyms.qr_code_hash,
            }
          : undefined,
      }));
    } catch (err) {
      logger.error('GymRepository: Error fetching memberships', { err });
      return [];
    }
  }

  // ── 3. Gym Attendance Sessions (Check-in -> Active Session -> Check-out) ───
  async startAttendanceSession(
    gymId: string,
    userId: string,
    verificationMethod: GymVerificationMethod
  ): Promise<{ success: boolean; session?: GymAttendanceSession; error?: string }> {
    // 1. Check for existing active session
    const existingActive = await this.getActiveAttendanceSession(userId);
    if (existingActive) {
      return { success: false, error: "You're already checked in." };
    }

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const mockSession: GymAttendanceSession = {
        id: `mock-att-${Date.now()}`,
        gymId,
        userId,
        checkInAt: new Date().toISOString(),
        checkOutAt: null,
        durationSeconds: null,
        verificationMethod,
        checkoutMethod: null,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      platform.storage.setItem(`active_attendance_${userId}`, JSON.stringify(mockSession));
      return { success: true, session: mockSession };
    }

    try {
      const { data, error } = await supabase
        .from('gym_attendance_sessions')
        .insert({
          gym_id: gymId,
          user_id: userId,
          verification_method: verificationMethod,
          status: 'active',
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('uq_user_single_active_attendance')) {
          return { success: false, error: "You're already checked in." };
        }
        logger.error('GymRepository: Error starting attendance session', { error });
        return { success: false, error: error.message };
      }

      const created: GymAttendanceSession = {
        id: data.id,
        gymId: data.gym_id,
        userId: data.user_id,
        checkInAt: data.check_in_at,
        checkOutAt: data.check_out_at,
        durationSeconds: data.duration_seconds,
        verificationMethod: data.verification_method,
        checkoutMethod: data.checkout_method,
        status: data.status,
        createdAt: data.created_at,
      };

      platform.storage.setItem(`active_attendance_${userId}`, JSON.stringify(created));
      return { success: true, session: created };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start gym visit session';
      return { success: false, error: msg };
    }
  }

  async getActiveAttendanceSession(userId: string, gymId?: string): Promise<GymAttendanceSession | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`active_attendance_${userId}`);
      if (raw && typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.status === 'active') {
            if (!gymId || parsed.gymId === gymId) return parsed;
          }
        } catch { /* ignore */ }
      }
      return null;
    }

    try {
      let query = supabase
        .from('gym_attendance_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('check_in_at', { ascending: false })
        .limit(1);

      if (gymId) {
        query = query.eq('gym_id', gymId);
      }

      const { data, error } = await query.maybeSingle();
      if (error || !data) {
        platform.storage.removeItem(`active_attendance_${userId}`);
        return null;
      }

      const session: GymAttendanceSession = {
        id: data.id,
        gymId: data.gym_id,
        userId: data.user_id,
        checkInAt: data.check_in_at,
        checkOutAt: data.check_out_at,
        durationSeconds: data.duration_seconds,
        verificationMethod: data.verification_method,
        checkoutMethod: data.checkout_method,
        status: data.status,
        createdAt: data.created_at,
      };

      platform.storage.setItem(`active_attendance_${userId}`, JSON.stringify(session));
      return session;
    } catch {
      return null;
    }
  }

  async checkoutAttendanceSession(
    sessionId: string,
    userId: string,
    checkoutMethod: GymCheckoutMethod = 'manual_button'
  ): Promise<{ success: boolean; session?: GymAttendanceSession; error?: string }> {
    const now = new Date().toISOString();

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`active_attendance_${userId}`);
      if (raw && typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (sessionId && parsed.id !== sessionId) {
            return { success: false, error: 'Attendance session ID mismatch' };
          }
          const checkInTime = new Date(parsed.checkInAt).getTime();
          const checkOutTime = new Date(now).getTime();
          const durationSeconds = Math.max(0, Math.floor((checkOutTime - checkInTime) / 1000));

          const completed: GymAttendanceSession = {
            ...parsed,
            checkOutAt: now,
            checkoutMethod,
            status: 'completed',
            durationSeconds,
          };
          platform.storage.removeItem(`active_attendance_${userId}`);
          return { success: true, session: completed };
        } catch { /* ignore */ }
      }
      return { success: false, error: 'No active attendance session found' };
    }

    try {
      const { data, error } = await supabase
        .from('gym_attendance_sessions')
        .update({
          check_out_at: now,
          checkout_method: checkoutMethod,
          status: 'completed',
        })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error || !data) {
        logger.error('GymRepository: Error checking out attendance session', { error });
        return { success: false, error: error?.message || 'Checkout failed' };
      }

      platform.storage.removeItem(`active_attendance_${userId}`);

      return {
        success: true,
        session: {
          id: data.id,
          gymId: data.gym_id,
          userId: data.user_id,
          checkInAt: data.check_in_at,
          checkOutAt: data.check_out_at,
          durationSeconds: data.duration_seconds,
          verificationMethod: data.verification_method,
          checkoutMethod: data.checkout_method,
          status: data.status,
          createdAt: data.created_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      return { success: false, error: msg };
    }
  }

  async fetchGymActiveAttendance(gymId: string): Promise<GymAttendanceSession[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) return [];
    try {
      const { data, error } = await supabase
        .from('gym_attendance_sessions')
        .select(`
          *,
          profiles:user_id (
            display_name,
            avatar_url
          )
        `)
        .eq('gym_id', gymId)
        .eq('status', 'active')
        .order('check_in_at', { ascending: false });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        gymId: row.gym_id,
        userId: row.user_id,
        checkInAt: row.check_in_at,
        checkOutAt: row.check_out_at,
        durationSeconds: row.duration_seconds,
        verificationMethod: row.verification_method,
        checkoutMethod: row.checkout_method,
        status: row.status,
        createdAt: row.created_at,
        userProfile: row.profiles
          ? {
              displayName: row.profiles.display_name || 'Athlete',
              avatarUrl: row.profiles.avatar_url,
            }
          : undefined,
      }));
    } catch (err) {
      logger.error('GymRepository: Error fetching active gym attendance', { err });
      return [];
    }
  }

  // Backward compatibility alias for single check-in
  async recordCheckin(
    gymId: string,
    userId: string,
    verificationMethod: GymVerificationMethod
  ): Promise<{ success: boolean; checkin?: GymCheckin; error?: string }> {
    const res = await this.startAttendanceSession(gymId, userId, verificationMethod);
    if (!res.success) return { success: false, error: res.error };
    return {
      success: true,
      checkin: {
        id: res.session!.id,
        gymId: res.session!.gymId,
        userId: res.session!.userId,
        verificationMethod: res.session!.verificationMethod,
        checkedInAt: res.session!.checkInAt,
      },
    };
  }
}

export const gymRepository = new GymRepository();
