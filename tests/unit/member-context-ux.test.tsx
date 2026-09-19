import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { deriveMemberGymContext } from '@/services/gym-context.service';
import { Gym, GymMembership } from '@/types/gym.types';

describe('Member Context UI/UX & Responsive Architecture Tests', () => {
  const appShellPath = path.resolve(__dirname, '../../src/layouts/AppShell.tsx');
  const dashboardPath = path.resolve(__dirname, '../../src/features/dashboard/DashboardView.tsx');
  const streaksPath = path.resolve(__dirname, '../../src/features/streaks/StreaksView.tsx');
  const rewardsPath = path.resolve(__dirname, '../../src/features/rewards/RewardsShopView.tsx');
  const gymDiscoveryPath = path.resolve(__dirname, '../../src/features/gym/MemberGymDiscoveryView.tsx');
  const componentsCssPath = path.resolve(__dirname, '../../src/styles/components.css');

  const appShellCode = fs.readFileSync(appShellPath, 'utf8');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
  const streaksCode = fs.readFileSync(streaksPath, 'utf8');
  const rewardsCode = fs.readFileSync(rewardsPath, 'utf8');
  const gymDiscoveryCode = fs.readFileSync(gymDiscoveryPath, 'utf8');
  const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');

  const mockGym: Gym = {
    id: 'gym-titan-001',
    name: 'Titan Athletic Club',
    slug: 'titan-athletic',
    ownerId: 'owner-titan-1',
    address: '42 Iron Way',
    city: 'Bangalore',
    latitude: 12.9716,
    longitude: 77.5946,
    radiusMeters: 200,
    qrCodeHash: 'hash-titan',
    createdAt: new Date().toISOString(),
  };

  describe('1. Information Architecture & Navigation (AppShell)', () => {
    it('preserves all Personal Training Core links in desktop navigation', () => {
      expect(appShellCode).toContain('Personal Training');
      expect(appShellCode).toContain("to: '/app'");
      expect(appShellCode).toContain("to: '/app/workouts'");
      expect(appShellCode).toContain("to: '/app/nutrition'");
      expect(appShellCode).toContain("to: '/app/streaks'");
      expect(appShellCode).toContain("to: '/app/progress'");
      expect(appShellCode).toContain("to: '/app/rewards'");
      expect(appShellCode).toContain("to: '/app/exercises'");
    });

    it('conditionally renders My Gym & Community only when integrated gym is active', () => {
      expect(appShellCode).toContain('isIntegratedGym');
      expect(appShellCode).toContain("to: '/app/gym'");
      expect(appShellCode).toContain("to: '/app/gym/community'");
      expect(appShellCode).toContain("to: '/app/gym/buddies'");
      expect(appShellCode).toContain("to: '/app/gym/challenges'");
      expect(appShellCode).toContain("to: '/app/gym/events'");
      expect(appShellCode).toContain("to: '/app/gym/safety'");
    });

    it('renders "Explore Gyms" instead of private gym links for non-integrated members', () => {
      expect(appShellCode).toContain("to: '/app/gym', label: 'Explore Gyms'");
    });

    it('enforces exactly 5 primary destinations on mobile bottom navigation', () => {
      // Integrated: Home, Workouts, My Gym, Community, More
      expect(appShellCode).toContain("label: 'My Gym'");
      expect(appShellCode).toContain("label: 'Community'");
      // Home / External: Home, Workouts, Nutrition, Streaks, More
      expect(appShellCode).toContain("label: 'Nutrition'");
      expect(appShellCode).toContain("label: 'Streaks'");
      // Bottom sheet trigger
      expect(appShellCode).toContain('<span>More</span>');
      expect(appShellCode).toContain('setIsMoreSheetOpen(');
    });

    it('provides accessible mobile bottom sheet with touch-friendly utilities', () => {
      expect(componentsCss).toContain('.mobile-sheet-backdrop');
      expect(componentsCss).toContain('.mobile-sheet-content');
      expect(componentsCss).toContain('.mobile-sheet-grid');
      expect(componentsCss).toContain('.mobile-sheet-item');
    });
  });

  describe('2. Context-Aware Main Dashboard (DashboardView)', () => {
    it('displays Integrated Gym Command Center banner for active gym members', () => {
      expect(dashboardCode).toContain('isIntegratedGym && activeGym');
      expect(dashboardCode).toContain('card-gym-command');
      expect(dashboardCode).toContain('Facility Check-In');
      expect(dashboardCode).toContain('Safety SOS');
    });

    it('displays Commercial Gym Mode indicator for external gym athletes', () => {
      expect(dashboardCode).toContain("memberGymContext?.mode === 'non_integrated'");
      expect(dashboardCode).toContain('Commercial Gym Mode');
      expect(dashboardCode).toContain('commercial equipment');
    });

    it('preserves complete athlete-first personal dashboard in all modes', () => {
      expect(dashboardCode).toContain("Today's Mission");
      expect(dashboardCode).toContain('Active Split');
      expect(dashboardCode).toContain('streak.currentStreak');
      expect(dashboardCode).toContain('handleStartWorkoutWithCheck');
    });

    it('shows gym discovery CTA at bottom of dashboard for Home members', () => {
      expect(dashboardCode).toContain('!isIntegratedGym');
      expect(dashboardCode).toContain('Train at an Integrated FitSphere Gym?');
      expect(dashboardCode).toContain('/app/gym');
    });
  });

  describe('3. My Gym Home Portal (MemberGymDiscoveryView)', () => {
    it('renders dedicated My Gym Home Portal for active integrated members', () => {
      expect(gymDiscoveryCode).toContain("memberGymCtx?.mode === 'integrated' && memberGymCtx.activeGym");
      expect(gymDiscoveryCode).toContain('Scan QR to Check In');
      expect(gymDiscoveryCode).toContain('Community Feed');
      expect(gymDiscoveryCode).toContain('Gym Buddies');
      expect(gymDiscoveryCode).toContain('Challenges');
      expect(gymDiscoveryCode).toContain('Events & Classes');
      expect(gymDiscoveryCode).toContain('Safety & SOS');
    });

    it('renders search and exploration directory for un-enrolled members', () => {
      expect(gymDiscoveryCode).toContain('Find Your Gym');
      expect(gymDiscoveryCode).toContain('searchQuery');
      expect(gymDiscoveryCode).toContain('selectedCity');
    });
  });

  describe('4. Streaks: Personal Consistency vs Gym Attendance (StreaksView)', () => {
    it('separates Personal Workout Streak and Gym Attendance Streak into distinct cards', () => {
      expect(streaksCode).toContain('Personal Workout Streak');
      expect(streaksCode).toContain('Gym Attendance Streak');
      expect(streaksCode).toContain('gymStreak?.currentStreak');
    });

    it('only fetches and displays Gym Attendance Streak when integrated is active', () => {
      expect(streaksCode).toContain('if (isIntegrated && activeGym?.id)');
      expect(streaksCode).toContain('isIntegrated && (');
      expect(streaksCode).toContain('gymRepository.getGymAttendanceStreak');
    });

    it('preserves personal consistency revives and milestones authoritatively', () => {
      expect(streaksCode).toContain('Free Streak Revives');
      expect(streaksCode).toContain('Streak Milestones');
      expect(streaksCode).toContain('Fitness Coins');
    });
  });

  describe('5. Rewards: FitCoins vs Facility Perks (RewardsShopView)', () => {
    it('strictly isolates Personal Rewards from Club Perks', () => {
      expect(rewardsCode).toContain('Personal Rewards');
      expect(rewardsCode).toContain('Club Perks');
      expect(rewardsCode).toContain('activeTab === \'gym_perks\'');
    });

    it('clarifies that gym perks do not consume user personal FitCoins balance', () => {
      expect(rewardsCode).toContain('distinct from and do NOT consume your Personal FitCoins balance');
    });

    it('fetches authoritative gym rewards when integrated', () => {
      expect(rewardsCode).toContain('gymRepository.fetchGymRewards(activeGym.id)');
    });
  });

  describe('6. Membership States & Access Gating Derivation', () => {
    it('resolves mode "home" and restricts gym commands when status is "pending"', () => {
      const pendingMem: GymMembership = {
        id: 'mem-pending',
        gymId: mockGym.id,
        userId: 'u1',
        status: 'pending',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGym,
      };

      const ctx = deriveMemberGymContext([pendingMem]);
      expect(ctx.mode).toBe('home');
      expect(ctx.activeGym).toBeNull();
    });

    it('resolves mode "home" when status is "frozen" or "inactive"', () => {
      const statuses: Array<'frozen' | 'inactive'> = ['frozen', 'inactive'];
      for (const status of statuses) {
        const inactiveMem: GymMembership = {
          id: `mem-${status}`,
          gymId: mockGym.id,
          userId: 'u1',
          status,
          membershipType: 'monthly',
          joinedAt: new Date().toISOString(),
          gym: mockGym,
        };
        const ctx = deriveMemberGymContext([inactiveMem]);
        expect(ctx.mode).toBe('home');
        expect(ctx.activeGym).toBeNull();
      }
    });

    it('resolves mode "integrated" with activeGym ONLY when status is "active"', () => {
      const activeMem: GymMembership = {
        id: 'mem-active',
        gymId: mockGym.id,
        userId: 'u1',
        status: 'active',
        membershipType: 'monthly',
        joinedAt: new Date().toISOString(),
        gym: mockGym,
      };

      const ctx = deriveMemberGymContext([activeMem]);
      expect(ctx.mode).toBe('integrated');
      expect(ctx.activeGym?.id).toBe(mockGym.id);
      expect(ctx.activeMembership?.status).toBe('active');
    });
  });
});
