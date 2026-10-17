import type { ExtractionLlmOutput } from '@brd/shared';
import {
  REPLACEABLE_STATUSES,
  type DraftItem,
  type DraftModule,
  type Drafts,
  type ExistingItem,
  type ExtractedKind,
  type ExtractionPlan,
} from './extraction.types.js';

export const MAX_MODULES_PER_CHUNK = 10;
export const MAX_ITEMS_PER_CHUNK = 20;
const MAX_NAME_CHARS = 120;
const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 2000;

/** Two titles are the same item when they differ only in case or spacing. */
export function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

const clean = (text: string, max: number): string => text.trim().replace(/\s+/g, ' ').slice(0, max);

function sanitizeItems(
  items: ExtractionLlmOutput['requirements'],
  moduleKeys: Set<string>,
): DraftItem[] {
  const seen = new Set<string>();
  const kept: DraftItem[] = [];
  for (const item of items) {
    const title = clean(item.title, MAX_TITLE_CHARS);
    const key = normalize(title);
    if (title === '' || seen.has(key)) continue;
    seen.add(key);
    const moduleName = item.moduleName ? clean(item.moduleName, MAX_NAME_CHARS) : '';
    kept.push({
      title,
      description: clean(item.description, MAX_DESCRIPTION_CHARS),
      // A module the answer did not list (or that was capped away) is dropped, never invented.
      moduleName: moduleKeys.has(normalize(moduleName)) ? moduleName : null,
    });
    if (kept.length === MAX_ITEMS_PER_CHUNK) break;
  }
  return kept;
}

/** The model's answer is a draft: trim it, cap it, drop empties and repeats, keep module names honest. */
export function sanitizeDrafts(output: ExtractionLlmOutput): Drafts {
  const seen = new Set<string>();
  const modules: DraftModule[] = [];
  for (const module of output.modules) {
    const name = clean(module.name, MAX_NAME_CHARS);
    const key = normalize(name);
    if (name === '' || seen.has(key)) continue;
    seen.add(key);
    modules.push({ name, description: clean(module.description, MAX_DESCRIPTION_CHARS) });
    if (modules.length === MAX_MODULES_PER_CHUNK) break;
  }
  return {
    modules,
    requirements: sanitizeItems(output.requirements, seen),
    rules: sanitizeItems(output.rules, seen),
  };
}

const isReplaceable = (item: ExistingItem): boolean =>
  item.createdById === null && REPLACEABLE_STATUSES.includes(item.status);

interface Draft {
  title: string;
  description: string;
  moduleName: string | null;
}

function planKind(
  kind: ExtractedKind,
  drafts: Draft[],
  existing: ExistingItem[],
  plan: ExtractionPlan,
): void {
  const matched = new Set<string>();

  for (const draft of drafts) {
    const key = normalize(draft.title);
    const candidates = existing.filter((item) => normalize(item.title) === key);
    const match =
      candidates.find((item) => item.ownedHere) ??
      candidates.find((item) => item.linkedHere) ??
      candidates[0];

    if (!match) {
      plan.create.push({ kind, ...draft });
      continue;
    }
    matched.add(match.id);

    if (!match.ownedHere && !match.linkedHere) {
      plan.link.push({ kind, id: match.id });
    }
    const replaceable = isReplaceable(match);
    const update: { description?: string; moduleName?: string } = {};
    if (replaceable && match.ownedHere && draft.description && draft.description !== match.description) {
      update.description = draft.description;
    }
    if (replaceable && match.moduleId === null && draft.moduleName) {
      update.moduleName = draft.moduleName;
    }
    if (update.description !== undefined || update.moduleName !== undefined) {
      plan.update.push({ kind, id: match.id, ...update });
    }
  }

  for (const item of existing) {
    if (matched.has(item.id)) continue;
    if (item.ownedHere && isReplaceable(item)) {
      plan.remove.push({ kind, id: item.id, repointTo: item.otherSourceChunkIds[0] ?? null });
    } else if (item.linkedHere) {
      plan.unlink.push({ kind, id: item.id });
    }
  }
}

/**
 * Turns the chunk's drafts and what is already stored into the changes to make. Running it again on
 * the same drafts produces an empty plan, and only unconfirmed items made by the pipeline are ever
 * replaced: a confirmed, rejected, flagged or person-made item is only ever linked to.
 */
export function planExtraction(
  drafts: Drafts,
  existing: Record<ExtractedKind, ExistingItem[]>,
): ExtractionPlan {
  const plan: ExtractionPlan = { create: [], link: [], update: [], remove: [], unlink: [] };
  planKind(
    'module',
    drafts.modules.map((m) => ({ title: m.name, description: m.description, moduleName: null })),
    existing.module,
    plan,
  );
  planKind('requirement', drafts.requirements, existing.requirement, plan);
  planKind('rule', drafts.rules, existing.rule, plan);
  return plan;
}

export const isEmptyPlan = (plan: ExtractionPlan): boolean =>
  plan.create.length + plan.link.length + plan.update.length + plan.remove.length + plan.unlink.length ===
  0;
