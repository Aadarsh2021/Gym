import React from 'react';
import { Flame, Coins, User, LogOut, Dumbbell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  currentStreak?: number;
  coinBalance?: number;
  onOpenAuthModal?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStreak = 0,
  coinBalance = 0,
  onOpenAuthModal,
  onNavigateTab,
}) => {
  const { session, signOut } = useAuth();

  return (
    <header className="header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 90,
    }}>
      {/* Brand Logo */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}
        onClick={() => onNavigateTab?.('dashboard')}
      >
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-inverse)',
          boxShadow: 'var(--glow-primary)',
        }}>
          <Dumbbell size={20} strokeWidth={2.5} />
        </div>
        <div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
            FITNESS<span style={{ color: 'var(--accent-primary)' }}>.AI</span>
          </span>
        </div>
      </div>

      {/* Metrics & Profile Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {/* Streak Counter */}
        <div
          className="badge badge-fire"
          style={{ cursor: 'pointer', padding: '6px 12px' }}
          onClick={() => onNavigateTab?.('streaks')}
          title="Current Workout Streak"
        >
          <Flame size={15} fill="var(--accent-fire)" />
          <span style={{ fontWeight: 800 }}>{currentStreak}</span>
        </div>

        {/* Coins Counter */}
        <div
          className="badge"
          style={{
            cursor: 'pointer',
            padding: '6px 12px',
            background: 'rgba(255, 184, 0, 0.15)',
            color: 'var(--accent-amber)',
            borderColor: 'rgba(255, 184, 0, 0.3)',
          }}
          onClick={() => onNavigateTab?.('streaks')}
          title="Fitness Coins"
        >
          <Coins size={15} />
          <span style={{ fontWeight: 800 }}>{coinBalance}</span>
        </div>

        {/* Auth / Profile State */}
        {session.user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab?.('onboarding')}
              title="Profile & Onboarding"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <User size={15} />
              <span style={{ display: 'none', md: 'inline' } as any}>
                {session.profile?.displayName || 'Profile'}
              </span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onOpenAuthModal}>
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
