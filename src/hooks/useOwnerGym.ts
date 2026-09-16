import { useContext } from 'react';
import { OwnerGymContext, OwnerGymContextValue } from '@/context/OwnerGymContext';

export function useOwnerGym(): OwnerGymContextValue {
  const context = useContext(OwnerGymContext);
  if (!context) {
    throw new Error('useOwnerGym must be used within an OwnerGymProvider');
  }
  return context;
}

export type { OwnerGymContextValue };
