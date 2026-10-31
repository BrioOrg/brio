import { consulterQuestion } from '@brio/api-client'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { FilQuestion } from '@/components/communaute/fil-question'
import { SiteHeader } from '@/components/site-header'
import { apiBaseUrl } from '@/lib/api-base-url'
import { estIdQuestion } from '@/lib/communaute'
import { lireMoi } from '@/lib/espace-eleve'

export const metadata: Metadata = {
  title: 'Question — Brio',
}

type Props = { params: Promise<{ questionId: string }> }

/** A thread. Each change in it refreshes this page, so what shows is always the server's state. */
export default async function QuestionPage({ params }: Props) {
  const { questionId } = await params
  if (!estIdQuestion(questionId)) notFound()

  const cookie = (await cookies()).toString()
  // Next renders a page even when its layout does not show it: no API call the layout has ruled out.
  const moi = await lireMoi(cookie)
  if (moi && moi.role !== 'eleve') return null

  const question = await consulterQuestion(apiBaseUrl(), questionId, cookie)
  if (!question) notFound()

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader
        crumbs={[{ label: 'Communauté', href: '/communaute' }, { label: question.titre }]}
      />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <FilQuestion question={question} />
      </main>
    </div>
  )
}
