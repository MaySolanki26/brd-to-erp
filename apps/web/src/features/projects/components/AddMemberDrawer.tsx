import { useEffect } from 'react';
import { z } from 'zod';
import { projectRoleSchema, uuidSchema } from '@brd/shared';
import {
  SelectMenu,
  Form,
  FormControl,
  FormDrawer,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  toast,
  FormError,
} from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { errorMessage } from '@/lib/error-message';
import { useMemberCandidates } from '../hooks/use-members';
import { useAddMember } from '../hooks/use-member-mutations';
import { ROLE_LABELS, ROLE_OPTIONS } from '../project-labels';
import { PersonPicker } from './PersonPicker';

const addMemberFormSchema = z.object({
  userId: uuidSchema,
  role: projectRoleSchema,
});
type AddMemberForm = z.infer<typeof addMemberFormSchema>;

interface AddMemberDrawerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberDrawer({ projectId, open, onOpenChange }: AddMemberDrawerProps) {
  const candidates = useMemberCandidates(projectId, open);
  const addMember = useAddMember(projectId);
  const form = useZodForm<AddMemberForm>(addMemberFormSchema, {
    defaultValues: { userId: '', role: 'ANALYST' },
  });
  const { reset: resetForm } = form;
  const { reset: resetMutation } = addMember;

  useEffect(() => {
    if (open) {
      resetForm({ userId: '', role: 'ANALYST' });
      resetMutation();
    }
  }, [open, resetForm, resetMutation]);

  const submit = form.handleSubmit((values) =>
    addMember.mutate(values, {
      onSuccess: (member) => {
        toast.success(`${member.name} added to the project`);
        onOpenChange(false);
      },
    }),
  );

  const options = candidates.data ?? [];

  return (
    <Form {...form}>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Add project member"
        description="Search your organization by name or email."
        onSubmit={submit}
        submitLabel="Add member"
        isPending={addMember.isPending}
        submitDisabled={candidates.isPending || options.length === 0}
        dirty={form.formState.isDirty}
      >
        <div className="space-y-4">
          <FormError message={candidates.isError ? errorMessage(candidates.error) : null} />
          {candidates.isSuccess && options.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Everyone in your organization is already on this project. Ask an admin to add more
              people in Team.
            </p>
          )}
          <FormField
            control={form.control}
            name="userId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Person</FormLabel>
                <FormControl>
                  <PersonPicker
                    people={options}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={candidates.isPending ? 'Loading…' : 'Search by name or email'}
                    disabled={candidates.isPending || options.length === 0}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project role</FormLabel>
                <FormControl>
                  <SelectMenu
                    block
                    label="Project role"
                    value={field.value}
                    options={ROLE_OPTIONS.map((role) => ({
                      value: role,
                      label: ROLE_LABELS[role],
                    }))}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormError message={addMember.error ? errorMessage(addMember.error) : null} />
        </div>
      </FormDrawer>
    </Form>
  );
}
