'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { APP_SECTIONS } from '@/lib/app-sections'

/**
 * Section links in the top bar (≥ sm only — below that, BottomNav carries the
 * same sections). Without it, devoirs and annales are unreachable on a laptop.
 * Between sm and lg the bar is too narrow for labels next to the breadcrumb, so
 * the links show their icon only; the label stays for screen readers.
 */
export function HeaderNav() {
  const pathname = usePathname() ?? '/'

  return (
    <nav aria-label="Navigation principale" className="hidden sm:block">
      <ul className="flex items-center gap-1">
        {APP_SECTIONS.map((section) => {
          const active = section.isActive(pathname)
          return (
            <li key={section.key}>
              <Link
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center rounded-md px-2 py-1.5 lg:px-3 font-display text-sm font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel',
                  active ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                <Icon
                  name={section.icon}
                  weight={active ? 'bold' : 'regular'}
                  size={20}
                  className="lg:hidden"
                />
                <span className="sr-only lg:not-sr-only">{section.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
