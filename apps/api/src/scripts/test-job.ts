import { prisma, disconnectPrisma } from '../lib/prisma.js';
import { createBoss } from '../lib/boss.js';
import { enqueue } from '../services/queue.service.js';
import { JobName } from '@brd/shared';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const boss = createBoss();
  await boss.start();

  // Seed a test organization, project, and document
  const org = await prisma.organization.upsert({
    where: { slug: 'test-org' },
    update: {},
    create: { name: 'Test Org', slug: 'test-org' },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      organizationId: org.id,
    },
  });

  const document = await prisma.document.create({
    data: {
      title: 'Test Document',
      fileName: 'test.pdf',
      status: 'UPLOADED',
      projectId: project.id,
      organizationId: org.id,
    },
  });

  const version = await prisma.documentVersion.create({
    data: {
      versionNumber: 1,
      fileUrl: '/tmp/test.pdf',
      documentId: document.id,
      organizationId: org.id,
    },
  });

  console.log(`[test] Created document ${document.id} with status UPLOADED`);

  // Enqueue the job
  const jobId = await enqueue(boss, JobName.PROCESS_DOCUMENT, {
    documentId: document.id,
    documentVersionId: version.id,
    organizationId: org.id,
  });

  console.log(`[test] Enqueued job ${jobId}`);

  // Poll for completion
  const maxWait = 10_000;
  const interval = 500;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await sleep(interval);
    elapsed += interval;

    const doc = await prisma.document.findUniqueOrThrow({
      where: { id: document.id },
    });

    if (doc.status !== 'UPLOADED' && doc.status !== 'PROCESSING') {
      console.log(`[test] Document status: ${doc.status}`);

      if (doc.status === 'PROCESSED') {
        console.log('[test] PASS — job completed successfully');
      } else {
        console.log(`[test] Document ended in ${doc.status}: ${doc.errorMessage ?? 'no message'}`);
      }

      break;
    }

    if (elapsed >= maxWait) {
      console.error(`[test] FAIL — timed out after ${maxWait}ms, status: ${doc.status}`);
    }
  }

  // Cleanup test data
  await prisma.documentVersion.delete({ where: { id: version.id } });
  await prisma.document.delete({ where: { id: document.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  console.log('[test] Cleaned up test data');

  await boss.stop({ graceful: true, timeout: 5_000 });
  await disconnectPrisma();
}

main().catch((err: unknown) => {
  console.error('[test] Fatal error:', err);
  process.exit(1);
});
