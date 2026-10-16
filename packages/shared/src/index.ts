export const SHARED_VERSION = '0.0.0' as const;

export {
  JobName,
  DEFAULT_BACKOFF,
  type ProcessDocumentPayload,
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

// Constants
export {
  OrgRole,
  ProjectRole,
  RoleName,
  ProjectPermission,
  PROJECT_PERMISSIONS,
  projectRolesWith,
} from './constants/roles.js';
