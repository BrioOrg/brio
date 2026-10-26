/**
 * The student sections that exist today, shared by the two navigations: the
 * mobile bottom bar (BottomNav) and the desktop left sidebar (SectionSidebar).
 *
 * A section is plain data, with no function, so a Server Component layout can
 * hand a list of them to the client-side SectionSidebar as props.
 */
export type AppSection = {
  key: string
  label: string
  icon: string
  href: string
  /** Route prefixes that belong to this section ("/" is every route). */
  routes: string[]
  /** Route prefixes excluded from `routes` (pages that belong to no section). */
  exceptRoutes?: string[]
}

function under(prefix: string, pathname: string): boolean {
  return prefix === '/' || pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * The key of the section the current route belongs to, or undefined when it
 * belongs to none. When several sections claim the route, the most specific
 * (longest) prefix wins, so a catch-all "/" section yields to the others.
 */
export function activeSectionKey(sections: AppSection[], pathname: string): string | undefined {
  let best: { key: string; length: number } | undefined
  for (const section of sections) {
    if (section.exceptRoutes?.some((prefix) => under(prefix, pathname))) continue
    for (const prefix of section.routes) {
      if (under(prefix, pathname) && (!best || prefix.length > best.length)) {
        best = { key: section.key, length: prefix.length }
      }
    }
  }
  return best?.key
}

// The whole catalogue lives under "parcours" for now, so any app-shell route
// that is not another section's is a parcours route — except Paramètres, which is
// no section (it is reached from the burger menu).
export const APP_SECTIONS: AppSection[] = [
  {
    key: 'parcours',
    label: 'Parcours',
    icon: 'compass',
    href: '/',
    routes: ['/'],
    exceptRoutes: ['/parametres'],
  },
  { key: 'devoirs', label: 'Devoirs', icon: 'check', href: '/devoirs', routes: ['/devoirs'] },
  { key: 'annales', label: 'Annales', icon: 'book-open', href: '/annales', routes: ['/annales'] },
  {
    key: 'ma-classe',
    label: 'Ma classe',
    icon: 'chat-circle',
    href: '/ma-classe',
    routes: ['/ma-classe'],
  },
]
