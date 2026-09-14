import React from 'react';
import { Megaphone, Plus, BellRing, Archive } from 'lucide-react';

export const OwnerAnnouncementsView: React.FC = () => {
  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Megaphone size={16} />
            <span>FACILITY BROADCASTS</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Announcements</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Broadcast operational notices, holiday schedules, and member alerts to all enrolled athletes.
          </p>
        </div>

        <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} />
          <span>New Announcement</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Broadcasts</span>
            <BellRing size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visible to gym members</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Archived</span>
            <Archive size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Expired notices</div>
        </div>
      </div>

      <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
        <Megaphone size={40} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-4)' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>No Announcements Published</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
          Publish alerts about equipment maintenance, upcoming holidays, or special operating hours.
        </p>
      </div>
    </div>
  );
};
