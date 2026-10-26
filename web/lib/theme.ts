/**
 * The light/dark theme preference, shared by every control that changes it (the Paramètres
 * page, the /design styleguide's ThemeToggle). It lives in this browser only (localStorage), and is
 * applied before first paint by the init script in app/layout.tsx, which reads the same key.
 *
 * "system" means no stored choice: `data-theme` stays absent and tokens.css follows
 * `prefers-color-scheme`.
 */
export type Theme = 'dark' | 'light' | 'system'

export const THEME_STORAGE_KEY = 'brio-theme'

/** Dispatched on window after every change, so another control on the page can follow. */
export const THEME_CHANGE_EVENT = 'brio-theme-change'

export const THEME_LABELS: Record<Theme, string> = {
  dark: 'Sombre',
  light: 'Clair',
  system: 'Système',
}

export function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {}
  return 'system'
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    delete root.dataset.theme
    try {
      localStorage.removeItem(THEME_STORAGE_KEY)
    } catch {}
  } else {
    root.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {}
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }))
}

/** Calls `onChange` whenever the theme is changed on this page. Returns the unsubscribe. */
export function onThemeChange(onChange: (theme: Theme) => void): () => void {
  function listener(e: Event) {
    onChange((e as CustomEvent<Theme>).detail)
  }
  window.addEventListener(THEME_CHANGE_EVENT, listener)
  return () => window.removeEventListener(THEME_CHANGE_EVENT, listener)
}
