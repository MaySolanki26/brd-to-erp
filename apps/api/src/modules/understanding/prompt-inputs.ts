import type { SummaryLlmOutput } from '@brd/shared';
import {
  indexItems,
  itemKey,
  type ExistingQuestion,
  type ItemRef,
  type KnowledgeItem,
  type PromptItem,
  type QuestionContext,
} from './understanding.types.js';

const MAX_TEXT_CHARS = 600;
const MAX_ITEMS_PER_KIND_IN_SUMMARY = 200;
export const MAX_ITEMS_FOR_QUESTIONS = 60;
export const MAX_EXISTING_QUESTIONS = 100;

const clip = (text: string | null, max = MAX_TEXT_CHARS): string | null =>
  text === null ? null : text.length > max ? `${text.slice(0, max)}…` : text;

/**
 * The model gets untrusted business text as one JSON block. Every "<" is escaped, so nothing inside the
 * data can close the block early or open a tag of its own.
 */
function wrap(data: unknown): string {
  return `<data>\n${JSON.stringify(data).replace(/</g, '\\u003c')}\n</data>`;
}

const idsOf = (refs: ItemRef[]) => refs.map(({ kind, id }) => ({ kind, id }));

export function summaryInput(projectName: string, items: KnowledgeItem[]): string {
  const ofKind = (kind: KnowledgeItem['kind']) =>
    items.filter((i) => i.kind === kind).slice(0, MAX_ITEMS_PER_KIND_IN_SUMMARY);
  return wrap({
    project: projectName,
    modules: ofKind('module').map((m) => ({
      id: m.id,
      name: m.title,
      description: clip(m.description),
      status: m.status,
    })),
    requirements: ofKind('requirement').map((i) => ({
      id: i.id,
      moduleId: i.moduleId,
      title: i.title,
      description: clip(i.description),
      status: i.status,
    })),
    rules: ofKind('rule').map((i) => ({
      id: i.id,
      moduleId: i.moduleId,
      title: i.title,
      description: clip(i.description),
      status: i.status,
    })),
  });
}

/** Items most in need of a look first: open or stale ones before settled ones. Rejected items are left out. */
const ATTENTION_ORDER = ['NEEDS_REVALIDATION', 'OPEN', 'ASSUMED', 'CONFIRMED'] as const;

export function selectItemsForQuestions(items: PromptItem[]): PromptItem[] {
  return items
    .filter((i) => i.status !== 'REJECTED')
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        ATTENTION_ORDER.indexOf(a.item.status as (typeof ATTENTION_ORDER)[number]) -
          ATTENTION_ORDER.indexOf(b.item.status as (typeof ATTENTION_ORDER)[number]) ||
        a.index - b.index,
    )
    .slice(0, MAX_ITEMS_FOR_QUESTIONS)
    .map(({ item }) => item);
}

export function questionsInput(items: PromptItem[], existing: ExistingQuestion[]): string {
  return wrap({
    items: items.map((i) => ({
      kind: i.kind,
      id: i.id,
      moduleId: i.moduleId,
      title: i.title,
      description: clip(i.description),
      status: i.status,
      sourceExcerpt: clip(i.excerpt),
    })),
    existingQuestions: existing.slice(0, MAX_EXISTING_QUESTIONS).map((q) => ({
      id: q.id,
      status: q.status,
      reason: q.reason,
      text: clip(q.text),
      linkedItemIds: idsOf(q.linked),
    })),
  });
}

export function applyAnswerInput(
  question: QuestionContext,
  answer: string,
  linked: KnowledgeItem[],
): string {
  return wrap({
    question: { reason: question.reason, priority: question.priority, text: question.text },
    answer,
    items: linked.map((i) => ({
      kind: i.kind,
      id: i.id,
      title: i.title,
      description: i.description,
      status: i.status,
    })),
  });
}

/**
 * The project summary as the shared, cached context for later calls. Titles are joined in from the
 * real items; the text is identical for the same summary and titles, so the provider can cache it.
 */
export function summaryContext(content: SummaryLlmOutput, items: KnowledgeItem[]): string {
  const known = indexItems(items);
  const title = (ref: ItemRef): string => known.get(itemKey(ref))?.title ?? '(removed)';
  return JSON.stringify({
    overview: content.overview,
    modules: content.modules.map((m) => ({ id: m.moduleId, name: m.name, summary: m.summary })),
    keyRequirements: content.keyRequirements.map((r) => ({
      id: r.requirementId,
      title: title({ kind: 'requirement', id: r.requirementId }),
      why: r.why,
    })),
    keyRules: content.keyRules.map((r) => ({
      id: r.ruleId,
      title: title({ kind: 'rule', id: r.ruleId }),
      why: r.why,
    })),
    assumptions: content.assumptions.map((a) => ({
      kind: a.itemKind,
      id: a.itemId,
      title: title({ kind: a.itemKind, id: a.itemId }),
      statement: a.statement,
    })),
    staleItems: content.staleItems.map((s) => ({
      kind: s.itemKind,
      id: s.itemId,
      title: title({ kind: s.itemKind, id: s.itemId }),
    })),
  });
}
