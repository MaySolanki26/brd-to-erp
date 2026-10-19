import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../uab/primitives/Button';
import { Dialog } from '../uab/primitives/overlay';

type Tone = 'default' | 'destructive' | 'primary';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title: string;
  /** What is lost and what is not: visible text, since it is a consequence the person must read. */
  description?: ReactNode;
  footnote?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  variant?: Tone;
  tone?: Tone;
  loading?: boolean;
  isPending?: boolean;
  confirmDisabled?: boolean;
  /** The person must type this text to enable the confirm button. */
  requireTyped?: string;
  icon?: LucideIcon;
  dismissable?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** The template confirmation dialog (alert dialog): Cancel and a confirm button, optionally a typed confirmation. */
export function ConfirmDialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  footnote,
  confirmLabel,
  cancelLabel = 'Cancel',
  loadingLabel = 'Working…',
  variant,
  tone,
  loading = false,
  isPending = false,
  confirmDisabled = false,
  requireTyped,
  dismissable = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const busy = loading || isPending;
  const resolvedTone = variant ?? tone ?? 'default';
  const canConfirm = !requireTyped || typed === requireTyped;

  const close = () => {
    if (busy || !dismissable) return;
    setTyped('');
    onOpenChange?.(false);
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      size="sm"
      role="alertdialog"
      footer={
        <>
          <Button onClick={close} disabled={busy} data-autofocus>
            {cancelLabel}
          </Button>
          <Button
            variant={resolvedTone === 'destructive' ? 'danger' : 'primary'}
            disabled={busy || confirmDisabled || !canConfirm}
            onClick={() => {
              void (async () => {
                await onConfirm();
                setTyped('');
              })();
            }}
          >
            {busy ? loadingLabel : (confirmLabel ?? 'Confirm')}
          </Button>
        </>
      }
    >
      {description && <div className="uab-confirm-text">{description}</div>}
      {requireTyped && (
        <div className="uab-form-field">
          <label className="uab-field-label" htmlFor="confirm-typed">
            Type <strong>{requireTyped}</strong> to confirm
          </label>
          <input
            id="confirm-typed"
            className="uab-input"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </div>
      )}
      {footnote && <p className="uab-muted uab-small">{footnote}</p>}
    </Dialog>
  );
}
