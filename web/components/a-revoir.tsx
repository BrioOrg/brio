import type { LeconCompetence } from '@brio/api-client'

import { CarteLien, Fleche, TITRE_DE_BLOC } from '@/components/carte-lien'
import { hrefLecon } from '@/lib/revoir'

/** The competence to review, with a link straight to the lesson that works it. */
export function ARevoir({
  competence,
}: {
  competence: { intitule: string; lecon: LeconCompetence }
}) {
  const { intitule, lecon } = competence
  const titre = lecon.sectionTitre.trim()
  return (
    <section aria-labelledby="a-revoir-heading">
      <h2 id="a-revoir-heading" className={TITRE_DE_BLOC}>
        À revoir
      </h2>
      <CarteLien href={hrefLecon(lecon)}>
        <span className="font-display text-lg font-extrabold tracking-tight text-ink">
          {intitule}
        </span>
        <span className="flex items-center justify-between gap-2 font-prose text-sm text-ink-muted">
          <span className="min-w-0">{titre ? `Revois : ${titre}` : 'Revois cette leçon'}</span>
          <span className="shrink-0">
            <Fleche />
          </span>
        </span>
      </CarteLien>
    </section>
  )
}
