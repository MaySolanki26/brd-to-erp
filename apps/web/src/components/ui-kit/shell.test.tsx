import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home, Users } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppShell,
  AppearanceMenu,
  CommandPalette,
  ContextSidebar,
  IconRail,
  InformativeBar,
  NotificationBell,
  ThemeProvider,
  TopBar,
  type SidebarSection,
} from '@brd/ui';

const sections: SidebarSection[] = [
  {
    key: 'pages',
    label: 'Pages',
    items: [
      { key: 'all', label: 'All projects', icon: Home, onSelect: vi.fn() },
      { key: 'users', label: 'Users', onSelect: vi.fn() },
      {
        key: 'group',
        label: 'Billing project',
        count: 2,
        children: [
          { key: 'g-sources', label: 'Sources', onSelect: vi.fn() },
          { key: 'g-rules', label: 'Rules', onSelect: vi.fn() },
        ],
      },
    ],
  },
];

describe('IconRail', () => {
  it('marks the current module and has no indicator bar beside it', async () => {
    const onSelect = vi.fn();
    render(
      <IconRail
        activeKey="b"
        brandInitials="B"
        brandLabel="BRD Platform"
        onBrandSelect={vi.fn()}
        modules={[
          { key: 'a', label: 'Dashboard', icon: Home, onSelect: vi.fn() },
          { key: 'b', label: 'Team', icon: Users, onSelect },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Team' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    await userEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
  });
});

function SidebarHarness({ initialFavorites = [] as string[] }) {
  const [favoriteKeys, setFavoriteKeys] = useState(initialFavorites);
  const [width, setWidth] = useState(240);
  const favoriteItems = sections[0]!.items.filter((item) => favoriteKeys.includes(item.key));
  return (
    <ContextSidebar
      title="Projects"
      sections={sections}
      activeKey="all"
      favorites={favoriteItems}
      favoriteKeys={favoriteKeys}
      onToggleFavorite={(key) =>
        setFavoriteKeys((current) =>
          current.includes(key) ? current.filter((k) => k !== key) : [key, ...current],
        )
      }
      width={width}
      onWidthChange={setWidth}
      onCollapse={vi.fn()}
    />
  );
}

describe('ContextSidebar', () => {
  it('shows plain section labels, an active row, and a collapsible group with a count', async () => {
    render(<SidebarHarness />);
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Sources' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Billing project/ }));
    expect(screen.queryByRole('button', { name: 'Sources' })).not.toBeInTheDocument();
  });

  it('searches every option into one Results list and clears with Esc', async () => {
    render(<SidebarHarness />);
    const search = screen.getByRole('searchbox', { name: 'Find a page' });
    expect(search).toHaveAttribute('placeholder', 'Find a page (4)');
    await userEvent.type(search, 'rul');
    const results = screen.getByRole('region', { name: 'Results' });
    expect(
      within(results).getByRole('button', { name: 'Billing project · Rules' }),
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Results' })).not.toBeInTheDocument();
  });

  it('moves a starred page up into Favorites and removes it again', async () => {
    render(<SidebarHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Users to favorites' }));
    const favorites = screen.getByRole('region', { name: 'Favorites' });
    expect(within(favorites).getByRole('button', { name: 'Users' })).toBeInTheDocument();
    await userEvent.click(
      within(favorites).getByRole('button', { name: 'Remove Users from favorites' }),
    );
    expect(screen.queryByRole('region', { name: 'Favorites' })).not.toBeInTheDocument();
  });

  it('resizes with the keyboard within 200 to 360px', async () => {
    render(<SidebarHarness />);
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    handle.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '256');
    await userEvent.keyboard('{Home}');
    expect(handle).toHaveAttribute('aria-valuenow', '200');
    await userEvent.keyboard('{End}');
    expect(handle).toHaveAttribute('aria-valuenow', '360');
    await userEvent.keyboard('{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '360');
  });

  it('has the collapse control at the top', () => {
    render(<SidebarHarness />);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });
});

describe('top bar and page title', () => {
  it('shows the page title and an info icon in the top bar, not in the page body', () => {
    render(
      <AppShell rail={null} topBar={<TopBar onSearch={vi.fn()} />}>
        <InformativeBar title="Projects" info="Projects you can access" />
      </AppShell>,
    );
    expect(screen.getAllByRole('heading', { name: 'Projects', level: 1 })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /About Projects/ })).toHaveAttribute(
      'data-tooltip',
      'Projects you can access',
    );
    expect(screen.queryByText('Projects you can access')).not.toBeInTheDocument();
  });

  it('falls back to an inline title outside the app shell', () => {
    render(<InformativeBar title="Projects" info="Projects you can access" />);
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('Projects you can access')).toBeInTheDocument();
  });

  it('opens search from the centred box and offers the menu and expand controls', async () => {
    const onSearch = vi.fn();
    const onMenu = vi.fn();
    const onExpand = vi.fn();
    render(
      <AppShell
        rail={null}
        topBar={<TopBar onSearch={onSearch} onMenu={onMenu} onExpandSidebar={onExpand} />}
      >
        <div />
      </AppShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Search pages and actions' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(onSearch).toHaveBeenCalled();
    expect(onMenu).toHaveBeenCalled();
    expect(onExpand).toHaveBeenCalled();
  });
});

describe('CommandPalette', () => {
  it('lists entries by group and runs the chosen one', async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CommandPalette
        open
        onOpenChange={onOpenChange}
        groups={[
          { key: 'pages', label: 'Pages', items: [{ key: 'p', label: 'All projects', onSelect }] },
        ]}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Type a page or action…'), 'proj');
    await userEvent.click(screen.getByText('All projects'));
    expect(onSelect).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('NotificationBell', () => {
  const items = [
    { id: '1', title: 'Question added', time: 'now', read: false },
    { id: '2', title: 'Source done', time: 'today', read: true },
  ];

  it('shows the unread count and marks one or all read, and says when it is sample data', async () => {
    const onMarkRead = vi.fn();
    const onMarkAllRead = vi.fn();
    render(
      <NotificationBell
        items={items}
        isSample
        onMarkRead={onMarkRead}
        onMarkAllRead={onMarkAllRead}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    expect(screen.getByText(/Sample notifications/)).toBeInTheDocument();
    expect(screen.getByLabelText('Unread')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(onMarkAllRead).toHaveBeenCalled();
    // Choosing a notification marks it read.
    await userEvent.click(screen.getByRole('button', { name: /Question added/ }));
    expect(onMarkRead).toHaveBeenCalledWith('1');
  });

  it('shows an empty state', async () => {
    render(<NotificationBell items={[]} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('You’re all caught up.')).toBeInTheDocument();
  });
});

describe('AppearanceMenu', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  function renderMenu() {
    const props = {
      mode: 'system' as const,
      onModeChange: vi.fn(),
      paletteId: 'violet',
      onPaletteChange: vi.fn(),
      customPalettes: [],
      onSaveCustom: vi.fn(
        (palette: { name: string; accent: string; sidebar: string; rail: string }) => ({
          ...palette,
          id: 'custom-1',
          custom: true,
        }),
      ),
      onDeleteCustom: vi.fn(),
    };
    render(
      <ThemeProvider>
        <AppearanceMenu {...props} />
      </ThemeProvider>,
    );
    return props;
  }

  it('changes the colour mode and the palette', async () => {
    const props = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Appearance' }));

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(props.onModeChange).toHaveBeenLastCalledWith('dark');

    await userEvent.click(screen.getByRole('radio', { name: 'Ocean' }));
    expect(props.onPaletteChange).toHaveBeenLastCalledWith('ocean');
  });

  it('creates a custom palette, asks for a name and rejects a bad hex colour', async () => {
    const props = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create palette' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    expect(screen.getByText('Give the palette a name')).toBeInTheDocument();
    expect(props.onSaveCustom).not.toHaveBeenCalled();

    const accent = screen.getByLabelText('Accent');
    await userEvent.clear(accent);
    await userEvent.type(accent, '#12');
    expect(screen.getByText('Use a 6-digit hex colour.')).toBeInTheDocument();

    await userEvent.clear(accent);
    // Clearing the field leaves the "#" in place, so only the digits are typed.
    await userEvent.type(accent, '0ea5e9');
    await userEvent.type(screen.getByLabelText(/^Name/), 'Sky');
    await userEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    expect(props.onSaveCustom).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sky', accent: `#${'0ea5e9'}` }),
    );
    expect(props.onPaletteChange).toHaveBeenLastCalledWith('custom-1');
  });
});
