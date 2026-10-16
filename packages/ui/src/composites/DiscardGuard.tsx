import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from '../button';

export interface DiscardGuardState {
  requestClose: () => void;
  confirming: boolean;
  keepEditing: () => void;
  discard: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
}

const DiscardGuardContext = React.createContext<DiscardGuardState | null>(null);

export function useDiscardGuard(): DiscardGuardState | null {
  return React.useContext(DiscardGuardContext);
}

export const DiscardGuardProvider = DiscardGuardContext.Provider;

export interface UseDiscardGuardOptions {
  dirty?: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

export function useDiscardGuardState({
  dirty = false,
  onClose,
  title = 'Discard changes?',
  description = 'Your edits will be lost.',
  confirmLabel = 'Discard',
}: UseDiscardGuardOptions): DiscardGuardState & { reset: () => void } {
  const [confirming, setConfirming] = React.useState(false);

  const requestClose = React.useCallback(() => {
    if (dirty) setConfirming(true);
    else onClose();
  }, [dirty, onClose]);

  const keepEditing = React.useCallback(() => setConfirming(false), []);

  const discard = React.useCallback(() => {
    setConfirming(false);
    onClose();
  }, [onClose]);

  const reset = React.useCallback(() => setConfirming(false), []);

  return React.useMemo(
    () => ({
      requestClose,
      confirming,
      keepEditing,
      discard,
      reset,
      title,
      description,
      confirmLabel,
    }),
    [requestClose, confirming, keepEditing, discard, reset, title, description, confirmLabel],
  );
}

export interface DiscardBarProps {
  title?: string;
  description?: string;
  confirmLabel?: string;
  keepLabel?: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
  size?: 'xs' | 'sm' | 'default';
  className?: string;
}

export function DiscardBar({
  title = 'Discard changes?',
  description,
  confirmLabel = 'Discard',
  keepLabel = 'Keep editing',
  onKeepEditing,
  onDiscard,
  size = 'sm',
  className,
}: DiscardBarProps) {
  return (
    <>
      <span
        role="alert"
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 text-lg text-foreground',
          className,
        )}
      >
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-destructive"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="truncate">
          {title}
          {description ? (
            <> <span className="text-muted-foreground">{description}</span></>
          ) : null}
        </span>
      </span>
      <Button type="button" variant="outline" size={size} autoFocus onClick={onKeepEditing}>
        {keepLabel}
      </Button>
      <Button type="button" variant="destructive" size={size} onClick={onDiscard}>
        {confirmLabel}
      </Button>
    </>
  );
}

export interface FooterDiscardGuardProps {
  children: React.ReactNode;
  size?: DiscardBarProps['size'];
  keepLabel?: string;
}

export function FooterDiscardGuard({ children, size, keepLabel }: FooterDiscardGuardProps) {
  const guard = useDiscardGuard();
  if (!guard?.confirming) return <>{children}</>;
  return (
    <DiscardBar
      title={guard.title}
      description={guard.description}
      confirmLabel={guard.confirmLabel}
      keepLabel={keepLabel}
      size={size}
      onKeepEditing={guard.keepEditing}
      onDiscard={guard.discard}
    />
  );
}
