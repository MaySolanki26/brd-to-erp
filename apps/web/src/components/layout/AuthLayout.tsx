import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { PageLoader } from '@brd/ui';
import { safeReturnTo } from '@/lib/return-to';
import { useAuth } from '@/providers/auth-provider';

/** Wraps the signed-out pages. Someone who is already signed in is sent on to the app. */
export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [params] = useSearchParams();

  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to={safeReturnTo(params.get('returnTo'))} replace />;
  return <Outlet />;
}
