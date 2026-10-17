import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@brd/ui';
import type { UserDto, RoleName } from '@brd/shared';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { clearUserStorage } from '@/lib/storage';

interface AuthContextValue {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** The session check failed for a reason other than "not signed in" (network, server error). */
  isError?: boolean;
  retry?: () => void;
  role: RoleName | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ user: UserDto }>('/auth/me');
        return res.user;
      } catch (err) {
        // Only "not signed in" means logged out; network and server errors must stay visible.
        if (err instanceof ApiClientError && err.status === 401) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: STALE.reference,
  });

  const user = data ?? null;

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      toast.error(
        `Signed out here, but the server could not end the session: ${errorMessage(err)}`,
      );
    }
    if (user) clearUserStorage(user.id);
    // Drop every cached response so the next person on this browser cannot see this one's data.
    queryClient.clear();
    queryClient.setQueryData(queryKeys.auth.me(), null);
  }, [queryClient, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        isError,
        retry: () => void refetch(),
        role: (user?.role.name as RoleName) ?? null,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
