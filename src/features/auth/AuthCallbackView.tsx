import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { profileService } from '@/services/profile.service';
import { useAuth } from '@/hooks/useAuth';
import { Dumbbell, AlertCircle } from 'lucide-react';
import { PRODUCT_NAME } from '@/config/branding';

export const AuthCallbackView: React.FC = () => {
  const [statusMessage, setStatusMessage] = useState('Verifying Google authentication...');
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();

  useEffect(() => {
    let isMounted = true;
    let handled = false;

    // 1. Inspect URL parameters for OAuth errors (both hash and search params)
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.startsWith('#') ? location.hash.substring(1) : location.hash);

    const oauthError = searchParams.get('error') || hashParams.get('error');
    const oauthErrorDescription = searchParams.get('error_description') || hashParams.get('error_description') || '';

    if (oauthError) {
      handled = true;
      let friendlyMessage = 'Google sign-in failed. Please try again.';
      if (
        oauthError === 'access_denied' ||
        oauthErrorDescription.toLowerCase().includes('denied') ||
        oauthErrorDescription.toLowerCase().includes('cancel')
      ) {
        friendlyMessage = 'Google sign-in was cancelled.';
      }
      setError(friendlyMessage);
      setTimeout(() => {
        if (isMounted) {
          navigate(`/signin?error=${encodeURIComponent(friendlyMessage)}`, { replace: true });
        }
      }, 1500);
      return;
    }

    if (!isSupabaseConfigured) {
      handled = true;
      navigate('/app', { replace: true });
      return;
    }

    // 2. Process Session and Route to Onboarding vs App
    const processSession = async (userId: string) => {
      if (handled) return;
      handled = true;

      try {
        if (isMounted) setStatusMessage('Preparing your athlete profile...');
        await refreshSession();

        // Check if user has already completed onboarding
        const fitnessProfile = await profileService.getFitnessProfile(userId);

        if (!isMounted) return;

        if (!fitnessProfile || !fitnessProfile.goal) {
          // New Google athlete -> Start onboarding
          navigate('/onboarding', { replace: true });
        } else {
          // Existing athlete -> Enter app dashboard directly
          navigate('/app', { replace: true });
        }
      } catch {
        if (isMounted) {
          // Fallback safely to onboarding if profile check throws
          navigate('/onboarding', { replace: true });
        }
      }
    };

    // 3. Check for existing or immediate session
    supabase.auth.getSession().then(({ data, error: sessionErr }) => {
      if (sessionErr) {
        if (isMounted) {
          setError('Google authentication failed. Please try again.');
          setTimeout(() => navigate('/signin?error=auth_failed', { replace: true }), 1500);
        }
        return;
      }

      if (data?.session?.user) {
        processSession(data.session.user.id);
      }
    });

    // 4. Subscribe to auth state change (handles asynchronous PKCE / hash token exchange)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        await processSession(session.user.id);
      }
    });

    // 5. Fallback Timeout
    const timeoutTimer = setTimeout(() => {
      if (!handled && isMounted) {
        setError('Authentication timed out. Please try signing in again.');
        setTimeout(() => navigate('/signin?error=timeout', { replace: true }), 2000);
      }
    }, 6000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeoutTimer);
    };
  }, [location, navigate, refreshSession]);

  return (
    <div
      className="container animate-fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: 'var(--space-8) var(--space-4)',
      }}
    >
      <div
        className="card card-elevated"
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: 'var(--space-8) var(--space-6)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary-text)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Dumbbell size={28} strokeWidth={2.5} />
        </div>

        <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-2)' }}>{PRODUCT_NAME}</h2>

        {error ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              background: 'rgba(255, 77, 77, 0.15)',
              border: '1px solid var(--accent-fire)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-fire)',
              fontSize: '0.9rem',
              marginTop: 'var(--space-3)',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : (
          <div>
            <div
              className="spin"
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid var(--border-subtle)',
                borderTopColor: 'var(--accent-primary)',
                borderRadius: '50%',
                margin: 'var(--space-5) auto',
              }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{statusMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
