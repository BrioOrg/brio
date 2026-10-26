import { BottomNav } from '@/components/bottom-nav'
import { ExamenBanner } from '@/components/examen-banner'
import { ProgressionProvider } from '@/components/progression-context'
import { SectionSidebar } from '@/components/section-sidebar'
import { APP_SECTIONS, APP_UPCOMING_TABS } from '@/lib/app-sections'

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
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProgressionProvider>
      <div className="sm:flex">
        <SectionSidebar sections={APP_SECTIONS} />
        <div className="min-w-0 flex-1 pb-16 sm:pb-0">
          <ExamenBanner />
          {children}
        </div>
      </div>
      <BottomNav sections={APP_SECTIONS} upcoming={APP_UPCOMING_TABS} />
    </ProgressionProvider>
  )
}
