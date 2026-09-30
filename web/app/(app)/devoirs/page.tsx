import type { Metadata } from 'next'

import { DevoirsEleve } from '@/components/devoirs-eleve'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Mes devoirs — Brio',
}

export default function DevoirsElevePage() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Devoirs' }]} />
      <DevoirsEleve />
    </div>
  )
}
