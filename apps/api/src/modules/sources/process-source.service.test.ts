import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProcessSourcePayload } from '@brd/shared';

const repo = vi.hoisted(() => ({
  findVersion: vi.fn(),
  beginDocument: vi.fn(),
  finishDocument: vi.fn(),
  findNote: vi.fn(),
  beginNote: vi.fn(),
  finishNote: vi.fn(),
  failDocument: vi.fn(),
  failNote: vi.fn(),
  releaseDocument: vi.fn(),
  releaseNote: vi.fn(),
}));
const storage = vi.hoisted(() => ({ getDownloadStream: vi.fn() }));

vi.mock('../../lib/logger.js', () => {
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    child: () => logger,
  };
  return { logger };
});
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('./process-source.repository.js', () => repo);
vi.mock('../../services/storage/index.js', () => ({ storageService: storage }));
vi.mock('../../lib/transaction.js', () => ({
  withTransaction: <T>(fn: (tx: object) => Promise<T>) => fn({}),
}));

import { NotFoundError } from '../../errors/app-error.js';
import { buildPdf } from '../../test/build-files.js';
import { failSource, processSource } from './process-source.service.js';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const docx = readFileSync(new URL('../../test/fixtures/requirements.docx', import.meta.url));

const ids = { organizationId: 'o1', projectId: 'p1', sourceId: 'd1', versionId: 'v1' };
const docPayload: ProcessSourcePayload = { ...ids, sourceType: 'document' };
const notePayload: ProcessSourcePayload = {
  organizationId: 'o1',
  projectId: 'p1',
  sourceType: 'note',
  sourceId: 'n1',
};
const FINISHED = { pendingChunkIds: [], finished: true };
const EXTRACTING = { pendingChunkIds: ['c1', 'c2'], finished: false };
const first = { jobId: 'j1', isLastAttempt: false };
const last = { jobId: 'j1', isLastAttempt: true };

function version(mimeType = PDF) {
  return {
    documentId: 'd1',
    versionId: 'v1',
    versionNumber: 1,
    fileKey: 'key-1',
    mimeType,
    documentStatus: 'UPLOADED' as const,
  };
}

function serve(bytes: Buffer): void {
  storage.getDownloadStream.mockResolvedValue(Readable.from([bytes]));
}

describe('processSource: documents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findVersion.mockResolvedValue(version());
    repo.beginDocument.mockResolvedValue(true);
    repo.finishDocument.mockResolvedValue(FINISHED);
  });

  it('parses, chunks and stores a PDF, verifying every id first', async () => {
    serve(buildPdf(['Invoices follow delivery.', 'Payment is due in 30 days.']));
    expect((await processSource(docPayload, first)).outcome).toBe('processed');

    expect(repo.findVersion).toHaveBeenCalledWith({
      organizationId: 'o1',
      projectId: 'p1',
      documentId: 'd1',
      versionId: 'v1',
    });
    expect(storage.getDownloadStream).toHaveBeenCalledWith('key-1');
    const finish = repo.finishDocument.mock.calls[0]?.[0];
    expect(finish).toMatchObject({
      organizationId: 'o1',
      projectId: 'p1',
      documentId: 'd1',
      versionId: 'v1',
    });
    expect(finish.chunks.map((c: { headingPath: string[] }) => c.headingPath)).toEqual([
      ['Page 1'],
      ['Page 2'],
    ]);
  });

  it('hands the chunks that still need reading to the extraction job', async () => {
    serve(buildPdf(['Invoices follow delivery.']));
    repo.finishDocument.mockResolvedValue(EXTRACTING);
    expect(await processSource(docPayload, first)).toEqual({
      outcome: 'extracting',
      chunkIds: ['c1', 'c2'],
    });
  });

  it('passes the version number and the reprocess flag to the chunk step', async () => {
    repo.findVersion.mockResolvedValue({ ...version(), versionNumber: 3 });
    serve(buildPdf(['Same content']));
    await processSource({ ...docPayload, reextract: true }, first);
    expect(repo.finishDocument.mock.calls[0]?.[0]).toMatchObject({
      versionNumber: 3,
      reextract: true,
    });

    serve(buildPdf(['Same content']));
    await processSource(docPayload, first);
    expect(repo.finishDocument.mock.calls[1]?.[0].reextract).toBe(false);
  });

  it('keeps heading paths for DOCX files', async () => {
    repo.findVersion.mockResolvedValue(version(DOCX));
    serve(docx);
    await processSource(docPayload, first);
    const chunks = repo.finishDocument.mock.calls[0]?.[0].chunks as { headingPath: string[] }[];
    expect(chunks.map((c) => c.headingPath.join(' > '))).toContain('Order to Cash > Invoicing');
  });

  it('gives identical chunks when the same job runs twice', async () => {
    serve(buildPdf(['Same content']));
    await processSource(docPayload, first);
    serve(buildPdf(['Same content']));
    await processSource(docPayload, { jobId: 'j2', isLastAttempt: false });
    expect(repo.finishDocument.mock.calls[1]?.[0].chunks).toEqual(
      repo.finishDocument.mock.calls[0]?.[0].chunks,
    );
  });

  it('does nothing when the ids do not match a document of this organization and project', async () => {
    repo.findVersion.mockResolvedValue(null);
    expect((await processSource(docPayload, first)).outcome).toBe('skipped');
    expect(repo.beginDocument).not.toHaveBeenCalled();
    expect(storage.getDownloadStream).not.toHaveBeenCalled();
  });

  it('skips a document job that names no version', async () => {
    expect((await processSource({ ...docPayload, versionId: undefined }, first)).outcome).toBe('skipped');
    expect(repo.findVersion).not.toHaveBeenCalled();
  });

  it('does not touch a document that is not waiting for this version', async () => {
    repo.beginDocument.mockResolvedValue(false);
    expect((await processSource(docPayload, first)).outcome).toBe('superseded');
    expect(storage.getDownloadStream).not.toHaveBeenCalled();
    expect(repo.finishDocument).not.toHaveBeenCalled();
  });

  it('reports superseded when a newer upload took over before the result was saved', async () => {
    serve(buildPdf(['text']));
    repo.finishDocument.mockResolvedValue(null);
    expect((await processSource(docPayload, first)).outcome).toBe('superseded');
  });

  it('fails a scanned PDF with the OCR message and does not retry', async () => {
    serve(buildPdf(['']));
    expect((await processSource(docPayload, first)).outcome).toBe('failed');
    expect(repo.failDocument).toHaveBeenCalledWith(
      'o1',
      'd1',
      expect.stringMatching(/^OCR not supported/),
    );
    expect(repo.releaseDocument).not.toHaveBeenCalled();
    expect(repo.finishDocument).not.toHaveBeenCalled();
  });

  it('fails a corrupt file permanently without retrying', async () => {
    serve(Buffer.from('%PDF-1.4 broken'));
    expect((await processSource(docPayload, first)).outcome).toBe('failed');
    expect(repo.failDocument).toHaveBeenCalledWith('o1', 'd1', expect.stringMatching(/corrupt/));
  });

  it('fails when the stored file is missing', async () => {
    storage.getDownloadStream.mockRejectedValue(new NotFoundError('gone'));
    expect((await processSource(docPayload, first)).outcome).toBe('failed');
    expect(repo.failDocument).toHaveBeenCalledTimes(1);
  });

  it('fails a file with an unsupported stored MIME type', async () => {
    repo.findVersion.mockResolvedValue(version('text/plain'));
    expect((await processSource(docPayload, first)).outcome).toBe('failed');
    expect(storage.getDownloadStream).not.toHaveBeenCalled();
  });

  it('releases the document and rethrows on a transient error so the retry can run', async () => {
    storage.getDownloadStream.mockRejectedValue(new Error('connection reset'));
    await expect(processSource(docPayload, first)).rejects.toThrow('connection reset');
    expect(repo.releaseDocument).toHaveBeenCalledWith('o1', 'd1');
    expect(repo.failDocument).not.toHaveBeenCalled();
  });

  it('marks the document failed, without throwing, after the last attempt', async () => {
    storage.getDownloadStream.mockRejectedValue(new Error('connection reset'));
    expect((await processSource(docPayload, last)).outcome).toBe('failed');
    expect(repo.failDocument).toHaveBeenCalledWith(
      'o1',
      'd1',
      expect.stringMatching(/Try reprocessing/),
    );
    expect(repo.releaseDocument).not.toHaveBeenCalled();
  });
});

describe('processSource: notes', () => {
  const readAt = new Date('2026-01-01T00:00:00Z');
  const note = {
    id: 'n1',
    title: 'Kickoff',
    body: '# Goals\nCut errors.',
    status: 'UPLOADED' as const,
    updatedAt: readAt,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    repo.findNote.mockResolvedValue(note);
    repo.beginNote.mockResolvedValue(true);
    repo.finishNote.mockResolvedValue(FINISHED);
  });

  it('chunks the note and stores it against the timestamp it read', async () => {
    expect((await processSource(notePayload, first)).outcome).toBe('processed');
    const finish = repo.finishNote.mock.calls[0]?.[0];
    expect(finish).toMatchObject({ organizationId: 'o1', projectId: 'p1', noteId: 'n1', readAt });
    expect(finish.chunks[0]).toMatchObject({
      headingPath: ['Kickoff', 'Goals'],
      content: 'Cut errors.',
    });
  });

  it('writes nothing when the note was edited while it was processing', async () => {
    repo.finishNote.mockResolvedValue(null);
    expect((await processSource(notePayload, first)).outcome).toBe('superseded');
  });

  it('hands note chunks that still need reading to the extraction job', async () => {
    repo.finishNote.mockResolvedValue(EXTRACTING);
    expect(await processSource(notePayload, first)).toEqual({
      outcome: 'extracting',
      chunkIds: ['c1', 'c2'],
    });
  });

  it('skips notes that do not exist in this organization and project', async () => {
    repo.findNote.mockResolvedValue(null);
    expect((await processSource(notePayload, first)).outcome).toBe('skipped');
    expect(repo.beginNote).not.toHaveBeenCalled();
  });

  it('skips a note that is not waiting', async () => {
    repo.beginNote.mockResolvedValue(false);
    expect((await processSource(notePayload, first)).outcome).toBe('superseded');
    expect(repo.finishNote).not.toHaveBeenCalled();
  });

  it('fails an empty note permanently', async () => {
    repo.findNote.mockResolvedValue({ ...note, body: '   ' });
    expect((await processSource(notePayload, first)).outcome).toBe('failed');
    expect(repo.failNote).toHaveBeenCalledWith('o1', 'n1', expect.stringMatching(/No text/));
  });

  it('releases the note and rethrows on a transient error', async () => {
    repo.finishNote.mockRejectedValue(new Error('db timeout'));
    await expect(processSource(notePayload, first)).rejects.toThrow('db timeout');
    expect(repo.releaseNote).toHaveBeenCalledWith('o1', 'n1');
  });
});

describe('failSource', () => {
  beforeEach(() => vi.resetAllMocks());

  it('fails the right kind of source with the given reason', async () => {
    await failSource(docPayload, 'why');
    expect(repo.failDocument).toHaveBeenCalledWith('o1', 'd1', 'why');
    await failSource(notePayload, 'why');
    expect(repo.failNote).toHaveBeenCalledWith('o1', 'n1', 'why');
  });
});
