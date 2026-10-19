import { useEffect } from 'react';
import { createProjectSchema, type CreateProjectInput, type ProjectDto } from '@brd/shared';
import {
  Form,
  FormControl,
  FormDrawer,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
  FormError,
} from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { errorMessage } from '@/lib/error-message';
import { useCreateProject } from '../hooks/use-project-mutations';

interface CreateProjectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: ProjectDto) => void;
}

const EMPTY: CreateProjectInput = { name: '', description: '' };

export function CreateProjectDrawer({ open, onOpenChange, onCreated }: CreateProjectDrawerProps) {
  const form = useZodForm(createProjectSchema, { defaultValues: EMPTY });
  const createProject = useCreateProject();
  const { reset: resetForm } = form;
  const { reset: resetMutation } = createProject;

  useEffect(() => {
    if (open) {
      resetForm(EMPTY);
      resetMutation();
    }
  }, [open, resetForm, resetMutation]);

  const submit = form.handleSubmit((values) =>
    createProject.mutate(
      { name: values.name, ...(values.description ? { description: values.description } : {}) },
      {
        onSuccess: (project) => {
          onOpenChange(false);
          onCreated(project);
        },
      },
    ),
  );

  return (
    <Form {...form}>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="New project"
        description="You become the project owner and can add teammates afterwards."
        onSubmit={submit}
        submitLabel="Create project"
        isPending={createProject.isPending}
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
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormError message={createProject.error ? errorMessage(createProject.error) : null} />
        </div>
      </FormDrawer>
    </Form>
  );
}
