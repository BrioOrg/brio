'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'brio-theme'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') {
    delete root.dataset.theme
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  } else {
    root.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
  }
}

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {}
  return 'system'
}

const LABELS: Record<Theme, string> = {
  dark: 'Sombre',
  light: 'Clair',
  system: 'Système',
}

const CYCLE: Theme[] = ['dark', 'light', 'system']

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    setTheme(readStored())
  }, [])

  function toggle() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length]
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className="font-prose text-sm font-semibold text-ink-muted border border-line rounded-pill px-4 py-2 hover:text-ink transition-colors"
      style={{ transitionDuration: 'var(--duration-base)' }}
    >
      Thème : {LABELS[theme]}
    </button>
  )
}
