export const APP_NAME = 'BRD Platform';

interface AppBrandProps {
  /** The logo tile alone, for the icon rail. */
  collapsed?: boolean;
}

export function AppBrand({ collapsed = false }: AppBrandProps) {
  const initial = APP_NAME.charAt(0);
  return (
    <div className="flex items-center gap-2">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-fs-secondary font-bold text-primary-foreground"
      >
        {initial}
      </div>
      {!collapsed && (
        <span className="text-fs-secondary font-semibold text-foreground">{APP_NAME}</span>
      )}
    </div>
  );
}
