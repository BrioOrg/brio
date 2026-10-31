import { lireReglageCommunaute } from '@brio/api-client'

import { BottomNav } from '@/components/bottom-nav'
import { ExamenBanner } from '@/components/examen-banner'
import { ProgressionProvider } from '@/components/progression-context'
import { SectionSidebar } from '@/components/section-sidebar'
import { apiBaseUrl } from '@/lib/api-base-url'
import { navigationEleve } from '@/lib/app-sections'

/**
 * App-shell layout for the catalogue/parcours section. Carries the section
 * navigation: a left icon sidebar on desktop (≥ sm), the fixed bottom bar on
 * mobile, with space reserved so page content clears it. Auth, onboarding and
 * consentement flows live outside this group and get no shell.
 *
 * The exam banner sits in the content column, next to the sidebar rather than
 * over it, so the two sticky bars never overlap.
 *
 * Wraps the shell in ProgressionProvider so the top-bar XP badge (rendered by
 * each page's SiteHeader) and the exercise widget share one live XP state.
 *
 * The Communauté setting is read at request time and handed down as data, so one image serves every
 * environment (ADR 0024 §5, ADR 0035 §10).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { sections, upcoming } = navigationEleve(await lireReglageCommunaute(apiBaseUrl()))

  return (
    <ProgressionProvider>
      <div className="sm:flex">
        <SectionSidebar sections={sections} />
        <div className="min-w-0 flex-1 pb-16 sm:pb-0">
          <ExamenBanner />
          {children}
        </div>
      </div>
      <BottomNav sections={sections} upcoming={upcoming} />
    </ProgressionProvider>
  )
}
