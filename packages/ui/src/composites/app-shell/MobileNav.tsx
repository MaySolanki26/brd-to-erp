import { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../uab/lib/format';
import { IconButton } from '../../uab/primitives/Button';
import { useLayer } from '../../uab/primitives/overlay';
import { SidebarContent, type SidebarContentProps } from './ContextSidebar';
import type { RailModule } from './types';

export interface MobileNavProps extends Omit<SidebarContentProps, 'onNavigate' | 'headerAction'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modules to list above the sidebar (phones, where the rail is hidden). */
  modules: RailModule[];
  activeModuleKey: string;
  /** Show the module list: true on phones, false on tablets (the rail stays). */
  showModules: boolean;
}

function ModuleLink({
  icon: Icon,
  label,
  active,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cx('uab-mobile-module', active && 'uab-is-active')}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" focusable={false} />
      <span>{label}</span>
    </button>
  );
}

/** Phones and tablets: the sidebar (and on phones the modules) in a drawer that slides over the page. */
export function MobileNav({
  open,
  onOpenChange,
  modules,
  activeModuleKey,
  showModules,
  ...content
}: MobileNavProps) {
  const close = () => onOpenChange(false);
  const ref = useRef<HTMLDivElement>(null);
  useLayer(open, close);
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('a,button')?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="uab-overlay-scrim uab-overlay-scrim-left"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        ref={ref}
        className="uab-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {showModules && (
          <div className="uab-mobile-modules">
            {modules
              .filter((module) => module.visible !== false)
              .map((module) => (
                <ModuleLink
                  key={module.key}
                  icon={module.icon}
                  label={module.label}
                  active={module.key === activeModuleKey}
                  onSelect={() => {
                    module.onSelect();
                    close();
                  }}
                />
              ))}
          </div>
        )}
        <div className="uab-sidebar uab-mobile-sidebar">
          <SidebarContent {...content} onNavigate={close} />
        </div>
        <IconButton
          icon="x"
          label="Close navigation"
          onClick={close}
          className="uab-mobile-nav-close"
        />
      </div>
    </div>
  );
}
