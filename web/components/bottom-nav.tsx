'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icon'

/**
 * App shell bottom navigation (mobile only — hidden ≥ sm, where SiteHeader
 * remains the primary nav). Four tabs: parcours · social · exercices · profil.
 *
 * Only "parcours" is wired: it is the catalogue/app home. The other three tabs
 * point at modules that do not exist yet (social, exercices, profil), so they
 * are rendered disabled and non-interactive rather than linking nowhere.
 */
type Tab = {
  key: string
  label: string
  icon: string
  href?: string
  /** True when the current route belongs to this tab's section. */
  isActive: (pathname: string) => boolean
}

// The whole catalogue lives under "parcours" for now, so any route on which the
// shell renders is a parcours route. Kept as a matcher so the other tabs can
// grow real ones once their sections ship.
const TABS: Tab[] = [
  { key: 'parcours', label: 'Parcours', icon: 'compass', href: '/', isActive: () => true },
  { key: 'social', label: 'Social', icon: 'chat-circle', isActive: () => false },
  { key: 'exercices', label: 'Exercices', icon: 'barbell', isActive: () => false },
  { key: 'profil', label: 'Profil', icon: 'user', isActive: () => false },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-panel pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex items-center justify-around px-2 py-2">
        {TABS.map((tab) => {
          const disabled = tab.href === undefined
          const active = !disabled && tab.isActive(pathname)

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
