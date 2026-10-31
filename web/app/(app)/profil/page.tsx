import { cookies } from 'next/headers'
import type { Metadata } from 'next'

import type { MaClasse, MaitriseInfo, ProgressionInfo, SerieInfo } from '@brio/api-client'

import { CarteLien, Fleche, TITRE_DE_BLOC } from '@/components/carte-lien'
import { SiteHeader } from '@/components/site-header'
import { Icon } from '@/components/ui/icon'
import { Panel } from '@/components/ui/panel'
import { ProgressBar } from '@/components/ui/progress-bar'
import { getCatalogue } from '@/lib/api'
import {
  lireClasses,
  lireLibelles,
  lireMaitrise,
  lireMoi,
  lireProgression,
  lireSerie,
} from '@/lib/espace-eleve'

export const metadata: Metadata = {
  title: 'Profil — Brio',
}

export const dynamic = 'force-dynamic'

const NIVEAU_MAITRISE_MAX = 4

/**
 * Who the student is on Brio and where they stand. Everything comes from the backend, and a block
 * with nothing to show disappears. Paramètres stays in the burger menu; this page links to it. An
 * account that is not a student only gets that link.
 */
export default async function ProfilPage() {
  const cookie = (await cookies()).toString()
  const moi = await lireMoi(cookie)
  const eleve = moi?.role === 'eleve'

  const [classes, progression, serie, maitrises, libelles, catalogue] = eleve
    ? await Promise.all([
        lireClasses(cookie),
        lireProgression(cookie),
        lireSerie(cookie),
        lireMaitrise(cookie),
        lireLibelles(cookie),
        getCatalogue().catch(() => []),
      ])
    : [null, null, null, null, new Map<string, string>(), []]

  const niveau =
    catalogue.find((n) => n.niveauCode === moi?.niveau)?.niveauLibelle ?? moi?.niveau ?? null

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Profil' }]} />

      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <h1
          className="font-display font-black leading-[1.05] tracking-tight text-ink"
          style={{ fontSize: 'var(--text-display)' }}
        >
          Profil
        </h1>

        {moi?.pseudonyme && (
          <QuiTuEs pseudonyme={moi.pseudonyme} niveau={niveau} classes={classes ?? []} />
        )}
        {progression && <TesPoints progression={progression} serie={serie} />}
        <TaMaitrise maitrises={maitrises ?? []} libelles={libelles} />

        <section aria-labelledby="parametres-heading">
          <h2 id="parametres-heading" className={TITRE_DE_BLOC}>
            Paramètres
          </h2>
          <CarteLien href="/parametres">
            <span className="flex items-center justify-between font-display text-lg font-extrabold tracking-tight text-ink">
              Thème et réglages du compte
              <Fleche />
            </span>
          </CarteLien>
        </section>
      </main>
    </div>
  )
}

function QuiTuEs({
  pseudonyme,
  niveau,
  classes,
}: {
  pseudonyme: string
  niveau: string | null
  classes: MaClasse[]
}) {
  const nomsDeClasse = classes.filter((c) => c.nomAffiche)
  return (
    <section aria-labelledby="qui-tu-es-heading">
      <h2 id="qui-tu-es-heading" className={TITRE_DE_BLOC}>
        Qui tu es sur Brio
      </h2>
      <Panel className="flex flex-col gap-4 p-5">
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="font-prose text-sm text-ink-muted">Partout sur Brio</dt>
            <dd className="font-display text-lg font-extrabold text-ink">
              {[pseudonyme, niveau].filter(Boolean).join(' · ')}
            </dd>
          </div>
          {nomsDeClasse.map((c) => (
            <div key={c.id}>
              <dt className="font-prose text-sm text-ink-muted">Dans ta classe {c.libelle}</dt>
              <dd className="font-display text-lg font-extrabold text-ink">{c.nomAffiche}</dd>
            </div>
          ))}
        </dl>
        <p className="font-prose text-sm text-ink-muted">
          Les deux ne sont jamais affichés ensemble.
        </p>
      </Panel>
    </section>
  )
}

function TesPoints({
  progression,
  serie,
}: {
  progression: ProgressionInfo
  serie: SerieInfo | null
}) {
  const jours = serie?.joursConsecutifs ?? 0
  return (
    <section aria-labelledby="tes-points-heading">
      <h2 id="tes-points-heading" className={TITRE_DE_BLOC}>
        Tes points
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <li>
          <Panel className="p-5">
            <p className="font-display text-2xl font-black text-ink">{progression.xpTotal} XP</p>
            <p className="font-prose text-sm text-ink-muted">Niveau {progression.niveau}</p>
          </Panel>
        </li>
        {/* Never "0 jour": the streak only shows once there is one to celebrate. */}
        {jours > 0 && (
          <li>
            <Panel className="p-5">
              <p className="flex items-center gap-1 font-display text-2xl font-black text-ink">
                <Icon name="flame" weight="bold" size={22} className="text-streak" />
                {jours}
              </p>
              <p className="font-prose text-sm text-ink-muted">
                {jours > 1 ? 'jours de suite' : 'jour de suite'}
              </p>
            </Panel>
          </li>
        )}
      </ul>
    </section>
  )
}

function TaMaitrise({
  maitrises,
  libelles,
}: {
  maitrises: MaitriseInfo[]
  libelles: Map<string, string>
}) {
  const lignes = maitrises
    .flatMap((m) => {
      const intitule = libelles.get(m.competenceCode)
      return intitule ? [{ ...m, intitule }] : []
    })
    .sort((a, b) => a.intitule.localeCompare(b.intitule, 'fr'))
  if (lignes.length === 0) return null

  return (
    <section aria-labelledby="ta-maitrise-heading">
      <h2 id="ta-maitrise-heading" className={TITRE_DE_BLOC}>
        Ta maîtrise
      </h2>
      <ul className="flex flex-col gap-3">
        {lignes.map((m) => (
          <li key={m.competenceCode}>
            <Panel className="flex flex-col gap-2">
              <p className="font-prose text-sm font-semibold text-ink">{m.intitule}</p>
              {m.niveau == null ? (
                <p className="font-prose text-sm text-ink-muted">En cours d&rsquo;évaluation</p>
              ) : (
                <ProgressBar value={m.niveau} max={NIVEAU_MAITRISE_MAX} />
              )}
            </Panel>
          </li>
        ))}
      </ul>
    </section>
  )
}
