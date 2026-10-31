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
  /** Routes that belong to this section only when matched exactly; they beat any prefix. */
  exactRoutes?: string[]
  /** Route prefixes excluded from `routes` (pages that belong to no section). */
  exceptRoutes?: string[]
}

function under(prefix: string, pathname: string): boolean {
  return prefix === '/' || pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * The key of the section the current route belongs to, or undefined when it
 * belongs to none. An exact route wins outright. Otherwise, when several sections
 * claim the route, the most specific (longest) prefix wins, so a catch-all "/"
 * section yields to the others.
 */
export function activeSectionKey(sections: AppSection[], pathname: string): string | undefined {
  const exact = sections.find((section) => section.exactRoutes?.includes(pathname))
  if (exact) return exact.key

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

// Accueil is "/" and nothing under it. Explorer is the fallback: the catalogue's semantic URLs
// (/{niveau}/…, ADR 0011) have dynamic first segments, so any app-shell route no other section
// claims is an Explorer route — except Paramètres, which is no section (it is reached from the
// burger menu).
export const APP_SECTIONS: AppSection[] = [
  { key: 'accueil', label: 'Accueil', icon: 'sparkle', href: '/', routes: [], exactRoutes: ['/'] },
  {
    key: 'ma-classe',
    label: 'Ma classe',
    icon: 'chalkboard',
    href: '/ma-classe',
    routes: ['/ma-classe', '/devoirs', '/cours'],
  },
  {
    key: 'explorer',
    label: 'Explorer',
    icon: 'compass',
    href: '/explorer',
    routes: ['/'],
    exceptRoutes: ['/parametres'],
  },
  { key: 'profil', label: 'Profil', icon: 'user', href: '/profil', routes: ['/profil'] },
]

/**
 * A bottom-bar tab for a space that is not open: rendered disabled, never a link.
 * Only the student bar has them; the desktop sidebar lists none.
 */
export type UpcomingTab = {
  key: string
  label: string
  icon: string
  /** The section this tab sits just before; without one, it comes after every section. */
  before?: string
}

export const APP_UPCOMING_TABS: UpcomingTab[] = [
  { key: 'communaute', label: 'Communauté', icon: 'chat-circle', before: 'profil' },
]

const COMMUNAUTE_SECTION: AppSection = {
  key: 'communaute',
  label: 'Communauté',
  icon: 'chat-circle',
  href: '/communaute',
  routes: ['/communaute'],
}

/**
 * The student navigation for this environment. The Communauté is a real section only when its
 * server setting is on (ADR 0035 §10); otherwise it stays a disabled tab, so there is no dead link.
 */
export function navigationEleve(communauteActive: boolean): {
  sections: AppSection[]
  upcoming: UpcomingTab[]
} {
  if (!communauteActive) return { sections: APP_SECTIONS, upcoming: APP_UPCOMING_TABS }
  const profil = APP_SECTIONS.findIndex((section) => section.key === 'profil')
  return {
    sections: [...APP_SECTIONS.slice(0, profil), COMMUNAUTE_SECTION, ...APP_SECTIONS.slice(profil)],
    upcoming: APP_UPCOMING_TABS.filter((tab) => tab.key !== COMMUNAUTE_SECTION.key),
  }
}

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
