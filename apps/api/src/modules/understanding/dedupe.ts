import { createHash } from 'node:crypto';
import type { QuestionReason } from '@brd/shared';
import { itemKey, type ItemRef } from './understanding.types.js';

/**
 * Identifies the gap a question is about: why it is asked and which items it concerns. Rewording the
 * same gap gives the same key, so it is never asked twice. Two distinct gaps of the same kind on the
 * same items share a key on purpose; the second is raised once the first has been answered.
 */
export function questionDedupeKey(question: {
  reason: QuestionReason;
  moduleId: string | null;
  linkedItems: ItemRef[];
}): string {
  const items = [...new Set(question.linkedItems.map(itemKey))].sort();
  return createHash('sha256')
    .update([question.reason, question.moduleId ?? '', ...items].join('|'))
    .digest('hex');
}
