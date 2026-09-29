'use client'

import { useEffect, useState } from 'react'

import { listerMesDevoirs, type DevoirEleveVue } from '@brio/api-client'

import { DeposerCopie } from '@/components/deposer-copie'
import { apiBaseUrl } from '@/lib/api-base-url'

// « Mes devoirs » côté élève (F4) — thème Arcade (tokens par défaut). On sépare « à faire » et
// « terminés » ; un retard n'est jamais puni (aucune sanction affichée). Les statuts viennent du
// serveur (rendu dérivé des soumissions) — jamais de valeur fabriquée.

const STATUT_LABEL: Record<string, string> = {
  non_commence: 'À faire',
  en_cours: 'En cours',
  rendu: 'Rendu',
}

export function DevoirsEleve() {
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

  const aFaire = (devoirs ?? []).filter((d) => d.statutRendu !== 'rendu')
  const termines = (devoirs ?? []).filter((d) => d.statutRendu === 'rendu')

  return (
    <div className="min-h-screen bg-surface-page px-4 py-6 font-prose text-ink">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold text-ink">Mes devoirs</h1>

        {deconnecte && (
          <p className="mt-4 text-ink-muted">Connecte-toi pour voir tes devoirs.</p>
        )}
        {erreur && <p className="mt-4 text-danger">{erreur}</p>}
        {!devoirs && !deconnecte && !erreur && <p className="mt-4 text-ink-muted">Chargement…</p>}

        {devoirs && !deconnecte && devoirs.length === 0 && (
          <p className="mt-4 text-ink-muted">Aucun devoir pour l’instant. 🎉</p>
        )}

        {aFaire.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
              À faire
            </h2>
            <ul className="flex flex-col gap-3">
              {aFaire.map((d) => (
                <CarteDevoir key={d.id} devoir={d} aFaire />
              ))}
            </ul>
          </section>
        )}

        {termines.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
              Terminés
            </h2>
            <ul className="flex flex-col gap-3">
              {termines.map((d) => (
                <CarteDevoir key={d.id} devoir={d} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function CarteDevoir({ devoir, aFaire }: { devoir: DevoirEleveVue; aFaire?: boolean }) {
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
            {formatDate(devoir.echeanceAt)}
          </div>
        </div>
        <span className="shrink-0 rounded-pill bg-accent-soft px-2.5 py-0.5 font-display text-[11px] font-extrabold text-accent-ink">
          {STATUT_LABEL[devoir.statutRendu] ?? devoir.statutRendu}
        </span>
      </div>
      {aFaire && <DeposerCopie devoirId={devoir.id} />}
    </li>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
