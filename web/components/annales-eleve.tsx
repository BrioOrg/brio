'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import {
  demarrerExamen,
  entrainementParCompetence,
  listerAnnales,
  listerCompetencesAnnales,
  type AnnaleVue,
  type CompetenceAnnale,
  type EntrainementExercice,
} from '@brio/api-client'

import { signalerExamenDemarre } from '@/components/examen-banner'
import { apiBaseUrl } from '@/lib/api-base-url'

// Annales (F7, ADR 0026). Deux vues : « Sujets » (parcourir les sujets d'examen ; une annale est un
// chapitre → on la lit via l'écran de chapitre existant) et « Entraînement par compétence » (les
// exercices d'annales qui travaillent une compétence). Tout vient du serveur — jamais de donnée
// fabriquée.

type Vue = 'sujets' | 'entrainement'

export function AnnalesEleve() {
  const [annales, setAnnales] = useState<AnnaleVue[] | null>(null)
  // null while loading; a failure is its own state, never an empty list (#406).
  const [competences, setCompetences] = useState<CompetenceAnnale[] | null>(null)
  const [erreurCompetences, setErreurCompetences] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [vue, setVue] = useState<Vue>('sujets')

  useEffect(() => {
    void (async () => {
      try {
        const [a, c] = await Promise.all([
          listerAnnales(apiBaseUrl()),
          listerCompetencesAnnales(apiBaseUrl()).catch(() => null),
        ])
        setAnnales(a)
        setCompetences(c)
        setErreurCompetences(c === null)
      } catch {
        setErreur('Impossible de charger les annales pour le moment.')
      }
    })()
  }, [])

  return (
    <main className="px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold text-ink">Annales</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Choisis un sujet, puis entraîne-toi à ton rythme ou en mode examen.
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-line bg-surface-panel p-0.5">
          {(['sujets', 'entrainement'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVue(v)}
              aria-pressed={vue === v}
              className={`rounded-md px-3 py-1.5 font-display text-sm font-bold ${
                vue === v ? 'bg-surface-page text-ink shadow-sm' : 'text-ink-muted'
              }`}
            >
              {v === 'sujets' ? 'Sujets' : 'Par compétence'}
            </button>
          ))}
        </div>

        {erreur && <p className="mt-4 text-danger">{erreur}</p>}
        {!annales && !erreur && <p className="mt-4 text-ink-muted">Chargement…</p>}

        {annales && vue === 'sujets' && <VueSujets annales={annales} />}
        {annales && vue === 'entrainement' && erreurCompetences && (
          <p role="alert" className="mt-6 text-danger">
            Impossible de charger les compétences pour le moment. Recharge la page pour réessayer.
          </p>
        )}
        {annales && vue === 'entrainement' && competences && (
          <VueEntrainement competences={competences} annales={annales} />
        )}
      </div>
    </main>
  )
}

function VueSujets({ annales }: { annales: AnnaleVue[] }) {
  const router = useRouter()
  // The subject whose exam start is being confirmed, then started, or that failed to start.
  const [aConfirmer, setAConfirmer] = useState<string | null>(null)
  const [demarrage, setDemarrage] = useState(false)
  const [echec, setEchec] = useState<string | null>(null)

  async function demarrerExamenSurAnnale(a: AnnaleVue) {
    if (demarrage) return
    setDemarrage(true)
    setEchec(null)
    try {
      await demarrerExamen(apiBaseUrl(), a.id)
    } catch {
      // Never open the subject as if the exam had started (#407): the student stays here and
      // can retry or train without the timer.
      setEchec(a.id)
      setDemarrage(false)
      return
    }
    // The banner lives in the layout and does not remount on navigation: tell it to look again.
    signalerExamenDemarre()
    router.push(`/${a.niveau}/${a.matiere}/${a.id}`)
  }

  // Regroupées par examen puis année décroissante.
  const groupes = useMemo(() => {
    const parExamen = new Map<string, AnnaleVue[]>()
    for (const a of annales) {
      const cle = a.examen
      if (!parExamen.has(cle)) parExamen.set(cle, [])
      parExamen.get(cle)!.push(a)
    }
    for (const liste of parExamen.values()) liste.sort((x, y) => y.annee - x.annee)
    return [...parExamen.entries()]
  }, [annales])

  if (annales.length === 0) {
    return <p className="mt-6 text-ink-muted">Aucune annale disponible pour l’instant.</p>
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {groupes.map(([examen, liste]) => (
        <section key={examen}>
          <h2 className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
            {examen}
          </h2>
          <ul className="flex flex-col gap-3">
            {liste.map((a) => (
              <li key={a.id} className="rounded-2xl border border-line bg-surface-panel p-4">
                <Link href={`/${a.niveau}/${a.matiere}/${a.id}`} className="block hover:opacity-80">
                  <div className="font-display text-base font-extrabold text-ink">{a.titre}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {[a.session, a.annee, a.centre].filter(Boolean).join(' · ')}
                    {a.dureeMinutes ? ` · ${a.dureeMinutes} min` : ''}
                  </div>
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/${a.niveau}/${a.matiere}/${a.id}`}
                    className="rounded-md border border-line px-3 py-1.5 font-display text-sm font-bold text-ink hover:border-accent"
                  >
                    S’entraîner
                  </Link>
                  {aConfirmer !== a.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEchec(null)
                        setAConfirmer(a.id)
                      }}
                      className="rounded-md bg-accent px-3 py-1.5 font-display text-sm font-extrabold text-surface-panel"
                    >
                      Démarrer en mode examen
                    </button>
                  )}
                </div>
                {aConfirmer === a.id && (
                  // What the exam mode does: ExamenService (timer from the subject's duration,
                  // tutor cut while the session is open, « Rendre » ends it; ADR 0027).
                  <div className="mt-3 rounded-lg border border-line bg-surface-page p-3">
                    <p className="text-sm text-ink">
                      {a.dureeMinutes
                        ? `Le chrono dure ${a.dureeMinutes} min. `
                        : 'Le chrono démarre tout de suite. '}
                      Le tuteur est coupé jusqu’à ce que tu rendes ta copie.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void demarrerExamenSurAnnale(a)}
                        disabled={demarrage}
                        className="rounded-md bg-accent px-3 py-1.5 font-display text-sm font-extrabold text-surface-panel disabled:opacity-50"
                      >
                        {demarrage ? 'Démarrage…' : 'Je commence l’examen'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAConfirmer(null)
                          setEchec(null)
                        }}
                        disabled={demarrage}
                        className="rounded-md border border-line px-3 py-1.5 font-display text-sm font-bold text-ink hover:border-accent"
                      >
                        Annuler
                      </button>
                    </div>
                    {echec === a.id && (
                      <p role="alert" className="mt-2 text-sm text-danger">
                        Le mode examen n’a pas pu démarrer. Réessaie, ou entraîne-toi sans chrono.
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function VueEntrainement({
  competences,
  annales,
}: {
  competences: CompetenceAnnale[]
  annales: AnnaleVue[]
}) {
  const [code, setCode] = useState('')
  const [exos, setExos] = useState<EntrainementExercice[] | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(false)

  // Lien vers l'annale source (une annale = un chapitre).
  const lienAnnale = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of annales) m.set(a.id, `/${a.niveau}/${a.matiere}/${a.id}`)
    return m
  }, [annales])

  async function choisir(nouveauCode: string) {
    setCode(nouveauCode)
    setExos(null)
    setErreur(false)
    if (!nouveauCode) return
    setChargement(true)
    try {
      setExos(await entrainementParCompetence(apiBaseUrl(), nouveauCode))
    } catch {
      // A failure is not « aucun exercice » (#406).
      setErreur(true)
    } finally {
      setChargement(false)
    }
  }

  if (competences.length === 0) {
    return (
      <p className="mt-6 text-ink-muted">
        Aucune compétence n’est encore travaillée par les annales disponibles.
      </p>
    )
  }

  return (
    <div className="mt-6">
      <label
        htmlFor="competence-annales"
        className="block font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted"
      >
        Choisis une compétence
      </label>
      <select
        id="competence-annales"
        value={code}
        onChange={(e) => void choisir(e.target.value)}
        className="mt-2 w-full rounded-lg border border-line bg-surface-panel px-3 py-2 font-prose text-sm text-ink"
      >
        <option value="">— Sélectionne une compétence —</option>
        {competences.map((c) => (
          <option key={c.code} value={c.code}>
            {c.intitule}
          </option>
        ))}
      </select>

      {chargement && <p className="mt-4 text-ink-muted">Chargement…</p>}

      {erreur && (
        <p role="alert" className="mt-4 text-danger">
          Impossible de charger les exercices de cette compétence. Choisis-la de nouveau pour
          réessayer.
        </p>
      )}

      {exos && exos.length === 0 && (
        <p className="mt-4 text-ink-muted">
          Aucun exercice d’annale sur cette compétence pour l’instant.
        </p>
      )}

      {exos && exos.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {exos.map((ex) => {
            const lien = lienAnnale.get(ex.annaleId)
            return (
              <li
                key={ex.exerciceId}
                className="rounded-2xl border border-line bg-surface-panel p-4"
              >
                <div className="font-prose text-sm text-ink">{ex.prompt}</div>
                <div className="mt-1 text-xs text-ink-muted">
                  {ex.exerciseType} · issu de{' '}
                  {lien ? (
                    <Link href={lien} className="font-bold text-accent-ink hover:underline">
                      {ex.annaleTitre}
                    </Link>
                  ) : (
                    ex.annaleTitre
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
