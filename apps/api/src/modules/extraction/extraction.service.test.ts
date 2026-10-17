import { describe, expect, it, vi } from 'vitest';
import type { ExtractionLlmOutput } from '@brd/shared';
import {
  InvalidLlmOutputError,
  LlmBudgetExceededError,
  LlmRefusalError,
} from '../../services/llm/llm.errors.js';
import { createFakeRepository, type FakeChunk, type FakeItem } from './fake-repository.js';
import { createExtractionService } from './extraction.service.js';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));

const ORG = '00000000-0000-4000-8000-000000000001';
const PROJECT = '00000000-0000-4000-8000-000000000002';
const C1 = '00000000-0000-4000-8000-0000000000c1';
const C2 = '00000000-0000-4000-8000-0000000000c2';
const C3 = '00000000-0000-4000-8000-0000000000c3';
const payload = (chunkId: string) => ({ organizationId: ORG, projectId: PROJECT, chunkId });

function chunk(id: string, sourceId: string, overrides: Partial<FakeChunk> = {}): FakeChunk {
  return {
    id,
    sourceId,
    content: 'Invoices must be sent within 3 days of delivery.',
    headingPath: ['Billing'],
    current: true,
    extractedAt: null,
    needsReview: false,
    ...overrides,
  };
}

const answer = (overrides: Partial<ExtractionLlmOutput> = {}): ExtractionLlmOutput => ({
  modules: [{ name: 'Billing', description: 'Invoices and payments.' }],
  requirements: [{ title: 'Send invoices', description: 'Within 3 days.', moduleName: 'Billing' }],
  rules: [{ title: 'VAT is 20%', description: 'On every invoice.', moduleName: 'Billing' }],
  ...overrides,
});

function setup(
  chunks: FakeChunk[],
  items: FakeItem[] = [],
  scripted: ExtractionLlmOutput | Error = answer(),
) {
  const fake = createFakeRepository({
    organizationId: ORG,
    projectId: PROJECT,
    chunks,
    items,
  });
  let current = scripted;
  const run = vi.fn(async (options: { schema: { parse: (v: unknown) => unknown } }) => {
    if (current instanceof Error) throw current;
    return {
      output: options.schema.parse(current),
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
    };
  });
  const audit = vi.fn(async () => undefined);
  const service = createExtractionService({
    repo: fake.repo,
    llm: { run } as never,
    transaction: async (fn) => fn({} as never),
    audit,
  });
  const titles = (kind: FakeItem['kind']) =>
    [...fake.state.items.values()]
      .filter((i) => i.kind === kind)
      .map((i) => i.title)
      .sort();
  const respondWith = (next: ExtractionLlmOutput | Error): void => {
    current = next;
  };
  return { ...fake, run, audit, service, titles, respondWith };
}

describe('extractChunk', () => {
  it('stores what the chunk states, with the module link, and marks the chunk extracted', async () => {
    const { service, state, titles, audit, run } = setup([chunk(C1, 's1')]);

    expect(await service.extractChunk(payload(C1))).toEqual({
      status: 'extracted',
      created: 3,
      linked: 0,
      removed: 0,
      sourceFinished: true,
    });
    expect(titles('module')).toEqual(['Billing']);
    expect(titles('requirement')).toEqual(['Send invoices']);
    expect(titles('rule')).toEqual(['VAT is 20%']);
    const billing = [...state.items.values()].find((i) => i.kind === 'module');
    const requirement = [...state.items.values()].find((i) => i.kind === 'requirement');
    expect(requirement?.moduleId).toBe(billing?.id);
    expect(requirement?.createdById).toBeNull();
    expect(state.chunks.get(C1)?.extractedAt).toBeInstanceOf(Date);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'KnowledgeItem',
        organizationId: ORG,
        metadata: expect.objectContaining({ projectId: PROJECT, chunkId: C1, created: 3 }),
      }),
      expect.anything(),
    );
    expect(state.lockCount).toBe(1);

    // The model sees the chunk and nothing else: no summary, no other chunks.
    const call = run.mock.calls[0]?.[0] as unknown as { user: string; cachedContext?: string };
    expect(call.user).toContain('<data>');
    expect(call.user).toContain('Invoices must be sent within 3 days');
    expect(call.cachedContext).toBeUndefined();
  });

  it('is idempotent: reprocessing the same chunk changes nothing and writes no second audit entry', async () => {
    const { service, state, audit } = setup([chunk(C1, 's1')]);
    await service.extractChunk(payload(C1));
    const before = JSON.stringify([...state.items.values()]);

    const second = await service.extractChunk(payload(C1));
    expect(second).toMatchObject({ status: 'extracted', created: 0, linked: 0, removed: 0 });
    expect(JSON.stringify([...state.items.values()])).toBe(before);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('merges a requirement found again in another source and keeps both source links', async () => {
    const { service, state, titles } = setup([chunk(C1, 's1'), chunk(C2, 's2')]);
    await service.extractChunk(payload(C1));
    const outcome = await service.extractChunk(payload(C2));

    expect(outcome).toMatchObject({ created: 0, linked: 3 });
    expect(titles('requirement')).toEqual(['Send invoices']);
    const requirement = [...state.items.values()].find((i) => i.kind === 'requirement');
    expect(requirement?.sourceChunkId).toBe(C1);
    expect(requirement?.links).toEqual([C2]);
  });

  it('brings stale items back to OPEN when a new document version states them again', async () => {
    const stale = (id: string, kind: FakeItem['kind'], title: string): FakeItem => ({
      kind,
      id,
      title,
      description: 'Within 3 days.',
      status: 'NEEDS_REVALIDATION',
      createdById: null,
      moduleId: null,
      sourceChunkId: C1,
      links: [],
    });
    const { service, state } = setup(
      [chunk(C1, 's1'), chunk(C2, 's1')],
      [
        stale('old-r', 'requirement', 'Send invoices'),
        stale('old-x', 'requirement', 'Dropped from the new text'),
      ],
    );
    await service.extractChunk(payload(C2));
    expect(state.items.get('old-r')?.status).toBe('OPEN');
    expect(state.items.get('old-x')?.status).toBe('NEEDS_REVALIDATION');
    // Running the same chunk again changes nothing.
    const again = await service.extractChunk(payload(C2));
    expect(again).toMatchObject({ created: 0, removed: 0 });
    expect(state.items.get('old-r')?.status).toBe('OPEN');
  });

  it("replaces only this chunk's unconfirmed items when its text no longer states them", async () => {
    const item = (overrides: Partial<FakeItem>): FakeItem => ({
      kind: 'requirement',
      id: 'x',
      title: 'x',
      description: 'x',
      status: 'OPEN',
      createdById: null,
      moduleId: null,
      sourceChunkId: C1,
      links: [],
      ...overrides,
    });
    const { service, titles, respondWith } = setup(
      [chunk(C1, 's1'), chunk(C2, 's2')],
      [
        item({ id: 'a', title: 'Confirmed by a person', status: 'CONFIRMED' }),
        item({ id: 'b', title: 'Typed by hand', createdById: 'user-1' }),
        item({ id: 'c', title: 'From another chunk', sourceChunkId: C2 }),
      ],
    );
    await service.extractChunk(payload(C1));
    expect(titles('requirement')).toContain('Send invoices');

    respondWith(answer({ requirements: [], rules: [] }));
    const outcome = await service.extractChunk(payload(C1));

    expect(outcome).toMatchObject({ status: 'extracted', removed: 2 });
    expect(titles('requirement')).toEqual([
      'Confirmed by a person',
      'From another chunk',
      'Typed by hand',
    ]);
    expect(titles('rule')).toEqual([]);
  });

  it('flags the chunk for review when the model answers badly twice, and does not fail the job', async () => {
    const { service, state, audit } = setup([chunk(C1, 's1')], [], new InvalidLlmOutputError());
    expect(await service.extractChunk(payload(C1))).toEqual({
      status: 'needs-review',
      sourceFinished: true,
    });
    expect(state.chunks.get(C1)).toMatchObject({ needsReview: true });
    expect(state.chunks.get(C1)?.extractedAt).toBeInstanceOf(Date);
    expect(state.items.size).toBe(0);
    expect(audit).not.toHaveBeenCalled();
  });

  it('flags a chunk the model declines to read, instead of retrying it', async () => {
    const { service, state } = setup([chunk(C1, 's1')], [], new LlmRefusalError());
    expect(await service.extractChunk(payload(C1))).toEqual({
      status: 'needs-review',
      sourceFinished: true,
    });
    expect(state.chunks.get(C1)?.needsReview).toBe(true);
  });

  it('gives up on a chunk that keeps failing: flagged, counted as done, source can finish', async () => {
    const { service, state, run } = setup([chunk(C1, 's1'), chunk(C3, 's1')]);
    await service.extractChunk(payload(C1));
    expect(await service.giveUp(payload(C3))).toEqual({
      status: 'needs-review',
      sourceFinished: true,
    });
    expect(state.chunks.get(C3)).toMatchObject({ needsReview: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not give up on a chunk that is gone or from an older version', async () => {
    const { service } = setup([chunk(C1, 's1', { current: false })]);
    expect(await service.giveUp(payload(C1))).toEqual({ status: 'skipped' });
    expect(await service.giveUp(payload(C2))).toEqual({ status: 'skipped' });
  });

  it("fails the chunk's source with a reason a person can read", async () => {
    const { service, state } = setup([chunk(C1, 's1')]);
    await service.failSource(payload(C1), 'The AI service is not available.');
    expect(state.failedSources.get('s1')).toBe('The AI service is not available.');
  });

  it('finishes a source only when its last chunk is done', async () => {
    const { service } = setup([chunk(C1, 's1'), chunk(C3, 's1')]);
    expect(await service.extractChunk(payload(C1))).toMatchObject({ sourceFinished: false });
    expect(await service.extractChunk(payload(C3))).toMatchObject({ sourceFinished: true });
  });

  it('counts a flagged chunk toward finishing its source', async () => {
    const { service, state, respondWith } = setup([chunk(C1, 's1'), chunk(C3, 's1')]);
    await service.extractChunk(payload(C1));
    respondWith(new InvalidLlmOutputError());
    expect(await service.extractChunk(payload(C3))).toEqual({
      status: 'needs-review',
      sourceFinished: true,
    });
    expect(state.chunks.get(C3)?.needsReview).toBe(true);
  });

  it('skips a chunk that is missing, in another project, or from an older document version', async () => {
    const { service, run } = setup([chunk(C1, 's1', { current: false })]);
    expect(await service.extractChunk(payload(C1))).toEqual({ status: 'skipped' });
    expect(await service.extractChunk(payload(C2))).toEqual({ status: 'skipped' });
    expect(
      await service.extractChunk({
        ...payload(C1),
        projectId: '00000000-0000-4000-8000-0000000000ff',
      }),
    ).toEqual({ status: 'skipped' });
    expect(run).not.toHaveBeenCalled();
  });

  it('lets other model failures through so the job can pause or retry', async () => {
    const { service, state } = setup([chunk(C1, 's1')], [], new LlmBudgetExceededError(10, 10));
    await expect(service.extractChunk(payload(C1))).rejects.toBeInstanceOf(LlmBudgetExceededError);
    expect(state.chunks.get(C1)?.extractedAt).toBeNull();
  });
});
