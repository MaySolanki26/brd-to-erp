import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '@/test/render';
import { counts } from '@/features/questions/question-fixtures';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));

import { ApiClientError } from '@/lib/api-client';
import { OpenCriticalCard } from './OpenCriticalCard';

const view = (onReview = vi.fn()) => {
  renderRoute(<OpenCriticalCard projectId="p1" onReview={onReview} />);
  return onReview;
};

describe('OpenCriticalCard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows the number of open critical questions and a way to review them', async () => {
    api.get.mockResolvedValue({ counts: counts({ openCritical: 3 }) });
    const onReview = view();
    expect(await screen.findByTestId('critical-count')).toHaveTextContent('3');
    expect(screen.getByText('open critical questions')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review critical questions' }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('uses the singular for one', async () => {
    api.get.mockResolvedValue({ counts: counts({ openCritical: 1 }) });
    view();
    expect(await screen.findByText('open critical question')).toBeInTheDocument();
  });

  it('says so when there are none, without a button', async () => {
    api.get.mockResolvedValue({ counts: counts({ openCritical: 0 }) });
    view();
    expect(await screen.findByText('No open critical questions.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review critical questions' }),
    ).not.toBeInTheDocument();
  });

  it('shows a placeholder while loading', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    view();
    expect(screen.queryByTestId('critical-count')).not.toBeInTheDocument();
    expect(screen.queryByText('No open critical questions.')).not.toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    api.get.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    view();
    expect(await screen.findByText(/Could not load the question count/)).toBeInTheDocument();
    api.get.mockResolvedValue({ counts: counts({ openCritical: 2 }) });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('critical-count')).toHaveTextContent('2');
  });
});
