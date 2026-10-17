import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QuestionCountsDto, QuestionDto } from '@brd/shared';
import { renderRoute } from '@/test/render';
import { counts, linkedItem, page, question } from '../question-fixtures';

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
import { QuestionsTab } from './QuestionsTab';

const COUNTS_URL = '/projects/p1/questions/counts';
const listUrl = (query: string) => `/projects/p1/questions?page=1&pageSize=50${query}`;

type Responder = (url: string) => unknown;

function serve(responder: Responder, countsData: QuestionCountsDto = counts()) {
  api.get.mockImplementation(async (url: string) => {
    if (url === COUNTS_URL) return { counts: countsData };
    if (url.startsWith('/projects/p1/questions?')) return responder(url);
    throw new Error(`unexpected GET ${url}`);
  });
}

const serveItems = (items: QuestionDto[], countsData?: QuestionCountsDto) =>
  serve(() => page(items), countsData);

const view = (props: { canAnswer?: boolean; entry?: string } = {}) =>
  renderRoute(<QuestionsTab projectId="p1" canAnswer={props.canAnswer ?? true} />, {
    path: '/',
    initialEntry: props.entry ?? '/',
  });

const card = (text: string) => screen.getByRole('article', { name: text });

const NOT_FOUND = 'This question was already answered by Bob Member. Refresh to see the latest.';

describe('QuestionsTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    serveItems([question()]);
  });

  describe('states', () => {
    it('shows loading placeholders first', () => {
      api.get.mockReturnValue(new Promise(() => {}));
      view();
      expect(screen.getByRole('heading', { name: 'Questions' })).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });

    it('shows an error with a working retry', async () => {
      api.get.mockImplementation(async (url: string) => {
        if (url === COUNTS_URL) return { counts: counts() };
        throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom');
      });
      view();
      expect(await screen.findByText('Could not load questions')).toBeInTheDocument();

      serveItems([question()]);
      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(await screen.findByText('What happens to unpaid invoices?')).toBeInTheDocument();
    });

    it('shows no-access when the API forbids reading', async () => {
      api.get.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'nope'));
      view();
      expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    });

    it('explains that questions come after analysis when there are none at all', async () => {
      serveItems([], counts({ byStatus: { OPEN: 0, ANSWERED: 0, DISMISSED: 0 } }));
      view();
      expect(await screen.findByText('No questions yet')).toBeInTheDocument();
    });

    it('celebrates when nothing is left open', async () => {
      serveItems([], counts({ byStatus: { OPEN: 0, ANSWERED: 3, DISMISSED: 1 } }));
      view();
      expect(await screen.findByText('All caught up')).toBeInTheDocument();
    });

    it('offers to reset when filters hide everything, and resetting reloads', async () => {
      serveItems([]);
      view({ entry: '/?questions.priority=CRITICAL' });
      expect(await screen.findByText('No questions match these filters')).toBeInTheDocument();

      await userEvent.click(
        screen.getAllByRole('button', { name: 'Reset filters' })[0] as HTMLElement,
      );
      await waitFor(() => expect(api.get).toHaveBeenCalledWith(listUrl('&status=OPEN')));
      expect(screen.queryByText('No questions match these filters')).not.toBeInTheDocument();
    });
  });

  describe('listing', () => {
    it('shows the open and critical totals', async () => {
      view();
      expect(await screen.findByText('2 open · 1 critical')).toBeInTheDocument();
    });

    it('groups by module, most urgent group first, with General last', async () => {
      serveItems([
        question({ id: 'a', text: 'General one', priority: 'CRITICAL' }),
        question({
          id: 'b',
          text: 'Sales one',
          priority: 'NORMAL',
          module: { id: 'm1', name: 'Sales' },
        }),
        question({
          id: 'c',
          text: 'Finance one',
          priority: 'HIGH',
          module: { id: 'm2', name: 'Finance' },
        }),
      ]);
      view();
      await screen.findByText('General one');
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        'Finance',
        'Sales',
        'General',
      ]);
    });

    it('orders questions inside a group by priority and shows priority and reason badges', async () => {
      serveItems([
        question({ id: 'a', text: 'Normal one', priority: 'NORMAL', reason: 'AMBIGUITY' }),
        question({ id: 'b', text: 'Critical one', priority: 'CRITICAL', reason: 'CONFLICT' }),
      ]);
      view();
      await screen.findByText('Critical one');
      const order = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
      expect(order).toEqual(['Critical one', 'Normal one']);
      expect(within(card('Critical one')).getByText('Critical')).toBeInTheDocument();
      expect(within(card('Critical one')).getByText('Conflict')).toBeInTheDocument();
      expect(within(card('Normal one')).getByText('Ambiguity')).toBeInTheDocument();
    });

    it('shows the items a question is about, inline', async () => {
      serveItems([
        question({
          linkedItems: [
            linkedItem({ kind: 'requirement', id: 'r1', title: 'Approve invoices', status: 'OPEN' }),
            linkedItem({ kind: 'rule', id: 'u1', title: 'Limit is 10k', status: 'CONFIRMED' }),
            linkedItem({ kind: 'module', id: 'm1', title: 'Finance', status: 'ASSUMED' }),
          ],
        }),
      ]);
      view();
      const list = await screen.findByRole('list', { name: 'Linked items' });
      const items = within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent);
      expect(items[0]).toContain('Requirement');
      expect(items[0]).toContain('Approve invoices');
      expect(items[0]).toContain('Open');
      expect(items[1]).toContain('Rule');
      expect(items[1]).toContain('Confirmed');
      expect(items[2]).toContain('Module');
      expect(items[2]).toContain('Assumed');
    });

    it('opens the exact text a linked item was taken from, so the answer can be informed', async () => {
      api.get.mockImplementation(async (url: string) => {
        if (url === COUNTS_URL) return { counts: counts() };
        if (url.startsWith('/projects/p1/questions?')) {
          return page([question({ linkedItems: [linkedItem({ title: 'Approve invoices' })] })]);
        }
        if (url === '/projects/p1/chunks/c1') {
          return {
            chunk: {
              id: 'c1',
              chunkIndex: 0,
              headingPath: ['1. Scope', '1.1 Invoicing'],
              content: 'Invoices above 10k need a second approval.',
              needsReview: false,
              source: { type: 'document', sourceId: 'd1', sourceTitle: 'Billing BRD', versionNumber: 1 },
            },
          };
        }
        throw new Error(`unexpected GET ${url}`);
      });
      view();
      const list = await screen.findByRole('list', { name: 'Linked items' });
      await userEvent.click(
        within(list).getByRole('button', { name: /View source: Billing BRD v1, 1\.1 Invoicing/ }),
      );

      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText('Invoices above 10k need a second approval.')).toBeInTheDocument();
      expect(within(dialog).getByText('1. Scope › 1.1 Invoicing')).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/projects/p1/chunks/c1');
    });

    it('marks follow-up questions', async () => {
      serveItems([question({ followUpOf: 'q0' })]);
      view();
      expect(await screen.findByText('Follow-up')).toBeInTheDocument();
    });

    it('shows the answer, and says when it is still being applied', async () => {
      serveItems([
        question({
          status: 'ANSWERED',
          answer: {
            id: 'a1',
            text: 'Remind after 7 days.',
            answeredBy: { id: 'u2', name: 'Bob Member' },
            answeredAt: '2026-02-01T00:00:00.000Z',
            applied: false,
          },
        }),
      ]);
      view({ entry: '/?questions.status=all' });
      const answered = await screen.findByRole('article');
      expect(within(answered).getByText('Remind after 7 days.')).toBeInTheDocument();
      expect(within(answered).getByText(/Answered by Bob Member/)).toHaveTextContent(
        'being applied',
      );
      expect(within(answered).getByText('Answered')).toBeInTheDocument();
      expect(within(answered).queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('does not mention applying once the answer has been applied', async () => {
      serveItems([
        question({
          status: 'ANSWERED',
          answer: {
            id: 'a1',
            text: 'Done.',
            answeredBy: { id: 'u2', name: 'Bob Member' },
            answeredAt: '2026-02-01T00:00:00.000Z',
            applied: true,
          },
        }),
      ]);
      view({ entry: '/?questions.status=all' });
      expect(await screen.findByText(/Answered by Bob Member/)).not.toHaveTextContent(
        'being applied',
      );
    });

    it('shows why a question was dismissed', async () => {
      serveItems([
        question({
          status: 'DISMISSED',
          dismissal: { reason: 'Out of scope for phase 1', at: '2026-02-03T00:00:00.000Z' },
        }),
      ]);
      view({ entry: '/?questions.status=all' });
      expect(await screen.findByText('Out of scope for phase 1')).toBeInTheDocument();
      expect(screen.getByText('Dismissed')).toBeInTheDocument();
    });

    it('tells each group its true size even before every page has loaded', async () => {
      const finance = { id: 'm1', name: 'Finance' };
      serve(() =>
        page([question({ id: 'a', text: 'First', module: finance, priority: 'HIGH' })], {
          pageSize: 1,
          total: 4,
          moduleCounts: [
            { moduleId: 'm1', total: 3, mostUrgent: 'HIGH' },
            { moduleId: null, total: 1, mostUrgent: 'NORMAL' },
          ],
        }),
      );
      view();
      const section = (await screen.findByRole('heading', { name: 'Finance' })).closest('section');
      expect(within(section as HTMLElement).getByLabelText('3 questions')).toBeInTheDocument();
      expect(within(section as HTMLElement).getByText('showing 1')).toBeInTheDocument();
    });

    it('does not say "showing" once a group is fully loaded', async () => {
      serve(() =>
        page([question({ id: 'a', module: { id: 'm1', name: 'Finance' } })], {
          moduleCounts: [{ moduleId: 'm1', total: 1, mostUrgent: 'NORMAL' }],
        }),
      );
      view();
      await screen.findByRole('heading', { name: 'Finance' });
      expect(screen.queryByText(/^showing/)).not.toBeInTheDocument();
    });

    it('loads more pages and says how many are shown', async () => {
      serve((url) =>
        url.includes('page=2')
          ? page([question({ id: 'c', text: 'Third' })], { page: 2, pageSize: 2, total: 3 })
          : page([question({ id: 'a', text: 'First' }), question({ id: 'b', text: 'Second' })], {
              pageSize: 2,
              total: 3,
            }),
      );
      view();
      expect(await screen.findByText('Showing 2 of 3')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
      expect(await screen.findByText('Third')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });
  });

  describe('filters (kept in the address)', () => {
    it('asks for open questions by default', async () => {
      view();
      await screen.findByText('What happens to unpaid invoices?');
      expect(api.get).toHaveBeenCalledWith(listUrl('&status=OPEN'));
    });

    it('reads status, reason and priority from the address', async () => {
      view({
        entry: '/?questions.status=ANSWERED&questions.reason=CONFLICT&questions.priority=HIGH',
      });
      await screen.findByText('What happens to unpaid invoices?');
      expect(api.get).toHaveBeenCalledWith(
        listUrl('&status=ANSWERED&reason=CONFLICT&priority=HIGH'),
      );
    });

    it('treats status=all as every status and ignores values it does not know', async () => {
      view({ entry: '/?questions.status=all&questions.priority=BOGUS&questions.reason=nope' });
      await screen.findByText('What happens to unpaid invoices?');
      expect(api.get).toHaveBeenCalledWith(listUrl(''));
    });

    it('falls back to the default when the status is not valid', async () => {
      view({ entry: '/?questions.status=BOGUS' });
      await screen.findByText('What happens to unpaid invoices?');
      expect(api.get).toHaveBeenCalledWith(listUrl('&status=OPEN'));
    });

    it('applies a filter chosen from the menu and can clear it', async () => {
      view();
      await screen.findByText('What happens to unpaid invoices?');

      await userEvent.click(screen.getByRole('combobox', { name: 'Filter by priority' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Critical' }));
      await waitFor(() =>
        expect(api.get).toHaveBeenCalledWith(listUrl('&status=OPEN&priority=CRITICAL')),
      );

      await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument(),
      );
    });

    it('can show every status', async () => {
      view();
      await screen.findByText('What happens to unpaid invoices?');
      await userEvent.click(screen.getByRole('combobox', { name: 'Filter by status' }));
      await userEvent.click(await screen.findByRole('option', { name: 'All statuses' }));
      await waitFor(() => expect(api.get).toHaveBeenCalledWith(listUrl('')));
    });
  });

  describe('permissions', () => {
    it('shows the answer form to people who can answer', async () => {
      view();
      expect(await screen.findByLabelText('Your answer')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss question' })).toBeInTheDocument();
    });

    it('is read-only for everyone else', async () => {
      view({ canAnswer: false });
      await screen.findByText('What happens to unpaid invoices?');
      expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Dismiss question' })).not.toBeInTheDocument();
      expect(screen.getByText(/Only analysts and owners can answer/)).toBeInTheDocument();
    });
  });

  describe('answering', () => {
    it('sends the answer with the version the person saw', async () => {
      serveItems([question({ version: 4 })]);
      api.post.mockResolvedValue({ question: question({ status: 'ANSWERED', version: 5 }) });
      view();
      await userEvent.type(await screen.findByLabelText('Your answer'), '  Remind after 7 days.  ');
      await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/projects/p1/questions/q1/answer', {
          answer: 'Remind after 7 days.',
          version: 4,
        }),
      );
      await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    });

    it('refreshes the lists after a successful answer', async () => {
      api.post.mockResolvedValue({ question: question({ status: 'ANSWERED', version: 2 }) });
      view();
      await userEvent.type(await screen.findByLabelText('Your answer'), 'Yes');
      const before = api.get.mock.calls.length;
      await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
      await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(before));
    });

    it('will not send an empty answer', async () => {
      view();
      await userEvent.type(await screen.findByLabelText('Your answer'), '   ');
      await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Write an answer first');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('shows the character count', async () => {
      view();
      await userEvent.type(await screen.findByLabelText('Your answer'), 'abc');
      expect(screen.getByText('3 / 5,000 characters')).toBeInTheDocument();
    });

    it('shows other failures inline and keeps what was typed', async () => {
      api.post.mockRejectedValue(
        new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'Something broke'),
      );
      view();
      const box = (await screen.findByLabelText('Your answer')) as HTMLTextAreaElement;
      await userEvent.type(box, 'My careful answer');
      await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

      expect(await screen.findByText('Something broke')).toBeInTheDocument();
      expect(box.value).toBe('My careful answer');
      expect(screen.queryByText('Your unsent answers')).not.toBeInTheDocument();
    });
  });

  describe('dismissing', () => {
    async function openDialog() {
      await userEvent.click(await screen.findByRole('button', { name: 'Dismiss question' }));
      return screen.findByRole('dialog');
    }

    it('requires a reason', async () => {
      view();
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Dismiss question' }));
      expect(
        await within(dialog).findByText('Say why this question is being dismissed'),
      ).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('sends the reason and version, then closes', async () => {
      serveItems([question({ version: 3 })]);
      api.post.mockResolvedValue({ question: question({ status: 'DISMISSED', version: 4 }) });
      view();
      const dialog = await openDialog();
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Out of scope');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Dismiss question' }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/projects/p1/questions/q1/dismiss', {
          reason: 'Out of scope',
          version: 3,
        }),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('keeps the dialog open and shows other failures', async () => {
      api.post.mockRejectedValue(
        new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'Server trouble'),
      );
      view();
      const dialog = await openDialog();
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Because');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Dismiss question' }));
      expect(await within(dialog).findByText('Server trouble')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('can be canceled without sending anything', async () => {
      view();
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe('conflicts (409)', () => {
    async function conflictOnAnswer() {
      api.post.mockRejectedValue(new ApiClientError(409, 'CONFLICT', NOT_FOUND));
      view();
      await userEvent.type(await screen.findByLabelText('Your answer'), 'My careful answer');
      await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    }

    it('explains who got there first and keeps the typed text', async () => {
      await conflictOnAnswer();
      const alerts = await screen.findAllByRole('alert');
      expect(alerts.map((a) => a.textContent).join(' ')).toContain(NOT_FOUND);
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();

      const unsent = screen.getByRole('region', { name: 'Your unsent answers' });
      expect(within(unsent).getByText('My careful answer')).toBeInTheDocument();
      expect(toastMock.success).not.toHaveBeenCalled();
    });

    it('refresh loads the latest and the unsent text survives the question leaving the list', async () => {
      await conflictOnAnswer();
      await screen.findByRole('button', { name: 'Refresh' });

      serveItems([], counts({ byStatus: { OPEN: 1, ANSWERED: 2, DISMISSED: 0 } }));
      const before = api.get.mock.calls.length;
      await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

      await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(before));
      await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
      const unsent = screen.getByRole('region', { name: 'Your unsent answers' });
      expect(within(unsent).getByText('My careful answer')).toBeInTheDocument();
    });

    it('copies the unsent text, or says it could not', async () => {
      await conflictOnAnswer();
      const unsent = await screen.findByRole('region', { name: 'Your unsent answers' });

      await userEvent.click(within(unsent).getByRole('button', { name: /^Copy your text/ }));
      await waitFor(() => expect(toastMock.error).toHaveBeenCalled());

      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await userEvent.click(within(unsent).getByRole('button', { name: /^Copy your text/ }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('My careful answer'));
      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Copied your text'));
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    });

    it('lets the person discard the unsent text', async () => {
      await conflictOnAnswer();
      await userEvent.click(await screen.findByRole('button', { name: /^Discard your text/ }));
      expect(screen.queryByRole('region', { name: 'Your unsent answers' })).not.toBeInTheDocument();
    });

    it('handles a conflict while dismissing: closes the dialog and shows the message', async () => {
      api.post.mockRejectedValue(new ApiClientError(409, 'CONFLICT', NOT_FOUND));
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Dismiss question' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Not needed');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Dismiss question' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const alerts = await screen.findAllByRole('alert');
      expect(alerts.map((a) => a.textContent).join(' ')).toContain(NOT_FOUND);
    });
  });
});
