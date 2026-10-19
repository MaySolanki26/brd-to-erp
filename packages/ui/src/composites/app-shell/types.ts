import type { LucideIcon } from 'lucide-react';

/** A module shown as an icon on the rail. */
export interface RailModule {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  badge?: number;
  visible?: boolean;
}

/** A global tool at the bottom of the rail (search, inbox, settings). */
export interface RailUtility {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  badge?: number;
  active?: boolean;
}

/** A child row under a group: text only, or with an icon. */
export interface SidebarChild {
  key: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  onSelect: () => void;
}

export interface SidebarItem {
  key: string;
  label: string;
  /** Rows without an icon are text-only. */
  icon?: LucideIcon;
  count?: number;
  onSelect?: () => void;
  /** A row with children is a collapsible group. */
  children?: SidebarChild[];
  visible?: boolean;
}

export interface SidebarSection {
  key: string;
  /** Plain sentence-case separator text such as "Pages". */
  label?: string;
  /** Shows each row's icon in front of a "Recent" item (a history icon). */
  recent?: boolean;
  items: SidebarItem[];
}

export interface AppShellUser {
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export interface UserMenuAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

export interface CommandGroupDef {
  key: string;
  label: string;
  items: CommandEntry[];
}

export interface CommandEntry {
  key: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  onSelect: () => void;
}

export interface NotificationEntry {
  id: string;
  title: string;
  body?: string;
  /** Preformatted, for example "2 hours ago". */
  time: string;
  read: boolean;
  onOpen?: () => void;
}
