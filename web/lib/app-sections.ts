/**
 * The student sections that exist today, shared by the two navigations: the
 * mobile bottom bar (BottomNav) and the desktop header (HeaderNav).
 */
export type AppSection = {
  key: string
  label: string
  icon: string
  href: string
  /** True when the current route belongs to this section. */
  isActive: (pathname: string) => boolean
}

// The whole catalogue lives under "parcours" for now, so any app-shell route
// that is not another section's is a parcours route.
export const APP_SECTIONS: AppSection[] = [
  {
    key: 'parcours',
    label: 'Parcours',
    icon: 'compass',
    href: '/',
    isActive: (pathname) => !pathname.startsWith('/devoirs') && !pathname.startsWith('/annales'),
  },
  {
    key: 'devoirs',
    label: 'Devoirs',
    icon: 'check',
    href: '/devoirs',
    isActive: (pathname) => pathname.startsWith('/devoirs'),
  },
  {
    key: 'annales',
    label: 'Annales',
    icon: 'book-open',
    href: '/annales',
    isActive: (pathname) => pathname.startsWith('/annales'),
  },
]
