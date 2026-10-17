import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider, ThemeToggle, useTheme } from '@brd/ui';

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
  const { preference, resolvedMode } = useTheme();
  return (
    <p>
      {preference}:{resolvedMode}
    </p>
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

  it('switches mode and remembers the choice from the toggle', async () => {
    mockSystemDark(false);
    render(
      <ThemeProvider>
        <ThemeToggle />
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Change theme' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));

    expect(screen.getByText('dark:dark')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
