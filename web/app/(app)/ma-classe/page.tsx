import type { Metadata } from 'next'

import { SalonClasse } from '@/components/messagerie/salon-classe'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Ma classe — Brio',
}

export default function MaClassePage() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Ma classe' }]} />
      <SalonClasse />
    </div>
  )
}
