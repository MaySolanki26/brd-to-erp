import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from '@brd/ui';

function mockSystemDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function Probe() {
  const { preference, resolvedMode, setPreference } = useTheme();
  return (
    <>
      <p>
        {preference}:{resolvedMode}
      </p>
      <button type="button" onClick={() => setPreference('dark')}>
        Go dark
      </button>
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows the system setting by default and marks the document', () => {
    mockSystemDark(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('system:dark')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('uses the stored preference over the system setting', () => {
    mockSystemDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('light:light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('ignores an invalid stored value', () => {
    mockSystemDark(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('system:light')).toBeInTheDocument();
  });

  it('switches mode and remembers the choice', () => {
    mockSystemDark(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByRole('button', { name: 'Go dark' }).click());

    expect(screen.getByText('dark:dark')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
