import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DetailPage, RecordInspector, ViewBar } from '@brd/ui';

const VIEWS = [
  { id: 'all', name: 'All' },
  { id: 'mine', name: 'Mine' },
];

describe('ViewBar', () => {
  it('shows views as underline tabs with the active one selected, and changes view', async () => {
    const onSelect = vi.fn();
    render(<ViewBar views={VIEWS} activeId="all" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Mine' }));
    expect(onSelect).toHaveBeenCalledWith('mine');
  });

  it('has an icon-only add button with a tooltip, and Export and the primary action at the right', async () => {
    const onAdd = vi.fn();
    render(
      <ViewBar
        views={VIEWS}
        activeId="all"
        onSelect={vi.fn()}
        onAddView={onAdd}
        actions={<button type="button">Export</button>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add view' }));
    expect(onAdd).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('offers Save, Save as new and Reset only while the view has unsaved changes', async () => {
    const onSave = vi.fn();
    const onSaveAsNew = vi.fn();
    const onReset = vi.fn();
    const { rerender } = render(<ViewBar views={VIEWS} activeId="all" onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Unsaved/ })).not.toBeInTheDocument();

    rerender(
      <ViewBar
        views={VIEWS}
        activeId="all"
        onSelect={vi.fn()}
        unsaved
        onSaveView={onSave}
        onSaveAsNew={onSaveAsNew}
        onReset={onReset}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Unsaved/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Save as new' }));
    expect(onSaveAsNew).toHaveBeenCalled();
  });

  it('marks exactly one tab as selected', () => {
    render(<ViewBar views={VIEWS} activeId="all" onSelect={vi.fn()} />);
    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
  });
});

describe('DetailPage tabs', () => {
  it('uses underline tabs rather than a boxed segmented control', () => {
    render(
      <DetailPage
        state="ready"
        title="Billing BRD"
        tabs={[
          { key: 'overview', label: 'Overview', content: <p>Body</p> },
          { key: 'rules', label: 'Rules', content: <p>Rules body</p> },
        ]}
        activeTab="overview"
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });
});

function Harness({ editing = false, withEdit = true }) {
  const [text, setText] = useState('');
  return (
    <RecordInspector
      open
      onOpenChange={vi.fn()}
      title="Send invoices"
      description="A sample record"
      status={<span>Open</span>}
      onPrevious={vi.fn()}
      onEdit={withEdit ? vi.fn() : undefined}
      editing={editing}
      comment={{ value: text, onChange: setText, onSubmit: vi.fn() }}
      tabs={[
        { key: 'details', label: 'Details', content: <p>Detail body</p> },
        { key: 'activity', label: 'Activity', content: <p>Activity body</p> },
        { key: 'comments', label: 'Comments', content: <p>Comment body</p> },
      ]}
    />
  );
}

describe('RecordInspector', () => {
  it('opens as a drawer with the title in the header, no × icon, and Cancel · Edit in the footer', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Send invoices' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.indexOf('Cancel')).toBeLessThan(buttons.indexOf('Edit'));
  });

  it('switches between the sections and keeps one comment box under all of them', async () => {
    render(<Harness />);
    expect(screen.getByText('Detail body')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByText('Activity body')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'Add a comment' })).toHaveLength(1);
  });

  it('sends a comment only when there is text', async () => {
    render(<Harness />);
    const send = screen.getByRole('button', { name: 'Send comment' });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a comment' }), 'Looks right');
    expect(send).toBeEnabled();
  });

  it('hides the comment box and the Edit button while editing, and disables Previous when there is none', () => {
    render(<Harness editing />);
    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next record' })).toBeDisabled();
    expect(within(document.body).getByRole('button', { name: 'Previous record' })).toBeEnabled();
  });
});
