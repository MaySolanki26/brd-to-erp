import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDto, RoleName } from '@brd/shared';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

interface AuthContextValue {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: RoleName | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ user: UserDto }>('/auth/me');
        return res.user;
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          return null;
        }
        return null;
      }
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const user = data ?? null;

  const logout = useCallback(() => {
    apiClient.post('/auth/logout').catch(() => {});
    queryClient.setQueryData(queryKeys.auth.me(), null);
    window.location.href = '/login';
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
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
