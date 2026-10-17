import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UploadItem } from '../hooks/use-upload-queue';
import { UploadQueue } from './UploadQueue';

function item(overrides: Partial<UploadItem> = {}): UploadItem {
  return {
    id: 'u1',
    fileName: 'brd.pdf',
    size: 2048,
    status: 'queued',
    progress: 0,
    error: null,
    duplicateOf: null,
    documentId: null,
    documentName: null,
    ...overrides,
  };
}

function setup(items: UploadItem[]) {
  const handlers = {
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onDismiss: vi.fn(),
    onClearFinished: vi.fn(),
    onOpenDocument: vi.fn(),
  };
  render(<UploadQueue items={items} {...handlers} />);
  return handlers;
}

describe('UploadQueue', () => {
  it('renders nothing when there are no uploads', () => {
    const { container } = render(
      <UploadQueue
        items={[]}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
        onClearFinished={vi.fn()}
        onOpenDocument={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a queued file as waiting and lets it be canceled', async () => {
    const { onCancel } = setup([item()]);
    expect(screen.getByText('Waiting to upload')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel upload of brd.pdf' }));
    expect(onCancel).toHaveBeenCalledWith('u1');
  });

  it('shows byte progress for a file being sent', () => {
    setup([item({ status: 'uploading', progress: 42 })]);
    expect(screen.getByText('Uploading 42%')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Upload progress for brd.pdf' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByRole('button', { name: 'Cancel upload of brd.pdf' })).toBeInTheDocument();
  });

  it('cannot be canceled once the server is saving it', () => {
    setup([item({ status: 'confirming', progress: 100 })]);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel upload/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dismiss/ })).not.toBeInTheDocument();
  });

  it('shows a failure as an alert with retry and dismiss', async () => {
    const { onRetry, onDismiss } = setup([
      item({ status: 'failed', error: 'The file content does not match its type' }),
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent('The file content does not match its type');
    await userEvent.click(screen.getByRole('button', { name: 'Retry upload of brd.pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss brd.pdf' }));
    expect(onRetry).toHaveBeenCalledWith('u1');
    expect(onDismiss).toHaveBeenCalledWith('u1');
  });

  it('explains why a file was rejected, without a retry', () => {
    setup([
      item({ status: 'rejected', error: 'Unsupported file. Upload a PDF, DOCX or XLSX file.' }),
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent(/Unsupported file/);
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss brd.pdf' })).toBeInTheDocument();
  });

  it('shows a canceled upload with retry', () => {
    setup([item({ status: 'canceled' })]);
    expect(screen.getByText('Canceled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry upload of brd.pdf' })).toBeInTheDocument();
  });

  it('confirms a finished upload', () => {
    setup([item({ status: 'done', progress: 100 })]);
    expect(screen.getByText('Uploaded. Processing will start shortly.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('warns about identical content and links to the original', async () => {
    const { onOpenDocument } = setup([
      item({ status: 'done', duplicateOf: { documentId: 'd9', title: 'old.pdf' } }),
    ]);
    expect(screen.getByText(/Identical content already exists in/)).toHaveTextContent('old.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'View original' }));
    expect(onOpenDocument).toHaveBeenCalledWith('d9');
  });

  it('names the document when the upload is a new version', () => {
    setup([item({ documentId: 'd1', documentName: 'brd.pdf' })]);
    expect(screen.getByText(/new version of brd\.pdf/)).toBeInTheDocument();
  });

  it('offers to clear finished uploads only when some are clearable', async () => {
    const first = setup([item({ status: 'done' })]);
    await userEvent.click(screen.getByRole('button', { name: 'Clear finished' }));
    expect(first.onClearFinished).toHaveBeenCalled();
  });

  it('does not offer to clear when only active or failed uploads remain', () => {
    setup([
      item({ id: 'a', status: 'uploading' }),
      item({ id: 'b', fileName: 'b.pdf', status: 'failed', error: 'x' }),
    ]);
    expect(screen.queryByRole('button', { name: 'Clear finished' })).not.toBeInTheDocument();
  });

  it('announces status changes politely to assistive technology', () => {
    setup([item()]);
    expect(screen.getByRole('list')).toHaveAttribute('aria-live', 'polite');
  });
});
