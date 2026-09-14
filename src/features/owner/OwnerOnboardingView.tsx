import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, MapPin, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const OwnerOnboardingView: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [gymName, setGymName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // In current phase before full gym database creation, simulate registration and route to owner dashboard
    setTimeout(() => {
      navigate('/owner/dashboard', { replace: true });
    }, 600);
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
        className="card card-elevated"
        style={{
          maxWidth: '560px',
          width: '100%',
          padding: 'var(--space-8) var(--space-6)',
          background: 'var(--bg-glass-card)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(234, 179, 8, 0.15)',
              color: 'var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Register Your Gym</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Step 1 of 2: Basic facility profile</p>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
          Welcome, {session.profile?.displayName || 'Owner'}! Let's get your fitness center registered so athletes can discover and check in to your gym.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--text-secondary)' }}>
              Gym / Facility Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Iron Gym & Fitness Club"
              value={gymName}
              onChange={e => setGymName(e.target.value)}
              className="input"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--text-secondary)' }}>
              City
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mumbai, Delhi, Bengaluru"
              value={city}
              onChange={e => setCity(e.target.value)}
              className="input"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--text-secondary)' }}>
              Street Address
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 102 Linking Road, Bandra West"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="input"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ padding: 'var(--space-3)', background: 'rgba(34, 197, 94, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
            <MapPin size={16} />
            <span>GPS Geofence coordinate calibration will occur in the next step.</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !gymName || !city}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
          >
            <span>{isSubmitting ? 'Registering Facility...' : 'Continue to Owner Dashboard'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
          <Link to="/app" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            Skip for now & browse as athlete
          </Link>
        </div>
      </div>
    </div>
  );
};
