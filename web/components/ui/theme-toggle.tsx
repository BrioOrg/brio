'use client'

import { useEffect, useState } from 'react'
import { Icon } from './icon'
import { applyTheme, onThemeChange, readStoredTheme, THEME_LABELS, type Theme } from '@/lib/theme'

const ICONS: Record<Theme, string> = {
  dark: 'eye-slash',
  light: 'eye',
  system: 'circle-notch',
}

const CYCLE: Theme[] = ['dark', 'light', 'system']

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    setTheme(readStoredTheme())
    // Follow a change made elsewhere on the page (the Paramètres theme choice).
    return onThemeChange(setTheme)
  }, [])

  function toggle() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length]
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Thème : ${THEME_LABELS[theme]}. Cliquer pour changer.`}
      className="inline-flex items-center gap-2 font-prose text-sm font-semibold text-ink-muted border border-line rounded-pill px-4 py-2 hover:text-ink hover:border-accent transition-colors"
      style={{ transitionDuration: 'var(--duration-base)' }}
    >
      <Icon name={ICONS[theme]} size={16} aria-hidden="true" />
      <span className="hidden sm:inline">Thème : {THEME_LABELS[theme]}</span>
    </button>
  )
}
