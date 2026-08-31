import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '@/components/theme-switcher';
import {
  applyTheme,
  normalizeTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
} from '@/lib/theme';

type MediaListener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(initialMatches: boolean) {
  let listener: MediaListener | undefined;
  const media = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_event: string, next: MediaListener) => {
      listener = next;
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  return {
    change(matches: boolean) {
      listener?.({ matches } as MediaQueryListEvent);
    },
  };
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
  vi.unstubAllGlobals();
});

describe('tema de la aplicación', () => {
  it('normaliza preferencias y resuelve el modo del sistema', () => {
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('legacy')).toBe('system');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');

    expect(applyTheme(document.documentElement, 'dark', false)).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('restaura valores guardados y permite elegir otro tema', async () => {
    mockMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeSwitcher />);

    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    const trigger = screen.getByRole('button', { name: 'Tema: Oscuro' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Claro' }));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('sigue cambios del dispositivo solamente en modo Sistema', async () => {
    const media = mockMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    render(<ThemeSwitcher />);

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('system'),
    );
    media.change(true);
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });
});
