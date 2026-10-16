import { useEffect } from 'react';
import {
  MAX_NOTE_CHARS,
  createNoteSchema,
  type ContextNoteDto,
  type CreateNoteInput,
} from '@brd/shared';
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
  toast,
} from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { errorMessage } from '@/lib/error-message';
import { useCreateNote, useUpdateNote } from '../hooks/use-source-mutations';

interface NoteDrawerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The note being edited; null to create a new one. */
  note: ContextNoteDto | null;
}

const EMPTY: CreateNoteInput = { title: '', body: '' };

export function NoteDrawer({ projectId, open, onOpenChange, note }: NoteDrawerProps) {
  const form = useZodForm(createNoteSchema, { defaultValues: EMPTY });
  const createNote = useCreateNote(projectId);
  const updateNote = useUpdateNote(projectId);
  const { reset: resetForm } = form;
  const { reset: resetCreate } = createNote;
  const { reset: resetUpdate } = updateNote;
  const mutation = note ? updateNote : createNote;

  useEffect(() => {
    if (open) {
      resetForm(note ? { title: note.title, body: note.body } : EMPTY);
      resetCreate();
      resetUpdate();
    }
  }, [open, note, resetForm, resetCreate, resetUpdate]);

  const done = (message: string) => {
    toast.success(message);
    onOpenChange(false);
  };

  const submit = form.handleSubmit((values) => {
    if (note) {
      updateNote.mutate({ noteId: note.id, ...values }, { onSuccess: () => done('Note updated') });
    } else {
      createNote.mutate(values, { onSuccess: () => done('Note added') });
    }
  });

  const length = form.watch('body').length;

  return (
    <Form {...form}>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={note ? 'Edit note' : 'Add context note'}
        description="Notes are processed like documents and kept with the project."
        size="xl"
        onSubmit={submit}
        submitLabel={note ? 'Save note' : 'Add note'}
        isPending={mutation.isPending}
        dirty={form.formState.isDirty}
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note</FormLabel>
                <FormControl>
                  <Textarea rows={14} {...field} />
                </FormControl>
                <p
                  className={`text-xs ${length > MAX_NOTE_CHARS ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {length.toLocaleString()} / {MAX_NOTE_CHARS.toLocaleString()} characters
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          {mutation.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(mutation.error)}
            </p>
          )}
        </div>
      </FormDrawer>
    </Form>
  );
}
