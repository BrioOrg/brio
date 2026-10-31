import type { Metadata } from 'next'

import { PoserQuestion } from '@/components/communaute/poser-question'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Poser une question — Brio',
}

export default function NouvelleQuestionPage() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader
        crumbs={[{ label: 'Communauté', href: '/communaute' }, { label: 'Poser une question' }]}
      />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-3xl font-black tracking-tight text-ink">
          Poser une question
        </h1>
        <PoserQuestion />
      </main>
    </div>
  )
}
