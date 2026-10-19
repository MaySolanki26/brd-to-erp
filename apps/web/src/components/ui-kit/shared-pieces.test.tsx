import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ConfirmHost,
  DateText,
  EmptyValue,
  FormGrid,
  FormGridItem,
  InfoTip,
  OverflowChips,
  confirmDelete,
  formatDateLong,
  formatDateShort,
  parseDateValue,
} from '@brd/ui';

describe('EmptyValue', () => {
  it('shows N/A with an accessible name', () => {
    render(<EmptyValue />);
    expect(screen.getByText('N/A')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByLabelText('Not available')).toBeInTheDocument();
  });
});

describe('date formatting', () => {
  it('shows the short form and the long form with a time', () => {
    const date = new Date(2026, 9, 16, 8, 30);
    expect(formatDateShort(date)).toBe('16 Oct, 2026');
    expect(formatDateLong(date, true)).toBe('Fri, 16 Oct 2026 08:30 AM');
    expect(formatDateLong(date, false)).toBe('Fri, 16 Oct 2026');
    expect(formatDateLong(new Date(2026, 9, 16, 0, 5), true)).toBe('Fri, 16 Oct 2026 12:05 AM');
    expect(formatDateLong(new Date(2026, 9, 16, 15, 0), true)).toBe('Fri, 16 Oct 2026 03:00 PM');
  });

  it('reads a date-only string as a local day and rejects nonsense', () => {
    expect(parseDateValue('2026-10-16')?.getDate()).toBe(16);
    expect(parseDateValue('not a date')).toBeNull();
  });
});

describe('DateText', () => {
  it('renders the short date', () => {
    render(<DateText value="2026-10-16" />);
    expect(screen.getByText('16 Oct, 2026')).toBeInTheDocument();
  });

  it('shows N/A for a missing or invalid value', () => {
    const { rerender } = render(<DateText value={null} />);
    expect(screen.getByLabelText('Not available')).toBeInTheDocument();
    rerender(<DateText value="" />);
    expect(screen.getByLabelText('Not available')).toBeInTheDocument();
  });
});

describe('InfoTip', () => {
  it('has an accessible name, a screen-reader copy and opens on click', async () => {
    render(<InfoTip text="Shown in the top bar" label="About this page" />);
    const button = screen.getByRole('button', { name: 'About this page: Shown in the top bar' });
    expect(button).toHaveAttribute('data-tooltip', 'Shown in the top bar');
    await userEvent.click(button);
    expect(button).toHaveAttribute('data-tooltip-toggle');
  });
});

describe('OverflowChips', () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  it('folds chips that do not fit into a +N chip that names the rest', () => {
    // jsdom has no layout, so only the first chip stays and the rest fold.
    render(<OverflowChips items={days} label="working days" />);
    const more = screen.getByRole('button', { name: '4 more: Tue, Wed, Thu, Fri' });
    expect(more).toHaveTextContent('+4');
  });
});

describe('confirmDelete', () => {
  it('asks first, with Cancel available, and deletes only after the confirm button', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmHost />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    act(() =>
      confirmDelete({
        title: 'Delete view?',
        message: 'The saved filters are lost. The records stay.',
        onConfirm,
      }),
    );
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete view?');
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => confirmDelete({ title: 'Delete view?', message: 'Gone.', onConfirm }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses the confirm label it is given', async () => {
    render(<ConfirmHost />);
    act(() =>
      confirmDelete({
        title: 'Remove member?',
        message: 'They lose access.',
        confirmLabel: 'Remove',
        onConfirm: vi.fn(),
      }),
    );
    expect(await screen.findByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });
});

describe('FormGrid', () => {
  it('lets a full-width item take the whole row', () => {
    render(
      <FormGrid>
        <FormGridItem>Name</FormGridItem>
        <FormGridItem full>Notes</FormGridItem>
      </FormGrid>,
    );
    expect(screen.getByText('Notes')).toHaveClass('uab-span-all');
    expect(screen.getByText('Name')).not.toHaveClass('uab-span-all');
  });
});
