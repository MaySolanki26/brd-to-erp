export const SHARED_VERSION = '0.0.0' as const;

export {
  JobName,
  DEFAULT_BACKOFF,
  type ProcessSourcePayload,
  type RefreshSummaryPayload,
  type GenerateQuestionsPayload,
  type ApplyAnswerPayload,
  type ExtractChunkPayload,
  type GenerateReportPayload,
  type JobPayloadMap,
} from './jobs.js';

// Schemas
export { loginSchema, type LoginInput } from './schemas/auth.js';
export {
  projectStatusSchema,
  uuidSchema,
  projectIdParamsSchema,
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  type ProjectIdParams,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ListProjectsQuery,
} from './schemas/project.js';
export {
  projectRoleSchema,
  memberParamsSchema,
  addMemberSchema,
  updateMemberSchema,
  type MemberParams,
  type AddMemberInput,
  type UpdateMemberInput,
} from './schemas/member.js';
export {
  orgRoleSchema,
  passwordSchema,
  userParamsSchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  changePasswordSchema,
  type UserParams,
  type CreateUserInput,
  type UpdateUserInput,
  type ResetPasswordInput,
  type ChangePasswordInput,
} from './schemas/user.js';
export {
  documentParamsSchema,
  documentVersionParamsSchema,
  uploadUrlRequestSchema,
  confirmUploadSchema,
  listDocumentsQuerySchema,
  documentDetailQuerySchema,
  type DocumentParams,
  type DocumentVersionParams,
  type UploadUrlRequest,
  type ConfirmUploadInput,
  type ListDocumentsQuery,
  type DocumentDetailQuery,
} from './schemas/document.js';
export {
  noteParamsSchema,
  createNoteSchema,
  updateNoteSchema,
  listNotesQuerySchema,
  type NoteParams,
  type CreateNoteInput,
  type UpdateNoteInput,
  type ListNotesQuery,
} from './schemas/note.js';

export {
  knowledgeStatusSchema,
  chunkParamsSchema,
  listKnowledgeQuerySchema,
  listModulesQuerySchema,
  itemParamsSchema,
  revalidateItemSchema,
  REVALIDATION_OUTCOMES,
  type ItemParams,
  type RevalidateItemInput,
  type ChunkParams,
  type ListKnowledgeQuery,
  type ListModulesQuery,
} from './schemas/knowledge.js';

export {
  questionStatusSchema,
  questionReasonSchema,
  questionPrioritySchema,
  questionParamsSchema,
  listQuestionsQuerySchema,
  answerQuestionSchema,
  dismissQuestionSchema,
  listDecisionsQuerySchema,
  summaryQuerySchema,
  decisionChangeRecordSchema,
  decisionConflictRecordSchema,
  type DecisionChangeRecord,
  type DecisionConflictRecord,
  type QuestionParams,
  type ListQuestionsQuery,
  type AnswerQuestionInput,
  type DismissQuestionInput,
  type ListDecisionsQuery,
  type SummaryQuery,
} from './schemas/question.js';

export {
  summaryLlmOutputSchema,
  questionsLlmOutputSchema,
  generatedQuestionSchema,
  applyAnswerLlmOutputSchema,
  extractionLlmOutputSchema,
  reportLlmOutputSchema,
  type ReportLlmOutput,
  type ExtractionLlmOutput,
  type SummaryLlmOutput,
  type QuestionsLlmOutput,
  type GeneratedQuestion,
  type ApplyAnswerLlmOutput,
} from './schemas/understanding-llm.js';

export {
  reportVersionParamsSchema,
  conditionParamsSchema,
  approveReportSchema,
  rejectReportSchema,
  approveWithConditionsSchema,
  updateConditionSchema,
  reportNarrativeSchema,
  reportContentSchema,
  type ReportVersionParams,
  type ConditionParams,
  type ApproveReportInput,
  type RejectReportInput,
  type ApproveWithConditionsInput,
  type UpdateConditionInput,
  type ReportNarrative,
  type ReportContent,
} from './schemas/report.js';

// Types
export { type ApiErrorCode, type ApiErrorEnvelope } from './types/api.js';
export { type UserDto, type OrgUserDto } from './types/user.js';
export {
  type ProjectDto,
  type ProjectStatus,
  type MemberDto,
  type MemberCandidateDto,
  type PagedResult,
} from './types/project.js';

export {
  type KnowledgeSourceDto,
  type ModuleRefDto,
  type RequirementDto,
  type BusinessRuleDto,
  type ModuleDto,
  type ChunkDetailDto,
  type KnowledgeKind,
  type KnowledgeSummaryDto,
} from './types/knowledge.js';
export {
  type LinkedItemDto,
  type QuestionAnswerDto,
  type QuestionDismissalDto,
  type QuestionDto,
  type QuestionCountsDto,
  type QuestionListDto,
  type QuestionModuleCountDto,
  type DecisionItemStateDto,
  type DecisionChangeDto,
  type DecisionConflictDto,
  type DecisionDto,
  type SummaryItemRefDto,
  type SummaryContentDto,
  type SummaryVersionDto,
  type SummaryDto,
  type SummaryResponseDto,
} from './types/question.js';
export {
  type SourceStatus,
  type PersonRef,
  type DocumentVersionDto,
  type DocumentDto,
  type ChunkDto,
  type DocumentDetailDto,
  type UploadUrlDto,
  type ConfirmUploadDto,
  type ContextNoteDto,
  type ProcessingSourceDto,
  type ChunkProgressDto,
  type ProcessingStatusDto,
} from './types/source.js';

// Constants
export {
  QUESTION_STATUSES,
  QUESTION_REASONS,
  QUESTION_PRIORITIES,
  LINKED_ITEM_KINDS,
  MAX_ANSWER_CHARS,
  MAX_DISMISS_REASON_CHARS,
  priorityRank,
  type QuestionStatus,
  type QuestionReason,
  type QuestionPriority,
  type LinkedItemKind,
} from './constants/questions.js';
export {
  KNOWLEDGE_STATUSES,
  ATTENTION_STATUSES,
  type KnowledgeStatus,
} from './constants/knowledge.js';
export {
  MAX_UPLOAD_BYTES,
  MAX_NOTE_CHARS,
  SOURCE_FILE_TYPES,
  SOURCE_FILE_ACCEPT,
  sourceFileTypeOf,
  type SourceFileType,
} from './constants/sources.js';
export {
  OrgRole,
  ProjectRole,
  RoleName,
  ProjectPermission,
  PROJECT_PERMISSIONS,
  projectRolesWith,
} from './constants/roles.js';

export {
  type ReportConditionDto,
  type ReportDecisionDto,
  type ReportVersionSummaryDto,
  type ReportVersionDto,
  type BlockingQuestionDto,
  type ReportReadinessDto,
} from './types/report.js';
export {
  REPORT_VERSION_STATUSES,
  APPROVAL_DECISIONS,
  CONDITION_STATUSES,
  RISK_SEVERITIES,
  APPROVED_STATUSES,
  MAX_REJECTION_CHARS,
  MAX_COMMENT_CHARS,
  MAX_CONDITION_CHARS,
  MAX_CONDITIONS,
  type ReportVersionStatus,
  type ApprovalDecision,
  type ConditionStatus,
  type RiskSeverity,
} from './constants/report.js';
