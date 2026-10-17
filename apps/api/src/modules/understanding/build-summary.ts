import type { SummaryLlmOutput } from '@brd/shared';
import { indexItems, itemKey, type KnowledgeItem } from './understanding.types.js';

export const MAX_KEY_REQUIREMENTS = 15;
export const MAX_KEY_RULES = 10;
export const MAX_MODULES = 50;
export const MAX_ASSUMPTIONS = 30;
const MAX_OVERVIEW_CHARS = 1000;
const MAX_LINE_CHARS = 300;

const tidy = (text: string, max: number): string => text.replace(/\s+/g, ' ').trim().slice(0, max);

/** Items a later step may lean on: neither ruled out nor waiting for a person to look again. */
const isReliable = (item: KnowledgeItem): boolean =>
  item.status !== 'REJECTED' && item.status !== 'NEEDS_REVALIDATION';

function pickKey<K extends 'requirement' | 'rule'>(
  proposed: { id: string; why: string }[],
  items: Map<string, KnowledgeItem>,
  kind: K,
  limit: number,
): { id: string; why: string }[] {
  const picked = new Map<string, { id: string; why: string }>();
  for (const { id, why } of proposed) {
    const item = items.get(itemKey({ kind, id }));
    if (!item || !isReliable(item) || picked.has(id)) continue;
    picked.set(id, { id, why: tidy(why, MAX_LINE_CHARS) });
    if (picked.size === limit) break;
  }
  return [...picked.values()];
}

/**
 * Cleans the model's summary against the real items and returns it in the same ids-only shape, which
 * is what gets stored (titles are joined in when it is read). Names, the assumption list and the
 * stale list come from the database, so an invented or misplaced id can never reach the summary.
 */
export function sanitizeSummary(
  output: SummaryLlmOutput,
  items: KnowledgeItem[],
): SummaryLlmOutput {
  const known = indexItems(items);
  const statements = new Map(
    output.assumptions.map((a) => [`${a.itemKind}:${a.itemId}`, a.statement]),
  );
  const moduleNotes = new Map(output.modules.map((m) => [m.moduleId, m.summary]));

  return {
    overview: tidy(output.overview, MAX_OVERVIEW_CHARS),
    modules: items
      .filter((i) => i.kind === 'module' && i.status !== 'REJECTED')
      .slice(0, MAX_MODULES)
      .map((m) => ({
        moduleId: m.id,
        name: m.title,
        summary: tidy(moduleNotes.get(m.id) ?? '', MAX_LINE_CHARS),
      })),
    keyRequirements: pickKey(
      output.keyRequirements.map((r) => ({ id: r.requirementId, why: r.why })),
      known,
      'requirement',
      MAX_KEY_REQUIREMENTS,
    ).map(({ id, why }) => ({ requirementId: id, why })),
    keyRules: pickKey(
      output.keyRules.map((r) => ({ id: r.ruleId, why: r.why })),
      known,
      'rule',
      MAX_KEY_RULES,
    ).map(({ id, why }) => ({ ruleId: id, why })),
    assumptions: items
      .filter((i) => i.status === 'ASSUMED')
      .slice(0, MAX_ASSUMPTIONS)
      .map((i) => ({
        itemKind: i.kind,
        itemId: i.id,
        statement: tidy(statements.get(itemKey(i)) ?? i.description ?? i.title, MAX_LINE_CHARS),
      })),
    staleItems: items
      .filter((i) => i.status === 'NEEDS_REVALIDATION')
      .map((i) => ({ itemKind: i.kind, itemId: i.id })),
  };
}
