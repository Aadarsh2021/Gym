import React, { useState } from 'react';
import { authService } from '@/services/auth.service';

interface GoogleSignInButtonProps {
  onAuthStart?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  label?: string;
}

export const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onAuthStart,
  onError,
  disabled = false,
  label = 'Continue with Google',
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    onAuthStart?.();

    try {
      const result = await authService.signInWithGoogle();
      if (!result.success) {
        setLoading(false);
        onError?.(result.error || 'Google sign-in failed. Please try again.');
      }
      // If success, browser will redirect to Google accounts consent
    } catch {
      setLoading(false);
      onError?.('Google sign-in failed. Please try again.');
    }
  };

  return (
    <button
      type="button"
      id="google-signin-btn"
      onClick={handleClick}
      disabled={disabled || loading}
      className="btn btn-block"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-main)',
        fontWeight: 600,
        fontSize: '0.95rem',
        padding: '11px var(--space-4)',
        borderRadius: 'var(--radius-md)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.7 : 1,
        transition: 'background var(--transition-fast), border-color var(--transition-fast), transform 0.1s ease',
        minHeight: '44px',
      }}
      aria-label={label}
    >
      <GoogleIcon size={18} />
      <span>{loading ? 'Connecting to Google...' : label}</span>
    </button>
  );
};
