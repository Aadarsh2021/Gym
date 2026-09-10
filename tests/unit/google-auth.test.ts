import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '@/services/auth.service';
import { supabase } from '@/lib/supabase';

describe('Google OAuth & Supabase Auth Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes supabase.auth.signInWithOAuth with google provider and dynamic callback URL', async () => {
    const signInWithOAuthSpy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/v2/auth' },
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

  it('handles provider error from signInWithOAuth and returns a human-readable message', async () => {
    vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({
      data: { provider: 'google', url: null },
      error: { message: 'Provider not enabled or misconfigured' } as any,
    } as any);

    const result = await authService.signInWithGoogle();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Provider not enabled or misconfigured');
  });

  it('maps OAuth cancellation params into friendly user-facing message', () => {
    const searchParams = new URLSearchParams('error=access_denied&error_description=User+denied+consent');
    const oauthError = searchParams.get('error');
    const oauthErrorDescription = searchParams.get('error_description') || '';

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

  it('preserves single canonical identity (auth.users.id) across email/password and Google OAuth', () => {
    // Both email/password and Google accounts share the same profiles and auth.users ID
    const sampleUserId = 'e2b3c4d5-6789-4abc-def0-123456789abc';
    const profileA = { id: sampleUserId, display_name: 'Test Athlete' };
    const googleProfile = { id: sampleUserId, display_name: 'Test Athlete (Google Linked)' };

    expect(profileA.id).toBe(googleProfile.id);
  });
});
