import { useRef, useState } from 'react';
import { cx } from '../../uab/lib/format';
import {
  derivePalette,
  findPalette,
  isHex,
  PRESET_PALETTES,
  type Palette,
} from '../../theme/palette';
import { Button, IconButton } from '../../uab/primitives/Button';
import { Icon } from '../../uab/primitives/Icon';
import { InfoTip } from '../../uab/primitives/InfoTip';
import { confirmDelete, Dialog, Popover } from '../../uab/primitives/overlay';
import type { ThemePreference } from '../../theme/theme-provider';

/** Small mock of the app in a palette's colours: rail · sidebar · content with an accent button. */
function PaletteMock({ palette, large }: { palette: Palette; large?: boolean }) {
  const d = derivePalette(palette);
  return (
    <span className={cx('uab-pal-mock', large && 'uab-is-large')} aria-hidden="true">
      <span className="uab-pal-mock-rail" style={{ background: d.rail }}>
        <span style={{ background: d.railSelectedBg }} />
      </span>
      <span className="uab-pal-mock-side" style={{ background: d.sidebar }}>
        <span style={{ background: d.accentTint }} />
        <span />
        <span />
      </span>
      <span className="uab-pal-mock-main">
        <span className="uab-pal-mock-tab" style={{ borderColor: d.accent }} />
        <span className="uab-pal-mock-line" />
        <span className="uab-pal-mock-line uab-short" />
        <span className="uab-pal-mock-btn" style={{ background: d.accent, color: d.onAccent }}>
          {large ? 'Button' : ''}
        </span>
      </span>
    </span>
  );
}

export interface ThemePickerProps {
  mode: ThemePreference;
  onModeChange: (mode: ThemePreference) => void;
  paletteId: string;
  onPaletteChange: (id: string) => void;
  customPalettes: Palette[];
  /** Create (no id) or update a custom palette; returns the saved palette. */
  onSaveCustom: (palette: Omit<Palette, 'custom' | 'id'> & { id?: string }) => Palette;
  onDeleteCustom: (id: string) => void;
}

const MODES: ThemePreference[] = ['system', 'light', 'dark'];

/**
 * Theme changer: light / dark / system plus colour palettes (accent, sidebar and icon-rail colours).
 * Presets are fixed; people can create, edit and delete their own. Text on the accent stays readable.
 */
export function ThemePicker({
  mode,
  onModeChange,
  paletteId,
  onPaletteChange,
  customPalettes,
  onSaveCustom,
  onDeleteCustom,
}: ThemePickerProps) {
  const current = findPalette(paletteId, customPalettes);
  const [editing, setEditing] = useState<Palette | null>(null);

  const card = (palette: Palette) => (
    <li key={palette.id} className="uab-pal-item">
      <button
        type="button"
        role="radio"
        aria-checked={current.id === palette.id}
        className={cx('uab-pal-card', current.id === palette.id && 'uab-is-on')}
        onClick={() => onPaletteChange(palette.id)}
      >
        <PaletteMock palette={palette} />
        <span className="uab-pal-name">
          {palette.name}
          {current.id === palette.id && <Icon name="check" size={14} />}
        </span>
      </button>
      {palette.custom && (
        <span className="uab-pal-tools">
          <IconButton
            icon="pencil"
            label={`Edit ${palette.name}`}
            onClick={() => setEditing(palette)}
          />
          <IconButton
            icon="trash"
            label={`Delete ${palette.name}`}
            onClick={() =>
              confirmDelete({
                title: `Delete palette "${palette.name}"?`,
                message:
                  'The palette is removed from your themes. If it is in use, the app switches back to Soft violet.',
                confirmLabel: 'Delete palette',
                onConfirm: () => onDeleteCustom(palette.id),
              })
            }
          />
        </span>
      )}
    </li>
  );

  return (
    <div className="uab-theme-picker">
      <div className="uab-form-field">
        <span className="uab-field-label">Mode</span>
        <div className="uab-segmented" role="radiogroup" aria-label="Colour mode">
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={mode === item}
              className={cx('uab-seg-btn', mode === item && 'uab-is-on')}
              onClick={() => onModeChange(item)}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="uab-form-field">
        <span className="uab-field-label-row">
          <span className="uab-field-label">Colour palette</span>
          <InfoTip
            text="Ready-made colour combinations, or create your own. A palette sets the accent (buttons, links, selection), the sidebar and the icon rail. Text on the accent is kept readable automatically."
            label="About colour palettes"
          />
        </span>
        <ul className="uab-pal-grid" role="radiogroup" aria-label="Colour palette">
          {PRESET_PALETTES.map(card)}
          {customPalettes.map((palette) => card({ ...palette, custom: true }))}
          <li className="uab-pal-item">
            <button
              type="button"
              className="uab-pal-card uab-pal-new"
              onClick={() =>
                setEditing({
                  id: '',
                  name: '',
                  accent: current.accent,
                  sidebar: current.sidebar,
                  rail: current.rail,
                  custom: true,
                })
              }
            >
              <span className="uab-pal-new-icon">
                <Icon name="plus" size={16} />
              </span>
              <span className="uab-pal-name">Create palette</span>
            </button>
          </li>
        </ul>
      </div>
      {editing && (
        <PaletteEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(palette) => {
            const saved = onSaveCustom(palette);
            onPaletteChange(saved.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const valid = isHex(text);
  return (
    <div className="uab-form-field">
      <label className="uab-field-label" htmlFor={id}>
        {label}
      </label>
      <span className={cx('uab-color-field', !valid && 'uab-is-invalid')}>
        <input
          type="color"
          className="uab-color-swatch"
          aria-label={`${label} picker`}
          value={value}
          onChange={(event) => {
            setText(event.target.value);
            onChange(event.target.value);
          }}
        />
        <input
          id={id}
          className="uab-input"
          value={text}
          maxLength={7}
          spellCheck={false}
          aria-invalid={!valid || undefined}
          onChange={(event) => {
            const next = event.target.value.startsWith('#')
              ? event.target.value
              : `#${event.target.value}`;
            setText(next);
            if (isHex(next)) onChange(next.toLowerCase());
          }}
        />
      </span>
      {!valid && <span className="uab-field-error">Use a 6-digit hex colour.</span>}
    </div>
  );
}

function PaletteEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Palette;
  onClose: () => void;
  onSave: (palette: Omit<Palette, 'custom' | 'id'> & { id?: string }) => void;
}) {
  const [palette, setPalette] = useState<Palette>(initial);
  const d = derivePalette(palette);
  const isNew = !initial.id;
  const nameError = !palette.name.trim() ? 'Give the palette a name' : undefined;
  const [tried, setTried] = useState(false);

  const save = () => {
    setTried(true);
    if (nameError) return;
    onSave({
      id: initial.id || undefined,
      name: palette.name,
      accent: palette.accent,
      sidebar: palette.sidebar,
      rail: palette.rail,
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? 'Create palette' : `Edit ${initial.name}`}
      description="Pick an accent, a sidebar and an icon-rail colour. The preview updates as you change them; saving applies the palette."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {isNew ? 'Save palette' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="uab-pal-editor">
        <div className="uab-form-grid">
          <div className={cx('uab-form-field uab-span-2', tried && nameError && 'uab-has-error')}>
            <label className="uab-field-label" htmlFor="pal-name">
              Name <span className="uab-req">*</span>
            </label>
            <input
              id="pal-name"
              className="uab-input"
              value={palette.name}
              maxLength={30}
              placeholder="e.g. Clinic teal"
              onChange={(event) => setPalette({ ...palette, name: event.target.value })}
              data-autofocus
              aria-invalid={(tried && !!nameError) || undefined}
            />
            {tried && nameError && <span className="uab-field-error">{nameError}</span>}
          </div>
          <ColorField
            id="pal-accent"
            label="Accent"
            value={palette.accent}
            onChange={(value) => setPalette({ ...palette, accent: value })}
          />
          <ColorField
            id="pal-sidebar"
            label="Sidebar"
            value={palette.sidebar}
            onChange={(value) => setPalette({ ...palette, sidebar: value })}
          />
          <ColorField
            id="pal-rail"
            label="Icon rail"
            value={palette.rail}
            onChange={(value) => setPalette({ ...palette, rail: value })}
          />
        </div>
        <div className="uab-pal-preview">
          <span className="uab-field-label">Preview</span>
          <PaletteMock palette={palette} large />
          <p className="uab-pal-check">
            <Icon name={d.buttonContrast >= 4.5 ? 'check' : 'alert'} size={14} />
            Button text: {d.onAccentName} · contrast {d.buttonContrast.toFixed(1)}:1
          </p>
        </div>
      </div>
    </Dialog>
  );
}

export type AppearanceMenuProps = ThemePickerProps;

/** The palette icon in the top bar: opens the theme picker in a popover. */
export function AppearanceMenu(props: AppearanceMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton
        ref={ref}
        icon="palette"
        label="Appearance"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={ref}
        label="Appearance"
        width={380}
        align="end"
      >
        <div className="uab-pop-head">
          <strong>Appearance</strong>
        </div>
        <div className="uab-pop-body">
          <ThemePicker {...props} />
        </div>
      </Popover>
    </>
  );
}
