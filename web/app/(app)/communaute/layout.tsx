import 'katex/dist/katex.min.css'

import { lireReglageCommunaute } from '@brio/api-client'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { SiteHeader } from '@/components/site-header'
import { EmptyState } from '@/components/ui/empty-state'
import { apiBaseUrl } from '@/lib/api-base-url'
import { lireMoi } from '@/lib/espace-eleve'

export const dynamic = 'force-dynamic'

/**
 * Every Communauté page goes through here. The setting is the lock on an unmoderated space
 * (ADR 0035 §10): off, nothing under /communaute exists. It is checked in the layout rather than in
 * the pages because a page renders inside loading.tsx, once the 200 status is already sent. Next
 * still renders the page alongside, so the pages cope with what is ruled out here.
 */
export default async function CommunauteLayout({ children }: { children: React.ReactNode }) {
  if (!(await lireReglageCommunaute(apiBaseUrl()))) notFound()

  // No teachers in v1 (ADR 0035 §8). A failed read falls through to the page's own error.
  const moi = await lireMoi((await cookies()).toString())
  if (moi && moi.role !== 'eleve') {
    return (
      <div className="min-h-screen bg-surface-page font-prose text-ink">
        <SiteHeader crumbs={[{ label: 'Communauté' }]} />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <EmptyState
            icon="chat-circle"
            title="La Communauté est réservée aux élèves"
            description="Les élèves s’y posent des questions et s’y répondent entre eux."
          />
        </main>
      </div>
    )
  }

  return children
}
