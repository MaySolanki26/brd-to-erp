import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropZone } from './DropZone';
import { DOCX, PDF } from './test-data';

const pdf = new File(['%PDF'], 'a.pdf', { type: PDF });
const docx = new File(['PK'], 'b.docx', { type: DOCX });

describe('DropZone', () => {
  afterEach(() => vi.restoreAllMocks());

  it('invites people to drop files and states the allowed types and size limit', () => {
    render(<DropZone canAddSource onFiles={vi.fn()} />);
    const zone = screen.getByRole('button', { name: 'Upload documents' });
    expect(zone).toHaveTextContent('Drop files here or browse');
    expect(zone).toHaveAccessibleDescription('PDF, DOCX or XLSX, up to 25 MB each');
  });

  it('hands over every dropped file', () => {
    const onFiles = vi.fn();
    render(<DropZone canAddSource onFiles={onFiles} />);
    fireEvent.drop(screen.getByRole('button', { name: 'Upload documents' }), {
      dataTransfer: { files: [pdf, docx] },
    });
    expect(onFiles).toHaveBeenCalledWith([pdf, docx]);
  });

  it('ignores a drop that carries no files', () => {
    const onFiles = vi.fn();
    render(<DropZone canAddSource onFiles={onFiles} />);
    fireEvent.drop(screen.getByRole('button', { name: 'Upload documents' }), {
      dataTransfer: { files: [] },
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('highlights while a file is dragged over and clears when it leaves or drops', () => {
    render(<DropZone canAddSource onFiles={vi.fn()} />);
    const zone = screen.getByRole('button', { name: 'Upload documents' });
    expect(zone).toHaveAttribute('data-dragging', 'false');
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute('data-dragging', 'true');
    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute('data-dragging', 'false');
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [pdf] } });
    expect(zone).toHaveAttribute('data-dragging', 'false');
  });

  it('accepts files chosen through the picker, several at once', async () => {
    const onFiles = vi.fn();
    render(<DropZone canAddSource onFiles={onFiles} />);
    await userEvent.upload(screen.getByLabelText('Choose files to upload'), [pdf, docx]);
    expect(onFiles).toHaveBeenCalledWith([pdf, docx]);
  });

  it('opens the picker with a click, Enter or Space', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    render(<DropZone canAddSource onFiles={vi.fn()} />);
    const zone = screen.getByRole('button', { name: 'Upload documents' });

    await userEvent.click(zone);
    zone.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(click).toHaveBeenCalledTimes(3);
  });

  it('is reachable by keyboard', async () => {
    render(<DropZone canAddSource onFiles={vi.fn()} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Upload documents' })).toHaveFocus();
  });

  it('shows a read-only hint instead of an upload target for people who cannot add sources', () => {
    render(<DropZone canAddSource={false} onFiles={vi.fn()} />);
    expect(screen.getByRole('note')).toHaveTextContent('You can view sources but not add them.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Choose files to upload')).not.toBeInTheDocument();
  });
});
