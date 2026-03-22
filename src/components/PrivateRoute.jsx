import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_LEVELS = {
  member: 1,
  secretary: 2,
  admin: 3,
};

const resolveRoleLevel = (role) => ROLE_LEVELS[role] || 0;

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const userLevel = resolveRoleLevel(user.role);
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const hasRequiredRole = requiredRoles.some((role) => userLevel >= resolveRoleLevel(role));

    if (!hasRequiredRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default PrivateRoute;
