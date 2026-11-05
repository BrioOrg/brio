import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import type { ChapitreAReprendre, DevoirEleveVue, MaClasse } from '@brio/api-client'

import { CarteLien, Fleche, TITRE_DE_BLOC } from '@/components/carte-lien'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { ProgressBar } from '@/components/ui/progress-bar'
import { getCatalogue, type CatalogueNiveau } from '@/lib/api'
import { formatEcheance } from '@/lib/echeance'
import {
  competenceARevoir,
  lireClasses,
  lireDevoirs,
  lireLibelles,
  lireMaitrise,
  lireMoi,
  lireReprendre,
  prochainsDevoirs,
} from '@/lib/espace-eleve'

export const metadata: Metadata = {
  title: 'Accueil — Brio',
}

export const dynamic = 'force-dynamic'

/**
 * The student's home: the most useful thing to do now, drawn from the other spaces. Nothing lives
 * here, each block links to where the thing is, and a block with no content disappears. Accounts
 * that are not students have none of this, so they land on Explorer.
 */
export default async function AccueilPage() {
  const cookie = (await cookies()).toString()
  const moi = await lireMoi(cookie)
  if (moi?.role !== 'eleve') redirect('/explorer')

  const [classes, devoirs, reprendre, maitrises, libelles] = await Promise.all([
    lireClasses(cookie),
    lireDevoirs(cookie),
    lireReprendre(cookie),
    lireMaitrise(cookie),
    lireLibelles(cookie),
  ])

  const aRendre = prochainsDevoirs(devoirs ?? [], 3)
  const aRevoir = competenceARevoir(maitrises ?? [], libelles, new Date())
  const rienAFaire = aRendre.length === 0 && !reprendre && !aRevoir
  const catalogue = rienAFaire ? await getCatalogue().catch(() => []) : []

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Accueil' }]} />

      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <h1
          className="font-display font-black leading-[1.05] tracking-tight text-ink"
          style={{ fontSize: 'var(--text-display)' }}
        >
          {moi.pseudonyme ? `Salut ${moi.pseudonyme}` : 'Salut'}
        </h1>

        {aRendre.length > 0 && <PourTaClasse devoirs={aRendre} classes={classes ?? []} />}
        {reprendre && <Reprendre chapitre={reprendre} />}
        {aRevoir && (
          <section aria-labelledby="a-revoir-heading">
            <h2 id="a-revoir-heading" className={TITRE_DE_BLOC}>
              À revoir
            </h2>
            <CarteLien href="/explorer">
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                {aRevoir.intitule}
              </span>
              <span className="flex items-center justify-between font-prose text-sm text-ink-muted">
                Retrouve-la dans Explorer
                <Fleche />
              </span>
            </CarteLien>
          </section>
        )}
        {rienAFaire && (
          <PremiereConnexion monNiveau={catalogue.find((n) => n.niveauCode === moi.niveau)} />
        )}
      </main>
    </div>
  )
}

function PourTaClasse({ devoirs, classes }: { devoirs: DevoirEleveVue[]; classes: MaClasse[] }) {
  const libelle = (classeId: string) => classes.find((c) => c.id === classeId)?.libelle
  // Homework from several classes: each one says its class, since the heading cannot.
  const uneSeule = new Set(devoirs.map((d) => d.classeId)).size === 1
  const classe = uneSeule ? libelle(devoirs[0].classeId) : undefined

  return (
    <section aria-labelledby="pour-ta-classe-heading">
      <h2 id="pour-ta-classe-heading" className={TITRE_DE_BLOC}>
        {uneSeule ? (classe ? `Pour ta classe · ${classe}` : 'Pour ta classe') : 'Pour tes classes'}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {devoirs.map((d) => (
          <li key={d.id}>
            <CarteLien href="/ma-classe">
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                {d.titre}
              </span>
              <span className="flex items-center justify-between gap-2 font-prose text-sm text-ink-muted">
                {[!uneSeule && libelle(d.classeId), `À rendre le ${formatEcheance(d.echeanceAt)}`]
                  .filter(Boolean)
                  .join(' · ')}
                <Fleche />
              </span>
            </CarteLien>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Reprendre({ chapitre }: { chapitre: ChapitreAReprendre }) {
  const { chapitreId, titre, niveauCode, matiereCode, sectionsLues, sectionsTotal } = chapitre
  return (
    <section aria-labelledby="reprendre-heading">
      <h2 id="reprendre-heading" className={TITRE_DE_BLOC}>
        Reprendre
      </h2>
      <Panel className="flex flex-col gap-4 p-5">
        <p className="font-display text-lg font-extrabold tracking-tight text-ink">{titre}</p>
        <ProgressBar value={sectionsLues} max={sectionsTotal} />
        <div>
          <Link href={`/${niveauCode}/${matiereCode}/${chapitreId}`}>
            <Button tabIndex={-1}>Continuer</Button>
          </Link>
        </div>
      </Panel>
    </section>
  )
}

/** Nothing to do yet: the subjects of the student's level, or every level if it is unknown. */
function PremiereConnexion({ monNiveau }: { monNiveau?: CatalogueNiveau }) {
  return (
    <section aria-labelledby="commencer-heading">
      <h2 id="commencer-heading" className={TITRE_DE_BLOC}>
        Choisis par où commencer
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {monNiveau?.matieres.map(({ matiereCode, matiereLibelle, chapitres }) => (
          <li key={matiereCode}>
            <CarteLien href={`/${monNiveau.niveauCode}/${matiereCode}`}>
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                {matiereLibelle}
              </span>
              <span className="flex items-center justify-between font-prose text-sm text-ink-muted">
                {chapitres.length} chapitre{chapitres.length > 1 ? 's' : ''}
                <Fleche />
              </span>
            </CarteLien>
          </li>
        ))}
        {!monNiveau?.matieres.length && (
          <li>
            <CarteLien href="/explorer">
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                Explorer
              </span>
              <span className="flex items-center justify-between font-prose text-sm text-ink-muted">
                Tous les niveaux
                <Fleche />
              </span>
            </CarteLien>
          </li>
        )}
      </ul>
    </section>
  )
}
