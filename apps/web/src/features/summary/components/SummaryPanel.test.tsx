import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '@/test/render';
import { summary, summaryResponse } from '@/features/questions/question-fixtures';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  upload: vi.fn(),
}));
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));
vi.mock('@brd/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@brd/ui')>()),
  toast: toastMock,
}));

import { ApiClientError } from '@/lib/api-client';
import { SummaryPanel } from './SummaryPanel';

const SUMMARY_URL = '/projects/p1/summary';
const view = (canRefresh = true) =>
  renderRoute(<SummaryPanel projectId="p1" canRefresh={canRefresh} />);

const older = summary({
  version: 1,
  generatedAt: '2026-03-01T09:00:00.000Z',
  content: { ...summary().content, overview: 'The first understanding.' },
});

function serve(latest = summary()) {
  api.get.mockImplementation(async (url: string) => {
    if (url === `${SUMMARY_URL}?version=1`) return summaryResponse(older);
    if (url === SUMMARY_URL) return summaryResponse(latest);
    throw new Error(`unexpected GET ${url}`);
  });
}

describe('SummaryPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    serve();
  });

  afterEach(() => vi.useRealTimers());

  describe('states', () => {
    it('shows loading placeholders first', () => {
      api.get.mockReturnValue(new Promise(() => {}));
      view();
      expect(screen.getByLabelText('Loading the summary')).toBeInTheDocument();
    });

    it('invites people who can refresh to generate the first summary', async () => {
      api.get.mockResolvedValue(summaryResponse(null));
      view();
      expect(await screen.findByText('No summary yet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Generate summary' })).toBeInTheDocument();
    });

    it('only explains the empty state to everyone else', async () => {
      api.get.mockResolvedValue(summaryResponse(null));
      view(false);
      expect(await screen.findByText('No summary yet')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Generate summary' })).not.toBeInTheDocument();
    });

    it('shows an error with a working retry', async () => {
      api.get.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
      view();
      expect(await screen.findByText('Could not load the summary')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(await screen.findByText('An invoicing ERP for small retailers.')).toBeInTheDocument();
    });

    it('shows no-access when the API forbids reading', async () => {
      api.get.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'nope'));
      view();
      expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    it('shows every section of the latest summary', async () => {
      view();
      expect(await screen.findByText('An invoicing ERP for small retailers.')).toBeInTheDocument();
      expect(screen.getByText(/Invoices and payments\./).closest('li')).toHaveTextContent(
        'Finance',
      );
      expect(screen.getByText('Approve invoices')).toBeInTheDocument();
      expect(screen.getByText(/Core flow\./)).toBeInTheDocument();
      expect(screen.getAllByText('Limit is 10k').length).toBeGreaterThan(0);
      expect(screen.getByText(/Applies to everyone\./)).toBeInTheDocument();
      expect(screen.getByText('Old export')).toBeInTheDocument();
      expect(screen.getByText('Built from 12 requirements, 5 rules.')).toBeInTheDocument();
    });

    it('omits sections that are empty', async () => {
      serve(
        summary({
          content: {
            overview: 'Small project.',
            modules: [],
            keyRequirements: [],
            keyRules: [],
            assumptions: [],
            staleItems: [],
          },
          basedOn: {},
        }),
      );
      view();
      await screen.findByText('Small project.');
      for (const heading of [
        'Modules',
        'Key requirements',
        'Key rules',
        'Assumptions',
        'Needs a second look',
      ]) {
        expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
      }
      expect(screen.queryByText(/Built from/)).not.toBeInTheDocument();
    });
  });

  describe('versions', () => {
    it('lists versions newest first in the selector, with the latest chosen', async () => {
      view();
      const selector = await screen.findByRole('button', { name: /^Summary version: Version 2/ });
      await userEvent.click(selector);
      const options = await screen.findAllByRole('option');
      expect(options.map((o) => o.textContent?.split(' · ')[0])).toEqual([
        'Version 2',
        'Version 1',
      ]);
    });

    it('shows an older version and a way back to the latest', async () => {
      view();
      await userEvent.click(await screen.findByRole('button', { name: /^Summary version/ }));
      await userEvent.click(await screen.findByRole('option', { name: /Version 1/ }));

      expect(await screen.findByText('The first understanding.')).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith(`${SUMMARY_URL}?version=1`);
      expect(screen.getByText(/Viewing version 1 of 2\./)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Show latest' }));
      expect(await screen.findByText('An invoicing ERP for small retailers.')).toBeInTheDocument();
      expect(screen.queryByText(/Viewing version/)).not.toBeInTheDocument();
    });

    it('has no selector before any summary exists', async () => {
      api.get.mockResolvedValue(summaryResponse(null));
      view();
      await screen.findByText('No summary yet');
      expect(screen.queryByRole('button', { name: /^Summary version/ })).not.toBeInTheDocument();
    });
  });

  describe('refreshing', () => {
    it('is not offered to people who cannot refresh', async () => {
      view(false);
      await screen.findByText('An invoicing ERP for small retailers.');
      expect(screen.queryByRole('button', { name: 'Refresh summary' })).not.toBeInTheDocument();
    });

    it('asks for a refresh, waits for a newer version, then shows it', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      api.post.mockResolvedValue({ requested: true });
      view();
      await screen.findByText('An invoicing ERP for small retailers.');

      await userEvent.click(screen.getByRole('button', { name: 'Refresh summary' }));
      expect(api.post).toHaveBeenCalledWith('/projects/p1/summary/refresh');
      expect(await screen.findByRole('button', { name: /Updating/ })).toBeDisabled();

      const newest = summary({
        version: 3,
        generatedAt: '2026-03-03T09:00:00.000Z',
        content: { ...summary().content, overview: 'A fresh understanding.' },
      });
      api.get.mockImplementation(async () =>
        summaryResponse(newest, [
          { version: 3, generatedAt: '2026-03-03T09:00:00.000Z' },
          { version: 2, generatedAt: '2026-03-02T09:00:00.000Z' },
        ]),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });

      expect(await screen.findByText('A fresh understanding.')).toBeInTheDocument();
      expect(toastMock.success).toHaveBeenCalledWith('The summary was updated.');
      expect(screen.getByRole('button', { name: 'Refresh summary' })).toBeEnabled();
    });

    it('gives up waiting after a while and says so', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      api.post.mockResolvedValue({ requested: true });
      view();
      await screen.findByText('An invoicing ERP for small retailers.');
      await userEvent.click(screen.getByRole('button', { name: 'Refresh summary' }));
      await screen.findByRole('button', { name: /Updating/ });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(91_000);
      });
      expect(toastMock.info).toHaveBeenCalledWith(
        expect.stringMatching(/taking longer than usual/),
      );
      expect(screen.getByRole('button', { name: 'Refresh summary' })).toBeEnabled();
    });

    it('shows the server message when the refresh cannot be started', async () => {
      api.post.mockRejectedValue(
        new ApiClientError(
          503,
          'SERVICE_UNAVAILABLE',
          'Could not start the summary refresh. Try again shortly.',
        ),
      );
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Refresh summary' }));
      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith(
          'Could not start the summary refresh. Try again shortly.',
        ),
      );
      expect(screen.getByRole('button', { name: 'Refresh summary' })).toBeEnabled();
    });

    it('generates the first summary from the empty state', async () => {
      api.get.mockResolvedValue(summaryResponse(null));
      api.post.mockResolvedValue({ requested: true });
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Generate summary' }));
      expect(api.post).toHaveBeenCalledWith('/projects/p1/summary/refresh');
      expect(
        within(screen.getByRole('region', { name: 'Project summary' })).getByRole('button', {
          name: /Generating/,
        }),
      ).toBeDisabled();
    });
  });
});
