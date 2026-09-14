import React from 'react';
import { Building2, MapPin, ShieldCheck, QrCode } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const OwnerProfileView: React.FC = () => {
  const { session } = useAuth();

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Building2 size={16} />
            <span>FACILITY IDENTITY</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Profile</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            View and manage your facility details, branding, geofence radius, and location coordinates.
          </p>
        </div>
      </div>

      <div className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(214, 168, 79, 0.15)',
              color: 'var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={32} />
          </div>

          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Facility Profile</h2>
              <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
                Verified Owner
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 'var(--space-3)' }}>
              Managed by {session.profile?.displayName || 'Owner'} ({session.user?.email})
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>Geofence Radius: 200m</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <QrCode size={15} style={{ color: 'var(--accent-gold)' }} />
                <span>QR Terminal: Enabled</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} style={{ color: 'var(--color-success)' }} />
                <span>RLS Multi-Tenancy: Enforced</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
