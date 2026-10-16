import { ConfirmDialog, CopyButton } from '@brd/ui';

export interface Credentials {
  name: string;
  email: string;
  tempPassword: string;
}

interface CredentialsDialogProps {
  credentials: Credentials | null;
  onClose: () => void;
}

export function CredentialsDialog({ credentials, onClose }: CredentialsDialogProps) {
  return (
    <ConfirmDialog
      open={credentials !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Share these sign-in details"
      description={
        credentials && (
          <span className="block space-y-2">
            <span className="block">
              {credentials.name} must change this temporary password on first sign-in. It will not
              be shown again.
            </span>
            <span className="block rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
              <span className="flex items-center justify-between gap-2">
                <span>{credentials.email}</span>
                <CopyButton value={credentials.email} label="email" toastOnCopy />
              </span>
              <span className="flex items-center justify-between gap-2">
                <span>{credentials.tempPassword}</span>
                <CopyButton value={credentials.tempPassword} label="password" toastOnCopy />
              </span>
            </span>
          </span>
        )
      }
      confirmLabel="Done"
      cancelLabel="Close"
      onConfirm={onClose}
    />
  );
}
