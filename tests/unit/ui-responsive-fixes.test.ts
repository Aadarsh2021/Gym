import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Responsive UI Fixes Verification Suite', () => {
  const layoutCssPath = path.resolve(__dirname, '../../src/styles/layout.css');
  const appShellPath = path.resolve(__dirname, '../../src/layouts/AppShell.tsx');
  const ownerAppShellPath = path.resolve(__dirname, '../../src/layouts/OwnerAppShell.tsx');
  const ownerEventsViewPath = path.resolve(__dirname, '../../src/features/owner/OwnerEventsView.tsx');

  const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');
  const appShell = fs.readFileSync(appShellPath, 'utf8');
  const ownerAppShell = fs.readFileSync(ownerAppShellPath, 'utf8');
  const ownerEventsView = fs.readFileSync(ownerEventsViewPath, 'utf8');

  describe('1. Member Sidebar Structural & Responsive Integrity (AppShell)', () => {
    it('wraps navigation in a dedicated .sidebar-nav-container', () => {
      expect(appShell).toContain('<div className="sidebar-nav-container">');
    });

    it('ensures brand row and user profile card are outside the scroll container', () => {
      const brandIndex = appShell.indexOf('sidebar-brand-row');
      const userCardIndex = appShell.indexOf('sidebar-user-card');
      const navContainerIndex = appShell.indexOf('sidebar-nav-container');

      expect(brandIndex).toBeGreaterThan(-1);
      expect(userCardIndex).toBeGreaterThan(brandIndex);
      expect(navContainerIndex).toBeGreaterThan(userCardIndex);
    });

    it('ensures bottom footer controls are outside and after the scroll container', () => {
      const navContainerIndex = appShell.indexOf('sidebar-nav-container');
      const bottomIndex = appShell.indexOf('sidebar-bottom');

      expect(navContainerIndex).toBeGreaterThan(-1);
      expect(bottomIndex).toBeGreaterThan(navContainerIndex);
    });

    it('preserves all 7 personal navigation items without truncation', () => {
      expect(appShell).toContain("label: 'Home'");
      expect(appShell).toContain("label: 'Workouts'");
      expect(appShell).toContain("label: 'Nutrition'");
      expect(appShell).toContain("label: 'Streaks'");
      expect(appShell).toContain("label: 'Progress'");
      expect(appShell).toContain("label: 'Rewards Shop'");
      expect(appShell).toContain("label: 'Exercises'");
    });

    it('preserves gym layer navigation items with clean section separation', () => {
      expect(appShell).toContain('Personal Training');
      expect(appShell).toContain('Partner Gyms');
      expect(appShell).toContain("label: 'Explore Gyms'");
    });
  });

  describe('2. Owner Sidebar Structural & Responsive Integrity (OwnerAppShell)', () => {
    it('wraps owner facility navigation in .sidebar-nav-container', () => {
      expect(ownerAppShell).toContain('<div className="sidebar-nav-container">');
    });

    it('preserves stationary header and stationary bottom controls in OwnerAppShell', () => {
      const brandIndex = ownerAppShell.indexOf('sidebar-brand-row');
      const navContainerIndex = ownerAppShell.indexOf('sidebar-nav-container');
      const bottomIndex = ownerAppShell.indexOf('sidebar-bottom');

      expect(brandIndex).toBeLessThan(navContainerIndex);
      expect(bottomIndex).toBeGreaterThan(navContainerIndex);
    });
  });

  describe('3. CSS Architecture & Overflow Behavior (layout.css)', () => {
    it('configures .sidebar-nav-container for smooth vertical scrolling without horizontal overflow', () => {
      expect(layoutCss).toMatch(/\.sidebar-nav-container\s*\{[\s\S]*?overflow-y:\s*auto;/);
      expect(layoutCss).toMatch(/\.sidebar-nav-container\s*\{[\s\S]*?overflow-x:\s*hidden;/);
      expect(layoutCss).toMatch(/\.sidebar-nav-container\s*\{[\s\S]*?flex:\s*1 1 auto;/);
      expect(layoutCss).toMatch(/\.sidebar-nav-container\s*\{[\s\S]*?min-height:\s*0;/);
    });

    it('ensures .sidebar-nav-group does NOT have flex: 1 or overflow: hidden causing item clipping', () => {
      const groupMatch = layoutCss.match(/\.sidebar-nav-group\s*\{([^}]*)\}/);
      expect(groupMatch).toBeTruthy();
      const groupCss = groupMatch![1];

      expect(groupCss).not.toContain('flex: 1;');
      expect(groupCss).not.toContain('overflow: hidden;');
      expect(groupCss).toContain('flex-shrink: 0;');
    });

    it('maintains fixed, stationary contract for the outer .app-sidebar container', () => {
      expect(layoutCss).toMatch(/\.app-sidebar\s*\{[\s\S]*?position:\s*fixed;/);
      expect(layoutCss).toMatch(/\.app-sidebar\s*\{[\s\S]*?overflow:\s*hidden;/);
    });
  });

  describe('4. Owner Events Theme & Contrast Resolution (OwnerEventsView)', () => {
    it('eliminates hardcoded text-white on page title, using semantic text-primary', () => {
      expect(ownerEventsView).not.toMatch(/<h1[^>]*text-white[^>]*>Gym Events &amp; Workshops<\/h1>/);
      expect(ownerEventsView).toContain("color: 'var(--text-primary)'");
      expect(ownerEventsView).toContain('Gym Events &amp; Workshops');
    });

    it('eliminates hardcoded text-white on all 4 metric cards', () => {
      // Metric numbers must use var(--text-primary)
      expect(ownerEventsView).toContain('{upcomingEvents.length}');
      expect(ownerEventsView).toContain('{totalRsvps}');
      expect(ownerEventsView).toContain('{completedEvents.length}');
      expect(ownerEventsView).toContain('{events.length}');

      // Must not have text-white next to any of these metrics
      expect(ownerEventsView).not.toMatch(/text-white[^>]*>\{upcomingEvents\.length\}/);
      expect(ownerEventsView).not.toMatch(/text-white[^>]*>\{totalRsvps\}/);
      expect(ownerEventsView).not.toMatch(/text-white[^>]*>\{completedEvents\.length\}/);
      expect(ownerEventsView).not.toMatch(/text-white[^>]*>\{events\.length\}/);
    });

    it('uses semantic var(--bg-glass-card) and var(--border-subtle) on metric cards', () => {
      expect(ownerEventsView).toContain("background: 'var(--bg-glass-card)'");
      expect(ownerEventsView).toContain("borderColor: 'var(--border-subtle)'");
    });

    it('ensures empty state is clearly readable with semantic tokens', () => {
      expect(ownerEventsView).toContain('No Events Scheduled Yet');
      expect(ownerEventsView).toContain("border: '2px dashed var(--border-medium)'");
      expect(ownerEventsView).toContain("background: 'var(--bg-surface)'");
    });

    it('uses standard design system buttons (btn btn-primary, btn btn-secondary)', () => {
      expect(ownerEventsView).toContain('btn btn-secondary btn-sm');
      expect(ownerEventsView).toContain('btn btn-primary btn-sm');
      expect(ownerEventsView).toContain('Create First Event');
    });

    it('preserves loading state functionality and spinner', () => {
      expect(ownerEventsView).toContain('loading ? (');
      expect(ownerEventsView).toContain('animate-spin');
    });
  });
});
