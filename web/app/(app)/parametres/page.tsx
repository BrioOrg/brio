import type { Metadata } from 'next'

import { ChoixTheme } from '@/components/parametres/choix-theme'
import { SiteHeader } from '@/components/site-header'
import { Panel } from '@/components/ui/panel'

export const metadata: Metadata = {
  title: 'Paramètres — Brio',
}

/**
 * The user's own options, reached from the burger menu by students and teachers alike. Only
 * what works today: the theme. Other settings (interactive-mode sounds, account…) join as
 * sections of this page when they exist.
 */
export default function ParametresPage() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Paramètres' }]} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-extrabold text-ink">Paramètres</h1>
        <section aria-labelledby="parametres-apparence" className="mt-6">
          <h2
            id="parametres-apparence"
            className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted"
          >
            Apparence
          </h2>
          <Panel>
            <ChoixTheme />
          </Panel>
        </section>
      </main>
    </div>
  )
}
