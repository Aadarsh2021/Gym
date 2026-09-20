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
  const isMountedRef = React.useRef(true);
  const isRefreshingRef = React.useRef(false);

  const refreshSession = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const s = await authService.getSession();
      if (isMountedRef.current) {
        setSession(s);
      }
    } finally {
      isRefreshingRef.current = false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    async function init() {
      const s = await authService.getSession();
      if (isMountedRef.current) {
        setSession(s);
        setLoading(false);
      }
    }

    init();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!newSession?.user || event === 'SIGNED_OUT') {
          if (isMountedRef.current) {
            setSession({ user: null, profile: null });
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refreshed: update user identity without triggering cascading full profile reload
          if (isMountedRef.current) {
            setSession(prev => {
              if (prev.user?.id === newSession.user.id) {
                return {
                  ...prev,
                  user: { id: newSession.user.id, email: newSession.user.email },
                };
              }
              refreshSession();
              return prev;
            });
          }
        } else {
          await refreshSession();
        }
      });

      return () => {
        isMountedRef.current = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMountedRef.current = false;
    };
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
