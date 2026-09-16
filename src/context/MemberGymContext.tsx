import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Gym, GymMembership, MemberGymMode, MemberGymContextState } from '@/types/gym.types';
import { gymContextService } from '@/services/gym-context.service';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export interface MemberGymContextValue {
  mode: MemberGymMode;
  activeGym: Gym | null;
  activeMembership: GymMembership | null;
  memberships: GymMembership[];
  customGymLocation?: { latitude: number; longitude: number; radiusMeters: number };
  isLoading: boolean;
  error: string | null;
  refreshContext: () => Promise<void>;
  switchActiveGym: (gymId: string) => void;
}

export const MemberGymContext = createContext<MemberGymContextValue | undefined>(undefined);

export const MemberGymProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const userId = session.user?.id || '';

  const [contextState, setContextState] = useState<MemberGymContextState>({
    mode: 'home',
    activeGym: null,
    activeMembership: null,
    memberships: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshContext = useCallback(async () => {
    if (!userId || userId === 'guest-user') {
      setContextState({
        mode: 'home',
        activeGym: null,
        activeMembership: null,
        memberships: [],
      });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const state = await gymContextService.resolveMemberGymContext(userId);
      setContextState(state);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve member gym context';
      logger.error('MemberGymProvider: Error refreshing context', { err });
      setError(msg);
      // Preserve current context state on refresh error
      setContextState(prev => prev);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  const switchActiveGym = useCallback(
    (gymId: string) => {
      if (!userId || !gymId) return;
      gymContextService.setActiveGymPreference(userId, gymId);
      refreshContext();
    },
    [userId, refreshContext]
  );

  const value: MemberGymContextValue = {
    mode: contextState.mode,
    activeGym: contextState.activeGym,
    activeMembership: contextState.activeMembership,
    memberships: contextState.memberships,
    customGymLocation:
      contextState.mode === 'non_integrated' ? contextState.customGymLocation : undefined,
    isLoading,
    error,
    refreshContext,
    switchActiveGym,
  };

  return <MemberGymContext.Provider value={value}>{children}</MemberGymContext.Provider>;
};
