'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { controleActif, examenActif } from '@brio/api-client'
import { askTuteurForTarget, type TutorTarget } from '@/lib/api'
import { apiBaseUrl } from '@/lib/api-base-url'
import { useChapterInteraction } from '@/components/chapter-interaction-context'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

const CAP_MESSAGE =
  'Tu as atteint la limite de questions pour cette session. Demande à ton professeur si tu as besoin d’aide supplémentaire.'

export type TuteurPanelProps = {
  target: TutorTarget
  /**
   * The exercise the question is about. Left out, the panel sends the last exercise the student
   * touched; the interactive mode's drawer passes the current slide's (or null) instead (#250).
   */
  exerciceId?: string | null
  /** Shown above the field: what the tutor will be told the question is about. */
  contexte?: string
  /** Replaces scrolling to a cited block, for a mode where that block may be on another slide. */
  onCitation?: (blockId: string) => void
}

export function TuteurPanel({ target, exerciceId, contexte, onCitation }: TuteurPanelProps) {
  const { activeExerciceId, tutorRequestCap, echangesTuteur, ajouterEchangeTuteur } =
    useChapterInteraction()
  const champId = useId()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enControle, setEnControle] = useState(false)
  const [enExamen, setEnExamen] = useState(false)
  const answerRegionRef = useRef<HTMLDivElement>(null)

  // Pendant un contrôle (ADR 0025) ou un examen d'annale (ADR 0027), le tuteur est coupé. Le serveur
  // refuse déjà ; ici on verrouille l'UI de façon proactive. Une vérification qui échoue ne verrouille pas.
  useEffect(() => {
    let vivant = true
    controleActif(apiBaseUrl())
      .then((c) => {
        if (vivant) setEnControle(c.enControle)
      })
      .catch(() => {})
    examenActif(apiBaseUrl())
      .then((e) => {
        if (vivant) setEnExamen(e.enExamen)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  const verrouille = enControle || enExamen
  const requestCount = echangesTuteur.length
  const capped = requestCount >= tutorRequestCap
  const sendDisabled = question.trim() === '' || loading || capped

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sendDisabled) return
    setError(null)
    setLoading(true)
    try {
      const response = await askTuteurForTarget(
        target,
        question,
        exerciceId === undefined ? activeExerciceId : exerciceId
      )
      ajouterEchangeTuteur({ question, response })
      setQuestion('')
    } catch {
      setError('Erreur réseau. Réessaie dans un moment.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit(e as unknown as React.FormEvent)
    }
  }

  function scrollToBlock(citation: string) {
    const blockId = citation.split('/').pop()
    if (!blockId) return
    if (onCitation) {
      onCitation(blockId)
      return
    }
    const el = document.getElementById(blockId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.setAttribute('data-cited', 'true')
    setTimeout(() => el.removeAttribute('data-cited'), 1500)
  }

  const remaining = tutorRequestCap - requestCount

  return (
    <section aria-label="Tuteur">
      <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
        Ton tuteur
      </p>

      {echangesTuteur.length > 0 && (
        <div
          ref={answerRegionRef}
          aria-live="polite"
          aria-label="Réponses du tuteur"
          className="mb-4 flex flex-col gap-3"
        >
          {echangesTuteur.map((msg, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface-raised p-3">
              <p className="mb-2 font-prose text-xs text-ink-muted">{msg.question}</p>
              <p className="font-prose text-sm leading-relaxed text-ink">{msg.response.reponse}</p>
              {msg.response.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.response.citations.map((citation) => {
                    const blockId = citation.split('/').pop() ?? citation
                    return (
                      <button
                        key={citation}
                        type="button"
                        onClick={() => scrollToBlock(citation)}
                        className="inline-flex items-center gap-1 rounded-pill border border-info/30 bg-info/10 px-2 py-0.5 font-display text-xs font-extrabold text-info transition-colors hover:bg-info/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                      >
                        <Icon name="arrow-up-right" size={10} aria-hidden="true" />
                        {blockId}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {verrouille && (
        <p
          role="status"
          className="mb-3 rounded-md border border-line bg-surface-raised p-3 font-prose text-sm text-ink"
        >
          🔒{' '}
          <span className="font-display font-extrabold">
            {enControle ? 'Contrôle' : 'Examen'} en cours.
          </span>{' '}
          Le tuteur est indisponible pendant {enControle ? 'le contrôle' : "l'examen"}.
        </p>
      )}

      {!verrouille && capped && (
        <p
          role="status"
          className="mb-3 rounded-md border border-line bg-surface-raised p-3 font-prose text-sm text-ink-muted"
        >
          {CAP_MESSAGE}
        </p>
      )}

      {!verrouille && error && (
        <p role="alert" className="mb-3 font-prose text-sm text-danger">
          {error}
        </p>
      )}

      {!verrouille && !capped && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor={champId} className="sr-only">
            Ta question au tuteur
          </label>
          {contexte && <p className="font-prose text-xs text-ink-muted">{contexte}</p>}
          <textarea
            id={champId}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pose ta question sur ce chapitre…"
            rows={3}
            disabled={loading}
            className="w-full resize-none rounded-md border border-line bg-surface-page px-3 py-2 font-prose text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
          <div className="flex items-center justify-between">
            {requestCount > 0 ? (
              <p className="font-prose text-xs text-ink-muted">
                {remaining} question{remaining !== 1 ? 's' : ''} restante
                {remaining !== 1 ? 's' : ''}
              </p>
            ) : (
              <span />
            )}
            <Button type="submit" loading={loading} disabled={sendDisabled} size="sm">
              Envoyer
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
