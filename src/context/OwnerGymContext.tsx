import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Gym } from '@/types/gym.types';
import { gymRepository } from '@/repositories/gym.repository';
import { useAuth } from '@/hooks/useAuth';
import { platform } from '@/platform';
import { logger } from '@/lib/logger';

export interface CreateGymInput {
  name: string;
  slug?: string;
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  contactNumber?: string;
  email?: string;
  description?: string;
  openingTime?: string;
  closingTime?: string;
  weeklySchedule?: Gym['weeklySchedule'];
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  logoUrl?: string;
  coverImageUrl?: string;
}

export interface OwnerGymContextValue {
  ownedGyms: Gym[];
  activeGym: Gym | null;
  loading: boolean;
  error: string | null;
  switchActiveGym: (gymId: string) => void;
  refreshGyms: () => Promise<void>;
  createGym: (data: CreateGymInput) => Promise<{ success: boolean; gym?: Gym; error?: string }>;
  updateGym: (gymId: string, updates: Partial<Gym>) => Promise<{ success: boolean; gym?: Gym; error?: string }>;
}

const OwnerGymContext = createContext<OwnerGymContextValue | undefined>(undefined);

export const OwnerGymProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const userId = session.user?.id || '';

  const [ownedGyms, setOwnedGyms] = useState<Gym[]>([]);
  const [activeGym, setActiveGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshGyms = useCallback(async () => {
    if (!userId) {
      setOwnedGyms([]);
      setActiveGym(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const gyms = await gymRepository.fetchOwnerGyms(userId);
      setOwnedGyms(gyms);

      const savedActiveId = platform.storage.getItem(`owner_active_gym_${userId}`);
      if (savedActiveId && typeof savedActiveId === 'string') {
        const matching = gyms.find(g => g.id === savedActiveId);
        if (matching) {
          setActiveGym(matching);
          setLoading(false);
          return;
        }
      }

      if (gyms.length > 0) {
        setActiveGym(gyms[0]);
      } else {
        setActiveGym(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch facilities';
      setError(msg);
      logger.error('OwnerGymContext: Error loading gyms', { err });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshGyms();
  }, [refreshGyms]);

  const switchActiveGym = useCallback((gymId: string) => {
    const target = ownedGyms.find(g => g.id === gymId);
    if (target) {
      setActiveGym(target);
      if (userId) {
        platform.storage.setItem(`owner_active_gym_${userId}`, target.id);
      }
    }
  }, [ownedGyms, userId]);

  const createGym = useCallback(async (data: CreateGymInput): Promise<{ success: boolean; gym?: Gym; error?: string }> => {
    if (!userId) {
      return { success: false, error: 'Authentication required to register a facility' };
    }

    try {
      // 1. Resolve unique slug
      let finalSlug = data.slug?.trim();
      if (!finalSlug) {
        finalSlug = await gymRepository.generateUniqueSlug(data.name);
      } else {
        // Normalize user slug
        finalSlug = finalSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }

      // 2. Generate secure QR verification hash
      const qrCodeHash = `fitboost_qr_${finalSlug}_${Date.now().toString(36)}`;

      // 3. Coordinate fallbacks
      const lat = typeof data.latitude === 'number' && !isNaN(data.latitude) ? data.latitude : 19.0760;
      const lng = typeof data.longitude === 'number' && !isNaN(data.longitude) ? data.longitude : 72.8777;

      const result = await gymRepository.createGym({
        name: data.name.trim(),
        slug: finalSlug,
        ownerId: userId, // Server-enforced via auth.uid()
        address: data.address.trim(),
        city: data.city.trim(),
        state: data.state?.trim() || undefined,
        pincode: data.pincode?.trim() || undefined,
        contactNumber: data.contactNumber?.trim() || undefined,
        email: data.email?.trim() || undefined,
        description: data.description?.trim() || undefined,
        openingTime: data.openingTime || '06:00',
        closingTime: data.closingTime || '22:00',
        weeklySchedule: data.weeklySchedule,
        latitude: lat,
        longitude: lng,
        radiusMeters: data.radiusMeters && data.radiusMeters > 0 ? data.radiusMeters : 200,
        qrCodeHash,
        logoUrl: data.logoUrl?.trim() || undefined,
        coverImageUrl: data.coverImageUrl?.trim() || undefined,
      });

      if (result.success && result.gym) {
        await refreshGyms();
        setActiveGym(result.gym);
        if (userId) {
          platform.storage.setItem(`owner_active_gym_${userId}`, result.gym.id);
        }
      }

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Facility creation failed';
      return { success: false, error: msg };
    }
  }, [userId, refreshGyms]);

  const updateGym = useCallback(async (gymId: string, updates: Partial<Gym>): Promise<{ success: boolean; gym?: Gym; error?: string }> => {
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }
    const res = await gymRepository.updateGym(gymId, userId, updates);
    if (res.success && res.gym) {
      await refreshGyms();
      if (activeGym?.id === gymId) {
        setActiveGym(res.gym);
      }
    }
    return res;
  }, [userId, refreshGyms, activeGym]);

  return (
    <OwnerGymContext.Provider
      value={{
        ownedGyms,
        activeGym,
        loading,
        error,
        switchActiveGym,
        refreshGyms,
        createGym,
        updateGym,
      }}
    >
      {children}
    </OwnerGymContext.Provider>
  );
};

export const useOwnerGym = (): OwnerGymContextValue => {
  const context = useContext(OwnerGymContext);
  if (!context) {
    throw new Error('useOwnerGym must be used within an OwnerGymProvider');
  }
  return context;
};
