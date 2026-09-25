'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { CoursApiError, creerCours, listerMesCours, type CoursResume } from '@brio/api-client'

import { Icon } from '@/components/ui/icon'
import {
  NouveauCoursDialog,
  type NouveauCoursValeurs,
} from '@/components/prof/nouveau-cours-dialog'
import {
  contenuDepuisBrouillon,
  listerBrouillons,
  supprimerBrouillon,
  type Brouillon,
} from '@/lib/cours-editeur'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

// Accueil de l'espace enseignant : les cours de l'enseignant, servis par l'API (source de vérité),
// du plus récent au plus ancien. « Nouveau cours » ouvre une fenêtre (titre + niveau + matière)
// puis crée le cours côté serveur. Les anciens brouillons restés en local (avant la bascule
// serveur) sont proposés à l'import — migration douce, jamais silencieuse.

type Dialogue = { mode: 'nouveau' } | { mode: 'import'; draft: Brouillon }

export function MesCours() {
  const router = useRouter()
  const [cours, setCours] = useState<CoursResume[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [locaux, setLocaux] = useState<Brouillon[]>([])
  const [dialogue, setDialogue] = useState<Dialogue | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreurDialogue, setErreurDialogue] = useState<string | null>(null)

  const recharger = useCallback(async () => {
    setLocaux(listerBrouillons())
    try {
      setCours(await listerMesCours(API_URL))
      setErreur(null)
    } catch (e) {
      setCours([])
      setErreur(
        e instanceof CoursApiError ? e.message : 'Impossible de charger vos cours pour le moment.'
      )
    }
  }, [])

  useEffect(() => {
    void recharger()
  }, [recharger])

  async function valider(valeurs: NouveauCoursValeurs) {
    setEnCours(true)
    setErreurDialogue(null)
    try {
      const content =
        dialogue?.mode === 'import' ? contenuDepuisBrouillon(dialogue.draft) : undefined
      const coursId = await creerCours(API_URL, { ...valeurs, content })
      if (dialogue?.mode === 'import') supprimerBrouillon(dialogue.draft.id)
      router.push(`/prof/cours/${coursId}`)
    } catch (e) {
      setErreurDialogue(
        e instanceof CoursApiError ? e.message : 'La création du cours a échoué. Réessayez.'
      )
      setEnCours(false)
    }
  }

  function supprimerLocal(id: string, titre: string) {
    if (!window.confirm(`Supprimer le brouillon local « ${titre || 'Cours sans titre'} » ?`)) return
    supprimerBrouillon(id)
    setLocaux(listerBrouillons())
  }

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="border-b border-line bg-surface-panel">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
              Brio · Espace enseignant
            </p>
            <h1 className="font-display text-2xl font-black tracking-tight text-ink">Mes cours</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setErreurDialogue(null)
              setDialogue({ mode: 'nouveau' })
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-display text-sm font-extrabold text-surface-panel [box-shadow:var(--shadow-arcade)] hover:-translate-y-0.5"
          >
            <span aria-hidden="true">＋</span> Nouveau cours
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {erreur && (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 font-prose text-sm text-ink"
          >
            {erreur}
          </p>
        )}

        {cours === null ? (
          <p className="font-prose text-ink-muted">Chargement…</p>
        ) : cours.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface-panel px-6 py-14 text-center">
            <p className="font-display text-lg font-extrabold text-ink">
              Aucun cours pour l’instant
            </p>
            <p className="mx-auto mt-1 max-w-md font-prose text-sm text-ink-muted">
              Crée ton premier cours : un titre, des parties, et des blocs (texte, formule, exemple
              en étapes, exercice…). Tu verras en direct ce que verra l’élève.
            </p>
            <button
              type="button"
              onClick={() => {
                setErreurDialogue(null)
                setDialogue({ mode: 'nouveau' })
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-display text-base font-extrabold text-surface-panel [box-shadow:var(--shadow-arcade)] hover:-translate-y-0.5"
            >
              <span aria-hidden="true">＋</span> Créer mon premier cours
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cours.map((c) => (
              <li key={c.id}>
                <CarteCours cours={c} />
              </li>
            ))}
          </ul>
        )}

        {locaux.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-muted">
              Brouillons locaux à importer
            </h2>
            <p className="mt-1 max-w-2xl font-prose text-sm text-ink-muted">
              Ces cours n’existaient que sur cet appareil. Importe-les pour les enregistrer sur le
              serveur (tu choisiras leur niveau et leur matière).
            </p>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {locaux.map((b) => (
                <li key={b.id}>
                  <CarteLocale
                    draft={b}
                    onImporter={() => {
                      setErreurDialogue(null)
                      setDialogue({ mode: 'import', draft: b })
                    }}
                    onSupprimer={() => supprimerLocal(b.id, b.title)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {dialogue && (
        <NouveauCoursDialog
          titreInitial={dialogue.mode === 'import' ? dialogue.draft.title : ''}
          intitule={dialogue.mode === 'import' ? 'Importer le brouillon' : 'Nouveau cours'}
          libelleAction={dialogue.mode === 'import' ? 'Importer' : 'Créer le cours'}
          enCours={enCours}
          erreur={erreurDialogue}
          onValiderAction={valider}
          onFermerAction={() => {
            if (!enCours) setDialogue(null)
          }}
        />
      )}
    </div>
  )
}

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  publie: 'Publié',
  archive: 'Archivé',
}

function CarteCours({ cours }: { cours: CoursResume }) {
  const statut = cours.statut ?? 'brouillon'
  const publie = statut === 'publie'
  return (
    <div className="group relative flex h-full flex-col rounded-xl border border-line bg-surface-panel p-5 transition-colors hover:border-accent-edge">
      <Link href={`/prof/cours/${cours.id}`} className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-2.5 py-0.5 font-display text-[11px] font-extrabold text-accent-ink">
          <span
            className={`h-1.5 w-1.5 rounded-full ${publie ? 'bg-success' : 'bg-xp'}`}
            aria-hidden="true"
          />
          {STATUT_LABELS[statut] ?? statut}
          {publie && cours.versionPubliee ? ` · v${cours.versionPubliee}` : ''}
        </span>
        <p className="mt-2 font-display text-lg font-extrabold text-ink">
          {cours.titre?.trim() || 'Cours sans titre'}
        </p>
        <p className="mt-1 font-prose text-sm text-ink-muted">
          {[cours.niveauCode, cours.matiereCode].filter(Boolean).join(' · ')}
          {cours.updatedAt ? ` · modifié le ${dateCourte(cours.updatedAt)}` : ''}
        </p>
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <Link
          href={`/prof/cours/${cours.id}`}
          className="inline-flex items-center gap-1.5 font-display text-sm font-extrabold text-accent-ink"
        >
          Continuer <Icon name="arrow-right" size={14} aria-hidden="true" />
        </Link>
        {publie && (
          <Link
            href={`/cours/${cours.id}`}
            className="font-display text-sm font-bold text-ink-muted hover:text-ink"
          >
            Voir côté élève
          </Link>
        )}
      </div>
    </div>
  )
}

function CarteLocale({
  draft,
  onImporter,
  onSupprimer,
}: {
  draft: Brouillon
  onImporter: () => void
  onSupprimer: () => void
}) {
  const blocs = draft.sections.reduce((n, s) => n + s.blocks.length, 0)
  return (
    <div className="flex h-full flex-col rounded-xl border border-dashed border-line bg-surface-panel p-5">
      <p className="font-display text-lg font-extrabold text-ink">
        {draft.title.trim() || 'Cours sans titre'}
      </p>
      <p className="mt-1 font-prose text-sm text-ink-muted">
        {draft.sections.length} partie{draft.sections.length > 1 ? 's' : ''} · {blocs} bloc
        {blocs > 1 ? 's' : ''} · local
      </p>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onImporter}
          className="inline-flex items-center gap-1.5 font-display text-sm font-extrabold text-accent-ink"
        >
          Importer <Icon name="arrow-right" size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onSupprimer}
          aria-label={`Supprimer ${draft.title.trim() || 'ce brouillon local'}`}
          title="Supprimer"
          className="grid h-8 w-8 place-items-center rounded-md border border-line text-ink-muted hover:border-danger hover:text-danger"
        >
          <Icon name="x" size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function dateCourte(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(iso))
  } catch {
    return ''
  }
}
