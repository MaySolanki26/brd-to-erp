import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormPage } from '@brd/ui';

describe('FormPage', () => {
  it('shows the field area and submits from the footer button', async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <FormPage state="ready" title="Settings" onSubmit={onSubmit} onCancel={() => {}}>
        <input aria-label="Name" />
      </FormPage>,
    );
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the error headline and detail with a retry', async () => {
    const onRetry = vi.fn();
    render(
      <FormPage
        state="error"
        title="Settings"
        onSubmit={() => {}}
        errorMessage="Could not load the project"
        errorDescription="The server is busy."
        onRetry={onRetry}
      >
        <input aria-label="Name" />
      </FormPage>,
    );
    expect(screen.getByText('Could not load the project')).toBeInTheDocument();
    expect(screen.getByText('The server is busy.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows no-access instead of the form', () => {
    render(
      <FormPage state="no-access" title="Settings" onSubmit={() => {}} noAccessDescription="Owners only.">
        <input aria-label="Name" />
      </FormPage>,
    );
    expect(screen.getByText('Owners only.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });
});
