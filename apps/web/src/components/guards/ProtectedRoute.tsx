import { Navigate, Outlet } from 'react-router-dom';
import { PageLoader } from '@brd/ui';
import { useAuth } from '@/providers/auth-provider';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
