import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoleAccess } from '@/lib/accessControl';

const PrivateRoute = ({ children, requiredRole, requiredModule, requiredModulePermission = 'read' }) => {
  const { user, loading, hasModuleAccess } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.requiresPasswordChange && location.pathname !== '/dashboard/password') {
    return <Navigate to="/dashboard/password" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    if (!hasRoleAccess(user.role, requiredRoles)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (requiredModule && !hasModuleAccess(requiredModule, requiredModulePermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PrivateRoute;
