'use client'

import { useEffect, useId, useMemo, useState } from 'react'

import { getCatalogue, type Catalogue } from '@/lib/api'

// Petite fenêtre de création d'un cours : titre + niveau + matière. Le niveau et la matière sont
// exigés par le serveur (ils déterminent la colonne du cours) mais ne se règlent pas dans
// l'éditeur ; on les collecte donc ici, une fois, avant d'ouvrir la page. Les listes viennent du
// catalogue réel (ADR 0011) — jamais de valeurs inventées.

export type NouveauCoursValeurs = {
  titre: string
  niveauCode: string
  matiereCode: string
}

export function NouveauCoursDialog({
  titreInitial = '',
  intitule = 'Nouveau cours',
  libelleAction = 'Créer le cours',
  enCours = false,
  erreur = null,
  onValiderAction,
  onFermerAction,
}: {
  titreInitial?: string
  intitule?: string
  libelleAction?: string
  enCours?: boolean
  erreur?: string | null
  onValiderAction: (valeurs: NouveauCoursValeurs) => void
  onFermerAction: () => void
}) {
  const titreId = useId()
  const niveauId = useId()
  const matiereId = useId()

  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [chargementCatalogue, setChargementCatalogue] = useState(true)
  const [titre, setTitre] = useState(titreInitial)
  const [niveauCode, setNiveauCode] = useState('')
  const [matiereCode, setMatiereCode] = useState('')

  useEffect(() => {
    let vivant = true
    getCatalogue()
      .then((c) => {
        if (vivant) setCatalogue(c)
      })
      .catch(() => {
        if (vivant) setCatalogue([])
      })
      .finally(() => {
        if (vivant) setChargementCatalogue(false)
      })
    return () => {
      vivant = false
    }
  }, [])

  // Les matières disponibles dépendent du niveau choisi.
  const matieres = useMemo(() => {
    const niveau = catalogue?.find((n) => n.niveauCode === niveauCode)
    return niveau?.matieres ?? []
  }, [catalogue, niveauCode])

  const pretAValider =
    titre.trim().length > 0 && niveauCode.length > 0 && matiereCode.length > 0 && !enCours

  function valider() {
    if (!pretAValider) return
    onValiderAction({ titre: titre.trim(), niveauCode, matiereCode })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={intitule}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onFermerAction()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-surface-panel p-6 shadow-lg">
        <h2 className="font-display text-lg font-extrabold text-ink">{intitule}</h2>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={titreId} className="font-display text-sm font-bold text-ink">
              Titre du cours
            </label>
            <input
              id={titreId}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. Le théorème de Pythagore"
              className="rounded-lg border border-line bg-surface-page px-3 py-2 font-prose text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={niveauId} className="font-display text-sm font-bold text-ink">
                Niveau
              </label>
              <select
                id={niveauId}
                value={niveauCode}
                onChange={(e) => {
                  setNiveauCode(e.target.value)
                  setMatiereCode('')
                }}
                disabled={chargementCatalogue}
                className="rounded-lg border border-line bg-surface-page px-3 py-2 font-prose text-ink focus:border-accent focus:outline-none disabled:opacity-50"
              >
                <option value="">{chargementCatalogue ? 'Chargement…' : 'Choisir…'}</option>
                {catalogue?.map((n) => (
                  <option key={n.niveauCode} value={n.niveauCode}>
                    {n.niveauLibelle}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={matiereId} className="font-display text-sm font-bold text-ink">
                Matière
              </label>
              <select
                id={matiereId}
                value={matiereCode}
                onChange={(e) => setMatiereCode(e.target.value)}
                disabled={!niveauCode || matieres.length === 0}
                className="rounded-lg border border-line bg-surface-page px-3 py-2 font-prose text-ink focus:border-accent focus:outline-none disabled:opacity-50"
              >
                <option value="">{niveauCode ? 'Choisir…' : '—'}</option>
                {matieres.map((m) => (
                  <option key={m.matiereCode} value={m.matiereCode}>
                    {m.matiereLibelle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {erreur && (
            <p role="alert" className="font-prose text-sm text-danger">
              {erreur}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFermerAction}
            className="rounded-lg border border-line px-4 py-2 font-display text-sm font-extrabold text-ink-muted hover:text-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={valider}
            disabled={!pretAValider}
            className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-extrabold text-surface-panel disabled:opacity-50"
          >
            {enCours ? 'En cours…' : libelleAction}
          </button>
        </div>
      </div>
    </div>
  )
}
