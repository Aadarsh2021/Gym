import React from 'react';
import { Settings, Shield, Bell, Sliders, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const OwnerSettingsView: React.FC = () => {
  const { session } = useAuth();

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Settings size={16} />
            <span>CONFIGURATION</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Configure gym check-in boundaries, notifications, and owner account security.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', color: 'var(--accent-gold)' }}>
            <Sliders size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Check-in Configuration</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
            Set check-in radius, enable QR regeneration, and choose allowed member verification modes.
          </p>
          <div className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
            Default: QR + 200m GPS
          </div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', color: 'var(--accent-primary)' }}>
            <Bell size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Notification Alerts</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
            Receive digests for member signups, daily check-in reports, and community flag notifications.
          </p>
          <div className="badge" style={{ fontSize: '0.72rem' }}>
            Configurable
          </div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', color: 'var(--color-success)' }}>
            <User size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Owner Account</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
            Authenticated as <strong>{session.user?.email}</strong> with role <code>gym_owner</code>.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-success)' }}>
            <Shield size={14} />
            <span>RLS Multi-Tenancy Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
