import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { passwordSchema } from '@brd/shared';
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  FormError,
} from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { errorMessage } from '@/lib/error-message';
import { useAuth } from './hooks/use-auth';
import { useChangePassword } from './hooks/use-change-password';

const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(256),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

export function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const changePassword = useChangePassword();
  const forced = user?.mustChangePassword ?? false;
  const form = useZodForm(changePasswordFormSchema, {
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  return (
    <div className="uab-login-page">
      <div className="uab-panel uab-login-card">
        <div className="uab-login-brand">
          <span className="uab-login-mark" aria-hidden="true">
            B
          </span>
          <div>
            <h1 className="uab-login-title">
              {forced ? 'Choose a new password' : 'Change password'}
            </h1>
            <p className="uab-muted">
              {forced
                ? 'You are using a temporary password. Choose your own to continue.'
                : 'Other devices will be signed out.'}
            </p>
          </div>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(({ currentPassword, newPassword }) =>
              changePassword.mutate({ currentPassword, newPassword }),
            )}
            className="uab-form-grid"
          >
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem className="uab-span-all">
                  <FormLabel>{forced ? 'Temporary password' : 'Current password'}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem className="uab-span-all">
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>At least 12 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem className="uab-span-all">
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="uab-span-all">
              <FormError
                message={changePassword.error ? errorMessage(changePassword.error) : null}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="uab-span-all"
              disabled={changePassword.isPending}
            >
              {changePassword.isPending ? 'Saving...' : 'Update password'}
            </Button>
            {!forced && (
              <Button
                type="button"
                variant="ghost"
                className="uab-span-all"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
