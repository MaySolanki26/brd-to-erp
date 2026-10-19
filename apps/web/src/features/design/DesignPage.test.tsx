import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '@/test/render';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@brd/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@brd/ui')>();
  return { ...actual, toast: { ...actual.toast, info: vi.fn() } };
});

import { toast } from '@brd/ui';
import { DesignPage } from './DesignPage';

describe('DesignPage', () => {
  it('says it is sample data and shows the sample rows with dates and N/A', () => {
    renderRoute(<DesignPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Design system' })).toBeInTheDocument();
    expect(screen.getByText('Send invoices within 3 days of delivery')).toBeInTheDocument();
    expect(screen.getByText('16 Oct, 2026')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Not available').length).toBeGreaterThan(0);
  });

  it('switches views and filters the sample rows', async () => {
    renderRoute(<DesignPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Needs review' }));
    expect(screen.getByText('Credit notes need approver sign-off')).toBeInTheDocument();
    expect(screen.queryByText('VAT is 20% on every invoice')).not.toBeInTheDocument();
  });

  it('marks the view unsaved after a search, and explains that saving needs the server', async () => {
    renderRoute(<DesignPage />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search requirements' }), 'vat');
    await userEvent.click(await screen.findByRole('button', { name: /Unsaved/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Save' }));
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('needs the server'));
  });

  it('opens the record in the inspector, steps to the next one, and adds a local comment', async () => {
    renderRoute(<DesignPage />);
    await userEvent.click(screen.getByText('Send invoices within 3 days of delivery'));
    const drawer = await screen.findByRole('dialog');
    expect(
      within(drawer).getByRole('heading', { name: 'Send invoices within 3 days of delivery' }),
    ).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole('button', { name: 'Next record' }));
    expect(
      await within(drawer).findByRole('heading', { name: 'VAT is 20% on every invoice' }),
    ).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole('tab', { name: 'Comments' }));
    await userEvent.type(within(drawer).getByRole('textbox', { name: 'Add a comment' }), 'Agreed');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send comment' }));
    expect(await within(drawer).findByText('Agreed')).toBeInTheDocument();
  });

  it('asks before deleting a sample row', async () => {
    renderRoute(<DesignPage />);
    const row = screen.getByText('VAT is 20% on every invoice').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'More actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const alert = await screen.findByRole('alertdialog');
    expect(alert).toHaveTextContent('Delete requirement?');
    await userEvent.click(within(alert).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('opens a form whose fields flow in a grid and closes with Cancel', async () => {
    renderRoute(<DesignPage />);
    await userEvent.click(screen.getByRole('button', { name: 'New requirement' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByLabelText('Title')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
