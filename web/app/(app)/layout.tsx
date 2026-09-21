import { BottomNav } from '@/components/bottom-nav'
import { ProgressionProvider } from '@/components/progression-context'

/**
 * App-shell layout for the catalogue/parcours section. Adds the mobile bottom
 * navigation and reserves space so page content clears the fixed bar. Auth,
 * onboarding and consentement flows live outside this group and get no shell.
 *
 * Wraps the shell in ProgressionProvider so the top-bar XP badge (rendered by
 * each page's SiteHeader) and the exercise widget share one live XP state.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProgressionProvider>
      <div className="pb-16 sm:pb-0">{children}</div>
      <BottomNav />
    </ProgressionProvider>
  )
}
