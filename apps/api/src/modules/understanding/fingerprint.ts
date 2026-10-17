import { createHash } from 'node:crypto';
import { itemKey, type KnowledgeItem } from './understanding.types.js';

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

/** Changes whenever an item is added, removed, reworded or changes status, and not otherwise. */
export function summaryFingerprint(items: KnowledgeItem[]): string {
  const lines = items
    .map(
      (i) =>
        `${itemKey(i)}:${i.status}:${i.moduleId ?? ''}:${sha(`${i.title}\n${i.description ?? ''}`)}`,
    )
    .sort();
  return sha(lines.join('\n'));
}
