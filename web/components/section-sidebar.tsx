'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { Infobulle, InfobulleProvider } from '@/components/ui/infobulle'
import { activeSectionKey, type AppSection } from '@/lib/app-sections'

type SectionSidebarProps = {
  /** The sections to list, in order. The student shell passes APP_SECTIONS. */
  sections: AppSection[]
  /** Accessible name of the navigation landmark. */
  label?: string
}

/**
 * Desktop section navigation (≥ sm only — below that, BottomNav carries the same sections):
 * a sticky column of icons on the left of the page. Each label is the link's accessible name
 * and shows as an infobulle on hover and keyboard focus. The active section takes the bottom
 * bar's highlight, so both navigations read the same. Hidden while a chapter is in interactive
 * mode, which takes the whole screen (#245).
 *
 * It takes its sections as props so another space (the teacher one) can reuse it.
 *
 * z-40 sits above the page's sticky SiteHeader (z-30): the infobulle of the first icon is
 * drawn level with the header and must not slip under it.
 */
export function SectionSidebar({ sections, label = 'Navigation principale' }: SectionSidebarProps) {
  const activeKey = activeSectionKey(sections, usePathname() ?? '/')

  return (
    <nav
      aria-label={label}
      className="sticky top-0 z-40 hidden h-screen w-16 shrink-0 self-start flex-col items-center border-r border-line bg-surface-panel py-3 sm:flex [body:has([data-chapitre-mode=interactif])_&]:hidden"
    >
      <InfobulleProvider>
        <ul className="flex flex-col items-center gap-2">
          {sections.map((section) => {
            const active = section.key === activeKey
            return (
              <li key={section.key}>
                <Infobulle label={section.label} side="right">
                  <Link
                    href={section.href}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'grid place-items-center rounded-md p-2 transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel',
                      active
                        ? 'bg-accent-soft text-accent ring-2 ring-inset ring-accent'
                        : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                    ].join(' ')}
                  >
                    <Icon name={section.icon} weight={active ? 'bold' : 'regular'} size={26} />
                    <span className="sr-only">{section.label}</span>
                  </Link>
                </Infobulle>
              </li>
            )
          })}
        </ul>
      </InfobulleProvider>
    </nav>
  )
}
