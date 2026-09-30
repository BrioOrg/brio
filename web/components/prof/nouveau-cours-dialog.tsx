'use client'

import { useEffect, useId, useMemo, useState } from 'react'

import { listerMesEtablissements, type EtablissementPublic } from '@brio/api-client'

import { getCatalogue, type Catalogue } from '@/lib/api'
import { apiBaseUrl } from '@/lib/api-base-url'
import { MODELES, MODELE_DEFAUT, type ModeleId } from '@/lib/cours-modeles'

// Petite fenêtre de création d'un cours : titre + niveau + matière. Le niveau et la matière sont
// exigés par le serveur (ils déterminent la colonne du cours) mais ne se règlent pas dans
// l'éditeur ; on les collecte donc ici, une fois, avant d'ouvrir la page. Les listes viennent du
// catalogue réel (ADR 0011) — jamais de valeurs inventées.
// À la création (montrerModeles), on choisit aussi un modèle de départ : le cours s'ouvre déjà
// structuré, on ne tombe jamais sur une page vide.
// Un enseignant rattaché à plusieurs établissements précise aussi celui du cours (ADR 0029 §4) ;
// avec un seul, le serveur le déduit et rien n'est demandé.

export type NouveauCoursValeurs = {
  titre: string
  niveauCode: string
  matiereCode: string
  etablissementId?: string
  modele?: ModeleId
}

export function NouveauCoursDialog({
  titreInitial = '',
  intitule = 'Nouveau cours',
  libelleAction = 'Créer le cours',
  montrerModeles = false,
  enCours = false,
  erreur = null,
  onValiderAction,
  onFermerAction,
}: {
  titreInitial?: string
  intitule?: string
  libelleAction?: string
  montrerModeles?: boolean
  enCours?: boolean
  erreur?: string | null
  onValiderAction: (valeurs: NouveauCoursValeurs) => void
  onFermerAction: () => void
}) {
  const titreId = useId()
  const niveauId = useId()
  const matiereId = useId()
  const etablissementChampId = useId()

  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [chargementCatalogue, setChargementCatalogue] = useState(true)
  const [titre, setTitre] = useState(titreInitial)
  const [niveauCode, setNiveauCode] = useState('')
  const [matiereCode, setMatiereCode] = useState('')
  const [modele, setModele] = useState<ModeleId>(MODELE_DEFAUT)
  const [etablissements, setEtablissements] = useState<EtablissementPublic[]>([])
  const [etablissementId, setEtablissementId] = useState('')

  useEffect(() => {
    let vivant = true
    // On failure nothing is asked: the server still refuses an ambiguous établissement.
    listerMesEtablissements(apiBaseUrl())
      .then((e) => {
        if (vivant) setEtablissements(e)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  const choisirEtablissement = etablissements.length > 1

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
    titre.trim().length > 0 &&
    niveauCode.length > 0 &&
    matiereCode.length > 0 &&
    (!choisirEtablissement || etablissementId.length > 0) &&
    !enCours

  function valider() {
    if (!pretAValider) return
    onValiderAction({
      titre: titre.trim(),
      niveauCode,
      matiereCode,
      ...(choisirEtablissement ? { etablissementId } : {}),
      ...(montrerModeles ? { modele } : {}),
    })
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-surface-panel p-6 shadow-lg">
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

          {choisirEtablissement && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={etablissementChampId}
                className="font-display text-sm font-bold text-ink"
              >
                Établissement
              </label>
              <select
                id={etablissementChampId}
                value={etablissementId}
                onChange={(e) => setEtablissementId(e.target.value)}
                className="rounded-lg border border-line bg-surface-page px-3 py-2 font-prose text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Choisir…</option>
                {etablissements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          {montrerModeles && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="font-display text-sm font-bold text-ink">
                Partir d’un modèle
              </legend>
              <p className="font-prose text-xs text-ink-muted">
                Le cours s’ouvrira déjà structuré — tu n’auras plus qu’à remplir.
              </p>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODELES.map((m) => {
                  const actif = modele === m.id
                  return (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors ${
                        actif
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-surface-page hover:border-accent-edge'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="modele"
                          value={m.id}
                          checked={actif}
                          onChange={() => setModele(m.id)}
                          className="h-4 w-4"
                        />
                        <span className="font-display text-sm font-extrabold text-ink">
                          {m.libelle}
                        </span>
                      </span>
                      <span className="pl-6 font-prose text-xs text-ink-muted">
                        {m.description}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

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
