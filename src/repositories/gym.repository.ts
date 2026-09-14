import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Gym, GymMembership, GymCheckin, GymVerificationMethod } from '@/types/gym.types';
import { logger } from '@/lib/logger';

export class GymRepository {
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
        latitude: Number(g.latitude),
        longitude: Number(g.longitude),
        radiusMeters: g.radius_meters || 200,
        qrCodeHash: g.qr_code_hash,
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
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        radiusMeters: data.radius_meters || 200,
        qrCodeHash: data.qr_code_hash,
        createdAt: data.created_at,
      };
    } catch {
      return null;
    }
  }

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

  async recordCheckin(
    gymId: string,
    userId: string,
    verificationMethod: GymVerificationMethod
  ): Promise<{ success: boolean; checkin?: GymCheckin; error?: string }> {
    if (!isSupabaseConfigured) {
      return {
        success: true,
        checkin: {
          id: `mock-chk-${Date.now()}`,
          gymId,
          userId,
          verificationMethod,
          checkedInAt: new Date().toISOString(),
        },
      };
    }

    try {
      const { data, error } = await supabase
        .from('gym_checkins')
        .insert({
          gym_id: gymId,
          user_id: userId,
          verification_method: verificationMethod,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('uq_gym_user_daily_checkin') || error.message.includes('duplicate key')) {
          return { success: false, error: 'You have already checked in to this gym today.' };
        }
        logger.error('GymRepository: Error recording gym check-in', { error });
        return { success: false, error: error.message };
      }

      return {
        success: true,
        checkin: {
          id: data.id,
          gymId: data.gym_id,
          userId: data.user_id,
          verificationMethod: data.verification_method,
          checkedInAt: data.checked_in_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed';
      return { success: false, error: msg };
    }
  }
}

export const gymRepository = new GymRepository();
