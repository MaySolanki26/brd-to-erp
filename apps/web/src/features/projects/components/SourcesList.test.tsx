import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { ContextNoteDto, DocumentDto } from '@brd/shared';
import { SourcesList } from './SourcesList';
import { DOCX, XLSX, doc, note, person, version } from './test-data';

interface Props {
  documents?: DocumentDto[];
  notes?: ContextNoteDto[];
  canAddSource?: boolean;
  canReprocess?: boolean;
  initialEntry?: string;
}

function setup({
  documents = [doc()],
  notes = [note()],
  canAddSource = true,
  canReprocess = true,
  initialEntry = '/',
}: Props = {}) {
  const handlers = {
    onViewChunks: vi.fn(),
    onViewVersions: vi.fn(),
    onNewVersion: vi.fn(),
    onEditNote: vi.fn(),
    onReprocess: vi.fn(),
  };
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SourcesList
        projectId="p1"
        documents={documents}
        notes={notes}
        canAddSource={canAddSource}
        canReprocess={canReprocess}
        reprocessing={false}
        {...handlers}
      />
    </MemoryRouter>,
  );
  return handlers;
}

const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

describe('SourcesList', () => {
  it('shows type, name, version, status, uploader and date for documents', () => {
    setup({
      documents: [
        doc({
          title: 'spec.docx',
          fileName: 'spec.docx',
          status: 'FAILED',
          failureReason: 'OCR not supported. This PDF has no selectable text.',
          latestVersion: version({ mimeType: DOCX, versionNumber: 3, sizeBytes: 3 * 1024 * 1024 }),
          versionCount: 3,
          createdBy: person('Bob Builder'),
        }),
      ],
      notes: [],
    });
    const row = within(rowOf('spec.docx'));
    expect(row.getByText('DOCX')).toBeInTheDocument();
    expect(row.getByText('v3')).toBeInTheDocument();
    expect(row.getByText('Failed')).toBeInTheDocument();
    expect(row.getByText(/OCR not supported/)).toBeInTheDocument();
    expect(row.getByText('Bob Builder')).toBeInTheDocument();
    expect(row.getByText(/3\.0 MB/)).toBeInTheDocument();
  });

  it('labels each file type', () => {
    setup({
      documents: [
        doc({ id: 'a', title: 'a.pdf' }),
        doc({ id: 'b', title: 'b.xlsx', latestVersion: version({ mimeType: XLSX }) }),
      ],
      notes: [],
    });
    expect(within(rowOf('a.pdf')).getByText('PDF')).toBeInTheDocument();
    expect(within(rowOf('b.xlsx')).getByText('XLSX')).toBeInTheDocument();
  });

  it('shows notes in the same list with no version', () => {
    setup({
      documents: [],
      notes: [note({ status: 'UPLOADED', failureReason: 'Could not queue processing.' })],
    });
    const row = within(rowOf('Kickoff call'));
    expect(row.getByText('Note')).toBeInTheDocument();
    expect(row.getByLabelText('No versions')).toHaveTextContent('—');
    expect(row.getByText('Queued')).toBeInTheDocument();
    expect(row.getByText('Could not queue processing.')).toBeInTheDocument();
  });

  it('lists the most recently active source first', () => {
    setup({
      documents: [doc({ id: 'old', title: 'old.pdf', updatedAt: '2026-01-01T00:00:00.000Z' })],
      notes: [note({ id: 'new', title: 'new note', updatedAt: '2026-03-01T00:00:00.000Z' })],
    });
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent ?? '');
    expect(names[0]).toContain('new note');
    expect(names[1]).toContain('old.pdf');
  });

  it('filters by documents or notes and explains an empty result', async () => {
    setup({ documents: [doc()], notes: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Nothing matches this filter')).toBeInTheDocument();
    expect(screen.queryByText('brd.pdf')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByText('brd.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('brd.pdf')).toBeInTheDocument();
  });

  it('restores the filter from the address, so a shared link shows the same view', () => {
    setup({ documents: [doc()], notes: [note()], initialEntry: '/?sources=notes' });
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('brd.pdf')).not.toBeInTheDocument();
  });

  it('falls back to All for an unknown filter value', () => {
    setup({ documents: [doc()], initialEntry: '/?sources=everything' });
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('brd.pdf')).toBeInTheDocument();
  });

  describe('actions', () => {
    it('opens chunks, version history and downloads', async () => {
      const { onViewChunks, onViewVersions } = setup({
        documents: [doc({ versionCount: 4 })],
        notes: [],
      });
      await userEvent.click(screen.getByRole('button', { name: 'brd.pdf' }));
      expect(onViewChunks).toHaveBeenCalledWith('d1');

      await userEvent.click(screen.getByRole('button', { name: 'Version history for brd.pdf' }));
      expect(onViewVersions).toHaveBeenCalledWith('d1');
      expect(screen.getByRole('button', { name: /Version history/ })).toHaveTextContent(
        'Versions (4)',
      );

      expect(screen.getByRole('link', { name: 'Download brd.pdf' })).toHaveAttribute(
        'href',
        '/api/projects/p1/documents/d1/versions/v1/download',
      );
    });

    it('starts a new version and edits a note when the person may add sources', async () => {
      const { onNewVersion, onEditNote } = setup();
      await userEvent.click(
        screen.getByRole('button', { name: 'Upload a new version of brd.pdf' }),
      );
      expect(onNewVersion).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
      await userEvent.click(screen.getByRole('button', { name: 'Edit note Kickoff call' }));
      expect(onEditNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
    });

    it('hides new version, edit and reprocess from read-only roles but keeps reading and download', () => {
      setup({ canAddSource: false, canReprocess: false });
      expect(screen.queryByRole('button', { name: /new version/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Edit note/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reprocess/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Version history/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Download/ })).toBeInTheDocument();
    });

    it('offers reprocess only for processed or failed documents', () => {
      setup({
        documents: [
          doc({ id: 'a', title: 'done.pdf', fileName: 'done.pdf', status: 'PROCESSED' }),
          doc({ id: 'b', title: 'bad.pdf', fileName: 'bad.pdf', status: 'FAILED' }),
          doc({ id: 'c', title: 'busy.pdf', fileName: 'busy.pdf', status: 'PROCESSING' }),
          doc({ id: 'd', title: 'wait.pdf', fileName: 'wait.pdf', status: 'UPLOADED' }),
        ],
        notes: [],
      });
      expect(screen.getByRole('button', { name: 'Reprocess done.pdf' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reprocess bad.pdf' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reprocess busy.pdf' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reprocess wait.pdf' })).not.toBeInTheDocument();
    });

    it('asks before reprocessing and does nothing if canceled', async () => {
      const { onReprocess } = setup({ notes: [] });
      await userEvent.click(screen.getByRole('button', { name: 'Reprocess brd.pdf' }));
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent('brd.pdf will be parsed again');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(onReprocess).not.toHaveBeenCalled();
    });

    it('reprocesses after confirmation', async () => {
      const { onReprocess } = setup({ notes: [] });
      await userEvent.click(screen.getByRole('button', { name: 'Reprocess brd.pdf' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reprocess' }));
      expect(onReprocess).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
    });
  });
});
