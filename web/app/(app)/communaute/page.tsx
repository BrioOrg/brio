import { listerQuestions } from '@brio/api-client'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CarteQuestion } from '@/components/communaute/carte-question'
import { FiltresCommunaute } from '@/components/communaute/filtres-communaute'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getCatalogue } from '@/lib/api'
import { apiBaseUrl } from '@/lib/api-base-url'
import { MATIERES_COMMUNAUTE, TOUS_LES_NIVEAUX, urlCommunaute } from '@/lib/communaute'
import { lireMoi } from '@/lib/espace-eleve'

export const metadata: Metadata = {
  title: 'Communauté — Brio',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const premier = (valeur: string | string[] | undefined) =>
  Array.isArray(valeur) ? valeur[0] : valeur

/**
 * The questions, newest first. Every level is visible, but the list opens on the student's own
 * (ADR 0035 §7). The filters live in the URL, so a filtered list survives a reload and the back
 * button. A failed read reaches error.tsx: it must not look like an empty Communauté.
 */
export default async function CommunautePage({ searchParams }: Props) {
  const params = await searchParams
  const cookie = (await cookies()).toString()
  const [moi, catalogue] = await Promise.all([lireMoi(cookie), getCatalogue().catch(() => [])])

  // Next renders a page even when its layout does not show it: no API call the layout has ruled out.
  if (moi && moi.role !== 'eleve') return null

  const niveau = premier(params.niveau) ?? moi?.niveau ?? TOUS_LES_NIVEAUX
  const matiere = premier(params.matiere) ?? ''
  const page = Math.max(Number.parseInt(premier(params.page) ?? '', 10) || 0, 0)

  const resultat = await listerQuestions(
    apiBaseUrl(),
    {
      niveau: niveau === TOUS_LES_NIVEAUX ? undefined : niveau,
      matiere: matiere || undefined,
      page,
    },
    cookie
  )
  if (!resultat) notFound()
  const { questions, pageSuivante } = resultat

  // The catalogue may be unreachable: the student's level and the current filter remain choosable.
  const niveaux = catalogue.map((n) => ({ code: n.niveauCode, libelle: n.niveauLibelle }))
  for (const code of [moi?.niveau, niveau]) {
    if (code && code !== TOUS_LES_NIVEAUX && !niveaux.some((n) => n.code === code)) {
      niveaux.push({ code, libelle: code })
    }
  }

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Communauté' }]} />

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1
            className="font-display font-black leading-[1.05] tracking-tight text-ink"
            style={{ fontSize: 'var(--text-display)' }}
          >
            Communauté
          </h1>
          <Link href="/communaute/nouvelle">
            <Button tabIndex={-1}>Poser une question</Button>
          </Link>
        </div>

        <FiltresCommunaute
          niveau={niveau}
          matiere={matiere}
          niveaux={niveaux}
          matieres={MATIERES_COMMUNAUTE}
        />

        {questions.length === 0 ? (
          <EmptyState
            icon="chat-circle"
            title={page > 0 ? 'Il n’y a plus de questions ici' : 'Aucune question pour l’instant'}
            description={
              page > 0
                ? 'Reviens aux questions plus récentes.'
                : 'Change les filtres, ou pose la première question.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {questions.map((question) => (
              <li key={question.id}>
                <CarteQuestion question={question} />
              </li>
            ))}
          </ul>
        )}

        {(page > 0 || pageSuivante) && (
          <nav aria-label="Pages de questions" className="flex flex-wrap justify-between gap-3">
            {page > 0 ? (
              <Link href={urlCommunaute({ niveau, matiere, page: page - 1 })}>
                <Button variant="secondary" tabIndex={-1}>
                  Questions plus récentes
                </Button>
              </Link>
            ) : (
              <span />
            )}
            {pageSuivante && (
              <Link href={urlCommunaute({ niveau, matiere, page: page + 1 })}>
                <Button variant="secondary" tabIndex={-1}>
                  Questions plus anciennes
                </Button>
              </Link>
            )}
          </nav>
        )}
      </main>
    </div>
  )
}
