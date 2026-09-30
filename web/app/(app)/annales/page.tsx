import type { Metadata } from 'next'

import { AnnalesEleve } from '@/components/annales-eleve'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Annales — Brio',
}

export default function AnnalesPage() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Annales' }]} />
      <AnnalesEleve />
    </div>
  )
}
