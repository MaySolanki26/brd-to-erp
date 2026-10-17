import type { ReactNode } from 'react';
import { useCan } from '@/hooks/use-can';
import type { AccessRule } from '@/lib/permissions';

type CanProps = AccessRule & {
  children: ReactNode;
  /** Shown instead of the children when the user is not allowed. */
  fallback?: ReactNode;
};

/** Shows its children only to users who pass the rule. Use for buttons and menu items. */
export function Can({ children, fallback = null, ...rule }: CanProps) {
  const can = useCan();
  return <>{can(rule as AccessRule) ? children : fallback}</>;
}
