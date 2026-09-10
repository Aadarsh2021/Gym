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

      return {
        user: { id: session.user.id, email: session.user.email },
        profile: profile
          ? {
              id: profile.id,
              displayName: profile.display_name || 'Warrior',
              unitSystem: profile.unit_system as 'metric' | 'imperial',
              timezone: profile.timezone,
              avatarUrl: profile.avatar_url,
            }
          : null,
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

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured) {
      localStorage.removeItem('mock_auth_user');
      return;
    }
    await supabase.auth.signOut();
  },
};
