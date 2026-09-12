import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Dumbbell,
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
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { streakService } from '@/services/streak.service';
import { reminderService } from '@/services/reminder.service';
import { UserStreak } from '@/types/streak.types';
import { BrandLogo } from '@/components/common/BrandLogo';

export const AppShell: React.FC = () => {
  const { session, signOut } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();
  const location = useLocation();

  const [streak, setStreak] = useState<UserStreak>({
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
  });
  const [coins, setCoins] = useState<number>(0);

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

  // Synchronize active workout reminder timer for current session
  useEffect(() => {
    if (userId && userId !== 'guest-user') {
      reminderService
        .getReminderPreference(userId)
        .then(pref => {
          reminderService.rescheduleSameSessionTimer(pref);
        })
        .catch(() => {});
    }
    return () => {
      reminderService.clearScheduledTimers();
    };
  }, [userId]);

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
            <div className="badge badge-accent" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
              <Flame size={12} fill="var(--accent-primary)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {streak.currentStreak}d Streak
              </span>
            </div>
            <div className="badge" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
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

        {/* Sidebar Footer / Connection & Logout */}
        <div className="sidebar-bottom">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            {/* Theme Toggle */}
            <button
              id="sidebar-theme-toggle"
              className="btn btn-ghost btn-sm"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                padding: '4px 8px',
                height: '32px',
                color: isDark ? '#94A3B8' : '#64748B',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
                transition: 'all 200ms ease',
              }}
            >
              {isDark
                ? <Sun size={14} color="var(--text-secondary)" />
                : <Moon size={14} color="var(--accent-primary)" />
              }
            </button>
          </div>

          {session.user && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                reminderService.clearScheduledTimers();
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
            {/* Theme Toggle — Mobile */}
            <button
              id="mobile-theme-toggle"
              className="btn btn-secondary btn-sm"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{ minWidth: '40px', minHeight: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isDark
                ? <Sun size={16} color="var(--text-secondary)" />
                : <Moon size={16} color="var(--accent-primary)" />
              }
            </button>

            {/* Streak Badge */}
            <div
              className="badge badge-accent"
              style={{ cursor: 'pointer', minHeight: '36px', padding: '0 10px', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => navigate('/app/progress')}
              title="Active Workout Streak"
            >
              <Flame size={15} fill="var(--accent-primary)" />
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {streak.currentStreak}
              </span>
            </div>

            {/* Coins Badge */}
            <div
              className="badge hide-on-xs"
              style={{ cursor: 'pointer', minHeight: '36px', padding: '0 10px', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
              aria-label="Account & Profile Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                minWidth: '40px',
                minHeight: '40px',
                padding: 0,
              }}
            >
              <User size={16} />
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
                aria-label="Sign Out"
                style={{ minWidth: '40px', minHeight: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <LogOut size={16} />
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
            {/* Theme Toggle — Desktop Topbar */}
            <button
              id="desktop-theme-toggle"
              className="btn btn-secondary btn-sm"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                padding: '0 10px',
                gap: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {isDark ? (
                <><Sun size={14} color="var(--text-secondary)" /><span style={{ color: 'var(--text-secondary)' }}>Light</span></>
              ) : (
                <><Moon size={14} color="var(--accent-primary)" /><span style={{ color: 'var(--text-secondary)' }}>Dark</span></>
              )}
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
    </div>
  );
};

