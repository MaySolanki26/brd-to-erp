import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '@/test/render';
import { change, decision, page } from '@/features/questions/question-fixtures';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));

import { ApiClientError } from '@/lib/api-client';
import { DecisionsTab } from './DecisionsTab';

const url = (n = 1) => `/projects/p1/decisions?page=${String(n)}&pageSize=20`;
const view = () => renderRoute(<DecisionsTab projectId="p1" />);
const entry = (question: string) =>
  screen.findByRole('article', { name: `Decision on: ${question}` });

describe('DecisionsTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockResolvedValue(page([decision()], { pageSize: 20 }));
  });

  describe('states', () => {
    it('shows loading placeholders first', () => {
      api.get.mockReturnValue(new Promise(() => {}));
      view();
      expect(screen.getByRole('heading', { name: 'Decisions' })).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });

    it('explains an empty timeline', async () => {
      api.get.mockResolvedValue(page([], { pageSize: 20 }));
      view();
      expect(await screen.findByText('No decisions yet')).toBeInTheDocument();
    });

    it('shows an error with a working retry', async () => {
      api.get.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
      view();
      expect(await screen.findByText('Could not load decisions')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(await screen.findByRole('article')).toBeInTheDocument();
    });

    it('shows no-access when the API forbids reading', async () => {
      api.get.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'nope'));
      view();
      expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    });
  });

  describe('timeline', () => {
    it('shows who decided, when, the question and the answer', async () => {
      view();
      const item = await entry('When do we remind customers?');
      expect(within(item).getByText('Ann Analyst')).toBeInTheDocument();
      const time = within(item).getByText(/2026/);
      expect(time.tagName).toBe('TIME');
      expect(time).toHaveAttribute('datetime', '2026-03-01T10:30:00.000Z');
      expect(within(item).getByText('When do we remind customers?')).toBeInTheDocument();
      expect(within(item).getByText('After 7 days.')).toBeInTheDocument();
      expect(within(item).getByText('Reminders go out after seven days.')).toBeInTheDocument();
    });

    it('lists entries newest first in the order the server sends them', async () => {
      api.get.mockResolvedValue(
        page(
          [
            decision({ id: 'new', question: { id: 'q2', text: 'Newer question' } }),
            decision({ id: 'old', question: { id: 'q1', text: 'Older question' } }),
          ],
          { pageSize: 20 },
        ),
      );
      view();
      await screen.findByText('Newer question');
      expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
        'Decision on: Newer question',
        'Decision on: Older question',
      ]);
    });

    it('shows a status change as before and after', async () => {
      view();
      const item = await entry('When do we remind customers?');
      const row = (await within(item).findByText('Remind customers')).closest('li') as HTMLElement;
      const status = within(row).getByLabelText('Status before and after');
      expect(status).toHaveTextContent('Open');
      expect(status).toHaveTextContent('Confirmed');
      expect(within(row).queryByText('No change')).not.toBeInTheDocument();
    });

    it('says plainly when an item did not change', async () => {
      api.get.mockResolvedValue(
        page(
          [
            decision({
              changes: [
                change({
                  after: { status: 'ASSUMED', title: 'Remind customers', description: null },
                  before: { status: 'ASSUMED', title: 'Remind customers', description: null },
                }),
              ],
            }),
          ],
          { pageSize: 20 },
        ),
      );
      view();
      const row = (await screen.findByText('Remind customers')).closest('li') as HTMLElement;
      expect(within(row).getByText('No change')).toBeInTheDocument();
      expect(within(row).getByText('Status unchanged')).toBeInTheDocument();
    });

    it('shows a renamed title and a changed description with the old text struck out', async () => {
      api.get.mockResolvedValue(
        page(
          [
            decision({
              changes: [
                change({
                  title: 'Remind after 7 days',
                  before: { status: 'OPEN', title: 'Remind customers', description: 'Old text' },
                  after: {
                    status: 'CONFIRMED',
                    title: 'Remind after 7 days',
                    description: 'New text',
                  },
                  reason: 'The answer fixed the delay.',
                }),
              ],
            }),
          ],
          { pageSize: 20 },
        ),
      );
      view();
      const row = (await screen.findAllByText('Remind after 7 days'))[0]?.closest(
        'li',
      ) as HTMLElement;
      expect(within(row).getByText('Remind customers')).toBeInTheDocument();
      expect(within(row).getByText('Description changed')).toBeInTheDocument();
      expect(within(row).getByText('Old text')).toBeInTheDocument();
      expect(within(row).getByText('New text')).toBeInTheDocument();
      expect(within(row).getByText('The answer fixed the delay.')).toBeInTheDocument();
    });

    it('labels the kind of every affected item', async () => {
      api.get.mockResolvedValue(
        page(
          [
            decision({
              changes: [
                change({ id: 'a', kind: 'requirement', title: 'Req title' }),
                change({ id: 'b', kind: 'rule', title: 'Rule title' }),
                change({ id: 'c', kind: 'module', title: 'Module title' }),
              ],
            }),
          ],
          { pageSize: 20 },
        ),
      );
      view();
      const rows = (await screen.findAllByText(/title$/)).map(
        (n) => n.closest('li')?.textContent ?? '',
      );
      expect(rows[0]).toContain('Requirement');
      expect(rows[1]).toContain('Rule');
      expect(rows[2]).toContain('Module');
    });

    it('says when an answer changed nothing', async () => {
      api.get.mockResolvedValue(page([decision({ changes: [] })], { pageSize: 20 }));
      view();
      expect(await screen.findByText('This answer did not change any items.')).toBeInTheDocument();
    });

    it('shows conflicts with confirmed items as left unchanged', async () => {
      api.get.mockResolvedValue(
        page(
          [
            decision({
              conflicts: [
                {
                  kind: 'rule',
                  id: 'u1',
                  title: 'Limit is 5k',
                  explanation: 'The answer says 10k.',
                },
                { kind: 'module', id: 'm1', title: null, explanation: 'Contradicts the scope.' },
              ],
            }),
          ],
          { pageSize: 20 },
        ),
      );
      view();
      const group = await screen.findByRole('group', { name: 'Conflicts' });
      expect(group).toHaveTextContent('Contradicts confirmed items, left unchanged');
      expect(group).toHaveTextContent('Limit is 5k');
      expect(group).toHaveTextContent('The answer says 10k.');
      expect(group).toHaveTextContent('Contradicts the scope.');
    });

    it('does not show a conflicts block when there are none', async () => {
      view();
      await screen.findByRole('article');
      expect(screen.queryByRole('group', { name: 'Conflicts' })).not.toBeInTheDocument();
    });

    it('loads the next page on request', async () => {
      api.get.mockImplementation(async (u: string) =>
        u === url(2)
          ? page([decision({ id: 'd2', question: { id: 'q2', text: 'Second page question' } })], {
              page: 2,
              pageSize: 20,
              total: 21,
            })
          : page([decision()], { pageSize: 20, total: 21 }),
      );
      view();
      await screen.findByRole('article');
      await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
      expect(await screen.findByText('Second page question')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith(url(2));
    });
  });
});
