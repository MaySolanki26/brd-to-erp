import type { ReactNode } from 'react';
import type { RoleName } from '@brd/shared';
import { useAuth } from '@/providers/auth-provider';

interface CanProps {
  role?: RoleName;
  roles?: RoleName[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ role, roles, children, fallback = null }: CanProps) {
  const { role: userRole } = useAuth();
  if (!userRole) return <>{fallback}</>;

  const allowed = roles ?? (role ? [role] : []);
  if (allowed.length > 0 && !allowed.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
