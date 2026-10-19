import * as React from 'react';
import { Button } from '../uab/primitives/Button';
import { Drawer } from '../uab/primitives/overlay';
import { DiscardGuardProvider, FooterDiscardGuard, useDiscardGuardState } from './DiscardGuard';

/**
 * Every side drawer opens at the same width (UAB rule 28); only `wide` is larger. The other sizes are
 * kept so existing callers compile, and all resolve to the standard width.
 */
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'default' | 'wide';

export interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Explanation behind the ⓘ icon next to the title. */
  description?: string;
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
  dismissable?: boolean;
  overlayClassName?: string;
  dirty?: boolean;
  discardTitle?: string;
  discardDescription?: string;
  discardConfirmLabel?: string;
}

/**
 * The template drawer: it slides over the page from the right (560px), its header is as tall as the top
 * bar with the title in 18px and the description behind an ⓘ, and it closes with the footer Cancel (no ×).
 * With unsaved changes, closing asks first, in the footer.
 */
export function FormDrawer({
  open,
  onOpenChange,
  title = 'Form',
  description,
  children,
  footer,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isPending = false,
  submitDisabled = false,
  size = 'default',
  dirty = false,
  discardTitle,
  discardDescription,
  discardConfirmLabel,
  headerRight,
  noPadding,
}: FormDrawerProps) {
  const formId = React.useId();
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const guard = useDiscardGuardState({
    dirty,
    onClose: close,
    title: discardTitle,
    description: discardDescription,
    confirmLabel: discardConfirmLabel,
  });
  const { requestClose, reset } = guard;

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const body = onSubmit ? (
    <form id={formId} onSubmit={onSubmit} noValidate>
      {children}
    </form>
  ) : (
    children
  );

  return (
    <DiscardGuardProvider value={guard}>
      <Drawer
        open={open}
        onClose={requestClose}
        title={title}
        description={description}
        wide={size === 'wide'}
        headerRight={headerRight}
        flush={noPadding}
        footer={
          <FooterDiscardGuard>
            {footer ?? (
              <>
                <Button onClick={requestClose} disabled={isPending}>
                  {cancelLabel}
                </Button>
                {onSubmit && (
                  <Button
                    variant="primary"
                    type="submit"
                    form={formId}
                    disabled={isPending || submitDisabled}
                  >
                    {isPending ? 'Saving…' : submitLabel}
                  </Button>
                )}
              </>
            )}
          </FooterDiscardGuard>
        }
      >
        {body}
      </Drawer>
    </DiscardGuardProvider>
  );
}
