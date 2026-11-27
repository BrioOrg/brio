'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'

import { listerMesDevoirs, type DevoirEleveVue } from '@brio/api-client'

import { DeposerCopie } from '@/components/deposer-copie'
import { apiBaseUrl } from '@/lib/api-base-url'
import { formatEcheance } from '@/lib/echeance'
import { lienDevoir } from '@/lib/lien-devoir'

// Les devoirs d'une classe côté élève (F4, onglet « À faire » de Ma classe). On sépare « à rendre »
// et « terminés » ; un retard n'est jamais puni (aucune sanction affichée). Les statuts viennent du
// serveur (rendu dérivé des soumissions) — jamais de valeur fabriquée.

// The link to the homework's content, the same for a course and a chapter (#370). `inline-flex`
// with `min-h-6` keeps the target at least 24 px tall.
const LIEN_CONTENU =
  'mt-2 inline-flex min-h-6 items-center font-display text-sm font-extrabold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

const STATUT_LABEL: Record<string, string> = {
  non_commence: 'Pas commencé',
  en_cours: 'En cours',
  rendu: 'Rendu',
}

export function DevoirsEleve({
  classeId,
  cheminsChapitres,
  apresAFaire,
}: {
  classeId: string
  cheminsChapitres: Record<string, string>
  /** Shown between « Devoirs à rendre » and « Terminés », once the list has settled. */
  apresAFaire?: ReactNode
}) {
  const [devoirs, setDevoirs] = useState<DevoirEleveVue[] | null>(null)
  const [deconnecte, setDeconnecte] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await listerMesDevoirs(apiBaseUrl())
        if (res == null) setDeconnecte(true)
        else setDevoirs(res)
      } catch {
        setErreur('Impossible de charger tes devoirs pour le moment.')
      }
    })()
  }, [])

  const deLaClasse = (devoirs ?? []).filter((d) => d.classeId === classeId)
  const estTermine = (d: DevoirEleveVue) => d.corrige || d.statutRendu === 'rendu'
  const aFaire = deLaClasse.filter((d) => !estTermine(d))
  const termines = deLaClasse.filter(estTermine)
  const reglee = devoirs !== null || deconnecte || erreur !== null
  const emplacement = reglee && apresAFaire ? apresAFaire : null
  const carte = (d: DevoirEleveVue, enCours: boolean) => (
    <CarteDevoir key={d.id} devoir={d} aFaire={enCours} lien={lienDevoir(d, cheminsChapitres)} />
  )

  return (
    <div>
      {deconnecte && <p className="text-ink-muted">Connecte-toi pour voir tes devoirs.</p>}
      {erreur && <p className="text-danger">{erreur}</p>}
      {!devoirs && !deconnecte && !erreur && <p className="text-ink-muted">Chargement…</p>}

      {devoirs && !deconnecte && deLaClasse.length === 0 && (
        <p className="text-ink-muted">Aucun devoir pour l’instant. 🎉</p>
      )}

      {aFaire.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
            Devoirs à rendre
          </h2>
          <ul className="flex flex-col gap-3">{aFaire.map((d) => carte(d, true))}</ul>
        </section>
      )}

      {/* Spaced from whatever precedes it (« Devoirs à rendre », or the empty, error or signed-out line);
          only when every homework is done does it open the tab. */}
      {emplacement && (
        <div className={aFaire.length === 0 && termines.length > 0 ? undefined : 'mt-6'}>
          {emplacement}
        </div>
      )}

      {termines.length > 0 && (
        <section className={aFaire.length > 0 || emplacement ? 'mt-6' : undefined}>
          <h2 className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
            Terminés
          </h2>
          <ul className="flex flex-col gap-3">{termines.map((d) => carte(d, false))}</ul>
        </section>
      )}
    </div>
  )
}

function CarteDevoir({
  devoir,
  aFaire,
  lien,
}: {
  devoir: DevoirEleveVue
  aFaire: boolean
  /** The URL of the course or chapter this homework points to, `null` when it cannot be told. */
  lien: string | null
}) {
  return (
    <li
      className={`rounded-2xl border bg-surface-panel p-4 ${
        aFaire ? 'border-accent' : 'border-line'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 break-words font-display text-base font-extrabold text-ink">
            {devoir.titre}
          </div>
          <div className="mt-0.5 text-xs text-ink-muted">
            {devoir.nombreExercices} exercice{devoir.nombreExercices > 1 ? 's' : ''} · à rendre le{' '}
            {formatEcheance(devoir.echeanceAt)}
          </div>
        </div>
        <span className="shrink-0 rounded-pill bg-accent-soft px-2.5 py-0.5 font-display text-[11px] font-extrabold text-accent-ink">
          {devoir.corrige ? 'Corrigé' : (STATUT_LABEL[devoir.statutRendu] ?? devoir.statutRendu)}
        </span>
      </div>
      {lien && (
        <Link href={lien} className={LIEN_CONTENU}>
          {devoir.sourceType === 'cours' ? 'Ouvrir le cours' : 'Ouvrir le chapitre'}
        </Link>
      )}
      {aFaire && <DeposerCopie devoirId={devoir.id} />}
    </li>
  )
}
