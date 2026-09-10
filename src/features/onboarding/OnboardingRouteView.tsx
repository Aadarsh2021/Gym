import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profile.service';
import { FitnessProfile } from '@/types/user.types';
import { OnboardingWizard } from './OnboardingWizard';

export const OnboardingRouteView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();

  const [existingProfile, setExistingProfile] = useState<FitnessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const profile = await profileService.getFitnessProfile(userId);
        if (isMounted) setExistingProfile(profile);
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
        <p style={{ color: 'var(--text-muted)' }}>Loading setup...</p>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) var(--space-12)' }}>
      <OnboardingWizard
        userId={userId}
        existingProfile={existingProfile}
        onComplete={() => {
          // Explicit funnel: Onboarding -> Plan Builder
          navigate('/plan/build');
        }}
      />
    </div>
  );
};
