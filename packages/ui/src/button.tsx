import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from './lib/cn';
import { Icon } from './uab/primitives/Icon';

type Variant =
  | 'default'
  | 'primary'
  | 'accent'
  | 'destructive'
  | 'danger'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';
type Size = 'default' | 'sm' | 'xs' | 'lg' | 'icon' | 'icon-sm';
type TemplateVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const TEMPLATE_VARIANT: Record<Exclude<Variant, 'link'>, TemplateVariant> = {
  default: 'primary',
  primary: 'primary',
  accent: 'secondary',
  destructive: 'danger',
  danger: 'danger',
  outline: 'secondary',
  secondary: 'secondary',
  ghost: 'ghost',
};

/** Template classes for places that need the look without the component (links styled as buttons). */
function buttonVariants(
  options: { variant?: Variant | null; size?: Size | null; className?: string } = {},
): string {
  const variant = options.variant ?? 'default';
  const size = options.size ?? 'default';
  if (size === 'icon' || size === 'icon-sm') {
    return cn(
      'uab-icon-btn',
      variant === 'outline' || variant === 'secondary' ? 'uab-icon-btn-secondary' : '',
      options.className,
    );
  }
  if (variant === 'link') return cn('uab-link', options.className);
  return cn(
    'uab-btn',
    `uab-btn-${TEMPLATE_VARIANT[variant]}`,
    size === 'lg' && 'uab-btn-default',
    options.className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant | null;
  /** `lg` is the 40px form size; every other size is the 32px template button. */
  size?: Size | null;
  asChild?: boolean;
  /** Template icon name shown before the label. */
  icon?: string;
  /** Template icon name shown after the label. */
  iconRight?: string;
  loading?: boolean;
  /** Explains why the button is unavailable (tooltip and screen-reader text). */
  disabledReason?: string;
}

/** The template button. `variant="primary"` (or the default) is the one strong action; 32px high. */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      type,
      icon,
      iconRight,
      loading,
      disabledReason,
      children,
      ...props
    },
    ref,
  ) => {
    const resolved = variant ?? 'default';
    const resolvedSize = size ?? 'default';

    if (asChild) {
      return (
        <Slot className={buttonVariants({ variant, size, className })} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    if (resolvedSize === 'icon' || resolvedSize === 'icon-sm' || resolved === 'link') {
      return (
        <button
          ref={ref}
          type={type ?? 'button'}
          className={buttonVariants({ variant, size, className })}
          {...props}
        >
          {children}
        </button>
      );
    }
    const isDisabled = props.disabled || loading || !!disabledReason;
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(
          'uab-btn',
          `uab-btn-${TEMPLATE_VARIANT[resolved]}`,
          resolvedSize === 'lg' && 'uab-btn-default',
          className,
        )}
        aria-busy={loading || undefined}
        data-tooltip={disabledReason ?? props.title}
        {...props}
        disabled={isDisabled}
      >
        {loading ? (
          <span className="uab-spinner" aria-hidden="true" />
        ) : icon ? (
          <Icon name={icon} />
        ) : null}
        {children}
        {iconRight && <Icon name={iconRight} />}
        {disabledReason && <span className="uab-sr-only">. Unavailable: {disabledReason}</span>}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
