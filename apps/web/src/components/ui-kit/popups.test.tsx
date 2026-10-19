import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Dialog, FormDrawer } from '@brd/ui';

describe('popups', () => {
  it('a drawer has no × icon and closes with the footer Cancel', async () => {
    const onOpenChange = vi.fn();
    render(
      <FormDrawer
        open
        onOpenChange={onOpenChange}
        title="Add note"
        description="Notes are kept with the project."
      >
        <p>Body</p>
      </FormDrawer>,
    );
    expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows Cancel and Save when the drawer has a form', () => {
    render(
      <FormDrawer
        open
        onOpenChange={() => {}}
        title="Add note"
        onSubmit={(e) => e.preventDefault()}
      >
        <p>Body</p>
      </FormDrawer>,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('keeps the description behind an info icon, with a screen-reader copy', () => {
    render(
      <FormDrawer
        open
        onOpenChange={() => {}}
        title="Add note"
        description="Notes are kept with the project."
      >
        <p>Body</p>
      </FormDrawer>,
    );
    const info = screen.getByRole('button', { name: /Notes are kept with the project/ });
    expect(info).toHaveAttribute('data-tooltip', 'Notes are kept with the project.');
    expect(screen.queryByText('Notes are kept with the project.')).not.toBeInTheDocument();
  });

  it('a dialog has no × icon and closes with its footer Cancel', async () => {
    const onClose = vi.fn();
    render(
      <Dialog
        open
        onClose={onClose}
        title="Rename view"
        footer={<Button onClick={onClose}>Cancel</Button>}
      >
        Body
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Rename view' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
