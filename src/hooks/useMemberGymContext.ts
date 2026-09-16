import { useContext } from 'react';
import { MemberGymContext, MemberGymContextValue } from '@/context/MemberGymContext';

export function useMemberGymContext(): MemberGymContextValue {
  const context = useContext(MemberGymContext);
  if (!context) {
    throw new Error('useMemberGymContext must be used within a MemberGymProvider');
  }
  return context;
}

export type { MemberGymContextValue };
