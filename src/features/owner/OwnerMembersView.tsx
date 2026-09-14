import React from 'react';
import { Users, Search, UserCheck, Clock, UserX } from 'lucide-react';

export const OwnerMembersView: React.FC = () => {
  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Users size={16} />
            <span>MEMBER ROSTER</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Members</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Manage active memberships, check-in history, and athlete statuses.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Members</span>
            <UserCheck size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified active passes</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-gold)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Recent Check-ins</span>
            <Clock size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Past 24 hours</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Inactive / Expired</span>
            <UserX size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Renewal candidates</div>
        </div>
      </div>

      <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
        <Search size={40} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-4)' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>No Members Enrolled Yet</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
          Members will appear here when athletes join your gym using your gym QR code or member invitation slug.
        </p>
      </div>
    </div>
  );
};
