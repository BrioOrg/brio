'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { activeSectionKey, type AppSection, type UpcomingTab } from '@/lib/app-sections'

type BottomNavProps = {
  /** The sections to list, in order: APP_SECTIONS for students, PROF_SECTIONS for teachers. */
  sections: AppSection[]
  /** Tabs for modules that do not exist yet, rendered disabled after the sections. */
  upcoming?: UpcomingTab[]
  /** Accessible name of the navigation landmark. */
  label?: string
}

/**
 * Bottom section navigation (mobile only — hidden ≥ sm, where SectionSidebar carries the
 * same sections). Hidden while a chapter is in interactive mode, which takes the whole
 * screen (#245).
 *
 * It takes its sections as props so both spaces use it: the student shell passes
 * APP_SECTIONS plus the disabled Profil tab (its module does not exist yet, so it is
 * rendered disabled rather than linking nowhere), the teacher space PROF_SECTIONS.
 */
export function BottomNav({
  sections,
  upcoming = [],
  label = 'Navigation principale',
}: BottomNavProps) {
  const activeKey = activeSectionKey(sections, usePathname() ?? '/')

  const shell =
    'grid place-items-center rounded-md p-2 transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel'

  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-panel pb-[env(safe-area-inset-bottom)] sm:hidden [body:has([data-chapitre-mode=interactif])_&]:hidden"
    >
      <ul className="flex items-center justify-around px-2 py-2">
        {sections.map((section) => {
          const active = section.key === activeKey
          return (
            <li key={section.key}>
              <Link
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  shell,
                  active
                    ? 'bg-accent-soft text-accent ring-2 ring-inset ring-accent'
                    : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                <Icon name={section.icon} weight={active ? 'bold' : 'regular'} size={26} />
                <span className="sr-only">{section.label}</span>
              </Link>
            </li>
          )
        })}
        {upcoming.map((tab) => (
          <li key={tab.key}>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className={[shell, 'cursor-not-allowed text-ink-muted/40'].join(' ')}
            >
              <Icon name={tab.icon} size={26} />
              <span className="sr-only">{tab.label} — bientôt disponible</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
