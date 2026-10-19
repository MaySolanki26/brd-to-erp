import { useEffect, useMemo, useState } from 'react';
import { cx } from '../../uab/lib/format';
import { Icon } from '../../uab/primitives/Icon';
import { Dialog } from '../../uab/primitives/overlay';
import type { CommandEntry, CommandGroupDef } from './types';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroupDef[];
  placeholder?: string;
}

/** Opens the palette on Ctrl/⌘+K, from anywhere. */
export function useCommandShortcut(onToggle: () => void): void {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onToggle]);
}

const MAX_RESULTS = 12;

/** Ctrl/⌘+K search over the pages and actions the person can reach. */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = 'Type a page or action…',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .flatMap((group) => group.items.map((item) => ({ ...item, hint: item.hint ?? group.label })))
      .filter((item) => !needle || item.label.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS);
  }, [groups, query]);

  const run = (entry: CommandEntry) => {
    onOpenChange(false);
    entry.onSelect();
  };

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Search"
      description="Pages and actions you can access."
      size="md"
    >
      <div className="uab-palette">
        <input
          className="uab-input"
          placeholder={placeholder}
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={entries[active] ? `pal-${entries[active].key}` : undefined}
          value={query}
          data-autofocus
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((value) => Math.min(entries.length - 1, value + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((value) => Math.max(0, value - 1));
            } else if (event.key === 'Enter' && entries[active]) {
              event.preventDefault();
              run(entries[active]);
            }
          }}
        />
        <ul id="palette-list" role="listbox" className="uab-palette-list" aria-label="Results">
          {entries.map((entry, index) => (
            <li
              key={entry.key}
              id={`pal-${entry.key}`}
              role="option"
              aria-selected={index === active}
              className={cx('uab-palette-item', index === active && 'uab-is-active')}
              onMouseEnter={() => setActive(index)}
              onClick={() => run(entry)}
            >
              {entry.icon ? (
                <entry.icon size={16} strokeWidth={1.75} aria-hidden="true" focusable={false} />
              ) : (
                <Icon name="search" />
              )}
              <span className="uab-palette-label">{entry.label}</span>
              <span className="uab-muted uab-small">{entry.hint}</span>
            </li>
          ))}
          {!entries.length && (
            <li className="uab-muted uab-palette-empty">No results you can access.</li>
          )}
        </ul>
      </div>
    </Dialog>
  );
}
