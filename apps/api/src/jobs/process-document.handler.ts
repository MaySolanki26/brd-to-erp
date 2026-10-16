import type PgBoss from 'pg-boss';
import type { ProcessDocumentPayload } from '@brd/shared';
import { prisma } from '../lib/prisma.js';

async function processOne(job: PgBoss.Job<ProcessDocumentPayload>): Promise<void> {
  const { documentId } = job.data;

  // Idempotency: skip if document is already terminal
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    console.log(`[process-document] Document ${documentId} not found, skipping`);
    return;
  }

  if (document.status === 'PROCESSED' || document.status === 'FAILED') {
    console.log(`[process-document] Document ${documentId} already ${document.status}, skipping`);
    return;
  }

  // Guard: only transition from UPLOADED → PROCESSING
  const updated = await prisma.document.updateMany({
    where: { id: documentId, status: 'UPLOADED' },
    data: { status: 'PROCESSING', errorMessage: null },
  });

  if (updated.count === 0) {
    console.log(`[process-document] Document ${documentId} not in UPLOADED state, skipping`);
    return;
  }

  try {
    // Placeholder: actual processing logic goes here
    console.log(`[process-document] Processing document ${documentId}...`);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSED' },
    });

    console.log(`[process-document] Document ${documentId} processed successfully`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED', errorMessage },
    });

    console.error(`[process-document] Document ${documentId} failed: ${errorMessage}`);

    // Rethrow so pg-boss marks the job as failed and retries
    throw err;
  }
}

export async function handleProcessDocument(
  jobs: PgBoss.Job<ProcessDocumentPayload>[],
): Promise<void> {
  for (const job of jobs) {
    await processOne(job);
  }
}
