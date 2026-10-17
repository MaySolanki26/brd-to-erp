import { createHash } from 'node:crypto';
import type { KnowledgeStatus } from '@brd/shared';
import { normalize } from './extraction.plan.js';
import type { ExtractionRepository } from './extraction.repository.js';
import type { ExistingItem, ExtractedKind } from './extraction.types.js';

/**
 * The same kind and title always get the same id, so a run over the same answers produces the same
 * prompts (and the same fixture hashes) every time.
 */
export function stableItemId(kind: ExtractedKind, title: string): string {
  const hex = createHash('sha256')
    .update(`${kind}:${normalize(title)}`)
    .digest('hex');
  const variant = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface FakeItem {
  kind: ExtractedKind;
  id: string;
  title: string;
  description: string | null;
  status: KnowledgeStatus;
  createdById: string | null;
  moduleId: string | null;
  sourceChunkId: string;
  /** Extra source chunks, oldest first. */
  links: string[];
}

export interface FakeChunk {
  id: string;
  content: string;
  headingPath: string[];
  current: boolean;
  extractedAt: Date | null;
  needsReview: boolean;
  /** Chunks of one source share a source id. */
  sourceId: string;
}

/** An in-memory stand-in with the real repository's rules: scoped to one project, merge by title. */
export function createFakeRepository(seed: {
  organizationId: string;
  projectId: string;
  chunks: FakeChunk[];
  items?: FakeItem[];
}) {
  const state = {
    chunks: new Map(seed.chunks.map((c) => [c.id, { ...c }])),
    items: new Map((seed.items ?? []).map((i) => [i.id, { ...i, links: [...i.links] }])),
    lockCount: 0,
    finishedSources: [] as string[],
    failedSources: new Map<string, string>(),
  };
  const sameScope = (scope: { organizationId: string; projectId: string }): boolean =>
    scope.organizationId === seed.organizationId && scope.projectId === seed.projectId;

  const repo = {
    findChunk: async (organizationId: string, projectId: string, chunkId: string) => {
      const chunk = state.chunks.get(chunkId);
      if (!chunk || !sameScope({ organizationId, projectId })) return null;
      return {
        id: chunk.id,
        content: chunk.content,
        headingPath: chunk.headingPath,
        current: chunk.current,
      };
    },
    lockProject: async () => {
      state.lockCount += 1;
    },
    loadExisting: async (
      _tx: unknown,
      _scope: unknown,
      chunkId: string,
      drafts: Parameters<ExtractionRepository['loadExisting']>[3],
    ) => {
      const wanted = new Set([
        ...drafts.modules.map((m) => normalize(m.name)),
        ...drafts.requirements.map((r) => normalize(r.title)),
        ...drafts.rules.map((r) => normalize(r.title)),
      ]);
      const result: Record<ExtractedKind, ExistingItem[]> = {
        module: [],
        requirement: [],
        rule: [],
      };
      for (const item of state.items.values()) {
        const ownedHere = item.sourceChunkId === chunkId;
        const linkedHere = item.links.includes(chunkId);
        if (!ownedHere && !linkedHere && !wanted.has(normalize(item.title))) continue;
        result[item.kind].push({
          kind: item.kind,
          id: item.id,
          title: item.title,
          description: item.description,
          status: item.status,
          createdById: item.createdById,
          moduleId: item.moduleId,
          ownedHere,
          linkedHere,
          otherSourceChunkIds: item.links.filter((id) => id !== chunkId),
        });
      }
      return result;
    },
    applyPlan: async (
      _tx: unknown,
      _scope: unknown,
      chunkId: string,
      plan: Parameters<ExtractionRepository['applyPlan']>[3],
    ) => {
      const counts = { created: 0, linked: 0, updated: 0, removed: 0 };
      const moduleId = (name: string | null): string | null => {
        if (name === null) return null;
        const found = [...state.items.values()].find(
          (i) => i.kind === 'module' && normalize(i.title) === normalize(name),
        );
        return found?.id ?? null;
      };
      for (const kind of ['module', 'requirement', 'rule'] as const) {
        for (const create of plan.create.filter((c) => c.kind === kind)) {
          const id = stableItemId(kind, create.title);
          state.items.set(id, {
            kind,
            id,
            title: create.title,
            description: create.description || null,
            status: 'OPEN',
            createdById: null,
            moduleId: moduleId(create.moduleName),
            sourceChunkId: chunkId,
            links: [],
          });
          counts.created += 1;
        }
      }
      for (const update of plan.update) {
        const item = state.items.get(update.id);
        if (!item) continue;
        if (update.description !== undefined) item.description = update.description;
        if (update.moduleName !== undefined && item.kind !== 'module') {
          item.moduleId = moduleId(update.moduleName);
        }
        counts.updated += 1;
      }
      for (const link of plan.link) {
        const item = state.items.get(link.id);
        if (item && !item.links.includes(chunkId) && item.sourceChunkId !== chunkId) {
          item.links.push(chunkId);
        }
        counts.linked += 1;
      }
      for (const removal of plan.remove) {
        const item = state.items.get(removal.id);
        if (!item || item.createdById !== null || !['OPEN', 'ASSUMED'].includes(item.status))
          continue;
        const referenced =
          item.kind === 'module' && [...state.items.values()].some((i) => i.moduleId === item.id);
        if (referenced && removal.repointTo === null) continue;
        if (removal.repointTo !== null) {
          item.sourceChunkId = removal.repointTo;
          item.links = item.links.filter((id) => id !== removal.repointTo);
        } else {
          state.items.delete(item.id);
        }
        counts.removed += 1;
      }
      for (const revalidate of plan.revalidate) {
        const item = state.items.get(revalidate.id);
        if (item?.status === 'NEEDS_REVALIDATION') item.status = 'OPEN';
        counts.updated += 1;
      }
      for (const unlink of plan.unlink) {
        const item = state.items.get(unlink.id);
        if (item) item.links = item.links.filter((id) => id !== chunkId);
      }
      return counts;
    },
    markExtracted: async (_tx: unknown, _scope: unknown, chunkId: string, needsReview: boolean) => {
      const chunk = state.chunks.get(chunkId);
      if (chunk) {
        chunk.extractedAt = new Date();
        chunk.needsReview = needsReview;
      }
    },
    finishSourceIfDone: async (_tx: unknown, _scope: unknown, chunkId: string) => {
      const chunk = state.chunks.get(chunkId);
      if (!chunk) return false;
      const siblings = [...state.chunks.values()].filter((c) => c.sourceId === chunk.sourceId);
      if (siblings.some((c) => c.extractedAt === null)) return false;
      if (state.finishedSources.includes(chunk.sourceId)) return false;
      state.finishedSources.push(chunk.sourceId);
      return true;
    },
    failSourceOfChunk: async (_tx: unknown, _scope: unknown, chunkId: string, reason: string) => {
      const chunk = state.chunks.get(chunkId);
      if (chunk) state.failedSources.set(chunk.sourceId, reason);
    },
  };
  return { repo: repo as unknown as ExtractionRepository, state };
}
