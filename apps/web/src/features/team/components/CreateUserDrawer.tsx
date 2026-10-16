import { useEffect } from 'react';
import { createUserSchema, type CreateUserInput, type OrgUserDto } from '@brd/shared';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { generatePassword } from '@/lib/generate-password';
import { errorMessage } from '@/lib/error-message';
import { useCreateUser } from '../hooks/use-user-mutations';
import { PasswordField } from './PasswordField';

interface CreateUserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: OrgUserDto, tempPassword: string) => void;
}

function emptyValues(): CreateUserInput {
  return { email: '', name: '', orgRole: 'MEMBER', tempPassword: generatePassword() };
}

export function CreateUserDrawer({ open, onOpenChange, onCreated }: CreateUserDrawerProps) {
  const form = useZodForm(createUserSchema, { defaultValues: emptyValues() });
  const createUser = useCreateUser();
  const { reset: resetForm } = form;
  const { reset: resetMutation } = createUser;

  useEffect(() => {
    if (open) {
      resetForm(emptyValues());
      resetMutation();
    }
  }, [open, resetForm, resetMutation]);

  const submit = form.handleSubmit((values) =>
    createUser.mutate(values, {
      onSuccess: (user) => {
        onOpenChange(false);
        onCreated(user, values.tempPassword);
      },
    }),
  );

  return (
    <Form {...form}>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Add team member"
        description="They sign in with the temporary password and must change it."
        size="lg"
        onSubmit={submit}
        submitLabel="Create user"
        isPending={createUser.isPending}
        dirty={form.formState.isDirty}
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orgRole"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ORG_ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Admins manage the team. Project access is set per project.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <PasswordField name="tempPassword" label="Temporary password" />
          {createUser.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(createUser.error)}
            </p>
          )}
        </div>
      </FormDrawer>
    </Form>
  );
}
