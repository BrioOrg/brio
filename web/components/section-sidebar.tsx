'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Icon } from '@/components/ui/icon'
import { activeSectionKey, type AppSection } from '@/lib/app-sections'

/** Delay before opening on hover, so a mouse only crossing the column doesn't open it. */
const HOVER_OPEN_DELAY_MS = 120

type SectionSidebarProps = {
  /** The sections to list, in order. The student shell passes APP_SECTIONS. */
  sections: AppSection[]
  /** Accessible name of the navigation landmark. */
  label?: string
}

/**
 * Desktop section navigation (≥ sm only — below that, BottomNav carries the same sections):
 * a sticky column of icons on the left of the page. On mouse hover or keyboard focus the panel
 * widens to show every label at once (#319). The nav itself keeps its 64 px in the layout and
 * the panel is absolutely positioned inside it, so the wider panel covers the page instead of
 * pushing it. A touch never opens it, and the focus of a mouse click doesn't either
 * (:focus-visible), or the panel would stay open after the mouse has left.
 *
 * The active section takes the bottom bar's highlight, so both navigations read the same.
 * Hidden while a chapter is in interactive mode, which takes the whole screen (#245).
 *
 * It takes its sections as props so another space (the teacher one) can reuse it.
 *
 * z-40 sits above the page's sticky SiteHeader (z-30): the wide panel covers it too.
 */
export function SectionSidebar({ sections, label = 'Navigation principale' }: SectionSidebarProps) {
  const activeKey = activeSectionKey(sections, usePathname() ?? '/')
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const expanded = hovered || focused

  useEffect(() => () => clearTimeout(openTimer.current), [])

  function close() {
    clearTimeout(openTimer.current)
    setHovered(false)
    setFocused(false)
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') close()
  }

  return (
    <nav
      aria-label={label}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return
        clearTimeout(openTimer.current)
        openTimer.current = setTimeout(() => setHovered(true), HOVER_OPEN_DELAY_MS)
      }}
      onPointerLeave={() => {
        clearTimeout(openTimer.current)
        setHovered(false)
      }}
      onFocus={(event) => setFocused(event.target.matches(':focus-visible'))}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="sticky top-0 z-40 hidden h-screen w-16 shrink-0 self-start sm:block [body:has([data-chapitre-mode=interactif])_&]:hidden"
    >
      <div
        data-testid="section-sidebar-panel"
        className={[
          'absolute inset-y-0 left-0 overflow-hidden border-r border-line bg-surface-panel px-2.5 py-3 transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out)] motion-reduce:transition-none',
          expanded ? 'w-60' : 'w-16',
        ].join(' ')}
      >
        <ul className="flex flex-col gap-2">
          {sections.map((section) => {
            const active = section.key === activeKey
            return (
              <li key={section.key}>
                <Link
                  href={section.href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex items-center gap-3 rounded-md p-2 transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                    active
                      ? 'bg-accent-soft text-accent ring-2 ring-inset ring-accent'
                      : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                  ].join(' ')}
                >
                  <Icon
                    name={section.icon}
                    weight={active ? 'bold' : 'regular'}
                    size={26}
                    className="shrink-0"
                  />
                  {/* Always in the DOM: it is the link's accessible name when collapsed too. */}
                  <span
                    className={[
                      'whitespace-nowrap font-display text-sm font-extrabold transition-opacity duration-[var(--duration-base)] motion-reduce:transition-none',
                      expanded ? 'opacity-100' : 'opacity-0',
                    ].join(' ')}
                  >
                    {section.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
