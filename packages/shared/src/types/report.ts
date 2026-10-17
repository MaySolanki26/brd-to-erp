import type {
  ApprovalDecision,
  ConditionStatus,
  ReportVersionStatus,
} from '../constants/report.js';
import type { QuestionPriority, QuestionReason } from '../constants/questions.js';
import type { PersonRef } from './source.js';

export interface ReportConditionDto {
  id: string;
  text: string;
  status: ConditionStatus;
  updatedBy: PersonRef | null;
  metAt: string | null;
}

export interface ReportDecisionDto {
  decision: ApprovalDecision;
  /** The reason for a rejection, or the approver's comment. */
  comment: string | null;
  decidedBy: PersonRef;
  decidedAt: string;
  /** SHA-256 of the baseline snapshot stored with the decision. */
  baselineHash: string;
  conditions: ReportConditionDto[];
}

export interface ReportVersionSummaryDto {
  version: number;
  status: ReportVersionStatus;
  isLatest: boolean;
  summaryVersion: number | null;
  failureReason: string | null;
  createdBy: PersonRef;
  createdAt: string;
  submittedBy: PersonRef | null;
  submittedAt: string | null;
  outdatedAt: string | null;
  decision: Pick<ReportDecisionDto, 'decision' | 'decidedAt'> | null;
}

export interface ReportVersionDto extends ReportVersionSummaryDto {
  /** Null while the version is being generated or if generation failed. */
  content: unknown;
  decisionDetail: ReportDecisionDto | null;
}

export interface BlockingQuestionDto {
  id: string;
  text: string;
  priority: QuestionPriority;
  reason: QuestionReason;
}

export interface ReportReadinessDto {
  ready: boolean;
  /** Open CRITICAL questions; a report cannot be generated, submitted or approved while any exist. */
  blockingQuestions: BlockingQuestionDto[];
  /** False until the project summary exists: the report is written from it. */
  hasSummary: boolean;
}
