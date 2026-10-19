import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PALETTE_ID, applyPalette, findPalette, useTheme, type Palette } from '@brd/ui';
import { appearanceStore, type AppearancePreferences } from '../shell-preferences';

const MAX_CUSTOM = 12;

/** The person's colour palette (accent, sidebar, rail), saved on this device and applied to the page. */
export function useAppearance() {
  const { preference, setPreference } = useTheme();
  const [prefs, setPrefs] = useState<AppearancePreferences>(() => appearanceStore.get());
  const palette = findPalette(prefs.paletteId, prefs.customPalettes);

  useEffect(() => {
    applyPalette(palette);
  }, [palette.id, palette.accent, palette.sidebar, palette.rail]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((next: AppearancePreferences) => {
    appearanceStore.set(next);
    setPrefs(next);
  }, []);

  const saveCustom = useCallback(
    (input: Omit<Palette, 'custom' | 'id'> & { id?: string }): Palette => {
      const saved: Palette = {
        id: input.id ?? `custom-${Date.now().toString(36)}`,
        name: input.name.trim(),
        accent: input.accent,
        sidebar: input.sidebar,
        rail: input.rail,
      };
      const others = prefs.customPalettes.filter((item) => item.id !== saved.id);
      update({ paletteId: saved.id, customPalettes: [...others, saved].slice(-MAX_CUSTOM) });
      return saved;
    },
    [prefs.customPalettes, update],
  );

  return {
    railSkin: palette.id === DEFAULT_PALETTE_ID ? ('softCharcoal' as const) : ('palette' as const),
    mode: preference,
    setMode: setPreference,
    paletteId: palette.id,
    customPalettes: prefs.customPalettes,
    setPaletteId: (paletteId: string) => update({ ...prefs, paletteId }),
    saveCustom,
    deleteCustom: (id: string) =>
      update({
        paletteId: prefs.paletteId === id ? DEFAULT_PALETTE_ID : prefs.paletteId,
        customPalettes: prefs.customPalettes.filter((item) => item.id !== id),
      }),
  };
}
