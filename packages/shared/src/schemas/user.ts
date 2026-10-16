import { z } from 'zod';
import { uuidSchema } from './project.js';

export const orgRoleSchema = z.enum(['ORG_ADMIN', 'MEMBER']);

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

export const userParamsSchema = z.object({ userId: uuidSchema });
export type UserParams = z.infer<typeof userParamsSchema>;

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Invalid email address')),
  name: z.string().trim().min(1, 'Name is required').max(200),
  orgRole: orgRoleSchema,
  tempPassword: passwordSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    orgRole: orgRoleSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ tempPassword: passwordSchema });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(256),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
