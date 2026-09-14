import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { profileService, ensureUserProfile } from '@/services/profile.service';
import { Dumbbell, AlertCircle } from 'lucide-react';
import { PRODUCT_NAME } from '@/config/branding';

/**
 * AuthCallbackView
 *
 * Landing page for the Supabase OAuth redirect.
 * Supabase's detectSessionInUrl:true (configured in supabase.ts) automatically
 * exchanges the #access_token hash for a session. This component waits for that
 * exchange to complete via onAuthStateChange (SIGNED_IN / INITIAL_SESSION events),
 * then checks the user's onboarding status and routes accordingly.
 *
 * Post-Auth Routing Logic:
 *   1. Check account_role & role_selected:
 *      - If role_selected is false: /auth/role-selection
 *   2. If gym_owner:
 *      - /owner/dashboard
 *   3. If member:
 *      - fitness_profiles row with goal set → /app (existing user)
 *      - no row or no goal                  → /onboarding (new user)
 */
export const AuthCallbackView: React.FC = () => {
  const [statusMessage, setStatusMessage] = useState('Verifying Google authentication...');
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Prevent double-navigation if both the subscription and the fallback poll fire
  const handledRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // ── 1. Check for OAuth error parameters in the callback URL ──────────────
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(
      location.hash.startsWith('#') ? location.hash.substring(1) : ''
    );

    const oauthError =
      searchParams.get('error') || hashParams.get('error');
    const oauthErrorDescription =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      '';

    if (oauthError) {
      const isCancelled =
        oauthError === 'access_denied' ||
        oauthErrorDescription.toLowerCase().includes('denied') ||
        oauthErrorDescription.toLowerCase().includes('cancel');

      const friendlyMessage = isCancelled
        ? 'Google sign-in was cancelled.'
        : 'Google sign-in failed. Please try again.';

      setError(friendlyMessage);
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          navigate(`/signin?error=${encodeURIComponent(friendlyMessage)}`, {
            replace: true,
          });
        }
      }, 1800);
      return () => {
        isMountedRef.current = false;
        clearTimeout(timer);
      };
    }

    // ── 2. Mock mode (no Supabase configured) ────────────────────────────────
    if (!isSupabaseConfigured) {
      navigate('/app', { replace: true });
      return () => {
        isMountedRef.current = false;
      };
    }

    // ── 3. Core: wait for Supabase to complete the token exchange ────────────
    const processSession = async (userId: string) => {
      if (handledRef.current) return;
      handledRef.current = true;

      try {
        if (isMountedRef.current) {
          setStatusMessage('Setting up your athlete profile...');
        }

        // 1. Ensure profile exists in public.profiles
        await ensureUserProfile(userId, false);

        // 2. Fetch profile to check role selection state
        const profile = await profileService.getProfile(userId);

        if (!isMountedRef.current) return;

        // 3. Brand-new user: role not yet explicitly selected
        if (!profile || profile.roleSelected === false) {
          navigate('/auth/role-selection', { replace: true });
          return;
        }

        // 4. Gym Owner: route to owner console
        if (profile.accountRole === 'gym_owner') {
          navigate('/owner/dashboard', { replace: true });
          return;
        }

        // 5. Member: verify fitness profile setup
        const fitnessProfile = await profileService.getFitnessProfile(userId);
        if (!isMountedRef.current) return;

        if (!fitnessProfile || !fitnessProfile.goal) {
          // New personal user — begin fitness onboarding
          navigate('/onboarding', { replace: true });
        } else {
          // Returning personal user with completed profile — go directly to app
          navigate('/app', { replace: true });
        }
      } catch {
        // Fallback to role selection
        if (isMountedRef.current && !handledRef.current) {
          handledRef.current = true;
          navigate('/auth/role-selection', { replace: true });
        }
      }
    };

    // Subscribe to auth state changes — fires after token exchange completes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session?.user &&
        (event === 'SIGNED_IN' ||
          event === 'INITIAL_SESSION' ||
          event === 'TOKEN_REFRESHED')
      ) {
        processSession(session.user.id);
      }
    });

    // Fallback poll: in case the exchange completed before the subscription
    // was registered (e.g. fast network or cached session)
    const pollTimer = setTimeout(async () => {
      if (handledRef.current || !isMountedRef.current) return;
      try {
        const { data, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          if (isMountedRef.current && !handledRef.current) {
            handledRef.current = true;
            setError('Google authentication failed. Please try again.');
          }
          return;
        }
        if (data?.session?.user) {
          processSession(data.session.user.id);
        }
      } catch {
        // Ignore — timeout below will catch persistent failures
      }
    }, 150);

    // Timeout: if nothing resolves within 10 seconds, show an error
    const timeoutTimer = setTimeout(() => {
      if (!handledRef.current && isMountedRef.current) {
        handledRef.current = true;
        setError(
          'Authentication timed out. Please check your connection and try again.'
        );
      }
    }, 10000);

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      clearTimeout(pollTimer);
      clearTimeout(timeoutTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally empty deps — this runs once on mount for the callback URL.

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

        <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-2)' }}>
          {PRODUCT_NAME}
        </h2>

        {error ? (
          <div>
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
                marginBottom: 'var(--space-4)',
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            <Link
              to="/signin"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Return to Sign In
            </Link>
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {statusMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
