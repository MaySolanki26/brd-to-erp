import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InformativeBar, ThemeProvider } from '@brd/ui';
import { makeAuth, makeUser } from '@/test/render';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));

import { AppLayout } from './AppLayout';

function Page({ title }: { title: string }) {
  return <InformativeBar title={title} info={`About ${title}`} />;
}

function renderLayout(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Page title="Dashboard" />} />
              <Route path="projects" element={<Page title="Projects" />} />
              <Route path="projects/:projectId" element={<Page title="Billing BRD" />} />
              <Route path="team" element={<Page title="Team" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const PROJECT = { id: 'p1', name: 'Billing BRD', myRole: 'OWNER', status: 'ACTIVE' };

describe('AppLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('style');
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    auth.current = makeAuth(makeUser());
    api.get.mockImplementation(async (path: string) => {
      if (path.startsWith('/projects/p1')) return { project: PROJECT };
      throw new Error(`unexpected ${path}`);
    });
  });

  it('shows the modules on the rail and the page title in the top bar', () => {
    renderLayout('/projects');
    const rail = screen.getByRole('navigation', { name: 'Modules' });
    expect(within(rail).getByRole('button', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(rail).getByRole('button', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Module navigation' })).toBeInTheDocument();
  });

  it('hides the Team module from people who are not organization admins', () => {
    auth.current = makeAuth(
      makeUser({ orgRole: 'MEMBER', role: { id: 'MEMBER', name: 'MEMBER' } }),
    );
    renderLayout('/projects');
    expect(
      within(screen.getByRole('navigation', { name: 'Modules' })).queryByRole('button', {
        name: 'Team',
      }),
    ).not.toBeInTheDocument();
  });

  it('has no breadcrumb row', () => {
    renderLayout('/projects');
    expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
  });

  it("lists the open project's tabs in the sidebar and marks the current one", async () => {
    renderLayout('/projects/p1?tab=rules');
    const sidebar = await screen.findByRole('navigation', { name: 'Module navigation' });
    expect(await within(sidebar).findByRole('button', { name: 'Rules' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar).getByRole('button', { name: 'Members' })).toBeInTheDocument();
  });

  it('keeps stars per person, saved on this device', async () => {
    renderLayout('/projects');
    await userEvent.click(screen.getByRole('button', { name: 'Add All projects to favorites' }));
    expect(
      within(screen.getByRole('region', { name: 'Favorites' })).getByRole('button', {
        name: 'All projects',
      }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('brd:user:me:favorites:v2')).toContain('page:/projects');
  });

  it('collapses the sidebar from the top and brings it back from the top bar, and remembers it', async () => {
    renderLayout('/projects');
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.queryByRole('navigation', { name: 'Module navigation' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('brd:app:sidebar:v1')).toContain('"collapsed":true');
    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('navigation', { name: 'Module navigation' })).toBeInTheDocument();
  });

  it('opens search with Ctrl+K and jumps to a page', async () => {
    renderLayout('/projects');
    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.type(await screen.findByPlaceholderText('Type a page or action…'), 'team');
    await userEvent.click(await screen.findByRole('option', { name: /Team/ }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Team' })).toBeInTheDocument(),
    );
  });

  it('applies the chosen palette and keeps them on this device', async () => {
    renderLayout('/projects');
    await userEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Ocean' }));
    expect(document.documentElement.style.getPropertyValue('--color-primary')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--pal-accent')).not.toBe('');
    expect(window.localStorage.getItem('brd:app:appearance:v2')).toContain('"paletteId":"ocean"');
  });

  it('shows sample notifications labelled as sample data', async () => {
    renderLayout('/projects');
    await userEvent.click(screen.getByRole('button', { name: /^Notifications/ }));
    expect(screen.getByText(/Sample notifications/)).toBeInTheDocument();
  });
});
