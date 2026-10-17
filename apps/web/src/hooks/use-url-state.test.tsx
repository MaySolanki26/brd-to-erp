import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useUrlState } from './use-url-state';

const schema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().catch(''),
});

function render(initial: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const [state, update] = useUrlState(schema);
      return { state, update, search: useLocation().search };
    },
    { wrapper },
  );
}

describe('useUrlState', () => {
  it('reads valid values from the address', () => {
    const { result } = render('/?page=3&search=acme');
    expect(result.current.state).toEqual({ page: 3, search: 'acme' });
  });

  it('falls back to the default for an invalid value', () => {
    const { result } = render('/?page=-4&search=ok');
    expect(result.current.state).toEqual({ page: 1, search: 'ok' });
  });

  it('writes changes, drops defaults and keeps unrelated params', () => {
    const { result } = render('/?tab=sources');
    act(() => result.current.update({ page: 2, search: 'x' }));
    expect(new URLSearchParams(result.current.search).toString()).toBe('tab=sources&page=2&search=x');

    act(() => result.current.update({ page: 1 }));
    expect(new URLSearchParams(result.current.search).toString()).toBe('tab=sources&search=x');
  });
});
