import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/* ── Navigation ─────────────────────────────────────── */

export interface NavChildItem {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  visible?: boolean;
}

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  badge?: ReactNode;
  visible?: boolean;
  children?: NavChildItem[];
}

/* ── Breadcrumbs ────────────────────────────────────── */

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

/* ── User ───────────────────────────────────────────── */

export interface AppShellUser {
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

/* ── Sidebar state ──────────────────────────────────── */

export type SidebarState = {
  collapsed: boolean;
  toggle: () => void;
};

/* ── Component props ────────────────────────────────── */

export interface UserMenuAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

export interface AppSidebarProps {
  items: NavItem[];
  activeKey: string;
  collapsed: boolean;
  onToggle: () => void;
  branding?: ReactNode;
  user?: AppShellUser;
  onLogout?: () => void;
}

export interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  user?: AppShellUser;
  userMenuActions?: UserMenuAction[];
  onLogout?: () => void;
  onMobileMenuOpen?: () => void;
  actions?: ReactNode;
}
