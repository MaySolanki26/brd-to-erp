import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from '../button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../sheet';
import {
  DiscardGuardProvider,
  FooterDiscardGuard,
  useDiscardGuardState,
  type DiscardGuardState,
} from './DiscardGuard';

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'default' | 'wide';

const DRAWER_SIZE: Record<DrawerSize, string> = {
  sm: 'w-80 max-w-[92vw]',
  md: 'w-96 max-w-[92vw]',
  lg: 'w-[28rem] max-w-[92vw]',
  xl: 'w-[40rem] max-w-[92vw]',
  '2xl': 'w-[52rem] max-w-[94vw]',
  '3xl': 'w-[64rem] max-w-[94vw]',
  default: 'w-[38vw] min-w-[26rem] max-w-[46rem]',
  wide: 'w-[46vw] min-w-[32rem] max-w-[58rem]',
};

const DRAWER_SHELL = 'flex flex-col gap-0 border-l border-border bg-surface p-0 shadow-none';

export interface DrawerShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode | ((api: DiscardGuardState) => React.ReactNode);
  size?: DrawerSize;
  className?: string;
  overlayClassName?: string;
  hideClose?: boolean;
  dismissable?: boolean;
  dirty?: boolean;
  discardTitle?: string;
  discardDescription?: string;
  discardConfirmLabel?: string;
  ariaLabel?: string;
  container?: HTMLElement | null;
  suppressDescriptionWarning?: boolean;
  onInteractOutside?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

export function DrawerShell({
  open,
  onOpenChange,
  children,
  size,
  className,
  overlayClassName,
  hideClose = true,
  dismissable = true,
  dirty = false,
  discardTitle,
  discardDescription,
  discardConfirmLabel,
  ariaLabel,
  container,
  suppressDescriptionWarning,
  onInteractOutside,
  onEscapeKeyDown,
}: DrawerShellProps) {
  const handleClose = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const guard = useDiscardGuardState({
    dirty,
    onClose: handleClose,
    title: discardTitle,
    description: discardDescription,
    confirmLabel: discardConfirmLabel,
  });
  const { requestClose, confirming, reset } = guard;

  const handleOpenChange = (next: boolean) => {
    if (next) {
      reset();
      onOpenChange(true);
      return;
    }
    requestClose();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        hideClose={hideClose}
        container={container}
        overlayClassName={cn('bg-transparent', overlayClassName)}
        className={cn(DRAWER_SHELL, size && DRAWER_SIZE[size], className)}
        {...(suppressDescriptionWarning ? { 'aria-describedby': undefined } : {})}
        onInteractOutside={(event) => {
          if (confirming) {
            event.preventDefault();
            return;
          }
          if (!dismissable) {
            event.preventDefault();
            return;
          }
          onInteractOutside?.(event);
        }}
        onEscapeKeyDown={(event) => {
          if (confirming) {
            event.preventDefault();
            return;
          }
          if (!dismissable) {
            event.preventDefault();
            return;
          }
          onEscapeKeyDown?.(event);
        }}
      >
        {ariaLabel ? (
          <>
            <SheetTitle className="sr-only">{ariaLabel}</SheetTitle>
            <SheetDescription className="sr-only">{ariaLabel}</SheetDescription>
          </>
        ) : null}
        <DiscardGuardProvider value={guard}>
          {typeof children === 'function' ? children(guard) : children}
        </DiscardGuardProvider>
      </SheetContent>
    </Sheet>
  );
}

export interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  submitDisabled?: boolean;
  size?: DrawerSize;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
  hideClose?: boolean;
  dismissable?: boolean;
  overlayClassName?: string;
  dirty?: boolean;
  discardTitle?: string;
  discardDescription?: string;
  discardConfirmLabel?: string;
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  headerRight,
  children,
  footer,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isPending = false,
  submitDisabled = false,
  size = 'default',
  className,
  bodyClassName,
  noPadding = false,
  hideClose = false,
  dismissable = true,
  overlayClassName,
  dirty = false,
  discardTitle,
  discardDescription,
  discardConfirmLabel,
}: FormDrawerProps) {
  const titleText = typeof title === 'string' ? title : 'Form';
  const showFooter = footer != null || onSubmit != null;

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      size={size}
      className={cn('overflow-hidden', className)}
      overlayClassName={overlayClassName}
      dismissable={dismissable}
      dirty={dirty}
      discardTitle={discardTitle}
      discardDescription={discardDescription}
      discardConfirmLabel={discardConfirmLabel}
    >
      {({ requestClose }) => {
        const inner = (
          <>
            <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-2xl font-semibold text-foreground">
                  {title}
                </SheetTitle>
                {description != null ? (
                  <SheetDescription className="truncate text-lg text-muted-foreground">
                    {description}
                  </SheetDescription>
                ) : (
                  <SheetDescription className="sr-only">{titleText}</SheetDescription>
                )}
              </div>
              {headerRight}
              {!hideClose && (
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </header>

            <div
              className={cn(
                'flex-1 overflow-y-auto',
                noPadding ? 'p-0' : 'px-5 py-4',
                bodyClassName,
              )}
            >
              {children}
            </div>

            {showFooter && (
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
                <FooterDiscardGuard size="default">
                  {footer ?? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={requestClose}
                        disabled={isPending}
                      >
                        {cancelLabel}
                      </Button>
                      <Button type="submit" disabled={isPending || submitDisabled}>
                        {isPending ? 'Saving…' : submitLabel}
                      </Button>
                    </>
                  )}
                </FooterDiscardGuard>
              </footer>
            )}
          </>
        );

        return onSubmit ? (
          <form onSubmit={onSubmit} className="flex h-full flex-col">
            {inner}
          </form>
        ) : (
          <div className="flex h-full flex-col">{inner}</div>
        );
      }}
    </DrawerShell>
  );
}
