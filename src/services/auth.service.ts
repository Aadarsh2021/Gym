import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserProfile } from '@/types/user.types';
import { logger } from '@/lib/logger';

export interface AuthSession {
  user: {
    id: string;
    email?: string;
  } | null;
  profile: UserProfile | null;
}

export const authService = {
  async getSession(): Promise<AuthSession> {
    if (!isSupabaseConfigured) {
      // Local preview fallback
      const localUser = localStorage.getItem('mock_auth_user');
      if (localUser) {
        const parsed = JSON.parse(localUser);
        return {
          user: { id: parsed.id, email: parsed.email },
          profile: {
            id: parsed.id,
            displayName: parsed.displayName || 'Fitness Warrior',
            unitSystem: 'metric',
            timezone: 'Asia/Kolkata',
          },
        };
      }
      return { user: null, profile: null };
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        return { user: null, profile: null };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      const meta = session.user.user_metadata || {};
      const resolvedName = meta.full_name || meta.name || profile?.display_name || 'Athlete';
      const resolvedAvatar = profile?.avatar_url || meta.avatar_url || meta.picture || null;

      // Sync display name and avatar to profiles if present in Google metadata
      if (profile && meta.full_name && (!profile.avatar_url || profile.display_name === session.user.email?.split('@')[0])) {
        supabase
          .from('profiles')
          .update({
            display_name: meta.full_name,
            avatar_url: resolvedAvatar,
          })
          .eq('id', session.user.id)
          .then();
      }

      return {
        user: { id: session.user.id, email: session.user.email },
        profile: profile
          ? {
              id: profile.id,
              displayName: resolvedName,
              unitSystem: profile.unit_system as 'metric' | 'imperial',
              timezone: profile.timezone,
              avatarUrl: resolvedAvatar,
            }
          : {
              id: session.user.id,
              displayName: resolvedName,
              unitSystem: 'metric',
              timezone: 'Asia/Kolkata',
              avatarUrl: resolvedAvatar,
            },
      };
    } catch (err) {
      logger.error('Error fetching session', { err });
      return { user: null, profile: null };
    }
  },

  async signUp(email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      const mockId = 'mock-user-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('mock_auth_user', JSON.stringify({ id: mockId, email, displayName }));
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName, timezone: 'Asia/Kolkata' },
        },
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      return { success: false, error: message };
    }
  },

  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      const mockId = 'mock-user-12345';
      localStorage.setItem('mock_auth_user', JSON.stringify({ id: mockId, email, displayName: 'Fitness Explorer' }));
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: message };
    }
  },

  async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      const mockId = 'mock-google-user-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('mock_auth_user', JSON.stringify({
        id: mockId,
        email: 'athlete.google@example.com',
        displayName: 'Google Athlete'
      }));
      return { success: true };
    }

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gymbuddy-da185.web.app';
      const redirectUrl = `${origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        logger.error('Google OAuth initialization error', { error });
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      logger.error('Google OAuth unexpected exception', { err });
      const message = err instanceof Error ? err.message : 'Google sign-in initiation failed';
      return { success: false, error: message };
    }
  },

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured) {
      localStorage.removeItem('mock_auth_user');
      return;
    }
    await supabase.auth.signOut();
  },
};
