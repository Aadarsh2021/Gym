import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Layouts & Contexts
import { PublicAppShell } from '@/layouts/PublicAppShell';
import { AppShell } from '@/layouts/AppShell';
import { OwnerAppShell } from '@/layouts/OwnerAppShell';
import { OwnerGymProvider } from '@/context/OwnerGymContext';
import { MemberGymProvider } from '@/context/MemberGymContext';

// Public Feature Pages
import { PublicHomeView } from '@/features/public-home/PublicHomeView';
import { HowItWorksView } from '@/features/public-pages/HowItWorksView';
import { PublicWorkoutsView } from '@/features/public-pages/PublicWorkoutsView';
import { PublicNutritionView } from '@/features/public-pages/PublicNutritionView';
import { PublicToolsView } from '@/features/public-pages/PublicToolsView';
import { PricingView } from '@/features/public-pages/PricingView';
import { ExerciseLibraryView } from '@/features/exercise-library/ExerciseLibraryView';

// Auth Pages
import { SignInView } from '@/features/auth/SignInView';
import { SignUpView } from '@/features/auth/SignUpView';
import { AuthCallbackView } from '@/features/auth/AuthCallbackView';
import { RoleSelectionView } from '@/features/auth/RoleSelectionView';
import { ForgotPasswordView } from '@/features/auth/ForgotPasswordView';
import { ResetPasswordView } from '@/features/auth/ResetPasswordView';

// Owner Console Pages
import { OwnerDashboardView } from '@/features/owner/OwnerDashboardView';
import { OwnerOnboardingView } from '@/features/owner/OwnerOnboardingView';
import { OwnerMembersView } from '@/features/owner/OwnerMembersView';
import { OwnerCommunityView } from '@/features/owner/OwnerCommunityView';
import { OwnerChallengesView } from '@/features/owner/OwnerChallengesView';
import { OwnerEventsView } from '@/features/owner/OwnerEventsView';
import { OwnerAnnouncementsView } from '@/features/owner/OwnerAnnouncementsView';
import { OwnerRewardsView } from '@/features/owner/OwnerRewardsView';
import { OwnerProfileView } from '@/features/owner/OwnerProfileView';
import { OwnerSettingsView } from '@/features/owner/OwnerSettingsView';

// Setup & Plan Flow
import { OnboardingRouteView } from '@/features/onboarding/OnboardingRouteView';
import { PlanBuilderView } from '@/features/plan/PlanBuilderView';
import { PlanReviewView } from '@/features/plan/PlanReviewView';

// Authenticated App Pages
import { AppDashboardRouteView } from '@/features/dashboard/AppDashboardRouteView';
import { WorkoutsRouteView } from '@/features/workouts/WorkoutsRouteView';
import { ActiveWorkoutRouteView } from '@/features/workout-tracker/ActiveWorkoutRouteView';
import { NutritionRouteView } from '@/features/nutrition/NutritionRouteView';
import { ProgressView } from '@/features/progress/ProgressView';
import { ProfileView } from '@/features/profile/ProfileView';
import { StreaksRouteView } from '@/features/streaks/StreaksRouteView';
import { MemberGymDiscoveryView } from '@/features/gym/MemberGymDiscoveryView';
import { MemberGymCheckInView } from '@/features/gym/MemberGymCheckInView';
import { MemberGymHistoryView } from '@/features/gym/MemberGymHistoryView';
import { MemberGymCommunityView } from '@/features/gym/MemberGymCommunityView';
import { MemberGymBuddiesView } from '@/features/gym/MemberGymBuddiesView';
import { MemberGymBuddyChatView } from '@/features/gym/MemberGymBuddyChatView';
import { MemberGymChallengesView } from '@/features/gym/MemberGymChallengesView';

// Route Guard
import { ProtectedRoute } from './ProtectedRoute';

/**
 * SmartHomeRoute
 *
 * Renders the public home page for unauthenticated visitors.
 * Redirects authenticated users to their corresponding destination (/app, /owner/dashboard, /auth/role-selection).
 * Automatically forwards OAuth hash fragments if an external provider redirects to the root URL.
 */
const SmartHomeRoute: React.FC = () => {
  const { session, loading } = useAuth();
  const location = useLocation();

  // If OAuth token or error is in hash/search at root URL, forward immediately to /auth/callback
  if (location.hash.includes('access_token=') || location.hash.includes('error=')) {
    return <Navigate to={`/auth/callback${location.hash}`} replace />;
  }
  if (location.search.includes('error=')) {
    return <Navigate to={`/auth/callback${location.search}`} replace />;
  }

  if (loading) {
    return <PublicHomeView />;
  }

  if (session.user) {
    if (session.profile?.roleSelected === false) {
      return <Navigate to="/auth/role-selection" replace />;
    }
    if (session.profile?.accountRole === 'gym_owner') {
      return <Navigate to="/owner/dashboard" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return <PublicHomeView />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. PUBLIC MARKETING & DISCOVERY ROUTES */}
      <Route element={<PublicAppShell />}>
        {/* Home: redirects authenticated users based on role */}
        <Route path="/" element={<SmartHomeRoute />} />
        <Route path="/how-it-works" element={<HowItWorksView />} />
        <Route path="/workouts" element={<PublicWorkoutsView />} />
        <Route path="/exercises" element={<ExerciseLibraryView />} />
        <Route path="/nutrition" element={<PublicNutritionView />} />
        <Route path="/tools" element={<PublicToolsView />} />
        <Route path="/tools/:toolId" element={<PublicToolsView />} />
        <Route path="/pricing" element={<PricingView />} />

        {/* AUTH */}
        <Route path="/signin" element={<SignInView />} />
        <Route path="/signup" element={<SignUpView />} />
        <Route path="/forgot-password" element={<ForgotPasswordView />} />
        <Route path="/auth/reset-password" element={<ResetPasswordView />} />
        {/* OAuth callback — public route, exchanges tokens & routes */}
        <Route path="/auth/callback" element={<AuthCallbackView />} />

        {/* POST-AUTH ROLE SELECTION */}
        <Route
          path="/auth/role-selection"
          element={
            <ProtectedRoute>
              <RoleSelectionView />
            </ProtectedRoute>
          }
        />

        {/* GYM OWNER ONBOARDING FLOW */}
        <Route
          path="/owner/onboarding"
          element={
            <ProtectedRoute allowedRoles={['gym_owner', 'platform_admin']}>
              <OwnerGymProvider>
                <OwnerOnboardingView />
              </OwnerGymProvider>
            </ProtectedRoute>
          }
        />

        {/* SETUP & PLAN CREATION FLOW */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute allowedRoles={['member', 'platform_admin']}>
              <OnboardingRouteView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan/build"
          element={
            <ProtectedRoute allowedRoles={['member', 'platform_admin']}>
              <PlanBuilderView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan/review"
          element={
            <ProtectedRoute allowedRoles={['member', 'platform_admin']}>
              <PlanReviewView />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 2. AUTHENTICATED ATHLETE APPLICATION OS ROUTES */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <MemberGymProvider>
              <AppShell />
            </MemberGymProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<AppDashboardRouteView />} />
        <Route path="workouts" element={<WorkoutsRouteView />} />
        <Route path="workouts/active" element={<ActiveWorkoutRouteView />} />
        <Route path="exercises" element={<ExerciseLibraryView />} />
        <Route path="gym" element={<MemberGymDiscoveryView />} />
        <Route path="gym/check-in" element={<MemberGymCheckInView />} />
        <Route path="gym/history" element={<MemberGymHistoryView />} />
        <Route path="gym/community" element={<MemberGymCommunityView />} />
        <Route path="gym/buddies" element={<MemberGymBuddiesView />} />
        <Route path="gym/buddies/:connectionId/chat" element={<MemberGymBuddyChatView />} />
        <Route path="gym/challenges" element={<MemberGymChallengesView />} />
        <Route path="nutrition" element={<NutritionRouteView />} />
        <Route path="progress" element={<ProgressView />} />
        <Route path="streaks" element={<StreaksRouteView />} />
        <Route path="profile" element={<ProfileView />} />
      </Route>
 
      {/* 3. AUTHENTICATED GYM OWNER CONSOLE OS ROUTES */}
      <Route
        path="/owner"
        element={
          <ProtectedRoute allowedRoles={['gym_owner', 'platform_admin']}>
            <OwnerGymProvider>
              <OwnerAppShell />
            </OwnerGymProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/owner/dashboard" replace />} />
        <Route path="dashboard" element={<OwnerDashboardView />} />
        <Route path="members" element={<OwnerMembersView />} />
        <Route path="community" element={<OwnerCommunityView />} />
        <Route path="challenges" element={<OwnerChallengesView />} />
        <Route path="events" element={<OwnerEventsView />} />
        <Route path="announcements" element={<OwnerAnnouncementsView />} />
        <Route path="rewards" element={<OwnerRewardsView />} />
        <Route path="profile" element={<OwnerProfileView />} />
        <Route path="settings" element={<OwnerSettingsView />} />
      </Route>

      {/* 4. CATCH-ALL */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
