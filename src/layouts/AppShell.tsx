import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Dumbbell,
  Sparkles,
  Flame,
  Coins,
  User,
  LogOut,
  Home,
  BookOpen,
  Utensils,
  TrendingUp,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { streakService } from '@/services/streak.service';
import { UserStreak } from '@/types/streak.types';
import { GuruJiChatDrawer } from '@/features/guru-ji/GuruJiChatDrawer';
import { BrandLogo } from '@/components/common/BrandLogo';

export const AppShell: React.FC = () => {
  const { session, signOut } = useAuth();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();
  const location = useLocation();

  const [streak, setStreak] = useState<UserStreak>({
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
  });
  const [coins, setCoins] = useState<number>(0);
  const [isGuruJiOpen, setIsGuruJiOpen] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const fetchMetrics = async () => {
      try {
        const [userStreak, coinBalance] = await Promise.all([
          streakService.getStreak(userId),
          streakService.getCoinBalance(userId),
        ]);
        if (mounted) {
          setStreak(userStreak);
          setCoins(coinBalance);
        }
      } catch {
        // Fallback
      }
    };
    fetchMetrics();
    return () => {
      mounted = false;
    };
  }, [userId, location.pathname]);

  const displayName =
    session.profile?.displayName ||
    session.user?.email?.split('@')[0] ||
    'Athlete';
  const userEmail = session.user?.email || 'athlete@apexfit.local';
  const avatarUrl = session.profile?.avatarUrl;
  const initial = (displayName.charAt(0) || 'A').toUpperCase();

  const primaryNavItems = [
    { to: '/app', label: 'Home', icon: Home, end: true },
    { to: '/app/workouts', label: 'Workouts', icon: Dumbbell, end: false },
    { to: '/app/exercises', label: 'Exercises', icon: BookOpen, end: false },
    { to: '/app/nutrition', label: 'Nutrition', icon: Utensils, end: false },
    { to: '/app/progress', label: 'Progress', icon: TrendingUp, end: false },
  ];

  const sidebarNavItems = [
    ...primaryNavItems,
    { to: '/app/profile', label: 'Profile & Settings', icon: Settings, end: false },
  ];

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="app-shell-layout">
      {/* ====================================================================
          DESKTOP SIDEBAR (Visible on min-width: 1024px)
          ==================================================================== */}
      <aside className="app-sidebar" aria-label="Desktop Navigation Sidebar">
        {/* Brand Row */}
        <div className="sidebar-brand-row">
          <NavLink to="/app" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <BrandLogo size="md" />
          </NavLink>
          <span className="badge badge-accent" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
            PRO
          </span>
        </div>

        {/* Athlete Profile Card */}
        <NavLink to="/app/profile" className="sidebar-user-card" title="Manage Athlete Profile">
          <div className="sidebar-user-top">
            <div className="sidebar-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-email">{userEmail}</span>
            </div>
          </div>
          <div className="sidebar-user-chips">
            <div className="badge badge-gold" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
              <Flame size={12} fill="var(--accent-gold)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {streak.currentStreak}d Streak
              </span>
            </div>
            <div className="badge badge-gold" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
              <Coins size={12} />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {coins}
              </span>
            </div>
          </div>
        </NavLink>

        {/* Navigation Links */}
        <nav className="sidebar-nav-group">
          <span className="sidebar-section-title">Navigation</span>
          {sidebarNavItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Guru Ji Coach Spotlight (Compact) */}
        <div className="sidebar-coach-banner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: 'var(--accent-primary-muted)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={14} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Guru Ji Coach
              </span>
            </div>
            <span className="badge" style={{ fontSize: '0.65rem' }}>AI</span>
          </div>
          <button
            className="btn btn-secondary btn-sm btn-block"
            onClick={() => setIsGuruJiOpen(true)}
            style={{ fontSize: '0.78rem', height: '30px' }}
          >
            <Sparkles size={12} color="var(--accent-primary)" />
            <span>Chat with Guru Ji</span>
          </button>
        </div>

        {/* Sidebar Footer / Connection & Logout */}
        <div className="sidebar-bottom">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: 'var(--color-success)',
            }}
            title="Connected to Supabase PostgreSQL & Auth"
          >
            <ShieldCheck size={14} />
            <span style={{ fontWeight: 600 }}>Live DB</span>
          </div>

          {session.user && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              title="Sign Out of Account"
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                height: '32px',
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      {/* ====================================================================
          MAIN APP CONTENT WRAPPER
          ==================================================================== */}
      <div className="app-main-wrapper">
        {/* Mobile-Only Header (< 1024px) */}
        <header className="mobile-only-header">
          <NavLink to="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <BrandLogo size="md" />
          </NavLink>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* Guru Ji Coach Trigger */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsGuruJiOpen(true)}
              title="Guru Ji Fitness Coach"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={14} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Coach</span>
            </button>

            {/* Streak Badge */}
            <div
              className="badge badge-gold"
              style={{ cursor: 'pointer', padding: '5px 9px', fontFamily: 'var(--font-mono)' }}
              onClick={() => navigate('/app/progress')}
              title="Active Workout Streak"
            >
              <Flame size={14} fill="var(--accent-gold)" />
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {streak.currentStreak}
              </span>
            </div>

            {/* Coins Badge */}
            <div
              className="badge badge-gold hide-on-xs"
              style={{ cursor: 'pointer', padding: '5px 9px', fontFamily: 'var(--font-mono)' }}
              onClick={() => navigate('/app/progress')}
              title="Fitness Coins"
            >
              <Coins size={14} />
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{coins}</span>
            </div>

            {/* Profile Avatar / Link */}
            <NavLink
              to="/app/profile"
              className={({ isActive }) =>
                `btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`
              }
              title="Account & Profile Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                padding: '0 8px',
              }}
            >
              <User size={14} />
            </NavLink>

            {/* Sign Out */}
            {session.user && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await signOut();
                  navigate('/');
                }}
                title="Sign Out"
                style={{ padding: '0 8px' }}
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </header>

        {/* Desktop Topbar (>= 1024px) - Clean Breadcrumb & Quick Coach */}
        <header className="desktop-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Platform
            </span>
            <span style={{ color: 'var(--border-medium)' }}>/</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              {location.pathname === '/app'
                ? 'Daily Training Brief'
                : location.pathname.startsWith('/app/workouts')
                ? 'Workout Execution & Plans'
                : location.pathname.startsWith('/app/exercises')
                ? 'Exercise Library'
                : location.pathname.startsWith('/app/nutrition')
                ? 'Nutrition & Targets'
                : location.pathname.startsWith('/app/progress')
                ? 'Progress & Analytics'
                : 'Athlete Profile & Settings'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsGuruJiOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={14} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Guru Ji Coach</span>
            </button>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {todayFormatted}
            </span>
          </div>
        </header>

        {/* Main Routed Page Content */}
        <main className="main-content" style={{ flex: 1 }}>
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar (Strictly 5 items on < 1024px) */}
        <nav className="bottom-nav">
          {primaryNavItems.map(tab => {
            const Icon = tab.icon;
            const isActive =
              tab.end
                ? location.pathname === tab.to
                : location.pathname.startsWith(tab.to);

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={`nav-tab ${isActive ? 'active' : ''}`}
                style={{
                  textDecoration: 'none',
                  outline: 'none',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Guru Ji Coach Drawer */}
      <GuruJiChatDrawer
        isOpen={isGuruJiOpen}
        onClose={() => setIsGuruJiOpen(false)}
        onNavigateTab={tab => {
          setIsGuruJiOpen(false);
          if (tab === 'dashboard') navigate('/app');
          else if (tab === 'workout') navigate('/app/workouts');
          else if (tab === 'exercises') navigate('/app/exercises');
          else if (tab === 'nutrition') navigate('/app/nutrition');
          else if (tab === 'progress') navigate('/app/progress');
          else if (tab === 'streaks') navigate('/app/progress');
          else if (tab === 'onboarding') navigate('/app/profile');
        }}
      />
    </div>
  );
};

