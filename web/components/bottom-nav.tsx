'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { activeSectionKey, APP_SECTIONS } from '@/lib/app-sections'

/**
 * App shell bottom navigation (mobile only — hidden ≥ sm, where SectionSidebar
 * carries the same sections). Hidden while a chapter is in interactive mode,
 * which takes the whole screen (#245). Tabs: parcours · devoirs · annales · ma-classe · profil.
 *
 * "parcours" (catalogue/app home), "devoirs" (homework, F4), "annales" (exam
 * papers, F7) and "ma-classe" (class salon, F6b) are wired. "profil" points at a
 * module that does not exist yet, so it is rendered disabled rather than linking nowhere.
 */
type Tab = { key: string; label: string; icon: string; href?: string }

const TABS: Tab[] = [...APP_SECTIONS, { key: 'profil', label: 'Profil', icon: 'user' }]

export function BottomNav() {
  const activeKey = activeSectionKey(APP_SECTIONS, usePathname() ?? '/')

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-panel pb-[env(safe-area-inset-bottom)] sm:hidden [body:has([data-chapitre-mode=interactif])_&]:hidden"
    >
      <ul className="flex items-center justify-around px-2 py-2">
        {TABS.map((tab) => {
          const disabled = tab.href === undefined
          const active = !disabled && tab.key === activeKey

          const shell =
            'grid place-items-center rounded-md p-2 transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel'

          return (
            <li key={tab.key}>
              {disabled ? (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className={[shell, 'cursor-not-allowed text-ink-muted/40'].join(' ')}
                >
                  <Icon name={tab.icon} size={26} />
                  <span className="sr-only">{tab.label} — bientôt disponible</span>
                </button>
              ) : (
                <Link
                  href={tab.href!}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    shell,
                    active
                      ? 'bg-accent-soft text-accent ring-2 ring-inset ring-accent'
                      : 'text-ink-muted hover:text-ink',
                  ].join(' ')}
                >
                  <Icon name={tab.icon} weight={active ? 'bold' : 'regular'} size={26} />
                  <span className="sr-only">{tab.label}</span>
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
