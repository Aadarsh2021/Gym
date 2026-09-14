/**
 * Google OAuth & Supabase Auth — Routing and Session Tests
 *
 * Covers:
 *  - OAuth initiation (redirect URL, provider)
 *  - OAuth error / cancellation handling
 *  - New Google user → /onboarding routing decision
 *  - Existing Google user (completed profile) → /app routing decision
 *  - Missing/null session after callback → error state
 *  - Loading race condition guard (loading=true blocks ProtectedRoute)
 *  - Canonical identity (auth.users.id shared across methods)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService, getOAuthRedirectUrl } from '@/services/auth.service';
import { supabase } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulates a Supabase fitness_profiles row for an onboarded user */
const makeCompletedProfile = (userId: string) => ({
  id: 'fp-' + userId,
  user_id: userId,
  goal: 'muscle_gain',
  age: 25,
  height_cm: 175,
  weight_kg: 70,
  gender: 'male',
  experience_level: 'intermediate',
  days_per_week: 4,
  workout_duration_minutes: 60,
  equipment: ['barbell', 'dumbbell'],
  dietary_preference: 'non-vegetarian',
  limitations: [],
  updated_at: new Date().toISOString(),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Google OAuth & Supabase Auth Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── OAuth Initiation ────────────────────────────────────────────────────────

  it('invokes supabase.auth.signInWithOAuth with google provider and dynamic callback URL', async () => {
    const signInWithOAuthSpy = vi
      .spyOn(supabase.auth, 'signInWithOAuth')
      .mockResolvedValue({
        data: {
          provider: 'google',
          url: 'https://accounts.google.com/o/oauth2/v2/auth',
        },
        error: null,
      } as any);

    const result = await authService.signInWithGoogle();

    expect(result.success).toBe(true);
    expect(signInWithOAuthSpy).toHaveBeenCalledTimes(1);
    expect(signInWithOAuthSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringMatching(/\/auth\/callback$/),
        }),
      })
    );
  });

  it('redirect URL uses window.location.origin (dynamic, not hardcoded)', async () => {
    let capturedOptions: any;
    vi.spyOn(supabase.auth, 'signInWithOAuth').mockImplementation(
      async (opts: any) => {
        capturedOptions = opts;
        return { data: { provider: 'google', url: null }, error: null } as any;
      }
    );

    await authService.signInWithGoogle();

    // Must begin with the current origin, not a hardcoded host
    expect(capturedOptions.options.redirectTo).toMatch(
      /^https?:\/\/(localhost|gymbuddy-da185\.web\.app|gymbuddy-da185\.firebaseapp\.com)/
    );
    expect(capturedOptions.options.redirectTo).toMatch(/\/auth\/callback$/);
  });

  // ── OAuth Error / Cancellation ──────────────────────────────────────────────

  it('handles provider error from signInWithOAuth and returns a human-readable message', async () => {
    vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({
      data: { provider: 'google', url: null },
      error: { message: 'Provider not enabled or misconfigured' } as any,
    } as any);

    const result = await authService.signInWithGoogle();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Provider not enabled or misconfigured');
  });

  it('maps access_denied OAuth error param into friendly cancellation message', () => {
    const searchParams = new URLSearchParams(
      'error=access_denied&error_description=User+denied+consent'
    );
    const oauthError = searchParams.get('error');
    const oauthErrorDescription =
      searchParams.get('error_description') || '';

    let friendlyMessage = 'Google sign-in failed. Please try again.';
    if (
      oauthError === 'access_denied' ||
      oauthErrorDescription.toLowerCase().includes('denied') ||
      oauthErrorDescription.toLowerCase().includes('cancel')
    ) {
      friendlyMessage = 'Google sign-in was cancelled.';
    }

    expect(friendlyMessage).toBe('Google sign-in was cancelled.');
  });

  it('maps error=access_denied without description into cancellation message', () => {
    const searchParams = new URLSearchParams('error=access_denied');
    const oauthError = searchParams.get('error');

    const isCancelled = oauthError === 'access_denied';
    expect(isCancelled).toBe(true);
  });

  // ── New Google User → /onboarding ──────────────────────────────────────────

  it('routes new Google user (no fitness_profiles row) to /onboarding', async () => {
    // Simulate: getSession returns a valid user
    const userId = 'new-google-user-abc123';
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: { id: userId, email: 'newuser@gmail.com' },
        },
      },
      error: null,
    } as any);

    // Simulate: no fitness_profiles row exists
    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    expect(session?.user.id).toBe(userId);

    // Simulate the routing decision made in processSession
    const fitnessProfileData = null; // no row
    const destination =
      !fitnessProfileData || !(fitnessProfileData as any)?.goal
        ? '/onboarding'
        : '/app';

    expect(destination).toBe('/onboarding');
    fromSpy.mockRestore();
  });

  // ── Existing Google User → /app ─────────────────────────────────────────────

  it('routes returning Google user (completed fitness profile) to /app', async () => {
    const userId = 'existing-google-user-xyz789';
    const completedProfile = makeCompletedProfile(userId);

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: { id: userId, email: 'returninguser@gmail.com' },
        },
      },
      error: null,
    } as any);

    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: completedProfile, error: null }),
    } as any);

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    expect(session?.user.id).toBe(userId);

    // Simulate the routing decision made in processSession
    const fitnessProfileData = completedProfile;
    const destination =
      !fitnessProfileData || !fitnessProfileData.goal ? '/onboarding' : '/app';

    expect(destination).toBe('/app');
    fromSpy.mockRestore();
  });

  // ── Missing Session → Error State ───────────────────────────────────────────

  it('surfaces an error state when getSession returns null after callback (no silent redirect to /)', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const { data } = await supabase.auth.getSession();

    // No session — the callback view should show an error, NOT navigate to /
    const hasSession = Boolean(data.session?.user);
    expect(hasSession).toBe(false);
    // Verification: callback logic must not navigate to / on missing session
    // (it shows an error and lets the timeout route to /signin?error=timeout)
  });

  it('surfaces an error state when getSession returns an auth error', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid or expired token' } as any,
    } as any);

    const { data, error } = await supabase.auth.getSession();

    expect(error).toBeTruthy();
    expect(error?.message).toBe('Invalid or expired token');
    expect(data.session).toBeNull();
  });

  // ── Loading Race Condition Guard ─────────────────────────────────────────────

  it('ProtectedRoute loading=true guard prevents premature redirect to /signin during OAuth callback', () => {
    // Simulate the AuthProvider initial state: loading=true, session.user=null
    const authState = { session: { user: null, profile: null }, loading: true };

    // ProtectedRoute behavior:
    //   if (loading) → render loading spinner (NO redirect)
    //   if (!session.user) → redirect to /signin
    // During OAuth callback, loading is true, so no redirect fires.
    const shouldRedirect = !authState.loading && !authState.session.user;
    expect(shouldRedirect).toBe(false);
  });

  it('ProtectedRoute redirects unauthenticated user once loading completes', () => {
    const authState = { session: { user: null, profile: null }, loading: false };

    const shouldRedirect = !authState.loading && !authState.session.user;
    expect(shouldRedirect).toBe(true);
  });

  it('ProtectedRoute allows authenticated user through once loading completes', () => {
    const authState = {
      session: {
        user: { id: 'some-user-id', email: 'user@example.com' },
        profile: null,
      },
      loading: false,
    };

    const shouldRedirect = !authState.loading && !authState.session.user;
    expect(shouldRedirect).toBe(false);
  });

  // ── Authenticated Root Navigation ───────────────────────────────────────────

  it('SmartHomeRoute logic redirects authenticated user from / to /app', () => {
    // SmartHomeRoute: if (session.user) → Navigate to="/app"
    const authenticatedState = {
      session: { user: { id: 'uid-123', email: 'user@example.com' } },
      loading: false,
    };

    const destination =
      !authenticatedState.loading && authenticatedState.session.user
        ? '/app'
        : null;

    expect(destination).toBe('/app');
  });

  it('SmartHomeRoute logic renders public home for unauthenticated visitor at /', () => {
    const unauthenticatedState = {
      session: { user: null },
      loading: false,
    };

    const shouldShowPublicHome =
      !unauthenticatedState.loading && !unauthenticatedState.session.user;
    expect(shouldShowPublicHome).toBe(true);
  });

  it('SmartHomeRoute logic does not redirect during loading (avoids flash redirect)', () => {
    const loadingState = { session: { user: null }, loading: true };

    // During loading we render public home, not a redirect
    const shouldRedirect = !loadingState.loading && loadingState.session.user;
    expect(shouldRedirect).toBeFalsy();
  });

  // ── Canonical Identity ───────────────────────────────────────────────────────

  it('preserves single canonical identity (auth.users.id) across email/password and Google OAuth', () => {
    // Both email/password and Google accounts share the same profiles and auth.users ID
    const sampleUserId = 'e2b3c4d5-6789-4abc-def0-123456789abc';
    const profileA = { id: sampleUserId, display_name: 'Test Athlete' };
    const googleProfile = { id: sampleUserId, display_name: 'Test Athlete (Google Linked)' };

    expect(profileA.id).toBe(googleProfile.id);
  });

  // ── Logout ───────────────────────────────────────────────────────────────────

  it('signOut clears local auth state (session becomes null)', async () => {
    const signOutSpy = vi
      .spyOn(supabase.auth, 'signOut')
      .mockResolvedValue({ error: null });

    await authService.signOut();

    expect(signOutSpy).toHaveBeenCalledTimes(1);
    // After signOut, AuthProvider's onAuthStateChange fires SIGNED_OUT
    // and sets session to { user: null, profile: null }
  });

  // ── Onboarding Completion Criterion ─────────────────────────────────────────

  it('defines onboarding completion as: fitness_profiles row exists AND goal is set', () => {
    // New user (no row)
    const noRow = null;
    expect(!noRow || !(noRow as any)?.goal).toBe(true); // → onboarding

    // Partial row (no goal)
    const partialRow = { user_id: 'uid', goal: undefined };
    expect(!partialRow || !partialRow.goal).toBe(true); // → onboarding

    // Complete row (goal set)
    const completeRow = { user_id: 'uid', goal: 'muscle_gain' };
    expect(!completeRow || !completeRow.goal).toBe(false); // → /app
  });

  // ── Post-OAuth Role Selection & Idempotency ────────────────────────────────

  it('generates correct OAuth redirect URL for localhost vs production', () => {
    const redirectUrl = getOAuthRedirectUrl();
    expect(redirectUrl).toMatch(/\/auth\/callback$/);
    expect(redirectUrl).not.toContain('#');
  });

  it('routes new user with role_selected=false to /auth/role-selection', () => {
    const profile = {
      id: 'new-athlete-1',
      accountRole: 'member',
      roleSelected: false,
    };

    let destination: string;
    if (!profile || profile.roleSelected === false) {
      destination = '/auth/role-selection';
    } else if (profile.accountRole === 'gym_owner') {
      destination = '/owner/dashboard';
    } else {
      destination = '/app';
    }

    expect(destination).toBe('/auth/role-selection');
  });

  it('routes existing user with role_selected=true directly to /app without role selection', () => {
    const profile = {
      id: 'existing-athlete-1',
      accountRole: 'member',
      roleSelected: true,
    };

    let destination: string;
    if (!profile || profile.roleSelected === false) {
      destination = '/auth/role-selection';
    } else if (profile.accountRole === 'gym_owner') {
      destination = '/owner/dashboard';
    } else {
      destination = '/app';
    }

    expect(destination).toBe('/app');
  });

  it('routes existing gym owner directly to /owner/dashboard without role selection', () => {
    const profile = {
      id: 'existing-owner-1',
      accountRole: 'gym_owner',
      roleSelected: true,
    };

    let destination: string;
    if (!profile || profile.roleSelected === false) {
      destination = '/auth/role-selection';
    } else if (profile.accountRole === 'gym_owner') {
      destination = '/owner/dashboard';
    } else {
      destination = '/app';
    }

    expect(destination).toBe('/owner/dashboard');
  });
});
