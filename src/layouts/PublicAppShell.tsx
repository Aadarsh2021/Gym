import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight, Moon, Sun } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { BrandLogo } from '@/components/common/BrandLogo';
import { useTheme } from '@/context/ThemeContext';

export const PublicAppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const publicNavLinks = [
    { to: '/how-it-works', label: 'How It Works' },
    { to: '/workouts', label: 'Workouts' },
    { to: '/exercises', label: 'Exercises' },
    { to: '/nutrition', label: 'Nutrition' },
    { to: '/tools', label: 'Free Tools' },
    { to: '/pricing', label: 'Pricing' },
  ];

  return (
    <div className="public-layout">
      {/* Public Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 120,
          background: 'rgba(15, 16, 18, 0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border-subtle)',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
            }}
          >
            <BrandLogo />
          </Link>

          {/* Desktop Navigation */}
          <nav
            style={{
              display: 'none',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
            className="desktop-nav"
          >
            {publicNavLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `btn btn-ghost btn-sm ${isActive ? 'btn-secondary' : ''}`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div
            style={{
              display: 'none',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
            className="desktop-nav"
          >
            {/* Theme Toggle */}
            <button
              id="public-desktop-theme-toggle"
              className="btn btn-ghost btn-sm"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{ padding: '0 8px' }}
            >
              {isDark
                ? <Sun size={16} color="var(--text-secondary)" />
                : <Moon size={16} color="var(--accent-primary)" />
              }
            </button>
            <Link to="/signin" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              Sign In
            </Link>
            <Link
              to="/signup"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Get Started <ArrowRight size={14} />
            </Link>
          </div>

          {/* Mobile Right: Theme + Menu Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="mobile-only-btn">
            <button
              id="public-mobile-theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                minWidth: '44px',
                minHeight: '44px',
                padding: '8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {isDark ? <Sun size={18} color="var(--text-secondary)" /> : <Moon size={18} color="var(--accent-primary)" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                minWidth: '44px',
                minHeight: '44px',
                padding: '8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-primary)',
            zIndex: 119,
            padding: 'var(--space-6) var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            borderBottom: '1px solid var(--border-medium)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {publicNavLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--bg-hover)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontSize: '1.05rem',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <Link
              to="/signin"
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-secondary btn-block"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-primary btn-block"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}

      {/* Page Content */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Public Footer */}
      <Footer onOpenPublicTool={tool => navigate(`/tools/${tool.replace('-calculator', '')}`)} />
    </div>
  );
};
