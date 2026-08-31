'use client';

import { useEffect, useState } from 'react';
import { Laptop, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  applyTheme,
  normalizeTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme';

const options: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'system', label: 'Sistema', icon: Laptop },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
];

export function ThemeSwitcher() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const stored = normalizeTheme(
      window.localStorage.getItem(THEME_STORAGE_KEY),
    );
    const syncSystem = (matches: boolean) => {
      setSystemDark(matches);
      applyTheme(document.documentElement, stored, matches);
    };
    const frame = window.requestAnimationFrame(() => {
      setPreference(stored);
      syncSystem(media?.matches ?? false);
    });
    const onChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
      const current = normalizeTheme(
        window.localStorage.getItem(THEME_STORAGE_KEY),
      );
      applyTheme(document.documentElement, current, event.matches);
    };
    media?.addEventListener('change', onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      media?.removeEventListener('change', onChange);
    };
  }, []);

  function select(next: string) {
    const theme = normalizeTheme(next);
    setPreference(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(document.documentElement, theme, systemDark);
  }

  const resolved = resolveTheme(preference, systemDark);
  const TriggerIcon =
    preference === 'system' ? Laptop : resolved === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-xl bg-card/85 shadow-sm backdrop-blur"
            aria-label={`Tema: ${options.find((item) => item.value === preference)?.label}`}
          />
        }
      >
        <TriggerIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
        <DropdownMenuRadioGroup value={preference} onValueChange={select}>
          <DropdownMenuLabel className="px-2 py-1.5">
            Apariencia
          </DropdownMenuLabel>
          {options.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className="rounded-lg px-2.5 py-2"
            >
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
