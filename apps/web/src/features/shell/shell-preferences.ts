import { z } from 'zod';
import {
  PRESET_PALETTES,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  isHex,
  type Palette,
} from '@brd/ui';
import { defineStorageItem } from '@/lib/storage';

const hex = z.string().refine((value) => isHex(value));

const paletteSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(30),
  accent: hex,
  sidebar: hex,
  rail: hex,
});

export interface AppearancePreferences {
  /** A preset id or the id of one of the person's own palettes. */
  paletteId: string;
  customPalettes: Palette[];
}

const appearanceSchema: z.ZodType<AppearancePreferences> = z.object({
  paletteId: z.string().min(1).max(60),
  customPalettes: z.array(paletteSchema).max(12),
});

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  paletteId: PRESET_PALETTES[0]?.id ?? 'violet',
  customPalettes: [],
};

/** A look preference of this device (like the theme), so it is not tied to, or cleared with, one account. */
export const appearanceStore = defineStorageItem({
  name: 'appearance',
  version: 2,
  schema: appearanceSchema,
  defaultValue: DEFAULT_APPEARANCE,
  scope: 'app',
});

export interface SidebarPreferences {
  width: number;
  collapsed: boolean;
}

const sidebarSchema = z.object({
  width: z.number().int().min(SIDEBAR_MIN_WIDTH).max(SIDEBAR_MAX_WIDTH),
  collapsed: z.boolean(),
});

export const DEFAULT_SIDEBAR: SidebarPreferences = {
  width: SIDEBAR_DEFAULT_WIDTH,
  collapsed: false,
};

export const sidebarStore = defineStorageItem({
  name: 'sidebar',
  version: 1,
  schema: sidebarSchema,
  defaultValue: DEFAULT_SIDEBAR,
  scope: 'app',
});

export const MAX_FAVORITES = 30;
export const MAX_RECENTS = 6;

/** A page the person can come back to: enough to show and open it without loading anything. */
export interface SavedPage {
  key: string;
  label: string;
  path: string;
}

const savedPagesSchema = (max: number) =>
  z
    .array(
      z.object({
        key: z.string().min(1).max(200),
        label: z.string().min(1).max(200),
        path: z.string().startsWith('/').max(300),
      }),
    )
    .max(max);

export const favoritesStore = (userId: string) =>
  defineStorageItem({
    name: 'favorites',
    version: 2,
    schema: savedPagesSchema(MAX_FAVORITES),
    defaultValue: [] as SavedPage[],
    scope: { userId },
  });

const hiddenColumnsSchema = z.array(z.string().min(1).max(60)).max(30);

/** The columns a person hid in one table's Columns menu. */
export const hiddenColumnsStore = (userId: string, table: string) =>
  defineStorageItem({
    name: `columns-${table}`,
    version: 1,
    schema: hiddenColumnsSchema,
    defaultValue: [] as string[],
    scope: { userId },
  });

export const recentsStore = (userId: string) =>
  defineStorageItem({
    name: 'recents',
    version: 1,
    schema: savedPagesSchema(MAX_RECENTS),
    defaultValue: [] as SavedPage[],
    scope: { userId },
  });
