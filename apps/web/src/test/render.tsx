import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { UserDto } from '@brd/shared';
import { LocationProbe } from './LocationProbe';

export function makeUser(overrides: Partial<UserDto> = {}): UserDto {
  return {
    id: 'me',
    email: 'me@brd.test',
    name: 'Me Admin',
    organizationId: 'org1',
    orgRole: 'ORG_ADMIN',
    mustChangePassword: false,
    role: { id: 'ORG_ADMIN', name: 'ORG_ADMIN' },
    ...overrides,
  };
}

export function makeAuth(user: UserDto | null) {
  return {
    user,
    isAuthenticated: user !== null,
    isLoading: false,
    isError: false,
    retry: () => {},
    role: user?.orgRole ?? null,
    logout: async () => {},
  };
}

interface RenderRouteOptions {
  /** Route pattern the element is mounted on, e.g. /projects/:projectId. */
  path?: string;
  /** URL to start at. Defaults to the route pattern. */
  initialEntry?: string;
}

/** Renders inside a fresh query client and memory router; other routes render their path as text. */
export function renderRoute(element: ReactElement, options: RenderRouteOptions = {}): RenderResult {
  const path = options.path ?? '/';
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options.initialEntry ?? path]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
