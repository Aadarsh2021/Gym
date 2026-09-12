import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Layouts
import { PublicAppShell } from '@/layouts/PublicAppShell';
import { AppShell } from '@/layouts/AppShell';

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
import { ForgotPasswordView } from '@/features/auth/ForgotPasswordView';
import { ResetPasswordView } from '@/features/auth/ResetPasswordView';

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

// Route Guard
import { ProtectedRoute } from './ProtectedRoute';

/**
 * SmartHomeRoute
 *
 * Renders the public home page for unauthenticated visitors.
 * Redirects authenticated users to /app, preventing the confusing state
 * where a successfully logged-in user sees "Sign In / Get Started" CTAs.
 *
 * Does NOT redirect during the initial auth loading window — it waits until
 * the session state is resolved to avoid a flash-redirect on cold load.
 */
const SmartHomeRoute: React.FC = () => {
  const { session, loading } = useAuth();

  // While session state is being restored (e.g. on page refresh), render
  // the public home temporarily. This avoids a redirect loop and looks
  // natural — the user sees the page briefly, then gets redirected.
  if (loading) {
    return <PublicHomeView />;
  }

  if (session.user) {
    return <Navigate to="/app" replace />;
  }

  return <PublicHomeView />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. PUBLIC MARKETING & DISCOVERY ROUTES */}
      <Route element={<PublicAppShell />}>
        {/* Home: redirects authenticated users to /app */}
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
        {/* OAuth callback — must remain a public route, never inside ProtectedRoute */}
        <Route path="/auth/callback" element={<AuthCallbackView />} />

        {/* SETUP & PLAN CREATION FLOW */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingRouteView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan/build"
          element={
            <ProtectedRoute>
              <PlanBuilderView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan/review"
          element={
            <ProtectedRoute>
              <PlanReviewView />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 2. AUTHENTICATED APPLICATION OS ROUTES */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AppDashboardRouteView />} />
        <Route path="workouts" element={<WorkoutsRouteView />} />
        <Route path="workouts/active" element={<ActiveWorkoutRouteView />} />
        <Route path="exercises" element={<ExerciseLibraryView />} />
        <Route path="nutrition" element={<NutritionRouteView />} />
        <Route path="progress" element={<ProgressView />} />
        <Route path="profile" element={<ProfileView />} />
      </Route>

      {/* 3. CATCH-ALL */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
