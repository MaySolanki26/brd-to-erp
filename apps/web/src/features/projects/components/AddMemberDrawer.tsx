import { useEffect } from 'react';
import { z } from 'zod';
import { projectRoleSchema, uuidSchema } from '@brd/shared';
import {
  Form,
  FormControl,
  FormDrawer,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { errorMessage } from '@/lib/error-message';
import { useMemberCandidates } from '../hooks/use-members';
import { useAddMember } from '../hooks/use-member-mutations';
import { ROLE_LABELS, ROLE_OPTIONS } from '../project-labels';

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
        description="Pick a teammate from your organization."
        size="lg"
        onSubmit={submit}
        submitLabel="Add member"
        isPending={addMember.isPending}
        submitDisabled={candidates.isPending || options.length === 0}
      >
        <div className="space-y-4">
          {candidates.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(candidates.error)}
            </p>
          )}
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={candidates.isPending ? 'Loading…' : 'Select a person'}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map((candidate) => (
                      <SelectItem key={candidate.userId} value={candidate.userId}>
                        {candidate.name} ({candidate.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {addMember.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(addMember.error)}
            </p>
          )}
        </div>
      </FormDrawer>
    </Form>
  );
}
