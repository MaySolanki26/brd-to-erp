import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker, MultiSelectMenu, SelectMenu } from '@brd/ui';

const few = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const many = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));

describe('SelectMenu', () => {
  it('opens a listbox for a short set without a search box and selects an option', async () => {
    const onChange = vi.fn();
    render(<SelectMenu value="a" onChange={onChange} options={few} label="Owner" />);
    await userEvent.click(screen.getByRole('button', { name: 'Owner: Alpha' }));
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('adds a search box above eight options and filters by typing', async () => {
    const onChange = vi.fn();
    render(<SelectMenu value="" onChange={onChange} options={many} label="Module" />);
    await userEvent.click(screen.getByRole('button', { name: /^Module:/ }));
    await userEvent.type(await screen.findByPlaceholderText('Search…'), 'Option 11');
    expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Option 11'));
    expect(onChange).toHaveBeenCalledWith('v11');
  });

  it('shows the placeholder until something is chosen', () => {
    render(
      <SelectMenu
        value=""
        onChange={() => {}}
        options={few}
        label="Owner"
        placeholder="Pick one"
      />,
    );
    expect(screen.getByRole('button', { name: 'Owner: Pick one' })).toBeInTheDocument();
  });
});

function Harness({ initial = [] as string[] }) {
  const [values, setValues] = useState(initial);
  return (
    <MultiSelectMenu
      label="working days"
      values={values}
      onChange={setValues}
      options={[
        { value: 'mon', label: 'Mon' },
        { value: 'tue', label: 'Tue' },
        { value: 'wed', label: 'Wed' },
      ]}
    />
  );
}

describe('MultiSelectMenu', () => {
  it('selects and deselects everything shown, and shows the count', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /^working days:/ }));
    await userEvent.click(await screen.findByText('Select all'));
    expect(screen.getByText('3 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Deselect all'));
    expect(screen.queryByText('3 selected')).not.toBeInTheDocument();
  });

  it('stays open while toggling and clears from the footer', async () => {
    render(<Harness initial={['mon']} />);
    await userEvent.click(screen.getByRole('button', { name: /^working days:/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Tue' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByText(/ selected$/)).not.toBeInTheDocument();
  });
});

describe('DatePicker', () => {
  const day = '2026-10-16';

  it('shows the project date format on the trigger', () => {
    render(<DatePicker value={day} onChange={() => {}} label="Due" />);
    expect(screen.getByRole('button', { name: /^Due:.*16 Oct, 2026/ })).toBeInTheDocument();
  });

  it('lists the weekday headers and a grid of days', async () => {
    render(<DatePicker value={day} onChange={() => {}} label="Due" />);
    await userEvent.click(screen.getByRole('button', { name: /^Due:/ }));
    expect(await screen.findByRole('grid', { name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getAllByText(/^(Su|Mo|Tu|We|Th|Fr|Sa)$/)).toHaveLength(7);
  });

  it('picks a day and clears an optional date', async () => {
    const onChange = vi.fn();
    render(<DatePicker value={day} onChange={onChange} label="Due" />);
    await userEvent.click(screen.getByRole('button', { name: /^Due:/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /^Due:/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
