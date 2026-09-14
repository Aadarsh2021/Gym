import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AccountRole } from '@/types/user.types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: AccountRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Checking authentication...</p>
      </div>
    );
  }

  // 1. If user is not authenticated, redirect to signin with return path
  if (!session.user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // 2. If user has not selected an account role, redirect to role selection
  if (session.profile?.roleSelected === false && location.pathname !== '/auth/role-selection') {
    return <Navigate to="/auth/role-selection" replace />;
  }

  // 3. Role authorization check (if specific roles are required for this route)
  if (allowedRoles && allowedRoles.length > 0) {
    const currentRole = session.profile?.accountRole || 'member';
    if (!allowedRoles.includes(currentRole)) {
      // If unauthorized for gym owner route, send to app
      return <Navigate to="/app" replace />;
    }
  }

  return children;
};
