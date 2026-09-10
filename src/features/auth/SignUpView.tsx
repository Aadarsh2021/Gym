import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, User, AlertCircle, Dumbbell } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';
import { BRAND_CONFIG, PRODUCT_NAME } from '@/config/branding';
import { GoogleSignInButton } from '@/components/common/GoogleSignInButton';

export const SignUpView: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlError = params.get('error');
    if (urlError) {
      setError(urlError);
    }
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const result = await authService.signUp(email, password, displayName || BRAND_CONFIG.defaultAthleteName);
      if (!result.success) {
        setError(result.error || 'Signup failed.');
      } else {
        await refreshSession();
        // Redirect directly to the onboarding setup funnel
        navigate('/onboarding', { replace: true });
      }
    } catch {
      setError('Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-10) var(--space-4)', maxWidth: '440px' }}>
      <div className="card card-elevated" style={{ padding: 'var(--space-8) var(--space-6)' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary-text)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <Dumbbell size={24} strokeWidth={2.5} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-1)' }}>Join {PRODUCT_NAME}</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Start your personalized training split & nutrition tracking
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

        {/* Google OAuth CTA */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <GoogleSignInButton
            disabled={loading}
            onError={err => setError(err)}
          />
        </div>

        {/* Subtle Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: 'var(--space-4) 0 var(--space-5)',
            color: 'var(--text-muted)',
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ padding: '0 var(--space-3)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="input-group">
            <label className="label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                placeholder="Rohan Sharma"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={{ paddingLeft: '38px' }}
                autoComplete="name"
              />
              <User
                size={18}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="input"
                placeholder="athlete@domain.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ paddingLeft: '38px' }}
                autoComplete="email"
                required
              />
              <Mail
                size={18}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="label">Password (Min. 6 chars)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '38px' }}
                autoComplete="new-password"
                required
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
            {loading ? 'Creating Account...' : 'Continue to Setup →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Already have an account? </span>
          <Link to="/signin" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
