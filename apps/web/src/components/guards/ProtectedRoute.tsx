import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageError, PageLoader } from '@brd/ui';
import { loginUrl } from '@/lib/return-to';
import { useAuth } from '@/providers/auth-provider';

const CHANGE_PASSWORD_PATH = '/change-password';

export function ProtectedRoute() {
  const { user, isAuthenticated, isLoading, isError, retry } = useAuth();
  const { pathname, search } = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError) {
    return (
      <PageError
        variant="full"
        message="Could not check your session"
        description="The server did not respond as expected. Your sign-in is not affected."
        onRetry={retry}
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={loginUrl(`${pathname}${search}`)} replace />;
  }

  if (user?.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  return <Outlet />;
}
