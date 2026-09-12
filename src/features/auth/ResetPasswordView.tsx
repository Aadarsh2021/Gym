import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const ResetPasswordView: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setValidSession(true);
          setCheckingToken(false);
        }
        return;
      }

      try {
        // Supabase may establish session from URL hash tokens automatically
        const { data: { session } } = await supabase.auth.getSession();
        
        // Also listen for auth state changes specifically for PASSWORD_RECOVERY
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
          if (event === 'PASSWORD_RECOVERY') {
            if (mounted) setValidSession(true);
          }
        });

        if (session) {
          if (mounted) setValidSession(true);
        } else {
          // Check if hash has access_token
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            if (mounted) setValidSession(true);
          } else {
            if (mounted) setValidSession(false);
          }
        }

        return () => {
          subscription.unsubscribe();
        };
      } catch {
        if (mounted) setValidSession(false);
      } finally {
        if (mounted) setCheckingToken(false);
      }
    };

    checkRecoverySession();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.updatePassword(password);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/signin', { replace: true });
        }, 2500);
      } else {
        setError(res.error || 'Failed to update password. Your recovery link may have expired.');
      }
    } catch {
      setError('Failed to update password. Please try requesting a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Verifying recovery link...</p>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-10) var(--space-4)', maxWidth: '440px' }}>
      <div className="card card-elevated" style={{ padding: 'var(--space-8) var(--space-6)' }}>
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <KeyRound size={22} strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-1)' }}>Set New Password</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Enter your new secure password below
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              background: 'rgba(255, 77, 77, 0.15)',
              border: '1px solid var(--accent-fire)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-fire)',
              fontSize: '0.85rem',
              marginBottom: 'var(--space-4)',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-success-muted)',
                color: 'var(--color-success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-3)',
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Password Updated!</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
              Your password has been updated successfully. Redirecting you to sign in...
            </p>
            <Link to="/signin" className="btn btn-primary btn-block" style={{ textDecoration: 'none' }}>
              Sign In Now
            </Link>
          </div>
        ) : !validSession ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 77, 77, 0.15)',
                color: 'var(--accent-fire)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-3)',
              }}
            >
              <AlertCircle size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Invalid or Expired Link</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
              This password recovery link has expired or has already been used. Please request a fresh link.
            </p>
            <Link to="/forgot-password" className="btn btn-primary btn-block" style={{ textDecoration: 'none' }}>
              Request New Reset Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="input-group">
              <label className="label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                <Lock
                  size={18}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                <Lock
                  size={18}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading ? 'Saving Password...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
