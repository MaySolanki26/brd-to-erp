import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../alert-dialog';
import { Input } from '../input';
import { Label } from '../label';

type Tone = 'default' | 'destructive' | 'primary';

const TONE_BADGE: Record<'default' | 'destructive', string> = {
  destructive: 'bg-destructive/10 text-destructive',
  default: 'bg-primary/10 text-primary',
};

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title: ReactNode;
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
  requireTyped?: string;
  icon?: LucideIcon;
  dismissable?: boolean;
  onConfirm: () => void | Promise<void>;
}

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
  icon: Icon,
  dismissable = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const busy = loading || isPending;
  const resolvedTone = variant ?? tone ?? 'default';
  const isDestructive = resolvedTone === 'destructive';
  const canConfirm = !requireTyped || typed === requireTyped;

  const requestChange = (next: boolean) => {
    if (busy && !next) return;
    if (!next && !dismissable) return;
    if (!next) setTyped('');
    onOpenChange?.(next);
    if (!next) onClose?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={requestChange}>
      <AlertDialogContent className="gap-5 border-0 p-5 shadow-sm">
        <AlertDialogHeader className="space-y-2 text-left">
          <div className={cn(Icon && 'flex items-start gap-3')}>
            {Icon && (
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  TONE_BADGE[isDestructive ? 'destructive' : 'default'],
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </span>
            )}
            <div className="space-y-2">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {(description || footnote) && (
                <div className="space-y-1">
                  {description && (
                    <AlertDialogDescription className="text-foreground">
                      {description}
                    </AlertDialogDescription>
                  )}
                  {footnote && <p className="text-muted-foreground text-lg">{footnote}</p>}
                </div>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        {requireTyped && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-typed" className="text-muted-foreground text-lg">
              Type <code className="text-foreground font-mono">{requireTyped}</code> to confirm
            </Label>
            <Input
              id="confirm-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter className="gap-1.5 sm:space-x-0">
          <AlertDialogCancel className="border-muted-foreground/40 h-7" disabled={busy}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || confirmDisabled || !canConfirm}
            onClick={(e) => {
              e.preventDefault();
              void (async () => {
                await onConfirm();
                setTyped('');
              })();
            }}
            className={cn(
              'h-7',
              isDestructive &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
            )}
          >
            {busy ? loadingLabel : (confirmLabel ?? (isDestructive ? 'Delete' : 'Confirm'))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
