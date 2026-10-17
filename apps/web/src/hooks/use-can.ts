import { isAllowed, type AccessRule } from '@/lib/permissions';
import { useAuth } from '@/providers/auth-provider';

/** Returns a checker for the signed-in user. It answers "no" until the user has loaded. */
export function useCan(): (rule: AccessRule) => boolean {
  const { role } = useAuth();
  return (rule) => isAllowed(role, rule);
}
