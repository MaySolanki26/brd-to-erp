export const REPORT_VERSION_STATUSES = [
  'GENERATING',
  'FAILED',
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'APPROVED_WITH_CONDITIONS',
  'OUTDATED',
] as const;
export type ReportVersionStatus = (typeof REPORT_VERSION_STATUSES)[number];

export const APPROVAL_DECISIONS = ['APPROVED', 'REJECTED', 'APPROVED_WITH_CONDITIONS'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const CONDITION_STATUSES = ['OPEN', 'MET'] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export const RISK_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

/** Versions whose decision was an approval; these can become OUTDATED when the project moves on. */
export const APPROVED_STATUSES: readonly ReportVersionStatus[] = [
  'APPROVED',
  'APPROVED_WITH_CONDITIONS',
];

export const MAX_REJECTION_CHARS = 1000;
export const MAX_COMMENT_CHARS = 2000;
export const MAX_CONDITION_CHARS = 500;
export const MAX_CONDITIONS = 20;
