import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '@/test/render';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));

import { ApiClientError } from '@/lib/api-client';
import { ModulesTab } from './components/ModulesTab';
import { RulesTab } from './components/RulesTab';
import { SOURCE_LISTS, moduleItem, page, rule, source } from './knowledge-fixtures';

function mockApi(handlers: { rules?: () => unknown; modules?: () => unknown }) {
  api.get.mockImplementation(async (url: string) => {
    if (url.startsWith('/projects/p1/rules')) return (handlers.rules ?? (() => page([])))();
    if (url.startsWith('/projects/p1/modules')) return (handlers.modules ?? (() => page([])))();
    if (url.startsWith('/projects/p1/documents')) return SOURCE_LISTS.documents;
    if (url.startsWith('/projects/p1/notes')) return SOURCE_LISTS.notes;
    throw new Error(`unexpected GET ${url}`);
  });
}

const route = { path: '/projects/:projectId', initialEntry: '/projects/p1' };

const lastUrl = (prefix: string): string =>
  [...api.get.mock.calls]
    .map((c) => c[0] as string)
    .reverse()
    .find((u) => u.startsWith(prefix)) ?? '';

describe('RulesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists rules with status, module and source', async () => {
    mockApi({ rules: () => page([rule()]) });
    renderRoute(<RulesTab projectId="p1" />, route);
    const row = await screen.findByRole('row', { name: /VAT rate/ });
    expect(within(row).getByText('Open')).toBeInTheDocument();
    expect(within(row).getByText('Billing')).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: /View source: Billing BRD v1/ }),
    ).toBeInTheDocument();
  });

  it('highlights a rule that needs revalidation', async () => {
    mockApi({
      rules: () =>
        page([
          rule({ id: 'a', title: 'Calm rule' }),
          rule({ id: 'b', title: 'Stale rule', status: 'NEEDS_REVALIDATION' }),
          rule({ id: 'c', title: 'Unclear rule', source: source({ needsReview: true }) }),
        ]),
    });
    renderRoute(<RulesTab projectId="p1" />, route);
    await screen.findByText('Stale rule');
    expect(screen.getByRole('row', { name: /Calm rule/ })).not.toHaveClass('row-attention');
    expect(screen.getByRole('row', { name: /Stale rule/ })).toHaveClass('row-attention');
    expect(screen.getByRole('row', { name: /Unclear rule/ })).toHaveClass('row-attention');
  });

  it('has its own filters, separate from the other tabs', async () => {
    mockApi({ rules: () => page([rule()]) });
    renderRoute(<RulesTab projectId="p1" />, {
      ...route,
      initialEntry: '/projects/p1?requirements.status=OPEN&rules.status=CONFIRMED',
    });
    await screen.findByText('VAT rate');
    expect(lastUrl('/projects/p1/rules')).toContain('status=CONFIRMED');
    expect(lastUrl('/projects/p1/rules')).not.toContain('status=OPEN');
  });

  it('shows empty, error and no-access states', async () => {
    mockApi({ rules: () => page([]) });
    const { unmount } = renderRoute(<RulesTab projectId="p1" />, route);
    expect(await screen.findByText('No rules yet')).toBeInTheDocument();
    unmount();

    mockApi({
      rules: () => {
        throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'rules boom');
      },
    });
    const second = renderRoute(<RulesTab projectId="p1" />, route);
    expect(await screen.findByText('rules boom')).toBeInTheDocument();
    second.unmount();

    mockApi({
      rules: () => {
        throw new ApiClientError(403, 'FORBIDDEN', 'no');
      },
    });
    renderRoute(<RulesTab projectId="p1" />, route);
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

describe('ModulesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists modules with code, requirement count and source', async () => {
    mockApi({ modules: () => page([moduleItem()]) });
    renderRoute(<ModulesTab projectId="p1" />, route);
    const row = await screen.findByRole('row', { name: /Billing \(BIL\)/ });
    expect(within(row).getByText('4')).toBeInTheDocument();
    expect(within(row).getByText('Confirmed')).toBeInTheDocument();
  });

  it('offers no module filter, since it lists the modules themselves', async () => {
    mockApi({ modules: () => page([moduleItem()]) });
    renderRoute(<ModulesTab projectId="p1" />, route);
    await screen.findByText('Billing (BIL)');
    expect(screen.queryByRole('combobox', { name: 'Filter by module' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
  });

  it('highlights a module that needs revalidation', async () => {
    mockApi({ modules: () => page([moduleItem({ status: 'NEEDS_REVALIDATION' })]) });
    renderRoute(<ModulesTab projectId="p1" />, route);
    expect(await screen.findByRole('row', { name: /Billing/ })).toHaveClass('row-attention');
  });

  it('searches modules', async () => {
    mockApi({ modules: () => page([moduleItem()]) });
    renderRoute(<ModulesTab projectId="p1" />, route);
    await screen.findByText('Billing (BIL)');
    await userEvent.type(screen.getByRole('textbox', { name: 'Search modules' }), 'bil');
    await waitFor(() => expect(lastUrl('/projects/p1/modules')).toContain('search=bil'));
  });

  it('shows an empty state', async () => {
    mockApi({ modules: () => page([]) });
    renderRoute(<ModulesTab projectId="p1" />, route);
    expect(await screen.findByText('No modules yet')).toBeInTheDocument();
  });
});
