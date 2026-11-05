'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { listerMesDevoirs, type DevoirEleveVue } from '@brio/api-client'

import { DeposerCopie } from '@/components/deposer-copie'
import { apiBaseUrl } from '@/lib/api-base-url'
import { formatEcheance } from '@/lib/echeance'

// Les devoirs d'une classe côté élève (F4, onglet « À faire » de Ma classe). On sépare « à faire »
// et « terminés » ; un retard n'est jamais puni (aucune sanction affichée). Les statuts viennent du
// serveur (rendu dérivé des soumissions) — jamais de valeur fabriquée.

const STATUT_LABEL: Record<string, string> = {
  non_commence: 'À faire',
  en_cours: 'En cours',
  rendu: 'Rendu',
}

export function DevoirsEleve({
  classeId,
  cheminsChapitres,
}: {
  classeId: string
  cheminsChapitres: Record<string, string>
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
  const carte = (d: DevoirEleveVue, enCours: boolean) => (
    <CarteDevoir
      key={d.id}
      devoir={d}
      aFaire={enCours}
      chemin={d.sourceType === 'chapitre' ? cheminsChapitres[d.sourceRef] : undefined}
    />
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
            À faire
          </h2>
          <ul className="flex flex-col gap-3">{aFaire.map((d) => carte(d, true))}</ul>
        </section>
      )}

      {termines.length > 0 && (
        <section className={aFaire.length > 0 ? 'mt-6' : undefined}>
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
  chemin,
}: {
  devoir: DevoirEleveVue
  aFaire: boolean
  /** The URL of the chapter this homework points to, if any. */
  chemin?: string
}) {
  return (
    <li
      className={`rounded-2xl border bg-surface-panel p-4 ${
        aFaire ? 'border-accent' : 'border-line'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-extrabold text-ink">{devoir.titre}</div>
          <div className="mt-0.5 text-xs text-ink-muted">
            {devoir.nombreExercices} exercice{devoir.nombreExercices > 1 ? 's' : ''} · à rendre le{' '}
            {formatEcheance(devoir.echeanceAt)}
          </div>
        </div>
        <span className="shrink-0 rounded-pill bg-accent-soft px-2.5 py-0.5 font-display text-[11px] font-extrabold text-accent-ink">
          {devoir.corrige ? 'Corrigé' : (STATUT_LABEL[devoir.statutRendu] ?? devoir.statutRendu)}
        </span>
      </div>
      {chemin && (
        <Link
          href={`${chemin}?devoir=${devoir.id}`}
          className="mt-2 inline-block font-display text-sm font-extrabold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Ouvrir le chapitre
        </Link>
      )}
      {aFaire && <DeposerCopie devoirId={devoir.id} />}
    </li>
  )
}
