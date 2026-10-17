import type { KnowledgeStatus, LinkedItemKind } from '@brd/shared';
import type { KnowledgeItem } from './understanding.types.js';

let counter = 0;

/** Valid, distinct UUIDs: the LLM schemas require them. */
export function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

export function item(
  kind: LinkedItemKind,
  status: KnowledgeStatus = 'OPEN',
  over: Partial<KnowledgeItem> = {},
): KnowledgeItem {
  const id = uuid();
  return {
    kind,
    id,
    title: `${kind} ${id.slice(-4)}`,
    description: `Description of ${kind}`,
    status,
    moduleId: null,
    ...over,
  };
}
