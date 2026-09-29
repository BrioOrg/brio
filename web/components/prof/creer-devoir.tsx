'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  CoursApiError,
  creerDevoir,
  getCoursBrouillon,
  listerMesClasses,
  listerMesCours,
  type ClasseInfo,
  type CoursResume,
} from '@brio/api-client'

import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

// Créer un devoir (F4, v1 « devoir maison »). Thème clair « document », comme l'éditeur de cours.
// L'enseignant part d'un de ses cours publiés, coche les exercices, choisit la classe et deux dates.
// Les exercices n'ont d'identifiant stable qu'une fois le cours publié — on ne propose donc que les
// cours publiés (un brouillon n'a pas encore d'exercices assignables à un devoir).

type ExerciceChoisi = { id: string; libelle: string }

function extraireExercices(content: unknown): ExerciceChoisi[] {
  const doc = content as { sections?: { blocks?: Record<string, unknown>[] }[] } | null
  const exos: ExerciceChoisi[] = []
  for (const section of doc?.sections ?? []) {
    for (const bloc of section.blocks ?? []) {
      if (bloc.type === 'exercise' && typeof bloc.exerciceId === 'string') {
        const libelle =
          (typeof bloc.prompt === 'string' && bloc.prompt) ||
          (typeof bloc.statement === 'string' && bloc.statement) ||
          'Exercice'
        exos.push({ id: bloc.exerciceId, libelle: libelle.slice(0, 80) })
      }
    }
  }
  return exos
}

export function CreerDevoir() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClasseInfo[]>([])
  const [cours, setCours] = useState<CoursResume[]>([])
  const [classeId, setClasseId] = useState('')
  const [coursId, setCoursId] = useState('')
  const [titre, setTitre] = useState('')
  const [consigne, setConsigne] = useState('')
  const [ouvreAt, setOuvreAt] = useState('')
  const [echeanceAt, setEcheanceAt] = useState('')
  const [exercices, setExercices] = useState<ExerciceChoisi[]>([])
  const [choisis, setChoisis] = useState<Set<string>>(new Set())
  const [chargementExos, setChargementExos] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [cl, co] = await Promise.all([
          listerMesClasses(apiBaseUrl()),
          listerMesCours(apiBaseUrl()),
        ])
        setClasses(cl)
        setCours(co.filter((c) => c.statut === 'publie'))
      } catch (e) {
        setErreur(e instanceof CoursApiError ? e.message : 'Chargement impossible.')
      }
    })()
  }, [])

  const choisirCours = useCallback(async (id: string) => {
    setCoursId(id)
    setExercices([])
    setChoisis(new Set())
    if (!id) return
    setChargementExos(true)
    try {
      const detail = await getCoursBrouillon(apiBaseUrl(), id)
      const exos = extraireExercices(detail.content)
      setExercices(exos)
      setChoisis(new Set(exos.map((e) => e.id)))
      if (!titre) {
        const c = cours.find((x) => x.id === id)
        if (c) setTitre(c.titre ?? '')
      }
    } catch (e) {
      setErreur(e instanceof CoursApiError ? e.message : 'Impossible de charger le cours.')
    } finally {
      setChargementExos(false)
    }
    // titre/cours volontairement hors deps : lecture d'un instantané au moment du choix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cours])

  const pretAEnvoyer =
    classeId && coursId && titre.trim() && ouvreAt && echeanceAt && choisis.size > 0 && !envoi

  async function assigner() {
    if (!pretAEnvoyer) return
    setEnvoi(true)
    setErreur(null)
    try {
      const id = await creerDevoir(apiBaseUrl(), {
        classeId,
        titre: titre.trim(),
        consigne: consigne.trim() || undefined,
        sourceType: 'cours',
        sourceRef: coursId,
        exerciceIds: exercices.filter((e) => choisis.has(e.id)).map((e) => e.id),
        ouvreAt: new Date(ouvreAt).toISOString(),
        echeanceAt: new Date(echeanceAt).toISOString(),
      })
      router.push(`/prof/devoirs/${id}`)
    } catch (e) {
      setErreur(e instanceof CoursApiError ? e.message : 'La création a échoué. Réessayez.')
      setEnvoi(false)
    }
  }

  const classeChoisie = useMemo(() => classes.find((c) => c.id === classeId), [classes, classeId])

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="flex items-center gap-3 border-b border-line bg-surface-panel px-4 py-3">
        <Link
          href="/prof/devoirs"
          aria-label="Retour aux devoirs"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-ink-muted hover:text-ink"
        >
          <Icon name="arrow-right" size={16} className="rotate-180" aria-hidden="true" />
        </Link>
        <h1 className="font-display text-lg font-extrabold text-ink">Nouveau devoir</h1>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {erreur && (
          <p className="mb-4 rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger">
            {erreur}
          </p>
        )}

        <Champ label="Classe">
          <select
            className="w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-ink"
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
          >
            <option value="">— choisir une classe —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle} ({c.niveauCode})
              </option>
            ))}
          </select>
        </Champ>

        <Champ label="À partir d'un cours publié">
          <select
            className="w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-ink"
            value={coursId}
            onChange={(e) => void choisirCours(e.target.value)}
          >
            <option value="">— choisir un cours —</option>
            {cours.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titre}
              </option>
            ))}
          </select>
          {cours.length === 0 && (
            <p className="mt-1 text-xs text-ink-muted">
              Aucun cours publié. Publie un cours pour pouvoir l’assigner.
            </p>
          )}
        </Champ>

        {coursId && (
          <Champ label="Exercices">
            {chargementExos ? (
              <p className="text-sm text-ink-muted">Chargement des exercices…</p>
            ) : exercices.length === 0 ? (
              <p className="text-sm text-ink-muted">Ce cours ne contient aucun exercice.</p>
            ) : (
              <ul className="rounded-lg border border-line bg-surface-panel">
                {exercices.map((ex) => (
                  <li key={ex.id} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0">
                    <input
                      type="checkbox"
                      id={`ex-${ex.id}`}
                      checked={choisis.has(ex.id)}
                      onChange={(e) =>
                        setChoisis((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(ex.id)
                          else next.delete(ex.id)
                          return next
                        })
                      }
                    />
                    <label htmlFor={`ex-${ex.id}`} className="min-w-0 flex-1 truncate text-sm text-ink">
                      {ex.libelle}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Champ>
        )}

        <Champ label="Titre">
          <input
            className="w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-ink"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex. Théorème de Pythagore — exercices"
          />
        </Champ>

        <Champ label="Consigne (facultatif)">
          <textarea
            className="w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-ink"
            rows={2}
            value={consigne}
            onChange={(e) => setConsigne(e.target.value)}
          />
        </Champ>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ label="Ouverture">
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-ink"
              value={ouvreAt}
              onChange={(e) => setOuvreAt(e.target.value)}
            />
          </Champ>
          <Champ label="Échéance">
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-line bg-surface-panel px-3 py-2 text-ink"
              value={echeanceAt}
              onChange={(e) => setEcheanceAt(e.target.value)}
            />
          </Champ>
        </div>

        <button
          type="button"
          onClick={() => void assigner()}
          disabled={!pretAEnvoyer}
          className="mt-4 rounded-lg bg-accent px-5 py-2.5 font-display text-sm font-extrabold text-surface-panel disabled:cursor-not-allowed disabled:opacity-50"
        >
          {envoi ? 'Assignation…' : classeChoisie ? `Assigner à ${classeChoisie.libelle}` : 'Assigner'}
        </button>
      </main>
    </div>
  )
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  )
}
