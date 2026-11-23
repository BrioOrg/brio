import 'katex/dist/katex.min.css'
import type { Metadata } from 'next'

import { Calculatrice } from '@/components/calculatrice/calculatrice'
import { SiteHeader } from '@/components/site-header'
import { decoderEtat } from '@/lib/calculatrice-etat'

export const metadata: Metadata = {
  title: 'Calculatrice graphique — Brio',
}

/**
 * The graphing calculator (ADR 0049 §3). Nothing is asked of the backend: the state is in the
 * address (`?e=`), decoded here with the same pure decoder as in the browser, so the lines and
 * their previews come out of the server render. An unreadable address opens an empty calculator.
 */
export default async function CalculatricePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { e } = await searchParams
  const etat = decoderEtat(e)

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader
        crumbs={[{ label: 'Explorer', href: '/explorer' }, { label: 'Calculatrice graphique' }]}
      />
      <main>
        <h1 className="sr-only">Calculatrice graphique</h1>
        <Calculatrice etatInitial={etat} />
      </main>
    </div>
  )
}
