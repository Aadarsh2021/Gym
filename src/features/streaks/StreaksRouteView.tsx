import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StreaksView } from '@/features/streaks/StreaksView';

export const StreaksRouteView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';
  return <StreaksView userId={userId} />;
};
