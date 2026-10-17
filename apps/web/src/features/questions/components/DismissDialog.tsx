import { useEffect, useState } from 'react';
import { MAX_DISMISS_REASON_CHARS, dismissQuestionSchema } from '@brd/shared';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  FormError,
} from '@brd/ui';

interface DismissDialogProps {
  open: boolean;
  questionText: string;
  pending: boolean;
  /** A failure from the server, other than a conflict (which is shown on the card). */
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

const reasonSchema = dismissQuestionSchema.shape.reason;

export function DismissDialog({
  open,
  questionText,
  pending,
  error,
  onOpenChange,
  onConfirm,
}: DismissDialogProps) {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setProblem(null);
    }
  }, [open]);

  const submit = () => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'Say why this question is being dismissed');
      return;
    }
    setProblem(null);
    onConfirm(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dismiss this question?</DialogTitle>
          <DialogDescription>{questionText}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          <Label htmlFor="dismiss-reason">Reason</Label>
          <Textarea
            id="dismiss-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={problem !== null}
            aria-describedby="dismiss-reason-help"
          />
          <p id="dismiss-reason-help" className="text-xs text-muted-foreground">
            {reason.length} / {MAX_DISMISS_REASON_CHARS} characters. Dismissed questions are not
            asked again.
          </p>
          <FormError message={problem} />
          <FormError message={error} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={submit}>
            {pending ? 'Dismissing…' : 'Dismiss question'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
