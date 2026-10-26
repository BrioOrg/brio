/**
 * The sections of each space (student, teacher), shared by its two navigations:
 * the mobile bottom bar (BottomNav) and the desktop left sidebar (SectionSidebar).
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

/**
 * A bottom-bar tab for a module that does not exist yet: rendered disabled, never a link.
 * Only the student bar has one (Profil); the desktop sidebar lists none.
 */
export type UpcomingTab = { key: string; label: string; icon: string }

export const APP_UPCOMING_TABS: UpcomingTab[] = [{ key: 'profil', label: 'Profil', icon: 'user' }]

// The teacher space (/prof), one section per page that exists there. "/prof" is the
// teacher home (Mes cours), and a course editor (/prof/cours/{id}) belongs to it too; the
// other sections claim longer prefixes, so they win over it.
export const PROF_SECTIONS: AppSection[] = [
  { key: 'cours', label: 'Mes cours', icon: 'book-open', href: '/prof', routes: ['/prof'] },
  {
    key: 'classes',
    label: 'Mes classes',
    icon: 'chalkboard',
    href: '/prof/classes',
    routes: ['/prof/classes'],
  },
  {
    key: 'devoirs',
    label: 'Devoirs',
    icon: 'check',
    href: '/prof/devoirs',
    routes: ['/prof/devoirs'],
  },
  {
    key: 'signalements',
    label: 'Signalements',
    icon: 'flag',
    href: '/prof/signalements',
    routes: ['/prof/signalements'],
  },
  {
    key: 'signalements-salon',
    label: 'Signalements du salon',
    icon: 'chat-circle',
    href: '/prof/signalements-salon',
    routes: ['/prof/signalements-salon'],
  },
]
