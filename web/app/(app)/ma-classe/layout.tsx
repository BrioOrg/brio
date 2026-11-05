import type { Metadata } from 'next'

import { EspaceClasse } from '@/components/ma-classe/espace-classe'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Ma classe — Brio',
}

export default function MaClasseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Ma classe' }]} />
      <EspaceClasse>{children}</EspaceClasse>
    </div>
  )
}
