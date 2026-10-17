import type { LinkedItemKind, QuestionPriority, QuestionReason, QuestionStatus } from '@brd/shared';

export const REASON_LABELS: Record<QuestionReason, string> = {
  GAP: 'Gap',
  AMBIGUITY: 'Ambiguity',
  CONFLICT: 'Conflict',
  MISSING_RULE: 'Missing rule',
};

export const PRIORITY_LABELS: Record<QuestionPriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  NORMAL: 'Normal',
};

export const PRIORITY_TONES: Record<QuestionPriority, 'danger' | 'warning' | 'neutral'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  NORMAL: 'neutral',
};

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  OPEN: 'Open',
  ANSWERED: 'Answered',
  DISMISSED: 'Dismissed',
};

export const KIND_LABELS: Record<LinkedItemKind, string> = {
  requirement: 'Requirement',
  rule: 'Rule',
  module: 'Module',
};

export const NO_MODULE_TITLE = 'General';
