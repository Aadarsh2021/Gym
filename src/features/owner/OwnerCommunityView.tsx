import React from 'react';
import { MessageSquare, ShieldAlert, Pin, CheckCircle2 } from 'lucide-react';

export const OwnerCommunityView: React.FC = () => {
  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <MessageSquare size={16} />
            <span>MODERATION & FEED</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Community</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Moderate community discussions, pin gym announcements, and maintain community guidelines.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Posts</span>
            <MessageSquare size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Intra-gym discussions</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-gold)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pinned Topics</span>
            <Pin size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rules & updates</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reports / Flagged</span>
            <ShieldAlert size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clean feed</div>
        </div>
      </div>

      <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
        <CheckCircle2 size={40} style={{ color: 'var(--accent-gold)', margin: '0 auto var(--space-4)' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Community Feed Ready</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
          Gym community board allows members to interact and post updates. As an owner, you have full moderation authority to pin notices and remove inappropriate content.
        </p>
      </div>
    </div>
  );
};
