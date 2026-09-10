import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import React from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { authService, AuthSession } from '@/services/auth.service';

interface AuthContextType {
  session: AuthSession;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({ user: null, profile: null });
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    const s = await authService.getSession();
    setSession(s);
  };

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const s = await authService.getSession();
      if (isMounted) {
        setSession(s);
        setLoading(false);
      }
    }

    init();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!newSession?.user) {
          if (isMounted) setSession({ user: null, profile: null });
        } else {
          await refreshSession();
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }
  }, []);

  const handleSignOut = async () => {
    await authService.signOut();
    setSession({ user: null, profile: null });
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { session, loading, refreshSession, signOut: handleSignOut } },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
