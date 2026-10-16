export const SHARED_VERSION = '0.0.0' as const;

export { JobName, DEFAULT_BACKOFF, type ProcessSourcePayload, type JobPayloadMap } from './jobs.js';

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
  type ProcessingStatusDto,
} from './types/source.js';

// Constants
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
