export const THEME_STORAGE_KEY = 'theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export function normalizeTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system';
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

export function applyTheme(
  root: HTMLElement,
  preference: ThemePreference,
  systemDark: boolean,
) {
  const resolved = resolveTheme(preference, systemDark);
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = preference;
  root.style.colorScheme = resolved;
  return resolved;
}

export const themeBootstrapScript = `(()=>{try{const r=document.documentElement;const s=localStorage.getItem('${THEME_STORAGE_KEY}');const p=s==='light'||s==='dark'||s==='system'?s:'system';const d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);r.classList.toggle('dark',d);r.dataset.theme=p;r.style.colorScheme=d?'dark':'light'}catch{}})()`;
