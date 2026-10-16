import { Outlet } from 'react-router-dom';
import type { RoleName } from '@brd/shared';
import { useAuth } from '@/providers/auth-provider';
import { NoAccessPage } from '@/pages/NoAccessPage';

interface RoleGuardProps {
  roles: RoleName[];
}

export function RoleGuard({ roles }: RoleGuardProps) {
  const { role } = useAuth();

  if (!role || !roles.includes(role)) {
    return <NoAccessPage />;
  }

  return <Outlet />;
}
