import * as React from 'react';

import { cn } from './lib/cn';

export interface InputProps extends React.ComponentProps<'input'> {
  spinner?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, spinner = false, ...props }, ref) => {
    const hideSpinner = type === 'number' && !spinner;

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
      if (type !== 'number') return;
      const el = innerRef.current;
      if (!el) return;
      const stopWheelStep = (event: WheelEvent) => {
        if (document.activeElement === el) event.preventDefault();
      };
      el.addEventListener('wheel', stopWheelStep, { passive: false });
      return () => el.removeEventListener('wheel', stopWheelStep);
    }, [type]);

    return (
      <input
        type={type}
        className={cn(
          'border-input bg-background file:text-foreground placeholder:text-muted-foreground flex h-10 w-full rounded-md border px-3 py-2 text-lg file:border-0 file:bg-transparent file:text-xl file:font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-ring/40 focus-visible:border-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
          hideSpinner &&
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          className,
        )}
        ref={setRefs}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
