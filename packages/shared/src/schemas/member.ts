import { z } from 'zod';
import { uuidSchema } from './project.js';

export const projectRoleSchema = z.enum(['OWNER', 'ANALYST', 'APPROVER', 'VIEWER']);

export const memberParamsSchema = z.object({ id: uuidSchema, userId: uuidSchema });
export type MemberParams = z.infer<typeof memberParamsSchema>;

export const addMemberSchema = z.object({
  userId: uuidSchema,
  role: projectRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z.object({ role: projectRoleSchema });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
