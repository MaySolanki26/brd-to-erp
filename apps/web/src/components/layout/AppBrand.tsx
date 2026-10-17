export const APP_NAME = 'BRD Platform';

interface AppBrandProps {
  collapsed?: boolean;
}

export function AppBrand({ collapsed = false }: AppBrandProps) {
  const initial = APP_NAME.charAt(0);
  return (
    <div className="flex items-center gap-2">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground"
      >
        {initial}
      </div>
      {!collapsed && <span className="text-2xl font-semibold text-foreground">{APP_NAME}</span>}
    </div>
  );
}
