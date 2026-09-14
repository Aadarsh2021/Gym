import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Building2, QrCode, Users, ShieldCheck, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export const OwnerDashboardView: React.FC = () => {
  const { session } = useAuth();

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-8)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Building2 size={16} />
            <span>GYM OWNER CONSOLE</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Facility Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Welcome back, {session.profile?.displayName || 'Owner'}. Monitor your facility and check-in audits.
          </p>
        </div>

        <Link to="/app" className="btn btn-secondary btn-sm">
          Switch to Athlete View
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Members</span>
            <Users size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>--</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered gym athletes</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-gold)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Today's Check-ins</span>
            <QrCode size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>--</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified via QR / GPS</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-cyan)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Geofence Verification</span>
            <MapPin size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>Active</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>200m perimeter audit</div>
        </div>
      </div>

      <div className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <ShieldCheck size={24} style={{ color: 'var(--accent-gold)' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Gym Ecosystem In Development</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem', marginBottom: 'var(--space-4)' }}>
          Your account is registered with the authoritative <code>gym_owner</code> role. The full gym facility management UI (QR terminal, geofence boundary configuration, pass subscriptions, and member roster management) will be available in the upcoming Gym UI milestone.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link to="/app" className="btn btn-primary btn-sm">
            Explore Athlete App Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
