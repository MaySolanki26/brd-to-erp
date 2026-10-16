import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '@brd/ui';
import { useAuth } from '@/providers/auth-provider';

const CHANGE_PASSWORD_PATH = '/change-password';

export function ProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  return <Outlet />;
}
