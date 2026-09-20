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
  Building2,
  Users,
  Trophy,
  Calendar,
  ShieldAlert,
  MessageSquare,
  MoreHorizontal,
  X,
  Compass,
  QrCode,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
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
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  // Automatically close bottom sheet upon route change
  useEffect(() => {
    setIsMoreSheetOpen(false);
  }, [location.pathname]);

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
  const userEmail = session.user?.email || 'athlete@fitness.local';
  const avatarUrl = session.profile?.avatarUrl;
  const initial = (displayName.charAt(0) || 'A').toUpperCase();

  let memberGymContext: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    memberGymContext = useMemberGymContext();
  } catch {
    // Safe fallback if rendered without provider in standalone tests
  }

  const isIntegratedGym = memberGymContext?.mode === 'integrated' && Boolean(memberGymContext?.activeGym);

  // Core Personal Navigation Items (Always Preserved)
  const personalNavItems = [
    { to: '/app', label: 'Home', icon: Home, end: true },
    { to: '/app/workouts', label: 'Workouts', icon: Dumbbell, end: false },
    { to: '/app/nutrition', label: 'Nutrition', icon: Utensils, end: false },
    { to: '/app/streaks', label: 'Streaks', icon: Flame, end: false },
    { to: '/app/progress', label: 'Progress', icon: TrendingUp, end: false },
    { to: '/app/rewards', label: 'Rewards Shop', icon: Coins, end: false },
    { to: '/app/exercises', label: 'Exercises', icon: BookOpen, end: false },
  ];

  // Gym Layer Items (Contextual: Unlocked for Active Integrated Members)
  const gymNavItems = isIntegratedGym
    ? [
        { to: '/app/gym', label: 'My Gym', icon: Building2, end: true },
        { to: '/app/gym/community', label: 'Community', icon: MessageSquare, end: false },
        { to: '/app/gym/buddies', label: 'Gym Buddies', icon: Users, end: false },
        { to: '/app/gym/challenges', label: 'Challenges', icon: Trophy, end: false },
        { to: '/app/gym/events', label: 'Events', icon: Calendar, end: false },
        { to: '/app/gym/safety', label: 'Safety & SOS', icon: ShieldAlert, end: false },
      ]
    : [
        { to: '/app/gym', label: 'Explore Gyms', icon: Compass, end: false },
      ];

  // Mobile Bottom Bar (Strictly 5 items, contextual)
  const mobilePrimaryItems = isIntegratedGym
    ? [
        { to: '/app', label: 'Home', icon: Home, end: true },
        { to: '/app/workouts', label: 'Workouts', icon: Dumbbell, end: false },
        { to: '/app/gym', label: 'My Gym', icon: Building2, end: true },
        { to: '/app/gym/community', label: 'Community', icon: MessageSquare, end: false },
      ]
    : [
        { to: '/app', label: 'Home', icon: Home, end: true },
        { to: '/app/workouts', label: 'Workouts', icon: Dumbbell, end: false },
        { to: '/app/nutrition', label: 'Nutrition', icon: Utensils, end: false },
        { to: '/app/streaks', label: 'Streaks', icon: Flame, end: false },
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
            {isIntegratedGym && memberGymContext?.activeGym && (
              <div
                className="badge"
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 7px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: 'var(--color-success)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={`Active Gym: ${memberGymContext.activeGym.name}`}
              >
                <Building2 size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {memberGymContext.activeGym.name}
                </span>
              </div>
            )}
            {memberGymContext?.mode === 'non_integrated' && (
              <div
                className="badge"
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 7px',
                  background: 'rgba(98, 121, 166, 0.15)',
                  color: 'var(--accent-indigo)',
                  border: '1px solid rgba(98, 121, 166, 0.3)',
                }}
                title="External Commercial Gym Mode"
              >
                <Building2 size={12} />
                <span>External Gym</span>
              </div>
            )}
          </div>
        </NavLink>

        {/* Dedicated Navigation Container */}
        <div className="sidebar-nav-container">
          {/* Navigation Links - Section 1: Personal Training Core */}
          <nav className="sidebar-nav-group">
            <span className="sidebar-section-title">Personal Training</span>
            {personalNavItems.map(item => {
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
                  <Icon size={17} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Navigation Links - Section 2: Gym & Community Layer */}
          <nav className="sidebar-nav-group" style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-3)' }}>
              <span className="sidebar-section-title" style={{ padding: 0, margin: 0 }}>
                {isIntegratedGym ? 'My Gym & Community' : 'Partner Gyms'}
              </span>
              {isIntegratedGym && (
                <span
                  className="badge"
                  style={{
                    fontSize: '0.62rem',
                    padding: '1px 5px',
                    background: 'rgba(34, 197, 94, 0.18)',
                    color: 'var(--color-success)',
                    fontWeight: 700,
                  }}
                >
                  Active
                </span>
              )}
            </div>
            {gymNavItems.map(item => {
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
                  <Icon size={17} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>


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
              onClick={() => navigate('/app/rewards')}
              title="Fitness Coins Rewards Shop"
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
              {(() => {
                const p = location.pathname;
                if (p === '/app') return 'Daily Training Brief';
                if (p.startsWith('/app/workouts')) return 'Workout Execution & Plans';
                if (p.startsWith('/app/exercises')) return 'Exercise Library';
                if (p.startsWith('/app/nutrition')) return 'Nutrition & Targets';
                if (p.startsWith('/app/progress')) return 'Progress & Analytics';
                if (p.startsWith('/app/streaks')) return 'Consistency & Streaks';
                if (p.startsWith('/app/rewards')) return 'Rewards & Perks Shop';
                if (p === '/app/gym') return isIntegratedGym ? 'My Gym Home' : 'Gym Discovery & Directory';
                if (p.startsWith('/app/gym/community')) return 'Gym Community Feed';
                if (p.startsWith('/app/gym/buddies')) return 'Gym Buddy Matching';
                if (p.startsWith('/app/gym/challenges')) return 'Gym Challenges & Leaderboard';
                if (p.startsWith('/app/gym/events')) return 'Gym Events & Workshops';
                if (p.startsWith('/app/gym/safety')) return 'Facility Safety & SPS';
                if (p.startsWith('/app/gym/check-in')) return 'Attendance & QR Check-In';
                if (p.startsWith('/app/gym/history')) return 'Gym Attendance History';
                if (p.startsWith('/app/profile')) return 'Athlete Profile & Settings';
                return 'Athlete Hub';
              })()}
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
          {mobilePrimaryItems.map(tab => {
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

          {/* 5th slot: More Sheet Launcher */}
          <button
            type="button"
            className={`nav-tab ${isMoreSheetOpen ? 'active' : ''}`}
            onClick={() => setIsMoreSheetOpen(prev => !prev)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              outline: 'none',
              color: isMoreSheetOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
            aria-label="Open More Menu"
          >
            <MoreHorizontal size={20} strokeWidth={isMoreSheetOpen ? 2.5 : 1.8} />
            <span>More</span>
          </button>
        </nav>

        {/* Mobile More Bottom Sheet (Native-Feeling Drawer) */}
        {isMoreSheetOpen && (
          <div className="mobile-sheet-backdrop" onClick={() => setIsMoreSheetOpen(false)}>
            <div className="mobile-sheet-content" onClick={e => e.stopPropagation()}>
              <div className="mobile-sheet-handle" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isIntegratedGym ? `${memberGymContext?.activeGym?.name || 'Gym'} & Personal Utilities` : 'Personal Utilities'}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsMoreSheetOpen(false)}
                  style={{ minWidth: '32px', minHeight: '32px', padding: 0 }}
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mobile-sheet-grid">
                {isIntegratedGym ? (
                  <>
                    <NavLink to="/app/nutrition" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Utensils size={20} />
                      <span>Nutrition</span>
                    </NavLink>
                    <NavLink to="/app/streaks" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Flame size={20} />
                      <span>Streaks</span>
                    </NavLink>
                    <NavLink to="/app/progress" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <TrendingUp size={20} />
                      <span>Progress</span>
                    </NavLink>
                    <NavLink to="/app/rewards" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Coins size={20} />
                      <span>Rewards</span>
                    </NavLink>
                    <NavLink to="/app/exercises" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <BookOpen size={20} />
                      <span>Exercises</span>
                    </NavLink>
                    <NavLink to="/app/gym/buddies" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Users size={20} />
                      <span>Buddies</span>
                    </NavLink>
                    <NavLink to="/app/gym/challenges" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Trophy size={20} />
                      <span>Challenges</span>
                    </NavLink>
                    <NavLink to="/app/gym/events" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Calendar size={20} />
                      <span>Events</span>
                    </NavLink>
                    <NavLink to="/app/gym/safety" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <ShieldAlert size={20} />
                      <span>Safety SOS</span>
                    </NavLink>
                    <NavLink to="/app/gym/check-in" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <QrCode size={20} />
                      <span>Check In</span>
                    </NavLink>
                    <NavLink to="/app/profile" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Settings size={20} />
                      <span>Settings</span>
                    </NavLink>
                  </>
                ) : (
                  <>
                    <NavLink to="/app/progress" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <TrendingUp size={20} />
                      <span>Progress</span>
                    </NavLink>
                    <NavLink to="/app/rewards" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Coins size={20} />
                      <span>Rewards</span>
                    </NavLink>
                    <NavLink to="/app/exercises" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <BookOpen size={20} />
                      <span>Exercises</span>
                    </NavLink>
                    <NavLink to="/app/gym" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Compass size={20} />
                      <span>Find Gym</span>
                    </NavLink>
                    <NavLink to="/app/profile" className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}>
                      <Settings size={20} />
                      <span>Settings</span>
                    </NavLink>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

