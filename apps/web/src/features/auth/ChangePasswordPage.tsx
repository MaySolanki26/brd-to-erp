import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { passwordSchema } from '@brd/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{forced ? 'Choose a new password' : 'Change password'}</CardTitle>
          <CardDescription>
            {forced
              ? 'You are using a temporary password. Choose your own to continue.'
              : 'Other devices will be signed out.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(({ currentPassword, newPassword }) =>
                changePassword.mutate({ currentPassword, newPassword }),
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
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
                  <FormItem>
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
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {changePassword.error && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(changePassword.error)}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={changePassword.isPending}>
                {changePassword.isPending ? 'Saving...' : 'Update password'}
              </Button>
              {!forced && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
