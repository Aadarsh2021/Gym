import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { nutritionService } from '@/services/nutrition.service';
import { NutritionProfile } from '@/types/nutrition.types';
import { NutritionView } from './NutritionView';

export const NutritionRouteView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const data = await nutritionService.getNutritionProfile(userId);
        if (isMounted) setProfile(data);
      } catch {
        // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading nutrition profile...</p>
      </div>
    );
  }

  return <NutritionView nutritionProfile={profile} />;
};
