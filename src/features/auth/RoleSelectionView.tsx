import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profile.service';
import { Dumbbell, Building2, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { PRODUCT_NAME } from '@/config/branding';

export const RoleSelectionView: React.FC = () => {
  const { session, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'member' | 'gym_owner' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectRole = async (role: 'member' | 'gym_owner') => {
    if (submitting) return;
    const userId = session.user?.id;
    if (!userId) {
      navigate('/signin', { replace: true });
      return;
    }

    setSelectedRole(role);
    setSubmitting(true);
    setError(null);

    try {
      const res = await profileService.selectAccountRole(userId, role);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update account role');
      }

      await refreshSession();

      if (role === 'member') {
        const fitnessProfile = await profileService.getFitnessProfile(userId);
        if (!fitnessProfile || !fitnessProfile.goal) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/app', { replace: true });
        }
      } else {
        // Gym Owner flow
        navigate('/owner/onboarding', { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save account role. Please try again.';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="container animate-fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: 'var(--space-8) var(--space-4)',
      }}
    >
      <div
        style={{
          maxWidth: '680px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: '999px',
            background: 'var(--bg-glass-card)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            marginBottom: 'var(--space-4)',
          }}
        >
          <span>Welcome to {PRODUCT_NAME}</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: 'var(--space-3)',
          }}
        >
          What are you using {PRODUCT_NAME} as?
        </h1>

        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '1.05rem',
            maxWidth: '520px',
            margin: '0 auto var(--space-8)',
          }}
        >
          Select your primary account path. You can track independent workouts or manage your physical gym ecosystem.
        </p>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              background: 'rgba(255, 77, 77, 0.15)',
              border: '1px solid var(--accent-fire)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-fire)',
              fontSize: '0.9rem',
              marginBottom: 'var(--space-6)',
              textAlign: 'left',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-5)',
            textAlign: 'left',
          }}
        >
          {/* Card 1: Personal / Fitness User */}
          <button
            type="button"
            onClick={() => handleSelectRole('member')}
            disabled={submitting}
            className="card card-elevated"
            style={{
              cursor: submitting ? 'not-allowed' : 'pointer',
              border: selectedRole === 'member' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: 'var(--bg-glass-card)',
              backdropFilter: 'blur(12px)',
              padding: 'var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              textAlign: 'left',
              color: 'inherit',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Dumbbell size={24} />
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  Personal User
                </span>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                Personal / Fitness User
              </h2>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                I want to track personal workouts, generate customized meal plans, log weight progress, and build streaks.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--accent-primary)' }} />
                  <span>Personal Workout & Exercise Tracker</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--accent-primary)' }} />
                  <span>ICMR-NIN Indian Meal Planning</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--accent-primary)' }} />
                  <span>Home & Gym Training Flexibility</span>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--border-subtle)',
                color: 'var(--accent-primary)',
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              <span>{submitting && selectedRole === 'member' ? 'Setting up profile...' : 'Continue as Personal Athlete'}</span>
              <ChevronRight size={18} />
            </div>
          </button>

          {/* Card 2: Gym Owner */}
          <button
            type="button"
            onClick={() => handleSelectRole('gym_owner')}
            disabled={submitting}
            className="card card-elevated"
            style={{
              cursor: submitting ? 'not-allowed' : 'pointer',
              border: selectedRole === 'gym_owner' ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
              background: 'var(--bg-glass-card)',
              backdropFilter: 'blur(12px)',
              padding: 'var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              textAlign: 'left',
              color: 'inherit',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: 'var(--accent-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 size={24} />
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(234, 179, 8, 0.12)',
                    color: 'var(--accent-gold)',
                  }}
                >
                  Facility Admin
                </span>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                Gym Owner
              </h2>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                I operate or manage a physical fitness center and want to verify member attendance, configure geofences, and manage passes.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--accent-gold)' }} />
                  <span>Gym Registration & Management</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--accent-gold)' }} />
                  <span>QR Code & Geofence Check-in Audits</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--accent-gold)' }} />
                  <span>Member Roster & Pass Tracking</span>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--border-subtle)',
                color: 'var(--accent-gold)',
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              <span>{submitting && selectedRole === 'gym_owner' ? 'Setting up profile...' : 'Continue as Gym Owner'}</span>
              <ChevronRight size={18} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
