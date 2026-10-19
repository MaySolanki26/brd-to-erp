import * as React from 'react';

import { cn } from './lib/cn';

export interface CheckboxProps extends Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'type' | 'checked' | 'onChange' | 'size'
> {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
  /** Kept for compatibility with the earlier component; the native box has one size. */
  size?: 'sm' | 'md';
  tone?: 'brand' | 'gray';
}

/** The template's native checkbox (accent-coloured); `indeterminate` shows the dash. */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, size: _size, tone: _tone, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );
    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = checked === 'indeterminate';
    }, [checked]);

    return (
      <input
        ref={setRefs}
        type="checkbox"
        className={cn(className)}
        checked={checked === true}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        {...props}
      />
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
