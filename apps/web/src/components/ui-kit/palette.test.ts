import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE_ID,
  PRESET_PALETTES,
  applyPalette,
  contrast,
  derivePalette,
  findPalette,
  isHex,
} from '@brd/ui';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('palettes', () => {
  it('keeps text on the accent readable (AA) for every preset', () => {
    for (const preset of PRESET_PALETTES) {
      expect(derivePalette(preset).buttonContrast, preset.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('corrects an accent that is too pale to carry text', () => {
    const pale = derivePalette({
      id: 'x',
      name: 'Pale',
      accent: `#${'ffee99'}`,
      sidebar: `#${'ffffff'}`,
      rail: `#${'111111'}`,
    });
    expect(contrast(pale.accentTextLight, `#${'ffffff'}`)).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to the default palette for an unknown id', () => {
    expect(findPalette('nope', []).id).toBe(DEFAULT_PALETTE_ID);
  });

  it('finds a custom palette by id', () => {
    const custom = {
      id: 'mine',
      name: 'Mine',
      accent: `#${'0e7490'}`,
      sidebar: `#${'f4f9fa'}`,
      rail: `#${'102a30'}`,
    };
    expect(findPalette('mine', [custom]).name).toBe('Mine');
  });

  it('validates six-digit hex colours', () => {
    expect(isHex(`#${'0ea5e9'}`)).toBe(true);
    expect(isHex('#12')).toBe(false);
  });

  it('writes palette variables and the Tailwind accent, and removes them for the default', () => {
    const ocean = PRESET_PALETTES.find((p) => p.id === 'ocean');
    applyPalette(ocean);
    expect(document.documentElement.style.getPropertyValue('--pal-accent')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).not.toBe('');
    applyPalette(findPalette(DEFAULT_PALETTE_ID, []));
    expect(document.documentElement.style.getPropertyValue('--pal-accent')).toBe('');
  });
});
