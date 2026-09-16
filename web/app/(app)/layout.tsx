import { BottomNav } from '@/components/bottom-nav'

/**
 * App-shell layout for the catalogue/parcours section. Adds the mobile bottom
 * navigation and reserves space so page content clears the fixed bar. Auth,
 * onboarding and consentement flows live outside this group and get no shell.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-16 sm:pb-0">{children}</div>
      <BottomNav />
    </>
  )
}
