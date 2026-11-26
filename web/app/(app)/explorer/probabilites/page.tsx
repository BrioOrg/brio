import type { Metadata } from 'next'

import { ProbabilitySimulator } from '@/components/probabilites/probability-simulator'
import { SiteHeader } from '@/components/site-header'

const title = 'Simulateur de probabilités'

export const metadata: Metadata = { title: `${title} — Brio` }

export default function ProbabilitySimulatorPage() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Explorer', href: '/explorer' }, { label: title }]} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="mb-4 font-display text-3xl font-black tracking-tight text-ink">{title}</h1>
        <ProbabilitySimulator />
      </main>
    </div>
  )
}
