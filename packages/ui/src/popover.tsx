import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from './lib/cn';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

function ScrollLock({ contentRef }: { contentRef: React.RefObject<HTMLElement | null> }) {
  React.useEffect(() => {
    const prevent = (e: Event) => {
      const content = contentRef.current;
      if (content && e.target instanceof Node && content.contains(e.target)) return;
      if (
        e.target instanceof Element &&
        e.target.closest('[role="listbox"], [role="menu"]')
      )
        return;
      e.preventDefault();
    };
    const opts = { passive: false, capture: true } as const;
    document.addEventListener('wheel', prevent, opts);
    document.addEventListener('touchmove', prevent, opts);
    return () => {
      document.removeEventListener('wheel', prevent, true);
      document.removeEventListener('touchmove', prevent, true);
    };
  }, [contentRef]);
  return null;
}

type PopoverContentProps = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
  lockScroll?: boolean;
};

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(
  (
    {
      className,
      align = 'start',
      sideOffset = 4,
      collisionPadding = 8,
      lockScroll = true,
      children,
      ...props
    },
    ref,
  ) => {
    const innerRef = React.useRef<HTMLDivElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={setRefs}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(
            'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-[--radix-popover-content-transform-origin] rounded-md p-4 shadow-overlay outline-none',
            className,
          )}
          {...props}
        >
          {lockScroll ? <ScrollLock contentRef={innerRef} /> : null}
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    );
  },
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

const PopoverArrow = PopoverPrimitive.Arrow;

const PopoverAnchor = PopoverPrimitive.Anchor;

export { Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverAnchor };
