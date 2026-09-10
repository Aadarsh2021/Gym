import React from 'react';
import { Flame, Coins, User, LogOut, Dumbbell, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  currentStreak?: number;
  coinBalance?: number;
  onOpenAuthModal?: () => void;
  onNavigateTab?: (tab: string) => void;
  activeTab?: string;
  onOpenGuruJi?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStreak = 0,
  coinBalance = 0,
  onOpenAuthModal,
  onNavigateTab,
  activeTab = 'dashboard',
  onOpenGuruJi,
}) => {
  const { session, signOut } = useAuth();

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'workout', label: 'Workouts' },
    { id: 'exercises', label: 'Exercise Library' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'progress', label: 'Progress' },
  ];

  return (
    <header
      className="header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-4)',
        height: '60px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 110,
      }}
    >
      {/* Brand Logo & Desktop Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}
          onClick={() => onNavigateTab?.('dashboard')}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary-text)',
            }}
          >
            <Dumbbell size={18} strokeWidth={2.5} />
          </div>
          <div>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: '1.15rem',
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              APEX<span style={{ color: 'var(--accent-primary)' }}>FIT</span>
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav
          style={{
            display: 'none',
            gap: 'var(--space-1)',
            alignItems: 'center',
          }}
          className="desktop-nav"
        >
          {navLinks.map(link => (
            <button
              key={link.id}
              className={`btn btn-ghost btn-sm ${activeTab === link.id ? 'btn-secondary' : ''}`}
              style={{
                color: activeTab === link.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === link.id ? 700 : 500,
              }}
              onClick={() => onNavigateTab?.(link.id)}
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Metrics, AI Coach & Profile Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {/* Guru Ji Coach Trigger */}
        {onOpenGuruJi && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenGuruJi}
            title="Guru Ji Fitness Coach"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={14} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Coach</span>
          </button>
        )}

        {/* Streak Badge */}
        <div
          className="badge badge-warning"
          style={{ cursor: 'pointer', padding: '5px 10px' }}
          onClick={() => onNavigateTab?.('streaks')}
          title="Active Workout Streak"
        >
          <Flame size={14} />
          <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{currentStreak}</span>
        </div>

        {/* Coins Badge */}
        <div
          className="badge badge-accent"
          style={{ cursor: 'pointer', padding: '5px 10px' }}
          onClick={() => onNavigateTab?.('streaks')}
          title="Fitness Coins"
        >
          <Coins size={14} />
          <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{coinBalance}</span>
        </div>

        {/* Profile / Auth Controls */}
        {session.user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab?.('onboarding')}
              title="Profile Settings"
            >
              <User size={14} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut size={14} />
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
