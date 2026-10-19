import { useEffect } from 'react';
import { resetPasswordSchema, type OrgUserDto, type ResetPasswordInput } from '@brd/shared';
import { Form, FormDrawer, FormError } from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { generatePassword } from '@/lib/generate-password';
import { errorMessage } from '@/lib/error-message';
import { useResetUserPassword } from '../hooks/use-user-mutations';
import { PasswordField } from './PasswordField';

interface ResetPasswordDrawerProps {
  user: OrgUserDto | null;
  onClose: () => void;
  onReset: (user: OrgUserDto, tempPassword: string) => void;
}

function emptyValues(): ResetPasswordInput {
  return { tempPassword: generatePassword() };
}

export function ResetPasswordDrawer({ user, onClose, onReset }: ResetPasswordDrawerProps) {
  const form = useZodForm(resetPasswordSchema, { defaultValues: emptyValues() });
  const resetPassword = useResetUserPassword();
  const userId = user?.id;
  const { reset: resetForm } = form;
  const { reset: resetMutation } = resetPassword;

  useEffect(() => {
    if (userId) {
      resetForm(emptyValues());
      resetMutation();
    }
  }, [userId, resetForm, resetMutation]);

  const submit = form.handleSubmit((values) => {
    if (!user) return;
    resetPassword.mutate(
      { userId: user.id, ...values },
      {
        onSuccess: (updated) => {
          onClose();
          onReset(updated, values.tempPassword);
        },
      },
    );
  });

  return (
    <Form {...form}>
      <FormDrawer
        open={user !== null}
        onOpenChange={(open) => !open && onClose()}
        title="Reset password"
        description={user ? `${user.name} will be signed out and must choose a new password.` : ''}
        onSubmit={submit}
        submitLabel="Reset password"
        isPending={resetPassword.isPending}
      >
        <div className="space-y-4">
          <PasswordField name="tempPassword" label="New temporary password" />
          <FormError message={resetPassword.error ? errorMessage(resetPassword.error) : null} />
        </div>
      </FormDrawer>
    </Form>
  );
}
