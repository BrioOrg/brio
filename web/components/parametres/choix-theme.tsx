'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { applyTheme, onThemeChange, readStoredTheme, THEME_LABELS, type Theme } from '@/lib/theme'

const OPTIONS: { theme: Theme; icon: string; aide: string }[] = [
  { theme: 'light', icon: 'sun', aide: 'Fond clair' },
  { theme: 'dark', icon: 'moon', aide: 'Fond sombre' },
  { theme: 'system', icon: 'desktop', aide: 'Suit le réglage de l’appareil' },
]

/**
 * The theme setting: three native radio buttons (arrow keys move between them, the group is
 * named by its legend). The choice applies at once and is kept in this browser only — the
 * copy says so rather than implying it follows the account.
 */
export function ChoixTheme() {
  // null until the stored choice is read, so no option shows as checked before we know.
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(readStoredTheme())
    return onThemeChange(setTheme)
  }, [])

  function choisir(next: Theme) {
    applyTheme(next)
    setTheme(next)
  }

  return (
    <fieldset>
      <legend className="font-display text-base font-extrabold text-ink">Thème</legend>
      <p id="choix-theme-aide" className="mt-1 font-prose text-sm text-ink-muted">
        Ce choix s’applique sur cet appareil.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <label
            key={option.theme}
            className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-line bg-surface-raised p-3 transition-colors duration-[var(--duration-fast)] hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface-panel"
          >
            <input
              type="radio"
              name="theme"
              value={option.theme}
              checked={theme === option.theme}
              onChange={() => choisir(option.theme)}
              aria-describedby="choix-theme-aide"
              className="sr-only"
            />
            <Icon name={option.icon} size={22} className="shrink-0 text-accent" />
            <span className="flex flex-col">
              <span className="font-display text-sm font-bold text-ink">
                {THEME_LABELS[option.theme]}
              </span>
              <span className="font-prose text-xs text-ink-muted">{option.aide}</span>
            </span>
            {/* Not colour alone: the chosen option also carries a check mark. */}
            {theme === option.theme && (
              <Icon name="check" weight="bold" size={18} className="ml-auto shrink-0 text-accent" />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
