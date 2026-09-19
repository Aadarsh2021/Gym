import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Trophy,
  Calendar,
  Megaphone,
  Award,
  Building2,
  Settings,
  Dumbbell,
  ShieldCheck,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  PlusCircle,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { BrandLogo } from '@/components/common/BrandLogo';

export const OwnerAppShell: React.FC = () => {
  const { session, signOut } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const { ownedGyms: gyms, activeGym, switchActiveGym, loading: loadingGyms } = useOwnerGym();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const displayName =
    session.profile?.displayName ||
    session.user?.email?.split('@')[0] ||
    'Gym Owner';
  const userEmail = session.user?.email || 'owner@facility.local';
  const avatarUrl = session.profile?.avatarUrl;
  const initial = (displayName.charAt(0) || 'O').toUpperCase();

  const ownerNavItems = [
    { to: '/owner/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/owner/members', label: 'Members', icon: Users, end: false },
    { to: '/owner/community', label: 'Community', icon: MessageSquare, end: false },
    { to: '/owner/challenges', label: 'Challenges', icon: Trophy, end: false },
    { to: '/owner/events', label: 'Events', icon: Calendar, end: false },
    { to: '/owner/announcements', label: 'Announcements', icon: Megaphone, end: false },
    { to: '/owner/rewards', label: 'Rewards', icon: Award, end: false },
    { to: '/owner/profile', label: 'Gym Profile', icon: Building2, end: false },
    { to: '/owner/settings', label: 'Settings', icon: Settings, end: false },
  ];

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const currentNav = ownerNavItems.find(item =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  return (
    <div className="app-shell-layout">
      {/* ====================================================================
          1. DESKTOP SIDEBAR (Visible on min-width: 1024px)
          ==================================================================== */}
      <aside className="app-sidebar" aria-label="Gym Owner Console Navigation">
        {/* Brand Header */}
        <div className="sidebar-brand-row">
          <Link to="/owner/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <BrandLogo size="md" />
          </Link>
          <span
            className="badge"
            style={{
              fontSize: '0.68rem',
              letterSpacing: '0.04em',
              background: 'rgba(214, 168, 79, 0.15)',
              color: 'var(--accent-gold)',
              border: '1px solid rgba(214, 168, 79, 0.3)',
              fontWeight: 700,
            }}
          >
            OWNER CONSOLE
          </span>
        </div>

        {/* Facility Identity Card */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          {loadingGyms ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading facility...</div>
          ) : activeGym ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeGym.name}
                </span>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--color-success)',
                  }}
                  title="Gym Operational"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <MapPin size={12} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeGym.city || activeGym.address || 'Integrated Facility'}
                </span>
              </div>
              {gyms.length > 1 && (
                <select
                  value={activeGym.id}
                  onChange={e => switchActiveGym(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: '0.75rem', marginTop: '6px', padding: '3px 6px', height: '28px' }}
                  aria-label="Switch active gym"
                >
                  {gyms.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-1) 0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                No Facility Registered
              </div>
              <Link
                to="/owner/onboarding"
                className="btn btn-primary btn-sm"
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <PlusCircle size={14} />
                <span>Register Gym</span>
              </Link>
            </div>
          )}
        </div>

        {/* Owner Profile Snippet */}
        <Link
          to="/owner/settings"
          className="sidebar-user-card"
          title="Owner Settings & Identity"
          style={{ textDecoration: 'none', marginBottom: 'var(--space-3)' }}
        >
          <div className="sidebar-user-top">
            <div
              className="sidebar-avatar"
              style={{
                background: 'linear-gradient(135deg, #D6A84F 0%, #B8860B 100%)',
                color: '#000000',
              }}
            >
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{initial}</span>}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-email">{userEmail}</span>
            </div>
          </div>
        </Link>

        {/* Owner Navigation Links */}
        <nav className="sidebar-nav-group" style={{ overflowY: 'auto' }}>
          <span className="sidebar-section-title">Facility Management</span>
          {ownerNavItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'owner-active' : ''}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="sidebar-bottom" style={{ marginTop: 'auto', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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
              <span style={{ fontWeight: 600 }}>RLS Isolated</span>
            </div>

            <button
              id="owner-theme-toggle"
              className="btn btn-ghost btn-sm"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                padding: '4px 8px',
                height: '32px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {isDark ? <Sun size={14} color="var(--text-secondary)" /> : <Moon size={14} color="var(--accent-gold)" />}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%' }}>
            <Link
              to="/app"
              className="btn btn-secondary btn-sm"
              style={{
                flex: 1,
                fontSize: '0.75rem',
                padding: '6px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
              title="Switch to Personal Athlete View"
            >
              <Dumbbell size={14} />
              <span>Athlete Mode</span>
            </Link>

            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              title="Sign Out of Facility Console"
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                padding: '6px 8px',
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          2. MAIN CONTENT WRAPPER & DESKTOP TOPBAR
          ==================================================================== */}
      <div className="app-main-wrapper">
        {/* Desktop Topbar (>= 1024px) */}
        <header
          className="desktop-topbar"
          style={{
            height: '64px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--space-8)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Facility Console</span>
            <span style={{ color: 'var(--border-medium)' }}>/</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {currentNav?.label || 'Overview'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{todayFormatted}</span>

            {activeGym ? (
              <span
                className="badge"
                style={{
                  fontSize: '0.75rem',
                  background: 'rgba(214, 168, 79, 0.12)',
                  color: 'var(--accent-gold)',
                  border: '1px solid rgba(214, 168, 79, 0.25)',
                }}
              >
                Facility: {activeGym.name}
              </span>
            ) : (
              <Link to="/owner/onboarding" className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem' }}>
                + Register Gym
              </Link>
            )}

            <Link to="/app" className="btn btn-ghost btn-sm" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Dumbbell size={15} />
              <span>Athlete Mode</span>
            </Link>
          </div>
        </header>

        {/* Mobile-Only Header (< 1024px) */}
        <header
          className="mobile-only-header"
          style={{
            display: 'none',
            height: '56px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0 var(--space-4)',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Link to="/owner/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <BrandLogo size="sm" />
            </Link>
            <span
              className="badge"
              style={{
                fontSize: '0.65rem',
                background: 'rgba(214, 168, 79, 0.15)',
                color: 'var(--accent-gold)',
              }}
            >
              Owner
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{ minWidth: '36px', height: '36px', padding: 0 }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open owner menu"
              style={{ minWidth: '36px', height: '36px', padding: 0 }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              top: '56px',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'var(--bg-surface)',
              zIndex: 50,
              padding: 'var(--space-4)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            {activeGym && (
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{activeGym.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {activeGym.city || activeGym.address || 'Facility'}
                </div>
              </div>
            )}

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ownerNavItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'owner-active' : ''}`
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Link
                to="/app"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Dumbbell size={16} />
                <span>Switch to Athlete View</span>
              </Link>

              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await signOut();
                  navigate('/');
                }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Routed Content View */}
        <main className="main-content" style={{ flex: 1, padding: 'var(--space-6) 0' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
